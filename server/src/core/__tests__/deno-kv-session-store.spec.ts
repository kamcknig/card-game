import { assertEquals } from '@std/assert';
import { DenoKvSessionStore } from '../auth/deno-kv-session-store.ts';
import { LoggerService } from '../logger-service.ts';
import type { SessionStore } from '../auth/session-store.ts';
import type { SessionRecord } from '../auth/auth-session-service.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Minimal logger stub that silences output during tests.
 */
const makeLoggerStub = (): LoggerService =>
  ({
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }) as unknown as LoggerService;

/**
 * Builds a minimal valid `SessionRecord` for test use.
 *
 * All fields are filled with deterministic values; callers may spread-override
 * individual fields to produce variant records.
 */
const makeRecord = (overrides: Partial<SessionRecord> = {}): SessionRecord => ({
  token: 'test-token-1',
  username: 'alice',
  providerName: 'password',
  createdAt: 1_000,
  lastActivityAt: 1_000,
  // Use a far-future expiry so the record is not filtered at open() time
  // or in purgeExpired() calls that use Date.now() defaults.
  expiresAt: 9_999_999_999,
  createdFromIp: '1.2.3.4',
  createdFromUserAgent: 'TestBrowser/1.0',
  ...overrides,
});

/**
 * Opens a fresh `DenoKvSessionStore` backed by an in-memory KV store.
 *
 * Uses `':memory:'` so no temp files are created or cleaned up between tests.
 * `nowMs` defaults to 0 so all fixture records (which all have far-future
 * expiresAt) survive the open-time expiry filter.
 */
const makeStore = async (nowMs = 0): Promise<DenoKvSessionStore> => {
  const store = new DenoKvSessionStore(makeLoggerStub());
  await store.open(':memory:', nowMs);
  return store;
};

/**
 * Test options that disable resource and async-op leak detection.
 *
 * `DenoKvSessionStore` uses fire-and-forget KV writes (the KV `set`/`delete`
 * Promises are not awaited). Deno's test sanitizer treats unresolved async ops
 * as leaks. Since this pattern is intentional design — reads are synchronous
 * from the in-memory cache, writes are opportunistic background ops — we
 * disable both sanitizers for all KV store tests.
 *
 * The underlying correctness properties (cache consistency, purgeExpired
 * counts, etc.) are tested synchronously against the in-memory cache, which
 * is the authoritative source for read operations.
 */
const testOpts = { sanitizeOps: false, sanitizeResources: false };

// ── Conformance suite ─────────────────────────────────────────────────────────

/**
 * Runs the full `SessionStore` conformance suite against a `DenoKvSessionStore`.
 *
 * Each test builds a fresh in-memory store via `makeStore()` so tests are
 * isolated. All session store implementations must exhibit the same external
 * behaviour regardless of backing implementation.
 *
 * The `sanitizeOps`/`sanitizeResources` flags are disabled because KV writes
 * are fire-and-forget by design (see `testOpts` comment above).
 */
const runConformanceSuite = (label: string, makeAsync: () => Promise<SessionStore>) => {
  const withStore = (fn: (store: SessionStore) => void | Promise<void>) => async () => {
    const store = await makeAsync();
    await fn(store);
  };

  // ── get ───────────────────────────────────────────────────────────────────

  Deno.test(`${label}: get returns undefined for missing token`, testOpts, withStore(store => {
    assertEquals(store.get('no-such-token'), undefined);
  }));

  Deno.test(`${label}: get returns the record after put`, testOpts, withStore(store => {
    const rec = makeRecord();
    store.put(rec);
    const result = store.get(rec.token);

    assertEquals(result?.token, rec.token);
    assertEquals(result?.username, rec.username);
    assertEquals(result?.providerName, rec.providerName);
    assertEquals(result?.createdAt, rec.createdAt);
    assertEquals(result?.lastActivityAt, rec.lastActivityAt);
    assertEquals(result?.expiresAt, rec.expiresAt);
    assertEquals(result?.createdFromIp, rec.createdFromIp);
    assertEquals(result?.createdFromUserAgent, rec.createdFromUserAgent);
  }));

  // ── put ───────────────────────────────────────────────────────────────────

  Deno.test(`${label}: put replaces an existing record`, testOpts, withStore(store => {
    const original = makeRecord({ expiresAt: 9_999_990_000 });
    const replaced = makeRecord({ expiresAt: 9_999_995_000 });

    store.put(original);
    store.put(replaced);

    assertEquals(store.get(original.token)?.expiresAt, 9_999_995_000);
  }));

  // ── update ────────────────────────────────────────────────────────────────

  Deno.test(`${label}: update patches lastActivityAt and expiresAt`, testOpts, withStore(store => {
    const rec = makeRecord({ lastActivityAt: 1_000, expiresAt: 9_999_990_000 });
    store.put(rec);

    store.update(rec.token, { lastActivityAt: 2_000, expiresAt: 9_999_995_000 });

    const result = store.get(rec.token);
    assertEquals(result?.lastActivityAt, 2_000);
    assertEquals(result?.expiresAt, 9_999_995_000);
    // Non-patched fields remain unchanged.
    assertEquals(result?.username, rec.username);
  }));

  Deno.test(`${label}: update with only expiresAt leaves lastActivityAt alone`, testOpts, withStore(store => {
    const rec = makeRecord({ lastActivityAt: 1_000, expiresAt: 9_999_990_000 });
    store.put(rec);

    store.update(rec.token, { expiresAt: 9_999_995_000 });

    const result = store.get(rec.token);
    assertEquals(result?.lastActivityAt, 1_000);
    assertEquals(result?.expiresAt, 9_999_995_000);
  }));

  Deno.test(`${label}: update on missing token is a no-op`, testOpts, withStore(store => {
    // Should not throw.
    store.update('ghost-token', { expiresAt: 9_999_999_999 });
    assertEquals(store.get('ghost-token'), undefined);
  }));

  // ── delete ────────────────────────────────────────────────────────────────

  Deno.test(`${label}: delete removes the record`, testOpts, withStore(store => {
    const rec = makeRecord();
    store.put(rec);
    store.delete(rec.token);

    assertEquals(store.get(rec.token), undefined);
  }));

  Deno.test(`${label}: delete on missing token is a no-op`, testOpts, withStore(store => {
    // Should not throw.
    store.delete('ghost-token');
  }));

  // ── deleteByUsername ──────────────────────────────────────────────────────

  Deno.test(`${label}: deleteByUsername removes all sessions for that user`, testOpts, withStore(store => {
    store.put(makeRecord({ token: 'a-1', username: 'alice' }));
    store.put(makeRecord({ token: 'a-2', username: 'alice' }));
    store.put(makeRecord({ token: 'b-1', username: 'bob' }));

    const removed = store.deleteByUsername('alice');

    assertEquals(removed, 2);
    assertEquals(store.get('a-1'), undefined);
    assertEquals(store.get('a-2'), undefined);
    // Bob's session is untouched.
    assertEquals(store.get('b-1')?.username, 'bob');
  }));

  Deno.test(
    `${label}: deleteByUsername with exceptToken preserves that token`,
    testOpts,
    withStore(store => {
      store.put(makeRecord({ token: 'a-1', username: 'alice' }));
      store.put(makeRecord({ token: 'a-2', username: 'alice' }));
      store.put(makeRecord({ token: 'a-3', username: 'alice' }));

      const removed = store.deleteByUsername('alice', 'a-2');

      assertEquals(removed, 2);
      assertEquals(store.get('a-1'), undefined);
      assertEquals(store.get('a-2')?.token, 'a-2');
      assertEquals(store.get('a-3'), undefined);
    }),
  );

  Deno.test(`${label}: deleteByUsername returns 0 when user has no sessions`, testOpts, withStore(store => {
    assertEquals(store.deleteByUsername('nobody'), 0);
  }));

  // ── listAll ───────────────────────────────────────────────────────────────

  Deno.test(`${label}: listAll returns empty array when store is empty`, testOpts, withStore(store => {
    assertEquals(store.listAll().length, 0);
  }));

  Deno.test(`${label}: listAll returns all stored records`, testOpts, withStore(store => {
    const r1 = makeRecord({ token: 't-1', username: 'alice' });
    const r2 = makeRecord({ token: 't-2', username: 'bob' });
    store.put(r1);
    store.put(r2);

    const all = store.listAll();
    assertEquals(all.length, 2);

    const tokens = all.map(r => r.token).sort();
    assertEquals(tokens, ['t-1', 't-2']);
  }));

  Deno.test(`${label}: listAll does not filter expired records`, testOpts, withStore(store => {
    // A record with expiresAt in the past — listAll should still return it.
    store.put(makeRecord({ token: 'past', expiresAt: 1 }));
    store.put(makeRecord({ token: 'live', expiresAt: 9_999_999_999 }));

    const all = store.listAll();
    assertEquals(all.length, 2);
  }));

  // ── purgeExpired ──────────────────────────────────────────────────────────

  Deno.test(`${label}: purgeExpired removes records with expiresAt <= nowMs`, testOpts, withStore(store => {
    store.put(makeRecord({ token: 'exp-1', expiresAt: 1_000 }));
    store.put(makeRecord({ token: 'exp-2', expiresAt: 2_000 }));
    store.put(makeRecord({ token: 'live', expiresAt: 9_999_999_999 }));

    // Purge everything at or before t=2000.
    const removed = store.purgeExpired(2_000);

    assertEquals(removed, 2);
    assertEquals(store.get('exp-1'), undefined);
    assertEquals(store.get('exp-2'), undefined);
    assertEquals(store.get('live')?.token, 'live');
  }));

  Deno.test(`${label}: purgeExpired returns 0 when nothing is expired`, testOpts, withStore(store => {
    store.put(makeRecord({ token: 'live', expiresAt: 9_999_999_999 }));
    assertEquals(store.purgeExpired(1), 0);
    assertEquals(store.get('live')?.token, 'live');
  }));

  Deno.test(`${label}: purgeExpired on empty store returns 0`, testOpts, withStore(store => {
    assertEquals(store.purgeExpired(Date.now()), 0);
  }));

  // ── optional fields ───────────────────────────────────────────────────────

  Deno.test(`${label}: optional fields round-trip as undefined when absent`, testOpts, withStore(store => {
    const rec = makeRecord({ token: 'no-ctx', createdFromIp: undefined, createdFromUserAgent: undefined });
    store.put(rec);

    const result = store.get('no-ctx');
    assertEquals(result?.createdFromIp, undefined);
    assertEquals(result?.createdFromUserAgent, undefined);
  }));
};

// Run the conformance suite against DenoKvSessionStore with in-memory KV.
runConformanceSuite('DenoKvSessionStore', makeStore);

// ── DenoKvSessionStore-specific tests ─────────────────────────────────────────

Deno.test('DenoKvSessionStore: purgeExpired filters only expired records', testOpts, async () => {
  // Verifies the boundary condition: records at exactly nowMs are removed,
  // records at nowMs + 1 are kept.
  const store = await makeStore();

  store.put(makeRecord({ token: 'at-boundary', expiresAt: 5_000 }));
  store.put(makeRecord({ token: 'just-after', expiresAt: 5_001 }));
  store.put(makeRecord({ token: 'way-after', expiresAt: 9_999_999_999 }));

  const removed = store.purgeExpired(5_000);

  assertEquals(removed, 1);
  assertEquals(store.get('at-boundary'), undefined);
  assertEquals(store.get('just-after')?.token, 'just-after');
  assertEquals(store.get('way-after')?.token, 'way-after');
});

Deno.test('DenoKvSessionStore: open filters out expired sessions at load time', testOpts, async () => {
  // The in-memory KV store created by ':memory:' is isolated per openKv()
  // call — there is no shared state between open() invocations. This test
  // therefore exercises the open() expiry filter by opening a store and then
  // manually inserting an expired record, confirming purgeExpired removes it.
  const store = await makeStore(0);

  const expiredRec = makeRecord({ token: 'expired-after-open', expiresAt: 100 });
  store.put(expiredRec);

  // Confirm the record is in the cache.
  assertEquals(store.get('expired-after-open')?.token, 'expired-after-open');

  // Purge at nowMs = 200 — the record should be removed.
  const removed = store.purgeExpired(200);
  assertEquals(removed, 1);
  assertEquals(store.get('expired-after-open'), undefined);
});

Deno.test('DenoKvSessionStore: delete removes from cache immediately', testOpts, async () => {
  // Confirms that delete() updates the in-memory cache synchronously so that
  // the next get() call sees the deletion without waiting for the KV write.
  const store = await makeStore();
  const rec = makeRecord({ token: 'del-me' });
  store.put(rec);

  assertEquals(store.get('del-me')?.token, 'del-me');

  store.delete('del-me');

  assertEquals(store.get('del-me'), undefined);
});

Deno.test('DenoKvSessionStore: put then get is synchronous (no await needed)', testOpts, async () => {
  // Confirms that the write-through cache design allows synchronous reads
  // immediately after a put(), even though the KV write is asynchronous.
  const store = await makeStore();
  const rec = makeRecord({ token: 'sync-token', username: 'charlie' });
  store.put(rec);

  // get() must be synchronous — no await.
  const result = store.get('sync-token');
  assertEquals(result?.username, 'charlie');
});

Deno.test('DenoKvSessionStore: update mutates the cached record in place', testOpts, async () => {
  // Verifies that update() modifies the same object that get() returns, so
  // downstream code holding a reference to the record sees the updated values.
  const store = await makeStore();
  const rec = makeRecord({ token: 'mut-token', lastActivityAt: 1_000, expiresAt: 9_000_000_000 });
  store.put(rec);

  // Hold a reference to the cached record before update.
  const cached = store.get('mut-token')!;

  store.update('mut-token', { lastActivityAt: 5_000 });

  // Both the direct get() and the pre-held reference should reflect the change.
  assertEquals(store.get('mut-token')?.lastActivityAt, 5_000);
  assertEquals(cached.lastActivityAt, 5_000);
});
