import {
  AllyNoId,
  ArtifactNoId,
  CardNoId,
  EventNoId,
  LandmarkNoId,
  ProphecyNoId,
  ProjectNoId,
  SelectableSearchCatalog,
  TraitNoId,
  WayNoId,
} from 'shared/types/index.ts';
import Fuse, { IFuseOptions } from 'fuse.js';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';
import { LoggerService } from './logger-service.ts';
import { getCardPileKey } from '../utils/get-card-pile-key.ts';
import { getPileDefinitionCard } from '../utils/get-pile-definition-card.ts';
import { formatCardName } from '../utils/format-card-name.ts';

// Owns all search indexes used by lobby selection UI.
export class ExpansionSearchService {
  private static readonly EMPTY_CATALOG: SelectableSearchCatalog = {
    cards: [],
    events: [],
    landmarks: [],
    artifacts: [],
    projects: [],
    ways: [],
    traits: [],
    allies: [],
    prophecies: [],
  };

  private _cardFuse: Fuse<CardNoId> | undefined;
  private _eventFuse: Fuse<EventNoId> | undefined;
  private _landmarkFuse: Fuse<LandmarkNoId> | undefined;
  private _projectFuse: Fuse<ProjectNoId> | undefined;
  private _wayFuse: Fuse<WayNoId> | undefined;
  private _traitFuse: Fuse<TraitNoId> | undefined;
  private _allyFuse: Fuse<AllyNoId> | undefined;
  private _prophecyFuse: Fuse<ProphecyNoId> | undefined;
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
    const allCards = Object.values(rawCardLibrary);

    // Collapse multi-card piles to a single randomizer entry per pile key. Single-card
    // piles (no randomizerData, or randomizer === cardKey) pass through unchanged.
    // getPileDefinitionCard applies pile-level cost/type overrides so the randomizer
    // tile matches the real pile (e.g. Castles = $3 Victory/Castle, not the cheapest
    // member). This ensures the modal sees exactly one selectable entry per pile.
    const cardsByPileKey = new Map<string, CardNoId[]>();
    for (const card of allCards) {
      const pileKey = getCardPileKey(card);
      const bucket = cardsByPileKey.get(pileKey) ?? [];
      bucket.push(card);
      cardsByPileKey.set(pileKey, bucket);
    }
    const dedupedCards: CardNoId[] = [];
    for (const [pileKey, members] of cardsByPileKey) {
      const representative = getPileDefinitionCard(members, pileKey);
      if (representative) {
        // For JSON-defined pile randomizers, point the modal's art and detail
        // image lookups at the pile-level image (e.g. 'castles-art.jpg') and
        // override the display name so the row reads as the pile, not the
        // first member. randomizerData is set only for cards loaded from a
        // `pile` JSON block; single-card kingdoms have no randomizerData and
        // fall through with no override. Slashes in randomizer keys
        // (e.g. 'catapult/rocks') are converted to hyphens for filesystem-safe
        // asset paths but preserved in the display name with each side
        // title-cased ("Catapult / Rocks").
        const randomizerKey = representative.randomizerData?.randomizer;
        if (randomizerKey) {
          representative.imageKeyOverride = randomizerKey.replace(/\//g, '-');
          representative.cardName = randomizerKey
            .split('/')
            .map(segment => formatCardName(segment))
            .join(' / ');
        }
        dedupedCards.push(representative);
      }
    }

    const events = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.events ?? {}));
    const landmarks = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.landmarks ?? {}));
    const projects = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.projects ?? {}));
    const traits = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.traits ?? {}));
    const allies = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.allies ?? {}));
    const prophecies = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.prophecies ?? {}));

    // Build the card Fuse index from the deduped set so search results are aligned
    // with the catalog — searching "castles" returns the one pile entry, not all 8 members.
    this._cardFuse = this.createFuse(dedupedCards);
    this._eventFuse = this.createFuse(events);
    this._landmarkFuse = this.createFuse(landmarks);
    this._projectFuse = this.createFuse(projects);
    this._traitFuse = this.createFuse(traits);
    this._allyFuse = this.createFuse(allies);
    this._prophecyFuse = this.createFuse(prophecies);
    const expansionWays = Object.values(expansionLibrary).flatMap(expansion => Object.values(expansion.ways ?? {}));
    // Fallback source: allow WAY-typed entries from raw card templates so search still works
    // while an expansion is transitioning to dedicated way-library files.
    const rawWayCards = Object.values(rawCardLibrary)
      .filter(card => (card.type ?? []).includes('WAY'))
      .map(card => card as unknown as WayNoId);
    const wayByKey = new Map<string, WayNoId>();
    for (const way of [...expansionWays, ...rawWayCards]) {
      wayByKey.set(way.cardKey, way);
    }
    const ways = [...wayByKey.values()];
    this._wayFuse = this.createFuse(ways);
    this._selectableCatalog = {
      cards: this.sortByName(dedupedCards.filter(card => this.isCardEligibleForKingdomSearch(card))),
      events: this.sortByName(events),
      landmarks: this.sortByName(landmarks),
      artifacts: [],
      projects: this.sortByName(projects),
      ways: this.sortByName(ways),
      traits: this.sortByName(traits),
      allies: this.sortByName(allies),
      prophecies: this.sortByName(prophecies),
    };
    this.loggerService.debug(
      `[expansion search] index sizes cards=${dedupedCards.length} (deduped from ${allCards.length}) events=${events.length} landmarks=${landmarks.length} projects=${projects.length} ways=${ways.length} traits=${traits.length} allies=${allies.length} prophecies=${prophecies.length}`,
    );
    if (ways.length < 1) {
      // Surface empty-way index explicitly to make way-search diagnostics obvious.
      this.loggerService.warn('[expansion search] ways index is empty; way searches will return zero results');
    }
  }

  // Returns kingdoms-selectable cards across all loaded expansions for a search term.
  public searchKingdomCards(searchStr: string): CardNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.cards;
    }
    const cards = this._cardFuse?.search(searchStr).map(result => result.item) ?? [];
    return cards.filter(card => this.isCardEligibleForKingdomSearch(card));
  }

  // Returns matching events for a search term.
  public searchEvents(searchStr: string): EventNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.events;
    }
    return this._eventFuse?.search(searchStr).map(result => result.item) ?? [];
  }

  // Returns matching landmarks for a search term.
  public searchLandmarks(searchStr: string): LandmarkNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.landmarks;
    }
    return this._landmarkFuse?.search(searchStr).map(result => result.item) ?? [];
  }

  // Returns empty results; artifacts are auto-populated by the Renaissance configurator, not manually selectable.
  public searchArtifacts(_searchStr: string): ArtifactNoId[] {
    return [];
  }

  // Returns matching projects for a search term.
  public searchProjects(searchStr: string): ProjectNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.projects;
    }
    return this._projectFuse?.search(searchStr).map(result => result.item) ?? [];
  }

  // Returns matching ways for a search term.
  public searchWays(searchStr: string): WayNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.ways;
    }
    const ways = this._wayFuse?.search(searchStr).map(result => result.item) ?? [];
    this.loggerService.debug(`[expansion search] ways search '${searchStr}' returned ${ways.length} way card(s)`);
    return ways;
  }

  // Returns matching traits for a search term.
  public searchTraits(searchStr: string): TraitNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.traits;
    }
    return this._traitFuse?.search(searchStr).map(result => result.item) ?? [];
  }

  // Returns matching ally for a search term.
  public searchAllies(searchStr: string): AllyNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.allies;
    }
    return this._allyFuse?.search(searchStr).map(result => result.item) ?? [];
  }

  // Returns matching prophecies for a search term.
  public searchProphecies(searchStr: string): ProphecyNoId[] {
    if (searchStr.trim().length < 1) {
      return this._selectableCatalog.prophecies;
    }
    return this._prophecyFuse?.search(searchStr).map(result => result.item) ?? [];
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

  // Ensures kingdoms search only returns legal supply kingdoms cards.
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
