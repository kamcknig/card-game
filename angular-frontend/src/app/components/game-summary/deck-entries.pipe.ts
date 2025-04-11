import { Pipe, PipeTransform } from '@angular/core';
import { CardId, CardKey } from 'shared/shared-types';

@Pipe({ name: 'deckEntries', standalone: true })
export class DeckEntriesPipe implements PipeTransform {
  transform(cards: Record<CardKey, { cardId: CardId; count: number }>): { cardId: number; count: number }[] {
    return Object.entries(cards).map(([cardKey, { cardId, count }]) => ({
      cardId: +cardId,
      count,
    }));
  }
}
