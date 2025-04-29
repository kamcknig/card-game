import { CardId, CardLocation, Match } from 'shared/shared-types.ts';

export const isLocationInPlay = (location: CardLocation) => {
  return location === 'playArea' || location === 'activeDuration';
}

export const isCardInPlay = (card: { id: CardId }, match: Match) => {
  return match.playArea.includes(card.id) || match.activeDurationCards.includes(card.id);
}
