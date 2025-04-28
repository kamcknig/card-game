import { Card, CardKey, CardNoId } from 'shared/shared-types.ts';
import { allCardLibrary } from "@expansions/expansion-library.ts";
import { capitalize } from 'es-toolkit/compat';

let CARD_COUNT: number = 0;

export const createCard = (cardKey: CardKey, card?: Partial<CardNoId>) => {
  const baseCardData = allCardLibrary[cardKey] ?? {};
  const c = new Card({
    ...baseCardData,
    ...card ?? {},
    id: ++CARD_COUNT,
    cardKey: cardKey,
    cardName: baseCardData.cardName ?? capitalize(cardKey),
  });
  return c;
};
