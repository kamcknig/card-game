import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionRecord } from './auth-session-service.ts';
import type { LoggerService } from '../logger-service.ts';
import type { SessionStore } from './session-store.ts';

/**
 * Shape of a row in the `auth_sessions` Supabase table.
 *
 * Column names use snake_case to match the SQL schema.
 */
type DbSessionRow = {
  token: string;
  username: string;
  provider_name: string;
  created_at: number;
  last_activity_at: number;
  expires_at: number;
  created_from_ip: string | null;
  created_from_user_agent: string | null;
};

/**
 * Maps a database row to the in-memory {@link SessionRecord} shape.
 */
function rowToRecord(row: DbSessionRow): SessionRecord {
  return {
    token: row.token,
    username: row.username,
    providerName: row.provider_name,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    createdFromIp: row.created_from_ip ?? undefined,
    createdFromUserAgent: row.created_from_user_agent ?? undefined,
  };
}

/**
 * Maps an in-memory {@link SessionRecord} to a DB row for insert/upsert.
 */
function recordToRow(rec: SessionRecord): DbSessionRow {
  return {
    token: rec.token,
    username: rec.username,
    provider_name: rec.providerName,
    created_at: rec.createdAt,
    last_activity_at: rec.lastActivityAt,
    expires_at: rec.expiresAt,
    created_from_ip: rec.createdFromIp ?? null,
    created_from_user_agent: rec.createdFromUserAgent ?? null,
  };
}

/**
 * Supabase-backed implementation of {@link SessionStore}.
 *
 * Uses a write-through cache pattern: all reads are served from a synchronous
 * in-memory `Map`; mutations update the cache immediately and fire async
 * Supabase writes in the background.
 *
 * `open()` loads only non-expired sessions (`expires_at > nowMs`) so the cache
 * starts clean without stale rows. `purgeExpired()` deletes rows from both the
 * cache and the DB.
 *
 * Defined in: server/src/core/auth/supabase-session-store.ts
 * Consumers: Registered as `sessionStore` in register-root-services.ts when
 *   STORAGE_BACKEND=supabase. `open()` is called from ServerStartupService.
 */
export class SupabaseSessionStore implements SessionStore {
  // Write-through in-memory cache — all synchronous reads go here.
  private readonly cache = new Map<string, SessionRecord>();

  // Shared Supabase client; set in open().
  private client: SupabaseClient | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Loads all non-expired sessions from the `auth_sessions` table.
   *
   * Rows with `expires_at <= nowMs` are ignored — they are stale and will be
   * cleaned up on the next `purgeExpired()` call. Must be called once during
   * server startup before the HTTP server accepts connections.
   */
  public async open(client: SupabaseClient, nowMs: number): Promise<void> {
    this.client = client;

    const { data, error } = await this.client
      .from('auth_sessions')
      .select('*')
      .gt('expires_at', nowMs);

    if (error) {
      throw new Error(`[auth sessions] failed to load from Supabase: ${error.message}`);
    }

    let loaded = 0;
    for (const row of (data ?? []) as DbSessionRow[]) {
      const rec = rowToRecord(row);
      this.cache.set(rec.token, rec);
      loaded++;
    }

    this.loggerService.info(`[auth sessions] loaded ${loaded} non-expired session(s) from Supabase`);
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
   * Inserts or replaces the full session record in both cache and DB.
   *
   * Updates the cache synchronously. The DB write is fire-and-forget.
   */
  public put(record: SessionRecord): void {
    this.cache.set(record.token, record);

    this.client
      ?.from('auth_sessions')
      .upsert(recordToRow(record), { onConflict: 'token' })
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth sessions] put failed for token ...${record.token.slice(-6)}: ${error.message}`);
        }
      });
  }

  /**
   * Patches `lastActivityAt` and/or `expiresAt` on an existing record.
   *
   * Mutates the cached record in place, then fires an async DB update. A
   * no-op when the token is not in the cache.
   */
  public update(token: string, patch: Partial<Pick<SessionRecord, 'lastActivityAt' | 'expiresAt'>>): void {
    const rec = this.cache.get(token);
    if (!rec) return;

    if (patch.lastActivityAt !== undefined) rec.lastActivityAt = patch.lastActivityAt;
    if (patch.expiresAt !== undefined) rec.expiresAt = patch.expiresAt;

    const dbPatch: Partial<Pick<DbSessionRow, 'last_activity_at' | 'expires_at'>> = {};
    if (patch.lastActivityAt !== undefined) dbPatch.last_activity_at = patch.lastActivityAt;
    if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt;

    this.client
      ?.from('auth_sessions')
      .update(dbPatch)
      .eq('token', token)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth sessions] update failed for token ...${token.slice(-6)}: ${error.message}`);
        }
      });
  }

  /**
   * Removes the session identified by token from both cache and DB.
   *
   * A no-op when the token is not present. The DB delete is fire-and-forget.
   */
  public delete(token: string): void {
    this.cache.delete(token);

    this.client
      ?.from('auth_sessions')
      .delete()
      .eq('token', token)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth sessions] delete failed for token ...${token.slice(-6)}: ${error.message}`);
        }
      });
  }

  /**
   * Removes all sessions for `username` from cache and DB, optionally
   * preserving one token.
   *
   * Returns the count of removed sessions. DB deletes are fire-and-forget.
   */
  public deleteByUsername(username: string, exceptToken?: string): number {
    const toDelete: string[] = [];

    for (const [token, rec] of this.cache) {
      if (rec.username !== username || token === exceptToken) continue;
      toDelete.push(token);
    }

    for (const token of toDelete) {
      this.cache.delete(token);
    }

    if (toDelete.length > 0) {
      // Build a filter that excludes `exceptToken` when provided.
      let query = this.client?.from('auth_sessions').delete().eq('username', username);
      if (exceptToken) {
        query = query?.neq('token', exceptToken);
      }
      query?.then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth sessions] deleteByUsername failed for '${username}': ${error.message}`);
        }
      });
    }

    return toDelete.length;
  }

  /**
   * Returns all session records currently held in the in-memory cache.
   *
   * Does not filter by expiry — callers perform their own filtering.
   */
  public listAll(): ReadonlyArray<SessionRecord> {
    return [...this.cache.values()];
  }

  /**
   * Removes all sessions whose `expiresAt` is at or before `nowMs` from both
   * cache and DB.
   *
   * Returns the count of sessions purged. The DB delete uses a server-side
   * filter to clean rows that may not have been loaded into the cache.
   */
  public purgeExpired(nowMs: number): number {
    let removed = 0;

    for (const [token, rec] of this.cache) {
      if (rec.expiresAt > nowMs) continue;
      this.cache.delete(token);
      removed++;
    }

    // Delete all expired rows from DB in one round-trip, including any that
    // were not in the cache (e.g., loaded by a previous process instance).
    this.client
      ?.from('auth_sessions')
      .delete()
      .lte('expires_at', nowMs)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth sessions] purgeExpired DB delete failed: ${error.message}`);
        }
      });

    if (removed > 0) {
      this.loggerService.debug(`[auth sessions] purged ${removed} expired session(s) from cache`);
    }

    return removed;
  }
}
