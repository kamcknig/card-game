import type { SessionRecord } from './auth-session-service.ts';

/**
 * Pluggable persistence contract for active auth sessions.
 *
 * Implementations must be safe to call from within the single-threaded JS
 * event loop. Expiry enforcement is the responsibility of `AuthSessionService`
 * (not the store), though stores may additionally purge expired entries lazily
 * or on demand via `purgeExpired`.
 *
 * The interface is intentionally synchronous so that the hot-path
 * `validateToken` call (invoked on every socket event) does not need to
 * await a Promise. The Deno KV implementation achieves synchronous reads via
 * a write-through in-memory cache loaded at startup by
 * `DenoKvSessionStore.open()`.
 *
 * Defined in: server/src/core/auth/session-store.ts
 * Consumers: AuthSessionService (injected via constructor, resolved by
 *   register-root-services.ts based on STORAGE_BACKEND env var).
 *   Implementations: DenoKvSessionStore, SupabaseSessionStore, InMemorySessionStore (tests only).
 */
export interface SessionStore {
  /**
   * Returns the session record for the given token, or undefined if not found.
   *
   * Does not check expiry — callers are responsible for expiry logic.
   */
  get(token: string): SessionRecord | undefined;

  /**
   * Inserts or replaces the full session record keyed by its token.
   *
   * Used when a new session is created by `AuthSessionService.login`.
   */
  put(record: SessionRecord): void;

  /**
   * Applies a partial update to an existing session record.
   *
   * Only `lastActivityAt` and `expiresAt` may be patched — these are the
   * fields mutated by the sliding-window TTL logic in `validateToken`.
   * A no-op when the token does not exist in the store.
   */
  update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void;

  /**
   * Removes the session identified by token.
   *
   * A no-op when the token does not exist.
   */
  delete(token: string): void;

  /**
   * Removes all sessions belonging to `username`, optionally skipping one token.
   *
   * Returns the number of sessions removed. Pass `exceptToken` to preserve
   * the caller's own session (used by DELETE /auth/sessions?keepCurrent=true).
   */
  deleteByUsername(username: string, exceptToken?: string): number;

  /**
   * Returns all sessions currently held in the store.
   *
   * Does not filter by expiry — callers perform their own filtering.
   * Used by `AuthSessionService.listSessions` (which applies its own expiry
   * filter) and by the session cleanup service.
   */
  listAll(): ReadonlyArray<SessionRecord>;

  /**
   * Deletes every session whose `expiresAt` timestamp is <= `nowMs`.
   *
   * Returns the number of sessions purged. Used by `AuthSessionCleanupService`
   * to periodically sweep stale rows, particularly important for persistent
   * backends where expired rows would otherwise accumulate on disk.
   */
  purgeExpired(nowMs: number): number;
}
