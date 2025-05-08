import { CardId, CardLocation } from 'shared/shared-types.ts';

export class CardSourceController {
  private readonly _sourceMap: Map<string, CardId[]> = new Map();
  
  registerZone(zoneKey: CardLocation | string, source: CardId[]) {
    if (this._sourceMap.has(zoneKey)) {
      throw new Error(`Zone ${zoneKey} already exists`);
    }
    
    this._sourceMap.set(zoneKey, source ?? []);
    return this._sourceMap.get(zoneKey);
  }
  
  findCardSource(cardId: CardId) {
    for (const [zoneKey, source] of this._sourceMap) {
      if (source.includes(cardId)) {
        return { zoneKey, source };
      }
    }
    
    return null;
  }
}