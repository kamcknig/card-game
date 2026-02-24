import { Card, Match } from 'shared/types/index.ts';
import { getCardPileKey } from './get-card-pile-key.ts';

// Supported configured pile locations that can accept cards back to pile top.
export type ConfiguredCardPileLocation = {
  location: 'basicSupply' | 'kingdomSupply' | 'nonSupplyCards';
  pileName: string;
};

// Resolves the configured pile location for a card in the current match configuration.
export const getConfiguredCardPileLocation = (
  match: Match,
  card: Card,
): ConfiguredCardPileLocation | undefined => {
  const pileKey = getCardPileKey(card);
  const inBasicSupply = match.config.basicSupply.some((supply) =>
    supply.cards.some((supplyCard) => getCardPileKey(supplyCard) === pileKey)
  );
  if (inBasicSupply) {
    return { location: 'basicSupply', pileName: pileKey };
  }

  const inKingdomSupply = match.config.kingdomSupply.some((supply) =>
    supply.cards.some((supplyCard) => getCardPileKey(supplyCard) === pileKey)
  );
  if (inKingdomSupply) {
    return { location: 'kingdomSupply', pileName: pileKey };
  }

  const nonSupplyPileName = card.kingdom;
  const inNonSupply = !!nonSupplyPileName && match.config.nonSupply?.some((supply) => supply.name === nonSupplyPileName);
  if (inNonSupply) {
    return { location: 'nonSupplyCards', pileName: nonSupplyPileName };
  }

  return undefined;
};
