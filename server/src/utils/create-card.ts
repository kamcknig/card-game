import { Card, CardKey } from 'shared/shared-types.ts';
import { CardData } from '../types.ts';

let CARD_COUNT: number = 0;

export const createCardFactory = (cardData: Record<CardKey, CardData>) => {
  return (cardName: string, card?: Omit<Card, "id">): Card => {
    const c = new Card({
      ...(cardData[cardName]),
      ...card ?? {},
      id: ++CARD_COUNT,
      cardKey: cardName,
    });
    console.log(`[createCard] created ${c}`);
    return c;
  };
};
