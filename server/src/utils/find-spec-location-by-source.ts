import { CardLocation, Match } from 'shared/shared-types.ts';

export const findSpecLocationBySource = (
  match: Match,
  sourceStore: number[],
): CardLocation | undefined => {
  if (!sourceStore) {
    return undefined;
  }
  
  if (sourceStore == match.supply) {
    return 'supply';
  }
  if (sourceStore == match.kingdom) {
    return 'kingdom';
  }
  if (sourceStore == match.trash) {
    return 'trash';
  }
  if (sourceStore == match.playArea) {
    return 'playArea';
  }
  for (const hand of Object.values(match.playerHands)) {
    if (sourceStore == hand) {
      return 'playerHands';
    }
  }
  for (const discard of Object.values(match.playerDiscards)) {
    if (sourceStore == discard) {
      return 'playerDiscards';
    }
  }
  for (const deck of Object.values(match.playerDecks)) {
    if (sourceStore == deck) {
      return 'playerDecks';
    }
  }
  return undefined;
};
