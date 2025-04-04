import { CardKey } from "shared/shared-types.ts";
import { CardData } from '../types.ts';

/**
 * Global expansion data. This holds all cards and their data
 */
export const expansionData: Record<string, Record<CardKey, CardData>> = {};
