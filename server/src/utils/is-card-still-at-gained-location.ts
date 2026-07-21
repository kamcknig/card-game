import { CardId, CardLocation, PlayerId } from 'shared/types/index.ts';
import { ExpectedCardSource } from '@server-types/index.ts';

type GainedLocation = { location: CardLocation; playerId?: PlayerId };
type CardSourceLookup = {
  findCardSource: (cardId: CardId) => { sourceKey: string; playerId?: PlayerId; source: CardId[]; index: number };
};

// Zones where the Lose Track rule's covering-up clause applies: ordered piles
// where a later arrival buries the card. Top of a pile is the array END by
// codebase convention.
const COVERING_ZONES: CardLocation[] = ['playerDiscard', 'playerDeck'];

// Returns true when the gained card is still in the same source where it was
// gained AND, for ordered piles (deck/discard), is still uncovered on top —
// the Lose Track rule's covering-up clause.
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
    if (source.sourceKey !== gainedLocation.location || source.playerId !== gainedLocation.playerId) {
      return false;
    }
    // Covering-up clause: same zone but buried under a later arrival => lost track.
    if (COVERING_ZONES.includes(gainedLocation.location) && source.index !== source.source.length - 1) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Builds the Lose Track `expectedFrom` guard for a move that targets a card at
// its gained location; applies requireTop for ordered piles (covering clause).
// Returns undefined (no guard) when the trigger carried no gained location.
export const buildGainedLocationExpectedFrom = (
  gainedLocation?: GainedLocation,
): ExpectedCardSource | undefined => {
  if (!gainedLocation) {
    return undefined;
  }
  return {
    location: gainedLocation.location,
    playerId: gainedLocation.playerId,
    ...(COVERING_ZONES.includes(gainedLocation.location) ? { requireTop: true } : {}),
  };
};
