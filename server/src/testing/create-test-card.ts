import { CardNoId, CardType } from 'shared/types/index.ts';
import { createCardData } from '../utils/create-card-data.ts';

export type CreateTestCardArgs = Partial<CardNoId> & {
  cardKey?: string;
  expansionName?: string;
  type?: CardType[];
};

let nextTestCardIndex = 1;

// Builds a deterministic CardNoId fixture with sensible defaults for unit tests.
export const createTestCard = (args: CreateTestCardArgs = {}): CardNoId => {
  const cardKey = args.cardKey ?? `test-card-${nextTestCardIndex++}`;
  const expansionName = args.expansionName ?? 'test-expansion';

  return createCardData(cardKey, expansionName, {
    abilityText: '',
    cardName: cardKey,
    cost: { treasure: 0 },
    kingdom: cardKey,
    kingdomSelectable: true,
    mat: undefined,
    metadata: {},
    owner: null,
    partOfSupply: true,
    type: args.type ?? ['ACTION'],
    victoryPoints: 0,
    ...args,
  });
};
