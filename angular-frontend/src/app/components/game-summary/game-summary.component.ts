import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Card, CardId, CardKey, MatchSummary, PlayerId } from 'shared/types';
import { playerStore } from '../../state/player-state';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { cardStore } from '../../state/card-state';
import { DeckEntriesPipe } from './deck-entries.pipe';
import { matchSummaryStore } from '../../state/match-state';

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
export class GameSummaryComponent {
  /** Match summary populated by the gameOver socket event before this route activates. */
  readonly matchSummary = computed<MatchSummary>(() => matchSummaryStore.get()!);

  private readonly _document = inject(DOCUMENT);
  // Applies static title for browser tabs when summary view is active.
  private readonly _documentTitleInitialized = this.initializeDocumentTitle();

  readonly allCards = computed<Record<CardId, Card>>(() => cardStore.get());

  readonly playerNamesById = computed<Record<PlayerId, string>>(() => {
    const names: Record<PlayerId, string> = {} as Record<PlayerId, string>;
    for (const summary of this.matchSummary().playerSummary) {
      names[summary.playerId] = playerStore(summary.playerId).get()?.name ?? `Player ${summary.playerId}`;
    }
    return names;
  });

  readonly playerDecks = computed<{
    playerId: PlayerId,
    playerName: string,
    cards: Record<CardKey, {
      cardId: CardId;
      count: number
    }>
  }[]>(() => {
    const allCards = this.allCards();
    const playerNamesById = this.playerNamesById();
    return this.matchSummary().playerSummary.map((summary) => {
      const cards: Record<CardKey, { cardId: CardId; count: number; }> = {};
      for (const cardId of summary.deck) {
        const card = allCards[cardId];
        cards[card.cardKey] = (cards[card.cardKey] ??= { cardId, count: 0 });
        cards[card.cardKey].count++;
      }
      return {
        playerId: summary.playerId,
        playerName: playerNamesById[summary.playerId] ?? `Player ${summary.playerId}`,
        cards,
      };
    });
  });

  readonly playerSummaries = computed(() => {
    const playerNamesById = this.playerNamesById();
    return this.matchSummary().playerSummary.map((summary) => ({
      ...summary,
      playerName: playerNamesById[summary.playerId] ?? `Player ${summary.playerId}`,
    }));
  });

  // Sets page title once during component initialization.
  private initializeDocumentTitle() {
    this._document.title = 'Game Summary';
    return true;
  }
}
