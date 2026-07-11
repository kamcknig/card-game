import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { SupabaseClientProvider } from '../storage/supabase-client-provider.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';
import { Argon2idHasher, BcryptHasher } from './password-hasher.ts';
import { Clock, systemClock } from './auth-rate-limiter-service.ts';
import type { UserRecord, UserStore } from './user-store.ts';

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
 * - The sign-in identifier may be a username OR an email: the username
 *   lookup is tried first, then an email lookup when the identifier
 *   contains '@'. Lockout/failure counters are keyed by the resolved
 *   user id, so login-by-email shares lockout state with login-by-username
 *   for the same account.
 * - Unknown-user requests still run a constant-time dummy hash verification
 *   so timing does not reveal account existence (username enumeration).
 * - Supports both argon2id (preferred) and bcrypt (legacy) stored hashes.
 *   Successful logins against a bcrypt row trigger a rehash to argon2id.
 * - Per-account lockout: after `AUTH_LOCKOUT_THRESHOLD` consecutive failures
 *   the account is locked for `AUTH_LOCKOUT_DURATION_MS`. Successful logins
 *   clear both counters.
 * - Disabled accounts are always refused.
 * - When `STORAGE_BACKEND=supabase` and the user's `supabaseAuthId` is set,
 *   authentication is delegated to Supabase Auth (`signInWithPassword`).
 *   Legacy rows (no `supabaseAuthId`) fall back to local argon2id even on
 *   the supabase backend until the user attaches an email.
 * - The in-memory backend always uses local argon2id.
 *
 * Lifetime: Root singleton; registered with AuthSessionService as the sole
 * auth provider.
 *
 * Defined in: server/src/core/auth/user-account-auth-provider.ts
 * Consumers: Registered as `userAccountAuthProvider` in register-root-services.ts.
 */
export class UserAccountAuthProvider implements AuthProvider {
  readonly name = 'user';

  constructor(
    private readonly loggerService: LoggerService,
    private readonly userStore: UserStore,
    private readonly argon2idHasher: Argon2idHasher,
    private readonly bcryptHasher: BcryptHasher,
    private readonly serverConfigService: ServerConfigService,
    private readonly supabaseClientProvider: SupabaseClientProvider,
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
      DUMMY_HASH = await this.argon2idHasher.hash(DUMMY_HASH_PLAINTEXT);
    }
    this.loggerService.info('[auth:user] user-account provider initialized');
  }

  /**
   * Validates the given credentials and returns an AuthResult.
   *
   * Credentials shape: `{ username: string, password: string }`. The
   * `username` field accepts either a username or an email address — see
   * {@link resolveUser}. Any missing or wrong-type field is treated as a
   * generic rejection to avoid leaking which check failed.
   */
  public async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const username =
      typeof credentials['username'] === 'string' ? (credentials['username'] as string).trim() : '';
    const password = typeof credentials['password'] === 'string' ? (credentials['password'] as string) : '';

    if (!username || !password) {
      this.loggerService.debug('[auth:user] rejected: empty username or password');
      return { ok: false, message: 'Username/password does not match' };
    }

    // DANGER: local-dev auth bypass. When AUTH_DEV_BYPASS=true, accept any
    // non-empty username/password without touching the user store, password
    // hashes, lockout counters, or Supabase. Downstream identity (admin flag,
    // email) is resolved by the DevBypassUserStore decorator. Guarded so the
    // provider behaves identically to production when the flag is off. This
    // must never be enabled in a shared or production environment.
    if (this.serverConfigService.isAuthDevBypassEnabled()) {
      this.loggerService.warn(
        `[auth:user] DEV BYPASS active — accepting '${username}' without password verification (AUTH_DEV_BYPASS)`,
      );
      return { ok: true, username };
    }

    const user = await this.resolveUser(username);

    // Run a dummy verify even when the user is missing to avoid leaking
    // existence via timing. Also matches the disabled-account case.
    if (!user || user.disabled) {
      if (DUMMY_HASH) {
        await this.argon2idHasher.verify(password, DUMMY_HASH);
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

    // Branch on backend and supabaseAuthId. When the supabase backend is active
    // and the user has a Supabase Auth account (supabaseAuthId !== null), delegate
    // to Supabase Auth. The local argon2id path is used for:
    //   - in-memory backend: always
    //   - supabase backend with a legacy row (no supabaseAuthId): fallback until
    //     the user attaches an email and the Supabase Auth user is provisioned.
    const backend = this.serverConfigService.getStorageBackend();
    if (backend === 'supabase' && user.supabaseAuthId !== null) {
      return this.authenticateViaSupabase(user, password, now);
    }

    return this.authenticateViaArgon2(user, password, now);
  }

  /**
   * Resolves the login identifier as a username first (the existing common
   * case, and safe even for email-shaped usernames since `USERNAME_REGEX`
   * disallows '@' at registration time), falling back to an email lookup
   * when the identifier looks like an email.
   *
   * `DevBypassUserStore.getByEmail` is explicitly a pass-through (not
   * synthesized), so an email-shaped bypass login that doesn't match a real
   * record still falls through to the synthetic-username bypass path via
   * `getByUsername` — this method is not reached in dev-bypass mode since
   * {@link authenticate} short-circuits before it, but the ordering keeps
   * behavior consistent if that ever changes.
   *
   * @param identifier  The raw sign-in field value — may be a username or an email.
   */
  private async resolveUser(identifier: string): Promise<UserRecord | undefined> {
    const byUsername = await this.userStore.getByUsername(identifier);
    if (byUsername) return byUsername;
    if (identifier.includes('@')) {
      return this.userStore.getByEmail(identifier);
    }
    return undefined;
  }

  /**
   * Authenticates the user via Supabase Auth's signInWithPassword.
   *
   * Safe to call only when `user.supabaseAuthId !== null` (which implies
   * `user.email !== null` — both are set atomically during registration or
   * the add-email flow). Per-account lockout counters are still applied
   * locally so the existing brute-force protection is not lost.
   *
   * Returns a clear message when the email has not yet been confirmed so the
   * user knows they need to click the confirmation link.
   *
   * @param user  The resolved UserRecord (supabaseAuthId guaranteed non-null).
   * @param password  The plaintext password from the login request.
   * @param now  Current epoch milliseconds.
   */
  private async authenticateViaSupabase(user: UserRecord, password: string, now: number): Promise<AuthResult> {
    this.loggerService.debug(`[auth:user] authenticating '${user.username}' via Supabase Auth`);

    let client;
    try {
      client = this.supabaseClientProvider.get();
    } catch (err) {
      this.loggerService.error(`[auth:user] Supabase client not available for login: ${err}`);
      return { ok: false, message: 'Authentication service unavailable' };
    }

    // Use an ephemeral client so signInWithPassword does not set a session on
    // the shared client. The shared client must always use the service-role key
    // for data operations; letting it accumulate user sessions from concurrent
    // logins would cause PostgREST permission errors.
    const ephemeral = this.supabaseClientProvider.createEphemeralClient();
    const { data, error } = await ephemeral.auth.signInWithPassword({
      // Non-null assertion is safe: supabaseAuthId !== null implies email !== null
      // because both are set atomically in handleRegister / attachEmail flow.
      email: user.email!,
      password,
    });

    if (error) {
      // Email not confirmed yet — surface a clear message so the user knows
      // to check their inbox rather than seeing a generic "wrong password".
      if (error.code === 'email_not_confirmed') {
        this.loggerService.info(`[auth:user] login rejected for '${user.username}': email not confirmed`);
        return { ok: false, message: 'Please confirm your email before signing in' };
      }

      // Any other Supabase error is treated as a credential failure. Increment
      // the local failure counter and apply lockout if the threshold is crossed.
      const updated = await this.userStore.recordFailure(user.id, now);
      this.loggerService.debug(
        `[auth:user] Supabase Auth rejected '${user.username}': ${error.message} (failures=${updated.failedAttempts})`,
      );

      const threshold = this.serverConfigService.getAuthLockoutThreshold();
      if (updated.failedAttempts >= threshold) {
        const durationMs = this.serverConfigService.getAuthLockoutDurationMs();
        this.userStore.setLockedUntil(user.id, now + durationMs);
        this.loggerService.warn(
          `[auth:user] account '${user.username}' locked for ${durationMs}ms after Supabase Auth failure (failures=${updated.failedAttempts})`,
        );
      }

      return { ok: false, message: 'Username/password does not match' };
    }

    if (!data.user) {
      // Defensive: success response with no user object — should never happen.
      this.loggerService.error(`[auth:user] Supabase Auth returned ok but no user for '${user.username}'`);
      return { ok: false, message: 'Authentication failed' };
    }

    // Successful Supabase Auth login — reset local failure counters.
    this.userStore.resetFailures(user.id);
    this.loggerService.info(`[auth:user] Supabase Auth login succeeded for '${user.username}'`);
    return { ok: true, username: user.username };
  }

  /**
   * Authenticates the user via the local argon2id (or legacy bcrypt) hash.
   *
   * Used by:
   * - in-memory backend (always)
   * - supabase backend with legacy rows (supabaseAuthId === null) until the
   *   user attaches an email via the add-email flow.
   *
   * Successful bcrypt logins trigger an opportunistic rehash to argon2id so
   * stored hashes migrate forward without operator intervention.
   *
   * @param user  The resolved UserRecord.
   * @param password  The plaintext password from the login request.
   * @param now  Current epoch milliseconds.
   */
  private async authenticateViaArgon2(user: UserRecord, password: string, now: number): Promise<AuthResult> {
    this.loggerService.debug(`[auth:user] authenticating '${user.username}' via local argon2id`);

    // Select the verifier based on the algorithm recorded at hash time.
    const verifier = user.passwordAlgo === 'argon2id' ? this.argon2idHasher : this.bcryptHasher;
    const valid = await verifier.verify(password, user.passwordHash);

    if (!valid) {
      const updated = await this.userStore.recordFailure(user.id, now);
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
    // Gate rehash behind non-supabase backends or legacy supabase rows so we
    // don't pointlessly rehash a supabase-auth user's empty sentinel hash.
    const backend = this.serverConfigService.getStorageBackend();
    if (user.passwordAlgo === 'bcrypt' && (backend !== 'supabase' || user.supabaseAuthId === null)) {
      try {
        const newHash = await this.argon2idHasher.hash(password);
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
