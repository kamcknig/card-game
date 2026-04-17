import { assertEquals } from '@std/assert';
import { PresetPasswordAuthProvider } from '../auth/preset-password-auth-provider.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { LoggerService } from '../logger-service.ts';

// Env keys managed by this test suite.
const AUTH_ENV_KEYS = [
  'AUTH_PASSWORD',
  'AUTH_DISABLED',
] as const;

// Saves and restores the relevant env vars around a test body.
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

// Captures warn calls for assertion.
const makeCapturingLogger = (): LoggerService & { warns: string[] } => {
  const warns: string[] = [];
  return {
    log: () => {},
    info: () => {},
    debug: () => {},
    error: () => {},
    warn: (msg: unknown) => {
      warns.push(String(msg));
    },
    warns,
  } as unknown as LoggerService & { warns: string[] };
};

Deno.test('PresetPasswordAuthProvider: correct password succeeds', async () => {
  await withIsolatedEnv({ AUTH_PASSWORD: 'dominion', AUTH_DISABLED: 'false' }, async () => {
    const config = new ServerConfigService();
    const provider = new PresetPasswordAuthProvider(makeLoggerStub(), config);
    await provider.initialize();

    const result = await provider.authenticate({ username: 'alice', password: 'dominion' });
    assertEquals(result.ok, true);
    if (result.ok) assertEquals(result.username, 'alice');
  });
});

Deno.test('PresetPasswordAuthProvider: wrong password is rejected', async () => {
  await withIsolatedEnv({ AUTH_PASSWORD: 'dominion', AUTH_DISABLED: 'false' }, async () => {
    const config = new ServerConfigService();
    const provider = new PresetPasswordAuthProvider(makeLoggerStub(), config);
    await provider.initialize();

    const result = await provider.authenticate({ username: 'alice', password: 'wrong' });
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.message, 'Username/password does not match');
  });
});

Deno.test('PresetPasswordAuthProvider: empty username is rejected', async () => {
  await withIsolatedEnv({ AUTH_PASSWORD: 'dominion', AUTH_DISABLED: 'false' }, async () => {
    const config = new ServerConfigService();
    const provider = new PresetPasswordAuthProvider(makeLoggerStub(), config);
    await provider.initialize();

    const result = await provider.authenticate({ username: '', password: 'dominion' });
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.message, 'Username/password does not match');
  });
});

Deno.test('PresetPasswordAuthProvider: missing username field is rejected', async () => {
  await withIsolatedEnv({ AUTH_PASSWORD: 'dominion', AUTH_DISABLED: 'false' }, async () => {
    const config = new ServerConfigService();
    const provider = new PresetPasswordAuthProvider(makeLoggerStub(), config);
    await provider.initialize();

    // No username key in credentials.
    const result = await provider.authenticate({ password: 'dominion' });
    assertEquals(result.ok, false);
  });
});

Deno.test('PresetPasswordAuthProvider: AUTH_DISABLED=true bypasses password check', async () => {
  await withIsolatedEnv({ AUTH_DISABLED: 'true' }, async () => {
    const config = new ServerConfigService();
    const logger = makeCapturingLogger();
    const provider = new PresetPasswordAuthProvider(logger, config);
    await provider.initialize();

    // Any non-empty username is accepted regardless of password.
    const result = await provider.authenticate({ username: 'alice', password: '' });
    assertEquals(result.ok, true);
    if (result.ok) assertEquals(result.username, 'alice');

    // A warning should have been emitted during initialize().
    const warnedAboutDisable = logger.warns.some(w => w.includes('AUTH_DISABLED=true'));
    assertEquals(warnedAboutDisable, true);
  });
});

Deno.test('PresetPasswordAuthProvider: AUTH_DISABLED=true still rejects empty username', async () => {
  await withIsolatedEnv({ AUTH_DISABLED: 'true' }, async () => {
    const config = new ServerConfigService();
    const provider = new PresetPasswordAuthProvider(makeLoggerStub(), config);
    await provider.initialize();

    const result = await provider.authenticate({ username: '', password: '' });
    assertEquals(result.ok, false);
  });
});

Deno.test('PresetPasswordAuthProvider: authenticate before initialize returns not-ready error', async () => {
  await withIsolatedEnv({ AUTH_PASSWORD: 'dominion', AUTH_DISABLED: 'false' }, async () => {
    const config = new ServerConfigService();
    const provider = new PresetPasswordAuthProvider(makeLoggerStub(), config);
    // Intentionally skip initialize().

    const result = await provider.authenticate({ username: 'alice', password: 'dominion' });
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.message, 'Authentication service not ready');
  });
});
