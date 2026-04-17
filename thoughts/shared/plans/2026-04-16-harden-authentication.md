---
type: implementation-plan
repo: card-game
branch: develop
sha: 212f0f9e59be89c08051a5863f4e78ff605c4a97
related-research: thoughts/shared/research/2026-04-16-authentication-session-management-research.md
related-plan: thoughts/shared/plans/2026-03-27-simple-authentication.md
---

# Harden Authentication & Session Management — Implementation Plan

## Overview

The current authentication system (see [research](../research/2026-04-16-authentication-session-management-research.md)) is a minimal, provider-based, single-preset-password setup with in-memory session storage and no transport hardening. It was scoped to be intentionally simple. This plan raises its security posture to production-appropriate levels in incremental phases, and outlines optional expansion paths (persistent storage, multi-user accounts, federated providers).

The plan is structured so each phase is independently shippable, reversible, and adds value on its own:

| Phase | Goal | New runtime deps? | Storage change? |
|------:|------|-------------------|-----------------|
| 1 | Baseline hardening (rate limiting, CORS allowlist, explicit no-password opt-in, body limits, security logging, tests) | No | No |
| 2 | Session lifecycle (TTL, sliding expiry, revoke-all, cleanup timer, richer session records) | No | No |
| 3 | Persistent session storage (SQLite, survives restart, admin visibility) | Yes — `jsr:@db/sqlite` | Yes — new DB file |
| 4 | Multi-user accounts (per-user password, account lockout, password change, rehash-on-login) | Yes — `jsr:@rabbit-company/argon2id` (or equivalent) | Schema extension |
| 5 (optional) | Expanded auth providers (guest, OAuth2, magic link) — sketch only | TBD | TBD |

Each phase is independently testable and can be paused between. The entire server auth module lives under `server/src/core/auth/` today and will continue to do so.

## Current State Analysis

Full current-state reference: [`thoughts/shared/research/2026-04-16-authentication-session-management-research.md`](../research/2026-04-16-authentication-session-management-research.md).

Summary of what exists today:

- **Providers**: `AuthProvider` interface with single registered implementation `PresetPasswordAuthProvider`. Credentials arrive through `AuthSessionService.login(providerName, credentials)`.
- **Session store**: `Map<string, string>` (token → username) inside `AuthSessionService`. Tokens are `crypto.randomUUID()`, no expiry, no metadata.
- **HTTP**: `ServerAuthRouteHandlerService` exposes `POST /auth/login`, `GET /auth/validate`, `DELETE /auth/logout`, plus OPTIONS preflight. CORS echoes the request `Origin` header.
- **Socket handshake**: Token sent via socket.io `auth` callback; validated by `ServerSocketGatewayService` through `AuthSessionService.validateToken`.
- **Frontend**: `AuthService` persists token/username in `localStorage`, validates on bootstrap, disconnects on logout.
- **Config**: `ServerConfigService.getAuthPassword()` reads `AUTH_PASSWORD`, returns empty string when unset — blank string silently disables password checking in `PresetPasswordAuthProvider` (`noPassword=true`).
- **Tests**: None for `AuthSessionService`, `PresetPasswordAuthProvider`, `ServerAuthRouteHandlerService`.

### Key concrete weak spots (sources of the hardening work)

1. `ServerAuthRouteHandlerService.handleLogin` — no rate limiting, no body size cap, CORS reflects any origin (`server-auth-route-handler-service.ts:73-101,172-180`).
2. `AuthSessionService.sessions` — tokens never expire, no metadata, lost on restart (`auth-session-service.ts:14-101`).
3. `PresetPasswordAuthProvider.initialize` — blank `AUTH_PASSWORD` silently enters no-password mode; easy to misconfigure (`preset-password-auth-provider.ts:39-48`).
4. Logging does not consistently include the requester IP or user-agent for failed attempts, and `[auth:password] rejected for '<username>'` logs the attempted username in debug — potentially PII (`preset-password-auth-provider.ts:61,78`).
5. No unit tests exist for any of the auth services.

## Desired End State

After all phases are implemented, authentication has the following properties:

1. **Rate-limited**: IP-based sliding-window limiter rejects excessive failed logins with 429 responses; limits configurable.
2. **Origin-restricted**: CORS only responds to origins on the `AUTH_ALLOWED_ORIGINS` allowlist (or `*` in explicit dev mode).
3. **Explicit disable**: No-password ("development") mode requires `AUTH_DISABLED=true` — misconfigured `AUTH_PASSWORD` fails loudly instead of silently disabling.
4. **Time-bounded sessions**: Tokens carry an expiry; revalidation extends it (sliding window); expired tokens are pruned.
5. **Persistent sessions** (Phase 3+): Sessions survive server restart.
6. **Per-user accounts** (Phase 4+): Real usernames with individual password hashes, in-app password change, per-account lockout.
7. **Observable**: Admin endpoints list and revoke sessions; security events logged with IP, user-agent, and correlation ids.
8. **Tested**: Unit tests cover every branch of the auth services (success, rejection, empty credentials, malformed bodies, expired tokens, rate-limit hits, concurrent logins).
9. **Extensible**: New `AuthProvider` implementations drop in without changes to the session layer, route handler, socket gateway, or frontend.

### Verification commands (run after every phase):
- Server type-check: `cd server && deno check --no-lock src/server.ts`
- Server lint: `cd server && deno lint src/`
- Server tests: `cd server && deno task test:unit`
- Frontend type-check: `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`

## What We're NOT Doing

- **Cookies / CSRF**: we keep Bearer-token in `localStorage`. If XSS risk later becomes a concern, `HttpOnly` cookies can be considered in a separate plan.
- **JWT**: tokens remain opaque. JWTs add key-management surface area without reducing the storage footprint for this server topology.
- **HTTPS / TLS enforcement**: delegated to infrastructure (Azure Container Apps ingress). Not an application concern here.
- **Email verification / password reset via email**: Phase 4 exposes password change (authenticated), not password reset-via-email, which would require email infra.
- **Multi-factor authentication**: explicitly out of scope. Can be a future provider.
- **Removing bcrypt outright**: Phase 4 introduces argon2id for new hashes but keeps bcrypt verification so legacy hashes continue to work via rehash-on-login.

---

## Phase 1: Baseline Hardening (no new storage, no new deps)

### Overview

Close the most exposed gaps without touching storage or the provider contract: rate limiting, CORS allowlist, body-size cap, explicit no-password opt-in, and add unit tests for everything in `server/src/core/auth/`.

All changes in this phase are reversible by flipping a flag or deleting a new file; no existing public API shapes change.

### Changes Required

#### 1.1 Add configuration knobs for hardening

**File**: `server/src/core/server-config-service.ts`

Add getters for the new knobs. Keep the file's "centralizes env reads" pattern. Include each in `validate()` so the process fails fast on misconfiguration.

```typescript
// Returns true when authentication is explicitly disabled (dev/test only).
// When true, any non-empty username logs in without a password check.
// When false/unset, AUTH_PASSWORD must be non-empty.
public isAuthDisabled(): boolean {
  return this.parseBooleanEnv('AUTH_DISABLED', false);
}

/**
 * Returns the allowlist of origins that may make authenticated requests.
 *
 * Comma-separated list. An entry of `*` allows any origin and should only
 * be used for local development. When unset, defaults to `*` in
 * development convenience mode but logs a warning on startup.
 */
public getAuthAllowedOrigins(): string[] {
  const raw = Deno.env.get('AUTH_ALLOWED_ORIGINS');
  if (!raw || !raw.trim()) {
    return ['*'];
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// Returns the maximum number of failed logins per IP per window before rate-limiting.
public getAuthRateLimitMaxAttempts(): number {
  return this.parseIntEnv('AUTH_RATE_LIMIT_MAX_ATTEMPTS', 10, { min: 1 });
}

// Returns the sliding-window duration (in milliseconds) used by the login rate limiter.
public getAuthRateLimitWindowMs(): number {
  return this.parseIntEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000, { min: 1_000 });
}

// Returns the maximum request body size (bytes) accepted on /auth/login.
public getAuthMaxBodyBytes(): number {
  return this.parseIntEnv('AUTH_MAX_BODY_BYTES', 4096, { min: 256, max: 1_048_576 });
}
```

Add a shared `parseIntEnv(name, defaultValue, { min, max })` helper near `parseBooleanEnv` (extract from the duplicated integer parsing blocks already in the file) and use it for `AUTH_RATE_LIMIT_*` and `AUTH_MAX_BODY_BYTES`.

Update `validate()`:

```typescript
public validate(): void {
  this.getPort();
  this.validateAuthPasswordConfig();   // <-- replace getAuthPassword()
  this.getAuthAllowedOrigins();
  this.getAuthRateLimitMaxAttempts();
  this.getAuthRateLimitWindowMs();
  this.getAuthMaxBodyBytes();
  this.isFileLoggingEnabled();
  this.getLogFileMaxBytes();
  this.isMatchStateExportEnabled();
  this.isMatchStateMergeEnabled();
  this.shouldEndMatchOnNoHumans();
  this.getTooltipDefaultCloseDelayMs();
}

/**
 * Validates the AUTH_PASSWORD / AUTH_DISABLED combination at startup.
 *
 * Throws when AUTH_DISABLED is not true and AUTH_PASSWORD is empty. This
 * eliminates the silent "blank AUTH_PASSWORD means no auth" backdoor —
 * disabling auth now requires explicit opt-in via AUTH_DISABLED=true.
 */
private validateAuthPasswordConfig(): void {
  const disabled = this.isAuthDisabled();
  const password = this.getAuthPassword();
  if (!disabled && !password) {
    throw new Error(
      '[server config] AUTH_PASSWORD must be set when AUTH_DISABLED is not true. ' +
      'To explicitly disable authentication (dev only), set AUTH_DISABLED=true.',
    );
  }
}
```

#### 1.2 Update `PresetPasswordAuthProvider` to consume the explicit flag

**File**: `server/src/core/auth/preset-password-auth-provider.ts`

Replace the "empty password → no password" heuristic with the explicit flag. This does not change the provider's public contract.

```typescript
public async initialize(): Promise<void> {
  if (this.serverConfigService.isAuthDisabled()) {
    this.noPassword = true;
    this.loggerService.warn(
      '[auth:password] AUTH_DISABLED=true — password check disabled. Do not use in production.',
    );
    return;
  }

  const presetPassword = this.serverConfigService.getAuthPassword();
  // validateAuthPasswordConfig() at startup guarantees non-empty here.
  this.passwordHash = await hash(presetPassword);
  this.loggerService.info('[auth:password] preset password hashed');
}
```

Also drop the attempted-username from debug logs — leave only the fact that a failure occurred:

```typescript
if (!valid) {
  this.loggerService.debug('[auth:password] rejected: invalid password');
  return { ok: false, message: 'Username/password does not match' };
}
```

(Reason: attempted usernames can leak PII; the rate limiter tracks per-IP counts without needing the username.)

#### 1.3 Add `AuthRateLimiterService`

**File**: `server/src/core/auth/auth-rate-limiter-service.ts` (new)

Per-IP sliding-window limiter over failed logins. In-memory and process-local (same lifetime tradeoff as the existing session map). Uses an injected clock so tests are deterministic.

```typescript
import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';

// Abstract clock so tests can advance time without real timers.
export type Clock = { now(): number };
export const systemClock: Clock = { now: () => Date.now() };

/**
 * Per-IP sliding-window rate limiter for failed login attempts.
 *
 * Records failed attempts and reports whether a given IP has exceeded its
 * quota inside the current window. Entries expire automatically — GC runs
 * on each read. No cross-process coordination (single-instance only).
 *
 * Lifetime: Root singleton, shared with ServerAuthRouteHandlerService.
 * Thread-safety: JS is single-threaded here; no locking required.
 */
export class AuthRateLimiterService {
  private readonly failedAttempts = new Map<string, number[]>();

  constructor(
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
    private readonly clock: Clock = systemClock,
  ) {}

  // Returns true when the IP has exceeded the configured failure budget.
  public isLimited(ip: string): boolean {
    this.gc(ip);
    const windowMs = this.serverConfigService.getAuthRateLimitWindowMs();
    const max = this.serverConfigService.getAuthRateLimitMaxAttempts();
    const attempts = this.failedAttempts.get(ip) ?? [];
    return attempts.length >= max;
  }

  // Records a failed login for this IP at the current time.
  public recordFailure(ip: string): void {
    const now = this.clock.now();
    const attempts = this.failedAttempts.get(ip) ?? [];
    attempts.push(now);
    this.failedAttempts.set(ip, attempts);
  }

  // Clears rate-limiter state for this IP (on successful login).
  public reset(ip: string): void {
    this.failedAttempts.delete(ip);
  }

  // Returns the number of milliseconds until this IP's oldest attempt expires.
  public retryAfterMs(ip: string): number {
    this.gc(ip);
    const attempts = this.failedAttempts.get(ip) ?? [];
    if (attempts.length === 0) return 0;
    const windowMs = this.serverConfigService.getAuthRateLimitWindowMs();
    const oldest = attempts[0];
    return Math.max(0, oldest + windowMs - this.clock.now());
  }

  // Drops entries older than the window for a single IP.
  private gc(ip: string): void {
    const attempts = this.failedAttempts.get(ip);
    if (!attempts) return;
    const windowMs = this.serverConfigService.getAuthRateLimitWindowMs();
    const cutoff = this.clock.now() - windowMs;
    const live = attempts.filter(t => t >= cutoff);
    if (live.length === 0) {
      this.failedAttempts.delete(ip);
    } else if (live.length !== attempts.length) {
      this.failedAttempts.set(ip, live);
    }
  }
}
```

Register in `server/src/composition/register-root-services.ts` alongside other auth services:

```typescript
authRateLimiterService: asClass(AuthRateLimiterService).singleton(),
```

#### 1.4 Wire the rate limiter and CORS allowlist into the route handler

**File**: `server/src/core/auth/server-auth-route-handler-service.ts`

Changes:

1. Inject `AuthRateLimiterService` and `ServerConfigService` (for the origin allowlist and body-size cap).
2. Extract client IP from the request. `Deno.serve` exposes the remote address via the second argument to the handler; plumb it through. Since `handleRequest` currently takes `(req, url)`, extend the signature to `(req, url, remoteIp)` and update `ServerBootstrapService` to pass `info.remoteAddr.hostname` (falling back to an `X-Forwarded-For` header when present, for reverse-proxied deployments).
3. Only accept JSON bodies up to `getAuthMaxBodyBytes()`. Use `req.body?.getReader()` or parse via `await req.text()` with a pre-check on `content-length`.
4. Apply `corsHeaders` against an allowlist instead of reflecting the request Origin blindly.

Illustrative handler sketch (the full method stays recognizable):

```typescript
public async handleRequest(
  req: Request,
  url: URL,
  remoteIp: string,
): Promise<Response | undefined> {
  if (!url.pathname.startsWith('/auth')) return undefined;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: this.corsHeaders(req) });
  }

  const parts = url.pathname.split('/').filter(Boolean);

  if (parts.length === 2 && parts[1] === 'login' && req.method === 'POST') {
    return this.handleLogin(req, remoteIp);
  }
  if (parts.length === 2 && parts[1] === 'validate' && req.method === 'GET') {
    return this.handleValidate(req);
  }
  if (parts.length === 2 && parts[1] === 'logout' && req.method === 'DELETE') {
    return this.handleLogout(req);
  }
  return new Response('auth resource not found', { status: 404, headers: this.corsHeaders(req) });
}

private async handleLogin(req: Request, remoteIp: string): Promise<Response> {
  if (this.authRateLimiterService.isLimited(remoteIp)) {
    const retryAfterSec = Math.ceil(this.authRateLimiterService.retryAfterMs(remoteIp) / 1000);
    this.loggerService.warn(`[auth route] rate-limited login from ${remoteIp}`);
    return this.jsonResponse({ ok: false, message: 'Too many attempts' }, 429, req, {
      'retry-after': String(retryAfterSec),
    });
  }

  // Guard body size before calling req.json().
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  const maxBytes = this.serverConfigService.getAuthMaxBodyBytes();
  if (contentLength > maxBytes) {
    return new Response('payload too large', { status: 413, headers: this.corsHeaders(req) });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    this.authRateLimiterService.recordFailure(remoteIp);
    return new Response('invalid json', { status: 400, headers: this.corsHeaders(req) });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    this.authRateLimiterService.recordFailure(remoteIp);
    return this.jsonResponse({ ok: false, message: 'invalid request body' }, 400, req);
  }

  const providerName = typeof body['provider'] === 'string' ? body['provider'] : 'password';
  const result = await this.authSessionService.login(providerName, body);
  if (!result.ok) {
    this.authRateLimiterService.recordFailure(remoteIp);
    this.loggerService.warn(
      `[auth route] login failed from ${remoteIp} via '${providerName}' (${result.message})`,
    );
    return this.jsonResponse(result, 401, req);
  }

  this.authRateLimiterService.reset(remoteIp);
  this.loggerService.info(
    `[auth route] login succeeded from ${remoteIp} for '${result.username}' via '${providerName}'`,
  );
  return this.jsonResponse({ ok: true, token: result.token, username: result.username }, 200, req);
}
```

Replace `corsHeaders`:

```typescript
private corsHeaders(req?: Request): Record<string, string> {
  const allowed = this.serverConfigService.getAuthAllowedOrigins();
  const requestOrigin = req?.headers.get('origin') ?? '';

  // When the allowlist is exactly ['*'], fall back to wildcard behavior.
  const originHeader = allowed.includes('*')
    ? '*'
    : allowed.includes(requestOrigin) ? requestOrigin : '';

  const headers: Record<string, string> = {
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
  if (originHeader) headers['access-control-allow-origin'] = originHeader;
  return headers;
}
```

Note the added `Vary: Origin` — browsers won't cache the wrong allow-origin response for another origin.

#### 1.5 Pass remote IP from bootstrap through to the route handler

**File**: `server/src/core/server-bootstrap-service.ts`

Update the `Deno.serve` handler to derive the remote IP and pass it:

```typescript
handler: (req, info) => {
  const url = new URL(req.url);
  const remoteIp = this.extractRemoteIp(req, info);
  const authResponse = this.serverAuthRouteHandlerService.handleRequest(req, url, remoteIp);
  if (authResponse) return authResponse;
  return this.serverDebugRouteHandlerService.handleRequest(req, info);
},
```

```typescript
// Extracts the client IP for rate limiting. Prefers X-Forwarded-For when a
// trusted reverse proxy sets it (the left-most entry). Falls back to the
// socket remote address. Does NOT parse multiple hops — we trust only the
// first one.
private extractRemoteIp(req: Request, info: { remoteAddr: { hostname: string } }): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || info.remoteAddr.hostname;
  return info.remoteAddr.hostname;
}
```

If the deployment environment has an untrusted ingress layer, set `AUTH_TRUST_FORWARDED=false` (add to `ServerConfigService`) and skip the header — default should be `true` since Azure Container Apps sets it for us.

#### 1.6 Update env files

**File**: `server/.env-example`

```
# Preset password for simple authentication. Required unless AUTH_DISABLED=true.
AUTH_PASSWORD=dominion
# Set to 'true' to disable password checking entirely (development only).
AUTH_DISABLED=false
# Comma-separated origin allowlist for /auth/* CORS. Use '*' for any origin (dev only).
AUTH_ALLOWED_ORIGINS=http://localhost:51455,http://localhost:4200
# Failed-login rate limit (per client IP).
AUTH_RATE_LIMIT_MAX_ATTEMPTS=10
AUTH_RATE_LIMIT_WINDOW_MS=60000
# Max body size (bytes) accepted by /auth/login.
AUTH_MAX_BODY_BYTES=4096
```

**File**: `docker-compose.dev.yml` — remove `AUTH_PASSWORD=` (which silently disabled auth), add:
```yaml
- AUTH_DISABLED=true
- AUTH_ALLOWED_ORIGINS=*
```

**File**: `docker-compose.prod.yml` — keep `AUTH_PASSWORD: "dominion"`, add:
```yaml
AUTH_ALLOWED_ORIGINS: "http://localhost"
AUTH_RATE_LIMIT_MAX_ATTEMPTS: "10"
AUTH_RATE_LIMIT_WINDOW_MS: "60000"
```

**File**: `docs/azure-operations.md` — document `AUTH_ALLOWED_ORIGINS`, `AUTH_DISABLED`, `AUTH_RATE_LIMIT_*` as new env vars. (Do not document a value for `AUTH_DISABLED` in prod — it defaults to false.)

#### 1.7 Unit tests for the auth module

All new tests live under `server/src/core/__tests__/`.

**File**: `server/src/core/__tests__/auth-session-service.spec.ts` (new)

Cover: unknown provider, provider rejection, successful token issuance, `validateToken` hit/miss, `removeSession` hit/miss, duplicate provider registration, `initializeProviders` ordering.

**File**: `server/src/core/__tests__/preset-password-auth-provider.spec.ts` (new)

Cover: happy path with matching password, wrong password, empty username, empty password, `AUTH_DISABLED=true` bypass, `authenticate` called before `initialize`, `initialize` throws helpful message when both `AUTH_PASSWORD` is empty and `AUTH_DISABLED` is false (verified via `ServerConfigService.validate()` in a separate test), and the log entries produced at each step. Stub `ServerConfigService` by constructing it with env vars via `withIsolatedEnv` (see existing `server-config-service.spec.ts` pattern).

**File**: `server/src/core/__tests__/auth-rate-limiter-service.spec.ts` (new)

Cover: below threshold (`isLimited=false`), at threshold, above threshold, sliding-window expiry (uses a fake clock), `reset` after successful login, `retryAfterMs` on empty and near-expiry state, distinct IPs tracked independently.

**File**: `server/src/core/__tests__/server-auth-route-handler-service.spec.ts` (new)

Use `fetch(new Request(...))` with a real `ServerAuthRouteHandlerService`, a stub `AuthSessionService` (returns a canned result), a real `AuthRateLimiterService` with a fake clock. Cover:

- `POST /auth/login` → 200 + token + CORS headers.
- `POST /auth/login` malformed JSON → 400, recorded as failure.
- `POST /auth/login` wrong password → 401, recorded as failure.
- `POST /auth/login` 11th failure → 429 with `Retry-After`.
- `POST /auth/login` successful → rate limiter cleared for that IP.
- `POST /auth/login` body size > cap → 413.
- `GET /auth/validate` with valid token → 200.
- `GET /auth/validate` with missing/invalid token → 401.
- `DELETE /auth/logout` → 200 (idempotent).
- `OPTIONS /auth/login` with origin on allowlist → 204 + origin allowed.
- `OPTIONS /auth/login` with origin NOT on allowlist → 204 + no allow-origin header.
- Unknown `/auth/foo` → 404 with CORS headers.

#### 1.8 Frontend: display rate-limit message

**File**: `angular-frontend/src/app/components/login/login.component.ts`

Map 429 responses to a rate-limit message. Minimal change — `AuthService.login` already returns `{ ok, message }`; update the login component to surface the server message when it differs from the generic match-failure text.

```typescript
if (result.ok) {
  sceneStore.set('lobby');
} else {
  this.errorMessage.set(result.message ?? 'Username/password does not match');
}
```

And in `AuthService.login`, include the server's message on non-ok responses (already done). Make sure `message: 'Too many attempts'` from 429 passes through unmodified.

### Success Criteria

#### Automated Verification:
- [x] `cd server && deno task test:unit` passes, including the four new auth spec files.
- [x] `cd server && deno check --no-lock src/server.ts` passes.
- [x] `cd server && deno lint src/` passes.
- [x] `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit` passes.

#### Manual Verification:
- [ ] Start the server without `AUTH_PASSWORD` set and without `AUTH_DISABLED=true` → process exits with the explicit error from `validateAuthPasswordConfig`.
- [ ] Set `AUTH_DISABLED=true` → server starts, warning logged, any non-empty username logs in.
- [ ] Send 11 failing login attempts from the same IP via `curl` → 11th returns 429 with `Retry-After`.
- [ ] After a successful login, fail several more attempts → counter was reset (rate limiting does not fire immediately).
- [ ] Cross-origin `OPTIONS /auth/login` from a disallowed origin (e.g., `curl -H "Origin: https://evil.example" -X OPTIONS http://localhost:3001/auth/login`) returns 204 but no `access-control-allow-origin` header → browser would refuse.
- [ ] `curl -X POST ... -d "$(python3 -c 'print("x"*100000)')"` against `/auth/login` returns 413.
- [ ] In the browser, manually cause 10+ failed logins; the UI shows "Too many attempts" on the 11th.

**Implementation Note**: pause after Phase 1 for manual confirmation before starting Phase 2.

---

## Phase 2: Session Lifecycle (still in-memory, richer records)

### Overview

Add token expiry, session metadata, and admin visibility — all without changing storage. The session map becomes `Map<string, SessionRecord>`; `validateToken` extends the expiry on each call (sliding window); a periodic cleanup prunes expired entries. One new admin endpoint lists/revokes sessions.

Once Phase 2 is stable, Phase 3 swaps the backing map for a persistent store without further behavior changes.

### Changes Required

#### 2.1 Introduce `SessionRecord` and expose it via `AuthSessionService`

**File**: `server/src/core/auth/auth-session-service.ts`

```typescript
// Server-side metadata tracked per active session.
export interface SessionRecord {
  readonly token: string;
  readonly username: string;
  readonly providerName: string;
  readonly createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  readonly createdFromIp: string | undefined;
  readonly createdFromUserAgent: string | undefined;
}
```

Change the map type and `login`/`validateToken` signatures:

```typescript
private readonly sessions = new Map<string, SessionRecord>();

constructor(
  private readonly loggerService: LoggerService,
  private readonly serverConfigService: ServerConfigService,
  private readonly clock: Clock = systemClock,
) {}

public async login(
  providerName: string,
  credentials: Record<string, unknown>,
  context?: { ip?: string; userAgent?: string },
): Promise<{ ok: true; token: string; username: string } | { ok: false; message: string }> {
  // ... unchanged provider lookup & credential check ...

  const token = crypto.randomUUID();
  const now = this.clock.now();
  const ttlMs = this.serverConfigService.getAuthSessionTtlMs();
  this.sessions.set(token, {
    token,
    username: result.username,
    providerName,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + ttlMs,
    createdFromIp: context?.ip,
    createdFromUserAgent: context?.userAgent,
  });
  return { ok: true, token, username: result.username };
}

public validateToken(token: string): string | undefined {
  const rec = this.sessions.get(token);
  if (!rec) return undefined;
  const now = this.clock.now();
  if (rec.expiresAt <= now) {
    this.sessions.delete(token);
    this.loggerService.debug(`[auth] session expired: ${this.tokenTail(token)}`);
    return undefined;
  }
  // Sliding window: extend on validation.
  rec.lastActivityAt = now;
  rec.expiresAt = now + this.serverConfigService.getAuthSessionTtlMs();
  return rec.username;
}

// Returns the last 6 characters of a token for safe logging.
private tokenTail(token: string): string {
  return `…${token.slice(-6)}`;
}

// Enumerates all currently-active sessions (caller may filter by username).
public listSessions(): ReadonlyArray<SessionRecord> {
  const now = this.clock.now();
  for (const [token, rec] of this.sessions) {
    if (rec.expiresAt <= now) this.sessions.delete(token);
  }
  return [...this.sessions.values()];
}

// Removes every session belonging to a specific username (e.g., on password change).
public removeSessionsForUsername(username: string): number {
  let removed = 0;
  for (const [token, rec] of this.sessions) {
    if (rec.username === username) {
      this.sessions.delete(token);
      removed++;
    }
  }
  return removed;
}
```

Add `getAuthSessionTtlMs()` to `ServerConfigService` (default: 7 days = `7 * 24 * 60 * 60 * 1000`). Include in `validate()`. Read from `AUTH_SESSION_TTL_MS`.

#### 2.2 Plumb IP/UserAgent from the HTTP handler

**File**: `server/src/core/auth/server-auth-route-handler-service.ts`

`handleLogin` already has `remoteIp` from Phase 1. Pass it plus `req.headers.get('user-agent')` into `authSessionService.login(providerName, body, { ip, userAgent })`.

#### 2.3 Session cleanup timer

**File**: `server/src/core/auth/auth-session-cleanup-service.ts` (new)

A tiny service that periodically walks `AuthSessionService.listSessions()` (which already prunes). Start it during server startup, stop it during shutdown.

```typescript
import { AuthSessionService } from './auth-session-service.ts';
import { LoggerService } from '../logger-service.ts';

export class AuthSessionCleanupService {
  private handle: number | undefined;

  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly loggerService: LoggerService,
  ) {}

  public start(intervalMs: number = 5 * 60_000): void {
    if (this.handle !== undefined) return;
    this.handle = setInterval(() => {
      const before = this.authSessionService.listSessions().length;
      // listSessions() has the GC side effect; just read twice to observe.
      const after = this.authSessionService.listSessions().length;
      if (before !== after) {
        this.loggerService.info(`[auth cleanup] pruned ${before - after} expired sessions`);
      }
    }, intervalMs);
  }

  public stop(): void {
    if (this.handle !== undefined) {
      clearInterval(this.handle);
      this.handle = undefined;
    }
  }
}
```

Register in DI, start from `ServerStartupService.start()` after `authSessionService.initializeProviders()`, stop from `ServerShutdownHandlerService`.

#### 2.4 Admin endpoints

**File**: `server/src/core/auth/server-auth-route-handler-service.ts`

Add `GET /auth/sessions` (returns sessions for the authenticated user) and `DELETE /auth/sessions` (revokes all sessions for the authenticated user, except optionally the one that made the call).

Both accept the Bearer token and derive the username from it — no user needs admin role because each user can only see their own sessions. A later phase can add true admin scoping.

```typescript
// GET /auth/sessions — list this user's active sessions.
private handleListSessions(req: Request): Response {
  const token = this.extractBearerToken(req);
  const username = token ? this.authSessionService.validateToken(token) : undefined;
  if (!username) {
    return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
  }
  const mine = this.authSessionService
    .listSessions()
    .filter(s => s.username === username)
    .map(s => ({
      tokenTail: `…${s.token.slice(-6)}`,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      expiresAt: s.expiresAt,
      createdFromIp: s.createdFromIp,
      createdFromUserAgent: s.createdFromUserAgent,
      current: s.token === token,
    }));
  return this.jsonResponse({ ok: true, sessions: mine }, 200, req);
}

// DELETE /auth/sessions — revoke all sessions for this user (optionally keeping the current one).
private handleRevokeAllSessions(req: Request, url: URL): Response {
  const token = this.extractBearerToken(req);
  const username = token ? this.authSessionService.validateToken(token) : undefined;
  if (!username) {
    return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
  }
  const keepCurrent = url.searchParams.get('keepCurrent') === 'true';
  const removed = this.authSessionService.removeSessionsForUsername(username);
  if (keepCurrent && token) {
    // Recreate the current session so the caller is not logged out.
    // (Simpler: use a removeSessionsForUsernameExcept(token) variant.)
  }
  return this.jsonResponse({ ok: true, removed }, 200, req);
}
```

Add a `removeSessionsForUsernameExcept(username, keepToken)` variant to `AuthSessionService` to avoid the "recreate" hack.

#### 2.5 Add unit tests for the new behavior

Extend `auth-session-service.spec.ts`:
- `validateToken` returns undefined for expired sessions.
- `validateToken` extends expiry on each call.
- `listSessions` prunes expired entries.
- `removeSessionsForUsername` removes all matches and returns count.
- `login` stores IP and user-agent in the record.

Add `auth-session-cleanup-service.spec.ts` with a fake interval / fake clock.

Extend `server-auth-route-handler-service.spec.ts` with:
- `GET /auth/sessions` when authenticated — returns this user's sessions with tails.
- `GET /auth/sessions` unauthenticated — 401.
- `DELETE /auth/sessions` — revokes, subsequent validate returns 401.
- `DELETE /auth/sessions?keepCurrent=true` — current token still works.

### Success Criteria

#### Automated Verification:
- [ ] `cd server && deno task test:unit` passes with new/updated tests.
- [ ] Type check and lint clean.

#### Manual Verification:
- [ ] Set `AUTH_SESSION_TTL_MS=5000`, log in, wait 10 seconds, call `GET /auth/validate` → 401.
- [ ] Log in, call `GET /auth/sessions` → one session with `current: true`.
- [ ] Log in from a second browser, then `DELETE /auth/sessions?keepCurrent=true` from the first → second browser's socket disconnects on next refresh.
- [ ] Restart server → sessions are still lost (Phase 3 fixes this; this is an explicit non-goal here).

**Implementation Note**: pause after Phase 2 for confirmation before starting Phase 3.

---

## Phase 3: Persistent Session Storage (SQLite)

### Overview

Introduce a `SessionStore` interface and a SQLite-backed implementation so sessions survive restarts. Gate the storage choice behind an env var — default keeps in-memory for tests and dev, prod opts into SQLite.

No behavior change is expected from the client's perspective: the existing API, TTL, and admin endpoints all continue to work.

### Changes Required

#### 3.1 Add SQLite dependency

**File**: `server/deno.json`

```json
"imports": {
  // ...
  "@db/sqlite": "jsr:@db/sqlite@^0.11.1"
}
```

This adds a tiny, widely-used SQLite binding built on `Deno.dlopen` (FFI). It's synchronous (appropriate for low-write auth tables). No native compile step at runtime.

The `dev:watch` task already has `--allow-read` and `--allow-write`; add `--allow-ffi` to it and to `test:unit*` tasks. Also add `--unstable-ffi` flag (currently SQLite lib requires it).

Alternative for smaller footprint: use built-in `Deno.openKv()` (Deno KV) with expiring keys. Deno KV is simpler and doesn't need FFI, but it does not support the relational queries we'll need for Phase 4 (user accounts). If Phase 4 is unlikely to happen, Deno KV is a better fit for Phase 3 alone. The plan below assumes SQLite.

#### 3.2 Define the `SessionStore` interface

**File**: `server/src/core/auth/session-store.ts` (new)

```typescript
import type { SessionRecord } from './auth-session-service.ts';

/**
 * Pluggable persistence contract for active auth sessions.
 *
 * Implementations must be safe to call concurrently. Expiry is enforced by
 * `AuthSessionService` (not by the store), but stores may additionally
 * purge expired rows lazily or in background.
 */
export interface SessionStore {
  get(token: string): SessionRecord | undefined | Promise<SessionRecord | undefined>;
  put(record: SessionRecord): void | Promise<void>;
  update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void | Promise<void>;
  delete(token: string): void | Promise<void>;
  deleteByUsername(username: string, exceptToken?: string): number | Promise<number>;
  listAll(): ReadonlyArray<SessionRecord> | Promise<ReadonlyArray<SessionRecord>>;
  purgeExpired(nowMs: number): number | Promise<number>;
}
```

(Note: `AuthSessionService` public API already returns synchronous results — preserve that. Make the store synchronous. SQLite's Deno binding is synchronous, so that works. If a future async store is needed we'd bump `AuthSessionService` to async and update call sites; for now synchronous is simpler and matches the current `ServerSocketGatewayService.validateToken` hot path.)

Adjust the interface to be synchronous:

```typescript
export interface SessionStore {
  get(token: string): SessionRecord | undefined;
  put(record: SessionRecord): void;
  update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void;
  delete(token: string): void;
  deleteByUsername(username: string, exceptToken?: string): number;
  listAll(): ReadonlyArray<SessionRecord>;
  purgeExpired(nowMs: number): number;
}
```

#### 3.3 Migrate `AuthSessionService` to use the store

**File**: `server/src/core/auth/auth-session-service.ts`

Replace the private `Map<string, SessionRecord>` with an injected `SessionStore`. Every method that touched the map now delegates:

```typescript
constructor(
  private readonly loggerService: LoggerService,
  private readonly serverConfigService: ServerConfigService,
  private readonly sessionStore: SessionStore,
  private readonly clock: Clock = systemClock,
) {}

public validateToken(token: string): string | undefined {
  const rec = this.sessionStore.get(token);
  if (!rec) return undefined;
  const now = this.clock.now();
  if (rec.expiresAt <= now) {
    this.sessionStore.delete(token);
    return undefined;
  }
  const ttl = this.serverConfigService.getAuthSessionTtlMs();
  this.sessionStore.update(token, { lastActivityAt: now, expiresAt: now + ttl });
  return rec.username;
}

// login() -> sessionStore.put(record)
// removeSession() -> sessionStore.delete(token)
// removeSessionsForUsername() / ...Except() -> sessionStore.deleteByUsername(username, keepToken)
// listSessions() -> sessionStore.listAll().filter(s => s.expiresAt > now)
```

#### 3.4 Implementations

**File**: `server/src/core/auth/in-memory-session-store.ts` (new)

Default implementation — the existing Map logic extracted into the interface.

**File**: `server/src/core/auth/sqlite-session-store.ts` (new)

SQLite-backed implementation. Schema:

```sql
CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_from_ip TEXT,
  created_from_user_agent TEXT
);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_username ON auth_sessions(username);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_expires_at ON auth_sessions(expires_at);
```

Prepared-statement shape:

```typescript
import { Database } from '@db/sqlite';

export class SqliteSessionStore implements SessionStore {
  private readonly db: Database;
  // Pre-prepared statements; see @db/sqlite API for exact binding syntax.
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(SCHEMA_SQL);
  }
  // get / put / update / delete / deleteByUsername / listAll / purgeExpired
}
```

Plumb `dbPath` from `ServerConfigService.getAuthDbPath()` (`AUTH_DB_PATH`, default `./game-data/auth.sqlite`).

#### 3.5 DI selection based on config

**File**: `server/src/composition/register-root-services.ts`

Introduce `sessionStore` token whose value depends on `AUTH_SESSION_STORE` (`memory` | `sqlite`). Use Awilix `asFunction` for conditional construction:

```typescript
sessionStore: asFunction(({ serverConfigService, loggerService }) => {
  const kind = serverConfigService.getSessionStoreKind();
  if (kind === 'sqlite') {
    return new SqliteSessionStore(serverConfigService.getAuthDbPath());
  }
  return new InMemorySessionStore();
}).singleton(),
```

Add `getSessionStoreKind(): 'memory' | 'sqlite'` to `ServerConfigService`; default `memory`. Include in `validate()`.

#### 3.6 Update docker compose and docs

- `docker-compose.prod.yml`: mount a volume for `/app/server/game-data`, set `AUTH_SESSION_STORE=sqlite`, `AUTH_DB_PATH=/app/server/game-data/auth.sqlite`.
- `docs/azure-operations.md`: describe the DB file, back up / rotate considerations, and the option to use Azure Files for persistence.

#### 3.7 Tests

**File**: `server/src/core/__tests__/sqlite-session-store.spec.ts` (new)

Use a temp dir (`Deno.makeTempDirSync`) for the DB file. Exercise all methods of `SessionStore` against both `InMemorySessionStore` and `SqliteSessionStore` — factor the shared conformance tests into a helper that both specs call, so behavior stays identical across backends.

Existing `auth-session-service.spec.ts` switches to injecting an `InMemorySessionStore` so the tests remain unit-scoped.

### Success Criteria

#### Automated Verification:
- [ ] New SQLite store tests pass in both memory and sqlite modes.
- [ ] Existing auth tests still pass with injected in-memory store.

#### Manual Verification:
- [ ] Set `AUTH_SESSION_STORE=sqlite`, log in, restart server, browser refresh without clearing localStorage → still authenticated.
- [ ] Inspect `auth.sqlite` with `sqlite3` CLI and verify rows match logged-in users.
- [ ] `DELETE /auth/sessions` removes rows from the DB file.

**Implementation Note**: pause after Phase 3 for confirmation.

---

## Phase 4: Multi-User Accounts

### Overview

Replace (or supplement) the single preset password with a real user-account system. A new `UserAccountAuthProvider` looks up users in a SQLite `auth_users` table and validates per-user password hashes. Adds: password change endpoint, per-user account lockout that integrates with the rate limiter, and new-hash algorithm (argon2id) while keeping bcrypt verification for legacy hashes.

The `PresetPasswordAuthProvider` remains registered — it can be used as a bootstrap/fallback login, or removed when accounts exist.

### Changes Required

#### 4.1 User schema & store

**File**: `server/src/core/auth/user-store.ts` (new)

```typescript
export interface UserRecord {
  readonly id: number;
  readonly username: string;
  passwordHash: string;
  passwordAlgo: 'argon2id' | 'bcrypt';
  passwordUpdatedAt: number;
  failedAttempts: number;
  lockedUntil: number | null;
  disabled: boolean;
  createdAt: number;
}

export interface UserStore {
  getByUsername(username: string): UserRecord | undefined;
  create(args: { username: string; passwordHash: string; passwordAlgo: 'argon2id' }): UserRecord;
  updatePassword(id: number, passwordHash: string, algo: 'argon2id' | 'bcrypt'): void;
  recordFailure(id: number, now: number): UserRecord;
  resetFailures(id: number): void;
  setLockedUntil(id: number, until: number | null): void;
  setDisabled(id: number, disabled: boolean): void;
  list(): ReadonlyArray<UserRecord>;
}
```

SQLite implementation: `sqlite-user-store.ts`. Schema:

```sql
CREATE TABLE IF NOT EXISTS auth_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL CHECK(password_algo IN ('argon2id','bcrypt')),
  password_updated_at INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

Reuse the same DB file as `SqliteSessionStore`, so `AUTH_DB_PATH` points to a single SQLite file with both tables.

#### 4.2 Password hashing abstraction

**File**: `server/src/core/auth/password-hasher.ts` (new)

Thin wrapper so `authenticate` can verify either algorithm and re-hash on login:

```typescript
export interface PasswordHasher {
  readonly algo: 'argon2id' | 'bcrypt';
  hash(plain: string): Promise<string>;
  verify(plain: string, encoded: string): Promise<boolean>;
}

export class Argon2idHasher implements PasswordHasher { readonly algo = 'argon2id'; ... }
export class BcryptHasher implements PasswordHasher { readonly algo = 'bcrypt'; ... }
```

Use a maintained Deno argon2id binding such as `jsr:@rabbit-company/argon2id` or `npm:argon2-browser` (the former runs in Deno without Node compat).

Keep existing `bcrypt@0.4.1` for legacy hashes only — no new hashes are produced with it. New user creation always uses argon2id.

#### 4.3 New provider: `UserAccountAuthProvider`

**File**: `server/src/core/auth/user-account-auth-provider.ts` (new)

```typescript
export class UserAccountAuthProvider implements AuthProvider {
  readonly name = 'user';

  constructor(
    private readonly loggerService: LoggerService,
    private readonly userStore: UserStore,
    private readonly argon2id: Argon2idHasher,
    private readonly bcrypt: BcryptHasher,
    private readonly clock: Clock,
    private readonly config: ServerConfigService,
  ) {}

  async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const username = typeof credentials['username'] === 'string' ? credentials['username'].trim() : '';
    const password = typeof credentials['password'] === 'string' ? credentials['password'] : '';
    if (!username || !password) return { ok: false, message: 'Username/password does not match' };

    const user = this.userStore.getByUsername(username.toLowerCase());
    if (!user || user.disabled) {
      // Constant-time: still run a dummy verify to avoid username enumeration.
      await this.argon2id.verify(password, DUMMY_HASH);
      return { ok: false, message: 'Username/password does not match' };
    }

    const now = this.clock.now();
    if (user.lockedUntil && user.lockedUntil > now) {
      return { ok: false, message: 'Account temporarily locked' };
    }

    const verifier = user.passwordAlgo === 'argon2id' ? this.argon2id : this.bcrypt;
    const ok = await verifier.verify(password, user.passwordHash);
    if (!ok) {
      const updated = this.userStore.recordFailure(user.id, now);
      if (updated.failedAttempts >= this.config.getAuthLockoutThreshold()) {
        this.userStore.setLockedUntil(user.id, now + this.config.getAuthLockoutDurationMs());
      }
      return { ok: false, message: 'Username/password does not match' };
    }

    // Rehash legacy bcrypt hashes to argon2id on successful login.
    if (user.passwordAlgo === 'bcrypt') {
      const newHash = await this.argon2id.hash(password);
      this.userStore.updatePassword(user.id, newHash, 'argon2id');
    }
    this.userStore.resetFailures(user.id);
    return { ok: true, username: user.username };
  }
}
```

Register alongside the preset provider. Both remain available; the login UI picks `provider: 'user'`.

#### 4.4 User management CLI

**File**: `server/scripts/auth-create-user.ts` (new)

```typescript
// deno run --allow-env --allow-read --allow-write --allow-ffi scripts/auth-create-user.ts --username <name> --password <pw>
```

Opens the same DB, uses `Argon2idHasher`, inserts a new user. Used for bootstrapping the first admin user after Phase 4 deploys.

Add a `deno task auth:create-user` alias in `server/deno.json`.

#### 4.5 Password change endpoint

**File**: `server/src/core/auth/server-auth-route-handler-service.ts`

Add `POST /auth/change-password`:

- Requires Bearer token.
- Body: `{ currentPassword, newPassword }`.
- Validates `currentPassword` via the same provider the user used (or re-authenticates via `UserAccountAuthProvider` directly).
- Rejects weak passwords per `validatePasswordStrength()` (length ≥ 10, not equal to username, etc.).
- On success: rehash, `userStore.updatePassword`, revoke all other sessions for the user (`authSessionService.removeSessionsForUsername(username, keepToken)`).

#### 4.6 Config knobs

Add to `ServerConfigService`:
- `getAuthLockoutThreshold()` (default 5)
- `getAuthLockoutDurationMs()` (default 10 min)
- `getAuthMinPasswordLength()` (default 10)

#### 4.7 Frontend: account UI

Minimal UI surface to not derail the plan:

- `LoginComponent` unchanged (still posts `{ username, password, provider: 'user' }` to `/auth/login`; if `UserAccountAuthProvider` is the only provider, clients use `'user'` instead of `'password'`).
- New `ChangePasswordComponent` (dialog in lobby): calls `POST /auth/change-password`; shows strength requirements inline; on success, `AuthService.logout()` (because the server revoked other sessions) or shows a toast.
- `SessionsDialogComponent` (optional): calls `GET /auth/sessions` and `DELETE /auth/sessions?keepCurrent=true` — useful for users.

#### 4.8 Tests

- `server/src/core/__tests__/user-account-auth-provider.spec.ts` — hit, miss, locked user, rehash-on-login, dummy verify for missing users.
- `server/src/core/__tests__/sqlite-user-store.spec.ts` — CRUD + constraints.
- Integration test using a temp SQLite file: create a user via CLI, log in via HTTP, change password, verify old password no longer works, old sessions invalidated.

### Success Criteria

#### Automated Verification:
- [ ] All new tests pass.
- [ ] `deno task auth:create-user --username alice --password correct-horse-battery-staple` creates a row.
- [ ] Type check / lint clean.

#### Manual Verification:
- [ ] `POST /auth/login` with `provider: 'user'` succeeds for a created user, fails after 5 bad attempts, returns `Account temporarily locked` on the 6th.
- [ ] After the lockout window expires, the account unlocks.
- [ ] Successful login from a legacy bcrypt user row updates the stored hash to `argon2id` and `password_algo='argon2id'`.
- [ ] Password change: old password rejected, new password required, all other sessions revoked.

**Implementation Note**: pause after Phase 4 for confirmation.

---

## Phase 5 (optional): Expanded Auth Providers

The architecture already supports this; this phase is a sketch to confirm how new providers drop in.

1. **Guest provider** (`GuestAuthProvider`, name `guest`): accepts any username, issues a session that expires in 1 hour, with a flag on the record so that guests can't create games (enforced by existing game lobby logic). No password required.
2. **OAuth2 provider** (`OAuth2AuthProvider`, name `oauth2-discord` / `oauth2-google`): the browser handles the redirect; frontend posts the `code` to `POST /auth/login` with `{ provider: 'oauth2-discord', code, redirectUri }`. Provider exchanges code → user profile, maps to `UserStore` record (auto-creating if missing and `AUTH_OAUTH_AUTO_REGISTER=true`).
3. **Magic-link provider** (`MagicLinkAuthProvider`): two endpoints — `POST /auth/magic-link/request` (sends email with a one-time code) and `POST /auth/login` with `{ provider: 'magic-link', code }`. Requires email infrastructure.

In every case the provider implements only `authenticate`. Sessions and route handlers are unchanged.

### Success Criteria

- Each new provider ships with its own unit test suite that follows the same pattern as existing ones.
- Frontend `LoginComponent` grows provider-specific login variants without changing `AuthService` beyond adding new payload shapes.

---

## Cross-Phase Notes

### Backwards compatibility

- Phases 1–3 preserve the existing `POST /auth/login` request and response shapes exactly. Clients already deployed do not need updates (besides surfacing the 429 message in Phase 1.8).
- Phase 4 adds a new `user` provider. Frontends can migrate from `provider: 'password'` to `provider: 'user'` once user accounts exist; the preset provider can be kept enabled during the transition.

### Data migration

- No migration needed for Phase 1/2 — state is ephemeral.
- Phase 3: on first run with `AUTH_SESSION_STORE=sqlite`, the store creates the file and table. Existing in-memory sessions are lost (users re-login once).
- Phase 4: `auth_users` table is created empty. Bootstrap via CLI (4.4).

### Security checklist (tracked independently)

- [ ] Phase 1: `/auth/login` rate-limited per IP.
- [ ] Phase 1: explicit `AUTH_DISABLED` opt-in required to disable password check.
- [ ] Phase 1: CORS origin allowlist (no reflect-any).
- [ ] Phase 1: login body size cap.
- [ ] Phase 1: auth services are unit-tested.
- [ ] Phase 2: tokens expire with sliding window.
- [ ] Phase 2: users can list and revoke their own sessions.
- [ ] Phase 3: sessions survive restart.
- [ ] Phase 4: per-account lockout.
- [ ] Phase 4: password change revokes sibling sessions.
- [ ] Phase 4: argon2id for new password hashes; bcrypt legacy verified then rehashed on login.

### Out-of-band considerations

- Logging PII: the plan removes the attempted username from rejection logs. Usernames on *successful* login remain logged (operationally useful and not PII in this context).
- Time sync: all TTL logic uses `clock.now()` which in production is `Date.now()`. Server clock skew between restarts is not a concern because tokens are validated against absolute expiry times in the DB row.
- Concurrency: SQLite in WAL mode handles our write volume trivially. Consider setting `PRAGMA journal_mode=WAL` when opening the DB.

---

## Verification Commands (quick reference)

```bash
# Server
cd server
deno check --no-lock src/server.ts
deno lint src/
deno task test:unit

# Frontend
cd angular-frontend
npx tsc -p tsconfig.app.json --noEmit

# Manual — Phase 1 rate limit (from server host)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"x","password":"wrong"}'
done

# Manual — Phase 2 session list
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"dominion"}' | jq -r .token)
curl -s http://localhost:3001/auth/sessions -H "Authorization: Bearer $TOKEN"

# Manual — Phase 3 persistence
# (restart server, then:)
curl -s http://localhost:3001/auth/validate -H "Authorization: Bearer $TOKEN"

# Phase 4 — create a user
cd server && deno task auth:create-user --username alice --password correct-horse-battery-staple
```
