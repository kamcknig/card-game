import { assertEquals, assertRejects } from '@std/assert';
import { InMemoryUserStore } from '../auth/in-memory-user-store.ts';
import { DenoKvUserStore } from '../auth/deno-kv-user-store.ts';
import type { LoggerService } from '../logger-service.ts';
import type { UserStore } from '../auth/user-store.ts';

// Minimal logger stub shared by KV tests.
const loggerStub: LoggerService = {
  log: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
  error: () => {},
} as unknown as LoggerService;

// Disables Deno's resource/async-op sanitizer for KV tests — KV stores use
// fire-and-forget writes by design (see deno-kv-session-store.spec.ts).
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// Conformance checks applied to every UserStore backend. Keeps the in-memory
// and KV stores behaviorally identical so the provider layer above is
// oblivious to the persistence choice.
const runConformanceSuite = (name: string, factory: () => Promise<UserStore>) => {
  Deno.test(`${name}: create() stores with lowercase lookup key`, testOpts, async () => {
    const store = await factory();
    const rec = await store.create({
      username: 'Alice',
      passwordHash: 'hash',
      passwordAlgo: 'argon2id',
      now: 1_000,
    });
    assertEquals(rec.username, 'Alice');
    assertEquals(store.getByUsername('alice')?.id, rec.id);
    assertEquals(store.getByUsername('ALICE')?.id, rec.id);
  });

  Deno.test(`${name}: create() refuses duplicate username (case-insensitive)`, testOpts, async () => {
    const store = await factory();
    await store.create({ username: 'Alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });
    // create() returns Promise<UserRecord> but the duplicate-username guard
    // still throws synchronously before the Promise.resolve wrapper. The
    // async arrow converts that sync throw into a rejection so assertRejects
    // sees it consistently across both backends.
    await assertRejects(async () => {
      await store.create({ username: 'alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });
    });
  });

  Deno.test(`${name}: recordFailure() increments failedAttempts`, testOpts, async () => {
    const store = await factory();
    const rec = await store.create({ username: 'Alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });
    const updated = store.recordFailure(rec.id, 2);
    assertEquals(updated.failedAttempts, 1);
    assertEquals(store.recordFailure(rec.id, 3).failedAttempts, 2);
  });

  Deno.test(`${name}: resetFailures() clears counters and lock`, testOpts, async () => {
    const store = await factory();
    const rec = await store.create({ username: 'Alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });
    store.recordFailure(rec.id, 2);
    store.setLockedUntil(rec.id, 9_999);
    store.resetFailures(rec.id);
    const after = store.getById(rec.id)!;
    assertEquals(after.failedAttempts, 0);
    assertEquals(after.lockedUntil, null);
  });

  Deno.test(`${name}: updatePassword() swaps algorithm and hash`, testOpts, async () => {
    const store = await factory();
    const rec = await store.create({ username: 'Alice', passwordHash: 'h1', passwordAlgo: 'argon2id', now: 1 });
    store.updatePassword(rec.id, 'h2', 'bcrypt', 100);
    const after = store.getById(rec.id)!;
    assertEquals(after.passwordHash, 'h2');
    assertEquals(after.passwordAlgo, 'bcrypt');
    assertEquals(after.passwordUpdatedAt, 100);
  });

  Deno.test(`${name}: setDisabled() toggles the disabled flag`, testOpts, async () => {
    const store = await factory();
    const rec = await store.create({ username: 'Alice', passwordHash: 'h', passwordAlgo: 'argon2id', now: 1 });
    store.setDisabled(rec.id, true);
    assertEquals(store.getById(rec.id)?.disabled, true);
    store.setDisabled(rec.id, false);
    assertEquals(store.getById(rec.id)?.disabled, false);
  });
};

runConformanceSuite('InMemoryUserStore', () => Promise.resolve(new InMemoryUserStore()));

runConformanceSuite('DenoKvUserStore', async () => {
  const store = new DenoKvUserStore(loggerStub);
  await store.open(':memory:');
  return store;
});
