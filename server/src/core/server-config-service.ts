import { toNumber } from 'es-toolkit/compat';

// Centralizes server configuration reads from environment variables.
export class ServerConfigService {
  // Validates all startup configuration used by the server process.
  public validate(): void {
    this.getPort();
    this.isFileLoggingEnabled();
    this.isMatchStateExportEnabled();
    this.isMatchStateMergeEnabled();
    this.shouldEndMatchOnNoHumans();
    this.getRequisiteKingdomCardKeys();
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

  // Returns optional hard-coded requisite kingdom card keys.
  public getRequisiteKingdomCardKeys(): string[] {
    const rawValue = Deno.env.get('REQUISITE_KINGDOM_CARD_KEYS');
    if (!rawValue) {
      return [];
    }

    const entries = rawValue
      .toLowerCase()
      .split(',')
      .map((entry) => entry.trim());

    const emptyEntries = entries.filter((entry) => entry.length === 0);
    if (emptyEntries.length > 0) {
      throw new Error('[server config] REQUISITE_KINGDOM_CARD_KEYS contains empty entries');
    }

    const invalidEntries = entries.filter((entry) => !/^[a-z0-9-]+$/.test(entry));
    if (invalidEntries.length > 0) {
      throw new Error(
        `[server config] REQUISITE_KINGDOM_CARD_KEYS contains invalid keys: ${invalidEntries.join(', ')}`,
      );
    }

    return entries;
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
