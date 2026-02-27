import { Application, Assets, Container, Graphics, Rectangle, Text } from 'pixi.js';
import {Scene} from '../../../../core/scene/scene';
import {PlayerHandView} from '../player-hand';
import {createAppButton} from '../../../../core/create-app-button';
import {matchStartedStore, matchStore} from '../../../../state/match-state';
import {playerStore, selfPlayerIdStore,} from '../../../../state/player-state';
import {PlayAreaView} from '../play-area';
import {CardId, CardKey, CardLikeId, PlayCardSelectionResult, PlayerId, UserPromptActionArgs} from 'shared/types';
import {
  awaitingServerLockReleaseStore,
  clientSelectableCardsOverrideStore,
  clientSelectablePilesOverrideStore,
  promptWaySelectableCardsOverrideStore,
  promptInteractionLockStore,
  selectedCardStore,
  selectedPileStore
} from '../../../../state/interactive-state';
import {CardView} from '../card-view';
import {CARD_HEIGHT, STANDARD_GAP} from '../../../../core/app-contants';
import {resolveCountSpec} from 'shared/resolve-count-spec';
import {validateCountSpec} from 'shared/validate-count-spec';
import {CardStackView} from '../card-stack';
import {DeckStackView} from '../deck-stack';
import {currentPlayerTurnIdStore, turnPhaseStore} from '../../../../state/turn-state';
import {AppList} from '../app-list';
import {SocketService} from '../../../../core/socket-service/socket.service';
import {selectableCardStore, waySelectableCardStore} from '../../../../state/interactive-logic';
import {selectablePileStore} from '../../../../state/interactive-pile-logic';
import {SelectCardArgs} from '../../../../../types';
import {NonSupplyKingdomView} from '../non-supply-kingdom-view';
import {getCardSourceStore} from '../../../../state/card-source-store';
import {OtherCardLikeView} from '../other-card-like-view';
import {CardLikeView} from '../card-like-view';
import {PileView} from '../pile';
import {tokenDefinitionStore} from '../../../../state/token-definition-state';
import {getPixiSceneTheme} from '../../../../theme/pixi-theme';
import { cardStore } from '../../../../state/card-state';
import { PromptDialogCoordinatorService } from '../../../../core/prompt-dialog/prompt-dialog-coordinator.service';
import { WayPickerOverlayService } from '../../../../core/way-picker/way-picker-overlay.service';
import {
  SUPPLY_BASIC_PANEL_WIDTH_PX,
  SUPPLY_KINGDOM_PANEL_HEIGHT_PX,
  SUPPLY_KINGDOM_PANEL_WIDTH_PX
} from '../../supply/supply-layout.constants';

export class MatchScene extends Scene {
  private static readonly WAY_PICKER_PANEL_WIDTH_PX = 220;
  private static readonly WAY_PICKER_EDGE_OVERLAP_PX = 5;
  private _board: Container = new Container();
  private _playerHand: PlayerHandView | undefined;
  private _deck: CardStackView | undefined;
  private _discard: CardStackView | undefined;
  private _cleanup: (() => void)[] = [];
  private _playArea: PlayAreaView | undefined;
  private _selecting: boolean = false;
  private _selectingPiles: boolean = false;
  private _scoreViewRight: number = 0;
  private _scoreViewBottom: number = 0;
  private _nonSupplyView: NonSupplyKingdomView | undefined;
  private _selfId: PlayerId = selfPlayerIdStore.get()!;
  private _otherCardLikes: OtherCardLikeView | undefined;
  // Semantic Pixi color roles resolved from app-level CSS theme tokens.
  private readonly _theme = getPixiSceneTheme();

  private get uiInteractive(): boolean {
    return !this._selecting && !this._selectingPiles && !awaitingServerLockReleaseStore.get();
  }

  public setScoreViewRect(rect: Rectangle): void {
    this._scoreViewRight = rect.x + rect.width;
    this._scoreViewBottom = rect.y + rect.height;
    this.onRendererResize();
  }

  constructor(
    private _socketService: SocketService,
    private _app: Application,
    private readonly _promptDialogCoordinator: PromptDialogCoordinatorService,
    private readonly _wayPickerOverlay: WayPickerOverlayService,
  ) {
    super();

    if (!this._selfId) throw new Error('self id not set in match scene');
    this.on('removed', this.onRemoved);
  }

  override async initialize() {
    super.initialize();

    await this.loadAssets();

    this.createBoard();
    // Ensure UI lock state doesn't persist across page refreshes.
    awaitingServerLockReleaseStore.set(false);
    promptInteractionLockStore.set(false);

    this._cleanup.push(matchStartedStore.subscribe(val => this.onMatchStarted(val)));

    this._app.renderer.on('resize', this.onRendererResize);
    this._socketService.on('ping', this.onPing);
    this._socketService.on('selectCard', this.doSelectCards);
    this._socketService.on('userPrompt', this.onUserPrompt);

    this._cleanup.push(() => {
      this._app.renderer.off('resize');
      this._socketService.off('selectCard');
      this._socketService.off('userPrompt');
      this.off('pointerdown');
      this.off('pointermove');
      this.off('pointerleave');
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

    setTimeout(() => {
      this.onRendererResize();
    }, 100);
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

  private async loadAssets() {
    const c = new Container();
    const g = c.addChild(new Graphics());
    g.rect(0, 0, this._app.renderer.width, this._app.renderer.height)
      .fill({ color: this._theme.overlay.color, alpha: this._theme.overlay.mediumAlpha });
    let ellipsisCount = 0;
    const t = new Text({
      text: 'LOADING...',
      style: {
        fontSize: 24,
        fill: this._theme.text.onOverlay,
      },
      x: this._app.renderer.width * .5,
      y: this._app.renderer.height * .5,
      anchor: .5
    });
    c.addChild(t);
    const i = setInterval(() => {
      ellipsisCount = (ellipsisCount % 3) + 1; // Cycles: 1 → 2 → 3 → 1 ...
      const dots = '.'.repeat(ellipsisCount);
      t.text = `LOADING${dots}`;
    }, 300);

    this._app.stage.addChild(c);

    const startTime = Date.now();

    await Assets.loadBundle('cardLibrary');

    const endTime = Date.now();

    if (endTime - startTime < 1500) {
      await new Promise(resolve => setTimeout(resolve, 1500 - (endTime - startTime)));
    }

    c.removeFromParent();
    clearInterval(i);
  }

  private createBoard() {
    this.addChild(this._board);

    this._nonSupplyView = this.addChild(new NonSupplyKingdomView());
    this._nonSupplyView.scale = .9;

    this._otherCardLikes = new OtherCardLikeView({label: 'otherCardLikes'});
    this.addChild(this._otherCardLikes);
    this._otherCardLikes.scale = .9;

    this._playArea = this.addChild(new PlayAreaView());

    this._deck = new DeckStackView({
      $cardIds: getCardSourceStore('playerDeck', this._selfId),
      label: 'DECK',
      cardFacing: 'back',
      alwaysShowCountBadge: true,
      shadowGroupOffsetPx: 30,
      tokenPlayerId: this._selfId,
      $match: matchStore,
      $tokenDefinitions: tokenDefinitionStore
    });
    this.addChild(this._deck);

    this._discard = new CardStackView({
      $cardIds: getCardSourceStore('playerDiscard', this._selfId),
      label: 'DISCARD',
      showCountBadge: false,
      cardFacing: 'front'
    });
    this.addChild(this._discard);

    this._playerHand = new PlayerHandView(
      this._selfId,
      this._socketService,
      this._promptDialogCoordinator,
    );

    this.addChild(this._playerHand);
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

  private onMatchStarted = (started: boolean) => {
    if (!started) return

    this.eventMode = 'static';
    this.on('pointerdown', this.onPointerDown);
    this.on('pointermove', this.onPointerMove);
    this.on('pointerleave', this.onPointerLeave);
  }

  private onRemoved = () => {
    this.closeWayPicker();
    this.resetPromptPlaySelectionState();
    this._cleanup.forEach(c => c());
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

  // Returns the currently displayed way-picker card id, if any.
  private getActiveWayPickerCardId(): CardId | null {
    return this._wayPickerOverlay.activePicker()?.cardId ?? null;
  }

  // Returns true when a select-card payload explicitly represents an Action-play choice.
  private supportsActionPlaySelectionIntent(intent?: SelectCardArgs['selectionIntent']): boolean {
    if (!intent || intent.kind !== 'play-card') {
      return false;
    }
    return intent.cardTypes.includes('ACTION');
  }

  // Reuses the standard card-tap lock flow for both normal and Way plays.
  private emitCardTapWithLock(cardId: CardId, emitTap: () => void) {
    awaitingServerLockReleaseStore.set(true);
    const updated = (finishedPlayerId: PlayerId, finishedCardId?: CardId) => {
      if (finishedPlayerId !== this._selfId || finishedCardId !== cardId) return;
      this._socketService.off('cardTappedComplete', updated);
      awaitingServerLockReleaseStore.set(false);
    };
    this._socketService.on('cardTappedComplete', updated);
    emitTap();
  }

  // Resolves the card view from any nested display object target.
  private getCardViewFromTarget(target: any): CardView | null {
    let current = target;
    while (current) {
      if (current instanceof CardView) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  // Resolves viewport-fixed way-picker panel coordinates for one hovered card.
  private resolveWayPickerPosition(cardView: CardView): { left: number; top: number } {
    const globalCardPosition = cardView.getGlobalPosition();
    const canvasRect = this._app.canvas.getBoundingClientRect();

    const panelWidth = MatchScene.WAY_PICKER_PANEL_WIDTH_PX;
    const maxLeft = Math.max(STANDARD_GAP, window.innerWidth - panelWidth - STANDARD_GAP);

    let left = Math.floor(canvasRect.left + globalCardPosition.x + cardView.width - MatchScene.WAY_PICKER_EDGE_OVERLAP_PX);
    let top = Math.floor(canvasRect.top + globalCardPosition.y);

    if (left > maxLeft) {
      left = Math.floor(canvasRect.left + globalCardPosition.x - panelWidth + MatchScene.WAY_PICKER_EDGE_OVERLAP_PX);
    }

    left = Math.max(STANDARD_GAP, Math.min(left, maxLeft));
    top = Math.max(STANDARD_GAP, top);

    return { left, top };
  }

  // Handles one Angular way-picker selection and forwards it through the existing server event flow.
  private readonly onWayPickerWaySelected = (selectedCardId: CardId, selectedWayId: CardLikeId) => {
    if (!this.uiInteractive) {
      return;
    }

    if (!waySelectableCardStore.get().includes(selectedCardId)) {
      return;
    }

    const selectedWay = matchStore.get()?.ways.find((way) => way.id === selectedWayId);
    if (!selectedWay) {
      return;
    }

    console.debug(`[way picker] playing card ${selectedCardId} as way ${selectedWay.cardKey}`);
    this.emitCardTapWithLock(selectedCardId, () => {
      this._socketService.emit('cardTappedAsWay', this._selfId, selectedCardId, selectedWayId);
    });
  };

  // Creates and positions the Angular way picker for the currently hovered card.
  private showWayPickerForCard(cardView: CardView) {
    const activeWays = matchStore.get()?.ways ?? [];
    if (activeWays.length === 0) {
      this.closeWayPicker();
      return;
    }

    const sortedWayCardLikeIds = [...activeWays]
      .sort((a, b) => a.cardKey.localeCompare(b.cardKey))
      .map((way) => way.id);
    if (sortedWayCardLikeIds.length === 0) {
      this.closeWayPicker();
      return;
    }

    const position = this.resolveWayPickerPosition(cardView);
    this._wayPickerOverlay.showPicker(
      {
        cardId: cardView.card.id,
        wayCardLikeIds: sortedWayCardLikeIds,
        left: position.left,
        top: position.top,
      },
      this.onWayPickerWaySelected
    );
  }

  // Tracks hover state and opens/closes the Angular way picker for eligible cards.
  private onPointerMove = (event: PointerEvent) => {
    if (!this.uiInteractive || this._selectingPiles || this._selecting) {
      this.closeWayPicker();
      return;
    }

    const activeWayPickerCardId = this.getActiveWayPickerCardId();
    const hoveredCardView = this.getCardViewFromTarget(event.target as any);
    if (!hoveredCardView) {
      if (activeWayPickerCardId !== null) {
        this._wayPickerOverlay.scheduleClose();
      } else {
        this.closeWayPicker();
      }
      return;
    }

    if (!waySelectableCardStore.get().includes(hoveredCardView.card.id)) {
      if (activeWayPickerCardId !== null) {
        this._wayPickerOverlay.scheduleClose();
      } else {
        this.closeWayPicker();
      }
      return;
    }

    this._wayPickerOverlay.cancelScheduledClose();
    this.showWayPickerForCard(hoveredCardView);
  };

  // Schedules way-picker close when pointer exits canvas so overlay hover can keep it open.
  private onPointerLeave = () => {
    if (this.getActiveWayPickerCardId() !== null) {
      this._wayPickerOverlay.scheduleClose();
      return;
    }
    this.closeWayPicker();
  };

  // todo move the selection stuff to another class, SelectionManager?
  private onPointerDown(event: PointerEvent) {
    if (this._selectingPiles) {
      const pileView = this.getPileViewFromTarget(event.target as any);
      if (!pileView?.pileKey) {
        return;
      }
      const selectablePiles = selectablePileStore.get();
      if (!selectablePiles.includes(pileView.pileKey)) {
        return;
      }
      const selected = selectedPileStore.get();
      const idx = selected.indexOf(pileView.pileKey);
      if (idx >= 0) {
        selected.splice(idx, 1);
      }
      else {
        selected.push(pileView.pileKey);
      }
      selectedPileStore.set([...selected]);
      return;
    }

    if (!(event.target instanceof CardLikeView)) {
      return;
    }

    if (event.ctrlKey) {
      return;
    }

    // Right-click should only open the detail view, never trigger selection/gain.
    if (event.button === 2) {
      return;
    }

    const view = event.target;
    const cardId = view.cardId;

    if (this._selecting) {
      if (!selectableCardStore.get()
        .includes(cardId)) {
        return;
      }
      let current = selectedCardStore.get();
      const idx = current.findIndex(c => c === cardId);
      if (idx > -1) {
        current.splice(idx, 1);
      }
      else {
        current.push(cardId);
      }
      selectedCardStore.set([...current]);
    }
    else {
      if (!this.uiInteractive) {
        return;
      }

      if (selectableCardStore.get()
        .includes(cardId)) {
        this.closeWayPicker();
        this.emitCardTapWithLock(cardId, () => {
          this._socketService.emit(view instanceof CardView ? 'cardTapped' : 'cardLikeTapped', this._selfId, cardId);
        });
      }
    }
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

    const doSelectButtonContainer = new AppList({
      type: 'horizontal',
      elementsMargin: STANDARD_GAP,
      padding: STANDARD_GAP
    });

    const doneSelectingBtn = new Container();
    const button = createAppButton({
      text: args.prompt ?? 'Select pile',
      style: {
        fill: this._theme.text.onOverlay,
        fontSize: 36,
      },
    });
    button.button.label = 'doneSelectingPileButton';
    doneSelectingBtn.eventMode = 'static';
    doneSelectingBtn.on('removed', () => doneSelectingBtn.removeAllListeners());
    doneSelectingBtn.addChild(button.button);

    doSelectButtonContainer.addChild(doneSelectingBtn);

    if (isOptional) {
      const cancelButton = createAppButton({
        text: 'Cancel',
        style: {
          fill: this._theme.text.onOverlay,
          fontSize: 36,
        },
      });
      doSelectButtonContainer.addChildAt(cancelButton.button, 0);
      cancelButton.button.on('removed', () => cancelButton.button.removeAllListeners());
      cancelButton.button.on('pointerdown', () => doneListener(true));
    }

    doSelectButtonContainer.x = Math.floor(
      (this._playerHand?.x ?? 0) + (this._playerHand?.width ?? 0) * .5 - doSelectButtonContainer.width * .5
    );
    doSelectButtonContainer.y = Math.floor((this._playerHand?.y ?? 0) - doSelectButtonContainer.height - STANDARD_GAP);
    this.addChild(doSelectButtonContainer);

    const cleanupSelection = () => {
      selectedPileStore.set([]);
      clientSelectablePilesOverrideStore.set(null);
      clientSelectableCardsOverrideStore.set(null);
      this._selectingPiles = false;
      promptInteractionLockStore.set(false);
      doSelectButtonContainer.removeChildren();
      doSelectButtonContainer.removeFromParent();
    };

    let selectedListenerCleanup: () => void = () => undefined;

    const doneListener = (cancelled?: boolean) => {
      const selectedPiles = cancelled ? [] : selectedPileStore.get();
      selectedListenerCleanup();
      cleanupSelection();
      this._socketService.emit('userInputReceived', signalId, selectedPiles);
    };

    const updateButtonState = (selected: readonly CardKey[]) => {
      const valid = validateCountSpec(selectCount, selected.length);
      button.button.alpha = valid ? 1 : .6;
      button.button.eventMode = valid ? 'static' : 'none';
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

    selectedListenerCleanup = selectedPileStore.subscribe(selected => {
      updateButtonState(selected);
    });

    doneSelectingBtn.on('pointerdown', () => doneListener());

    updateButtonState(selectedPileStore.get());
  }

  // Walks up the display tree to find the pile view under a pointer event.
  private getPileViewFromTarget(target: any): PileView | null {
    let current = target;
    while (current) {
      if (current instanceof PileView) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private onRendererResize = (): void => {
    // Keep play-area/non-supply layout aligned to the Angular supply overlay footprint.
    const basicLeft = STANDARD_GAP;
    const kingdomTop = STANDARD_GAP;
    const kingdomLeft = Math.max(this._scoreViewRight, basicLeft + SUPPLY_BASIC_PANEL_WIDTH_PX) + STANDARD_GAP;

    // Position the landscape area if events, landmarks, or projects are present.
    const numEvents = matchStore.get()?.events.length ?? 0;
    const numLandmarks = matchStore.get()?.landmarks.length ?? 0;
    const numProjects = matchStore.get()?.projects.length ?? 0;
    const numWays = matchStore.get()?.ways.length ?? 0;
    const numOtherCardLikes = numEvents + numLandmarks + numProjects + numWays;

    if (this._otherCardLikes) {
      this._otherCardLikes.x = kingdomLeft;
      this._otherCardLikes.y = kingdomTop + SUPPLY_KINGDOM_PANEL_HEIGHT_PX + STANDARD_GAP;
      this._otherCardLikes.visible = numOtherCardLikes > 0;
    }

    if (this._nonSupplyView) {
      this._nonSupplyView.x = kingdomLeft + SUPPLY_KINGDOM_PANEL_WIDTH_PX + STANDARD_GAP;
      this._nonSupplyView.y = STANDARD_GAP;
    }

    if (this._playArea && this._nonSupplyView && this._playerHand && this._otherCardLikes) {
      this._playArea.x = kingdomLeft;

      const otherCardLikesBottom = numOtherCardLikes > 0
        ? this._otherCardLikes.y + this._otherCardLikes.height
        : kingdomTop + SUPPLY_KINGDOM_PANEL_HEIGHT_PX;
      const top = Math.max(
        kingdomTop + SUPPLY_KINGDOM_PANEL_HEIGHT_PX,
        this._nonSupplyView.y + this._nonSupplyView.height,
        otherCardLikesBottom
      );
      this._playArea.y = top + STANDARD_GAP;

      const height = this._playerHand.y - this._playArea.y;
      this._playArea.verticalSpace = Math.max(400, height - STANDARD_GAP);
    }

    if (this._playerHand) {
      this._playerHand.x = this._app.renderer.width * .5 - this._playerHand.width * .5;
      this._playerHand.y = this._app.renderer.height - this._playerHand.height;

      if (this._discard) {
        this._discard.y = this._app.renderer.height - CARD_HEIGHT * .5;
        this._discard.x = this._playerHand.x + this._playerHand.width + STANDARD_GAP;
      }

      if (this._deck) {
        this._deck.y = this._app.renderer.height - CARD_HEIGHT * .50;
        this._deck.x = this._playerHand.x - this._deck.width - STANDARD_GAP;
      }
    }
  }

}
