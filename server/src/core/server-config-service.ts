import { toNumber } from 'es-toolkit/compat';

// Centralizes server configuration reads from environment variables.
export class ServerConfigService {
  // Validates all startup configuration used by the server process.
  public validate(): void {
    this.getPort();
    this.getAuthAllowedOrigins();
    this.getAuthRateLimitMaxAttempts();
    this.getAuthRateLimitWindowMs();
    this.getAuthMaxBodyBytes();
    this.getAuthSessionTtlMs();
    const storeKind = this.getSessionStoreKind();
    // Eagerly validate the path config for the kv backend when configured.
    if (storeKind === 'kv') this.getAuthKvPath();
    this.getAuthLockoutThreshold();
    this.getAuthLockoutDurationMs();
    this.getAuthMinPasswordLength();
    this.isFileLoggingEnabled();
    this.getLogFileMaxBytes();
    this.isMatchStateExportEnabled();
    this.isMatchStateMergeEnabled();
    this.shouldEndMatchOnNoHumans();
    this.getTooltipDefaultCloseDelayMs();
  }

  /**
   * Returns the allowlist of origins that may make authenticated requests.
   *
   * Comma-separated list. An entry of `*` allows any origin and should only
   * be used for local development. When unset, defaults to `*` in
   * development convenience mode but logs a warning on startup.
   */
  public getAuthAllowedOrigins(): string[] {
    const raw = Deno.env.get('AUTH_ALLOWED_ORIGINS');
    if (!raw || !raw.trim()) {
      return ['*'];
    }
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Returns the maximum number of failed logins per IP per window before rate-limiting.
  public getAuthRateLimitMaxAttempts(): number {
    return this.parseIntEnv('AUTH_RATE_LIMIT_MAX_ATTEMPTS', 10, { min: 1 });
  }

  // Returns the sliding-window duration (in milliseconds) used by the login rate limiter.
  public getAuthRateLimitWindowMs(): number {
    return this.parseIntEnv('AUTH_RATE_LIMIT_WINDOW_MS', 60_000, { min: 1_000 });
  }

  // Returns the maximum request body size (bytes) accepted on /auth/login.
  public getAuthMaxBodyBytes(): number {
    return this.parseIntEnv('AUTH_MAX_BODY_BYTES', 4096, { min: 256, max: 1_048_576 });
  }

  /**
   * Returns the session time-to-live in milliseconds (sliding window).
   *
   * Each validated token has its expiry extended by this amount. Sessions
   * that are never re-validated expire after this duration from their last
   * activity. Defaults to 7 days. Configurable via AUTH_SESSION_TTL_MS.
   */
  public getAuthSessionTtlMs(): number {
    return this.parseIntEnv('AUTH_SESSION_TTL_MS', 7 * 24 * 60 * 60 * 1000, { min: 1_000 });
  }

  /**
   * Returns the session store backend to use.
   *
   * Reads from AUTH_SESSION_STORE. Valid values are 'memory' (default) and
   * 'kv'. An unrecognized value throws at startup.
   * - 'memory': in-process Map, sessions lost on restart (default, dev/tests).
   * - 'kv': Deno KV with write-through cache, sessions survive restarts.
   */
  public getSessionStoreKind(): 'memory' | 'kv' {
    const raw = Deno.env.get('AUTH_SESSION_STORE');
    if (!raw || !raw.trim()) {
      return 'memory';
    }
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'memory' || trimmed === 'kv') {
      return trimmed;
    }
    throw new Error(`[server config] AUTH_SESSION_STORE must be 'memory' or 'kv', received '${raw}'`);
  }

  /**
   * Returns the filesystem path for the Deno KV auth store.
   *
   * Reads from AUTH_KV_PATH. Defaults to './game-data/auth.kv'. Used only
   * when AUTH_SESSION_STORE=kv. The containing directory must exist before
   * the server starts. Pass ':memory:' to use an in-process KV store (dev
   * and tests only — data is not persisted).
   */
  public getAuthKvPath(): string {
    return Deno.env.get('AUTH_KV_PATH') ?? './game-data/auth.kv';
  }

  /**
   * Returns the number of consecutive failed login attempts before a user
   * account is locked.
   *
   * Configurable via AUTH_LOCKOUT_THRESHOLD. Defaults to 5.
   */
  public getAuthLockoutThreshold(): number {
    return this.parseIntEnv('AUTH_LOCKOUT_THRESHOLD', 5, { min: 1 });
  }

  /**
   * Returns the lockout duration (milliseconds) applied after a user account
   * exceeds the lockout threshold.
   *
   * Configurable via AUTH_LOCKOUT_DURATION_MS. Defaults to 10 minutes. The lock is cleared automatically on the next successful login
   * after the window elapses.
   */
  public getAuthLockoutDurationMs(): number {
    return this.parseIntEnv('AUTH_LOCKOUT_DURATION_MS', 10 * 60_000, { min: 1_000 });
  }

  /**
   * Returns the minimum password length accepted during user registration or
   * password change.
   *
   * Configurable via AUTH_MIN_PASSWORD_LENGTH. Defaults to 10.
   * Passwords matching the username (case-insensitive) are always rejected
   * regardless of length.
   */
  public getAuthMinPasswordLength(): number {
    return this.parseIntEnv('AUTH_MIN_PASSWORD_LENGTH', 10, { min: 1, max: 256 });
  }

  // Returns the configured server port or default port 3001.
  public getPort(): number {
    const rawPort = Deno.env.get('PORT');
    if (!rawPort) {
      return 3001;
    }

    const parsedPort = toNumber(rawPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new Error(`[server config] PORT must be an integer between 1 and 65535, received '${rawPort}'`);
    }

    return parsedPort;
  }

  // Returns true when file logging is enabled.
  public isFileLoggingEnabled(): boolean {
    return this.parseBooleanEnv('LOG_TO_FILE', false);
  }

  // Returns the maximum file size (in bytes) before rotating a log file.
  public getLogFileMaxBytes(): number {
    const rawValue = Deno.env.get('LOG_FILE_MAX_BYTES');
    if (!rawValue) {
      // Default to 5MB when not configured.
      return 5 * 1024 * 1024;
    }

    const parsedValue = toNumber(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      throw new Error(`[server config] LOG_FILE_MAX_BYTES must be a positive integer, received '${rawValue}'`);
    }

    return parsedValue;
  }

  // Returns true when match state export debug endpoint is enabled.
  public isMatchStateExportEnabled(): boolean {
    return this.parseBooleanEnv('MATCH_STATE_EXPORT_ENABLED', false);
  }

  // Returns true when match state merge debug endpoint is enabled.
  public isMatchStateMergeEnabled(): boolean {
    return this.parseBooleanEnv('MATCH_STATE_MERGE_ENABLED', false);
  }

  // Returns true when matches should end if all humans disconnect.
  public shouldEndMatchOnNoHumans(): boolean {
    return this.parseBooleanEnv('END_MATCH_ON_NO_HUMANS', true);
  }

  // Returns optional match state override path.
  public getMatchStatePath(): string | undefined {
    return Deno.env.get('MATCH_STATE_PATH');
  }

  // Returns optional default tooltip close delay (milliseconds) for client UI behavior.
  public getTooltipDefaultCloseDelayMs(): number | undefined {
    const rawValue = Deno.env.get('TOOLTIP_DEFAULT_CLOSE_DELAY_MS');
    if (!rawValue) {
      return undefined;
    }

    const parsedValue = toNumber(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
      throw new Error(
        `[server config] TOOLTIP_DEFAULT_CLOSE_DELAY_MS must be a non-negative integer, received '${rawValue}'`,
      );
    }

    return parsedValue;
  }

  // Parses strict boolean env values ('true' | 'false') with a default.
  private parseBooleanEnv(name: string, defaultValue: boolean): boolean {
    const rawValue = Deno.env.get(name);
    if (!rawValue) {
      return defaultValue;
    }

    const normalizedValue = rawValue.trim().toLowerCase();
    if (normalizedValue === 'true') {
      return true;
    }
    if (normalizedValue === 'false') {
      return false;
    }

    throw new Error(`[server config] ${name} must be 'true' or 'false', received '${rawValue}'`);
  }

  /**
   * Parses an integer environment variable with optional min/max bounds.
   *
   * Returns the default value when the variable is unset or empty.
   * Throws a descriptive error when the value is not a valid integer or
   * falls outside the given bounds.
   */
  private parseIntEnv(name: string, defaultValue: number, bounds?: { min?: number; max?: number }): number {
    const rawValue = Deno.env.get(name);
    if (!rawValue) {
      return defaultValue;
    }

    const parsedValue = toNumber(rawValue);
    if (!Number.isInteger(parsedValue)) {
      throw new Error(`[server config] ${name} must be an integer, received '${rawValue}'`);
    }

    if (bounds?.min !== undefined && parsedValue < bounds.min) {
      throw new Error(`[server config] ${name} must be >= ${bounds.min}, received '${rawValue}'`);
    }

    if (bounds?.max !== undefined && parsedValue > bounds.max) {
      throw new Error(`[server config] ${name} must be <= ${bounds.max}, received '${rawValue}'`);
    }

    return parsedValue;
  }
}
