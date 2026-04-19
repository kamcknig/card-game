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

  // Next id to issue; incremented monotonically on each create().
  private nextId = 1;

  public getByUsername(username: string): UserRecord | undefined {
    return this.byUsername.get(username.toLowerCase());
  }

  public getById(id: number): UserRecord | undefined {
    return this.byId.get(id);
  }

  public create(args: {
    username: string;
    passwordHash: string;
    passwordAlgo: 'argon2id';
    now: number;
  }): UserRecord {
    const key = args.username.toLowerCase();
    if (this.byUsername.has(key)) {
      throw new Error(`[auth users] username already exists: '${args.username}'`);
    }

    const rec: UserRecord = {
      id: this.nextId++,
      username: args.username,
      passwordHash: args.passwordHash,
      passwordAlgo: args.passwordAlgo,
      passwordUpdatedAt: args.now,
      failedAttempts: 0,
      lockedUntil: null,
      disabled: false,
      isAdmin: false,
      createdAt: args.now,
    };

    this.byUsername.set(key, rec);
    this.byId.set(rec.id, rec);
    return rec;
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
   * Removes the user record for the given id from both caches.
   *
   * No-ops silently when the id is not found.
   */
  public delete(id: number): void {
    const rec = this.byId.get(id);
    if (!rec) return;

    this.byUsername.delete(rec.username.toLowerCase());
    this.byId.delete(id);
  }

  /**
   * Removes every user record from both caches.
   *
   * The id sequence counter is preserved so subsequent creates do not reuse
   * previously issued ids.
   */
  public clear(): void {
    this.byUsername.clear();
    this.byId.clear();
  }

  public list(): ReadonlyArray<UserRecord> {
    return [...this.byUsername.values()];
  }
}
