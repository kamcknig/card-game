import { PlayerId } from 'shared/types/index.ts';
import { AppSocket } from '@server-types/index.ts';

/** Thrown into in-flight prompt awaits when an undo aborts the action. */
export class UndoAbortError extends Error {
  constructor() {
    super('undo: action aborted');
    this.name = 'UndoAbortError';
  }
}

/**
 * Everything the registry needs to abort or replay one in-flight
 * userPrompt/selectCard round-trip. The callbacks close over
 * promptViaSocket's listener and payload so the registry itself stays
 * free of socket bookkeeping.
 */
export interface PendingPromptHandle {
  signalId: string;
  // Player whose input the server is awaiting.
  playerId: PlayerId;
  // Rejects the in-flight promise (undo abort path).
  reject: (error: unknown) => void;
  // Removes the userInputReceived listener from whichever socket
  // currently holds it.
  detach: () => void;
  // Rebinds the listener onto a new socket and re-emits the original
  // prompt (same signalId + payload) so a reconnecting client resumes
  // the choice.
  reattach: (socket: AppSocket) => void;
}

/**
 * Per-match registry of in-flight userPrompt / selectCard /
 * selectSingleCard round-trips. Serves two consumers: the undo service
 * (abortAll rejects every pending promise) and the reconnect path
 * (reattachForPlayer replays pending prompts onto a fresh socket).
 */
export class PromptAbortRegistry {
  private readonly _pending = new Map<string, PendingPromptHandle>();

  /**
   * Registers a pending prompt handle. Returns an unregister function
   * that removes the entry without rejecting or detaching it.
   */
  public register(handle: PendingPromptHandle): () => void {
    this._pending.set(handle.signalId, handle);
    return () => {
      this._pending.delete(handle.signalId);
    };
  }

  /**
   * Rejects every currently-registered prompt with UndoAbortError and
   * detaches its socket listener so no stale listener lingers on a
   * socket after the action stack unwinds. The map is cleared first so
   * callers can't double-reject.
   */
  public abortAll(): void {
    const handles = Array.from(this._pending.values());
    this._pending.clear();
    const error = new UndoAbortError();
    for (const handle of handles) {
      handle.detach();
      handle.reject(error);
    }
  }

  /**
   * Replays every pending prompt targeted at `playerId` onto `socket`
   * (rebinding the response listener and re-emitting the original
   * request). Returns true when at least one prompt was replayed.
   */
  public reattachForPlayer(playerId: PlayerId, socket: AppSocket): boolean {
    let reattached = false;
    for (const handle of this._pending.values()) {
      if (handle.playerId !== playerId) continue;
      handle.reattach(socket);
      reattached = true;
    }
    return reattached;
  }

  /** Snapshot of pending handles for callers that need player targeting. */
  public getPendingEntries(): PendingPromptHandle[] {
    return Array.from(this._pending.values());
  }

  /** True when at least one prompt is currently in flight. */
  public hasInFlight(): boolean {
    return this._pending.size > 0;
  }
}
