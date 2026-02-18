import { ArtifactNoId, CardNoId, EventNoId, LandmarkNoId, MatchConfiguration, Supply } from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';

// Represents the persisted lobby configuration read/write contract.
export interface GameConfigurationStore {
  // Loads persisted lobby configuration values into the provided default match config object.
  load(defaultConfig: MatchConfiguration): void;
  // Persists the current preselected kingdom supply list.
  persistPreselectedKingdoms(kingdomSupply: Supply[]): void;
  // Persists the current banned kingdom list.
  persistBannedKingdoms(bannedKingdoms: CardNoId[]): void;
  // Persists the current preselected events.
  persistEvents(events: EventNoId[]): void;
  // Persists the current preselected landmarks.
  persistLandmarks(landmarks: LandmarkNoId[]): void;
  // Persists the current preselected artifacts.
  persistArtifacts(artifacts: ArtifactNoId[]): void;
}

// File-backed implementation used by the production server runtime.
export class FileGameConfigurationStore implements GameConfigurationStore {
  constructor(
    private readonly loggerService: LoggerService,
  ) {}

  // Emits a concise summary for loaded persisted config lists.
  private logLoadedList(label: string, count: number, values: string[]): void {
    if (count < 1) {
      return;
    }

    const preview = values.slice(0, 10).join(', ');
    const hasMore = values.length > 10;
    this.loggerService.info(
      `[game config store] loaded ${count} ${label}${preview ? ` (${preview}${hasMore ? ', ...' : ''})` : ''}`,
    );
  }

  // Safely reads JSON from disk and returns undefined when unavailable.
  private readJson<T>(filePath: string, logLabel: string): T | undefined {
    try {
      return JSON.parse(Deno.readTextFileSync(filePath)) as T;
    } catch (error) {
      this.loggerService.warn(`[game config store] couldn't read ${logLabel}`);
      this.loggerService.error(error);
      return undefined;
    }
  }

  public load(defaultConfig: MatchConfiguration): void {
    this.loggerService.info('[game config store] loading persisted match configuration');

    // Restore banned kingdoms when the file exists.
    const bannedKingdoms = this.readJson<CardNoId[]>('./banned-kingdoms.json', 'banned-kingdoms.json');
    if (bannedKingdoms) {
      defaultConfig.bannedKingdoms = bannedKingdoms;
      this.logLoadedList(
        'banned kingdom card(s)',
        bannedKingdoms.length,
        bannedKingdoms.map((card) => card.cardKey),
      );
    }

    // Restore preselected kingdoms when the file exists.
    const preselectedKingdoms = this.readJson<{ name: string; cards: CardNoId[] }[]>(
      './preselected-kingdoms.json',
      'preselected-kingdoms.json',
    );
    if (preselectedKingdoms) {
      defaultConfig.preselectedKingdoms = preselectedKingdoms.map((supply) => supply.cards[0]);
      this.logLoadedList(
        'preselected kingdom pile(s)',
        preselectedKingdoms.length,
        preselectedKingdoms.map((supply) => supply.name),
      );
    }

    // Restore preselected events when the file exists.
    const preselectedEvents = this.readJson<EventNoId[]>('./preselected-events.json', 'preselected-events.json');
    if (preselectedEvents) {
      defaultConfig.events = preselectedEvents;
      this.logLoadedList(
        'preselected event(s)',
        preselectedEvents.length,
        preselectedEvents.map((event) => event.cardKey),
      );
    }

    // Restore preselected landmarks when the file exists.
    const preselectedLandmarks = this.readJson<LandmarkNoId[]>(
      './preselected-landmarks.json',
      'preselected-landmarks.json',
    );
    if (preselectedLandmarks) {
      defaultConfig.landmarks = preselectedLandmarks;
      this.logLoadedList(
        'preselected landmark(s)',
        preselectedLandmarks.length,
        preselectedLandmarks.map((landmark) => landmark.cardKey),
      );
    }

    // Restore preselected artifacts when the file exists.
    const preselectedArtifacts = this.readJson<ArtifactNoId[]>(
      './preselected-artifacts.json',
      'preselected-artifacts.json',
    );
    if (preselectedArtifacts) {
      defaultConfig.artifacts = preselectedArtifacts;
      this.logLoadedList(
        'preselected artifact(s)',
        preselectedArtifacts.length,
        preselectedArtifacts.map((artifact) => artifact.cardKey),
      );
    }
  }

  public persistPreselectedKingdoms(kingdomSupply: Supply[]): void {
    Deno.writeTextFileSync('./preselected-kingdoms.json', JSON.stringify(kingdomSupply));
  }

  public persistBannedKingdoms(bannedKingdoms: CardNoId[]): void {
    Deno.writeTextFileSync('./banned-kingdoms.json', JSON.stringify(bannedKingdoms));
  }

  public persistEvents(events: EventNoId[]): void {
    Deno.writeTextFileSync('./preselected-events.json', JSON.stringify(events));
  }

  public persistLandmarks(landmarks: LandmarkNoId[]): void {
    Deno.writeTextFileSync('./preselected-landmarks.json', JSON.stringify(landmarks));
  }

  public persistArtifacts(artifacts: ArtifactNoId[]): void {
    Deno.writeTextFileSync('./preselected-artifacts.json', JSON.stringify(artifacts));
  }
}
