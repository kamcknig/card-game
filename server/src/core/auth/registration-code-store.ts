/**
 * One registration code row — the token a user presents at POST /auth/register.
 *
 * Codes are issued by authenticated users (or via CLI) and may be single-use
 * or multi-use. Each successful registration increments `usedCount`; once it
 * reaches `maxUses` the code is automatically refused by `recordUse`. A code
 * can also be `disabled` manually or expired by `expiresAt`.
 */
export interface RegistrationCode {
  // The opaque value the registrant enters (cryptographically random hex).
  readonly code: string;

  // Creation timestamp in milliseconds since epoch.
  readonly createdAt: number;

  // Username of the issuer; used only for audit/logging.
  readonly createdBy: string;

  // Absolute expiry, or null for no time limit.
  readonly expiresAt: number | null;

  // Maximum number of successful registrations this code can produce.
  readonly maxUses: number;

  // Successful uses so far. Incremented in recordUse(); writes persist.
  usedCount: number;

  // When true, the code is refused regardless of expiresAt / maxUses.
  disabled: boolean;
}

/**
 * Persistence contract for invite-style registration codes.
 *
 * Synchronous operations, following the same write-through pattern as
 * UserStore / SessionStore. Store implementations must enforce that
 * `recordUse` and `disable` are atomic with respect to each other so a
 * code cannot be simultaneously consumed and disabled.
 *
 * Defined in: server/src/core/auth/registration-code-store.ts
 * Consumers: ServerAuthRouteHandlerService (register + admin endpoints),
 *   auth-create-reg-code CLI.
 */
export interface RegistrationCodeStore {
  /**
   * Returns the code record or undefined when unknown.
   *
   * Does not apply expiry / disabled / maxUses checks — callers validate
   * those explicitly when they need to distinguish "invalid" from "found
   * but not usable" in logging.
   */
  get(code: string): RegistrationCode | undefined;

  /**
   * Inserts a new registration code with a freshly generated random value.
   *
   * Callers supply issuer metadata and expiry/usage policy. The returned
   * record includes the generated `code` string which must be transmitted
   * to the registrant out-of-band.
   */
  create(args: {
    createdBy: string;
    expiresAt: number | null;
    maxUses: number;
    now: number;
  }): RegistrationCode;

  /**
   * Validates and atomically records a successful use of the given code.
   *
   * Returns the updated record when the code was accepted (incremented
   * usedCount). Returns undefined when the code is missing, disabled,
   * expired at `nowMs`, or has already reached `maxUses`. Callers use the
   * undefined return to respond 400 without leaking which condition tripped.
   */
  recordUse(code: string, nowMs: number): RegistrationCode | undefined;

  /**
   * Disables the given code (no-op when already disabled or missing).
   *
   * Idempotent: the DELETE /auth/registration-codes/:code endpoint returns
   * 200 either way.
   */
  disable(code: string): void;

  /**
   * Returns a snapshot of every registration code currently persisted.
   *
   * Used by the GET /auth/registration-codes endpoint.
   */
  list(): ReadonlyArray<RegistrationCode>;

  /**
   * Removes all codes whose `expiresAt` is <= nowMs.
   *
   * Returns the purge count. Keeps long-running KV stores tidy by eliminating
   * codes that can never be redeemed again.
   */
  purgeExpired(nowMs: number): number;
}
