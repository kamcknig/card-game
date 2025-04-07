import { Card, CardKey } from 'shared/shared-types.ts';
import { ExpansionCardData } from '../state/expansion-data.ts';

let CARD_COUNT: number = 0;

export const createCardFactory = (cardData: ExpansionCardData) => {
  return (cardKey: CardKey, card?: Omit<Card, "id">): Card => {
    const c = new Card({
      ...(cardData.supply[cardKey] ?? cardData.kingdom[cardKey]),
      ...card ?? {},
      id: ++CARD_COUNT,
      cardKey: cardKey,
    });
    console.log(`[createCard] created ${c}`);
    return c;
  };
};
