import { assertEquals } from '@std/assert';
import { ServerAuthRouteHandlerService } from '../auth/server-auth-route-handler-service.ts';
import { AuthSessionService, SessionRecord } from '../auth/auth-session-service.ts';
import { AuthRateLimiterService, Clock } from '../auth/auth-rate-limiter-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { SupabaseClientProvider } from '../storage/supabase-client-provider.ts';
import { LoggerService } from '../logger-service.ts';
import { InMemoryUserStore } from '../auth/in-memory-user-store.ts';
import { Argon2idHasher, BcryptHasher } from '../auth/password-hasher.ts';
import { UserAccountAuthProvider } from '../auth/user-account-auth-provider.ts';
import type { SessionStore } from '../auth/session-store.ts';

// Env keys managed by this test suite.
const AUTH_ENV_KEYS = [
  'AUTH_ALLOWED_ORIGINS',
  'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_MAX_BODY_BYTES',
  'AUTH_SESSION_TTL_MS',
  'AUTH_MIN_PASSWORD_LENGTH',
  'AUTH_LOCKOUT_THRESHOLD',
  'AUTH_LOCKOUT_DURATION_MS',
] as const;

// Saves and restores relevant env vars around a test body.
const withIsolatedEnv = (
  overrides: Partial<Record<(typeof AUTH_ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const saved = new Map(AUTH_ENV_KEYS.map(k => [k, Deno.env.get(k)]));
  return Promise.resolve()
    .then(() => {
      for (const key of AUTH_ENV_KEYS) Deno.env.delete(key);
      // Defaults that prevent validate() from throwing.
      Deno.env.set('AUTH_RATE_LIMIT_MAX_ATTEMPTS', '10');
      Deno.env.set('AUTH_RATE_LIMIT_WINDOW_MS', '60000');
      Deno.env.set('AUTH_MAX_BODY_BYTES', '4096');
      for (const [k, v] of Object.entries(overrides)) {
        if (v !== undefined) Deno.env.set(k, v);
      }
      return run();
    })
    .finally(() => {
      for (const key of AUTH_ENV_KEYS) {
        const v = saved.get(key);
        if (v === undefined) Deno.env.delete(key);
        else Deno.env.set(key, v);
      }
    });
};

// Minimal logger stub.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Controllable clock.
const makeFakeClock = (initialMs = 0): Clock & { advance(ms: number): void } => {
  let time = initialMs;
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
  };
};

/**
 * Creates a stub AuthSessionService with controllable login / validateToken results.
 *
 * @param loginResult     Fixed result returned by login().
 * @param validateResult  Username returned by validateToken(); null means invalid (returns undefined).
 * @param sessions        Optional list of SessionRecord values returned by listSessions().
 */
const makeSessionServiceStub = (
  loginResult: { ok: true; token: string; username: string } | { ok: false; message: string },
  // null signals "token is invalid" (returns undefined); undefined means "use default 'testuser'".
  validateResult: string | null = 'testuser',
  sessions: SessionRecord[] = [],
): AuthSessionService => {
  const removed: string[] = [];
  const resolvedValidate = validateResult === null ? undefined : validateResult;
  return {
    login: async () => loginResult,
    validateToken: (_token: string) => resolvedValidate,
    removeSession: (token: string) => {
      removed.push(token);
    },
    listSessions: () => sessions,
    removeSessionsForUsername: (_username: string) => 0,
    removeSessionsForUsernameExcept: (_username: string, _keepToken: string) => 0,
    _removed: removed,
  } as unknown as AuthSessionService;
};

// Minimal SupabaseClientProvider stub that always throws — in-memory backend
// tests never reach the Supabase path so this is never called.
const makeSupabaseClientProviderStub = (): SupabaseClientProvider =>
  ({
    get: () => {
      throw new Error('SupabaseClientProvider stub: not available in in-memory tests');
    },
  }) as unknown as SupabaseClientProvider;

/**
 * A `SessionStore` that behaves like `InMemorySessionStore` but additionally
 * records the name of every mutating call (`put` / `delete` / `deleteByUsername`)
 * in call order. Used to verify the login session-write ordering fix (9.2):
 * the new session must be `put` into the store BEFORE any prior session for
 * the same user is revoked via `deleteByUsername`.
 */
class RecordingSessionStore implements SessionStore {
  public readonly calls: string[] = [];
  private readonly sessions = new Map<string, SessionRecord>();

  get(token: string): SessionRecord | undefined {
    return this.sessions.get(token);
  }

  put(record: SessionRecord): void {
    this.calls.push(`put:${record.token}`);
    this.sessions.set(record.token, record);
  }

  update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void {
    const rec = this.sessions.get(token);
    if (!rec) return;
    if (patch.lastActivityAt !== undefined) rec.lastActivityAt = patch.lastActivityAt;
    if (patch.expiresAt !== undefined) rec.expiresAt = patch.expiresAt;
  }

  delete(token: string): void {
    this.calls.push(`delete:${token}`);
    this.sessions.delete(token);
  }

  deleteByUsername(username: string, exceptToken?: string): number {
    this.calls.push(`deleteByUsername:${username}:except=${exceptToken ?? 'none'}`);
    let removed = 0;
    for (const [token, rec] of this.sessions) {
      if (rec.username === username && token !== exceptToken) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }

  listAll(): ReadonlyArray<SessionRecord> {
    return [...this.sessions.values()];
  }

  purgeExpired(nowMs: number): number {
    let removed = 0;
    for (const [token, rec] of this.sessions) {
      if (rec.expiresAt <= nowMs) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }
}

// Builds the service under test with all dependencies wired.
// Uses concrete in-memory implementations so integration-style tests can opt
// into register / password-change flows without further stubbing.
const makeService = (opts: {
  sessionServiceStub?: AuthSessionService;
  clock?: Clock;
  allowedOrigins?: string;
  maxAttempts?: string;
  windowMs?: string;
  maxBodyBytes?: string;
  userStore?: InMemoryUserStore;
}) => {
  const config = new ServerConfigService();
  const logger = makeLoggerStub();
  const clock = opts.clock ?? makeFakeClock(1_000);
  const rateLimiter = new AuthRateLimiterService(logger, config, clock);
  const sessionService =
    opts.sessionServiceStub ??
    makeSessionServiceStub({ ok: true, token: 'tok-abc', username: 'testuser' });

  const userStore = opts.userStore ?? new InMemoryUserStore();
  const argon2id = new Argon2idHasher();
  const bcrypt = new BcryptHasher();
  const supabaseClientProvider = makeSupabaseClientProviderStub();
  const userProvider = new UserAccountAuthProvider(logger, userStore, argon2id, bcrypt, config, supabaseClientProvider, clock);

  return {
    service: new ServerAuthRouteHandlerService(
      sessionService,
      logger,
      config,
      rateLimiter,
      userStore,
      argon2id,
      userProvider,
      supabaseClientProvider,
    ),
    rateLimiter,
    userStore,
    argon2id,
    userProvider,
  };
};

// Sends a request through the handler and resolves the response.
const dispatch = async (
  service: ServerAuthRouteHandlerService,
  req: Request,
  remoteIp = '1.2.3.4',
): Promise<Response> => {
  const url = new URL(req.url);
  const result = service.handleRequest(req, url, remoteIp);
  if (!result) throw new Error('Handler returned undefined — path did not match /auth');
  return result instanceof Promise ? result : Promise.resolve(result);
};

// ── POST /auth/login ──────────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: POST /auth/login → 200 + token on success', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok-abc', username: 'alice' }),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'dominion' }),
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    assertEquals(body.token, 'tok-abc');
    assertEquals(body.username, 'alice');
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/login malformed JSON → 400, records failure', async () => {
  await withIsolatedEnv({}, async () => {
    const { service, rateLimiter } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      }),
    );

    assertEquals(res.status, 400);
    // The failure should be recorded.
    assertEquals(rateLimiter.isLimited('1.2.3.4'), false); // 1 of 10 — not yet limited
    // Verify it was recorded: add 9 more failures manually and check limit.
    for (let i = 0; i < 9; i++) rateLimiter.recordFailure('1.2.3.4');
    assertEquals(rateLimiter.isLimited('1.2.3.4'), true);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/login wrong password → 401, records failure', async () => {
  await withIsolatedEnv({}, async () => {
    const { service, rateLimiter } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: false, message: 'Username/password does not match' }),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'wrong' }),
      }),
    );

    assertEquals(res.status, 401);
    // One failure recorded.
    // To verify: fill up to threshold - 1 more and check isLimited.
    for (let i = 0; i < 9; i++) rateLimiter.recordFailure('1.2.3.4');
    assertEquals(rateLimiter.isLimited('1.2.3.4'), true);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/login 11th failure → 429 with Retry-After', async () => {
  await withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '10', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, async () => {
    const clock = makeFakeClock(0);
    const { service, rateLimiter } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: false, message: 'bad' }),
      clock,
    });

    // Reach the threshold by recording 10 failures directly.
    for (let i = 0; i < 10; i++) rateLimiter.recordFailure('1.2.3.4');

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'wrong' }),
      }),
    );

    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(body.ok, false);
    assertEquals(body.message, 'Too many attempts');

    // Retry-After header should be present (60 seconds at t=0 with 60s window).
    const retryAfter = res.headers.get('retry-after');
    assertEquals(retryAfter !== null, true);
    assertEquals(Number(retryAfter) > 0, true);
  });
});

Deno.test('ServerAuthRouteHandlerService: successful login resets rate limiter', async () => {
  await withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, async () => {
    const { service, rateLimiter } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }),
    });

    // Accumulate some failures.
    rateLimiter.recordFailure('1.2.3.4');
    rateLimiter.recordFailure('1.2.3.4');

    // Successful login.
    await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'correct' }),
      }),
    );

    // Counter should have been reset.
    assertEquals(rateLimiter.isLimited('1.2.3.4'), false);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/login body size > cap → 413', async () => {
  await withIsolatedEnv({ AUTH_MAX_BODY_BYTES: '256' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Reported content-length exceeds the 256-byte cap.
          'content-length': '300',
        },
        body: JSON.stringify({ username: 'alice', password: 'x'.repeat(260) }),
      }),
    );

    assertEquals(res.status, 413);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/login oversized body WITHOUT Content-Length header → 413', async () => {
  // Regression test for 9.1: the Content-Length header is client-controlled
  // and can simply be omitted (the Fetch/Request API does not compute one
  // automatically for a string body — verified: `new Request(...).headers.get('content-length')`
  // is null when the header is not explicitly set). Only the streaming
  // byte-cap enforcement in readJsonBodyLimited can catch this case; the
  // cheap header-based fast-path is bypassed entirely because the reported
  // length is 0.
  await withIsolatedEnv({ AUTH_MAX_BODY_BYTES: '256' }, async () => {
    const { service } = makeService({});

    const req = new Request('http://localhost/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'x'.repeat(1000) }),
    });
    // Sanity check the premise: no content-length header is present.
    assertEquals(req.headers.get('content-length'), null);

    const res = await dispatch(service, req);

    assertEquals(res.status, 413);
  });
});

Deno.test('ServerAuthRouteHandlerService: login writes the new session before revoking priors (9.2 ordering)', async () => {
  // Regression test for 9.2: previously the session service revoked all
  // prior sessions for the username BEFORE the new session existed in the
  // store. Because SessionStore backends persist to a DB via fire-and-forget
  // writes, a slow revoke could race ahead of the new session's write and
  // delete it. The fix creates/persists the new session first, then revokes
  // priors excluding the new token. This test wires a real AuthSessionService
  // (not the usual stub) around a call-order-recording SessionStore so we can
  // assert the underlying store call ordering directly.
  await withIsolatedEnv({}, async () => {
    const store = new RecordingSessionStore();
    const logger = makeLoggerStub();
    const config = new ServerConfigService();
    const clock = makeFakeClock(1_000);
    const realSessionService = new AuthSessionService(logger, config, store, clock);
    realSessionService.registerProvider({
      name: 'user',
      authenticate: async () => {
        await Promise.resolve();
        return { ok: true, username: 'alice' };
      },
    });
    await realSessionService.initializeProviders();

    const { service } = makeService({ sessionServiceStub: realSessionService });

    const loginRequest = () =>
      new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'correcthorsebattery' }),
      });

    const firstRes = await dispatch(service, loginRequest());
    assertEquals(firstRes.status, 200);
    const firstToken = (await firstRes.json()).token as string;

    // Only inspect the second login's call ordering — the first login has
    // no prior session to revoke.
    store.calls.length = 0;

    const secondRes = await dispatch(service, loginRequest());
    assertEquals(secondRes.status, 200);
    const secondToken = (await secondRes.json()).token as string;

    const putIndex = store.calls.findIndex(c => c.startsWith('put:'));
    const revokeIndex = store.calls.findIndex(c => c.startsWith('deleteByUsername:'));
    assertEquals(putIndex >= 0, true);
    assertEquals(revokeIndex >= 0, true);
    // The load-bearing assertion: put (new session) happens before
    // deleteByUsername (prior-session revocation).
    assertEquals(putIndex < revokeIndex, true);

    // End-to-end confirmation: the prior session is gone, the new one lives.
    assertEquals(realSessionService.validateToken(firstToken), undefined);
    assertEquals(realSessionService.validateToken(secondToken), 'alice');
  });
});

// ── GET /auth/validate ────────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: GET /auth/validate with valid token → 200', async () => {
  await withIsolatedEnv({}, async () => {
    const userStore = new InMemoryUserStore();
    await userStore.create({ username: 'alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });

    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, 'alice'),
      userStore,
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/validate', {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    assertEquals(body.username, 'alice');
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/validate missing token → 401', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/validate', { method: 'GET' }),
    );

    assertEquals(res.status, 401);
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/validate invalid token → 401', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({
      // null means validateToken returns undefined (invalid token).
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, null),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/validate', {
        method: 'GET',
        headers: { Authorization: 'Bearer bad-token' },
      }),
    );

    assertEquals(res.status, 401);
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/validate deleted local user → 401', async () => {
  // When the user record is missing from the local store the session must be
  // invalidated — this covers accounts deleted via the dashboard.
  await withIsolatedEnv({}, async () => {
    const userStore = new InMemoryUserStore();
    // No user seeded — token is valid but the local record is gone.

    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, 'alice'),
      userStore,
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/validate', {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
      }),
    );

    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.ok, false);
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/validate disabled account → 401', async () => {
  await withIsolatedEnv({}, async () => {
    const userStore = new InMemoryUserStore();
    const rec = await userStore.create({ username: 'alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });
    userStore.setDisabled(rec.id, true);

    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, 'alice'),
      userStore,
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/validate', {
        method: 'GET',
        headers: { Authorization: 'Bearer tok' },
      }),
    );

    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.ok, false);
  });
});

// ── DELETE /auth/logout ───────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: DELETE /auth/logout → 200 (idempotent)', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/logout', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok' },
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
  });
});

Deno.test('ServerAuthRouteHandlerService: DELETE /auth/logout without token → 200', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/logout', { method: 'DELETE' }),
    );

    assertEquals(res.status, 200);
  });
});

// ── OPTIONS (CORS preflight) ──────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: OPTIONS with allowed origin → 204 + allow-origin', async () => {
  await withIsolatedEnv({ AUTH_ALLOWED_ORIGINS: 'http://localhost:4200,http://localhost:51455' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:4200' },
      }),
    );

    assertEquals(res.status, 204);
    assertEquals(res.headers.get('access-control-allow-origin'), 'http://localhost:4200');
  });
});

Deno.test('ServerAuthRouteHandlerService: OPTIONS with disallowed origin → 204, no allow-origin', async () => {
  await withIsolatedEnv({ AUTH_ALLOWED_ORIGINS: 'http://localhost:4200' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/login', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.com' },
      }),
    );

    assertEquals(res.status, 204);
    assertEquals(res.headers.get('access-control-allow-origin'), null);
  });
});

// ── Unknown path ──────────────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: unknown /auth/* path → 404 with CORS headers', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/unknown', { method: 'GET' }),
    );

    assertEquals(res.status, 404);
    // CORS headers should still be present (wildcard because AUTH_ALLOWED_ORIGINS defaults to *).
    assertEquals(res.headers.get('access-control-allow-origin'), '*');
  });
});

Deno.test('ServerAuthRouteHandlerService: non-/auth path → handler returns undefined', () => {
  withIsolatedEnv({}, async () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1_000);
    const rateLimiter = new AuthRateLimiterService(logger, config, clock);
    const sessionService = makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' });
    const userStore = new InMemoryUserStore();
    const argon2id = new Argon2idHasher();
    const bcrypt = new BcryptHasher();
    const supabaseClientProvider = makeSupabaseClientProviderStub();
    const userProvider = new UserAccountAuthProvider(logger, userStore, argon2id, bcrypt, config, supabaseClientProvider, clock);
    const service = new ServerAuthRouteHandlerService(
      sessionService,
      logger,
      config,
      rateLimiter,
      userStore,
      argon2id,
      userProvider,
      supabaseClientProvider,
    );

    const req = new Request('http://localhost/debug/state', { method: 'GET' });
    const url = new URL(req.url);
    const result = service.handleRequest(req, url, '1.2.3.4');

    assertEquals(result, undefined);
  });
});

// ── GET /auth/sessions ────────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: GET /auth/sessions authenticated → 200 with session list', async () => {
  await withIsolatedEnv({}, async () => {
    const now = 1_000_000;
    // Build a fake session record for the authenticated user.
    const fakeRecord: SessionRecord = {
      token: 'abc123-full-token',
      username: 'alice',
      providerName: 'password',
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + 600_000,
      createdFromIp: '1.2.3.4',
      createdFromUserAgent: 'TestBrowser/1.0',
    };

    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub(
        { ok: true, token: 'abc123-full-token', username: 'alice' },
        'alice', // validateToken returns 'alice'
        [fakeRecord],
      ),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/sessions', {
        method: 'GET',
        headers: { Authorization: 'Bearer abc123-full-token' },
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    assertEquals(Array.isArray(body.sessions), true);
    assertEquals(body.sessions.length, 1);

    const s = body.sessions[0];
    // Token tail must be the last 6 characters, never the full token.
    // 'abc123-full-token' → last 6 chars = '-token'.
    assertEquals(s.tokenTail, '...-token');
    assertEquals(s.current, true);
    assertEquals(s.createdFromIp, '1.2.3.4');
    assertEquals(s.createdFromUserAgent, 'TestBrowser/1.0');
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/sessions unauthenticated → 401', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, null),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/sessions', { method: 'GET' }),
    );

    assertEquals(res.status, 401);
  });
});

// ── DELETE /auth/sessions ─────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: DELETE /auth/sessions revokes sessions', async () => {
  await withIsolatedEnv({}, async () => {
    // Track removal calls.
    let removedForUsername = '';
    const stub = {
      login: async () => ({ ok: true as const, token: 'tok', username: 'alice' }),
      validateToken: (_token: string) => 'alice' as string | undefined,
      removeSession: () => {},
      listSessions: () => [] as SessionRecord[],
      removeSessionsForUsername: (u: string) => {
        removedForUsername = u;
        return 2;
      },
      removeSessionsForUsernameExcept: (_u: string, _k: string) => 0,
    } as unknown as AuthSessionService;

    const { service } = makeService({ sessionServiceStub: stub });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/sessions', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok' },
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    assertEquals(body.removed, 2);
    assertEquals(removedForUsername, 'alice');
  });
});

Deno.test('ServerAuthRouteHandlerService: DELETE /auth/sessions?keepCurrent=true keeps current token', async () => {
  await withIsolatedEnv({}, async () => {
    let keptToken = '';
    const stub = {
      login: async () => ({ ok: true as const, token: 'tok', username: 'alice' }),
      validateToken: (_token: string) => 'alice' as string | undefined,
      removeSession: () => {},
      listSessions: () => [] as SessionRecord[],
      removeSessionsForUsername: (_u: string) => 0,
      removeSessionsForUsernameExcept: (_u: string, k: string) => {
        keptToken = k;
        return 1;
      },
    } as unknown as AuthSessionService;

    const { service } = makeService({ sessionServiceStub: stub });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/sessions?keepCurrent=true', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok' },
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    // Verify the kept token was passed through.
    assertEquals(keptToken, 'tok');
  });
});

Deno.test('ServerAuthRouteHandlerService: DELETE /auth/sessions unauthenticated → 401', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, null),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/sessions', { method: 'DELETE' }),
    );

    assertEquals(res.status, 401);
  });
});

// ── POST /auth/register ──────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: POST /auth/register with valid data → 201', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service, userStore } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'alice123',
          email: 'alice@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 201);
    const body = await res.json();
    assertEquals(body.ok, true);
    assertEquals((await userStore.getByUsername('alice123'))?.username, 'alice123');
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register duplicate username → 409', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service, userStore } = makeService({});
    await userStore.create({
      username: 'alice123',
      passwordHash: 'existing-hash',
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'alice123',
          email: 'alice@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 409);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register duplicate email → 409', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service, userStore } = makeService({});
    await userStore.create({
      username: 'existing',
      email: 'alice@example.com',
      passwordHash: 'existing-hash',
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'alice123',
          email: 'alice@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 409);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register rejects short password', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '10' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'alice123',
          email: 'alice@example.com',
          password: 'short',
        }),
      }),
    );

    assertEquals(res.status, 400);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register rejects invalid username', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'has-dash',
          email: 'alice@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 400);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register rejects missing email', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice123', password: 'correcthorsebattery' }),
      }),
    );

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.ok, false);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register rejects invalid email', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice123', email: 'not-an-email', password: 'correcthorsebattery' }),
      }),
    );

    assertEquals(res.status, 400);
  });
});

// ── GET /auth/check-username ─────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: GET /auth/check-username without query → 200 available:true', async () => {
  // Empty/missing query is treated as "available" so the form's real-time
  // feedback does not flag an empty input as taken while the user types.
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/check-username', { method: 'GET' }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.available, true);
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/check-username for unknown user → available:true', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/check-username?username=nobody', { method: 'GET' }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.available, true);
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/check-username for existing user → available:false', async () => {
  await withIsolatedEnv({}, async () => {
    const { service, userStore } = makeService({});
    await userStore.create({
      username: 'alice',
      passwordHash: 'hash',
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/check-username?username=alice', { method: 'GET' }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.available, false);
  });
});

Deno.test('ServerAuthRouteHandlerService: GET /auth/check-username is case-insensitive', async () => {
  // The UserStore normalises usernames to lowercase, and so does this
  // endpoint — registering 'Alice' should mark 'alice' / 'ALICE' as taken.
  await withIsolatedEnv({}, async () => {
    const { service, userStore } = makeService({});
    await userStore.create({
      username: 'Alice',
      passwordHash: 'hash',
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });

    const lowerRes = await dispatch(
      service,
      new Request('http://localhost/auth/check-username?username=alice', { method: 'GET' }),
    );
    assertEquals(lowerRes.status, 200);
    assertEquals((await lowerRes.json()).available, false);

    const upperRes = await dispatch(
      service,
      new Request('http://localhost/auth/check-username?username=ALICE', { method: 'GET' }),
    );
    assertEquals(upperRes.status, 200);
    assertEquals((await upperRes.json()).available, false);
  });
});

// ── GET /auth/check-username trims whitespace ──────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: GET /auth/check-username trims whitespace', async () => {
  // The form passes the username verbatim; the endpoint should treat
  // surrounding whitespace as part of the empty-input convenience path so
  // a single space doesn't masquerade as an unknown user.
  await withIsolatedEnv({}, async () => {
    const { service, userStore } = makeService({});
    await userStore.create({
      username: 'alice',
      passwordHash: 'hash',
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/check-username?username=%20%20', { method: 'GET' }),
    );
    assertEquals(res.status, 200);
    // Two spaces trim to "" which is the empty-query "available:true" path.
    assertEquals((await res.json()).available, true);
  });
});

// ── Username length edge cases on POST /auth/register ─────────────────────────

Deno.test('ServerAuthRouteHandlerService: POST /auth/register accepts minimum-length username', async () => {
  // Min length is 3 characters (USERNAME_REGEX = /^[A-Za-z0-9_]{3,32}$/).
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'abc',
          email: 'abc@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 201);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register rejects 2-character username', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ab',
          email: 'ab@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 400);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register accepts 32-character username', async () => {
  // Max length is 32. Character 32 should pass; 33 should not.
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'a'.repeat(32),
          email: 'long@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 201);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/register rejects 33-character username', async () => {
  await withIsolatedEnv({ AUTH_MIN_PASSWORD_LENGTH: '8' }, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'a'.repeat(33),
          email: 'tolong@example.com',
          password: 'correcthorsebattery',
        }),
      }),
    );

    assertEquals(res.status, 400);
  });
});

// ── resolveEmailRedirectOrigin ──────────────────────────────────────────────
//
// These tests cover the helper that decides what `emailRedirectTo` value is
// passed to Supabase signUp. The security claim — that a forged Origin from
// a non-allowlisted domain cannot redirect Supabase confirmation emails to
// an attacker-controlled URL — relies on this helper rejecting unlisted
// origins, so we lock those branches in directly. The method is private;
// bracket access is used so the test reaches it without widening the public
// surface for tests alone.

// Helper: invokes the private resolveEmailRedirectOrigin via bracket access.
const callResolveEmailRedirectOrigin = (
  service: ServerAuthRouteHandlerService,
  origin: string | null,
): string | undefined => {
  const headers: Record<string, string> = {};
  if (origin !== null) headers['origin'] = origin;
  const req = new Request('http://localhost/auth/register', { method: 'POST', headers });
  return (service as unknown as { resolveEmailRedirectOrigin(req: Request): string | undefined })
    .resolveEmailRedirectOrigin(req);
};

Deno.test('ServerAuthRouteHandlerService: resolveEmailRedirectOrigin returns undefined when Origin header is missing', async () => {
  await withIsolatedEnv({ AUTH_ALLOWED_ORIGINS: 'https://dominion.turkeysunite.com' }, async () => {
    const { service } = makeService({});
    assertEquals(callResolveEmailRedirectOrigin(service, null), undefined);
  });
});

Deno.test('ServerAuthRouteHandlerService: resolveEmailRedirectOrigin echoes the request origin when allowlisted', async () => {
  await withIsolatedEnv(
    { AUTH_ALLOWED_ORIGINS: 'http://localhost:51455,https://dominion.turkeysunite.com' },
    async () => {
      const { service } = makeService({});
      assertEquals(
        callResolveEmailRedirectOrigin(service, 'https://dominion.turkeysunite.com'),
        'https://dominion.turkeysunite.com',
      );
      assertEquals(
        callResolveEmailRedirectOrigin(service, 'http://localhost:51455'),
        'http://localhost:51455',
      );
    },
  );
});

Deno.test('ServerAuthRouteHandlerService: resolveEmailRedirectOrigin trusts any origin when allowlist is wildcard', async () => {
  await withIsolatedEnv({ AUTH_ALLOWED_ORIGINS: '*' }, async () => {
    const { service } = makeService({});
    assertEquals(
      callResolveEmailRedirectOrigin(service, 'http://localhost:51455'),
      'http://localhost:51455',
    );
    assertEquals(
      callResolveEmailRedirectOrigin(service, 'https://anywhere.example'),
      'https://anywhere.example',
    );
  });
});

Deno.test('ServerAuthRouteHandlerService: resolveEmailRedirectOrigin returns undefined when origin is not allowlisted', async () => {
  await withIsolatedEnv({ AUTH_ALLOWED_ORIGINS: 'https://dominion.turkeysunite.com' }, async () => {
    const { service } = makeService({});
    // Forged origin pointing at an attacker-controlled domain must NOT be
    // echoed back — otherwise Supabase would email confirmation links there.
    assertEquals(callResolveEmailRedirectOrigin(service, 'https://evil.example'), undefined);
    // Subtle near-miss: a different scheme on an otherwise-allowed host is
    // still a different origin and must be rejected.
    assertEquals(
      callResolveEmailRedirectOrigin(service, 'http://dominion.turkeysunite.com'),
      undefined,
    );
  });
});

// ── POST /auth/resend-confirmation ─────────────────────────────────────────
//
// Tests the resend-confirmation endpoint exercised by the login screen so
// users who never received (or lost) their signup confirmation email can
// request a new one. The default tests run against the in-memory backend,
// which short-circuits to a generic success without any Supabase work — so
// they cover routing, validation, and rate limiting end-to-end without
// needing a Supabase client mock. Email-enumeration protection is the load-
// bearing security property here: a successful response shape is identical
// regardless of whether the email exists.

Deno.test('ServerAuthRouteHandlerService: POST /auth/resend-confirmation with valid email → 200 generic success', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'someone@example.com' }),
      }),
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/resend-confirmation rejects missing email → 400', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.ok, false);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/resend-confirmation rejects invalid email → 400', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
    );

    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.ok, false);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/resend-confirmation rejects malformed JSON → 400', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({});

    const res = await dispatch(
      service,
      new Request('http://localhost/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json}',
      }),
    );

    assertEquals(res.status, 400);
  });
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/resend-confirmation when rate-limited → 429', async () => {
  // Set the threshold low so the test can reach it without spamming dispatch.
  await withIsolatedEnv(
    { AUTH_RATE_LIMIT_MAX_ATTEMPTS: '2', AUTH_RATE_LIMIT_WINDOW_MS: '60000' },
    async () => {
      const { service, rateLimiter } = makeService({});

      // Saturate the limiter for this IP. Two failures match the threshold,
      // so the third call lands on isLimited=true.
      rateLimiter.recordFailure('1.2.3.4');
      rateLimiter.recordFailure('1.2.3.4');

      const res = await dispatch(
        service,
        new Request('http://localhost/auth/resend-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'someone@example.com' }),
        }),
      );

      assertEquals(res.status, 429);
      // retry-after must be present so the client knows when to retry.
      assertEquals(typeof res.headers.get('retry-after'), 'string');
    },
  );
});

Deno.test('ServerAuthRouteHandlerService: POST /auth/resend-confirmation consumes a limiter slot per call', async () => {
  // With threshold=3, two successful calls should leave the IP one call away
  // from being limited. Verifies that legitimate resend traffic counts toward
  // the per-IP cap so the endpoint cannot be hammered indefinitely even with
  // perfectly-shaped bodies.
  await withIsolatedEnv(
    { AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' },
    async () => {
      const { service, rateLimiter } = makeService({});

      const makeRequest = () =>
        new Request('http://localhost/auth/resend-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'someone@example.com' }),
        });

      const first = await dispatch(service, makeRequest());
      assertEquals(first.status, 200);
      assertEquals(rateLimiter.isLimited('1.2.3.4'), false);

      const second = await dispatch(service, makeRequest());
      assertEquals(second.status, 200);
      assertEquals(rateLimiter.isLimited('1.2.3.4'), false);

      // Third call hits the threshold — limiter flips to limited after this.
      const third = await dispatch(service, makeRequest());
      assertEquals(third.status, 200);
      assertEquals(rateLimiter.isLimited('1.2.3.4'), true);

      // Fourth call is rejected with 429.
      const fourth = await dispatch(service, makeRequest());
      assertEquals(fourth.status, 429);
    },
  );
});
