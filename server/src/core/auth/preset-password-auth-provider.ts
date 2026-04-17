import { compare, hash } from 'bcrypt';
import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';

/**
 * Auth provider that validates against a single preset password.
 *
 * The password is read from the AUTH_PASSWORD environment variable and
 * bcrypt-hashed during initialize(). Password checking is only skipped
 * when AUTH_DISABLED=true is explicitly set — blank AUTH_PASSWORD no
 * longer silently disables the check. Credentials must include `username`
 * (non-empty string) and `password` (string).
 *
 * Lifetime: Root singleton — registered with AuthSessionService at startup.
 * Consumers: AuthSessionService.registerProvider().
 */
export class PresetPasswordAuthProvider implements AuthProvider {
  /** Provider name used to select this method in login requests. */
  readonly name = 'password';

  // Bcrypt hash of the preset password, set during initialize().
  private passwordHash: string | undefined;

  // True when AUTH_DISABLED=true — password validation is skipped.
  private noPassword = false;

  constructor(
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  /**
   * Hashes the preset password from the AUTH_PASSWORD environment variable.
   *
   * When AUTH_DISABLED=true, sets noPassword=true and skips hashing with a
   * prominent warning. Otherwise, validateAuthPasswordConfig() at startup
   * guarantees AUTH_PASSWORD is non-empty by the time this runs.
   * Must be called before authenticate(). Called automatically by
   * AuthSessionService.initializeProviders() during server startup.
   */
  public async initialize(): Promise<void> {
    if (this.serverConfigService.isAuthDisabled()) {
      this.noPassword = true;
      this.loggerService.warn('[auth:password] AUTH_DISABLED=true — password check disabled. Do not use in production.');
      return;
    }

    // validateAuthPasswordConfig() at startup guarantees non-empty here.
    const presetPassword = this.serverConfigService.getAuthPassword();
    this.passwordHash = await hash(presetPassword);
    this.loggerService.info('[auth:password] preset password hashed');
  }

  /**
   * Validates username/password credentials against the preset password.
   *
   * If noPassword is true (AUTH_DISABLED=true), only a non-empty username is required.
   * Otherwise, rejects empty usernames and invalid passwords with a generic
   * error message to avoid leaking information about which field was incorrect.
   * The attempted username is intentionally omitted from rejection logs to
   * avoid leaking PII; the rate limiter tracks per-IP counts without it.
   */
  public async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const username = typeof credentials['username'] === 'string' ? credentials['username'].trim() : '';

    if (!username) {
      this.loggerService.debug('[auth:password] rejected: empty username');
      return { ok: false, message: 'Username/password does not match' };
    }

    if (this.noPassword) {
      this.loggerService.debug('[auth:password] no-password mode: accepted login');
      return { ok: true, username };
    }

    if (!this.passwordHash) {
      this.loggerService.error('[auth:password] authenticate called before initialization');
      return { ok: false, message: 'Authentication service not ready' };
    }

    const password = typeof credentials['password'] === 'string' ? credentials['password'] : '';
    const valid = await compare(password, this.passwordHash);
    if (!valid) {
      // Omit the attempted username from rejection logs to avoid logging PII.
      this.loggerService.debug('[auth:password] rejected: invalid password');
      return { ok: false, message: 'Username/password does not match' };
    }

    return { ok: true, username };
  }
}
