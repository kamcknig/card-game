import { CardId, CardLocation, isLocationMat, Match, Mats } from 'shared/shared-types.ts';

export class CardSourceController {
  private readonly _sourceMap: Map<string, CardId[]> = new Map();
  
  constructor(private match: Match) {
  }
  
  registerZone(sourceKey: CardLocation, source: CardId[], index: number = NaN) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`
    if (this._sourceMap.has(sourceKey) || this._sourceMap.has(key)) {
      throw new Error(`Zone ${key} already exists`);
    }
    
    const newSource = source ?? [];
    this.match.cardSources[key] = newSource
    this._sourceMap.set(key, newSource);
    
    return newSource;
  }
  
  findCardSource(cardId: CardId) {
    for (const [sourceKey, source] of this._sourceMap) {
      const idx = source.findIndex(id => id === cardId);
      if (idx !== -1) {
        return { sourceKey: sourceKey.split(':')[0], source, index: idx };
      }
    }
    
    let sourceKey = '';
    let source;
    
    for (const [playerId, playerMats] of Object.entries(this.match.mats)) {
      for (const [mat, cardIds] of Object.entries(playerMats)) {
        if (cardIds.includes(cardId)) {
          source = this.match.mats[+playerId][mat as Mats];
          sourceKey = mat as Mats;
        }
      }
    }
    
    if (source) {
      const idx = source.findIndex(id => id === cardId);
      return { sourceKey: sourceKey.split(':')[0], source, index: idx }
    }
  
    throw new Error(`Source for card ${cardId} not found`);
  }
  
  getSource(sourceKey: CardLocation, index: number = NaN) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`
    
    let source = this._sourceMap.get(key);
    
    if (!source) {
      if (isLocationMat(key)) {
        for (const player of this.match.config.players) {
          source = this.match.mats[player.id][key];
          break;
        }
      }
    }
    
    if (!source) {
      throw new Error(`Source for key ${key} not found`);
    }
    
    return source;
  }
}