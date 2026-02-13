import { Match } from 'shared/types/index.ts';
import { getCardPileKey } from './get-card-pile-key.ts';
import { FindCardsFn } from '@server-types/index.ts';

export const getStartingSupplyCount = (match: Match) => {
  const allSupplyCardKeys = match.config.basicSupply.concat(
    match.config.kingdomSupply,
  );
  return allSupplyCardKeys.length;
};

export const getRemainingSupplyCount = (findCards: FindCardsFn) => {
  const remainingSupplyPileKeys = findCards({ location: ['kingdomSupply', 'basicSupply'] })
    // Use pile keys so split piles and randomizer data count as one supply pile.
    .map((card) => getCardPileKey(card))
    .reduce((prev, pileKey) => {
      if (prev.includes(pileKey)) {
        return prev;
      }
      return prev.concat(pileKey);
    }, [] as string[]);

  return remainingSupplyPileKeys.length;
};
