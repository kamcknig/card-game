import { CardId, Match } from 'shared/shared-types.ts';

export const isInPlay = (cardId: CardId, match: Match) => {
  return match.playArea.includes(cardId) || match.activeDurationCards.includes(cardId);
}
