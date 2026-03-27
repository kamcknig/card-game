import { compare, hash } from 'bcrypt';
import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';

/**
 * Auth provider that validates against a single preset password.
 *
 * The password is read from the AUTH_PASSWORD environment variable and
 * bcrypt-hashed during initialize(). If AUTH_PASSWORD is unset or blank,
 * password checking is skipped — any non-empty username is accepted.
 * Credentials must include `username` (non-empty string) and `password` (string).
 *
 * Lifetime: Root singleton — registered with AuthSessionService at startup.
 * Consumers: AuthSessionService.registerProvider().
 */
export class PresetPasswordAuthProvider implements AuthProvider {
  /** Provider name used to select this method in login requests. */
  readonly name = 'password';

  // Bcrypt hash of the preset password, set during initialize().
  private passwordHash: string | undefined;

  // True when AUTH_PASSWORD was blank — password validation is skipped.
  private noPassword = false;

  constructor(
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
  ) {}

  /**
   * Hashes the preset password from the AUTH_PASSWORD environment variable.
   *
   * If AUTH_PASSWORD is blank, sets noPassword=true and skips hashing.
   * Must be called before authenticate(). Called automatically by
   * AuthSessionService.initializeProviders() during server startup.
   */
  public async initialize(): Promise<void> {
    const presetPassword = this.serverConfigService.getAuthPassword();
    if (!presetPassword) {
      this.noPassword = true;
      this.loggerService.info('[auth:password] no preset password configured — password check disabled');
      return;
    }
    this.passwordHash = await hash(presetPassword);
    this.loggerService.info('[auth:password] preset password hashed');
  }

  /**
   * Validates username/password credentials against the preset password.
   *
   * If noPassword is true, only a non-empty username is required.
   * Otherwise, rejects empty usernames and invalid passwords with a generic
   * error message to avoid leaking information about which field was incorrect.
   */
  public async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    const username = typeof credentials['username'] === 'string' ? credentials['username'].trim() : '';

    if (!username) {
      this.loggerService.debug('[auth:password] rejected: empty username');
      return { ok: false, message: 'Username/password does not match' };
    }

    if (this.noPassword) {
      this.loggerService.debug(`[auth:password] no-password mode: accepted '${username}'`);
      return { ok: true, username };
    }

    if (!this.passwordHash) {
      this.loggerService.error('[auth:password] authenticate called before initialization');
      return { ok: false, message: 'Authentication service not ready' };
    }

    const password = typeof credentials['password'] === 'string' ? credentials['password'] : '';
    const valid = await compare(password, this.passwordHash);
    if (!valid) {
      this.loggerService.debug(`[auth:password] rejected for '${username}': invalid password`);
      return { ok: false, message: 'Username/password does not match' };
    }

    return { ok: true, username };
  }
}
