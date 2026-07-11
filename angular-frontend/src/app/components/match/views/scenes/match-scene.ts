import {matchStore} from '../../../../state/match-state';
import {playerStore, selfPlayerIdStore,} from '../../../../state/player-state';
import {CardId, CardKey, PlayCardSelectionResult, PlayerId, PROMPT_DECLINE_ACTION, UserPromptActionArgs} from 'shared/types';
import {
  awaitingServerLockReleaseStore,
  clientSelectableCardsOverrideStore,
  clientSelectablePilesOverrideStore,
  promptWaySelectableCardsOverrideStore,
  promptInteractionLockStore,
  selectedCardStore,
  selectedPileStore
} from '../../../../state/interactive-state';
import {resolveCountSpec} from 'shared/resolve-count-spec';
import {validateCountSpec} from 'shared/validate-count-spec';
import {currentPlayerTurnIdStore, turnNumberStore, turnPhaseStore} from '../../../../state/turn-state';
import {SocketService} from '../../../../core/socket-service/socket.service';
import {supplyPileTopCardIdsStore, waySelectableCardStore} from '../../../../state/interactive-logic';
import {SelectCardArgs} from '../../../../../types';
import { PromptDialogCoordinatorService } from '../../../../core/prompt-dialog/prompt-dialog-coordinator.service';
import { WayPickerOverlayService } from '../../../../core/way-picker/way-picker-overlay.service';
import {
  pileSelectionOverlayActionStore,
  pileSelectionOverlayStore
} from '../../../../state/pile-selection-overlay-state';
import { SoundService } from '../../../../core/sound.service';

export class MatchScene {
  private _cleanup: (() => void)[] = [];
  private _selecting: boolean = false;
  private _selectingPiles: boolean = false;
  // Tears down an in-flight board card-selection without emitting a reply —
  // invoked when the server abandons the request (empty selectableCardIds
  // refresh) or the scene is destroyed mid-selection.
  private _boardCardSelectionTeardown: (() => void) | null = null;
  private _selfId: PlayerId = selfPlayerIdStore.get()!;
  // Tracks the turn number the start-of-turn sound has been played for so we
  // don't replay it when matchStore updates within the same turn.
  private _lastPlayedTurnNumber: number | undefined = undefined;

  private get uiInteractive(): boolean {
    return !this._selecting && !this._selectingPiles && !awaitingServerLockReleaseStore.get();
  }

  constructor(
    private _socketService: SocketService,
    private readonly _promptDialogCoordinator: PromptDialogCoordinatorService,
    private readonly _wayPickerOverlay: WayPickerOverlayService,
    private readonly _soundService: SoundService,
  ) {
    if (!this._selfId) throw new Error('self id not set in match scene');
  }

  async initialize() {
    // Ensure UI lock state doesn't persist across page refreshes.
    awaitingServerLockReleaseStore.set(false);
    promptInteractionLockStore.set(false);

    this._socketService.on('ping', this.onPing);
    this._socketService.on('selectCard', this.doSelectCards);
    this._socketService.on('userPrompt', this.onUserPrompt);

    this._cleanup.push(() => {
      this._socketService.off('ping');
      this._socketService.off('selectCard');
      this._socketService.off('userPrompt');
    });

    // Drive document.title off the current-player id (it can stay subscribed
    // here even with batched patches because the title is only meaningful for
    // the latest value).
    this._cleanup.push(currentPlayerTurnIdStore.subscribe(this.onCurrentPlayerTurnUpdated));

    // Drive the start-of-turn sound off turnNumber instead of the
    // current-player id. When a computer-only round is delivered as a single
    // batched patch (user → AI1 → AI2 → AI3 → user), currentPlayerTurnIdStore
    // sees the same id as before the patch and never notifies — turnNumber
    // always advances per turn, so this fires reliably even across batches.
    this._cleanup.push(turnNumberStore.subscribe(this.onTurnNumberChanged));
    // Close any active Way picker when phase flow changes.
    this._cleanup.push(turnPhaseStore.subscribe(() => this.closeWayPicker()));
    this._cleanup.push(promptInteractionLockStore.subscribe((locked) => {
      if (locked) {
        this.closeWayPicker();
      }
    }));
    this._cleanup.push(awaitingServerLockReleaseStore.subscribe((waiting) => {
      if (waiting) {
        this.closeWayPicker();
      }
    }));
    this._cleanup.push(waySelectableCardStore.subscribe((selectableWayCards) => {
      const activePickerCardId = this._wayPickerOverlay.activePicker()?.cardId;
      if (activePickerCardId !== undefined && !selectableWayCards.includes(activePickerCardId)) {
        this.closeWayPicker();
      }
    }));

    setTimeout(() => {
      this._socketService.emit('clientReady', this._selfId, true);
    });
  }

  private onPing = async (pingCount: number) => {
    const volume = Math.min(0.3 + 0.12 * pingCount, 1);
    await this._soundService.play('./assets/sounds/your-turn.mp3', volume);
  }

  private onCurrentPlayerTurnUpdated = (playerId: number) => {
    document.title = `Dominion - ${playerStore(playerId).get()?.name}`;
  }

  // Plays the start-of-turn sound the first time we observe a given turn
  // number (and only when that turn belongs to the local player). Listening
  // to turnNumber rather than currentPlayerTurnId is what survives batched
  // patches that compress an entire computer-only round into a single
  // matchStore update.
  private onTurnNumberChanged = async (turnNumber: number) => {
    if (turnNumber === this._lastPlayedTurnNumber) return;
    this._lastPlayedTurnNumber = turnNumber;
    if (currentPlayerTurnIdStore.get() !== this._selfId) return;
    await this._soundService.play('./assets/sounds/your-turn.mp3', 0.3);
  }

  // Triggers the "next phase" action using the shared server-lock behavior.
  public requestNextPhase() {
    this.executeTurnActionWithServerLock('nextPhaseComplete', () => {
      this._socketService.emit('nextPhase');
    });
  }

  // Triggers the "play all treasures" action during the buy phase.
  public requestPlayAllTreasures() {
    if (turnPhaseStore.get() !== 'buy') {
      return;
    }
    this.executeTurnActionWithServerLock('playAllTreasureComplete', () => {
      this._socketService.emit('playAllTreasure', this._selfId);
    });
  }

  // Applies lock/unlock behavior around turn actions that wait for a server completion event.
  private executeTurnActionWithServerLock(
    completionEvent: 'nextPhaseComplete' | 'playAllTreasureComplete',
    emitAction: () => void
  ) {
    if (!this.uiInteractive) {
      return;
    }

    awaitingServerLockReleaseStore.set(true);
    this._socketService.on(completionEvent, () => {
      this._socketService.off(completionEvent);
      awaitingServerLockReleaseStore.set(false);
    });
    emitAction();
  }

  public destroy = () => {
    this.closeWayPicker();
    this._boardCardSelectionTeardown?.();
    this.resetPromptPlaySelectionState();
    this._cleanup.forEach(c => c());
    this._cleanup = [];
    awaitingServerLockReleaseStore.set(false);
    promptInteractionLockStore.set(false);
  }

  // Clears transient prompt-way overrides used by select-card prompt flows.
  private resetPromptPlaySelectionState() {
    promptWaySelectableCardsOverrideStore.set(null);
  }

  private onUserPrompt = async (signalId: string, args: UserPromptActionArgs) => {
    const waitForInput = args.waitForInput ?? true;

    if (currentPlayerTurnIdStore.get() !== this._selfId) {
      await this._soundService.play('./assets/sounds/your-turn.mp3', 0.3);
    }
    if (waitForInput && args.content?.type === 'select-pile') {
      await this.doSelectPiles(signalId, args);
      return;
    }

    this._selecting = true;
    // Lock turn action controls while prompt input is active.
    promptInteractionLockStore.set(true);
    try {
      const result = await this.openPromptUi(args);
      if (waitForInput) {
        this._socketService.emit('userInputReceived', signalId, result);
      }
    } finally {
      this._selecting = false;
      promptInteractionLockStore.set(false);
    }
  }

  // Opens prompt UI through the Angular prompt dialog host.
  private async openPromptUi(args: UserPromptActionArgs): Promise<unknown> {
    if (!this._promptDialogCoordinator.supportsPrompt(args)) {
      console.warn('[match scene] unsupported prompt payload for Angular dialog host');
      return { action: PROMPT_DECLINE_ACTION };
    }

    return await this._promptDialogCoordinator.openPrompt(args, this._selfId);
  }

  // Clears and hides the Angular way picker overlay.
  private closeWayPicker = () => {
    this._wayPickerOverlay.hidePicker();
  };

  // Returns true when a select-card payload explicitly represents an Action-play choice.
  private supportsActionPlaySelectionIntent(intent?: SelectCardArgs['selectionIntent']): boolean {
    if (!intent || intent.kind !== 'play-card') {
      return false;
    }
    return intent.cardTypes.includes('ACTION');
  }


  // Normalizes modal prompt responses to card-selection payloads used by server selectCard flow.
  private parsePromptSelectionResult(response: unknown): PlayCardSelectionResult {
    if (Array.isArray(response)) {
      return {
        selectedCardIds: response.filter((value): value is CardId => typeof value === 'number'),
      };
    }

    if (!response || typeof response !== 'object') {
      return { selectedCardIds: [] };
    }

    const payload = response as {
      action?: unknown;
      result?: unknown;
      selectedCardIds?: unknown;
      selectedWayId?: unknown;
    };

    // Action button cancel path from userPromptModal.
    if (payload.action === PROMPT_DECLINE_ACTION) {
      return { selectedCardIds: [] };
    }

    if (Array.isArray(payload.selectedCardIds)) {
      return {
        selectedCardIds: payload.selectedCardIds.filter((value): value is CardId => typeof value === 'number'),
        selectedWayId: typeof payload.selectedWayId === 'number' ? payload.selectedWayId : null,
      };
    }

    if (payload.result !== undefined) {
      const nested = this.parsePromptSelectionResult(payload.result);
      if (typeof payload.selectedWayId === 'number' || payload.selectedWayId === null) {
        nested.selectedWayId = payload.selectedWayId;
      }
      return nested;
    }

    return { selectedCardIds: [] };
  }

  private doSelectCards = async (signalId: string, arg: SelectCardArgs) => {
    this.closeWayPicker();
    this.resetPromptPlaySelectionState();
    // A new select-card request supersedes any pending board selection
    // (e.g. the server re-issued the request after an undo).
    this._boardCardSelectionTeardown?.();
    const cardIds = arg.selectableCardIds ?? [];

    // no more selectable cards, clean up local prompt-selection state and return.
    if (cardIds.length === 0) {
      this._selecting = false;
      promptInteractionLockStore.set(false);
      selectedCardStore.set([]);
      clientSelectableCardsOverrideStore.set(null);
      this.resetPromptPlaySelectionState();
      return;
    }

    // Resolve whether prompt payload should include play-as-way output semantics.
    const resolvedCountSpec = resolveCountSpec(arg.count ?? 1);
    const isSingleSelection = resolvedCountSpec.kind === 'fixed'
      ? resolvedCountSpec.count === 1
      : resolvedCountSpec.min === 1 && resolvedCountSpec.max === 1;
    const promptAllowsWaySelection = this.supportsActionPlaySelectionIntent(arg.selectionIntent);
    const activeWayCount = matchStore.get()?.ways?.length ?? 0;
    const supportsWaySelection = promptAllowsWaySelection && isSingleSelection && activeWayCount > 0;

    // Gain-from-supply style selections run directly on the board when every
    // candidate is the visible top card of a supply pile (the server already
    // collapses supply candidates to pile tops). Way-play selections always
    // keep the dialog — the Way tooltip machinery lives there.
    const supplyTopIds = supplyPileTopCardIdsStore.get();
    const allCandidatesAreSupplyTops = cardIds.every((cardId) => supplyTopIds.has(cardId));
    if (!promptAllowsWaySelection && allCandidatesAreSupplyTops) {
      this.doSelectCardsOnBoard(signalId, arg, isSingleSelection);
      return;
    }

    this._selecting = true;
    // Hide turn action controls while modal selection prompt is active.
    promptInteractionLockStore.set(true);
    selectedCardStore.set([]);
    clientSelectableCardsOverrideStore.set(null);

    try {
      const modalArgs: UserPromptActionArgs = {
        playerId: this._selfId,
        prompt: arg.prompt,
        content: {
          type: 'select',
          cardIds,
          selectableCardIds: [...cardIds],
          selectCount: arg.count ?? 1,
          selectionIntent: arg.selectionIntent,
        },
      };

      if (arg.optional) {
        modalArgs.actionButtons = [
          { label: arg.cancelPrompt ?? 'Cancel', action: PROMPT_DECLINE_ACTION, role: 'cancel' },
          { label: arg.validPrompt ?? arg.prompt ?? 'Confirm', action: 1 },
        ];
        modalArgs.validationAction = 1;
      }

      const modalResult = await this.openPromptUi(modalArgs);
      const parsedSelection = this.parsePromptSelectionResult(modalResult);
      const payload: CardId[] | PlayCardSelectionResult = supportsWaySelection
        ? {
          selectedCardIds: parsedSelection.selectedCardIds,
          selectedWayId: parsedSelection.selectedWayId ?? null,
        }
        : parsedSelection.selectedCardIds;
      this._socketService.emit('userInputReceived', signalId, payload);
    } finally {
      this._selecting = false;
      promptInteractionLockStore.set(false);
      selectedCardStore.set([]);
      clientSelectableCardsOverrideStore.set(null);
      this.resetPromptPlaySelectionState();
    }
  }

  // Handles gain-style card selections directly on the board: highlights the
  // candidate supply-pile tops, records clicks into selectedCardStore, and
  // submits only via the floating bar's validation-gated confirm button.
  private doSelectCardsOnBoard = (signalId: string, arg: SelectCardArgs, isSingleSelection: boolean) => {
    const cardIds = arg.selectableCardIds ?? [];
    const selectCount = arg.count ?? 1;
    const isOptional = arg.optional ?? false;

    clientSelectableCardsOverrideStore.set([...cardIds]);
    selectedCardStore.set([]);
    this._selecting = true;
    // Hide turn action controls while board card selection is active.
    promptInteractionLockStore.set(true);

    const cleanupSelection = () => {
      pileSelectionOverlayStore.set({
        visible: false,
        prompt: 'Select pile',
        optional: false,
        submitEnabled: false,
        singleSelection: false,
        selectionKind: 'pile',
      });
      pileSelectionOverlayActionStore.set(null);
      selectedCardStore.set([]);
      clientSelectableCardsOverrideStore.set(null);
      this._selecting = false;
      promptInteractionLockStore.set(false);
      this._boardCardSelectionTeardown = null;
    };

    let selectedListenerCleanup: () => void = () => undefined;
    let actionListenerCleanup: () => void = () => undefined;
    let completed = false;

    const doneListener = (cancelled?: boolean) => {
      if (completed) {
        return;
      }
      completed = true;
      const selectedCardIds = cancelled ? [] : selectedCardStore.get();
      selectedListenerCleanup();
      actionListenerCleanup();
      cleanupSelection();
      this._socketService.emit('userInputReceived', signalId, selectedCardIds);
    };

    // Teardown path (server abandoned the request / scene destroyed): clean
    // up all board-selection state without emitting a reply.
    this._boardCardSelectionTeardown = () => {
      if (completed) {
        return;
      }
      completed = true;
      selectedListenerCleanup();
      actionListenerCleanup();
      cleanupSelection();
    };

    // Selection state drives the floating bar's confirm button; submission
    // is always explicit so the player can review/change the pick.
    const updateSelectionState = (selected: readonly CardId[]) => {
      const valid = validateCountSpec(selectCount, selected.length);
      pileSelectionOverlayStore.setKey('submitEnabled', valid);
    };

    pileSelectionOverlayStore.set({
      visible: true,
      prompt: arg.validPrompt ?? arg.prompt ?? 'Confirm',
      optional: isOptional,
      submitEnabled: false,
      singleSelection: isSingleSelection,
      selectionKind: 'card',
    });
    pileSelectionOverlayActionStore.set(null);

    actionListenerCleanup = pileSelectionOverlayActionStore.subscribe((action) => {
      if (!action) {
        return;
      }
      if (action.action === 'cancel') {
        doneListener(true);
        return;
      }
      if (action.action === 'submit' && pileSelectionOverlayStore.get().submitEnabled) {
        doneListener();
      }
    });

    selectedListenerCleanup = selectedCardStore.subscribe((selected) => {
      updateSelectionState(selected);
    });

    updateSelectionState(selectedCardStore.get());
  }

  // Handles pile selection prompts by highlighting piles and capturing a selection.
  private doSelectPiles = async (signalId: string, args: UserPromptActionArgs) => {
    this.closeWayPicker();
    const content = args.content;
    if (!content || content.type !== 'select-pile') {
      this._socketService.emit('userInputReceived', signalId, []);
      return;
    }

    const pileNames = content.pileNames ?? [];
    const selectCount = content.selectCount;
    const isOptional = content.optional ?? false;
    const resolvedSelectCount = resolveCountSpec(selectCount);
    const isSingleSelection = resolvedSelectCount.kind === 'fixed'
      ? resolvedSelectCount.count === 1
      : resolvedSelectCount.min === 1 && resolvedSelectCount.max === 1;

    if (!pileNames.length) {
      this._socketService.emit('userInputReceived', signalId, []);
      return;
    }

    clientSelectablePilesOverrideStore.set(pileNames);
    // Suppress any stale card/card-like selectable highlights while pile selection is active.
    clientSelectableCardsOverrideStore.set([]);
    selectedPileStore.set([]);
    this._selectingPiles = true;
    // Hide turn action controls while pile-selection prompt is active.
    promptInteractionLockStore.set(true);

    const cleanupSelection = () => {
      pileSelectionOverlayStore.set({
        visible: false,
        prompt: 'Select pile',
        optional: false,
        submitEnabled: false,
        singleSelection: false,
        selectionKind: 'pile',
      });
      pileSelectionOverlayActionStore.set(null);
      selectedPileStore.set([]);
      clientSelectablePilesOverrideStore.set(null);
      clientSelectableCardsOverrideStore.set(null);
      this._selectingPiles = false;
      promptInteractionLockStore.set(false);
    };

    let selectedListenerCleanup: () => void = () => undefined;
    let actionListenerCleanup: () => void = () => undefined;
    let completed = false;

    const doneListener = (cancelled?: boolean) => {
      if (completed) {
        return;
      }
      completed = true;
      const selectedPiles = cancelled ? [] : selectedPileStore.get();
      selectedListenerCleanup();
      actionListenerCleanup();
      cleanupSelection();
      this._socketService.emit('userInputReceived', signalId, selectedPiles);
    };

    // Selection state drives the floating bar's CONFIRM button; submission
    // is always explicit (bar CONFIRM → 'submit' action) so the player can
    // review/change picks before committing — no auto-complete on reaching
    // the exact count.
    const updateSelectionState = (selected: readonly CardKey[]) => {
      const valid = validateCountSpec(selectCount, selected.length);
      pileSelectionOverlayStore.setKey('submitEnabled', valid);
    };

    pileSelectionOverlayStore.set({
      visible: true,
      prompt: args.prompt ?? 'Select pile',
      optional: isOptional,
      submitEnabled: false,
      singleSelection: isSingleSelection,
      selectionKind: 'pile',
    });
    pileSelectionOverlayActionStore.set(null);

    actionListenerCleanup = pileSelectionOverlayActionStore.subscribe((action) => {
      if (!action) {
        return;
      }
      if (action.action === 'cancel') {
        doneListener(true);
        return;
      }
      if (action.action === 'submit' && pileSelectionOverlayStore.get().submitEnabled) {
        doneListener();
      }
    });

    selectedListenerCleanup = selectedPileStore.subscribe(selected => {
      updateSelectionState(selected);
    });

    updateSelectionState(selectedPileStore.get());
  }

}
