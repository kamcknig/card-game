import {
  ArtifactNoId,
  CardNoId,
  EventNoId,
  LandmarkNoId,
  ProjectNoId,
} from 'shared/types/index.ts';
import { expansionLibrary, rawCardLibrary } from '@expansions/expansion-library.ts';
import Fuse, { IFuseOptions } from 'fuse.js';

// Owns all search indexes used by lobby selection UI.
export class ExpansionSearchService {
  private _cardFuse: Fuse<CardNoId> | undefined;
  private _eventFuse: Fuse<EventNoId> | undefined;
  private _landmarkFuse: Fuse<LandmarkNoId> | undefined;
  private _artifactFuse: Fuse<ArtifactNoId> | undefined;
  private _projectFuse: Fuse<ProjectNoId> | undefined;

  constructor() {
    // Build initial indexes from whatever expansions are loaded at startup.
    this.rebuildIndexes();
  }

  // Rebuilds all search indexes after expansion data changes.
  public rebuildIndexes() {
    console.info('[expansion search] rebuilding all indexes');
    this._cardFuse = this.createFuse(Object.values(rawCardLibrary));
    this._eventFuse = this.createFuse(
      Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.events ?? {})),
    );
    this._landmarkFuse = this.createFuse(
      Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.landmarks ?? {})),
    );
    this._artifactFuse = this.createFuse(
      Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.artifacts ?? {})),
    );
    this._projectFuse = this.createFuse(
      Object.values(expansionLibrary).flatMap((expansion) => Object.values(expansion.projects ?? {})),
    );
  }

  // Returns kingdom-selectable cards from selected expansions for a search term.
  public searchKingdomCards(searchStr: string, selectedExpansionNames: Set<string>): CardNoId[] {
    const cards = this._cardFuse?.search(searchStr).map((result) => result.item) ?? [];
    return cards.filter((card) => this.isCardEligibleForKingdomSearch(card, selectedExpansionNames));
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
  private isCardEligibleForKingdomSearch(card: CardNoId, selectedExpansionNames: Set<string>): boolean {
    if (card.isBasic) {
      return false;
    }

    if (!card.partOfSupply) {
      return false;
    }

    if (card.kingdomSelectable === false) {
      return false;
    }

    return selectedExpansionNames.has(card.expansionName);
  }
}

