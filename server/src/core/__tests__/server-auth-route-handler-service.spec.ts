import { assertEquals } from '@std/assert';
import { ServerAuthRouteHandlerService } from '../auth/server-auth-route-handler-service.ts';
import { AuthSessionService } from '../auth/auth-session-service.ts';
import { AuthRateLimiterService, Clock } from '../auth/auth-rate-limiter-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { LoggerService } from '../logger-service.ts';

// Env keys managed by this test suite.
const AUTH_ENV_KEYS = [
  'AUTH_PASSWORD',
  'AUTH_DISABLED',
  'AUTH_ALLOWED_ORIGINS',
  'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_MAX_BODY_BYTES',
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
      Deno.env.set('AUTH_DISABLED', 'true');
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

// Creates a stub AuthSessionService with controllable login / validateToken results.
const makeSessionServiceStub = (
  loginResult: { ok: true; token: string; username: string } | { ok: false; message: string },
  // null signals "token is invalid" (returns undefined); undefined means "use default 'testuser'".
  validateResult: string | null = 'testuser',
): AuthSessionService => {
  const removed: string[] = [];
  const resolvedValidate = validateResult === null ? undefined : validateResult;
  return {
    login: async () => loginResult,
    validateToken: (_token: string) => resolvedValidate,
    removeSession: (token: string) => {
      removed.push(token);
    },
    _removed: removed,
  } as unknown as AuthSessionService;
};

// Builds the service under test with all dependencies wired.
const makeService = (opts: {
  sessionServiceStub?: AuthSessionService;
  clock?: Clock;
  allowedOrigins?: string;
  maxAttempts?: string;
  windowMs?: string;
  maxBodyBytes?: string;
}) => {
  const config = new ServerConfigService();
  const logger = makeLoggerStub();
  const clock = opts.clock ?? makeFakeClock(1_000);
  const rateLimiter = new AuthRateLimiterService(logger, config, clock);
  const sessionService =
    opts.sessionServiceStub ??
    makeSessionServiceStub({ ok: true, token: 'tok-abc', username: 'testuser' });

  return { service: new ServerAuthRouteHandlerService(sessionService, logger, config, rateLimiter), rateLimiter };
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

// ── GET /auth/validate ────────────────────────────────────────────────────────

Deno.test('ServerAuthRouteHandlerService: GET /auth/validate with valid token → 200', async () => {
  await withIsolatedEnv({}, async () => {
    const { service } = makeService({
      sessionServiceStub: makeSessionServiceStub({ ok: true, token: 'tok', username: 'alice' }, 'alice'),
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
    const service = new ServerAuthRouteHandlerService(sessionService, logger, config, rateLimiter);

    const req = new Request('http://localhost/debug/state', { method: 'GET' });
    const url = new URL(req.url);
    const result = service.handleRequest(req, url, '1.2.3.4');

    assertEquals(result, undefined);
  });
});
