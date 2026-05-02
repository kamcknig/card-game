import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { PlayerId } from 'shared/types';
import { SocketService } from '../socket-service/socket.service';
import { undoCompletedSignalStore, undoVoteRequestStore } from '../../state/undo-state';
import { playerStore } from '../../state/player-state';
import { PromptDialogCoordinatorService } from '../prompt-dialog/prompt-dialog-coordinator.service';

/**
 * Owns the voter-side undo confirmation dialog state.
 *
 * Lifecycle:
 * - When undoVoteRequested arrives via socket-event-map, that handler sets
 *   undoVoteRequestStore with the originator's PlayerId.
 * - This service mirrors that store into originatorId / originatorName signals
 *   so the template can conditionally render the dialog.
 * - vote(allow) emits undoVote(allow) to the server and immediately clears
 *   local state so the dialog closes without waiting for undoCompleted.
 * - undoCompleted (any outcome) auto-closes the dialog and, when ok=true,
 *   dismisses any open userPrompt dialog so stale modals are not left visible
 *   after the server aborts the in-flight prompt.
 */
@Injectable({ providedIn: 'root' })
export class UndoVoteCoordinatorService {
  private readonly _nanoService = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _promptDialog = inject(PromptDialogCoordinatorService);

  /** PlayerId of the player whose undo request this client is being asked to vote on. */
  readonly originatorId = signal<PlayerId | null>(null);

  /** Display name of the undo originator for the dialog body. */
  readonly originatorName = signal<string | null>(null);

  constructor() {
    // Mirror server-pushed vote requests into local signals.
    // When undoVoteRequestStore is set (by the undoVoteRequested socket
    // handler), look up the originator's display name from the player store
    // and expose it so the template can show the voter dialog.
    this._nanoService.useStore(undoVoteRequestStore).pipe(
      takeUntilDestroyed(),
    ).subscribe(id => {
      this.originatorId.set(id);
      if (id !== null) {
        const player = playerStore(id).get();
        this.originatorName.set(player?.name ?? `Player ${id}`);
      } else {
        this.originatorName.set(null);
      }
    });

    // Auto-close the voter dialog when an undo round resolves for any
    // reason (approved, denied, cancelled, or rejected). When the result is
    // ok=true the server has already aborted any in-flight userPrompt for
    // this client; clear the local prompt dialog so the user isn't left
    // staring at a stale modal.
    this._nanoService.useStore(undoCompletedSignalStore).pipe(
      takeUntilDestroyed(),
    ).subscribe(payload => {
      if (!payload) return;
      this.originatorId.set(null);
      this.originatorName.set(null);
      // Belt-and-suspenders: socket-event-map already cleared this on
      // undoCompleted, but also clear here in case the order differs.
      undoVoteRequestStore.set(null);
      if (payload.ok) {
        // Server has aborted the in-flight prompt; dismiss it on this client
        // so no stale prompt dialog remains open after the undo is applied.
        this._promptDialog.clearActivePrompt();
      }
    });
  }

  /**
   * Called when the voter clicks Allow or Deny.
   *
   * Emits the undoVote event to the server immediately and clears local state
   * so the dialog closes without waiting for the undoCompleted broadcast.
   */
  vote(allow: boolean): void {
    this._socketService.emit('undoVote', allow);
    this.originatorId.set(null);
    this.originatorName.set(null);
    undoVoteRequestStore.set(null);
  }
}
