import { CardKey, CardNoId, Mats } from 'shared/shared-types.ts';

export type ExpansionCardData = {
  basicSupply: Record<CardKey, CardNoId>,
  kingdomSupply: Record<CardKey, CardNoId>
}

export type ExpansionData = {
  title: string;
  name: string;
  cardData: ExpansionCardData;
  mats?: Mats[];
  mutuallyExclusive?: string[];
}

export type ExpansionDataLibrary = Record<string, ExpansionData>;

/**
 * Global expansion data. Holds data about an expansion and the cards it loads.
 */
export const expansionLibrary: ExpansionDataLibrary = {};

/**
 * Holds the "raw" JSON data of all cards loaded.
 */
export const allCardLibrary: Record<CardKey, CardNoId> = {};
