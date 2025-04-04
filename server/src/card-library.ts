import { Card, CardId } from "shared/shared-types.ts";

export class CardLibrary {
  private readonly _library: Map<CardId, Card> = new Map();

  public addCard = (card: Card) => {
    console.log(`[CARD LIBRARY] adding ${card} to library`);
    this._library.set(card.id, card);
  };

  public getCard = (cardId: CardId): Card => {
    const c = this._library.get(cardId);
    if (!c) throw new Error(`[CARD LIBRARY] unable to locate card ${cardId}`);
    return c;
  };

  public getAllCards = (): Record<number, Card> => {
    return Object.fromEntries(this._library) as Record<number, Card>;
  };
}
