import { CardKey, CardNoId, EventNoId, LandmarkNoId } from 'shared/shared-types';

export type ExpansionCardData = {
  basicSupply: Record<CardKey, CardNoId>,
  kingdomSupply: Record<CardKey, CardNoId>
}

export type ExpansionData = {
  title: string;
  name: string;
  cardData: ExpansionCardData;
  events: Record<CardKey, EventNoId>;
  // Landmarks are stored separately from events.
  landmarks: Record<CardKey, LandmarkNoId>;
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
export const rawCardLibrary: Record<CardKey, CardNoId> = {};
