import { CardKey, CardLike } from 'shared/shared-types.ts';

// Resolve the pile key for a card using randomizer data when present.
export const getCardPileKey = (card: Pick<CardLike, 'cardKey' | 'randomizerData'>): CardKey => {
  return (card.randomizerData?.randomizer ?? card.cardKey) as CardKey;
};
