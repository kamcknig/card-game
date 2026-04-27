import { assertEquals } from '@std/assert';
import { UserAccountAuthProvider } from '../auth/user-account-auth-provider.ts';
import { InMemoryUserStore } from '../auth/in-memory-user-store.ts';
import { Argon2idHasher, BcryptHasher } from '../auth/password-hasher.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { SupabaseClientProvider } from '../storage/supabase-client-provider.ts';
import { LoggerService } from '../logger-service.ts';
import { Clock } from '../auth/auth-rate-limiter-service.ts';

// Env keys that affect lockout behavior; we reset them around each test.
const ENV_KEYS = ['AUTH_LOCKOUT_THRESHOLD', 'AUTH_LOCKOUT_DURATION_MS'] as const;

// Saves/restores env across a test body so parallel-ish tests do not leak.
const withIsolatedEnv = (
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> => {
  const saved = new Map(ENV_KEYS.map(k => [k, Deno.env.get(k)]));
  return Promise.resolve()
    .then(() => {
      for (const key of ENV_KEYS) Deno.env.delete(key);
      for (const [k, v] of Object.entries(overrides)) {
        if (v !== undefined) Deno.env.set(k, v);
      }
      return run();
    })
    .finally(() => {
      for (const key of ENV_KEYS) {
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

// Controllable clock for deterministic lockout timing.
const makeFakeClock = (initialMs = 0): Clock & { advance(ms: number): void } => {
  let time = initialMs;
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
  };
};

// Minimal SupabaseClientProvider stub that always throws — the kv-backend
// tests never reach the Supabase path so this is never called.
const makeSupabaseClientProviderStub = (): SupabaseClientProvider =>
  ({
    get: () => {
      throw new Error('SupabaseClientProvider stub: not available in kv tests');
    },
  }) as unknown as SupabaseClientProvider;

// Builds the provider under test along with all real dependencies so tests
// exercise the full hash/verify path (real argon2id) to catch regressions.
const makeProvider = async (opts: { clock?: Clock } = {}) => {
  const config = new ServerConfigService();
  const logger = makeLoggerStub();
  const userStore = new InMemoryUserStore();
  const argon2id = new Argon2idHasher();
  const bcrypt = new BcryptHasher();
  const supabaseClientProvider = makeSupabaseClientProviderStub();
  const clock = opts.clock ?? makeFakeClock(1_000);
  const provider = new UserAccountAuthProvider(logger, userStore, argon2id, bcrypt, config, supabaseClientProvider, clock);
  await provider.initialize();
  return { provider, userStore, argon2id, bcrypt, clock, config };
};

Deno.test('UserAccountAuthProvider: authenticates a known user with correct password', async () => {
  await withIsolatedEnv({}, async () => {
    const { provider, userStore, argon2id } = await makeProvider();
    const hash = await argon2id.hash('strongpw-xyz');
    await userStore.create({ username: 'Alice', passwordHash: hash, passwordAlgo: 'argon2id', now: Date.now() });

    const res = await provider.authenticate({ username: 'Alice', password: 'strongpw-xyz' });
    assertEquals(res.ok, true);
    if (res.ok) assertEquals(res.username, 'Alice');
  });
});

Deno.test('UserAccountAuthProvider: rejects wrong password', async () => {
  await withIsolatedEnv({}, async () => {
    const { provider, userStore, argon2id } = await makeProvider();
    const hash = await argon2id.hash('strongpw-xyz');
    await userStore.create({ username: 'Alice', passwordHash: hash, passwordAlgo: 'argon2id', now: Date.now() });

    const res = await provider.authenticate({ username: 'Alice', password: 'wrong' });
    assertEquals(res.ok, false);
  });
});

Deno.test('UserAccountAuthProvider: unknown user returns generic rejection', async () => {
  await withIsolatedEnv({}, async () => {
    const { provider } = await makeProvider();
    const res = await provider.authenticate({ username: 'ghost', password: 'whatever' });
    assertEquals(res.ok, false);
    if (!res.ok) assertEquals(res.message, 'Username/password does not match');
  });
});

Deno.test('UserAccountAuthProvider: disabled account is refused', async () => {
  await withIsolatedEnv({}, async () => {
    const { provider, userStore, argon2id } = await makeProvider();
    const hash = await argon2id.hash('strongpw-xyz');
    const rec = await userStore.create({
      username: 'Alice',
      passwordHash: hash,
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });
    userStore.setDisabled(rec.id, true);

    const res = await provider.authenticate({ username: 'Alice', password: 'strongpw-xyz' });
    assertEquals(res.ok, false);
  });
});

Deno.test('UserAccountAuthProvider: locks account after threshold failures', async () => {
  await withIsolatedEnv({ AUTH_LOCKOUT_THRESHOLD: '3', AUTH_LOCKOUT_DURATION_MS: '60000' }, async () => {
    const clock = makeFakeClock(1_000);
    const { provider, userStore, argon2id } = await makeProvider({ clock });
    const hash = await argon2id.hash('strongpw-xyz');
    const rec = await userStore.create({
      username: 'Alice',
      passwordHash: hash,
      passwordAlgo: 'argon2id',
      now: 1_000,
    });

    // Three wrong attempts should trip the lockout.
    await provider.authenticate({ username: 'Alice', password: 'wrong' });
    await provider.authenticate({ username: 'Alice', password: 'wrong' });
    await provider.authenticate({ username: 'Alice', password: 'wrong' });

    const lockedUntil = (await userStore.getById(rec.id))!.lockedUntil;
    assertEquals(typeof lockedUntil, 'number');
    assertEquals(lockedUntil! > clock.now(), true);

    // Even the correct password should now return the locked response.
    const locked = await provider.authenticate({ username: 'Alice', password: 'strongpw-xyz' });
    assertEquals(locked.ok, false);
    if (!locked.ok) assertEquals(locked.message, 'Account temporarily locked');
  });
});

Deno.test('UserAccountAuthProvider: lockout clears after duration elapses', async () => {
  await withIsolatedEnv({ AUTH_LOCKOUT_THRESHOLD: '2', AUTH_LOCKOUT_DURATION_MS: '1000' }, async () => {
    const clock = makeFakeClock(1_000);
    const { provider, userStore, argon2id } = await makeProvider({ clock });
    const hash = await argon2id.hash('strongpw-xyz');
    userStore.create({ username: 'Alice', passwordHash: hash, passwordAlgo: 'argon2id', now: 1_000 });

    await provider.authenticate({ username: 'Alice', password: 'wrong' });
    await provider.authenticate({ username: 'Alice', password: 'wrong' });

    // Advance past the lockout window.
    clock.advance(5_000);

    const ok = await provider.authenticate({ username: 'Alice', password: 'strongpw-xyz' });
    assertEquals(ok.ok, true);
  });
});

Deno.test('UserAccountAuthProvider: rehashes bcrypt row to argon2id on successful login', async () => {
  await withIsolatedEnv({}, async () => {
    const { provider, userStore, bcrypt } = await makeProvider();
    const bcryptHash = await bcrypt.hash('strongpw-xyz');
    const rec = await userStore.create({
      username: 'Alice',
      passwordHash: bcryptHash,
      passwordAlgo: 'argon2id',
      now: Date.now(),
    });
    // Manually override the algorithm since create() forces argon2id.
    userStore.updatePassword(rec.id, bcryptHash, 'bcrypt', Date.now());

    const res = await provider.authenticate({ username: 'Alice', password: 'strongpw-xyz' });
    assertEquals(res.ok, true);
    // The store should now hold an argon2id hash.
    assertEquals((await userStore.getById(rec.id))?.passwordAlgo, 'argon2id');
  });
});

Deno.test('UserAccountAuthProvider: empty credentials return generic rejection', async () => {
  await withIsolatedEnv({}, async () => {
    const { provider } = await makeProvider();
    assertEquals((await provider.authenticate({ username: '', password: 'pw' })).ok, false);
    assertEquals((await provider.authenticate({ username: 'Alice', password: '' })).ok, false);
  });
});
