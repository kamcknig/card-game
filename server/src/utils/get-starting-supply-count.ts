import { Match } from 'shared/shared-types.ts'
import { FindCardsFn } from '../types.ts';

export const getStartingSupplyCount = (match: Match) => {
  const allSupplyCardKeys = match.config.basicSupply.concat(
    match.config.kingdomSupply,
  );
  return allSupplyCardKeys.length;
}


export const getRemainingSupplyCount = (findCards: FindCardsFn) => {
  const remainingSupplyCardKeys = findCards({ location: ['kingdomSupply', 'basicSupply'] })
    .map(card => card.cardKey)
    .reduce((prev, cardKey) => {
      if (prev.includes(cardKey)) {
        return prev;
      }
      return prev.concat(cardKey);
    }, [] as string[]);
  
  return remainingSupplyCardKeys.length;
}