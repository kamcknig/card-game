import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoggerService } from '../logger-service.ts';
import type { PasswordAlgo } from './password-hasher.ts';
import type { UserRecord, UserStore } from './user-store.ts';

/**
 * Shape of a row in the `auth_users` Supabase table.
 *
 * Column names use snake_case to match the SQL schema. The in-memory
 * record uses camelCase; this type is only used when reading from or
 * writing to Supabase.
 */
type DbUserRow = {
  id: number;
  username: string;
  username_lower: string;
  password_hash: string;
  password_algo: PasswordAlgo;
  password_updated_at: number;
  failed_attempts: number;
  locked_until: number | null;
  disabled: boolean;
  is_admin: boolean;
  created_at: number;
  /** Nullable email. Null for users who predate email registration. */
  email: string | null;
  supabase_auth_id: string | null;
};

/**
 * Maps a database row to the in-memory {@link UserRecord} shape.
 */
function rowToRecord(row: DbUserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    passwordHash: row.password_hash,
    passwordAlgo: row.password_algo,
    passwordUpdatedAt: row.password_updated_at,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    disabled: row.disabled,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    supabaseAuthId: row.supabase_auth_id ?? null,
  };
}

/**
 * Supabase-backed implementation of {@link UserStore}.
 *
 * All read operations (`getByUsername`, `getById`, `getByEmail`, `list`) query
 * the `auth_users` table directly on every call — there is no in-memory cache.
 * This eliminates stale-cache bugs when records are modified externally (e.g.
 * via Studio or the CLI) and simplifies the implementation.
 *
 * Write operations (`updatePassword`, `setLockedUntil`, etc.) use targeted
 * `UPDATE` SQL statements so they do not need a prior read. `create()` awaits
 * the INSERT to obtain the DB-assigned `id` from the IDENTITY column. All
 * other write methods fire-and-forget via `.catch()` logging.
 *
 * `open(client)` stores the client reference only — no pre-load SELECT is
 * performed.
 *
 * Defined in: server/src/core/auth/supabase-user-store.ts
 * Consumers: Registered as `userStore` in register-root-services.ts when
 *   STORAGE_BACKEND=supabase. `open()` is called from ServerStartupService.
 */
export class SupabaseUserStore implements UserStore {
  // Shared Supabase client; set in open().
  private client: SupabaseClient | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Stores the Supabase client reference.
   *
   * No longer pre-loads records — reads are live on every call. Must be called
   * once before any store method.
   */
  public open(client: SupabaseClient): void {
    this.client = client;
    this.loggerService.info('[auth users] Supabase store opened (live-read mode)');
  }

  /**
   * Returns the user record matching `username` (case-insensitive) by querying
   * `auth_users WHERE username_lower = $1`.
   */
  public async getByUsername(username: string): Promise<UserRecord | undefined> {
    if (!this.client) return undefined;

    const { data, error } = await this.client
      .from('auth_users')
      .select('*')
      .eq('username_lower', username.toLowerCase())
      .limit(1)
      .single<DbUserRow>();

    if (error) {
      // `PGRST116` is PostgREST's "no rows returned" code — not a real error.
      if (error.code === 'PGRST116') return undefined;
      this.loggerService.warn(`[auth users] getByUsername failed for '${username}': ${error.message} (code=${error.code})`);
      return undefined;
    }

    return data ? rowToRecord(data) : undefined;
  }

  /**
   * Returns the user record for the given numeric id by querying
   * `auth_users WHERE id = $1`.
   */
  public async getById(id: number): Promise<UserRecord | undefined> {
    if (!this.client) return undefined;

    const { data, error } = await this.client
      .from('auth_users')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single<DbUserRow>();

    if (error) {
      if (error.code === 'PGRST116') return undefined;
      this.loggerService.warn(`[auth users] getById failed for id=${id}: ${error.message}`);
      return undefined;
    }

    return data ? rowToRecord(data) : undefined;
  }

  /**
   * Returns the user record whose email matches the given address (case-
   * insensitive) by querying `auth_users WHERE lower(email) = lower($1)`.
   *
   * Returns undefined when no match is found.
   */
  public async getByEmail(email: string): Promise<UserRecord | undefined> {
    if (!this.client) return undefined;

    const { data, error } = await this.client
      .from('auth_users')
      .select('*')
      .ilike('email', email)
      .limit(1)
      .single<DbUserRow>();

    if (error) {
      if (error.code === 'PGRST116') return undefined;
      this.loggerService.warn(`[auth users] getByEmail failed for '${email}': ${error.message}`);
      return undefined;
    }

    return data ? rowToRecord(data) : undefined;
  }

  /**
   * Inserts a new user row and returns the DB-assigned record (with id).
   *
   * Awaits the INSERT so the DB-assigned `id` is available to callers. Throws
   * when a user with the same (lowercased) username already exists. Throws when
   * `email` is provided and is already taken by another user.
   */
  public async create(args: {
    username: string;
    email?: string | null;
    passwordHash: string;
    passwordAlgo: 'argon2id';
    now: number;
    supabaseAuthId?: string | null;
  }): Promise<UserRecord> {
    if (!this.client) {
      throw new Error('[auth users] store not opened — call open(client) first');
    }

    const emailNorm = args.email ? args.email.toLowerCase() : null;
    const key = args.username.toLowerCase();

    const insertRow = {
      username: args.username,
      username_lower: key,
      password_hash: args.passwordHash,
      password_algo: args.passwordAlgo,
      password_updated_at: args.now,
      failed_attempts: 0,
      locked_until: null,
      disabled: false,
      is_admin: false,
      created_at: args.now,
      email: emailNorm,
      supabase_auth_id: args.supabaseAuthId ?? null,
    };

    // Await the INSERT to obtain the DB-assigned id from the IDENTITY column.
    const { data, error } = await this.client
      .from('auth_users')
      .insert(insertRow)
      .select()
      .single<DbUserRow>();

    if (error || !data) {
      throw new Error(`[auth users] create failed for '${args.username}': ${error?.message ?? 'no data returned'}`);
    }

    const rec = rowToRecord(data);
    this.loggerService.debug(`[auth users] created user '${args.username}' with id ${rec.id}`);
    return rec;
  }

  /**
   * Replaces a user's password hash and clears any pending lockout state.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget).
   */
  public updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void {
    this.client
      ?.from('auth_users')
      .update({
        password_hash: passwordHash,
        password_algo: algo,
        password_updated_at: now,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] updatePassword failed for id=${id}: ${error.message}`);
        }
      });
  }

  /**
   * Increments the per-account failure counter and returns the updated record.
   *
   * Uses a targeted `UPDATE ... RETURNING *` so a prior read is not required.
   * Throws when the user is not found.
   */
  public async recordFailure(id: number, _now: number): Promise<UserRecord> {
    if (!this.client) {
      throw new Error('[auth users] store not opened — call open(client) first');
    }

    // Supabase JS does not support UPDATE ... RETURNING with an arithmetic
    // expression directly, so we first fetch the current failedAttempts, then
    // update. The window for a race is acceptable in a single-process model.
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`[auth users] recordFailure: unknown id ${id}`);
    }

    const newCount = current.failedAttempts + 1;

    this.client
      .from('auth_users')
      .update({ failed_attempts: newCount })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] recordFailure update failed for id=${id}: ${error.message}`);
        }
      });

    return { ...current, failedAttempts: newCount };
  }

  /**
   * Resets `failedAttempts` and `lockedUntil` to their initial values.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget).
   */
  public resetFailures(id: number): void {
    this.client
      ?.from('auth_users')
      .update({ failed_attempts: 0, locked_until: null })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] resetFailures failed for id=${id}: ${error.message}`);
        }
      });
  }

  /**
   * Sets or clears the lockout expiry timestamp.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget).
   */
  public setLockedUntil(id: number, until: number | null): void {
    this.client
      ?.from('auth_users')
      .update({ locked_until: until })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] setLockedUntil failed for id=${id}: ${error.message}`);
        }
      });
  }

  /**
   * Toggles the `disabled` flag for the given user.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget).
   */
  public setDisabled(id: number, disabled: boolean): void {
    this.client
      ?.from('auth_users')
      .update({ disabled })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] setDisabled failed for id=${id}: ${error.message}`);
        }
      });
  }

  /**
   * Sets or clears the `is_admin` flag for the given user.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget).
   */
  public setAdmin(id: number, isAdmin: boolean): void {
    this.client
      ?.from('auth_users')
      .update({ is_admin: isAdmin })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] setAdmin failed for id=${id}: ${error.message}`);
        }
      });
  }

  /**
   * Sets the email address for an existing user.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget). The
   * DB-level partial unique index on `lower(email)` enforces uniqueness so a
   * duplicate email at the DB level surfaces as a constraint violation on the
   * update.
   *
   * Callers should only invoke this when the existing email is null — email
   * changes are out of scope for this plan.
   */
  public setEmail(id: number, email: string, _now: number): void {
    const emailNorm = email.toLowerCase();

    this.client
      ?.from('auth_users')
      .update({ email: emailNorm })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] setEmail failed for id=${id}: ${error.message}`);
        } else {
          this.loggerService.debug(`[auth users] set email for id=${id}`);
        }
      });
  }

  /**
   * Sets or clears the `supabase_auth_id` for an existing user.
   *
   * Fires an async targeted UPDATE in the background (fire-and-forget).
   */
  public setSupabaseAuthId(id: number, authId: string | null): void {
    this.client
      ?.from('auth_users')
      .update({ supabase_auth_id: authId })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] setSupabaseAuthId failed for id=${id}: ${error.message}`);
        } else {
          this.loggerService.debug(`[auth users] set supabaseAuthId for id=${id}: ${authId ?? 'null'}`);
        }
      });
  }

  /**
   * Removes the user record for the given id from the Supabase table.
   *
   * Fires an async targeted DELETE in the background (fire-and-forget).
   * No-ops silently when the id is not found. Intended for CLI/admin use.
   */
  public delete(id: number): void {
    this.client
      ?.from('auth_users')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] delete failed for id=${id}: ${error.message}`);
        }
      });
  }

  /**
   * Removes every user record from the Supabase table.
   *
   * The id sequence is preserved in the DB via the IDENTITY column so subsequent
   * creates do not reuse previously issued ids. Fires a DELETE in the background.
   * Intended for CLI/admin use.
   */
  public clear(): void {
    this.client
      ?.from('auth_users')
      .delete()
      .neq('id', 0)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] clear failed: ${error.message}`);
        } else {
          this.loggerService.info('[auth users] cleared all user records from Supabase');
        }
      });
  }

  /**
   * Returns a snapshot of every user record by querying `SELECT * FROM auth_users`.
   *
   * Intended for CLI/admin use; the route handlers never expose the full list
   * to end users.
   */
  public async list(): Promise<ReadonlyArray<UserRecord>> {
    if (!this.client) return [];

    const { data, error } = await this.client.from('auth_users').select('*');
    if (error) {
      this.loggerService.warn(`[auth users] list failed: ${error.message}`);
      return [];
    }

    return ((data ?? []) as DbUserRow[]).map(rowToRecord);
  }
}
