import { Card, CardId, PlayerId } from 'shared/shared-types.ts';

/**
 * The CardLibrary class provides a way to add cards into a library that is used within a Match.
 *
 * The library should include every physical card created to be used within a match. This is NOT a library
 * of every card possible; ONLY the ones created and used in a Match.
 */
export class MatchCardLibrary {
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
  
  public getAllCardsAsArray = (): Card[] => {
    return this._library.values().toArray();
  }
  
  getCardsByOwner(id: PlayerId) {
    const allCards = this.getAllCardsAsArray();
    const playerCards = allCards.filter(c => {
      return c.owner === id;
    });
    return playerCards;
  }
}
