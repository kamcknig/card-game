import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { PlayerId } from 'shared/types';
import { UiDialogComponent } from '../../ui/dialog/ui-dialog.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { playerStore, selfPlayerIdStore } from '../../../state/player-state';
import { disconnectedHumanIdsStore, removalVoteStateStore, removedMatchPlayersStore } from '../../../state/game-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { gamePausedStore } from '../../../state/game-logic';
import { waitingOnPlayerIdStore } from '../../../state/match-ui-overlay-state';
import { undoCompletedSignalStore, undoInFlightStore } from '../../../state/undo-state';
import { UndoVoteCoordinatorService } from '../../../core/undo/undo-vote-coordinator.service';
import { buildDisconnectDialogRows, DisconnectDialogRow } from './disconnect-dialog-rows';

@Component({
  selector: 'app-match-hud',
  imports: [
    UiDialogComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './match-hud.component.html',
  styleUrl: './match-hud.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchHudComponent {
  private readonly _nanoService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);

  /**
   * Voter-side undo coordinator. Exposed as a field so the template can call
   * undoVote.vote(allow) directly and read undoVote.originatorName() to
   * conditionally render the voter dialog.
   */
  readonly undoVote = inject(UndoVoteCoordinatorService);

  // Controls visibility of the resign confirmation dialog.
  readonly resignDialogVisible = signal(false);

  // Controls visibility of the originator's undo-waiting dialog.
  readonly undoWaitingVisible = signal(false);

  constructor() {
    // Auto-close the undo waiting dialog when the server resolves the vote
    // for any outcome (approved, denied, cancelled, etc.).
    this._nanoService.useStore(undoCompletedSignalStore).pipe(
      takeUntilDestroyed(),
    ).subscribe(payload => {
      if (!payload) return;
      this.undoWaitingVisible.set(false);
    });

    // When the last disconnected player reconnects or is removed the
    // dialog closes; clear the voted/removed record so the next
    // disconnect starts fresh.
    this._nanoService.useStore(disconnectedHumanIdsStore).pipe(
      takeUntilDestroyed(),
    ).subscribe(ids => {
      if (ids.length) return;
      removedMatchPlayersStore.set([]);
      removalVoteStateStore.set([]);
    });
  }

  // Controls match pause overlay when any human player is disconnected.
  readonly gamePaused = toSignal(this._nanoService.useStore(gamePausedStore), {
    initialValue: gamePausedStore.get(),
  });

  // Resolves current "waiting for player" display name for the HUD overlay.
  readonly waitingOnPlayerName = toSignal(this._createWaitingOnPlayerNameStream(), {
    initialValue: null as string | null,
  });

  readonly disconnectedHumans = toSignal(this._createDisconnectedHumansStream(), {
    initialValue: [] as { id: PlayerId; name: string }[],
  });

  // Viewer identity for deriving per-row vote state.
  private readonly _selfPlayerId = toSignal(this._nanoService.useStore(selfPlayerIdStore), {
    initialValue: selfPlayerIdStore.get(),
  });

  // Server-authoritative vote snapshot and permanently removed players.
  private readonly _removalVoteState = toSignal(this._nanoService.useStore(removalVoteStateStore), {
    initialValue: removalVoteStateStore.get(),
  });
  private readonly _removedPlayers = toSignal(this._nanoService.useStore(removedMatchPlayersStore), {
    initialValue: removedMatchPlayersStore.get(),
  });

  // Dialog rows: active disconnected players (votable) then removed ones.
  readonly disconnectDialogRows = computed(() => buildDisconnectDialogRows({
    disconnected: this.disconnectedHumans(),
    removed: this._removedPlayers(),
    voteState: this._removalVoteState(),
    selfPlayerId: this._selfPlayerId(),
  }));

  // Dialog visibility: open while any ACTIVE disconnected player remains.
  // Removed-only rows close the dialog (all resolved — play resumes).
  readonly disconnectDialogVisible = computed(() => this.disconnectedHumans().length > 0);

  /**
   * Opens the resign confirmation dialog.
   *
   * Called either directly from the resign dialog or via MatchComponent after
   * the aside emits `resignRequested`.
   */
  requestResign(): void {
    this.resignDialogVisible.set(true);
  }

  // Closes the resign dialog without resigning.
  onCancelResign(): void {
    this.resignDialogVisible.set(false);
  }

  // Confirms resign: emits the server event and closes the dialog.
  onConfirmResign(): void {
    this.resignDialogVisible.set(false);
    this._socketService.emit('resignMatch');
  }

  /**
   * Opens the undo waiting dialog, marks the undo as in-flight, and emits
   * the undoRequested event to the server. Called via ViewChild from
   * MatchComponent when the aside relays an undo request.
   */
  requestUndo(): void {
    undoInFlightStore.set(true);
    this.undoWaitingVisible.set(true);
    this._socketService.emit('undoRequested');
  }

  // Closes the undo waiting dialog and notifies the server that the
  // originator has cancelled the vote.
  onCancelUndo(): void {
    undoInFlightStore.set(false);
    this.undoWaitingVisible.set(false);
    this._socketService.emit('undoCancelled');
  }

  // Toggles this viewer's kick vote for one disconnected player.
  onToggleKickVote(row: DisconnectDialogRow): void {
    if (row.removed) return;
    if (row.votedBySelf) {
      this._socketService.emit('retractRemoveDisconnectedPlayer', row.playerId);
      return;
    }
    this._socketService.emit('removeDisconnectedPlayer', row.playerId);
  }

  // Builds disconnected human-player banner data.
  private _createDisconnectedHumansStream() {
    return this._nanoService.useStore(disconnectedHumanIdsStore).pipe(
      switchMap((ids) => {
        if (!ids.length) return of([]);
        return combineLatest(ids.map((id) => this._nanoService.useStore(playerStore(id))));
      }),
      map((players) =>
        players.filter((p) => !!p).map((p) => ({ id: p!.id, name: p!.name }))
      )
    );
  }

  // Builds waiting overlay text from the active player id payload.
  private _createWaitingOnPlayerNameStream() {
    return this._nanoService.useStore(waitingOnPlayerIdStore).pipe(
      switchMap((playerId) => {
        if (playerId === null) {
          return of(null);
        }
        return this._nanoService.useStore(playerStore(playerId)).pipe(
          map((player) => player?.name ?? `Player ${playerId}`)
        );
      })
    );
  }
}
