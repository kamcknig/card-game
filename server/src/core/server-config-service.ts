import { toNumber } from 'es-toolkit/compat';

// Centralizes server configuration reads from environment variables.
export class ServerConfigService {
  // Validates all startup configuration used by the server process.
  public validate(): void {
    this.getPort();
    this.getAuthPassword();
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
   * Returns an empty string if the variable is unset or blank, which signals
   * the auth provider to skip password validation (any username is accepted).
   */
  public getAuthPassword(): string {
    return Deno.env.get('AUTH_PASSWORD') ?? '';
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
}
