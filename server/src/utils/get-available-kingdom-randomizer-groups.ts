import { CardKey, CardNoId } from 'shared/types/index.ts';
import { ExpansionData } from '../expansions/expansion-library.ts';
import { getCardPileKey } from './get-card-pile-key.ts';

export type KingdomRandomizerGroup = {
  pileKey: CardKey;
  cards: CardNoId[];
};

type GetAvailableKingdomRandomizerGroupsArgs = {
  expansions: ExpansionData[];
  bannedPileKeys?: CardKey[];
  excludedPileKeys?: CardKey[];
  cardFilter?: (card: CardNoId) => boolean;
};

// Builds available kingdom randomizer groups using consistent pile-key semantics across configurators.
export const getAvailableKingdomRandomizerGroups = (
  args: GetAvailableKingdomRandomizerGroupsArgs,
): KingdomRandomizerGroup[] => {
  const bannedPileKeys = new Set(args.bannedPileKeys ?? []);
  const excludedPileKeys = new Set(args.excludedPileKeys ?? []);
  const groups = new Map<CardKey, CardNoId[]>();

  for (const expansion of args.expansions) {
    for (const card of Object.values(expansion.cardData.kingdomSupply)) {
      // Never include cards disabled from random kingdom selection.
      if (card.kingdomSelectable === false) {
        continue;
      }

      const pileKey = getCardPileKey(card);
      if (bannedPileKeys.has(pileKey) || excludedPileKeys.has(pileKey)) {
        continue;
      }

      if (args.cardFilter && !args.cardFilter(card)) {
        continue;
      }

      const cardsInGroup = groups.get(pileKey) ?? [];
      // Keep each card key only once per group to avoid duplicate entries across sources.
      if (cardsInGroup.some(existingCard => existingCard.cardKey === card.cardKey)) {
        continue;
      }

      cardsInGroup.push(card);
      groups.set(pileKey, cardsInGroup);
    }
  }

  return Array.from(groups.entries()).map(([pileKey, cards]) => ({ pileKey, cards }));
};
