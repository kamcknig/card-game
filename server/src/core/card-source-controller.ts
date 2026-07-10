import { CardId, CardLocation, Match } from 'shared/types/index.ts';

export class CardSourceController {
  private readonly _sourceMap: Map<string, CardId[]> = new Map();

  constructor(private readonly match: Match) {}

  registerZone(sourceKey: CardLocation, source: CardId[], index: number = NaN, tags: string[] = []) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`;

    // Only reject duplicate concrete keys; allow both global and indexed zones for the same sourceKey.
    if (this._sourceMap.has(key)) {
      throw new Error(`Zone ${key} already exists`);
    }

    const newSource = source ?? [];
    this.match.cardSources[key] = newSource;
    this._sourceMap.set(key, newSource);

    for (const tag of tags) {
      // match.cardSourceTagMap is the single source of truth (client-facing
      // and what MatchUndoService restores from); no server-side-only cache
      // is needed alongside it.
      if (!this.match.cardSourceTagMap[tag]) {
        this.match.cardSourceTagMap[tag] = [key];
      } else {
        this.match.cardSourceTagMap[tag].push(key);
      }
    }

    return newSource;
  }

  hasSource(sourceKey: CardLocation, index: number = NaN) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`;
    return this._sourceMap.has(key);
  }

  findCardSource(cardId: CardId) {
    for (const [sourceKey, source] of this._sourceMap) {
      const idx = source.findIndex(id => id === cardId);
      if (idx !== -1) {
        const [key, playerIdToken] = sourceKey.split(':');
        const parsedPlayerId = playerIdToken === undefined ? undefined : Number(playerIdToken);
        const playerId = parsedPlayerId !== undefined && !Number.isNaN(parsedPlayerId) ? parsedPlayerId : undefined;
        return { sourceKey: key, source, index: idx, playerId };
      }
    }

    throw new Error(`Source for card ${cardId} not found`);
  }

  getSource(sourceKey: CardLocation, index: number = NaN) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`;

    const source = this._sourceMap.get(key);

    if (!source) {
      throw new Error(`Source for key ${key} not found`);
    }

    return source;
  }

  /**
   * Re-aliases _sourceMap from the live match.cardSources. Used by
   * MatchUndoService after a restore: the snapshot replaces
   * match.cardSources with fresh array references, and this call brings
   * the controller's cache back in sync with those references.
   * match.cardSourceTagMap needs no equivalent resync — it is read
   * directly off the match rather than cached locally. Safe to call any
   * time the match's sources record has been replaced wholesale.
   */
  public rebuildFromMatch(): void {
    this._sourceMap.clear();
    for (const [key, source] of Object.entries(this.match.cardSources)) {
      this._sourceMap.set(key, source);
    }
  }
}
