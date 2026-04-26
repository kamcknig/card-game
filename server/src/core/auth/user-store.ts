import type { PasswordAlgo } from './password-hasher.ts';

/**
 * One persisted user account row.
 *
 * Backing record for the `user` auth provider. `passwordAlgo`
 * tracks which algorithm produced `passwordHash` so that legacy bcrypt rows
 * can be verified and rehashed to argon2id on next login. `failedAttempts`
 * and `lockedUntil` drive per-account lockout; these counters are reset on
 * successful login.
 *
 * `email` is nullable: a null value means the user predates the email-
 * registration feature and has not yet attached one. New registrations always
 * set a non-null email.
 *
 * `supabaseAuthId` is set when a Supabase Auth user has been provisioned for
 * this account. For the supabase backend, login branches on this field:
 * non-null uses `signInWithPassword`; null falls back to local argon2id.
 */
export interface UserRecord {
  readonly id: number;
  readonly username: string;
  /** Nullable email address. Null for users who predate email registration. */
  email: string | null;
  passwordHash: string;
  passwordAlgo: PasswordAlgo;
  passwordUpdatedAt: number;
  failedAttempts: number;
  lockedUntil: number | null;
  disabled: boolean;
  isAdmin: boolean;
  readonly createdAt: number;
  /** Supabase Auth user id. Set when a Supabase Auth user is provisioned. */
  supabaseAuthId: string | null;
}

/**
 * Pluggable persistence contract for user accounts.
 *
 * All read operations query the backing store directly on every call — there
 * is no in-memory cache. This eliminates stale-cache bugs when records are
 * modified externally (e.g. via Studio or the CLI) and simplifies store
 * implementations. Write operations persist directly to the backing store;
 * the `InMemoryUserStore` is the exception and serves as its own backing
 * store.
 *
 * Read methods return `Promise` to accommodate asynchronous backing stores
 * (Deno KV and Supabase). `InMemoryUserStore` wraps synchronous map lookups
 * with `Promise.resolve()`.
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
  getByUsername(username: string): Promise<UserRecord | undefined>;

  /**
   * Returns the user record for a numeric id, or undefined.
   */
  getById(id: number): Promise<UserRecord | undefined>;

  /**
   * Returns the user record whose email matches the given address, or undefined.
   *
   * Lookups are case-insensitive. Returns undefined when no record has a
   * non-null email matching the normalised address.
   */
  getByEmail(email: string): Promise<UserRecord | undefined>;

  /**
   * Creates a new user row with the supplied username and argon2id hash.
   *
   * Throws when a user with the same (lowercased) username already exists.
   * Throws when `email` is provided and is already taken by another user
   * (case-insensitive comparison).
   * New rows begin with `failedAttempts=0`, `lockedUntil=null`,
   * `disabled=false`, and `passwordAlgo='argon2id'`.
   *
   * Returns a `Promise<UserRecord>` so that Supabase-backed implementations
   * can await the DB-assigned identity column. KV and in-memory implementations
   * resolve synchronously via `Promise.resolve(record)`.
   */
  create(args: {
    username: string;
    /** Optional email. Normalized to null when omitted. */
    email?: string | null;
    passwordHash: string;
    passwordAlgo: 'argon2id';
    now: number;
    /** Optional Supabase Auth user id. Normalized to null when omitted. */
    supabaseAuthId?: string | null;
  }): Promise<UserRecord>;

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
   * Returns a `Promise<UserRecord>` because implementations that do not
   * maintain an in-memory cache must read the current record before
   * incrementing. The returned record reflects the new `failedAttempts` so
   * callers can decide whether to invoke `setLockedUntil`.
   */
  recordFailure(id: number, now: number): Promise<UserRecord>;

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
   * Sets or clears the admin flag for the given user.
   *
   * Admin users may create, list, and disable registration codes and have
   * access to the debug overlay. Not exposed on the HTTP API — promotion is
   * operator-only via the CLI.
   */
  setAdmin(id: number, isAdmin: boolean): void;

  /**
   * Sets the email address for an existing user.
   *
   * Throws when the email is already taken by a different user (case-
   * insensitive). Callers must only invoke this when the existing email is
   * null — this plan does not support email changes (that is out of scope).
   *
   * @param id  Numeric user id.
   * @param email  New email address (stored lowercased).
   * @param now  Current timestamp in milliseconds.
   */
  setEmail(id: number, email: string, now: number): void;

  /**
   * Sets or clears the Supabase Auth user id for an existing user.
   *
   * Invoked when a Supabase Auth user is provisioned during the add-email
   * flow. Pass null to detach the Supabase Auth user (operator use only).
   *
   * @param id  Numeric user id.
   * @param authId  Supabase Auth UUID, or null to clear.
   */
  setSupabaseAuthId(id: number, authId: string | null): void;

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
   * list to end users. Returns a `Promise` to accommodate backing stores
   * that require an asynchronous scan (Deno KV, Supabase).
   */
  list(): Promise<ReadonlyArray<UserRecord>>;
}
