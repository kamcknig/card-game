import { Card, CardKey } from 'shared/shared-types.ts';
import { ExpansionCardData } from '../state/expansion-data.ts';
import { capitalize } from "es-toolkit/compat";

let CARD_COUNT: number = 0;

export const createCardFactory = (cardData: ExpansionCardData) => {
  return (cardKey: CardKey, card?: Omit<Partial<Card>, 'id'>): Card => {
    const baseCardData = cardData.supply[cardKey] ?? cardData.kingdom[cardKey] ?? {};
    const c = new Card({
      ...baseCardData,
      ...card ?? {},
      id: ++CARD_COUNT,
      cardKey: cardKey,
      cardName: baseCardData.cardName ?? capitalize(cardKey),
    });
    console.log(`[createCard] created ${c}`);
    return c;
  };
};
