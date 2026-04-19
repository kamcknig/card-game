import { assertEquals, assertNotEquals } from '@std/assert';
import { InMemoryRegistrationCodeStore } from '../auth/in-memory-registration-code-store.ts';
import { DenoKvRegistrationCodeStore } from '../auth/deno-kv-registration-code-store.ts';
import type { LoggerService } from '../logger-service.ts';
import type { RegistrationCodeStore } from '../auth/registration-code-store.ts';

// Minimal logger stub shared by KV tests.
const loggerStub: LoggerService = {
  log: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
  error: () => {},
} as unknown as LoggerService;

// Disables Deno's resource/async-op sanitizer for KV tests.
// The KV stores use fire-and-forget writes by design (see
// deno-kv-session-store.spec.ts for background). Deno KV handles created via
// ':memory:' are similarly not closed in these unit tests — tests exercise
// correctness against the in-memory cache, and the backing KV is released when
// the test process exits.
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// Conformance checks that apply to every RegistrationCodeStore implementation.
// Both the in-memory and KV stores call through these to confirm identical
// behavior and prevent drift between backends.
const runConformanceSuite = (name: string, factory: () => Promise<RegistrationCodeStore>) => {
  Deno.test(`${name}: create() returns a unique hex code`, testOpts, async () => {
    const store = await factory();
    const a = store.create({ createdBy: 'alice', expiresAt: null, maxUses: 1, now: 1_000 });
    const b = store.create({ createdBy: 'alice', expiresAt: null, maxUses: 1, now: 1_000 });
    assertEquals(a.usedCount, 0);
    assertEquals(b.usedCount, 0);
    assertNotEquals(a.code, b.code);
    assertEquals(typeof a.code, 'string');
    assertEquals(a.code.length > 16, true);
  });

  Deno.test(`${name}: recordUse() accepts a valid code exactly maxUses times`, testOpts, async () => {
    const store = await factory();
    const rec = store.create({ createdBy: 'alice', expiresAt: null, maxUses: 2, now: 1_000 });
    assertEquals(store.recordUse(rec.code, 2_000)?.usedCount, 1);
    assertEquals(store.recordUse(rec.code, 2_000)?.usedCount, 2);
    // Third use should be refused (maxUses exhausted, auto-disabled).
    assertEquals(store.recordUse(rec.code, 2_000), undefined);
  });

  Deno.test(`${name}: recordUse() refuses expired codes`, testOpts, async () => {
    const store = await factory();
    const rec = store.create({ createdBy: 'alice', expiresAt: 2_000, maxUses: 1, now: 1_000 });
    assertEquals(store.recordUse(rec.code, 3_000), undefined);
  });

  Deno.test(`${name}: recordUse() refuses disabled codes`, testOpts, async () => {
    const store = await factory();
    const rec = store.create({ createdBy: 'alice', expiresAt: null, maxUses: 5, now: 1_000 });
    store.disable(rec.code);
    assertEquals(store.recordUse(rec.code, 2_000), undefined);
  });

  Deno.test(`${name}: recordUse() refuses unknown codes`, testOpts, async () => {
    const store = await factory();
    assertEquals(store.recordUse('nonexistent', 2_000), undefined);
  });

  Deno.test(`${name}: disable() is idempotent`, testOpts, async () => {
    const store = await factory();
    const rec = store.create({ createdBy: 'alice', expiresAt: null, maxUses: 1, now: 1_000 });
    store.disable(rec.code);
    store.disable(rec.code);
    assertEquals(store.get(rec.code)?.disabled, true);
  });

  Deno.test(`${name}: purgeExpired() removes entries past expiresAt`, testOpts, async () => {
    const store = await factory();
    const a = store.create({ createdBy: 'alice', expiresAt: 2_000, maxUses: 1, now: 1_000 });
    const b = store.create({ createdBy: 'alice', expiresAt: null, maxUses: 1, now: 1_000 });
    const removed = store.purgeExpired(3_000);
    assertEquals(removed, 1);
    assertEquals(store.get(a.code), undefined);
    assertEquals(store.get(b.code)?.code, b.code);
  });

  Deno.test(`${name}: list() returns every persisted record`, testOpts, async () => {
    const store = await factory();
    store.create({ createdBy: 'alice', expiresAt: null, maxUses: 1, now: 1_000 });
    store.create({ createdBy: 'alice', expiresAt: null, maxUses: 1, now: 1_000 });
    assertEquals(store.list().length, 2);
  });
};

runConformanceSuite('InMemoryRegistrationCodeStore', () => Promise.resolve(new InMemoryRegistrationCodeStore()));

runConformanceSuite('DenoKvRegistrationCodeStore', async () => {
  const store = new DenoKvRegistrationCodeStore(loggerStub);
  // Use the in-memory KV backend so the test does not touch the filesystem.
  await store.open(':memory:');
  return store;
});
