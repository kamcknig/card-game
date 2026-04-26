import type { UserRecord, UserStore } from './user-store.ts';
import type { PasswordAlgo } from './password-hasher.ts';

/**
 * In-memory implementation of {@link UserStore} used primarily by tests and
 * for the `memory` session-store mode (which implies no persistence).
 *
 * All operations are backed by plain `Map<string, UserRecord>` instances.
 * Identical semantics to {@link DenoKvUserStore} except that records do not
 * survive process restart. Username lookups are case-insensitive; the record
 * preserves the original casing supplied to `create()`.
 *
 * Read methods return `Promise.resolve(...)` to satisfy the async
 * {@link UserStore} interface without introducing async overhead on the
 * synchronous in-memory path. This store is not changed by Phase 3.5 —
 * it is inherently in-memory and only used when no persistent backend is
 * configured.
 */
export class InMemoryUserStore implements UserStore {
  // Cache keyed by lowercased username for fast getByUsername.
  private readonly byUsername = new Map<string, UserRecord>();

  // Secondary index for id-based lookups.
  private readonly byId = new Map<number, UserRecord>();

  // Secondary index keyed by lowercased email. Only populated for rows
  // with a non-null email value.
  private readonly byEmail = new Map<string, UserRecord>();

  // Next id to issue; incremented monotonically on each create().
  private nextId = 1;

  /**
   * Returns the user record matching `username` (case-insensitive).
   */
  public getByUsername(username: string): Promise<UserRecord | undefined> {
    return Promise.resolve(this.byUsername.get(username.toLowerCase()));
  }

  /**
   * Returns the user record for the given numeric id.
   */
  public getById(id: number): Promise<UserRecord | undefined> {
    return Promise.resolve(this.byId.get(id));
  }

  /**
   * Returns the user record whose email matches the given address (case-
   * insensitive), or undefined when no match is found.
   */
  public getByEmail(email: string): Promise<UserRecord | undefined> {
    return Promise.resolve(this.byEmail.get(email.toLowerCase()));
  }

  /**
   * Creates a new user record.
   *
   * Throws when a user with the same (lowercased) username already exists.
   * Throws when `email` is provided and is already taken by another user
   * (case-insensitive comparison).
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
    if (this.byUsername.has(key)) {
      throw new Error(`[auth users] username already exists: '${args.username}'`);
    }

    // Reject duplicate email up front (case-insensitive).
    const emailNorm = args.email ? args.email.toLowerCase() : null;
    if (emailNorm && this.byEmail.has(emailNorm)) {
      throw new Error(`[auth users] email already exists: '${args.email}'`);
    }

    const rec: UserRecord = {
      id: this.nextId++,
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

    this.byUsername.set(key, rec);
    this.byId.set(rec.id, rec);
    if (emailNorm) this.byEmail.set(emailNorm, rec);
    return Promise.resolve(rec);
  }

  /**
   * Replaces a user's password hash and clears any pending lockout state.
   */
  public updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.passwordHash = passwordHash;
    rec.passwordAlgo = algo;
    rec.passwordUpdatedAt = now;
    rec.failedAttempts = 0;
    rec.lockedUntil = null;
  }

  /**
   * Increments `failedAttempts` and returns the updated record.
   *
   * Returns a `Promise<UserRecord>` to satisfy the async {@link UserStore}
   * interface; the implementation is synchronous under the hood.
   */
  public recordFailure(id: number, _now: number): Promise<UserRecord> {
    const rec = this.byId.get(id);
    if (!rec) throw new Error(`[auth users] recordFailure: unknown id ${id}`);
    rec.failedAttempts++;
    return Promise.resolve(rec);
  }

  /**
   * Resets `failedAttempts` and `lockedUntil` to their initial values.
   */
  public resetFailures(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.failedAttempts = 0;
    rec.lockedUntil = null;
  }

  /**
   * Sets or clears the `lockedUntil` timestamp.
   */
  public setLockedUntil(id: number, until: number | null): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.lockedUntil = until;
  }

  /**
   * Toggles the `disabled` flag for the given user.
   */
  public setDisabled(id: number, disabled: boolean): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.disabled = disabled;
  }

  /**
   * Sets or clears the `isAdmin` flag for the given user.
   */
  public setAdmin(id: number, isAdmin: boolean): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.isAdmin = isAdmin;
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
  }

  /**
   * Sets or clears the `supabaseAuthId` for an existing user.
   */
  public setSupabaseAuthId(id: number, authId: string | null): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.supabaseAuthId = authId;
  }

  /**
   * Removes the user record for the given id from all caches.
   *
   * No-ops silently when the id is not found.
   */
  public delete(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    this.byUsername.delete(rec.username.toLowerCase());
    this.byId.delete(id);
    if (rec.email) this.byEmail.delete(rec.email.toLowerCase());
  }

  /**
   * Removes every user record from all caches.
   *
   * The id sequence counter is preserved so subsequent creates do not reuse
   * previously issued ids.
   */
  public clear(): void {
    this.byUsername.clear();
    this.byId.clear();
    this.byEmail.clear();
  }

  /**
   * Returns a snapshot of every user record currently in memory.
   *
   * Returns a `Promise` to satisfy the async {@link UserStore} interface;
   * the result is resolved synchronously.
   */
  public list(): Promise<ReadonlyArray<UserRecord>> {
    return Promise.resolve([...this.byUsername.values()]);
  }
}
