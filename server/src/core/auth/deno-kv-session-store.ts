import type { SessionRecord } from './auth-session-service.ts';
import type { LoggerService } from '../logger-service.ts';
import type { SessionStore } from './session-store.ts';

/**
 * Key prefix for all auth session entries in the KV store.
 *
 * All session keys have the form `['auth_sessions', token]`.
 */
const KEY_PREFIX = 'auth_sessions';

/**
 * Deno KV-backed implementation of `SessionStore`.
 *
 * Uses a write-through in-memory cache so that all reads are synchronous —
 * the `SessionStore` interface is fully synchronous, which keeps the hot-path
 * `validateToken` call (invoked on every socket event) off the async/await
 * path. Persistence is achieved by writing each mutation to KV in the
 * background (fire-and-forget); on server restart `open()` reloads all
 * non-expired sessions from KV into the cache.
 *
 * Write-through design:
 * - Reads (`get`, `listAll`) always hit the in-memory cache — O(1) / O(n).
 * - Writes (`put`, `update`, `delete`, `deleteByUsername`, `purgeExpired`)
 *   update the cache immediately and fire an async KV write without awaiting.
 *   Errors are logged but do not propagate to callers.
 * - On startup, `open(path, nowMs)` loads KV into the cache and must complete
 *   before the HTTP server starts accepting connections.
 *
 * Expiry: Each KV entry is stored with an `expireIn` option so the KV layer
 * independently evicts entries after their session TTL — this prevents
 * unbounded KV growth even if a crash prevents explicit deletes.
 *
 * Requires: `--unstable-kv` flag at runtime and in test tasks (deno.json).
 *
 * Defined in: server/src/core/auth/deno-kv-session-store.ts
 * Consumers: Injected into AuthSessionService via the DI container when
 *   AUTH_SESSION_STORE=kv (see register-root-services.ts).
 *   `open()` must be called from ServerStartupService before the HTTP server
 *   begins accepting connections.
 */
export class DenoKvSessionStore implements SessionStore {
  // Write-through in-memory cache — all synchronous reads go here.
  private readonly cache = new Map<string, SessionRecord>();

  // Underlying Deno KV store; undefined until open() completes.
  private kv: Deno.Kv | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Opens the Deno KV store at `path` and loads all non-expired sessions into
   * the in-memory cache.
   *
   * Must be called once during server startup (e.g., from
   * `ServerStartupService.start()`) before the HTTP server accepts connections.
   * After this call completes, all synchronous `SessionStore` methods are safe
   * to call.
   *
   * @param path  Path to the KV store file, or `':memory:'` for an
   *   in-process store (useful in tests and dev environments without
   *   persistent storage requirements).
   * @param nowMs Current time in milliseconds, used to filter out sessions
   *   that have already expired in KV at load time.
   */
  public async open(path: string, nowMs: number): Promise<void> {
    this.kv = await Deno.openKv(path);

    let loaded = 0;
    let skipped = 0;

    for await (const entry of this.kv.list<SessionRecord>({ prefix: [KEY_PREFIX] })) {
      const rec = entry.value;
      // Skip entries that have expired since they were written.
      if (rec.expiresAt > nowMs) {
        this.cache.set(rec.token, rec);
        loaded++;
      } else {
        // Explicitly delete the expired entry from KV; it may have missed
        // the native KV expiry window due to clock skew or crashes.
        this.kv.delete(entry.key).catch((err: unknown) => {
          this.loggerService.warn(`[auth kv] failed to delete expired entry during load: ${err}`);
        });
        skipped++;
      }
    }

    this.loggerService.info(
      `[auth kv] loaded ${loaded} session(s) from KV store (skipped ${skipped} expired)`,
    );
  }

  /**
   * Returns the session record for the given token, or undefined if absent.
   *
   * Reads from the in-memory cache — synchronous and fast. Does not evaluate
   * expiry; callers are responsible for expiry checks.
   */
  public get(token: string): SessionRecord | undefined {
    return this.cache.get(token);
  }

  /**
   * Inserts or replaces the full session record in both cache and KV.
   *
   * Updates the cache synchronously. The KV write is fire-and-forget; errors
   * are logged without propagating to callers. The KV entry is stored with
   * `expireIn` so the KV layer independently evicts it after the session TTL.
   */
  public put(record: SessionRecord): void {
    this.cache.set(record.token, record);

    const expireIn = record.expiresAt - Date.now();
    // Only set expireIn if it is a positive value; KV rejects zero/negative.
    const options = expireIn > 0 ? { expireIn } : undefined;

    this.kv?.set([KEY_PREFIX, record.token], record, options).catch((err: unknown) => {
      this.loggerService.warn(`[auth kv] put failed for token ...${record.token.slice(-6)}: ${err}`);
    });
  }

  /**
   * Patches `lastActivityAt` and/or `expiresAt` on an existing record.
   *
   * Mutates the cached record in place, then fires an async KV write to keep
   * the backing store current. A no-op when the token is not in the cache.
   */
  public update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void {
    const rec = this.cache.get(token);
    if (!rec) return;

    if (patch.lastActivityAt !== undefined) rec.lastActivityAt = patch.lastActivityAt;
    if (patch.expiresAt !== undefined) rec.expiresAt = patch.expiresAt;

    const expireIn = rec.expiresAt - Date.now();
    const options = expireIn > 0 ? { expireIn } : undefined;

    this.kv?.set([KEY_PREFIX, token], rec, options).catch((err: unknown) => {
      this.loggerService.warn(`[auth kv] update failed for token ...${token.slice(-6)}: ${err}`);
    });
  }

  /**
   * Removes the session identified by token from both cache and KV.
   *
   * A no-op when the token is not present. The KV delete is fire-and-forget.
   */
  public delete(token: string): void {
    this.cache.delete(token);

    this.kv?.delete([KEY_PREFIX, token]).catch((err: unknown) => {
      this.loggerService.warn(`[auth kv] delete failed for token ...${token.slice(-6)}: ${err}`);
    });
  }

  /**
   * Removes all sessions for `username` from cache and KV, optionally
   * preserving one token.
   *
   * Returns the count of removed sessions. When `exceptToken` is provided,
   * that session is left in place (keepCurrent use case). KV deletes are
   * fire-and-forget.
   */
  public deleteByUsername(username: string, exceptToken?: string): number {
    let removed = 0;

    for (const [token, rec] of this.cache) {
      if (rec.username !== username || token === exceptToken) continue;

      this.cache.delete(token);
      this.kv?.delete([KEY_PREFIX, token]).catch((err: unknown) => {
        this.loggerService.warn(`[auth kv] deleteByUsername failed for token ...${token.slice(-6)}: ${err}`);
      });
      removed++;
    }

    return removed;
  }

  /**
   * Returns all session records currently held in the in-memory cache.
   *
   * Does not filter by expiry — callers perform their own filtering.
   * Returns a snapshot array; the cache may be mutated after this call.
   */
  public listAll(): ReadonlyArray<SessionRecord> {
    return [...this.cache.values()];
  }

  /**
   * Removes all sessions whose `expiresAt` is at or before `nowMs` from both
   * cache and KV.
   *
   * Returns the count of sessions purged. Used by `AuthSessionCleanupService`
   * for periodic sweeps. KV deletes are fire-and-forget.
   */
  public purgeExpired(nowMs: number): number {
    let removed = 0;

    for (const [token, rec] of this.cache) {
      if (rec.expiresAt > nowMs) continue;

      this.cache.delete(token);
      // KV entries self-expire via expireIn, but explicit delete keeps KV tidy.
      this.kv?.delete([KEY_PREFIX, token]).catch((err: unknown) => {
        this.loggerService.warn(`[auth kv] purgeExpired delete failed for token ...${token.slice(-6)}: ${err}`);
      });
      removed++;
    }

    return removed;
  }

  /**
   * Closes the underlying Deno KV store.
   *
   * Should be called on server shutdown. After this, any pending fire-and-
   * forget KV writes will fail silently (errors are logged, not thrown).
   * Subsequent reads still work against the in-memory cache; subsequent writes
   * will only update the cache (no KV persistence).
   */
  public close(): void {
    this.kv?.close();
    this.kv = undefined;
  }
}
