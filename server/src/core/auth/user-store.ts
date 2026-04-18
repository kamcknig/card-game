import type { PasswordAlgo } from './password-hasher.ts';

/**
 * One persisted user account row.
 *
 * Backing record for the `user` auth provider. `passwordAlgo`
 * tracks which algorithm produced `passwordHash` so that legacy bcrypt rows
 * can be verified and rehashed to argon2id on next login. `failedAttempts`
 * and `lockedUntil` drive per-account lockout; these counters are reset on
 * successful login.
 */
export interface UserRecord {
  readonly id: number;
  readonly username: string;
  passwordHash: string;
  passwordAlgo: PasswordAlgo;
  passwordUpdatedAt: number;
  failedAttempts: number;
  lockedUntil: number | null;
  disabled: boolean;
  readonly createdAt: number;
}

/**
 * Pluggable persistence contract for user accounts.
 *
 * Synchronous like {@link SessionStore} so the authentication hot-path
 * avoids async overhead. Persistent implementations load all users into an
 * in-memory cache at startup via `open()` and use fire-and-forget writes
 * for mutations.
 *
 * Defined in: server/src/core/auth/user-store.ts
 * Consumers: UserAccountAuthProvider, ServerAuthRouteHandlerService (register
 *   + password change), auth-create-user CLI.
 */
export interface UserStore {
  /**
   * Returns the user record for `username` or undefined if not found.
   *
   * Lookups are case-insensitive: stores should normalize usernames to
   * lowercase on write and match against lowercase on read. The returned
   * `UserRecord.username` preserves the original case for display.
   */
  getByUsername(username: string): UserRecord | undefined;

  /**
   * Returns the user record for a numeric id, or undefined.
   *
   * Used by write operations (recordFailure, updatePassword) that hold
   * the id from a previous getByUsername call so repeated lookups stay
   * O(1).
   */
  getById(id: number): UserRecord | undefined;

  /**
   * Creates a new user row with the supplied username and argon2id hash.
   *
   * Throws when a user with the same (lowercased) username already exists.
   * New rows begin with `failedAttempts=0`, `lockedUntil=null`,
   * `disabled=false`, and `passwordAlgo='argon2id'`.
   */
  create(args: { username: string; passwordHash: string; passwordAlgo: 'argon2id'; now: number }): UserRecord;

  /**
   * Replaces a user's password hash and records the update timestamp.
   *
   * Used by both the password-change flow and the bcrypt→argon2id rehash
   * performed after a successful legacy login. Clears failure counters so
   * a user is not still considered at risk of lockout after rotating.
   */
  updatePassword(id: number, passwordHash: string, algo: PasswordAlgo, now: number): void;

  /**
   * Increments the per-account failure counter and returns the updated row.
   *
   * The returned record reflects the new `failedAttempts` so callers can
   * decide whether to invoke `setLockedUntil`.
   */
  recordFailure(id: number, now: number): UserRecord;

  /**
   * Clears the failure counter and any active lock for this user.
   *
   * Invoked after a successful login to undo prior failure state.
   */
  resetFailures(id: number): void;

  /**
   * Sets or clears the lockout expiry timestamp.
   *
   * Passing `null` unlocks the account immediately. Callers use this in
   * conjunction with `recordFailure` when the failure threshold is hit.
   */
  setLockedUntil(id: number, until: number | null): void;

  /**
   * Enables or disables the user account.
   *
   * Disabled accounts are refused by the authentication flow regardless
   * of correct credentials. Not currently exposed on the HTTP API but
   * available for CLI/operator use.
   */
  setDisabled(id: number, disabled: boolean): void;

  /**
   * Removes the user record for the given id from the store.
   *
   * No-ops silently when the id does not exist. Intended for CLI/admin use.
   */
  delete(id: number): void;

  /**
   * Removes every user record from the store.
   *
   * The id sequence is preserved so that subsequent creates do not reuse
   * previously issued ids. Intended for CLI/admin use.
   */
  clear(): void;

  /**
   * Returns a snapshot of every user record in the store.
   *
   * Intended for CLI/admin use; the route handlers never expose the full
   * list to end users.
   */
  list(): ReadonlyArray<UserRecord>;
}
