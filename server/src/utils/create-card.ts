import {cardData} from "./load-expansion.ts";
import {Card} from "shared/shared-types.ts";

let CARD_COUNT: number = 0;

export const createCard = (cardName: string, card?: Omit<Card, 'id'>): Card => {
    const c = new Card({
        ...(cardData['supply'][cardName] ?? cardData['kingdom'][cardName]),
        order: 0,
        ...card ?? {},
        id: ++CARD_COUNT,
        cardKey: cardName
    });
    console.debug(`[createCard] created ${c}`);
    return c;
}