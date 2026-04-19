import { assertEquals } from '@std/assert';
import { AuthRateLimiterService, Clock } from '../auth/auth-rate-limiter-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { LoggerService } from '../logger-service.ts';

// Env keys managed by this test suite.
const AUTH_ENV_KEYS = [
  'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
  'AUTH_RATE_LIMIT_WINDOW_MS',
] as const;

// Saves and restores the relevant env vars around a test body.
const withIsolatedEnv = (overrides: Partial<Record<(typeof AUTH_ENV_KEYS)[number], string>>, run: () => void) => {
  const saved = new Map(AUTH_ENV_KEYS.map(k => [k, Deno.env.get(k)]));
  try {
    for (const key of AUTH_ENV_KEYS) {
      Deno.env.delete(key);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) Deno.env.set(k, v);
    }
    run();
  } finally {
    for (const key of AUTH_ENV_KEYS) {
      const v = saved.get(key);
      if (v === undefined) Deno.env.delete(key);
      else Deno.env.set(key, v);
    }
  }
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

Deno.test('AuthRateLimiterService: isLimited returns false when below threshold', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1000);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    // Record two failures (below threshold of 3).
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');

    assertEquals(limiter.isLimited('1.2.3.4'), false);
  });
});

Deno.test('AuthRateLimiterService: isLimited returns true at the threshold', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1000);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');

    // Exactly at threshold.
    assertEquals(limiter.isLimited('1.2.3.4'), true);
  });
});

Deno.test('AuthRateLimiterService: isLimited returns true above threshold', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1000);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');

    assertEquals(limiter.isLimited('1.2.3.4'), true);
  });
});

Deno.test('AuthRateLimiterService: sliding-window expiry removes old attempts', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(0);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    // Record 3 failures at t=0.
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    assertEquals(limiter.isLimited('1.2.3.4'), true);

    // Advance past the 60-second window.
    clock.advance(60_001);

    // All attempts have expired — should no longer be limited.
    assertEquals(limiter.isLimited('1.2.3.4'), false);
  });
});

Deno.test('AuthRateLimiterService: reset clears counter and isLimited returns false', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '2', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1000);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    limiter.recordFailure('1.2.3.4');
    limiter.recordFailure('1.2.3.4');
    assertEquals(limiter.isLimited('1.2.3.4'), true);

    limiter.reset('1.2.3.4');
    assertEquals(limiter.isLimited('1.2.3.4'), false);
  });
});

Deno.test('AuthRateLimiterService: retryAfterMs returns 0 when no attempts recorded', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1000);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    assertEquals(limiter.retryAfterMs('1.2.3.4'), 0);
  });
});

Deno.test('AuthRateLimiterService: retryAfterMs reflects time until oldest attempt expires', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(0);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    // Record failure at t=0.
    limiter.recordFailure('1.2.3.4');

    // Advance 10 seconds.
    clock.advance(10_000);

    // Oldest attempt is at t=0, window=60000, now=10000 → retryAfter=50000.
    assertEquals(limiter.retryAfterMs('1.2.3.4'), 50_000);
  });
});

Deno.test('AuthRateLimiterService: retryAfterMs returns 0 after all attempts expire', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '3', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(0);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    limiter.recordFailure('1.2.3.4');
    clock.advance(70_000);

    // Expired — GC removes the entry; retryAfterMs should be 0.
    assertEquals(limiter.retryAfterMs('1.2.3.4'), 0);
  });
});

Deno.test('AuthRateLimiterService: distinct IPs are tracked independently', () => {
  withIsolatedEnv({ AUTH_RATE_LIMIT_MAX_ATTEMPTS: '2', AUTH_RATE_LIMIT_WINDOW_MS: '60000' }, () => {
    const config = new ServerConfigService();
    const logger = makeLoggerStub();
    const clock = makeFakeClock(1000);
    const limiter = new AuthRateLimiterService(logger, config, clock);

    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');

    // IP A is limited, IP B is not.
    assertEquals(limiter.isLimited('1.1.1.1'), true);
    assertEquals(limiter.isLimited('2.2.2.2'), false);

    // Resetting IP A does not affect IP B's state.
    limiter.reset('1.1.1.1');
    assertEquals(limiter.isLimited('1.1.1.1'), false);
    assertEquals(limiter.isLimited('2.2.2.2'), false);
  });
});
