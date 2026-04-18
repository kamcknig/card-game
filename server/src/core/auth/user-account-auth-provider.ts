import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';
import { Argon2idHasher, BcryptHasher } from './password-hasher.ts';
import { Clock, systemClock } from './auth-rate-limiter-service.ts';
import type { UserStore } from './user-store.ts';

/**
 * Static argon2id hash of a throwaway value, used by
 * {@link UserAccountAuthProvider.authenticate} to equalize the runtime of
 * missing-user and wrong-password paths so an attacker cannot distinguish
 * them by timing.
 *
 * Computed once at module load to avoid paying the hashing cost per request.
 * The exact plaintext is unimportant — only the verify() call duration.
 */
const DUMMY_HASH_PLAINTEXT = 'nonexistent-user-dummy';
let DUMMY_HASH: string | undefined;

/**
 * Auth provider that looks up users in {@link UserStore} and validates their
 * password hashes.
 *
 * The UI selects `provider: 'user'` for account-based login flows.
 *
 * Behaviors:
 * - Case-insensitive username lookup (stored lowercase in the user store).
 * - Unknown-user requests still run a constant-time dummy hash verification
 *   so timing does not reveal account existence (username enumeration).
 * - Supports both argon2id (preferred) and bcrypt (legacy) stored hashes.
 *   Successful logins against a bcrypt row trigger a rehash to argon2id.
 * - Per-account lockout: after `AUTH_LOCKOUT_THRESHOLD` consecutive failures
 *   the account is locked for `AUTH_LOCKOUT_DURATION_MS`. Successful logins
 *   clear both counters.
 * - Disabled accounts are always refused.
 *
 * Lifetime: Root singleton; registered with AuthSessionService alongside
 * PresetPasswordAuthProvider.
 */
export class UserAccountAuthProvider implements AuthProvider {
  readonly name = 'user';

  constructor(
    private readonly loggerService: LoggerService,
    private readonly userStore: UserStore,
    private readonly argon2id: Argon2idHasher,
    private readonly bcrypt: BcryptHasher,
    private readonly serverConfigService: ServerConfigService,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * Warms the dummy hash used for constant-time unknown-user responses.
   *
   * Called by AuthSessionService.initializeProviders() during startup so the
   * first user-enumeration attempt does not incur an extra hashing cost on
   * the request path.
   */
  public async initialize(): Promise<void> {
    if (!DUMMY_HASH) {
      DUMMY_HASH = await this.argon2id.hash(DUMMY_HASH_PLAINTEXT);
    }
    this.loggerService.info('[auth:user] user-account provider initialized');
  }

  /**
   * Validates the given credentials and returns an AuthResult.
   *
   * Credentials shape: `{ username: string, password: string }`. Any missing
   * or wrong-type field is treated as a generic rejection to avoid leaking
   * which check failed.
   */
  public async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const username =
      typeof credentials['username'] === 'string' ? (credentials['username'] as string).trim() : '';
    const password = typeof credentials['password'] === 'string' ? (credentials['password'] as string) : '';

    if (!username || !password) {
      this.loggerService.debug('[auth:user] rejected: empty username or password');
      return { ok: false, message: 'Username/password does not match' };
    }

    const user = this.userStore.getByUsername(username);

    // Run a dummy verify even when the user is missing to avoid leaking
    // existence via timing. Also matches the disabled-account case.
    if (!user || user.disabled) {
      if (DUMMY_HASH) {
        await this.argon2id.verify(password, DUMMY_HASH);
      }
      this.loggerService.debug('[auth:user] rejected: unknown or disabled user');
      return { ok: false, message: 'Username/password does not match' };
    }

    const now = this.clock.now();

    // Enforce any pending account lockout before touching the hash verifier
    // so brute-force attempts inside the lockout window return quickly.
    if (user.lockedUntil && user.lockedUntil > now) {
      this.loggerService.warn(`[auth:user] rejected: account '${user.username}' is locked until ${user.lockedUntil}`);
      return { ok: false, message: 'Account temporarily locked' };
    }

    // Select the verifier based on the algorithm recorded at hash time.
    const verifier = user.passwordAlgo === 'argon2id' ? this.argon2id : this.bcrypt;
    const valid = await verifier.verify(password, user.passwordHash);

    if (!valid) {
      const updated = this.userStore.recordFailure(user.id, now);
      this.loggerService.debug(
        `[auth:user] rejected: wrong password for '${user.username}' (failures=${updated.failedAttempts})`,
      );

      // Trip the lockout when we just crossed the configured threshold.
      const threshold = this.serverConfigService.getAuthLockoutThreshold();
      if (updated.failedAttempts >= threshold) {
        const durationMs = this.serverConfigService.getAuthLockoutDurationMs();
        this.userStore.setLockedUntil(user.id, now + durationMs);
        this.loggerService.warn(
          `[auth:user] account '${user.username}' locked for ${durationMs}ms (failures=${updated.failedAttempts})`,
        );
      }

      return { ok: false, message: 'Username/password does not match' };
    }

    // Successful login — rehash bcrypt→argon2id opportunistically so stored
    // hashes migrate forward without operator intervention.
    if (user.passwordAlgo === 'bcrypt') {
      try {
        const newHash = await this.argon2id.hash(password);
        this.userStore.updatePassword(user.id, newHash, 'argon2id', now);
        this.loggerService.info(`[auth:user] upgraded '${user.username}' password hash bcrypt → argon2id`);
      } catch (err) {
        // Rehash failures do not invalidate the login; log and move on.
        this.loggerService.warn(`[auth:user] bcrypt→argon2id rehash failed for '${user.username}': ${err}`);
      }
    }

    this.userStore.resetFailures(user.id);
    return { ok: true, username: user.username };
  }
}
