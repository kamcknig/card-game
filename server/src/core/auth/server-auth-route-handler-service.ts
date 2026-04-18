import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthSessionService } from './auth-session-service.ts';
import { AuthRateLimiterService } from './auth-rate-limiter-service.ts';
import type { UserStore } from './user-store.ts';
import type { RegistrationCodeStore } from './registration-code-store.ts';
import { Argon2idHasher } from './password-hasher.ts';
import { UserAccountAuthProvider } from './user-account-auth-provider.ts';

/**
 * Matches usernames allowed during registration.
 *
 * 3–32 characters, alphanumeric plus underscore. Keeps the surface small so
 * usernames are predictable in logs and URLs.
 */
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,32}$/;

/**
 * Validates a password against the configured minimum length and trivial
 * self-references (password === username).
 *
 * Returns the first violation's message, or undefined when the password
 * passes all checks. Keeps the rule set intentionally small — the primary
 * defence is the lockout + rate limiter, not password complexity theater.
 */
const validatePasswordStrength = (
  password: string,
  username: string,
  minLength: number,
): string | undefined => {
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  if (password.toLowerCase() === username.toLowerCase()) {
    return 'Password must not match the username';
  }
  return undefined;
};

/**
 * Handles HTTP authentication endpoints for login, token validation, and logout.
 *
 * Routes:
 *   POST   /auth/login     — validates credentials via the selected provider
 *   GET    /auth/validate  — validates an existing session token
 *   DELETE /auth/logout    — invalidates the current session token
 *   GET    /auth/sessions  — lists active sessions for the authenticated user
 *   DELETE /auth/sessions  — revokes all sessions for the authenticated user
 *                           (pass `?keepCurrent=true` to preserve the caller's session)
 *
 * Login requests accept an optional `provider` field to select the
 * authentication method. Defaults to 'password' for backwards compatibility.
 * Token validation is provider-agnostic — it only checks the session store.
 *
 * Lifetime: Root singleton — called from ServerBootstrapService HTTP handler.
 * Consumers: ServerBootstrapService.
 */
export class ServerAuthRouteHandlerService {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
    private readonly authRateLimiterService: AuthRateLimiterService,
    private readonly userStore: UserStore,
    private readonly registrationCodeStore: RegistrationCodeStore,
    private readonly argon2idHasher: Argon2idHasher,
    private readonly userAccountAuthProvider: UserAccountAuthProvider,
  ) {}

  /**
   * Routes /auth/* HTTP requests to the appropriate handler.
   *
   * Returns undefined when the path does not start with /auth, allowing
   * the caller to fall through to the next handler. Handles CORS preflight
   * OPTIONS requests so browsers can call auth endpoints cross-origin
   * (required when the Angular frontend is served from a different origin
   * than the game server, e.g., separate Azure Container Apps).
   *
   * @param req      The incoming HTTP request.
   * @param url      The pre-parsed URL for the request.
   * @param remoteIp The client IP, used for rate limiting. Derived by the
   *   caller from the socket remote address or X-Forwarded-For header.
   */
  public handleRequest(req: Request, url: URL, remoteIp: string): Response | Promise<Response> | undefined {
    if (!url.pathname.startsWith('/auth')) {
      return undefined;
    }

    // Respond to CORS preflight before routing to specific handlers.
    if (req.method === 'OPTIONS') {
      this.loggerService.debug(`[auth route] CORS preflight: ${url.pathname}`);
      return new Response(null, { status: 204, headers: this.corsHeaders(req) });
    }

    const parts = url.pathname.split('/').filter(Boolean);

    // POST /auth/login
    if (parts.length === 2 && parts[1] === 'login' && req.method === 'POST') {
      return this.handleLogin(req, remoteIp);
    }

    // GET /auth/validate
    if (parts.length === 2 && parts[1] === 'validate' && req.method === 'GET') {
      return this.handleValidate(req);
    }

    // DELETE /auth/logout
    if (parts.length === 2 && parts[1] === 'logout' && req.method === 'DELETE') {
      return this.handleLogout(req);
    }

    // GET /auth/sessions — list this user's active sessions.
    if (parts.length === 2 && parts[1] === 'sessions' && req.method === 'GET') {
      return this.handleListSessions(req);
    }

    // DELETE /auth/sessions — revoke all sessions for this user.
    if (parts.length === 2 && parts[1] === 'sessions' && req.method === 'DELETE') {
      return this.handleRevokeAllSessions(req, url);
    }

    // POST /auth/register (public, rate-limited).
    if (parts.length === 2 && parts[1] === 'register' && req.method === 'POST') {
      return this.handleRegister(req, remoteIp);
    }

    // POST /auth/change-password (authenticated).
    if (parts.length === 2 && parts[1] === 'change-password' && req.method === 'POST') {
      return this.handleChangePassword(req);
    }

    // POST /auth/registration-codes (authenticated): create code.
    if (parts.length === 2 && parts[1] === 'registration-codes' && req.method === 'POST') {
      return this.handleCreateRegistrationCode(req);
    }

    // GET /auth/registration-codes (authenticated): list codes.
    if (parts.length === 2 && parts[1] === 'registration-codes' && req.method === 'GET') {
      return this.handleListRegistrationCodes(req);
    }

    // DELETE /auth/registration-codes/:code (authenticated): disable code.
    if (parts.length === 3 && parts[1] === 'registration-codes' && req.method === 'DELETE') {
      return this.handleDisableRegistrationCode(req, parts[2]!);
    }

    this.loggerService.debug(`[auth route] unmatched auth path: ${req.method} ${url.pathname}`);
    return new Response('auth resource not found', { status: 404, headers: this.corsHeaders(req) });
  }

  /**
   * Validates credentials via the specified provider and returns an auth token on success.
   *
   * Enforces the body-size cap before parsing JSON. Applies IP-based rate
   * limiting: rejects with 429 when the IP has exceeded its failure budget,
   * and records each failure (bad JSON, wrong password, unknown provider)
   * toward the limit. Resets the counter on successful login.
   *
   * Reads the `provider` field from the request body to select the auth
   * method. Defaults to 'password' when provider is not specified.
   * Returns 401 on authentication failure and 400 on malformed request bodies.
   *
   * IP and User-Agent are passed to AuthSessionService.login so they are
   * stored in the resulting SessionRecord for audit visibility.
   */
  private async handleLogin(req: Request, remoteIp: string): Promise<Response> {
    // Check rate limit before doing any work.
    if (this.authRateLimiterService.isLimited(remoteIp)) {
      const retryAfterSec = Math.ceil(this.authRateLimiterService.retryAfterMs(remoteIp) / 1000);
      this.loggerService.warn(`[auth route] rate-limited login attempt from ${remoteIp}`);
      return this.jsonResponse({ ok: false, message: 'Too many attempts' }, 429, req, {
        'retry-after': String(retryAfterSec),
      });
    }

    // Guard body size before calling req.json() to avoid parsing large bodies.
    const contentLength = Number(req.headers.get('content-length') ?? '0');
    const maxBytes = this.serverConfigService.getAuthMaxBodyBytes();
    if (contentLength > maxBytes) {
      this.loggerService.warn(`[auth route] login body too large from ${remoteIp}: ${contentLength} > ${maxBytes}`);
      return new Response('payload too large', { status: 413, headers: this.corsHeaders(req) });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      this.loggerService.debug(`[auth route] login request body is not valid JSON from ${remoteIp}`);
      this.authRateLimiterService.recordFailure(remoteIp);
      return new Response('invalid json', { status: 400, headers: this.corsHeaders(req) });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      this.loggerService.debug(`[auth route] login request body is not a plain object from ${remoteIp}`);
      this.authRateLimiterService.recordFailure(remoteIp);
      return this.jsonResponse({ ok: false, message: 'invalid request body' }, 400, req);
    }

    // Default to 'user' provider when none is specified.
    const providerName = typeof body['provider'] === 'string' ? body['provider'] : 'user';
    this.loggerService.debug(`[auth route] login attempt via provider '${providerName}' from ${remoteIp}`);

    // Pass IP and User-Agent as audit context so the SessionRecord carries them.
    const userAgent = req.headers.get('user-agent') ?? undefined;
    const result = await this.authSessionService.login(providerName, body, { ip: remoteIp, userAgent });

    if (!result.ok) {
      this.authRateLimiterService.recordFailure(remoteIp);
      this.loggerService.warn(
        `[auth route] login failed from ${remoteIp} via '${providerName}' (${result.message})`,
      );
      return this.jsonResponse(result, 401, req);
    }

    // Reset the rate-limiter counter on successful login.
    this.authRateLimiterService.reset(remoteIp);
    this.loggerService.info(
      `[auth route] login succeeded from ${remoteIp} for '${result.username}' via '${providerName}'`,
    );
    return this.jsonResponse({ ok: true, token: result.token, username: result.username }, 200, req);
  }

  /**
   * Validates an existing auth token from the Authorization Bearer header.
   *
   * Returns 401 when the header is missing or the token is not a known session.
   */
  private handleValidate(req: Request): Response {
    const token = this.extractBearerToken(req);
    if (!token) {
      this.loggerService.debug('[auth route] validate request missing authorization header');
      return this.jsonResponse({ ok: false, message: 'missing authorization header' }, 401, req);
    }

    const username = this.authSessionService.validateToken(token);
    if (!username) {
      this.loggerService.debug('[auth route] validate request has invalid or expired token');
      return this.jsonResponse({ ok: false, message: 'invalid or expired token' }, 401, req);
    }

    this.loggerService.debug(`[auth route] token validated for '${username}'`);
    return this.jsonResponse({ ok: true, username }, 200, req);
  }

  /**
   * Invalidates the auth session identified by the Bearer token.
   *
   * Returns 200 even when the token was not found so the endpoint is idempotent.
   * The client should discard the token regardless of outcome.
   */
  private handleLogout(req: Request): Response {
    const token = this.extractBearerToken(req);
    if (token) {
      this.authSessionService.removeSession(token);
      this.loggerService.info('[auth] logout: session removed');
    } else {
      this.loggerService.debug('[auth] logout: no bearer token provided');
    }
    return this.jsonResponse({ ok: true }, 200, req);
  }

  /**
   * Lists all active sessions belonging to the authenticated user.
   *
   * Requires a valid Bearer token. Returns a safe projection of each
   * SessionRecord: the token is represented only by its last 6 characters
   * (`tokenTail`) so the full secret is never transmitted back. The `current`
   * flag identifies the session that made this request.
   *
   * Returns 401 when the token is missing or invalid.
   */
  private handleListSessions(req: Request): Response {
    const token = this.extractBearerToken(req);
    const username = token ? this.authSessionService.validateToken(token) : undefined;
    if (!username) {
      this.loggerService.debug('[auth route] GET /auth/sessions: unauthorized');
      return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
    }

    const sessions = this.authSessionService
      .listSessions()
      .filter(s => s.username === username)
      .map(s => ({
        tokenTail: `...${s.token.slice(-6)}`,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        createdFromIp: s.createdFromIp,
        createdFromUserAgent: s.createdFromUserAgent,
        current: s.token === token,
      }));

    this.loggerService.debug(`[auth route] GET /auth/sessions: returning ${sessions.length} session(s) for '${username}'`);
    return this.jsonResponse({ ok: true, sessions }, 200, req);
  }

  /**
   * Revokes all sessions belonging to the authenticated user.
   *
   * Requires a valid Bearer token. When the `keepCurrent` query parameter is
   * `true`, the caller's own session is preserved so they remain logged in
   * while all other sessions (e.g., from other browsers) are invalidated.
   *
   * Returns 401 when the token is missing or invalid.
   *
   * @example DELETE /auth/sessions           → revoke all, including caller
   * @example DELETE /auth/sessions?keepCurrent=true → revoke all except caller
   */
  private handleRevokeAllSessions(req: Request, url: URL): Response {
    const token = this.extractBearerToken(req);
    const username = token ? this.authSessionService.validateToken(token) : undefined;
    if (!username) {
      this.loggerService.debug('[auth route] DELETE /auth/sessions: unauthorized');
      return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
    }

    const keepCurrent = url.searchParams.get('keepCurrent') === 'true';
    let removed: number;

    if (keepCurrent && token) {
      removed = this.authSessionService.removeSessionsForUsernameExcept(username, token);
    } else {
      removed = this.authSessionService.removeSessionsForUsername(username);
    }

    this.loggerService.info(
      `[auth route] DELETE /auth/sessions: revoked ${removed} session(s) for '${username}' (keepCurrent=${keepCurrent})`,
    );
    return this.jsonResponse({ ok: true, removed }, 200, req);
  }

  /**
   * Handles POST /auth/register — public self-service registration.
   *
   * Requires a valid registration code. Rate-limited against the same IP
   * bucket as /auth/login so bad codes count toward the limit and
   * brute-forcing codes is impractical. Validates username format, password
   * strength, and registration-code state before creating the row. Does NOT
   * return a session token — the client must log in separately.
   */
  private async handleRegister(req: Request, remoteIp: string): Promise<Response> {
    // Share the IP bucket with /auth/login so registration brute-force counts
    // against the same limiter.
    if (this.authRateLimiterService.isLimited(remoteIp)) {
      const retryAfterSec = Math.ceil(this.authRateLimiterService.retryAfterMs(remoteIp) / 1000);
      this.loggerService.warn(`[auth route] rate-limited register attempt from ${remoteIp}`);
      return this.jsonResponse({ ok: false, message: 'Too many attempts' }, 429, req, {
        'retry-after': String(retryAfterSec),
      });
    }

    // Enforce the same body-size cap applied to login.
    const contentLength = Number(req.headers.get('content-length') ?? '0');
    const maxBytes = this.serverConfigService.getAuthMaxBodyBytes();
    if (contentLength > maxBytes) {
      this.loggerService.warn(
        `[auth route] register body too large from ${remoteIp}: ${contentLength} > ${maxBytes}`,
      );
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

    const username = typeof body['username'] === 'string' ? (body['username'] as string).trim() : '';
    const password = typeof body['password'] === 'string' ? (body['password'] as string) : '';
    const code = typeof body['registrationCode'] === 'string' ? (body['registrationCode'] as string).trim() : '';

    // Username format check — narrow enough to keep logs predictable.
    if (!USERNAME_REGEX.test(username)) {
      this.authRateLimiterService.recordFailure(remoteIp);
      return this.jsonResponse(
        { ok: false, message: 'Username must be 3-32 characters, alphanumeric or underscore' },
        400,
        req,
      );
    }

    // Password strength per AUTH_MIN_PASSWORD_LENGTH and username-not-equal.
    const minLen = this.serverConfigService.getAuthMinPasswordLength();
    const pwError = validatePasswordStrength(password, username, minLen);
    if (pwError) {
      this.authRateLimiterService.recordFailure(remoteIp);
      return this.jsonResponse({ ok: false, message: pwError }, 400, req);
    }

    // Validate + atomically consume the registration code. A bad or exhausted
    // code records a failure against the IP bucket to throttle brute force.
    const now = Date.now();
    const usedCode = this.registrationCodeStore.recordUse(code, now);
    if (!usedCode) {
      this.authRateLimiterService.recordFailure(remoteIp);
      this.loggerService.warn(`[auth route] register: invalid or expired code from ${remoteIp}`);
      return this.jsonResponse({ ok: false, message: 'Invalid or expired registration code' }, 400, req);
    }

    // Check for duplicate username (case-insensitive) AFTER consuming the
    // code — a consumed code covers the intent and the user still needs to
    // pick a free username. Tracking this as a failure keeps the limiter
    // honest.
    if (this.userStore.getByUsername(username)) {
      this.authRateLimiterService.recordFailure(remoteIp);
      this.loggerService.info(`[auth route] register: username '${username}' already taken`);
      return this.jsonResponse({ ok: false, message: 'Username already taken' }, 409, req);
    }

    // Hash the new password with argon2id and create the user row. Uses the
    // original-case username so the display name matches what the user typed.
    try {
      const hash = await this.argon2idHasher.hash(password);
      this.userStore.create({ username, passwordHash: hash, passwordAlgo: 'argon2id', now });
      this.loggerService.info(
        `[auth register] new account created for '${username}' using code ...${code.slice(-6)} from ${remoteIp}`,
      );
      // Reset the limiter on the happy path so a legitimate registration does
      // not push the IP closer to a future lockout.
      this.authRateLimiterService.reset(remoteIp);
      return this.jsonResponse({ ok: true }, 201, req);
    } catch (err) {
      this.loggerService.error(`[auth route] register: hashing or persist failed: ${err}`);
      return this.jsonResponse({ ok: false, message: 'Registration failed' }, 500, req);
    }
  }

  /**
   * Handles POST /auth/change-password — authenticated in-app rotation.
   *
   * Re-authenticates with the current password via UserAccountAuthProvider so
   * the same lockout rules apply. On success, hashes the new password, persists
   * it, and revokes every session for this user except the caller's. Rejects
   * weak passwords per AUTH_MIN_PASSWORD_LENGTH.
   */
  private async handleChangePassword(req: Request): Promise<Response> {
    const token = this.extractBearerToken(req);
    const username = token ? this.authSessionService.validateToken(token) : undefined;
    if (!token || !username) {
      this.loggerService.debug('[auth route] POST /auth/change-password: unauthorized');
      return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
    }

    const contentLength = Number(req.headers.get('content-length') ?? '0');
    const maxBytes = this.serverConfigService.getAuthMaxBodyBytes();
    if (contentLength > maxBytes) {
      return new Response('payload too large', { status: 413, headers: this.corsHeaders(req) });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response('invalid json', { status: 400, headers: this.corsHeaders(req) });
    }

    const currentPassword =
      typeof body['currentPassword'] === 'string' ? (body['currentPassword'] as string) : '';
    const newPassword = typeof body['newPassword'] === 'string' ? (body['newPassword'] as string) : '';

    // Re-run the user-provider auth flow so account lockout behaves the same
    // as a normal login if the caller fat-fingers their current password.
    const reauth = await this.userAccountAuthProvider.authenticate({ username, password: currentPassword });
    if (!reauth.ok) {
      this.loggerService.warn(`[auth route] password change for '${username}' rejected: bad current password`);
      return this.jsonResponse({ ok: false, message: 'Current password incorrect' }, 401, req);
    }

    const minLen = this.serverConfigService.getAuthMinPasswordLength();
    const pwError = validatePasswordStrength(newPassword, username, minLen);
    if (pwError) {
      return this.jsonResponse({ ok: false, message: pwError }, 400, req);
    }

    const user = this.userStore.getByUsername(username);
    if (!user) {
      // Defensive: validateToken returned a username we can no longer find.
      this.loggerService.error(`[auth route] password change: user '${username}' missing from store`);
      return this.jsonResponse({ ok: false, message: 'user not found' }, 404, req);
    }

    const now = Date.now();
    try {
      const hash = await this.argon2idHasher.hash(newPassword);
      this.userStore.updatePassword(user.id, hash, 'argon2id', now);
    } catch (err) {
      this.loggerService.error(`[auth route] password change: hash/persist failed: ${err}`);
      return this.jsonResponse({ ok: false, message: 'Password change failed' }, 500, req);
    }

    // Invalidate every other session for this user so a stolen token cannot
    // outlive the rotation; keep the caller's session alive.
    const revoked = this.authSessionService.removeSessionsForUsernameExcept(username, token);
    this.loggerService.info(
      `[auth route] password changed for '${username}' — revoked ${revoked} sibling session(s)`,
    );
    return this.jsonResponse({ ok: true, revokedSessions: revoked }, 200, req);
  }

  /**
   * Handles POST /auth/registration-codes — create a new invite code.
   *
   * Any authenticated user may issue codes (no role scoping yet).
   * Body: `{ expiresIn?: number (ms), maxUses?: number }`. expiresIn is relative
   * to `now()`; omit it for no time limit. maxUses defaults to 1.
   */
  private async handleCreateRegistrationCode(req: Request): Promise<Response> {
    const token = this.extractBearerToken(req);
    const username = token ? this.authSessionService.validateToken(token) : undefined;
    if (!username) {
      return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
    }

    const contentLength = Number(req.headers.get('content-length') ?? '0');
    const maxBytes = this.serverConfigService.getAuthMaxBodyBytes();
    if (contentLength > maxBytes) {
      return new Response('payload too large', { status: 413, headers: this.corsHeaders(req) });
    }

    // Body is optional for this endpoint — default to 1-use, no expiry.
    let body: Record<string, unknown> = {};
    if (req.headers.get('content-type')?.includes('application/json')) {
      try {
        const parsed = await req.json();
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        }
      } catch {
        return new Response('invalid json', { status: 400, headers: this.corsHeaders(req) });
      }
    }

    const now = Date.now();
    const expiresIn = typeof body['expiresIn'] === 'number' ? (body['expiresIn'] as number) : undefined;
    const expiresAt = expiresIn !== undefined && expiresIn > 0 ? now + expiresIn : null;
    const maxUses = typeof body['maxUses'] === 'number' && body['maxUses']! > 0
      ? Math.floor(body['maxUses'] as number)
      : 1;

    const rec = this.registrationCodeStore.create({
      createdBy: username,
      expiresAt,
      maxUses,
      now,
    });

    this.loggerService.info(
      `[auth route] registration code created by '${username}' (expiresAt=${expiresAt}, maxUses=${maxUses})`,
    );
    return this.jsonResponse({ ok: true, code: rec.code, expiresAt: rec.expiresAt, maxUses: rec.maxUses }, 201, req);
  }

  /**
   * Handles GET /auth/registration-codes — list active codes for operator use.
   *
   * Returns every non-disabled, non-expired code. The full `code` value is
   * included because the requester created it (or will use it) — a separate
   * admin-scope phase can restrict this later.
   */
  private handleListRegistrationCodes(req: Request): Response {
    const token = this.extractBearerToken(req);
    const username = token ? this.authSessionService.validateToken(token) : undefined;
    if (!username) {
      return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
    }

    const now = Date.now();
    const visible = this.registrationCodeStore
      .list()
      .filter(c => !c.disabled && (c.expiresAt === null || c.expiresAt > now))
      .map(c => ({
        code: c.code,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
        expiresAt: c.expiresAt,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
      }));

    return this.jsonResponse({ ok: true, codes: visible }, 200, req);
  }

  /**
   * Handles DELETE /auth/registration-codes/:code — idempotent disable.
   *
   * Returns 200 whether the code existed, was already disabled, or is
   * unknown; the endpoint's contract is "ensure this code cannot be used".
   */
  private handleDisableRegistrationCode(req: Request, code: string): Response {
    const token = this.extractBearerToken(req);
    const username = token ? this.authSessionService.validateToken(token) : undefined;
    if (!username) {
      return this.jsonResponse({ ok: false, message: 'unauthorized' }, 401, req);
    }

    this.registrationCodeStore.disable(code);
    this.loggerService.info(`[auth route] registration code ...${code.slice(-6)} disabled by '${username}'`);
    return this.jsonResponse({ ok: true }, 200, req);
  }

  /**
   * Extracts a Bearer token from the Authorization header.
   *
   * Returns undefined when the header is absent or not a Bearer scheme.
   */
  private extractBearerToken(req: Request): string | undefined {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return undefined;
    }
    return authHeader.slice(7).trim() || undefined;
  }

  /**
   * Creates a consistent JSON HTTP response with appropriate content-type,
   * CORS headers, and any additional headers provided.
   */
  private jsonResponse(
    payload: unknown,
    status: number = 200,
    req?: Request,
    extraHeaders?: Record<string, string>,
  ): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', ...this.corsHeaders(req), ...extraHeaders },
    });
  }

  /**
   * Builds CORS headers based on the configured origin allowlist.
   *
   * When the allowlist contains `*`, falls back to wildcard behavior (dev
   * mode). Otherwise, echoes the request origin only if it appears in the
   * allowlist; requests from unlisted origins receive no allow-origin header
   * so browsers will refuse the response. The `Vary: Origin` header prevents
   * caches from serving the wrong allow-origin to a different origin.
   */
  private corsHeaders(req?: Request): Record<string, string> {
    const allowed = this.serverConfigService.getAuthAllowedOrigins();
    const requestOrigin = req?.headers.get('origin') ?? '';

    // When the allowlist is exactly ['*'], fall back to wildcard behavior.
    const originHeader = allowed.includes('*')
      ? '*'
      : allowed.includes(requestOrigin)
        ? requestOrigin
        : '';

    const headers: Record<string, string> = {
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-max-age': '86400',
      'vary': 'Origin',
    };

    // Only include the allow-origin header when the origin is permitted.
    if (originHeader) {
      headers['access-control-allow-origin'] = originHeader;
    }

    return headers;
  }
}
