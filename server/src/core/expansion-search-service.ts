import { ArtifactNoId, CardNoId, EventNoId, LandmarkNoId, ProjectNoId, WayNoId } from 'shared/types/index.ts';
import Fuse, { IFuseOptions } from 'fuse.js';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { LoggerService } from './logger-service.ts';

// Owns all search indexes used by lobby selection UI.
export class ExpansionSearchService {
  private _cardFuse: Fuse<CardNoId> | undefined;
  private _eventFuse: Fuse<EventNoId> | undefined;
  private _landmarkFuse: Fuse<LandmarkNoId> | undefined;
  private _artifactFuse: Fuse<ArtifactNoId> | undefined;
  private _projectFuse: Fuse<ProjectNoId> | undefined;
  private _wayFuse: Fuse<WayNoId> | undefined;

  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
    private readonly loggerService: LoggerService,
  ) {
    // Build initial indexes from whatever expansions are loaded at startup.
    this.rebuildIndexes();
  }

  // Rebuilds all search indexes after expansion data changes.
  public rebuildIndexes() {
    this.loggerService.info('[expansion search] rebuilding all indexes');
    const rawCardLibrary = this.expansionCatalogService.getRawCardLibrary();
    const expansionLibrary = this.expansionCatalogService.getExpansionLibrary();
    const cards = Object.values(rawCardLibrary);
    const events = Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.events ?? {}));
    const landmarks = Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.landmarks ?? {}));
    const artifacts = Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.artifacts ?? {}));
    const projects = Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.projects ?? {}));
    this._cardFuse = this.createFuse(cards);
    this._eventFuse = this.createFuse(events);
    this._landmarkFuse = this.createFuse(landmarks);
    this._artifactFuse = this.createFuse(artifacts);
    this._projectFuse = this.createFuse(projects);
    const expansionWays = Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.ways ?? {}));
    // Fallback source: allow WAY-typed entries from raw card templates so search still works
    // while an expansion is transitioning to dedicated way-library files.
    const rawWayCards = Object.values(rawCardLibrary)
      .filter((card) => (card.type ?? []).includes('WAY'))
      .map((card) => card as unknown as WayNoId);
    const wayByKey = new Map<string, WayNoId>();
    for (const way of [...expansionWays, ...rawWayCards]) {
      wayByKey.set(way.cardKey, way);
    }
    const ways = [...wayByKey.values()];
    this._wayFuse = this.createFuse(ways);
    this.loggerService.debug(
      `[expansion search] index sizes cards=${cards.length} events=${events.length} landmarks=${landmarks.length} artifacts=${artifacts.length} projects=${projects.length} ways=${ways.length}`,
    );
    if (ways.length < 1) {
      // Surface empty-way index explicitly to make way-search diagnostics obvious.
      this.loggerService.warn('[expansion search] ways index is empty; way searches will return zero results');
    }
  }

  // Returns kingdom-selectable cards across all loaded expansions for a search term.
  public searchKingdomCards(searchStr: string): CardNoId[] {
    const cards = this._cardFuse?.search(searchStr).map((result) => result.item) ?? [];
    return cards.filter((card) => this.isCardEligibleForKingdomSearch(card));
  }

  // Returns matching events for a search term.
  public searchEvents(searchStr: string): EventNoId[] {
    return this._eventFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching landmarks for a search term.
  public searchLandmarks(searchStr: string): LandmarkNoId[] {
    return this._landmarkFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching artifacts for a search term.
  public searchArtifacts(searchStr: string): ArtifactNoId[] {
    return this._artifactFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching projects for a search term.
  public searchProjects(searchStr: string): ProjectNoId[] {
    return this._projectFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching ways for a search term.
  public searchWays(searchStr: string): WayNoId[] {
    const ways = this._wayFuse?.search(searchStr).map((result) => result.item) ?? [];
    this.loggerService.debug(`[expansion search] ways search '${searchStr}' returned ${ways.length} way card(s)`);
    return ways;
  }

  // Builds a Fuse index for card-like search by display name.
  private createFuse<T extends { cardName: string }>(items: T[]): Fuse<T> {
    const index = Fuse.createIndex(['cardName'], items);
    const fuseOptions: IFuseOptions<T> = {
      ignoreDiacritics: true,
      minMatchCharLength: 1,
      distance: 2,
      keys: ['cardName'],
    };
    return new Fuse(items, fuseOptions, index);
  }

  // Ensures kingdom search only returns legal supply kingdom cards.
  private isCardEligibleForKingdomSearch(card: CardNoId): boolean {
    if (card.isBasic) {
      return false;
    }

    if (card.kingdomSelectable === false) {
      return false;
    }

    return true;
  }
}
