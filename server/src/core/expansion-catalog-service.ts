import type { ExpansionData, ExpansionDataLibrary } from '@expansions/expansion-library.ts';
import type { CardKey, CardNoId } from 'shared/types/index.ts';

// Owns all loaded expansion metadata and raw card templates.
export class ExpansionCatalogService {
  private readonly _expansionLibrary: ExpansionDataLibrary = {};
  private readonly _rawCardLibrary: Record<CardKey, CardNoId> = {};

  // Returns true when expansion data for a name is already present.
  public hasExpansion(expansionName: string): boolean {
    return this._expansionLibrary[expansionName] !== undefined;
  }

  // Returns expansion data for a name if present.
  public getExpansion(expansionName: string): ExpansionData | undefined {
    return this._expansionLibrary[expansionName];
  }

  // Returns expansion data for a name or throws when missing.
  public getRequiredExpansion(expansionName: string): ExpansionData {
    const expansion = this._expansionLibrary[expansionName];
    if (!expansion) {
      throw new Error(`[expansion catalog] expansion ${expansionName} not loaded`);
    }
    return expansion;
  }

  // Stores expansion data for a name.
  public setExpansion(expansionName: string, expansionData: ExpansionData): void {
    this._expansionLibrary[expansionName] = expansionData;
  }

  // Removes expansion data for a name.
  public removeExpansion(expansionName: string): void {
    delete this._expansionLibrary[expansionName];
  }

  // Returns all expansion data keyed by expansion name.
  public getExpansionLibrary(): ExpansionDataLibrary {
    return this._expansionLibrary;
  }

  // Stores a raw card template by card key.
  public setRawCard(cardKey: CardKey, cardData: CardNoId): void {
    this._rawCardLibrary[cardKey] = cardData;
  }

  // Returns a raw card template by key if present.
  public getRawCard(cardKey: CardKey): CardNoId | undefined {
    return this._rawCardLibrary[cardKey];
  }

  // Returns all raw card templates keyed by card key.
  public getRawCardLibrary(): Record<CardKey, CardNoId> {
    return this._rawCardLibrary;
  }
}
