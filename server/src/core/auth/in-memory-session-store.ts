import type { SessionRecord } from './auth-session-service.ts';
import type { SessionStore } from './session-store.ts';

/**
 * In-memory implementation of `SessionStore`.
 *
 * Uses a plain `Map<string, SessionRecord>` — identical in behavior to the
 * session map that was previously embedded in `AuthSessionService`. This is
 * the default backend used in development and tests. Sessions are lost on
 * server restart because there is no persistence.
 *
 * This implementation is safe to use in the single-threaded Deno event loop
 * with no locking. All operations are O(1) except `deleteByUsername` and
 * `purgeExpired`, which are O(n) in the number of stored sessions.
 *
 * Defined in: server/src/core/auth/in-memory-session-store.ts
 * Consumers: Injected into AuthSessionService via the DI container when
 *   AUTH_SESSION_STORE is unset or 'memory' (see register-root-services.ts).
 */
export class InMemorySessionStore implements SessionStore {
  // Maps auth tokens to their full session records.
  private readonly sessions = new Map<string, SessionRecord>();

  /**
   * Returns the session record for the given token, or undefined if absent.
   *
   * Does not evaluate expiry — callers are responsible for expiry checks.
   */
  public get(token: string): SessionRecord | undefined {
    return this.sessions.get(token);
  }

  /**
   * Inserts or replaces the session record keyed by its token.
   *
   * Existing entries are overwritten without merging; callers supply a
   * complete `SessionRecord`.
   */
  public put(record: SessionRecord): void {
    this.sessions.set(record.token, record);
  }

  /**
   * Patches `lastActivityAt` and/or `expiresAt` on an existing record.
   *
   * A no-op when the token is not present. Mutates the record in place since
   * `SessionRecord` allows these two fields to be mutable.
   */
  public update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void {
    const rec = this.sessions.get(token);
    if (!rec) return;
    if (patch.lastActivityAt !== undefined) rec.lastActivityAt = patch.lastActivityAt;
    if (patch.expiresAt !== undefined) rec.expiresAt = patch.expiresAt;
  }

  /**
   * Removes the session identified by token.
   *
   * A no-op when the token does not exist.
   */
  public delete(token: string): void {
    this.sessions.delete(token);
  }

  /**
   * Removes all sessions for `username`, optionally preserving one token.
   *
   * Returns the count of removed sessions. When `exceptToken` is provided,
   * that specific token's session is left in place (keepCurrent use case).
   */
  public deleteByUsername(username: string, exceptToken?: string): number {
    let removed = 0;
    for (const [token, rec] of this.sessions) {
      if (rec.username === username && token !== exceptToken) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Returns all session records currently held in the map.
   *
   * Returns a snapshot array; the backing map may be mutated concurrently
   * (not an issue in single-threaded JS). Does not filter by expiry.
   */
  public listAll(): ReadonlyArray<SessionRecord> {
    return [...this.sessions.values()];
  }

  /**
   * Removes all sessions whose `expiresAt` is at or before `nowMs`.
   *
   * Returns the count of purged sessions. Used by `AuthSessionCleanupService`
   * to run periodic sweeps.
   */
  public purgeExpired(nowMs: number): number {
    let removed = 0;
    for (const [token, rec] of this.sessions) {
      if (rec.expiresAt <= nowMs) {
        this.sessions.delete(token);
        removed++;
      }
    }
    return removed;
  }
}
