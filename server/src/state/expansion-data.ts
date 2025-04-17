import { CardData, CardKey, Mats } from 'shared/shared-types.ts';

export type ExpansionCardData = {
  supply: Record<CardKey, CardData>,
  kingdom: Record<CardKey, CardData>
}

type ExpansionData = Record<string, {
  title: string;
  name: string;
  cardData: ExpansionCardData;
  order: number;
  mats?: Mats[];
}>;

/**
 * Global expansion data. This holds all cards and their data
 */
export const expansionData: ExpansionData = {};
