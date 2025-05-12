import { CardNoId, MatchConfiguration } from 'shared/shared-types.ts';

export const getDefaultKingdomSupplySize = (card: CardNoId, config: MatchConfiguration) => {
  return card.type.includes('VICTORY') ? (config.players.length < 3 ? 8 : 12) : 10;
};