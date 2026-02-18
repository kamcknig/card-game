import {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  LandmarkNoId,
  MatchConfiguration,
  ProjectNoId,
  Supply,
} from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';
import { getMatchConfigDirectory } from './game-data-paths.ts';

// Represents the persisted lobby configuration read/write contract.
export interface GameConfigurationStore {
  // Selects which match scope this store should read/write persisted config from.
  setMatchScopeId(matchScopeId: number): void;
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
  // Persists the current preselected projects.
  persistProjects(projects: ProjectNoId[]): void;
}

// File-backed implementation used by the production server runtime.
export class FileGameConfigurationStore implements GameConfigurationStore {
  private matchScopeId = 0;

  constructor(
    private readonly loggerService: LoggerService,
    private readonly gameId: string,
  ) {}

  // Sets the active match scope used for per-match persistence paths.
  public setMatchScopeId(matchScopeId: number): void {
    this.matchScopeId = matchScopeId;
    this.loggerService.info(
      `[game config store] using persistence scope game='${this.gameId}' matchScopeId='${matchScopeId}'`,
    );
  }

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
  private readJson<T>(fileName: string): T | undefined {
    const filePath = this.getFilePath(fileName);
    try {
      return JSON.parse(Deno.readTextFileSync(filePath)) as T;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        this.loggerService.debug(`[game config store] no persisted file '${fileName}' for current match scope`);
        return undefined;
      }
      this.loggerService.warn(`[game config store] couldn't read ${fileName}`);
      this.loggerService.error(error);
      return undefined;
    }
  }

  // Returns the per-match directory used to persist configuration files.
  private getMatchDirectory(): string {
    return getMatchConfigDirectory(this.gameId, this.matchScopeId);
  }

  // Builds one full path under the current per-match persistence directory.
  private getFilePath(fileName: string): string {
    return `${this.getMatchDirectory()}/${fileName}`;
  }

  // Creates the current per-match persistence directory when writing files.
  private ensureMatchDirectory(): void {
    Deno.mkdirSync(this.getMatchDirectory(), { recursive: true });
  }

  public load(defaultConfig: MatchConfiguration): void {
    this.loggerService.info('[game config store] loading persisted match configuration');

    // Restore banned kingdoms when the file exists.
    const bannedKingdoms = this.readJson<CardNoId[]>('banned-kingdoms.json');
    if (bannedKingdoms) {
      defaultConfig.bannedKingdoms = bannedKingdoms;
      this.logLoadedList(
        'banned kingdom card(s)',
        bannedKingdoms.length,
        bannedKingdoms.map((card) => card.cardKey),
      );
    }

    // Restore preselected kingdoms when the file exists.
    const preselectedKingdoms = this.readJson<{ name: string; cards: CardNoId[] }[]>('preselected-kingdoms.json');
    if (preselectedKingdoms) {
      defaultConfig.preselectedKingdoms = preselectedKingdoms.map((supply) => supply.cards[0]);
      this.logLoadedList(
        'preselected kingdom pile(s)',
        preselectedKingdoms.length,
        preselectedKingdoms.map((supply) => supply.name),
      );
    }

    // Restore preselected events when the file exists.
    const preselectedEvents = this.readJson<EventNoId[]>('preselected-events.json');
    if (preselectedEvents) {
      defaultConfig.events = preselectedEvents;
      this.logLoadedList(
        'preselected event(s)',
        preselectedEvents.length,
        preselectedEvents.map((event) => event.cardKey),
      );
    }

    // Restore preselected landmarks when the file exists.
    const preselectedLandmarks = this.readJson<LandmarkNoId[]>('preselected-landmarks.json');
    if (preselectedLandmarks) {
      defaultConfig.landmarks = preselectedLandmarks;
      this.logLoadedList(
        'preselected landmark(s)',
        preselectedLandmarks.length,
        preselectedLandmarks.map((landmark) => landmark.cardKey),
      );
    }

    // Restore preselected artifacts when the file exists.
    const preselectedArtifacts = this.readJson<ArtifactNoId[]>('preselected-artifacts.json');
    if (preselectedArtifacts) {
      defaultConfig.artifacts = preselectedArtifacts;
      this.logLoadedList(
        'preselected artifact(s)',
        preselectedArtifacts.length,
        preselectedArtifacts.map((artifact) => artifact.cardKey),
      );
    }

    // Restore preselected projects when the file exists.
    const preselectedProjects = this.readJson<ProjectNoId[]>('preselected-projects.json');
    if (preselectedProjects) {
      defaultConfig.projects = preselectedProjects;
      this.logLoadedList(
        'preselected project(s)',
        preselectedProjects.length,
        preselectedProjects.map((project) => project.cardKey),
      );
    }
  }

  public persistPreselectedKingdoms(kingdomSupply: Supply[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-kingdoms.json'), JSON.stringify(kingdomSupply));
  }

  public persistBannedKingdoms(bannedKingdoms: CardNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('banned-kingdoms.json'), JSON.stringify(bannedKingdoms));
  }

  public persistEvents(events: EventNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-events.json'), JSON.stringify(events));
  }

  public persistLandmarks(landmarks: LandmarkNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-landmarks.json'), JSON.stringify(landmarks));
  }

  public persistArtifacts(artifacts: ArtifactNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-artifacts.json'), JSON.stringify(artifacts));
  }

  public persistProjects(projects: ProjectNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-projects.json'), JSON.stringify(projects));
  }
}
