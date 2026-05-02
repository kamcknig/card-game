import { Match, Player, PlayerId, UndoCompletedPayload } from 'shared/types/index.ts';
import { AppSocket } from '@server-types/index.ts';
import { MatchUndoService } from './match-undo-service.ts';
import { PromptAbortRegistry } from './prompt-abort-registry.ts';
import { LogManager } from '../log-manager.ts';
import { LoggerService } from '../logger-service.ts';

/**
 * State for a single in-flight undo vote round. At most one may be active
 * per match at any time.
 */
interface ActiveVote {
  /** The player who initiated the undo request. */
  originatorId: PlayerId;
  /** Human voters who have not yet responded. Approval requires all to respond. */
  votersPending: Set<PlayerId>;
}

/**
 * Coordinates one in-flight undo vote per match. Mirrors
 * DisconnectedPlayerVoteService in shape (vote sets, all-connected-humans
 * gate, bot exclusion) but adds (a) auto-approval when the originator
 * is the only human and (b) origin-side cancellation.
 *
 * The matchController reference is NOT injected through the DI container to
 * avoid a circular dependency (MatchController ↔ MatchUndoVoteService). Instead,
 * the two needed methods — getMatchSnapshot and broadcastPatch — are bound
 * after scope resolution via bindControllerMethods(). See MatchScopeFactory.
 *
 * Flow:
 *  - requestUndo(originatorId) — validates preconditions, starts the vote or
 *    auto-approves if no other humans are present.
 *  - registerVote(voterId, allow) — records an individual vote; broadcasts
 *    deny or proceeds to _completeApproved when all pending voters have allowed.
 *  - cancelByOriginator(originatorId) — originator clicks Cancel; broadcasts cancelled.
 *  - handlePlayerDisconnected(playerId) — abandons the vote (originator left) or
 *    removes a disconnected voter (treating the absence as auto-approve).
 */
export class MatchUndoVoteService {
  /** Currently active vote round, or null when no vote is in progress. */
  private _activeVote: ActiveVote | null = null;

  /**
   * Bound reference to MatchController.getMatchSnapshot. Populated by
   * bindControllerMethods() after scope resolution to avoid circular DI.
   */
  private _getMatchSnapshot: (() => Match) | null = null;
  /** Bound reference to MatchController.broadcastCanUndo. */
  private _broadcastCanUndo: (() => void) | null = null;

  /**
   * Bound reference to MatchController.broadcastPatch. Populated by
   * bindControllerMethods() after scope resolution to avoid circular DI.
   */
  private _broadcastPatch: ((prev: Match) => void) | null = null;

  /**
   * Bound reference to MatchController._gameEnding getter. Populated by
   * bindControllerMethods() to check whether the game has ended without
   * a direct MatchController dependency.
   */
  private _isGameEndedFn: (() => boolean) | null = null;

  constructor(
    private readonly socketMap: Map<PlayerId, AppSocket>,
    private readonly match: Match,
    private readonly undoService: MatchUndoService,
    private readonly promptAbortRegistry: PromptAbortRegistry,
    private readonly logManager: LogManager,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Binds the MatchController methods needed by the vote service.
   * Must be called once in MatchScopeFactory after both matchController and
   * undoVoteService have been resolved, to avoid a circular DI dependency.
   *
   * @param getSnapshot - bound to matchController.getMatchSnapshot
   * @param broadcastPatch - bound to matchController.broadcastPatch
   * @param isGameEnded - closure returning matchController._gameEnding
   */
  public bindControllerMethods(
    getSnapshot: () => Match,
    broadcastPatch: (prev: Match) => void,
    isGameEnded: () => boolean,
    broadcastCanUndo: () => void,
  ): void {
    this._getMatchSnapshot = getSnapshot;
    this._broadcastPatch = broadcastPatch;
    this._isGameEndedFn = isGameEnded;
    this._broadcastCanUndo = broadcastCanUndo;
  }

  /** True when an undo vote is currently in progress. */
  public hasActiveVote(): boolean {
    return this._activeVote !== null;
  }

  /**
   * Originator clicks the undo button. Validates and either:
   *  - rejects immediately (no snapshot, not their action, game over, or vote already running),
   *  - completes immediately (no other connected humans to ask),
   *  - or broadcasts undoVoteRequested to all other connected human players.
   */
  public async requestUndo(originatorId: PlayerId): Promise<void> {
    // Reject if a vote is already in flight for this match.
    if (this._activeVote) {
      this.loggerService.debug(`[undo] vote already in progress; rejecting request from ${originatorId}`);
      this._emitTo(originatorId, { ok: false, reason: 'already-in-progress' });
      return;
    }

    // Reject if the stack is completely empty.
    if (!this.undoService.canUndo()) {
      this.loggerService.debug(`[undo] no snapshot available; rejecting undo request from ${originatorId}`);
      this._emitTo(originatorId, { ok: false, reason: 'no-snapshot' });
      return;
    }

    // Reject if the originator has no snapshot in the stack at all.
    if (!this.undoService.canUndoForPlayer(originatorId)) {
      this.loggerService.debug(`[undo] no snapshot owned by player ${originatorId}; rejecting`);
      this._emitTo(originatorId, { ok: false, reason: 'not-your-action' });
      return;
    }

    // Reject once game-over has been broadcast.
    if (this._isGameEndedFn?.()) {
      this.loggerService.debug(`[undo] game ended; rejecting undo request from ${originatorId}`);
      this._emitTo(originatorId, { ok: false, reason: 'game-ended' });
      return;
    }

    const otherHumans = this._collectOtherConnectedHumans(originatorId);

    this._activeVote = {
      originatorId,
      votersPending: new Set(otherHumans.map(p => p.id)),
    };

    this.loggerService.info(
      `[undo] vote started by player ${originatorId} (pending voters=${otherHumans.length})`,
    );

    // When the originator is the only human (or all others are bots/disconnected),
    // approve immediately without broadcasting a vote prompt.
    if (otherHumans.length === 0) {
      this.loggerService.info(`[undo] no other humans to ask; auto-approving for ${originatorId}`);
      await this._completeApproved();
      return;
    }

    // Notify all other connected humans that a vote is requested.
    for (const voter of otherHumans) {
      this.socketMap.get(voter.id)?.emit('undoVoteRequested', originatorId);
    }
  }

  /**
   * A voter responds with allow=true or allow=false.
   *
   * Deny from any voter immediately cancels the vote and broadcasts the
   * denial to all clients. When all pending voters have allowed, the undo
   * is completed.
   */
  public async registerVote(voterId: PlayerId, allow: boolean): Promise<void> {
    const active = this._activeVote;
    if (!active) {
      this.loggerService.debug(`[undo] registerVote called but no active vote (voter=${voterId})`);
      return;
    }

    if (!active.votersPending.has(voterId)) {
      this.loggerService.debug(`[undo] unexpected vote from ${voterId}; not in pending set`);
      return;
    }

    if (!allow) {
      this.loggerService.info(`[undo] vote denied by player ${voterId}`);
      this._broadcast({ ok: false, reason: 'denied', deniedBy: voterId });
      this._activeVote = null;
      return;
    }

    active.votersPending.delete(voterId);
    this.loggerService.debug(
      `[undo] player ${voterId} approved; remaining voters=${active.votersPending.size}`,
    );

    if (active.votersPending.size === 0) {
      await this._completeApproved();
    }
  }

  /**
   * Originator clicks Cancel on their waiting modal.
   *
   * Broadcasts undoCompleted({ ok: false, reason: 'cancelled' }) so every
   * voter dialog also closes.
   */
  public cancelByOriginator(originatorId: PlayerId): void {
    if (!this._activeVote || this._activeVote.originatorId !== originatorId) {
      this.loggerService.debug(`[undo] cancelByOriginator called but no matching active vote`);
      return;
    }

    this.loggerService.info(`[undo] vote cancelled by originator ${originatorId}`);
    this._broadcast({ ok: false, reason: 'cancelled' });
    this._activeVote = null;
  }

  /**
   * Called when a player disconnects. If the originator left, the vote is
   * abandoned with 'cancelled'. If a voter left without responding, they are
   * treated as auto-approving, and the undo completes if they were the last
   * pending voter.
   */
  public handlePlayerDisconnected(playerId: PlayerId): void {
    const active = this._activeVote;
    if (!active) return;

    if (active.originatorId === playerId) {
      this.loggerService.info(
        `[undo] originator ${playerId} disconnected; cancelling vote`,
      );
      this._broadcast({ ok: false, reason: 'cancelled' });
      this._activeVote = null;
      return;
    }

    if (active.votersPending.has(playerId)) {
      // Disconnecting voter is treated as an implicit approval.
      active.votersPending.delete(playerId);
      this.loggerService.info(
        `[undo] voter ${playerId} disconnected; treating as auto-approve (remaining=${active.votersPending.size})`,
      );
      if (active.votersPending.size === 0) {
        // Fire without await — handlePlayerDisconnected is synchronous.
        void this._completeApproved();
      }
    }
  }

  /**
   * Collects human players who are currently connected and are not the
   * originator. Bots and disconnected players are excluded — bots never
   * need to vote, and disconnected players cannot respond.
   */
  private _collectOtherConnectedHumans(originatorId: PlayerId): Player[] {
    return (this.match.players ?? []).filter(
      p => !p.isComputer && p.connected && p.id !== originatorId,
    );
  }

  /**
   * All voters have approved (or there were none). Performs the undo:
   * 1. Captures the current client-visible state for the patch diff.
   * 2. Aborts any in-flight prompt so the engine call stack unwinds.
   * 3. Restores state from the latest snapshot.
   * 4. Adds an undoApplied log entry and flushes it.
   * 5. Broadcasts the state patch then replaces every client's log.
   * 6. Broadcasts undoCompleted({ ok: true }) to close all dialogs.
   */
  private async _completeApproved(): Promise<void> {
    const active = this._activeVote;
    if (!active) return;

    if (!this._getMatchSnapshot || !this._broadcastPatch) {
      this.loggerService.error(`[undo] controller methods not bound; cannot complete undo`);
      this._broadcast({ ok: false, reason: 'no-snapshot' });
      this._activeVote = null;
      return;
    }

    // Capture the state clients currently have so the post-restore patch
    // can diff cleanly against the pre-restore baseline.
    const preRestore = this._getMatchSnapshot();

    // If a userPrompt or selectCard is currently awaiting player input,
    // abort it so the engine call stack unwinds before restore.
    const inFlight = this.promptAbortRegistry.hasInFlight();
    if (inFlight) {
      this.loggerService.debug(`[undo] aborting in-flight prompt before restore`);
      this.promptAbortRegistry.abortAll();
    }

    // Use restoreLatestForPlayer so that snapshots owned by other players
    // sitting above the originator's snapshot are also discarded from the stack.
    const snapshot = await this.undoService.restoreLatestForPlayer(active.originatorId, inFlight);
    if (!snapshot) {
      // Race: snapshot was consumed between requestUndo validation and now.
      this.loggerService.warn(`[undo] snapshot disappeared between vote start and restore`);
      this._broadcast({ ok: false, reason: 'no-snapshot' });
      this._activeVote = null;
      return;
    }

    // Add a log entry naming the originator so all clients see who rewound.
    // Calling addLogEntry outside a runGameAction is safe; flushQueue
    // broadcasts only this entry via addLogEntry before setLog replaces
    // the full history.
    this.logManager.addLogEntry({
      root: true,
      type: 'undoApplied',
      playerId: active.originatorId,
    });
    this.logManager.flushQueue();

    // Broadcast the restored state diff to all clients.
    this._broadcastPatch(preRestore);

    // Replace every client's log store with the now-truncated history
    // (which includes the undoApplied entry appended above).
    this.socketMap.forEach(s => s.emit('setLog', this.logManager.getHistory()));

    // Update undo button state after the stack has been popped.
    this._broadcastCanUndo?.();

    this.loggerService.info(`[undo] undo approved and applied for player ${active.originatorId}`);
    this._broadcast({ ok: true, by: active.originatorId });
    this._activeVote = null;
  }

  /** Emits undoCompleted to every connected player socket. */
  private _broadcast(payload: UndoCompletedPayload): void {
    this.socketMap.forEach(s => s.emit('undoCompleted', payload));
  }

  /** Emits undoCompleted to a single player's socket. */
  private _emitTo(playerId: PlayerId, payload: UndoCompletedPayload): void {
    this.socketMap.get(playerId)?.emit('undoCompleted', payload);
  }
}
