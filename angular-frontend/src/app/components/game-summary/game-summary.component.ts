import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Card, CardId, CardKey, MatchSummary, PlayerId } from 'shared/types';
import { playerStore, selfPlayerIdStore } from '../../state/player-state';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { cardStore } from '../../state/card-state';
import { DeckEntriesPipe } from './deck-entries.pipe';
import { matchSummaryStore } from '../../state/match-state';
import { NanostoresService } from '@nanostores/angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule, LogIn, RefreshCw, Settings, Check, Clock } from 'lucide-angular';
import {
  gameOwnerIdStore,
  connectedPlayerReadyListStore,
  allConnectedPlayersReadyStore,
} from '../../state/game-state';
import { SocketService } from '../../core/socket-service/socket.service';

@Component({
  selector: 'app-game-summary',
  imports: [
    NgOptimizedImage,
    DeckEntriesPipe,
    LucideAngularModule,
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

  // Services
  private readonly _nanoStoresService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

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

  // Reactive owner and self tracking — update immediately when gameOwnerUpdated fires.
  private readonly _ownerIdSignal = toSignal(this._nanoStoresService.useStore(gameOwnerIdStore));
  private readonly _selfPlayerIdSignal = toSignal(this._nanoStoresService.useStore(selfPlayerIdStore));

  // Reactive player ready list — updates whenever any player's ready state changes.
  readonly playerReadyList = toSignal(
    this._nanoStoresService.useStore(connectedPlayerReadyListStore),
    { initialValue: [] },
  );

  // True when all connected non-computer players are ready.
  private readonly _allReadySignal = toSignal(
    this._nanoStoresService.useStore(allConnectedPlayersReadyStore),
    { initialValue: false },
  );

  // True when this client is currently the game owner.
  readonly isOwner = computed(() => {
    const ownerId = this._ownerIdSignal();
    const selfId = this._selfPlayerIdSignal();
    return ownerId !== undefined && selfId !== undefined && ownerId === selfId;
  });

  // True when this player is currently marked ready.
  readonly isSelfReady = computed(() => {
    const selfId = this._selfPlayerIdSignal();
    return this.playerReadyList().find(p => p.playerId === selfId)?.ready ?? false;
  });

  // True when the owner can trigger a restart — owner AND all players ready.
  readonly canRestart = computed(() => this.isOwner() && this._allReadySignal());

  // Lucide icon references — required for Angular template access.
  readonly ReturnIcon = LogIn;
  readonly RestartIcon = RefreshCw;
  readonly EditIcon = Settings;
  readonly CheckIcon = Check;
  readonly ClockIcon = Clock;

  // Sets page title once during component initialization.
  private initializeDocumentTitle() {
    this._document.title = 'Game Summary';
    return true;
  }

  /**
   * Emits a request to leave the post-game summary and return to the lobby.
   * The server unbinds the player from the game room and sends them a kickedFromGame event.
   */
  returnToLobby(): void {
    this._socketService.emit('returnToLobby');
  }

  /**
   * Toggles this player's ready state for the restart gate.
   * Sends the inverse of the current ready state so the server can broadcast the change.
   */
  toggleReady(): void {
    const selfId = this._selfPlayerIdSignal();
    if (selfId === undefined) return;
    this._socketService.emit('playerReady', selfId, !this.isSelfReady());
  }

  /**
   * Owner-only: emits a request to immediately restart the match with the same players.
   * The button is disabled unless canRestart() is true so this guard is a safety net.
   */
  restartMatch(): void {
    if (!this.canRestart()) return;
    this._socketService.emit('restartMatch');
  }

  /**
   * Owner-only: emits a request to return all players to match configuration.
   * Always enabled for the owner — no ready check required.
   */
  editMatch(): void {
    if (!this.isOwner()) return;
    this._socketService.emit('editMatch');
  }
}
