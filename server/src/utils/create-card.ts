import {cardLibrary} from "./load-expansion.ts";
import {Card} from "shared/types.ts";

let CARD_COUNT: number = 0;

export const createCard = (cardName: string, card?: Omit<Card, 'id'>): Card => {
    const c = new Card({
        ...(cardLibrary['supply'][cardName] ?? cardLibrary['kingdom'][cardName]),
        order: 0,
        ...card ?? {},
        id: ++CARD_COUNT,
        cardKey: cardName
    });
    return c;
}