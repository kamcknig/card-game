import { Card, CardId, Match, PlayerId } from 'shared/types/index.ts';
import { CardSourceController } from '../card-source-controller.ts';
import { MatchCardLibrary } from '../match-card-library.ts';
import { CardInstanceFactoryService } from '../card-instance-factory-service.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { CardPriceRulesController } from '../card-price-rules-controller.ts';
import { PlayRulesController } from '../play-rules-controller.ts';
import { LogManager } from '../log-manager.ts';
import { LoggerService } from '../logger-service.ts';
import { Reaction } from '@server-types/index.ts';

/**
 * One captured undo point. Holds a deep copy of the bits of state that
 * cannot be inferred from the live `Match` object — including service-
 * internal state held in CardSourceController, ReactionManager, etc.
 * `match` and `cardLibrary` are deep-cloned via structuredClone (strips
 * prototype but keeps every field; restore copies fields back onto live
 * instances to preserve `instanceof` checks).
 */
interface UndoSnapshot {
  match: Match;
  cardLibrary: Record<CardId, Card>;
  cardCount: number;
  reactions: Reaction[];                                          // shallow copy of array
  durationTriggerIdsByCardId: Map<CardId, Set<string>>;          // deep-cloned
  cardPriceRulesByCardId: Record<CardId, unknown[]>;             // shallow copy of arrays
  playRules: unknown[];                                          // shallow copy of array
  logHistoryLength: number;
  /** PlayerId of the player whose action created this snapshot.
   *  null when the snapshot was taken during system-driven initialisation. */
  initiatingPlayerId: PlayerId | null;
}

/**
 * Per-match undo coordinator. Push a snapshot at every top-level
 * runGameAction boundary; pop and restore on demand from the vote
 * service. Restore mutates live objects in place to preserve reference
 * identity (especially CardSourceController._sourceMap arrays which
 * alias match.cardSources entries).
 */
export class MatchUndoService {
  // Bounded stack — older snapshots fall off the bottom when full.
  private static readonly MAX_SNAPSHOTS = 50;

  private readonly _snapshots: UndoSnapshot[] = [];
  // Resolves when the in-flight top-level runGameAction has caught
  // UndoAbortError and unwound; set during performUndo, awaited so the
  // restore happens against an idle engine.
  private _unwindResolver: (() => void) | null = null;

  constructor(
    private readonly match: Match,
    private readonly cardLibrary: MatchCardLibrary,
    private readonly cardSourceController: CardSourceController,
    private readonly cardInstanceFactoryService: CardInstanceFactoryService,
    private readonly reactionManager: ReactionManager,
    private readonly cardPriceController: CardPriceRulesController,
    private readonly playRulesController: PlayRulesController,
    private readonly logManager: LogManager,
    private readonly loggerService: LoggerService,
  ) {}

  /** True when at least one snapshot is available to restore. */
  public canUndo(): boolean {
    return this._snapshots.length > 0;
  }

  /** Returns the current number of snapshots on the stack. */
  public getSnapshotCount(): number {
    return this._snapshots.length;
  }

  /**
   * True when the stack contains at least one snapshot initiated by
   * `playerId`. Does not require that snapshot to be on top of the stack.
   */
  public canUndoForPlayer(playerId: PlayerId): boolean {
    return this._snapshots.some(s => s.initiatingPlayerId === playerId);
  }

  /**
   * Captures current state. `initiatingPlayerId` is the player whose
   * action created this boundary; null for system-driven calls.
   * Called from MatchController.runGameAction.
   */
  public pushSnapshot(initiatingPlayerId: PlayerId | null): void {
    const snapshot: UndoSnapshot = {
      match: structuredClone(this.match),
      cardLibrary: structuredClone(this.cardLibrary.getAllCards()),
      cardCount: this.cardInstanceFactoryService.getCardCount(),
      reactions: this.reactionManager.snapshotReactions(),
      durationTriggerIdsByCardId: this.reactionManager.snapshotDurationTriggers(),
      cardPriceRulesByCardId: this.cardPriceController.snapshotRules(),
      playRules: this.playRulesController.snapshotRules(),
      logHistoryLength: this.logManager.getHistoryLength(),
      initiatingPlayerId,
    };

    this._snapshots.push(snapshot);
    if (this._snapshots.length > MatchUndoService.MAX_SNAPSHOTS) {
      this._snapshots.shift();
    }

    this.loggerService.debug(
      `[undo] snapshot pushed by player ${initiatingPlayerId} (depth=${this._snapshots.length})`,
    );
  }

  /**
   * Resolves the unwind barrier. Called from MatchController's
   * UndoAbortError catch when the top-level call has fully unwound.
   */
  public signalUnwindComplete(): void {
    if (this._unwindResolver) {
      const resolve = this._unwindResolver;
      this._unwindResolver = null;
      resolve();
    }
  }

  /**
   * Pops the most recent snapshot, waits for the engine call stack to
   * unwind, then restores all state in place. Returns the snapshot or
   * null if there's nothing to undo.
   *
   * NB: Caller (vote service) is responsible for triggering
   * PromptAbortRegistry.abortAll(...) before calling this so the
   * in-flight prompt rejects with UndoAbortError.
   */
  public async restoreLatest(actionInFlight: boolean): Promise<UndoSnapshot | null> {
    const snapshot = this._snapshots.pop();
    if (!snapshot) return null;

    if (actionInFlight) {
      // Wait for runGameAction's outer catch to call signalUnwindComplete.
      await new Promise<void>(resolve => {
        this._unwindResolver = resolve;
      });
    }

    this._restoreInPlace(snapshot);
    return snapshot;
  }

  /**
   * Finds the most recent snapshot owned by `playerId`, removes it and
   * every snapshot above it (including those owned by other players), and
   * restores state in place. If `actionInFlight` is true, waits for the
   * engine call stack to unwind before restoring.
   *
   * Returns the restored snapshot, or null if none owned by `playerId`
   * exists in the stack.
   *
   * NB: Caller (vote service) is responsible for triggering
   * PromptAbortRegistry.abortAll(...) before calling this so the
   * in-flight prompt rejects with UndoAbortError.
   */
  public async restoreLatestForPlayer(
    playerId: PlayerId,
    actionInFlight: boolean,
  ): Promise<UndoSnapshot | null> {
    // Walk from the top to find this player's most recent snapshot.
    let targetIndex = -1;
    for (let i = this._snapshots.length - 1; i >= 0; i--) {
      if (this._snapshots[i].initiatingPlayerId === playerId) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) return null;

    // Save the target snapshot before splicing.
    const snapshot = this._snapshots[targetIndex];
    // Drop everything from the target index upward (includes the target
    // and all later snapshots, regardless of who owns them).
    this._snapshots.splice(targetIndex);

    if (actionInFlight) {
      // Wait for runGameAction's outer catch to call signalUnwindComplete.
      await new Promise<void>(resolve => {
        this._unwindResolver = resolve;
      });
    }

    this._restoreInPlace(snapshot);
    return snapshot;
  }

  /**
   * Mutates live engine state to match the snapshot. All restoration
   * happens in place to preserve reference identity that the
   * controller graph relies on (CardSourceController._sourceMap arrays
   * alias match.cardSources entries; service singletons are still
   * referenced from injected closures).
   */
  private _restoreInPlace(snapshot: UndoSnapshot): void {
    // 1. Replace Match fields. Strategy: clear every key on this.match
    //    and then assign each key from the snapshot. This preserves the
    //    Match object reference (which is held by every scoped service
    //    via constructor injection) but swaps every field.
    for (const key of Object.keys(this.match)) {
      delete (this.match as unknown as Record<string, unknown>)[key];
    }
    Object.assign(this.match, snapshot.match);

    // 2. Rebuild CardSourceController internals from the restored
    //    match.cardSources / cardSourceTagMap. The arrays inside
    //    match.cardSources are now the (deep-cloned) snapshot arrays;
    //    re-aliasing _sourceMap to point at them keeps the service
    //    consistent.
    this.cardSourceController.rebuildFromMatch();

    // 3. Restore Card instances by overwriting fields on the live
    //    instances. New cards (created post-snapshot) are removed; cards
    //    present at snapshot time but missing now are re-added.
    this._restoreCardLibrary(snapshot.cardLibrary);

    // 4. Restore the id allocator so any newly created cards post-undo
    //    don't collide with cards that were rewound out.
    this.cardInstanceFactoryService.setCardCount(snapshot.cardCount);

    // 5. Restore reaction registrations.
    this.reactionManager.restoreReactions(
      snapshot.reactions,
      snapshot.durationTriggerIdsByCardId,
    );

    // 6. Restore rule registries.
    this.cardPriceController.restoreRules(snapshot.cardPriceRulesByCardId);
    this.playRulesController.restoreRules(snapshot.playRules);

    // 7. Truncate log history. Clients receive the full restored log
    //    via setLog from the vote service after this returns.
    this.logManager.truncateHistory(snapshot.logHistoryLength);

    this.loggerService.info(
      `[undo] state restored (snapshots remaining=${this._snapshots.length})`,
    );
  }

  /**
   * Reconciles the live MatchCardLibrary._library map with a snapshot.
   * Cards present in both are mutated in place to keep prototypes;
   * cards added since the snapshot are removed; cards present at
   * snapshot time but missing now are recreated via rehydrateCard.
   */
  private _restoreCardLibrary(snapshotLibrary: Record<CardId, Card>): void {
    const liveCards = this.cardLibrary.getAllCardsAsArray();
    const snapshotIds = new Set(Object.keys(snapshotLibrary).map(Number));

    // Drop cards that didn't exist at snapshot time.
    for (const card of liveCards) {
      if (!snapshotIds.has(card.id)) {
        this.cardLibrary.removeCard(card.id);
      }
    }

    // Restore / recreate cards.
    for (const id of snapshotIds) {
      const snapshotCard = snapshotLibrary[id];
      const liveCard = this.cardLibrary.tryGetCard(id);
      if (liveCard) {
        // Mutate fields in place to preserve prototype.
        Object.assign(liveCard, snapshotCard);
      } else {
        this.cardLibrary.addCard(this.cardInstanceFactoryService.rehydrateCard(snapshotCard));
      }
    }
  }

  /** Discards all snapshots — typically when a match resets/ends. */
  public clear(): void {
    this._snapshots.length = 0;
    this._unwindResolver = null;
  }
}
