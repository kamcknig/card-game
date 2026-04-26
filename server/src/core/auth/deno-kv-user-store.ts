import type { LoggerService } from '../logger-service.ts';
import type { UserRecord, UserStore } from './user-store.ts';
import type { PasswordAlgo } from './password-hasher.ts';

/**
 * Key prefix for user records keyed by (lowercased) username.
 *
 * Full keys: `['auth_users', usernameLowercase]`.
 */
const KEY_USERS = 'auth_users';

/**
 * Key prefix for the monotonic id counter.
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
 * one file. Follows the write-through cache pattern: reads are served from
 * a synchronous in-memory `Map<string, UserRecord>`; writes mutate the cache
 * and then fire an async KV `set`/`delete` without awaiting. The cache is
 * primed in `open()` by scanning the KEY_USERS prefix.
 *
 * The monotonic id counter is loaded from KV (or initialised to zero) on
 * open(). New ids are assigned locally by incrementing `nextId` in memory,
 * then persisted via a best-effort KV write. Collisions are impossible in
 * the single-process model; cross-process coordination is out of scope.
 *
 * Defined in: server/src/core/auth/deno-kv-user-store.ts
 * Consumers: Registered as `userStore` in register-root-services.ts.
 *   Opened from ServerStartupService before the HTTP server accepts
 *   connections so login / registration are never served from an empty cache.
 */
export class DenoKvUserStore implements UserStore {
  // Write-through cache keyed by lowercased username.
  private readonly cache = new Map<string, UserRecord>();

  // Secondary index so getById() remains O(1) without scanning the cache.
  private readonly byId = new Map<number, UserRecord>();

  // Secondary index keyed by lowercased email for getByEmail() lookups.
  // Only entries with a non-null email are present.
  private readonly byEmail = new Map<string, UserRecord>();

  // Shared KV handle, supplied by AuthKvProvider via open().
  private kv: Deno.Kv | undefined;

  // Next id to issue. Seeded from KEY_ID_SEQ in open(); incremented in create().
  private nextId = 1;

  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Loads all user rows from KV into the in-memory cache.
   *
   * Must be called once before any synchronous store method. Accepts either
   * a pre-opened `Deno.Kv` handle (shared with the other auth stores) or a
   * path string (mostly for tests / standalone CLI use).
   */
  public async open(pathOrKv: string | Deno.Kv): Promise<void> {
    this.kv = typeof pathOrKv === 'string' ? await Deno.openKv(pathOrKv) : pathOrKv;

    let loaded = 0;
    for await (const entry of this.kv.list<UserRecord>({ prefix: [KEY_USERS] })) {
      const rec = entry.value;
      this.cache.set(rec.username.toLowerCase(), rec);
      this.byId.set(rec.id, rec);
      // Populate the email index for rows that already have an email.
      if (rec.email) this.byEmail.set(rec.email.toLowerCase(), rec);
      if (rec.id >= this.nextId) this.nextId = rec.id + 1;
      loaded++;
    }

    // Pull the persisted id sequence so nextId survives the restart even if
    // the highest-id row was deleted.
    const seqEntry = await this.kv.get<number>([KEY_ID_SEQ]);
    if (typeof seqEntry.value === 'number' && seqEntry.value >= this.nextId) {
      this.nextId = seqEntry.value + 1;
    }

    this.loggerService.info(`[auth users] loaded ${loaded} user(s) from KV store (next id: ${this.nextId})`);
  }

  /**
   * Returns the user record matching `username` (case-insensitive).
   *
   * Does not check `disabled` — authentication providers handle that so the
   * store remains purely a persistence concern.
   */
  public getByUsername(username: string): UserRecord | undefined {
    return this.cache.get(username.toLowerCase());
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
   * Creates a new user row and persists it to KV.
   *
   * Throws when a user with the same (lowercased) username already exists.
   * Throws when `email` is provided and is already taken by another user
   * (case-insensitive comparison).
   * Returns a resolved `Promise<UserRecord>` to satisfy the {@link UserStore}
   * interface (the Supabase implementation awaits a real DB INSERT; the KV
   * implementation assigns the id locally and resolves synchronously).
   */
  public create(args: {
    username: string;
    email?: string | null;
    passwordHash: string;
    passwordAlgo: 'argon2id';
    now: number;
    supabaseAuthId?: string | null;
  }): Promise<UserRecord> {
    const key = args.username.toLowerCase();
    if (this.cache.has(key)) {
      throw new Error(`[auth users] username already exists: '${args.username}'`);
    }

    // Reject duplicate email up front (case-insensitive).
    const emailNorm = args.email ? args.email.toLowerCase() : null;
    if (emailNorm && this.byEmail.has(emailNorm)) {
      throw new Error(`[auth users] email already exists: '${args.email}'`);
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

    this.cache.set(key, rec);
    this.byId.set(id, rec);
    if (emailNorm) this.byEmail.set(emailNorm, rec);

    // Persist the row and the updated id sequence in the background.
    this.kv?.set([KEY_USERS, key], rec).catch((err: unknown) => {
      this.loggerService.warn(`[auth users] create failed for '${args.username}': ${err}`);
    });
    this.kv?.set([KEY_ID_SEQ], id).catch((err: unknown) => {
      this.loggerService.warn(`[auth users] id seq update failed: ${err}`);
    });

    return Promise.resolve(rec);
  }

  /**
   * Replaces a user's password and clears any pending lockout state.
   *
   * Used both on the password-change flow and after a bcrypt→argon2id
   * rehash. Failure counters are reset because the old password is gone —
   * previous failures are no longer meaningful.
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
   * Increments failedAttempts and returns the updated record.
   */
  public recordFailure(id: number, _now: number): UserRecord {
    const rec = this.byId.get(id);
    if (!rec) {
      // Defensive: should never happen because callers only pass ids they
      // already looked up. Return a synthetic record so the type contract
      // holds without crashing the auth flow.
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
      // Avoid a pointless KV write when nothing changed.
      return;
    }

    rec.failedAttempts = 0;
    rec.lockedUntil = null;
    this.persist(rec);
  }

  /**
   * Sets or clears the lockedUntil timestamp.
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
   * insensitive). Callers should only invoke this when the user's existing
   * email is null — email changes are out of scope for this plan.
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
   * Mutates the cached record and fires a background KV write.
   */
  public setSupabaseAuthId(id: number, authId: string | null): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.supabaseAuthId = authId;
    this.persist(rec);

    this.loggerService.debug(`[auth users] set supabaseAuthId for id=${id}: ${authId ?? 'null'}`);
  }

  /**
   * Removes the user record for the given id from all in-memory caches and KV.
   *
   * No-ops silently when the id is not found. Intended for CLI/admin use.
   */
  public delete(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    const key = rec.username.toLowerCase();
    this.byId.delete(id);
    this.cache.delete(key);
    if (rec.email) this.byEmail.delete(rec.email.toLowerCase());

    this.kv?.delete([KEY_USERS, key]).catch((err: unknown) => {
      this.loggerService.warn(`[auth users] delete failed for '${rec.username}': ${err}`);
    });
  }

  /**
   * Removes every user record from all in-memory caches and KV.
   *
   * The id sequence counter is preserved so subsequent creates do not reuse
   * previously issued ids. Intended for CLI/admin use.
   */
  public clear(): void {
    const keys = [...this.cache.keys()];
    this.cache.clear();
    this.byId.clear();
    this.byEmail.clear();

    for (const key of keys) {
      this.kv?.delete([KEY_USERS, key]).catch((err: unknown) => {
        this.loggerService.warn(`[auth users] clear: delete failed for key '${key}': ${err}`);
      });
    }

    this.loggerService.info(`[auth users] cleared ${keys.length} user(s) from store`);
  }

  /**
   * Returns a snapshot of every user record currently in memory.
   */
  public list(): ReadonlyArray<UserRecord> {
    return [...this.cache.values()];
  }

  /**
   * Writes the current in-memory record back to KV in the background.
   *
   * Mutates happen on the cached object in place; this method just echoes
   * the updated state to disk. Errors are logged but do not propagate.
   */
  private persist(rec: UserRecord): void {
    const key = rec.username.toLowerCase();
    this.kv?.set([KEY_USERS, key], rec).catch((err: unknown) => {
      this.loggerService.warn(`[auth users] persist failed for '${rec.username}': ${err}`);
    });
  }
}
