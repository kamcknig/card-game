import { toNumber } from 'es-toolkit/compat';

// Centralizes server configuration reads from environment variables.
export class ServerConfigService {
  // Returns the configured server port or default port 3001.
  public getPort(): number {
    return toNumber(Deno.env.get('PORT')) || 3001;
  }

  // Returns true when file logging is enabled.
  public isFileLoggingEnabled(): boolean {
    return Deno.env.get('LOG_TO_FILE')?.trim().toLowerCase() === 'true';
  }

  // Returns true when match state export debug endpoint is enabled.
  public isMatchStateExportEnabled(): boolean {
    return Deno.env.get('MATCH_STATE_EXPORT_ENABLED') === 'true';
  }

  // Returns true when match state merge debug endpoint is enabled.
  public isMatchStateMergeEnabled(): boolean {
    return Deno.env.get('MATCH_STATE_MERGE_ENABLED') === 'true';
  }

  // Returns true when matches should end if all humans disconnect.
  public shouldEndMatchOnNoHumans(): boolean {
    const endOnNoHumansEnv = Deno.env.get('END_MATCH_ON_NO_HUMANS') ?? 'true';
    return endOnNoHumansEnv.toLowerCase() !== 'false';
  }

  // Returns optional match state override path.
  public getMatchStatePath(): string | undefined {
    return Deno.env.get('MATCH_STATE_PATH');
  }

  // Returns optional hard-coded requisite kingdom card keys.
  public getRequisiteKingdomCardKeys(): string[] {
    return Deno.env.get('REQUISITE_KINGDOM_CARD_KEYS')
      ?.toLowerCase()
      ?.split(',')
      ?.map((entry) => entry.trim())
      ?.filter((entry) => !!entry) ?? [];
  }
}
