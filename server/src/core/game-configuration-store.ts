import {
  AllyNoId,
  CardNoId,
  EventNoId,
  LandmarkNoId,
  MatchConfiguration,
  ProphecyNoId,
  ProjectNoId,
  Supply,
  TraitNoId,
  WayNoId,
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
  // Persists the current preselected projects.
  persistProjects(projects: ProjectNoId[]): void;
  // Persists the current preselected ways.
  persistWays(ways: WayNoId[]): void;
  // Persists the current preselected traits.
  persistTraits(traits: TraitNoId[]): void;
  // Persists the current preselected ally.
  persistAllies(allies: AllyNoId[]): void;
  // Persists the current preselected prophecy.
  persistProphecies(prophecies: ProphecyNoId[]): void;
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
        bannedKingdoms.map(card => card.cardKey),
      );
    }

    // Restore preselected kingdoms when the file exists.
    const preselectedKingdoms = this.readJson<{ name: string; cards: CardNoId[] }[]>('preselected-kingdoms.json');
    if (preselectedKingdoms) {
      defaultConfig.preselectedKingdoms = preselectedKingdoms.map(supply => supply.cards[0]);
      this.logLoadedList(
        'preselected kingdom pile(s)',
        preselectedKingdoms.length,
        preselectedKingdoms.map(supply => supply.name),
      );
    }

    // Restore preselected events when the file exists.
    const preselectedEvents = this.readJson<EventNoId[]>('preselected-events.json');
    if (preselectedEvents) {
      defaultConfig.events = preselectedEvents;
      this.logLoadedList(
        'preselected event(s)',
        preselectedEvents.length,
        preselectedEvents.map(event => event.cardKey),
      );
    }

    // Restore preselected landmarks when the file exists.
    const preselectedLandmarks = this.readJson<LandmarkNoId[]>('preselected-landmarks.json');
    if (preselectedLandmarks) {
      defaultConfig.landmarks = preselectedLandmarks;
      this.logLoadedList(
        'preselected landmark(s)',
        preselectedLandmarks.length,
        preselectedLandmarks.map(landmark => landmark.cardKey),
      );
    }

    // Restore preselected projects when the file exists.
    const preselectedProjects = this.readJson<ProjectNoId[]>('preselected-projects.json');
    if (preselectedProjects) {
      defaultConfig.projects = preselectedProjects;
      this.logLoadedList(
        'preselected project(s)',
        preselectedProjects.length,
        preselectedProjects.map(project => project.cardKey),
      );
    }

    // Restore preselected ways when the file exists.
    const preselectedWays = this.readJson<WayNoId[]>('preselected-ways.json');
    if (preselectedWays) {
      defaultConfig.ways = preselectedWays;
      this.logLoadedList(
        'preselected way(s)',
        preselectedWays.length,
        preselectedWays.map(way => way.cardKey),
      );
    }

    // Restore preselected traits when the file exists.
    const preselectedTraits = this.readJson<TraitNoId[]>('preselected-traits.json');
    if (preselectedTraits) {
      defaultConfig.traits = preselectedTraits;
      this.logLoadedList(
        'preselected trait(s)',
        preselectedTraits.length,
        preselectedTraits.map(trait => trait.cardKey),
      );
    }

    // Restore preselected ally when the file exists.
    const preselectedAllies = this.readJson<AllyNoId[]>('preselected-ally.json');
    if (preselectedAllies) {
      defaultConfig.allies = preselectedAllies;
      this.logLoadedList(
        'preselected ally(s)',
        preselectedAllies.length,
        preselectedAllies.map(ally => ally.cardKey),
      );
    }

    // Restore preselected prophecy when the file exists.
    const preselectedProphecies = this.readJson<ProphecyNoId[]>('preselected-prophecy.json');
    if (preselectedProphecies) {
      defaultConfig.prophecies = preselectedProphecies;
      this.logLoadedList(
        'preselected prophecy(s)',
        preselectedProphecies.length,
        preselectedProphecies.map(prophecy => prophecy.cardKey),
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

  public persistProjects(projects: ProjectNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-projects.json'), JSON.stringify(projects));
  }

  public persistWays(ways: WayNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-ways.json'), JSON.stringify(ways));
  }

  public persistTraits(traits: TraitNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-traits.json'), JSON.stringify(traits));
  }

  public persistAllies(allies: AllyNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-ally.json'), JSON.stringify(allies));
  }

  public persistProphecies(prophecies: ProphecyNoId[]): void {
    this.ensureMatchDirectory();
    Deno.writeTextFileSync(this.getFilePath('preselected-prophecy.json'), JSON.stringify(prophecies));
  }
}
