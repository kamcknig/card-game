import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { PlayerId } from 'shared/types';
import { UiDialogComponent } from '../../ui/dialog/ui-dialog.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { playerStore } from '../../../state/player-state';
import { disconnectedHumanIdsStore } from '../../../state/game-state';
import { SocketService } from '../../../core/socket-service/socket.service';
import { gamePausedStore } from '../../../state/game-logic';
import { waitingOnPlayerIdStore } from '../../../state/match-ui-overlay-state';
import { undoCompletedSignalStore, undoInFlightStore } from '../../../state/undo-state';
import { UndoVoteCoordinatorService } from '../../../core/undo/undo-vote-coordinator.service';

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

  private _disconnectedHumanIds: PlayerId[] = [];

  constructor() {
    // Auto-close the undo waiting dialog when the server resolves the vote
    // for any outcome (approved, denied, cancelled, etc.).
    this._nanoService.useStore(undoCompletedSignalStore).pipe(
      takeUntilDestroyed(),
    ).subscribe(payload => {
      if (!payload) return;
      this.undoWaitingVisible.set(false);
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

  // Removes the oldest disconnected human player.
  onRemoveDisconnectedPlayer(): void {
    const targetId = this._disconnectedHumanIds[0];
    if (!targetId) return;
    this._socketService.emit('removeDisconnectedPlayer', targetId);
  }

  // Builds disconnected human-player banner data.
  private _createDisconnectedHumansStream() {
    return this._nanoService.useStore(disconnectedHumanIdsStore).pipe(
      switchMap((ids) => {
        this._disconnectedHumanIds = [...ids];
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
