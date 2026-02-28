import { CardKey, CardNoId } from 'shared/types/index.ts';
import { ExpansionData, createEmptyExpansionData } from '../expansions/expansion-library.ts';

export type CreateTestExpansionDataArgs = {
  name: string;
  title?: string;
  kingdomSupply?: Record<CardKey, CardNoId>;
};

// Builds an ExpansionData fixture with only the fields needed for randomizer tests.
export const createTestExpansionData = (args: CreateTestExpansionDataArgs): ExpansionData => {
  const expansion = createEmptyExpansionData(args.name);
  expansion.title = args.title ?? args.name;
  expansion.cardData.kingdomSupply = args.kingdomSupply ?? {};
  return expansion;
};
