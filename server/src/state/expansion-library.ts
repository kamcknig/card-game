import { CardKey, CardNoId, Mats } from 'shared/shared-types.ts';

export type ExpansionCardData = {
  basicSupply: Record<CardKey, CardNoId>,
  kingdomSupply: Record<CardKey, CardNoId>
}

export type ExpansionData = Record<string, {
  title: string;
  name: string;
  cardData: ExpansionCardData;
  mats?: Mats[];
}>;

/**
 * Global expansion data. Holds data about an expansion and the cards it loads.
 */
export const expansionLibrary: ExpansionData = {};

/**
 * Holds the "raw" JSON data of all cards loaded.
 */
export const allCardLibrary: Record<CardKey, CardNoId> = {};
