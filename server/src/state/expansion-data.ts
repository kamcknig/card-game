import { CardKey } from "shared/shared-types.ts";
import { CardData } from "../types.ts";

export type ExpansionCardData = {
  supply: Record<CardKey, CardData>,
  kingdom: Record<CardKey, CardData>
}

type ExpansionData = Record<string, {
  title: string;
  name: string;
  cardData: ExpansionCardData;
  order: number;
}>;

/**
 * Global expansion data. This holds all cards and their data
 */
export const expansionData: ExpansionData = {};
