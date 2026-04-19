/**
 * Result of an authentication attempt from a provider.
 *
 * Successful results include the authenticated username. Failed results
 * include an error message suitable for client display.
 */
export type AuthResult =
  | { ok: true; username: string }
  | { ok: false; message: string };

/**
 * Contract for pluggable authentication providers.
 *
 * Each provider handles one authentication method (e.g. user account,
 * OAuth, guest access). Providers are registered with AuthSessionService
 * by name and invoked when a login request specifies that provider.
 *
 * To add a new auth method:
 * 1. Create a class implementing this interface
 * 2. Register it in the DI container
 * 3. Register it with AuthSessionService during startup
 */
export interface AuthProvider {
  /** Unique name for this provider (e.g. 'password', 'oauth', 'guest'). */
  readonly name: string;

  /**
   * Validates the given credentials and returns an AuthResult.
   * The shape of credentials varies by provider.
   */
  authenticate(credentials: Record<string, unknown>): Promise<AuthResult>;

  /**
   * Optional one-time initialization called during server startup.
   * Use for tasks like priming a dummy hash or loading keys.
   */
  initialize?(): Promise<void>;
}
