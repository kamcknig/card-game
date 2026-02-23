import { CardKey, CardLocation } from 'shared/types/index.ts';
import type { FindCardService } from '@server-types/index.ts';

// Resolves which pile location currently contains cards for the provided card key.
export const resolvePileDestinationForCardKey = (args: {
  findCardService: Pick<FindCardService, 'findCards'>;
  cardKey: CardKey;
}): CardLocation | null => {
  const pileLocations: CardLocation[] = ['kingdomSupply', 'basicSupply', 'nonSupplyCards'];
  for (const location of pileLocations) {
    const matches = args.findCardService.findCards([
      { location },
      { cardKeys: args.cardKey },
    ]);
    if (matches.length > 0) {
      return location;
    }
  }
  return null;
};
