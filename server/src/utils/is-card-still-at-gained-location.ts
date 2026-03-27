import { CardId, CardLocation, PlayerId } from 'shared/types/index.ts';

type GainedLocation = { location: CardLocation; playerId?: PlayerId };
type CardSourceLookup = {
  findCardSource: (cardId: CardId) => { sourceKey: string; playerId?: PlayerId };
};

// Returns true when the gained card is still in the same source where it was gained.
export const isCardStillAtGainedLocation = (
  cardSourceController: CardSourceLookup,
  cardId: CardId,
  gainedLocation?: GainedLocation,
): boolean => {
  if (!gainedLocation) {
    return true;
  }

  try {
    const source = cardSourceController.findCardSource(cardId);
    return source.sourceKey === gainedLocation.location && source.playerId === gainedLocation.playerId;
  } catch {
    return false;
  }
};
