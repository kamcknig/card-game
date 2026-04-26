import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoggerService } from '../logger-service.ts';
import type { PasswordAlgo } from './password-hasher.ts';
import type { UserRecord, UserStore } from './user-store.ts';

/**
 * Shape of a row in the `auth_users` Supabase table.
 *
 * Column names use snake_case to match the SQL schema. The in-memory
 * cache stores plain `UserRecord` objects (camelCase); this type is only
 * used when reading from or writing to Supabase.
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
 * Maps an in-memory {@link UserRecord} to a partial DB row suitable for
 * upsert operations (excludes `id` and identity columns).
 *
 * Only the mutable columns are included; `username`, `username_lower`, and
 * `created_at` are set at insert time and never changed.
 */
function recordToMutableRow(rec: UserRecord): Omit<DbUserRow, 'id'> {
  return {
    username: rec.username,
    username_lower: rec.username.toLowerCase(),
    password_hash: rec.passwordHash,
    password_algo: rec.passwordAlgo,
    password_updated_at: rec.passwordUpdatedAt,
    failed_attempts: rec.failedAttempts,
    locked_until: rec.lockedUntil,
    disabled: rec.disabled,
    is_admin: rec.isAdmin,
    created_at: rec.createdAt,
    email: rec.email,
    supabase_auth_id: rec.supabaseAuthId,
  };
}

/**
 * Supabase-backed implementation of {@link UserStore}.
 *
 * Uses the same write-through cache pattern as {@link DenoKvUserStore}: all
 * reads are served from a synchronous in-memory `Map`, while mutations update
 * the cache immediately and fire async Supabase writes in the background (
 * fire-and-forget with `.catch()` logging).
 *
 * The `create()` method is the exception — it is asynchronous because the DB
 * assigns the `id` via an IDENTITY column. The INSERT is awaited so callers
 * learn the real id before returning.
 *
 * The cache is primed in `open()` by selecting all rows from `auth_users`. This
 * must complete before the HTTP server starts accepting connections.
 *
 * Defined in: server/src/core/auth/supabase-user-store.ts
 * Consumers: Registered as `userStore` in register-root-services.ts when
 *   STORAGE_BACKEND=supabase. `open()` is called from ServerStartupService.
 */
export class SupabaseUserStore implements UserStore {
  // Write-through cache keyed by lowercased username.
  private readonly byUsername = new Map<string, UserRecord>();

  // Secondary index for O(1) id-based lookups.
  private readonly byId = new Map<number, UserRecord>();

  // Secondary index keyed by lowercased email. Only populated for rows with
  // a non-null email value.
  private readonly byEmail = new Map<string, UserRecord>();

  // Shared Supabase client; set in open().
  private client: SupabaseClient | undefined;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Loads all user rows from the `auth_users` table into the in-memory cache.
   *
   * Must be called once before any synchronous store method. Accepts the
   * shared Supabase client from {@link SupabaseClientProvider}.
   */
  public async open(client: SupabaseClient): Promise<void> {
    this.client = client;

    const { data, error } = await this.client.from('auth_users').select('*');
    if (error) {
      throw new Error(`[auth users] failed to load from Supabase: ${error.message}`);
    }

    let loaded = 0;
    for (const row of (data ?? []) as DbUserRow[]) {
      const rec = rowToRecord(row);
      this.byUsername.set(rec.username.toLowerCase(), rec);
      this.byId.set(rec.id, rec);
      // Populate the email index for rows that already have an email.
      if (rec.email) this.byEmail.set(rec.email.toLowerCase(), rec);
      loaded++;
    }

    this.loggerService.info(`[auth users] loaded ${loaded} user(s) from Supabase`);
  }

  /**
   * Returns the user record matching `username` (case-insensitive).
   */
  public getByUsername(username: string): UserRecord | undefined {
    return this.byUsername.get(username.toLowerCase());
  }

  /**
   * Returns the user record for the given numeric id.
   */
  public getById(id: number): UserRecord | undefined {
    return this.byId.get(id);
  }

  /**
   * Returns the user record whose email matches the given address (case-
   * insensitive), or undefined when no match is found.
   */
  public getByEmail(email: string): UserRecord | undefined {
    return this.byEmail.get(email.toLowerCase());
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
    const key = args.username.toLowerCase();
    if (this.byUsername.has(key)) {
      throw new Error(`[auth users] username already exists: '${args.username}'`);
    }

    // Reject duplicate email up front (case-insensitive).
    const emailNorm = args.email ? args.email.toLowerCase() : null;
    if (emailNorm && this.byEmail.has(emailNorm)) {
      throw new Error(`[auth users] email already exists: '${args.email}'`);
    }

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

    if (!this.client) {
      throw new Error('[auth users] store not opened — call open(client) first');
    }

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
    this.byUsername.set(key, rec);
    this.byId.set(rec.id, rec);
    if (emailNorm) this.byEmail.set(emailNorm, rec);

    this.loggerService.debug(`[auth users] created user '${args.username}' with id ${rec.id}`);
    return rec;
  }

  /**
   * Replaces a user's password hash and clears any pending lockout state.
   *
   * Mutates the cached record in place and fires an async Supabase upsert.
   */
  public updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.passwordHash = passwordHash;
    rec.passwordAlgo = algo;
    rec.passwordUpdatedAt = now;
    rec.failedAttempts = 0;
    rec.lockedUntil = null;

    this.persist(rec);
  }

  /**
   * Increments the per-account failure counter and returns the updated record.
   */
  public recordFailure(id: number, _now: number): UserRecord {
    const rec = this.byId.get(id);
    if (!rec) {
      throw new Error(`[auth users] recordFailure: unknown id ${id}`);
    }

    rec.failedAttempts++;
    this.persist(rec);
    return rec;
  }

  /**
   * Resets failedAttempts and lockedUntil to their initial values.
   */
  public resetFailures(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    if (rec.failedAttempts === 0 && rec.lockedUntil === null) {
      // Avoid a pointless DB write when nothing changed.
      return;
    }

    rec.failedAttempts = 0;
    rec.lockedUntil = null;
    this.persist(rec);
  }

  /**
   * Sets or clears the lockout expiry timestamp.
   */
  public setLockedUntil(id: number, until: number | null): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.lockedUntil = until;
    this.persist(rec);
  }

  /**
   * Toggles the disabled flag for the given user.
   */
  public setDisabled(id: number, disabled: boolean): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.disabled = disabled;
    this.persist(rec);
  }

  /**
   * Sets or clears the admin flag for the given user.
   */
  public setAdmin(id: number, isAdmin: boolean): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.isAdmin = isAdmin;
    this.persist(rec);
  }

  /**
   * Sets the email for an existing user and updates the byEmail index.
   *
   * Throws when the email is already taken by a different user (case-
   * insensitive). Fires an async Supabase update in the background.
   */
  public setEmail(id: number, email: string, _now: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    const emailNorm = email.toLowerCase();
    const existing = this.byEmail.get(emailNorm);
    if (existing && existing.id !== id) {
      throw new Error(`[auth users] setEmail: email already taken: '${email}'`);
    }

    // Remove the old email from the index when the record previously had one.
    if (rec.email) this.byEmail.delete(rec.email.toLowerCase());

    rec.email = emailNorm;
    this.byEmail.set(emailNorm, rec);
    this.persist(rec);

    this.loggerService.debug(`[auth users] set email for id=${id}`);
  }

  /**
   * Sets or clears the Supabase Auth user id for an existing user.
   *
   * Mutates the cached record and fires a background Supabase upsert.
   */
  public setSupabaseAuthId(id: number, authId: string | null): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.supabaseAuthId = authId;
    this.persist(rec);

    this.loggerService.debug(`[auth users] set supabaseAuthId for id=${id}: ${authId ?? 'null'}`);
  }

  /**
   * Removes the user record for the given id from all in-memory caches and
   * the Supabase table.
   *
   * No-ops silently when the id is not found.
   */
  public delete(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    const key = rec.username.toLowerCase();
    this.byId.delete(id);
    this.byUsername.delete(key);
    if (rec.email) this.byEmail.delete(rec.email.toLowerCase());

    this.client
      ?.from('auth_users')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] delete failed for '${rec.username}' (id ${id}): ${error.message}`);
        }
      });
  }

  /**
   * Removes every user record from all in-memory caches and the Supabase table.
   *
   * The id sequence is preserved in the DB via the IDENTITY column so subsequent
   * creates do not reuse previously issued ids. Intended for CLI/admin use.
   */
  public clear(): void {
    const count = this.byUsername.size;
    this.byUsername.clear();
    this.byId.clear();
    this.byEmail.clear();

    // DELETE with a always-true filter clears all rows.
    this.client
      ?.from('auth_users')
      .delete()
      .neq('id', 0)
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] clear failed: ${error.message}`);
        }
      });

    this.loggerService.info(`[auth users] cleared ${count} user(s) from store`);
  }

  /**
   * Returns a snapshot of every user record currently in memory.
   */
  public list(): ReadonlyArray<UserRecord> {
    return [...this.byUsername.values()];
  }

  /**
   * Upserts the current in-memory record back to the Supabase table in the
   * background.
   *
   * Mutations happen on the cached object in place before this is called; this
   * method echoes the updated state to the DB. Errors are logged but do not
   * propagate. The upsert includes `email` and `supabase_auth_id` so all
   * mutable columns stay in sync.
   */
  private persist(rec: UserRecord): void {
    const row = { id: rec.id, ...recordToMutableRow(rec) };
    this.client
      ?.from('auth_users')
      .upsert(row, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) {
          this.loggerService.warn(`[auth users] persist failed for '${rec.username}': ${error.message}`);
        }
      });
  }
}
