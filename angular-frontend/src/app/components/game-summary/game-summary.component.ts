import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Card, CardId, CardKey, MatchSummary, PlayerId } from 'shared/types';
import { playerStore, selfPlayerIdStore } from '../../state/player-state';
import { NgOptimizedImage } from '@angular/common';
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
import { SceneBannerComponent } from '../scene-banner/scene-banner.component';
import { displayCardDetail } from '../match/views/modal/display-card-detail';

@Component({
  selector: 'app-game-summary',
  imports: [
    NgOptimizedImage,
    DeckEntriesPipe,
    LucideAngularModule,
    SceneBannerComponent,
  ],
  templateUrl: './game-summary.component.html',
  styleUrl: './game-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameSummaryComponent {
  /** Match summary populated by the gameOver socket event before this route activates. */
  readonly matchSummary = computed<MatchSummary>(() => matchSummaryStore.get()!);

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
        // Guard: card may be absent from the library if cardStore was partially stale.
        if (!card) continue;
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

  /**
   * Per-row winner flags for the ranking list. The server pre-sorts
   * playerSummary (score desc, then fewer turns, then seat order), so row 0
   * is always a winner; later rows share the win only when they tie row 0
   * on BOTH score and turns taken (Dominion's tie rule).
   */
  readonly winnerFlags = computed<boolean[]>(() => {
    const summaries = this.playerSummaries();
    if (summaries.length === 0) {
      return [];
    }
    const first = summaries[0];
    return summaries.map((summary, index) =>
      index === 0
      || (summary.score === first.score && summary.turnsTaken === first.turnsTaken));
  });

  // Reactive owner and self tracking — initialValue seeds from current store state so
  // isOwner() is correct on the first synchronous render without waiting for Angular's
  // scheduler to flush the first nanostore emission.
  private readonly _ownerIdSignal = toSignal(
    this._nanoStoresService.useStore(gameOwnerIdStore),
    { initialValue: gameOwnerIdStore.get() },
  );
  private readonly _selfPlayerIdSignal = toSignal(
    this._nanoStoresService.useStore(selfPlayerIdStore),
    { initialValue: selfPlayerIdStore.get() },
  );

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

  constructor() {
    // The owner is always considered ready. When ownership is assigned or
    // transferred, automatically emit a ready state of true so the restart
    // gate never blocks on the owner. The short-circuit on isSelfReady()
    // prevents redundant socket emissions once the server confirms ready.
    effect(() => {
      if (!this.isOwner()) return;
      const selfId = this._selfPlayerIdSignal();
      if (selfId === undefined || this.isSelfReady()) return;
      this._socketService.emit('playerReady', selfId, true);
    });
  }

  /**
   * Right-click on a deck strip opens the global card detail dialog for that
   * card. Passing ONLY the detail image path (no cardId/kingdom/cardKey/
   * expansionName/pileMembers) deliberately suppresses every sibling
   * resolver in displayCardDetail — the summary view shows just the card
   * itself, with no split-pile/traveller/linked-pile sibling column.
   */
  onCardContextMenu(event: MouseEvent, card: Card | undefined): void {
    event.preventDefault();
    if (!card?.detailImagePath) {
      return;
    }
    void displayCardDetail({ detailImagePath: card.detailImagePath });
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
