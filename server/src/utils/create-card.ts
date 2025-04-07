import { Card } from 'shared/shared-types.ts';
import { ExpansionCardData } from '../state/expansion-data.ts';

let CARD_COUNT: number = 0;

export const createCardFactory = (cardData: ExpansionCardData) => {
  return (cardName: string, card?: Omit<Card, "id">): Card => {
    const c = new Card({
      ...(cardData.supply[cardName] ?? cardData.kingdom[cardName]),
      ...card ?? {},
      id: ++CARD_COUNT,
      cardKey: cardName,
    });
    console.log(`[createCard] created ${c}`);
    return c;
  };
};
