import { CardKey } from "shared/shared-types.ts";
import { CardData } from "../types.ts";

type ExpansionData = Record<string, {
  title: string;
  name: string;
  cardData: Record<CardKey, CardData>;
}>;

/**
 * Global expansion data. This holds all cards and their data
 */
export const expansionData: ExpansionData = {};
