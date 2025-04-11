import { ChangeDetectionStrategy, Component, Inject, Input, OnInit } from '@angular/core';
import { Card, CardId, CardKey, MatchSummary, PlayerId } from 'shared/shared-types';
import { playerStore } from '../../state/player-state';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { cardStore } from '../../state/card-state';
import { DeckEntriesPipe } from './deck-entries.pipe';

@Component({
  selector: 'app-game-summary',
  imports: [
    NgOptimizedImage,
    DeckEntriesPipe
  ],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameSummaryComponent implements OnInit {
  @Input() matchSummary!: MatchSummary;

  playerDecks: {
    playerId: PlayerId,
    cards: Record<CardKey, {
      cardId: CardId;
      count: number
    }>
  }[] = [];
  allCards: Record<CardId, Card> | undefined;

  constructor(
    @Inject(DOCUMENT) document: Document
  ) {
    document.title = 'Game Summary';
  }

  ngOnInit(): void {
    this.allCards = cardStore.get();

    for (const summary of this.matchSummary.playerSummary) {
      const deck =
        this.playerDecks[this.playerDecks.push({ playerId: summary.playerId, cards: {} }) - 1];

      for (const cardId of summary.deck) {
        const card = this.allCards[cardId];
        deck.cards[card.cardKey] = (deck.cards[card.cardKey] ??= { cardId, count: 0 });
        deck.cards[card.cardKey].count++;
      }
    }
  }

  getPlayerName(playerId: PlayerId): string {
    return playerStore(playerId).get()?.name!;
  }
}
