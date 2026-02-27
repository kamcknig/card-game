import { CardNoId } from 'shared/types/index.ts';

// Returns a pile-level card definition, applying randomizer overrides when present.
export const getPileDefinitionCard = (cards: CardNoId[], pileName: string): CardNoId | undefined => {
  const pileCard = cards.find(card => (card.randomizerData?.randomizer ?? card.cardKey) === pileName) ?? cards[0];

  if (!pileCard) {
    return undefined;
  }

  const randomizerData = pileCard.randomizerData;
  if (!randomizerData) {
    return pileCard;
  }

  return {
    ...pileCard,
    cost: randomizerData.cost ?? pileCard.cost,
    type: randomizerData.type ?? pileCard.type,
  };
};
