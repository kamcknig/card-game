import { assertEquals } from '@std/assert';
import { AuthSessionService } from '../auth/auth-session-service.ts';
import { AuthProvider, AuthResult } from '../auth/auth-provider.ts';
import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { Clock } from '../auth/auth-rate-limiter-service.ts';
import { InMemorySessionStore } from '../auth/in-memory-session-store.ts';

// Env keys managed by this test suite.
const AUTH_ENV_KEYS = [
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

/**
 * Creates a fresh AuthSessionService with an InMemorySessionStore.
 *
 * Tests inject InMemorySessionStore so they remain unit-scoped with no
 * external I/O.
 */
const makeService = (clock?: Clock & { advance(ms: number): void }) => {
  const logger = makeLoggerStub();
  const config = new ServerConfigService();
  const store = new InMemorySessionStore();
  const effectiveClock = clock ?? makeFakeClock();
  return { service: new AuthSessionService(logger, config, store, effectiveClock), store };
};

// ── Core session service tests ────────────────────────────────────────────────

Deno.test('AuthSessionService: login returns error for unknown provider', () =>
  withIsolatedEnv({}, async () => {
    const { service } = makeService();

    const result = await service.login('unknown', { username: 'alice', password: 'pw' });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.message, 'Unknown authentication provider');
    }
  }));

Deno.test('AuthSessionService: login returns error when provider rejects credentials', () =>
  withIsolatedEnv({}, async () => {
    const { service } = makeService();
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
    const { service } = makeService();
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
    const { service } = makeService();
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const loginResult = await service.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    const username = service.validateToken(loginResult.token);
    assertEquals(username, 'alice');
  }));

Deno.test('AuthSessionService: validateToken returns undefined for unknown token', () =>
  withIsolatedEnv({}, () => {
    const { service } = makeService();

    const username = service.validateToken('not-a-real-token');
    assertEquals(username, undefined);
    return Promise.resolve();
  }));

Deno.test('AuthSessionService: removeSession makes token invalid', () =>
  withIsolatedEnv({}, async () => {
    const { service } = makeService();
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const loginResult = await service.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    service.removeSession(loginResult.token);
    assertEquals(service.validateToken(loginResult.token), undefined);
  }));

Deno.test('AuthSessionService: removeSession on unknown token is a no-op', () =>
  withIsolatedEnv({}, () => {
    const { service } = makeService();
    // Should not throw.
    service.removeSession('ghost-token');
    return Promise.resolve();
  }));

Deno.test('AuthSessionService: duplicate provider registration is ignored', () =>
  withIsolatedEnv({}, () => {
    const { service } = makeService();
    const providerA = makeProvider('password', { ok: true, username: 'alice' });
    const providerB = makeProvider('password', { ok: true, username: 'bob' });

    service.registerProvider(providerA);
    service.registerProvider(providerB); // duplicate — should be ignored with warning
    return Promise.resolve();
  }));

Deno.test('AuthSessionService: initializeProviders calls initialize on registered providers', () =>
  withIsolatedEnv({}, async () => {
    const { service } = makeService();
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
    const { service } = makeService();
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
    // Use two different usernames so single-session enforcement does not
    // invalidate the first token before we can compare them.
    const { service } = makeService();
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    service.registerProvider(makeProvider('password2', { ok: true, username: 'bob' }));
    await service.initializeProviders();

    const r1 = await service.login('password', {});
    const r2 = await service.login('password2', {});

    if (!r1.ok || !r2.ok) throw new Error('Expected both logins to succeed');
    assertEquals(r1.token !== r2.token, true);
  }));

Deno.test('AuthSessionService: second login for same user revokes prior session (single-session enforcement)', () =>
  withIsolatedEnv({}, async () => {
    const { service } = makeService();
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const r1 = await service.login('password', {});
    if (!r1.ok) throw new Error('Expected first login to succeed');

    const r2 = await service.login('password', {});
    if (!r2.ok) throw new Error('Expected second login to succeed');

    // First session must be invalidated; only the second token is valid.
    assertEquals(service.validateToken(r1.token), undefined);
    assertEquals(service.validateToken(r2.token), 'alice');
  }));

// ── Session lifecycle tests ───────────────────────────────────────────────────

Deno.test('AuthSessionService: validateToken returns undefined for expired session', () =>
  withIsolatedEnv({ AUTH_SESSION_TTL_MS: '5000' }, async () => {
    const clock = makeFakeClock(0);
    const { service } = makeService(clock);
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
    const { service } = makeService(clock);
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
    const { service } = makeService(clock);
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
    const ttlMs = 7 * 24 * 60 * 60 * 1000;
    const logger = makeLoggerStub();
    const config = new ServerConfigService();
    // Use the store directly to inject multiple sessions without triggering
    // single-session enforcement in login().
    const store = new InMemorySessionStore();
    const service = new AuthSessionService(logger, config, store, clock);
    service.registerProvider(makeProvider('alt', { ok: true, username: 'bob' }));
    await service.initializeProviders();

    // Inject two alice sessions directly into the store to bypass single-session enforcement.
    const makeRec = (token: string, username: string) => ({
      token,
      username,
      providerName: 'password',
      createdAt: 0,
      lastActivityAt: 0,
      expiresAt: ttlMs,
      createdFromIp: undefined,
      createdFromUserAgent: undefined,
    });
    store.put(makeRec('alice-1', 'alice'));
    store.put(makeRec('alice-2', 'alice'));

    const b1 = await service.login('alt', {});
    if (!b1.ok) throw new Error('Expected bob login ok');

    const removed = service.removeSessionsForUsername('alice');
    assertEquals(removed, 2);

    // Alice's tokens are gone; Bob's remain.
    assertEquals(service.validateToken('alice-1'), undefined);
    assertEquals(service.validateToken('alice-2'), undefined);
    assertEquals(service.validateToken(b1.token), 'bob');
  }));

Deno.test('AuthSessionService: login stores IP and user-agent in the record', () =>
  withIsolatedEnv({}, async () => {
    const clock = makeFakeClock(0);
    const { service } = makeService(clock);
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
    const ttlMs = 7 * 24 * 60 * 60 * 1000;
    const logger = makeLoggerStub();
    const config = new ServerConfigService();
    const store = new InMemorySessionStore();
    const service = new AuthSessionService(logger, config, store, clock);
    await service.initializeProviders();

    // Inject three sessions directly into the store to bypass single-session enforcement.
    const fakeSession = (token: string) => ({
      token,
      username: 'alice',
      providerName: 'password',
      createdAt: 0,
      lastActivityAt: 0,
      expiresAt: ttlMs,
      createdFromIp: undefined,
      createdFromUserAgent: undefined,
    });
    const [t1, t2, t3] = ['tok-1', 'tok-2', 'tok-3'];
    store.put(fakeSession(t1));
    store.put(fakeSession(t2));
    store.put(fakeSession(t3));

    // Keep t2; remove t1 and t3.
    const removed = service.removeSessionsForUsernameExcept('alice', t2);
    assertEquals(removed, 2);

    assertEquals(service.validateToken(t1), undefined);
    assertEquals(service.validateToken(t2), 'alice');
    assertEquals(service.validateToken(t3), undefined);
  }));

// ── Session store tests ───────────────────────────────────────────────────────

Deno.test('AuthSessionService: purgeExpiredSessions removes expired records from the store', () =>
  withIsolatedEnv({ AUTH_SESSION_TTL_MS: '5000' }, async () => {
    const clock = makeFakeClock(0);
    const logger = makeLoggerStub();
    const config = new ServerConfigService();
    const store = new InMemorySessionStore();
    const service = new AuthSessionService(logger, config, store, clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    const r1 = await service.login('password', {});
    if (!r1.ok) throw new Error('Expected ok');

    // Advance past the TTL; the session is now expired in the store.
    clock.advance(6_000);

    // purgeExpiredSessions should remove the expired row.
    const count = service.purgeExpiredSessions();
    assertEquals(count, 1);

    // Confirm it's gone from the store.
    assertEquals(store.listAll().length, 0);
  }));

Deno.test('AuthSessionService: purgeExpiredSessions returns 0 when nothing is expired', () =>
  withIsolatedEnv({}, async () => {
    const clock = makeFakeClock(0);
    const { service } = makeService(clock);
    service.registerProvider(makeProvider('password', { ok: true, username: 'alice' }));
    await service.initializeProviders();

    await service.login('password', {});

    // No time has advanced — nothing is expired.
    const count = service.purgeExpiredSessions();
    assertEquals(count, 0);
  }));
