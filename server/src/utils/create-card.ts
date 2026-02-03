import {
  Boon,
  BoonNoId,
  Card,
  CardKey,
  CardNoId,
  Event,
  EventNoId,
  Landmark,
  LandmarkNoId,
} from 'shared/shared-types.ts';
import { rawCardLibrary } from '@expansions/expansion-library.ts';
import { formatCardName } from './format-card-name.ts';

let CARD_COUNT: number = 0;

export const createCard = (cardKey: CardKey, card?: Partial<CardNoId>): Card => {
  const baseCardData = rawCardLibrary[cardKey] ?? {};
  const c = new Card({
    ...baseCardData,
    cardKey: cardKey,
    // Default card names follow the standard format rules unless overridden by card data.
    cardName: baseCardData.cardName ?? formatCardName(cardKey),
    ...card ?? {},
    id: ++CARD_COUNT,
  });
  return c;
};

export const createEvent = (event: EventNoId): Event => {
  return new Event({
    ...event,
    id: ++CARD_COUNT,
  });
}

// Boons are card-like objects that live outside the supply and are drawn from a shared deck.
export const createBoon = (boon: BoonNoId): Boon => {
  return new Boon({
    ...boon,
    id: ++CARD_COUNT,
  });
}

// Landmarks are card-like objects that live alongside events in the match.
export const createLandmark = (landmark: LandmarkNoId): Landmark => {
  return new Landmark({
    ...landmark,
    id: ++CARD_COUNT,
  });
}
