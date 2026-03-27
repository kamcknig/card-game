import { LoggerService } from '../logger-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';

/**
 * Manages auth sessions and delegates authentication to registered providers.
 *
 * Session management (token creation, validation, removal) is universal
 * across all auth methods. The provider registry allows new auth methods
 * to be added by registering an AuthProvider implementation.
 *
 * Lifetime: Root singleton — shared across all connections.
 * Consumers: ServerAuthRouteHandlerService, ServerSocketGatewayService.
 */
export class AuthSessionService {
  // Maps auth tokens to authenticated usernames.
  private readonly sessions = new Map<string, string>();
  // Maps provider names to their implementations.
  private readonly providers = new Map<string, AuthProvider>();

  constructor(
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Registers an auth provider by name.
   *
   * Call once per supported auth method during server startup, before
   * initializeProviders(). Duplicate registrations are ignored with a warning.
   */
  public registerProvider(provider: AuthProvider): void {
    if (this.providers.has(provider.name)) {
      this.loggerService.warn(`[auth] provider '${provider.name}' already registered, skipping`);
      return;
    }

    this.providers.set(provider.name, provider);
    this.loggerService.info(`[auth] registered provider '${provider.name}'`);
  }

  /**
   * Initializes all registered providers.
   *
   * Calls each provider's optional initialize() method in registration order.
   * Call once during server startup after all providers are registered.
   */
  public async initializeProviders(): Promise<void> {
    for (const [name, provider] of this.providers) {
      if (provider.initialize) {
        this.loggerService.info(`[auth] initializing provider '${name}'`);
        await provider.initialize();
      }
    }
    this.loggerService.info(`[auth] all providers initialized (${this.providers.size} total)`);
  }

  /**
   * Attempts login via the named provider and creates a session on success.
   *
   * Returns a token and username on success. Returns an error result when
   * the provider is unknown or credentials are rejected.
   */
  public async login(
    providerName: string,
    credentials: Record<string, unknown>,
  ): Promise<{ ok: true; token: string; username: string } | { ok: false; message: string }> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      this.loggerService.debug(`[auth] login rejected: unknown provider '${providerName}'`);
      return { ok: false, message: 'Unknown authentication provider' };
    }

    const result: AuthResult = await provider.authenticate(credentials);
    if (!result.ok) {
      this.loggerService.debug(`[auth] login rejected by provider '${providerName}': ${result.message}`);
      return result;
    }

    const token = crypto.randomUUID();
    this.sessions.set(token, result.username);
    this.loggerService.info(`[auth] login successful for '${result.username}' via '${providerName}'`);
    return { ok: true, token, username: result.username };
  }

  /**
   * Validates an auth token and returns the associated username.
   *
   * Returns undefined when the token is unknown or has been removed.
   */
  public validateToken(token: string): string | undefined {
    return this.sessions.get(token);
  }

  /**
   * Removes an auth session by token.
   *
   * A no-op when the token does not exist.
   */
  public removeSession(token: string): void {
    this.sessions.delete(token);
  }
}
