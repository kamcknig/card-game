import {
  AllyNoId,
  ArtifactNoId,
  CardNoId,
  EventNoId,
  LandmarkNoId,
  ProjectNoId,
  SelectableSearchCatalog,
  WayNoId,
} from 'shared/types/index.ts';
import Fuse, { IFuseOptions } from 'fuse.js';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { LoggerService } from './logger-service.ts';

// Owns all search indexes used by lobby selection UI.
export class ExpansionSearchService {
  private static readonly EMPTY_CATALOG: SelectableSearchCatalog = {
    cards: [],
    events: [],
    landmarks: [],
    artifacts: [],
    projects: [],
    ways: [],
    allies: [],
  };

  private _cardFuse: Fuse<CardNoId> | undefined;
  private _eventFuse: Fuse<EventNoId> | undefined;
  private _landmarkFuse: Fuse<LandmarkNoId> | undefined;
  private _artifactFuse: Fuse<ArtifactNoId> | undefined;
  private _projectFuse: Fuse<ProjectNoId> | undefined;
  private _wayFuse: Fuse<WayNoId> | undefined;
  private _allyFuse: Fuse<AllyNoId> | undefined;
  private _selectableCatalog: SelectableSearchCatalog = structuredClone(ExpansionSearchService.EMPTY_CATALOG);

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
    const allies = Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.allies ?? {}));
    this._cardFuse = this.createFuse(cards);
    this._eventFuse = this.createFuse(events);
    this._landmarkFuse = this.createFuse(landmarks);
    this._artifactFuse = this.createFuse(artifacts);
    this._projectFuse = this.createFuse(projects);
    this._allyFuse = this.createFuse(allies);
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
    this._selectableCatalog = {
      cards: this.sortByName(cards.filter((card) => this.isCardEligibleForKingdomSearch(card))),
      events: this.sortByName(events),
      landmarks: this.sortByName(landmarks),
      artifacts: this.sortByName(artifacts),
      projects: this.sortByName(projects),
      ways: this.sortByName(ways),
      allies: this.sortByName(allies),
    };
    this.loggerService.debug(
      `[expansion search] index sizes cards=${cards.length} events=${events.length} landmarks=${landmarks.length} artifacts=${artifacts.length} projects=${projects.length} ways=${ways.length} allies=${allies.length}`,
    );
    if (ways.length < 1) {
      // Surface empty-way index explicitly to make way-search diagnostics obvious.
      this.loggerService.warn('[expansion search] ways index is empty; way searches will return zero results');
    }
  }

  // Returns kingdom-selectable cards across all loaded expansions for a search term.
  public searchKingdomCards(searchStr: string): CardNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.cards;
    }
    const cards = this._cardFuse?.search(searchStr).map((result) => result.item) ?? [];
    return cards.filter((card) => this.isCardEligibleForKingdomSearch(card));
  }

  // Returns matching events for a search term.
  public searchEvents(searchStr: string): EventNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.events;
    }
    return this._eventFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching landmarks for a search term.
  public searchLandmarks(searchStr: string): LandmarkNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.landmarks;
    }
    return this._landmarkFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching artifacts for a search term.
  public searchArtifacts(searchStr: string): ArtifactNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.artifacts;
    }
    return this._artifactFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching projects for a search term.
  public searchProjects(searchStr: string): ProjectNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.projects;
    }
    return this._projectFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns matching ways for a search term.
  public searchWays(searchStr: string): WayNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.ways;
    }
    const ways = this._wayFuse?.search(searchStr).map((result) => result.item) ?? [];
    this.loggerService.debug(`[expansion search] ways search '${searchStr}' returned ${ways.length} way card(s)`);
    return ways;
  }

  // Returns matching ally for a search term.
  public searchAllies(searchStr: string): AllyNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.allies;
    }
    return this._allyFuse?.search(searchStr).map((result) => result.item) ?? [];
  }

  // Returns a structured clone of the current searchable landscape catalog.
  public getSelectableSearchCatalog(): SelectableSearchCatalog {
    return structuredClone(this._selectableCatalog);
  }

  // Builds a Fuse index for landscape search by display name.
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

  // Sorts landscape entries by display name and key for deterministic UI ordering.
  private sortByName<T extends { cardName: string; cardKey: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const nameCompare = a.cardName.localeCompare(b.cardName);
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return a.cardKey.localeCompare(b.cardKey);
    });
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
