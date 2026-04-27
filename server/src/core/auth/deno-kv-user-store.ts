import type { LoggerService } from '../logger-service.ts';
import type { UserRecord, UserStore } from './user-store.ts';
import type { PasswordAlgo } from './password-hasher.ts';

/**
 * KV key prefix for user records keyed by lowercased username.
 *
 * Full keys: `['user:by-username', usernameLower]`.
 */
const KEY_BY_USERNAME = 'user:by-username';

/**
 * KV key prefix for user records keyed by numeric id.
 *
 * Full keys: `['user:by-id', id]`.
 */
const KEY_BY_ID = 'user:by-id';

/**
 * KV key prefix for user records keyed by lowercased email.
 *
 * Only written for users who have a non-null email. Full keys:
 * `['user:by-email', emailLower]`.
 */
const KEY_BY_EMAIL = 'user:by-email';

/**
 * KV key for the monotonic id counter.
 *
 * Full key: `['auth_users_id_seq']`. Holds the last issued numeric id.
 * Incremented atomically inside `create()`.
 */
const KEY_ID_SEQ = 'auth_users_id_seq';

/**
 * Deno KV-backed implementation of {@link UserStore}.
 *
 * Shares the same KV database as {@link DenoKvSessionStore} and
 * {@link DenoKvRegistrationCodeStore} (AUTH_KV_PATH) to keep auth state in
 * one file.
 *
 * All read operations (`getByUsername`, `getById`, `getByEmail`, `list`)
 * query the KV store directly on every call — there is no in-memory cache.
 * This eliminates stale-cache bugs when records are modified externally
 * (e.g. via the CLI) and simplifies the implementation.
 *
 * Three KV secondary indexes are maintained to support O(1) lookups by
 * username, id, and email:
 *  - `['user:by-username', usernameLower]` → UserRecord (primary key)
 *  - `['user:by-id', id]`                 → UserRecord (secondary index)
 *  - `['user:by-email', emailLower]`       → UserRecord (secondary index;
 *                                             only for rows with non-null email)
 *
 * All three keys are written on `create()` / `setEmail()`, and removed on
 * `delete()` / `clear()`. The `persist()` helper writes all three keys for a
 * record so mutations stay in sync.
 *
 * The monotonic id counter is loaded from KV (or initialised to zero) on
 * `open()`. New ids are assigned locally by incrementing `nextId` in memory,
 * then persisted via a best-effort KV write.
 *
 * Defined in: server/src/core/auth/deno-kv-user-store.ts
 * Consumers: Registered as `userStore` in register-root-services.ts.
 *   Opened from ServerStartupService before the HTTP server accepts connections.
 */
export class DenoKvUserStore implements UserStore {
  // Shared KV handle, supplied by AuthKvProvider via open().
  private kv: Deno.Kv | undefined;

  // Next id to issue. Seeded from KEY_ID_SEQ in open(); incremented in create().
  private nextId = 1;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Stores the KV handle and loads the monotonic id sequence counter.
   *
   * No longer pre-loads records into memory — reads are live on every call.
   * Must be called once before any store method. Accepts either a pre-opened
   * `Deno.Kv` handle (shared with the other auth stores) or a path string
   * (for tests / standalone CLI use).
   */
  public async open(pathOrKv: string | Deno.Kv): Promise<void> {
    this.kv = typeof pathOrKv === 'string' ? await Deno.openKv(pathOrKv) : pathOrKv;

    // Pull the persisted id sequence so nextId survives process restarts even
    // if the highest-id row was deleted.
    const seqEntry = await this.kv.get<number>([KEY_ID_SEQ]);
    if (typeof seqEntry.value === 'number') {
      this.nextId = seqEntry.value + 1;
    }

    this.loggerService.info(`[auth users] KV store opened (next id: ${this.nextId})`);
  }

  /**
   * Returns the user record matching `username` (case-insensitive) by reading
   * the `user:by-username` KV key directly.
   *
   * Does not check `disabled` — authentication providers handle that so the
   * store remains purely a persistence concern.
   */
  public async getByUsername(username: string): Promise<UserRecord | undefined> {
    if (!this.kv) return undefined;
    const entry = await this.kv.get<UserRecord>([KEY_BY_USERNAME, username.toLowerCase()]);
    return entry.value ?? undefined;
  }

  /**
   * Returns the user record for the given numeric id by reading the
   * `user:by-id` KV key directly.
   */
  public async getById(id: number): Promise<UserRecord | undefined> {
    if (!this.kv) return undefined;
    const entry = await this.kv.get<UserRecord>([KEY_BY_ID, id]);
    return entry.value ?? undefined;
  }

  /**
   * Returns the user record whose email matches the given address (case-
   * insensitive) by reading the `user:by-email` KV key directly.
   *
   * Returns undefined when no match is found or when the KV handle is not open.
   */
  public async getByEmail(email: string): Promise<UserRecord | undefined> {
    if (!this.kv) return undefined;
    const entry = await this.kv.get<UserRecord>([KEY_BY_EMAIL, email.toLowerCase()]);
    return entry.value ?? undefined;
  }

  /**
   * Creates a new user row and persists it to all three KV indexes.
   *
   * Throws when a user with the same (lowercased) username already exists.
   * Throws when `email` is provided and is already taken by another user
   * (case-insensitive comparison).
   * Returns a resolved `Promise<UserRecord>` to satisfy the {@link UserStore}
   * interface.
   */
  public async create(args: {
    username: string;
    email?: string | null;
    passwordHash: string;
    passwordAlgo: 'argon2id';
    now: number;
    supabaseAuthId?: string | null;
  }): Promise<UserRecord> {
    // Live duplicate-username check before writing.
    const existing = await this.getByUsername(args.username);
    if (existing) {
      throw new Error(`[auth users] username already exists: '${args.username}'`);
    }

    // Live duplicate-email check (case-insensitive).
    const emailNorm = args.email ? args.email.toLowerCase() : null;
    if (emailNorm) {
      const emailConflict = await this.getByEmail(emailNorm);
      if (emailConflict) {
        throw new Error(`[auth users] email already exists: '${args.email}'`);
      }
    }

    const id = this.nextId++;
    const rec: UserRecord = {
      id,
      username: args.username,
      email: emailNorm,
      passwordHash: args.passwordHash,
      passwordAlgo: args.passwordAlgo,
      passwordUpdatedAt: args.now,
      failedAttempts: 0,
      lockedUntil: null,
      disabled: false,
      isAdmin: false,
      createdAt: args.now,
      supabaseAuthId: args.supabaseAuthId ?? null,
    };

    // Persist all three indexes and the id sequence counter.
    this.persistAll(rec);
    this.kv?.set([KEY_ID_SEQ], id).catch((err: unknown) => {
      this.loggerService.warn(`[auth users] id seq update failed: ${err}`);
    });

    this.loggerService.debug(`[auth users] created user '${args.username}' with id ${id}`);
    return rec;
  }

  /**
   * Replaces a user's password hash and clears any pending lockout state.
   *
   * Reads the current record from KV by id, applies the mutation, and writes
   * all three indexes back in the background (fire-and-forget).
   * Used both on the password-change flow and after a bcrypt→argon2id rehash.
   */
  public updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const updated: UserRecord = {
        ...rec,
        passwordHash,
        passwordAlgo: algo,
        passwordUpdatedAt: now,
        failedAttempts: 0,
        lockedUntil: null,
      };
      this.persistAll(updated);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] updatePassword failed for id ${id}: ${err}`);
    });
  }

  /**
   * Increments `failedAttempts` for the given user and returns the updated record.
   *
   * Reads the current record from KV, increments the counter, writes all three
   * indexes back, and resolves with the updated record so callers can decide
   * whether to invoke `setLockedUntil`.
   */
  public async recordFailure(id: number, _now: number): Promise<UserRecord> {
    const rec = await this.getById(id);
    if (!rec) {
      throw new Error(`[auth users] recordFailure: unknown id ${id}`);
    }

    const updated: UserRecord = { ...rec, failedAttempts: rec.failedAttempts + 1 };
    this.persistAll(updated);
    return updated;
  }

  /**
   * Resets `failedAttempts` and `lockedUntil` to their initial values.
   *
   * Reads the current record from KV and writes back in the background. No-ops
   * when the id is not found.
   */
  public resetFailures(id: number): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      if (rec.failedAttempts === 0 && rec.lockedUntil === null) {
        // Avoid a pointless KV write when nothing changed.
        return;
      }

      const updated: UserRecord = { ...rec, failedAttempts: 0, lockedUntil: null };
      this.persistAll(updated);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] resetFailures failed for id ${id}: ${err}`);
    });
  }

  /**
   * Sets or clears the `lockedUntil` timestamp for the given user.
   *
   * Reads the current record from KV and writes back in the background.
   */
  public setLockedUntil(id: number, until: number | null): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const updated: UserRecord = { ...rec, lockedUntil: until };
      this.persistAll(updated);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] setLockedUntil failed for id ${id}: ${err}`);
    });
  }

  /**
   * Toggles the `disabled` flag for the given user.
   *
   * Reads the current record from KV and writes back in the background.
   */
  public setDisabled(id: number, disabled: boolean): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const updated: UserRecord = { ...rec, disabled };
      this.persistAll(updated);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] setDisabled failed for id ${id}: ${err}`);
    });
  }

  /**
   * Sets or clears the `isAdmin` flag for the given user.
   *
   * Reads the current record from KV and writes back in the background.
   */
  public setAdmin(id: number, isAdmin: boolean): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const updated: UserRecord = { ...rec, isAdmin };
      this.persistAll(updated);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] setAdmin failed for id ${id}: ${err}`);
    });
  }

  /**
   * Sets the email for an existing user and writes the `user:by-email` secondary
   * index key.
   *
   * Reads the current record from KV to check for conflicts and to build the
   * updated record. Removes the old email index key when the record previously
   * had an email. Writes back in the background (fire-and-forget).
   *
   * Throws when the email is already taken by a different user (case-insensitive).
   * Callers should only invoke this when the user's existing email is null —
   * email changes are out of scope for this plan.
   */
  public setEmail(id: number, email: string, _now: number): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const emailNorm = email.toLowerCase();

      // Reject if the email is already taken by a different user.
      const conflict = await this.getByEmail(emailNorm);
      if (conflict && conflict.id !== id) {
        throw new Error(`[auth users] setEmail: email already taken: '${email}'`);
      }

      // Remove the old email index key when the record previously had one.
      if (rec.email && rec.email !== emailNorm) {
        this.kv?.delete([KEY_BY_EMAIL, rec.email]).catch((err: unknown) => {
          this.loggerService.warn(`[auth users] setEmail: delete old email index failed: ${err}`);
        });
      }

      const updated: UserRecord = { ...rec, email: emailNorm };
      this.persistAll(updated);

      this.loggerService.debug(`[auth users] set email for id=${id}`);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] setEmail failed for id ${id}: ${err}`);
    });
  }

  /**
   * Sets or clears the Supabase Auth user id for an existing user.
   *
   * Reads the current record from KV and writes all three indexes back in the
   * background (fire-and-forget).
   */
  public setSupabaseAuthId(id: number, authId: string | null): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const updated: UserRecord = { ...rec, supabaseAuthId: authId };
      this.persistAll(updated);

      this.loggerService.debug(`[auth users] set supabaseAuthId for id=${id}: ${authId ?? 'null'}`);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] setSupabaseAuthId failed for id ${id}: ${err}`);
    });
  }

  /**
   * Removes the user record for the given id from all three KV indexes.
   *
   * Reads the record by id to discover the username and email keys to remove.
   * Runs in the background (fire-and-forget). No-ops silently when the id is
   * not found. Intended for CLI/admin use.
   */
  public delete(id: number): void {
    void (async () => {
      const rec = await this.getById(id);
      if (!rec) return;

      const promises: Promise<void>[] = [
        this.kv!.delete([KEY_BY_ID, id]),
        this.kv!.delete([KEY_BY_USERNAME, rec.username.toLowerCase()]),
      ];
      if (rec.email) {
        promises.push(this.kv!.delete([KEY_BY_EMAIL, rec.email]));
      }
      await Promise.all(promises);

      this.loggerService.debug(`[auth users] deleted user id=${id} username='${rec.username}'`);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] delete failed for id ${id}: ${err}`);
    });
  }

  /**
   * Removes every user record from all three KV indexes.
   *
   * Scans the `user:by-id` prefix to enumerate all records, then deletes all
   * keys in the background. The id sequence counter is preserved so subsequent
   * creates do not reuse previously issued ids. Intended for CLI/admin use.
   */
  public clear(): void {
    void (async () => {
      if (!this.kv) return;

      const deletes: Promise<void>[] = [];
      // Scan all three prefixes to remove every index entry.
      for await (const entry of this.kv.list<UserRecord>({ prefix: [KEY_BY_ID] })) {
        const rec = entry.value;
        deletes.push(this.kv.delete([KEY_BY_ID, rec.id]));
        deletes.push(this.kv.delete([KEY_BY_USERNAME, rec.username.toLowerCase()]));
        if (rec.email) deletes.push(this.kv.delete([KEY_BY_EMAIL, rec.email]));
      }
      await Promise.all(deletes);

      this.loggerService.info(`[auth users] cleared all user records from KV`);
    })().catch((err: unknown) => {
      this.loggerService.warn(`[auth users] clear failed: ${err}`);
    });
  }

  /**
   * Returns a snapshot of every user record by scanning the `user:by-id` KV
   * prefix.
   *
   * Uses the id index rather than the username index so the result is ordered
   * by id. Intended for CLI/admin use.
   */
  public async list(): Promise<ReadonlyArray<UserRecord>> {
    if (!this.kv) return [];
    const records: UserRecord[] = [];
    for await (const entry of this.kv.list<UserRecord>({ prefix: [KEY_BY_ID] })) {
      records.push(entry.value);
    }
    return records;
  }

  /**
   * Writes all three KV index keys for a record in the background.
   *
   * All mutations build an immutable updated record and pass it here so the
   * three indexes always contain the same data. Errors are logged but do not
   * propagate to callers.
   */
  private persistAll(rec: UserRecord): void {
    const usernameLower = rec.username.toLowerCase();

    const writes = [
      this.kv!.set([KEY_BY_USERNAME, usernameLower], rec),
      this.kv!.set([KEY_BY_ID, rec.id], rec),
      ...(rec.email ? [this.kv!.set([KEY_BY_EMAIL, rec.email], rec)] : []),
    ];

    Promise.all(writes).catch((err: unknown) => {
      this.loggerService.warn(`[auth users] persistAll failed for '${rec.username}': ${err}`);
    });
  }
}
