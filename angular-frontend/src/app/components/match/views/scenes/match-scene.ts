import {matchStore} from '../../../../state/match-state';
import {playerStore, selfPlayerIdStore,} from '../../../../state/player-state';
import {CardId, CardKey, PlayCardSelectionResult, PlayerId, UserPromptActionArgs} from 'shared/types';
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
import {currentPlayerTurnIdStore, turnPhaseStore} from '../../../../state/turn-state';
import {SocketService} from '../../../../core/socket-service/socket.service';
import {waySelectableCardStore} from '../../../../state/interactive-logic';
import {SelectCardArgs} from '../../../../../types';
import { PromptDialogCoordinatorService } from '../../../../core/prompt-dialog/prompt-dialog-coordinator.service';
import { WayPickerOverlayService } from '../../../../core/way-picker/way-picker-overlay.service';
import {
  pileSelectionOverlayActionStore,
  pileSelectionOverlayStore
} from '../../../../state/pile-selection-overlay-state';

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class MatchScene {
  private _cleanup: (() => void)[] = [];
  private _selecting: boolean = false;
  private _selectingPiles: boolean = false;
  private _selfId: PlayerId = selfPlayerIdStore.get()!;

  private get uiInteractive(): boolean {
    return !this._selecting && !this._selectingPiles && !awaitingServerLockReleaseStore.get();
  }

  public setScoreViewRect(_rect: RectLike): void {
  }

  constructor(
    private _socketService: SocketService,
    private readonly _promptDialogCoordinator: PromptDialogCoordinatorService,
    private readonly _wayPickerOverlay: WayPickerOverlayService,
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

    this._cleanup.push(currentPlayerTurnIdStore.subscribe(this.onCurrentPlayerTurnUpdated));
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
    try {
      const s = new Audio(`./assets/sounds/your-turn.mp3`);
      s.volume = Math.min(.3 + .12 * pingCount, 1);
      await s?.play();
    } catch (error) {
      console.error('Could not play start turn sound');
      console.debug(error);
    }
  }

  private onCurrentPlayerTurnUpdated = async (playerId: number) => {
    document.title = `Dominion - ${playerStore(playerId).get()?.name}`;

    if (playerId !== selfPlayerIdStore.get()) return;

    try {
      const s = new Audio(`./assets/sounds/your-turn.mp3`);
      s.volume = .3;
      await s?.play();
    } catch {
      console.error('Could not play start turn sound');
    }
  }

  // Triggers the "next phase" action using the same server-lock behavior as legacy Pixi controls.
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
      try {
        const s = new Audio(`./assets/sounds/your-turn.mp3`);
        s.volume = .3;
        await s?.play();
      } catch {
        console.error('Could not play start turn sound');
      }
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
      return { action: 0 };
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
    if (payload.action === 0) {
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
          { label: arg.cancelPrompt ?? 'Cancel', action: 0 },
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

    const updateSelectionState = (selected: readonly CardKey[]) => {
      const valid = validateCountSpec(selectCount, selected.length);
      pileSelectionOverlayStore.setKey('submitEnabled', valid);
      if (!isOptional && typeof selectCount !== 'number' && selectCount.kind === 'exact' && selected.length === selectCount.count) {
        doneListener();
      }
      if (!isOptional && typeof selectCount !== 'number' && selectCount.kind === 'range' && selectCount.min === selectCount.max && selected.length === selectCount.max) {
        // Auto-complete when range is fixed to a single value.
        doneListener();
      }
      if (!isOptional && typeof selectCount === 'number' && selected.length === selectCount) {
        doneListener();
      }
    };

    pileSelectionOverlayStore.set({
      visible: true,
      prompt: args.prompt ?? 'Select pile',
      optional: isOptional,
      submitEnabled: false,
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
