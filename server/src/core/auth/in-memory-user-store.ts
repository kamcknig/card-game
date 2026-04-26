import type { UserRecord, UserStore } from './user-store.ts';
import type { PasswordAlgo } from './password-hasher.ts';

/**
 * In-memory implementation of {@link UserStore} used primarily by tests and
 * for the `memory` session-store mode (which implies no persistence).
 *
 * All operations are synchronous and live in a plain `Map<string, UserRecord>`.
 * Identical semantics to {@link DenoKvUserStore} except that records do not
 * survive process restart. Username lookups are case-insensitive; the record
 * preserves the original casing supplied to `create()`.
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

  public getByUsername(username: string): UserRecord | undefined {
    return this.byUsername.get(username.toLowerCase());
  }

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

  public updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    rec.passwordHash = passwordHash;
    rec.passwordAlgo = algo;
    rec.passwordUpdatedAt = now;
    rec.failedAttempts = 0;
    rec.lockedUntil = null;
  }

  public recordFailure(id: number, _now: number): UserRecord {
    const rec = this.byId.get(id);
    if (!rec) throw new Error(`[auth users] recordFailure: unknown id ${id}`);
    rec.failedAttempts++;
    return rec;
  }

  public resetFailures(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.failedAttempts = 0;
    rec.lockedUntil = null;
  }

  public setLockedUntil(id: number, until: number | null): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.lockedUntil = until;
  }

  public setDisabled(id: number, disabled: boolean): void {
    const rec = this.byId.get(id);
    if (!rec) return;
    rec.disabled = disabled;
  }

  /**
   * Sets or clears the admin flag for the given user.
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
   * Sets or clears the Supabase Auth user id for an existing user.
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

  public list(): ReadonlyArray<UserRecord> {
    return [...this.byUsername.values()];
  }
}
