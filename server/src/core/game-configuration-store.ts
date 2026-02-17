import {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  LandmarkNoId,
  MatchConfiguration,
  Supply,
} from 'shared/types/index.ts';
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
    // Restore banned kingdoms when the file exists.
    const bannedKingdoms = this.readJson<CardNoId[]>('./banned-kingdoms.json', 'banned-kingdoms.json');
    if (bannedKingdoms) {
      defaultConfig.bannedKingdoms = bannedKingdoms;
    }

    // Restore preselected kingdoms when the file exists.
    const preselectedKingdoms = this.readJson<{ name: string; cards: CardNoId[] }[]>(
      './preselected-kingdoms.json',
      'preselected-kingdoms.json',
    );
    if (preselectedKingdoms) {
      if (preselectedKingdoms.length > 0) {
        this.loggerService.debug(preselectedKingdoms);
      }
      defaultConfig.preselectedKingdoms = preselectedKingdoms.map((supply) => supply.cards[0]);
    }

    // Restore preselected events when the file exists.
    const preselectedEvents = this.readJson<EventNoId[]>('./preselected-events.json', 'preselected-events.json');
    if (preselectedEvents) {
      if (preselectedEvents.length > 0) {
        this.loggerService.debug(preselectedEvents);
      }
      defaultConfig.events = preselectedEvents;
    }

    // Restore preselected landmarks when the file exists.
    const preselectedLandmarks = this.readJson<LandmarkNoId[]>(
      './preselected-landmarks.json',
      'preselected-landmarks.json',
    );
    if (preselectedLandmarks) {
      if (preselectedLandmarks.length > 0) {
        this.loggerService.debug(preselectedLandmarks);
      }
      defaultConfig.landmarks = preselectedLandmarks;
    }

    // Restore preselected artifacts when the file exists.
    const preselectedArtifacts = this.readJson<ArtifactNoId[]>(
      './preselected-artifacts.json',
      'preselected-artifacts.json',
    );
    if (preselectedArtifacts) {
      if (preselectedArtifacts.length > 0) {
        this.loggerService.debug(preselectedArtifacts);
      }
      defaultConfig.artifacts = preselectedArtifacts;
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
