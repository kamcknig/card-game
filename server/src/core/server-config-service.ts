import { toNumber } from 'es-toolkit/compat';

// Centralizes server configuration reads from environment variables.
export class ServerConfigService {
  // Validates all startup configuration used by the server process.
  public validate(): void {
    this.getPort();
    this.validateAuthPasswordConfig();
    this.getAuthAllowedOrigins();
    this.getAuthRateLimitMaxAttempts();
    this.getAuthRateLimitWindowMs();
    this.getAuthMaxBodyBytes();
    this.getAuthSessionTtlMs();
    this.isFileLoggingEnabled();
    this.getLogFileMaxBytes();
    this.isMatchStateExportEnabled();
    this.isMatchStateMergeEnabled();
    this.shouldEndMatchOnNoHumans();
    this.getTooltipDefaultCloseDelayMs();
  }

  /**
   * Returns the preset authentication password from the AUTH_PASSWORD env var.
   *
   * Returns an empty string if the variable is unset or blank.
   */
  public getAuthPassword(): string {
    return Deno.env.get('AUTH_PASSWORD') ?? '';
  }

  /**
   * Returns true when authentication is explicitly disabled (dev/test only).
   *
   * When true, any non-empty username logs in without a password check.
   * When false/unset, AUTH_PASSWORD must be non-empty or startup will fail.
   */
  public isAuthDisabled(): boolean {
    return this.parseBooleanEnv('AUTH_DISABLED', false);
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

  /**
   * Validates the AUTH_PASSWORD / AUTH_DISABLED combination at startup.
   *
   * Throws when AUTH_DISABLED is not true and AUTH_PASSWORD is empty. This
   * eliminates the silent "blank AUTH_PASSWORD means no auth" backdoor —
   * disabling auth now requires explicit opt-in via AUTH_DISABLED=true.
   */
  private validateAuthPasswordConfig(): void {
    const disabled = this.isAuthDisabled();
    const password = this.getAuthPassword();
    if (!disabled && !password) {
      throw new Error(
        '[server config] AUTH_PASSWORD must be set when AUTH_DISABLED is not true. ' +
          'To explicitly disable authentication (dev only), set AUTH_DISABLED=true.',
      );
    }
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
