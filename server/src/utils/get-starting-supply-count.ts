import { Match } from 'shared/shared-types.ts'
import { CardLibrary } from '../core/card-library.ts';

export const getStartingSupplyCount = (match: Match) => {
  const allSupplyCardKeys = match.config.basicCards.concat(
    match.config.kingdomCards,
  );
  return allSupplyCardKeys.length;
}


export const getRemainingSupplyCount = (match: Match, cardLibrary: CardLibrary) => {
  const remainingSupplyCardKeys =
    match.basicSupply
      .concat(match.kingdomSupply)
      .map(id => cardLibrary.getCard(id).cardKey)
      .reduce((prev, cardKey) => {
        if (prev.includes(cardKey)) {
          return prev;
        }
        return prev.concat(cardKey);
      }, [] as string[]);
  
  return remainingSupplyCardKeys.length;
}