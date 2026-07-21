import { assertEquals } from '@std/assert';
import { DEV_BYPASS_SYNTHETIC_USER_ID, DevBypassUserStore } from '../auth/dev-bypass-user-store.ts';
import { InMemoryUserStore } from '../auth/in-memory-user-store.ts';
import { LoggerService } from '../logger-service.ts';

// Minimal logger stub that silences output during tests.
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

// Builds a bypass store wrapping a fresh in-memory store seeded with one
// real account (username 'kyle', email 'kyle@example.com').
const makeStores = async () => {
  const inner = new InMemoryUserStore();
  const real = await inner.create({
    username: 'kyle',
    email: 'kyle@example.com',
    passwordHash: 'hash',
    passwordAlgo: 'argon2id',
    now: 0,
  });
  const bypass = new DevBypassUserStore(inner, makeLoggerStub());
  return { inner, bypass, real };
};

Deno.test('getByUsername returns the real record for a stored username', async () => {
  const { bypass, real } = await makeStores();
  const result = await bypass.getByUsername('kyle');
  assertEquals(result?.id, real.id);
  assertEquals(result?.username, 'kyle');
  assertEquals(result?.email, 'kyle@example.com');
});

Deno.test('getByUsername resolves an email-shaped identifier to the real account by email', async () => {
  const { bypass, real } = await makeStores();
  // Sign-in-by-email sends the typed email through the username field; the
  // bypass must surface the canonical account, not synthesize a fake one
  // named after the email address.
  const result = await bypass.getByUsername('kyle@example.com');
  assertEquals(result?.id, real.id);
  assertEquals(result?.username, 'kyle');
  assertEquals(result?.email, 'kyle@example.com');
});

Deno.test('getByUsername synthesizes a dev admin for an unknown plain username', async () => {
  const { bypass } = await makeStores();
  const result = await bypass.getByUsername('ghost');
  assertEquals(result?.id, DEV_BYPASS_SYNTHETIC_USER_ID);
  assertEquals(result?.username, 'ghost');
  assertEquals(result?.email, 'ghost@dev.local');
  assertEquals(result?.isAdmin, true);
});

Deno.test('getByUsername derives a local-part username for an unknown email-shaped identifier', async () => {
  const { bypass } = await makeStores();
  // The synthetic email must stay well-formed: 'ghost@dev.local', never the
  // concatenated 'ghost@nowhere.test@dev.local'.
  const result = await bypass.getByUsername('ghost@nowhere.test');
  assertEquals(result?.id, DEV_BYPASS_SYNTHETIC_USER_ID);
  assertEquals(result?.username, 'ghost');
  assertEquals(result?.email, 'ghost@dev.local');
});

Deno.test('getByEmail stays a pass-through and never synthesizes', async () => {
  const { bypass } = await makeStores();
  assertEquals(await bypass.getByEmail('kyle@example.com') !== undefined, true);
  assertEquals(await bypass.getByEmail('missing@nowhere.test'), undefined);
});
