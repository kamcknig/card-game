import { CardId, CardLocation, Match } from 'shared/shared-types.ts';

export class CardSourceController {
  private readonly _sourceMap: Map<string, CardId[]> = new Map();
  private readonly _tagMap: Map<string, CardLocation[]> = new Map();
  
  constructor(private match: Match) {
  }
  
  registerZone(sourceKey: CardLocation, source: CardId[], index: number = NaN, tags: string[] = []) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`
    
    if (this._sourceMap.has(sourceKey) || this._sourceMap.has(key)) {
      throw new Error(`Zone ${key} already exists`);
    }
    
    const newSource = source ?? [];
    this.match.cardSources[key] = newSource;
    this._sourceMap.set(key, newSource);
    
    for (const tag of tags) {
      if (!this._tagMap.has(tag)) {
        this.match.cardSourceTagMap[tag] = [key];
        this._tagMap.set(tag, [key]);
      }
      else {
        this._tagMap.get(tag)!.push(key);
        this.match.cardSourceTagMap[tag].push(key);
      }
    }
    
    return newSource;
  }
  
  findCardSource(cardId: CardId) {
    for (const [sourceKey, source] of this._sourceMap) {
      const idx = source.findIndex(id => id === cardId);
      if (idx !== -1) {
        return { sourceKey: sourceKey.split(':')[0], source, index: idx };
      }
    }
    
    throw new Error(`Source for card ${cardId} not found`);
  }
  
  getSource(sourceKey: CardLocation, index: number = NaN) {
    const key = `${sourceKey}${isNaN(index) ? '' : ':' + index}`
    
    const source = this._sourceMap.get(key);
    
    if (!source) {
      throw new Error(`Source for key ${key} not found`);
    }
    
    return source;
  }
}