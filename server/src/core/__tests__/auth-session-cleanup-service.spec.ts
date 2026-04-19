import { assertEquals } from '@std/assert';
import { AuthSessionCleanupService } from '../auth/auth-session-cleanup-service.ts';
import { AuthSessionService } from '../auth/auth-session-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { LoggerService } from '../logger-service.ts';
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

// Minimal logger stub.
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

/**
 * Creates a fresh AuthSessionService backed by an InMemorySessionStore.
 *
 * Explicitly injects InMemorySessionStore so tests remain unit-scoped with no
 * external I/O.
 */
const makeSessionService = (clock: Clock, config?: ServerConfigService): AuthSessionService => {
  const logger = makeLoggerStub();
  const effectiveConfig = config ?? new ServerConfigService();
  return new AuthSessionService(logger, effectiveConfig, new InMemorySessionStore(), clock);
};

Deno.test('AuthSessionCleanupService: start() begins the timer and stop() clears it', () =>
  withIsolatedEnv({}, async () => {
    // We use a real setInterval here; the test verifies that start/stop do not
    // throw and that calling stop() after start() is idempotent.
    const clock = makeFakeClock(0);
    const logger = makeLoggerStub();
    const sessionService = makeSessionService(clock);

    const cleanup = new AuthSessionCleanupService(sessionService, logger);

    // Should not throw.
    cleanup.start(60_000);
    cleanup.stop();
    cleanup.stop(); // Second stop is a no-op.
  }));

Deno.test('AuthSessionCleanupService: start() is idempotent (second call does nothing)', () =>
  withIsolatedEnv({}, async () => {
    const logger = makeLoggerStub();
    const sessionService = makeSessionService(makeFakeClock(0));

    const cleanup = new AuthSessionCleanupService(sessionService, logger);

    cleanup.start(60_000);
    cleanup.start(60_000); // Second start — should not register a second interval.
    cleanup.stop();
  }));

Deno.test('AuthSessionCleanupService: purgeExpiredSessions removes expired sessions when triggered', () =>
  withIsolatedEnv({ AUTH_SESSION_TTL_MS: '5000' }, async () => {
    // Verify that after expiry, purgeExpiredSessions (which the cleanup service
    // delegates to) removes the expired record from the store.
    const clock = makeFakeClock(0);
    const logger = makeLoggerStub();
    const config = new ServerConfigService();
    const store = new InMemorySessionStore();
    const sessionService = new AuthSessionService(logger, config, store, clock);

    const provider = {
      name: 'password',
      authenticate: async () => ({ ok: true as const, username: 'alice' }),
    };
    sessionService.registerProvider(provider);
    await sessionService.initializeProviders();

    const loginResult = await sessionService.login('password', {});
    if (!loginResult.ok) throw new Error('Expected ok');

    // Confirm session is alive at t=0.
    assertEquals(store.listAll().length, 1);

    // Advance past the TTL.
    clock.advance(6_000);

    // Trigger the sweep directly (simulates what the cleanup timer does).
    const count = sessionService.purgeExpiredSessions();
    assertEquals(count, 1);

    // The store should now be empty.
    assertEquals(store.listAll().length, 0);
  }));
