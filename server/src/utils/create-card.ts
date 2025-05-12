import { Card, CardKey, CardNoId } from 'shared/shared-types.ts';
import { rawCardLibrary } from "@expansions/expansion-library.ts";
import { capitalize } from 'es-toolkit/compat';

let CARD_COUNT: number = 0;

export const createCard = (cardKey: CardKey, card?: Partial<CardNoId>): Card => {
  const baseCardData = rawCardLibrary[cardKey] ?? {};
  const c = new Card({
    ...baseCardData,
    cardKey: cardKey,
    cardName: baseCardData.cardName ?? capitalize(cardKey),
    ...card ?? {},
    id: ++CARD_COUNT,
  });
  return c;
};
