import { assertEquals } from '@std/assert';
import { AuthSessionService } from '../auth/auth-session-service.ts';
import { AuthProvider, AuthResult } from '../auth/auth-provider.ts';
import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { Clock } from '../auth/auth-rate-limiter-service.ts';

// Env keys managed by this test suite.
const AUTH_ENV_KEYS = [
  'AUTH_PASSWORD',
  'AUTH_DISABLED',
  'AUTH_SESSION_TTL_MS',
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
      // AUTH_DISABLED=true so ServerConfigService won't demand AUTH_PASSWORD.
      Deno.env.set('AUTH_DISABLED', 'true');
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

// Minimal logger stub that silences output during tests.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Controllable clock for deterministic time-based tests.
const makeFakeClock = (initialMs = 0): Clock & { advance(ms: number): void } => {
  let time = initialMs;
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
  };
};

// Builds a test AuthProvider that returns a fixed result.
const makeProvider = (name: string, result: AuthResult, initSpy?: () => void): AuthProvider => ({
  name,
  authenticate: async (_credentials) => {
    await Promise.resolve();
    return result;
  },
  initialize: initSpy
    ? async () => {
        await Promise.resolve();
        initSpy();
      }
    : undefined,
});

// ── Original Phase 1 tests (updated constructor signature) ────────────────────

Deno.test('AuthSessionService: login returns error for unknown provider', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());

    const result = await service.login('unknown', { username: 'alice', password: 'pw' });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.message, 'Unknown authentication provider');
    }
  }));

Deno.test('AuthSessionService: login returns error when provider rejects credentials', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    service.registerProvider(makeProvider('password', { ok: false, message: 'bad creds' }));
    await service.initializeProviders();

    const result = await service.login('password', { username: 'alice', password: 'wrong' });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.message, 'bad creds');
    }
  }));

Deno.test('AuthSessionService: login returns token and username on success', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const result = await service.login('password', { username: 'alice', password: 'correct' });

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(typeof result.token, 'string');
      assertEquals(result.token.length > 0, true);
      assertEquals(result.username, 'alice');
    }
  }));

Deno.test('AuthSessionService: validateToken returns username for valid token', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const loginResult = await service.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    const username = service.validateToken(loginResult.token);
    assertEquals(username, 'alice');
  }));

Deno.test('AuthSessionService: validateToken returns undefined for unknown token', () =>
  withIsolatedEnv({}, () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());

    const username = service.validateToken('not-a-real-token');
    assertEquals(username, undefined);
    return Promise.resolve();
  }));

Deno.test('AuthSessionService: removeSession makes token invalid', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const loginResult = await service.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    service.removeSession(loginResult.token);
    assertEquals(service.validateToken(loginResult.token), undefined);
  }));

Deno.test('AuthSessionService: removeSession on unknown token is a no-op', () =>
  withIsolatedEnv({}, () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    // Should not throw.
    service.removeSession('ghost-token');
    return Promise.resolve();
  }));

Deno.test('AuthSessionService: duplicate provider registration is ignored', () =>
  withIsolatedEnv({}, () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    const providerA = makeProvider('password', { ok: true, username: 'alice' });
    const providerB = makeProvider('password', { ok: true, username: 'bob' });

    service.registerProvider(providerA);
    service.registerProvider(providerB); // duplicate — should be ignored with warning
    return Promise.resolve();
  }));

Deno.test('AuthSessionService: initializeProviders calls initialize on registered providers', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    let initialized = false;
    const provider = makeProvider('password', { ok: true, username: 'alice' }, () => {
      initialized = true;
    });

    service.registerProvider(provider);
    await service.initializeProviders();

    assertEquals(initialized, true);
  }));

Deno.test('AuthSessionService: initializeProviders skips providers without initialize', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    // Provider with no initialize method — should not throw.
    const provider: AuthProvider = {
      name: 'guest',
      authenticate: async () => ({ ok: true, username: 'guest' }),
    };

    service.registerProvider(provider);
    await service.initializeProviders(); // Should not throw.
  }));

Deno.test('AuthSessionService: each successful login issues a unique token', () =>
  withIsolatedEnv({}, async () => {
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), makeFakeClock());
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const r1 = await service.login('password', {});
    const r2 = await service.login('password', {});

    if (!r1.ok || !r2.ok) throw new Error('Expected both logins to succeed');
    assertEquals(r1.token !== r2.token, true);
  }));

// ── Phase 2 tests ─────────────────────────────────────────────────────────────

Deno.test('AuthSessionService: validateToken returns undefined for expired session', () =>
  withIsolatedEnv({ AUTH_SESSION_TTL_MS: '5000' }, async () => {
    const clock = makeFakeClock(0);
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const loginResult = await service.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    // Advance past the 5-second TTL.
    clock.advance(6_000);

    const username = service.validateToken(loginResult.token);
    assertEquals(username, undefined);
  }));

Deno.test('AuthSessionService: validateToken extends expiry on each call (sliding window)', () =>
  withIsolatedEnv({ AUTH_SESSION_TTL_MS: '5000' }, async () => {
    const clock = makeFakeClock(0);
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const loginResult = await service.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    // Advance 4 seconds and validate — the TTL should reset.
    clock.advance(4_000);
    const u1 = service.validateToken(loginResult.token);
    assertEquals(u1, 'alice');

    // Advance another 4 seconds (8 total). Without sliding window this would
    // exceed 5s from creation; with it, the session is still live.
    clock.advance(4_000);
    const u2 = service.validateToken(loginResult.token);
    assertEquals(u2, 'alice');
  }));

Deno.test('AuthSessionService: listSessions prunes expired entries', () =>
  withIsolatedEnv({ AUTH_SESSION_TTL_MS: '5000' }, async () => {
    const clock = makeFakeClock(0);
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const r1 = await service.login('password', {});
    if (!r1.ok) throw new Error('Expected ok');

    // Advance past the TTL; create a new session while we're at it.
    clock.advance(6_000);

    const r2 = await service.login('password', {});
    if (!r2.ok) throw new Error('Expected ok');

    // listSessions should only return the live session.
    const sessions = service.listSessions();
    assertEquals(sessions.length, 1);
    assertEquals(sessions[0].token, r2.token);
  }));

Deno.test('AuthSessionService: removeSessionsForUsername removes all matches and returns count', () =>
  withIsolatedEnv({}, async () => {
    const clock = makeFakeClock(0);
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    service.registerProvider(makeProvider('alt', { ok: true, username: 'bob' }));
    await service.initializeProviders();

    // Create two sessions for alice and one for bob.
    const a1 = await service.login('password', {});
    const a2 = await service.login('password', {});
    const b1 = await service.login('alt', {});
    if (!a1.ok || !a2.ok || !b1.ok) throw new Error('Expected all logins ok');

    const removed = service.removeSessionsForUsername('alice');
    assertEquals(removed, 2);

    // Alice's tokens are gone; Bob's remain.
    assertEquals(service.validateToken(a1.token), undefined);
    assertEquals(service.validateToken(a2.token), undefined);
    assertEquals(service.validateToken(b1.token), 'bob');
  }));

Deno.test('AuthSessionService: login stores IP and user-agent in the record', () =>
  withIsolatedEnv({}, async () => {
    const clock = makeFakeClock(0);
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const result = await service.login('password', {}, { ip: '1.2.3.4', userAgent: 'TestBrowser/1.0' });
    if (!result.ok) throw new Error('Expected ok');

    const sessions = service.listSessions();
    assertEquals(sessions.length, 1);
    assertEquals(sessions[0].createdFromIp, '1.2.3.4');
    assertEquals(sessions[0].createdFromUserAgent, 'TestBrowser/1.0');
  }));

Deno.test('AuthSessionService: removeSessionsForUsernameExcept preserves the given token', () =>
  withIsolatedEnv({}, async () => {
    const clock = makeFakeClock(0);
    const service = new AuthSessionService(makeLoggerStub(), new ServerConfigService(), clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const a1 = await service.login('password', {});
    const a2 = await service.login('password', {});
    const a3 = await service.login('password', {});
    if (!a1.ok || !a2.ok || !a3.ok) throw new Error('Expected all ok');

    // Keep a2 token; remove a1 and a3.
    const removed = service.removeSessionsForUsernameExcept('alice', a2.token);
    assertEquals(removed, 2);

    assertEquals(service.validateToken(a1.token), undefined);
    assertEquals(service.validateToken(a2.token), 'alice');
    assertEquals(service.validateToken(a3.token), undefined);
  }));
