import { LoggerService } from '../logger-service.ts';
import { ServerConfigService } from '../server-config-service.ts';
import { AuthProvider, AuthResult } from './auth-provider.ts';
import { Clock, systemClock } from './auth-rate-limiter-service.ts';

/**
 * Server-side metadata tracked per active session.
 *
 * Immutable fields are set at creation time. `lastActivityAt` and `expiresAt`
 * are updated on each successful `validateToken` call (sliding window).
 */
export interface SessionRecord {
  readonly token: string;
  readonly username: string;
  readonly providerName: string;
  readonly createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  readonly createdFromIp: string | undefined;
  readonly createdFromUserAgent: string | undefined;
}

/**
 * Manages auth sessions and delegates authentication to registered providers.
 *
 * Session management (token creation, validation, removal) is universal
 * across all auth methods. The provider registry allows new auth methods
 * to be added by registering an AuthProvider implementation.
 *
 * Phase 2 additions:
 * - Sessions are now stored as `SessionRecord` values with expiry metadata.
 * - `validateToken` extends the expiry on each call (sliding window).
 * - `listSessions` prunes expired entries and returns a snapshot.
 * - `removeSessionsForUsername` / `removeSessionsForUsernameExcept` allow
 *   bulk revocation (used by the admin endpoints and password-change flow).
 * - Single-session enforcement: a new login revokes all prior sessions for
 *   that user so the most recent login is always the only valid one.
 * - The clock dependency is injectable so tests remain deterministic.
 *
 * Lifetime: Root singleton — shared across all connections.
 * Consumers: ServerAuthRouteHandlerService, ServerSocketGatewayService.
 */
export class AuthSessionService {
  // Maps auth tokens to their full session records.
  private readonly sessions = new Map<string, SessionRecord>();
  // Maps provider names to their implementations.
  private readonly providers = new Map<string, AuthProvider>();

  constructor(
    private readonly loggerService: LoggerService,
    private readonly serverConfigService: ServerConfigService,
    private readonly clock: Clock = systemClock,
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
   * the provider is unknown or credentials are rejected. An optional context
   * object supplies request metadata (IP, user-agent) stored on the record.
   *
   * @param providerName Name of the registered auth provider to authenticate with.
   * @param credentials  Raw credential payload forwarded to the provider.
   * @param context      Optional HTTP request context for audit metadata.
   */
  public async login(
    providerName: string,
    credentials: Record<string, unknown>,
    context?: { ip?: string; userAgent?: string },
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
    const now = this.clock.now();
    const ttlMs = this.serverConfigService.getAuthSessionTtlMs();

    // Single-session enforcement: revoke all prior sessions for this user so
    // the newest login is always the only valid one.
    const prior = this.removeSessionsForUsername(result.username);
    if (prior > 0) {
      this.loggerService.info(`[auth] revoked ${prior} prior session(s) for '${result.username}' on new login`);
    }

    this.sessions.set(token, {
      token,
      username: result.username,
      providerName,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + ttlMs,
      createdFromIp: context?.ip,
      createdFromUserAgent: context?.userAgent,
    });

    this.loggerService.info(`[auth] login successful for '${result.username}' via '${providerName}'`);
    return { ok: true, token, username: result.username };
  }

  /**
   * Validates an auth token and returns the associated username.
   *
   * Returns undefined when the token is unknown or has expired. When the
   * token is valid, extends its expiry by the configured TTL (sliding window)
   * and updates `lastActivityAt`.
   */
  public validateToken(token: string): string | undefined {
    const rec = this.sessions.get(token);
    if (!rec) return undefined;

    const now = this.clock.now();
    if (rec.expiresAt <= now) {
      this.sessions.delete(token);
      this.loggerService.debug(`[auth] session expired: ${this.tokenTail(token)}`);
      return undefined;
    }

    // Sliding window: extend the expiry on every successful validation.
    const ttlMs = this.serverConfigService.getAuthSessionTtlMs();
    rec.lastActivityAt = now;
    rec.expiresAt = now + ttlMs;

    return rec.username;
  }

  /**
   * Removes an auth session by token.
   *
   * A no-op when the token does not exist.
   */
  public removeSession(token: string): void {
    this.sessions.delete(token);
  }

  /**
   * Enumerates all currently-active (non-expired) sessions.
   *
   * Prunes expired entries as a side effect, so callers see only live
   * records. Returns a snapshot array; the backing map may be mutated
   * concurrently (not an issue in single-threaded JS).
   */
  public listSessions(): ReadonlyArray<SessionRecord> {
    const now = this.clock.now();
    for (const [token, rec] of this.sessions) {
      if (rec.expiresAt <= now) {
        this.sessions.delete(token);
        this.loggerService.debug(`[auth] pruned expired session: ${this.tokenTail(token)}`);
      }
    }
    return [...this.sessions.values()];
  }

  /**
   * Removes every session belonging to a specific username.
   *
   * Returns the count of removed sessions. Used by bulk-revoke operations
   * such as password change or admin-initiated sign-out-all.
   *
   * @param username Username whose sessions should all be invalidated.
   */
  public removeSessionsForUsername(username: string): number {
    let removed = 0;
    for (const [token, rec] of this.sessions) {
      if (rec.username === username) {
        this.sessions.delete(token);
        removed++;
      }
    }
    this.loggerService.info(`[auth] removed ${removed} session(s) for '${username}'`);
    return removed;
  }

  /**
   * Removes every session belonging to a username except one specified token.
   *
   * Returns the count of removed sessions. Used by DELETE /auth/sessions with
   * `keepCurrent=true` so the caller's own session survives the revocation.
   *
   * @param username  Username whose sessions should be invalidated.
   * @param keepToken Token to preserve (the caller's current session).
   */
  public removeSessionsForUsernameExcept(username: string, keepToken: string): number {
    let removed = 0;
    for (const [token, rec] of this.sessions) {
      if (rec.username === username && token !== keepToken) {
        this.sessions.delete(token);
        removed++;
      }
    }
    this.loggerService.info(`[auth] removed ${removed} session(s) for '${username}' (kept current)`);
    return removed;
  }

  /**
   * Returns the last 6 characters of a token for safe log output.
   *
   * Full tokens must not appear in logs to prevent session hijacking via
   * log access. The suffix provides enough context for correlation without
   * exposing the full secret.
   */
  private tokenTail(token: string): string {
    return `...${token.slice(-6)}`;
  }
}
