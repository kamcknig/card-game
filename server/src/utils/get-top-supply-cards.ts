import type { FindCardService } from '@server-types/index.ts';
import { Card, Match } from 'shared/types/index.ts';
import { getConfiguredSupplyPileKeys } from './get-configured-supply-pile-keys.ts';

// Returns one visible top card per configured Supply pile, preserving configured pile order.
export const getTopSupplyCards = (args: {
  findCardService: Pick<FindCardService, 'findTopSupplyCardForPileKey'>;
  match: Match;
}): Card[] => {
  const topCards: Card[] = [];

  for (const pileKey of getConfiguredSupplyPileKeys(args.match)) {
    const topCard = args.findCardService.findTopSupplyCardForPileKey({ pileKey });
    if (!topCard) {
      continue;
    }
    topCards.push(topCard);
  }

  return topCards;
};
