import {Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture} from 'pixi.js';
import {Scene} from '../../../../core/scene/scene';
import {PlayerHandView} from '../player-hand';
import {createAppButton} from '../../../../core/create-app-button';
import {matchStartedStore, matchStore} from '../../../../state/match-state';
import {playerStore, selfPlayerIdStore,} from '../../../../state/player-state';
import {PlayAreaView} from '../play-area';
import {KingdomSupplyView} from '../kingdom-supply';
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
import {userPromptModal} from '../modal/user-prompt-modal';
import {CARD_HEIGHT, EVENT_WIDTH, STANDARD_GAP} from '../../../../core/app-contants';
import {resolveCountSpec} from 'shared/resolve-count-spec';
import {validateCountSpec} from 'shared/validate-count-spec';
import {CardStackView} from '../card-stack';
import {currentPlayerTurnIdStore, turnPhaseStore} from '../../../../state/turn-state';
import {isNumber, isUndefined} from 'es-toolkit/compat';
import {AppList} from '../app-list';
import {SocketService} from '../../../../core/socket-service/socket.service';
import {gamePausedStore} from '../../../../state/game-logic';
import {selectableCardStore, waySelectableCardStore} from '../../../../state/interactive-logic';
import {selectablePileStore} from '../../../../state/interactive-pile-logic';
import {SelectCardArgs} from '../../../../../types';
import {BasicSupplyView} from '../basic-supply';
import {NonSupplyKingdomView} from '../non-supply-kingdom-view';
import {cardSourceStore, getCardSourceStore} from '../../../../state/card-source-store';
import {OtherCardLikeView} from '../other-card-like-view';
import {CardLikeView} from '../card-like-view';
import {PileView} from '../pile';
import {tokenDefinitionStore} from '../../../../state/token-definition-state';
import {getPixiSceneTheme} from '../../../../theme/pixi-theme';
import { debugRuntimeContextStore } from '../../../../state/debug-runtime-state';
import { cardStore } from '../../../../state/card-state';

export class MatchScene extends Scene {
  private static readonly DEFAULT_TOOLTIP_CLOSE_DELAY_MS = 160;
  private _board: Container = new Container();
  private _baseSupply: Container = new Container({ scale: 1 });
  private _playerHand: PlayerHandView | undefined;
  private _deck: CardStackView | undefined;
  private _discard: CardStackView | undefined;
  private _cleanup: (() => void)[] = [];
  private _playArea: PlayAreaView | undefined;
  private _kingdomView: KingdomSupplyView | undefined;
  private _selecting: boolean = false;
  private _selectingPiles: boolean = false;
  private _scoreViewRight: number = 0;
  private _scoreViewBottom: number = 0;
  private _nonSupplyView: NonSupplyKingdomView | undefined;
  private _selfId: PlayerId = selfPlayerIdStore.get()!;
  private _otherCardLikes: OtherCardLikeView | undefined;
  private readonly _wayPickerContainer: Container = new Container({ label: 'wayPickerContainer' });
  private _wayPickerCardId: CardId | null = null;
  private _wayPickerCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  private _promptPlaySelectedCardId: CardId | null = null;
  private _promptPlaySelectedWayId: CardLikeId | null = null;
  private _promptPlayWaySelectionResolver: ((selectedCardId: CardId, selectedWayId: CardLikeId) => void) | null = null;
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
    private _app: Application
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
    this._socketService.on('waitingForPlayer', this.onWaitingOnPlayer);
    this._socketService.on('doneWaitingForPlayer', this.onDoneWaitingForPlayer);

    this._cleanup.push(() => {
      this._app.renderer.off('resize');
      this._socketService.off('selectCard');
      this._socketService.off('userPrompt');
      this._socketService.off('waitingForPlayer');
      this._socketService.off('doneWaitingForPlayer');
      this.off('pointerdown');
      this.off('pointermove');
      this.off('pointerleave');
    });

    this._cleanup.push(currentPlayerTurnIdStore.subscribe(this.onCurrentPlayerTurnUpdated));
    this._cleanup.push(gamePausedStore.subscribe(this.onPauseGameUpdated));
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
      if (this._wayPickerCardId !== null && !selectableWayCards.includes(this._wayPickerCardId)) {
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


  private onPauseGameUpdated = (paused: boolean) => {
    if (paused) {
      const c = new Container({ label: 'pause' });
      const g = new Graphics({ label: 'pause' });
      g.rect(0, 0, this._app.renderer.width, this._app.renderer.height)
        .fill({ color: this._theme.overlay.color, alpha: this._theme.overlay.softAlpha });
      c.addChild(g);

      const t = new Text({
        text: 'PLAYER DISCONNECTED',
        style: { fill: this._theme.text.onOverlay, fontSize: 36 },
        anchor: .5
      });

      t.x = Math.floor(this._app.renderer.width * .5);
      t.y = Math.floor(this._app.renderer.height * .5);

      c.addChild(t);
      this.addChild(c);
      return;
    }

    const c = this.getChildByLabel('pause');
    c?.removeFromParent();
    c?.destroy();
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

    this._baseSupply = this.addChild(new BasicSupplyView());
    this._baseSupply.scale = .9;

    this._kingdomView = this.addChild(new KingdomSupplyView());
    this._kingdomView.scale = .9;

    this._nonSupplyView = this.addChild(new NonSupplyKingdomView());
    this._nonSupplyView.scale = .9;

    this._otherCardLikes = new OtherCardLikeView({label: 'otherCardLikes'});
    this.addChild(this._otherCardLikes);
    this._otherCardLikes.scale = .9;

    this._playArea = this.addChild(new PlayAreaView());

    this._deck = new CardStackView({
      $cardIds: getCardSourceStore('playerDeck', this._selfId),
      label: 'DECK',
      cardFacing: 'back',
      alwaysShowCountBadge: true,
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

    this._playerHand = new PlayerHandView(this._selfId, this._socketService);
    this._playerHand.on('nextPhase', this.onNextPhasePressed);

    this._cleanup.push(() => this._playerHand?.off('nextPhase'));

    this._playerHand.on('playAllTreasure', () => {
      awaitingServerLockReleaseStore.set(true);
      this._socketService.on('playAllTreasureComplete', () => {
        this._socketService.off('playAllTreasureComplete');
        awaitingServerLockReleaseStore.set(false);
      });
      this._socketService.emit('playAllTreasure', this._selfId);
    });

    this._cleanup.push(() => this._playerHand?.off('playAllTreasure'));

    this.addChild(this._playerHand);
    // Keep the Way picker above all board elements.
    this.addChild(this._wayPickerContainer);
    this._wayPickerContainer.visible = false;
    this._wayPickerContainer.eventMode = 'passive';
  }

  private onNextPhasePressed = (e: PointerEvent) => {
    if (!this.uiInteractive) {
      return
    }

    awaitingServerLockReleaseStore.set(true);
    this._socketService.on('nextPhaseComplete', () => {
      this._socketService.off('nextPhaseComplete');
      awaitingServerLockReleaseStore.set(false);
    });
    this._socketService.emit('nextPhase');
  }

  private onWaitingOnPlayer = (playerId: number) => {
    const c = new Container({ label: 'waitingOnPlayer' });

    const t = new Text({
      text: `Waiting for ${playerStore(playerId).get()?.name}`,
      style: {
        fontSize: 36,
        fill: this._theme.text.onOverlay,
      },
      anchor: .5,
    });

    const g = new Graphics();
    g.roundRect(0, 0, t.width + STANDARD_GAP * 2, t.height + STANDARD_GAP * 2)
      .fill({ color: this._theme.overlay.color, alpha: this._theme.overlay.strongAlpha });

    c.addChild(g);
    t.x = c.width * .5;
    t.y = c.height * .5;
    c.addChild(t);

    this.addChild(c);
    c.x = this._app.renderer.width * .5 - c.width * .5;
    c.y = this._app.renderer.height * .5 - c.height * .5;
  }

  private onDoneWaitingForPlayer = () => {
    this.getChildByLabel('waitingOnPlayer')
      ?.removeFromParent();
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

  // Clears transient prompt-play selection state used for Way picks during select-card prompts.
  private resetPromptPlaySelectionState() {
    this._promptPlaySelectedCardId = null;
    this._promptPlaySelectedWayId = null;
    this._promptPlayWaySelectionResolver = null;
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
      const result = await userPromptModal(
        this._app,
        this._socketService,
        args,
        this._selfId
      );
      if (waitForInput) {
        this._socketService.emit('userInputReceived', signalId, result);
      }
    } finally {
      this._selecting = false;
      promptInteractionLockStore.set(false);
    }
  }

  // Clears and hides the Way picker container.
  private closeWayPicker = () => {
    this.cancelScheduledWayPickerClose();
    this._wayPickerCardId = null;
    this._wayPickerContainer.visible = false;
    this._wayPickerContainer.removeChildren().forEach((child) => {
      child.removeAllListeners();
      child.destroy({ children: true });
    });
  };

  // Cancels any in-flight delayed close for the Way picker.
  private cancelScheduledWayPickerClose() {
    if (this._wayPickerCloseTimeout) {
      clearTimeout(this._wayPickerCloseTimeout);
      this._wayPickerCloseTimeout = null;
    }
  }

  // Schedules a delayed close so the cursor can move from card to picker without flicker.
  private scheduleWayPickerClose(delayMsOverride?: number) {
    const delayMs = this.resolveTooltipCloseDelayMs(delayMsOverride);
    this.cancelScheduledWayPickerClose();
    this._wayPickerCloseTimeout = setTimeout(() => {
      this._wayPickerCloseTimeout = null;
      this.closeWayPicker();
    }, delayMs);
  }

  // Resolves close-delay precedence: call override -> server env payload -> default.
  private resolveTooltipCloseDelayMs(delayMsOverride?: number): number {
    if (delayMsOverride !== undefined) {
      return Math.max(0, Math.floor(delayMsOverride));
    }

    const configuredDelay = debugRuntimeContextStore.get()?.tooltipDefaultCloseDelayMs;
    if (configuredDelay !== undefined) {
      return Math.max(0, Math.floor(configuredDelay));
    }

    return MatchScene.DEFAULT_TOOLTIP_CLOSE_DELAY_MS;
  }

  // Infers whether a select-card prompt is expected to immediately play the chosen card.
  private inferPromptIsPlaySelection(prompt?: string): boolean {
    if (!prompt) {
      return false;
    }
    const normalizedPrompt = prompt.toLowerCase();
    if (normalizedPrompt === 'choose action' || normalizedPrompt.startsWith('choose action ')) {
      return true;
    }
    return normalizedPrompt.includes('replay') ||
      normalizedPrompt.startsWith('play ') ||
      normalizedPrompt.includes('choose to play') ||
      normalizedPrompt.includes('you may play ') ||
      (normalizedPrompt.includes(' to play') &&
        !normalizedPrompt.includes('next turn') &&
        !normalizedPrompt.includes('set aside'));
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

  // Checks whether a pointer target is inside the active Way picker UI.
  private isTargetInWayPicker(target: any): boolean {
    let current = target;
    while (current) {
      if (current === this._wayPickerContainer) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  // Creates and positions the Way picker for the currently hovered card.
  private showWayPickerForCard(cardView: CardView) {
    const match = matchStore.get();
    const activeWays = match?.ways ?? [];
    if (activeWays.length === 0) {
      this.closeWayPicker();
      return;
    }

    const cardId = cardView.card.id;
    if (this._wayPickerCardId === cardId && this._wayPickerContainer.visible) {
      return;
    }

    this.closeWayPicker();
    this._wayPickerCardId = cardId;
    this._wayPickerContainer.visible = true;

    const sortedWays = [...activeWays].sort((a, b) => a.cardKey.localeCompare(b.cardKey));
    const wayCardScale = .75;
    const pickerPadding = 8;
    const wayGap = 8;

    const rowContainers: Container[] = [];
    let y = pickerPadding;
    let maxRowWidth = Math.floor(EVENT_WIDTH * wayCardScale);

    for (const way of sortedWays) {
      const row = new Container({ label: `wayPickerRow:${way.id}` });
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.x = pickerPadding;
      row.y = y;

      const texture = Assets.get(`${way.cardKey}-full`) ?? Texture.EMPTY;
      const waySprite = new Sprite({
        label: `wayPickerSprite:${way.cardKey}`,
        texture: texture,
      });
      waySprite.scale = wayCardScale;
      row.addChild(waySprite);

      const hoverHighlight = new Graphics({ label: `wayPickerHover:${way.cardKey}` });
      row.addChildAt(hoverHighlight, 0);

      const drawHoverState = (hovered: boolean) => {
        hoverHighlight.clear();
        if (!hovered) {
          return;
        }
        hoverHighlight
          .roundRect(-4, -4, waySprite.width + 8, waySprite.height + 8, 6)
          .fill({ color: 0x00d5ff, alpha: .25 })
          .stroke({ color: 0x00d5ff, width: 2 });
      };

      row.on('pointerover', () => drawHoverState(true));
      row.on('pointerout', () => drawHoverState(false));
      row.on('pointerdown', (event) => {
        event.stopPropagation();

        if (event.ctrlKey) {
          console.debug('[way picker] selected way', way);
          return;
        }

        if (event.button === 2) {
          return;
        }

        const selectedCardId = this._wayPickerCardId;
        if (selectedCardId == null) {
          return;
        }

        if (this._promptPlayWaySelectionResolver) {
          this._promptPlayWaySelectionResolver(selectedCardId, way.id);
          this.closeWayPicker();
          return;
        }

        if (!this.uiInteractive) {
          return;
        }

        console.debug(`[way picker] playing card ${selectedCardId} as way ${way.cardKey}`);
        this.emitCardTapWithLock(selectedCardId, () => {
          this._socketService.emit('cardTappedAsWay', this._selfId, selectedCardId, way.id);
        });
        this.closeWayPicker();
      });

      rowContainers.push(row);
      maxRowWidth = Math.max(maxRowWidth, Math.floor(waySprite.width));
      this._wayPickerContainer.addChild(row);
      y += Math.floor(waySprite.height) + wayGap;
    }

    const totalHeight = y - wayGap + pickerPadding;
    const panelWidth = maxRowWidth + pickerPadding * 2;
    const panel = new Graphics({ label: 'wayPickerPanel' });
    panel.roundRect(0, 0, panelWidth, totalHeight, 8);
    panel.fill({ color: this._theme.overlay.color, alpha: this._theme.overlay.mediumAlpha });
    panel.stroke({ color: 0x00d5ff, width: 1.5 });
    this._wayPickerContainer.addChildAt(panel, 0);

    // Keep rows aligned after final panel dimensions are known.
    for (const row of rowContainers) {
      row.x = pickerPadding;
    }

    const globalCardPosition = cardView.getGlobalPosition();
    const localCardPosition = this.toLocal(globalCardPosition);
    let pickerX = Math.floor(localCardPosition.x + cardView.width + STANDARD_GAP);
    let pickerY = Math.floor(localCardPosition.y - Math.floor(pickerPadding * .5));

    const maxX = this._app.renderer.width - panelWidth - STANDARD_GAP;
    const maxY = this._app.renderer.height - totalHeight - STANDARD_GAP;

    if (pickerX > maxX) {
      pickerX = Math.floor(localCardPosition.x - panelWidth - STANDARD_GAP);
    }

    pickerX = Math.max(STANDARD_GAP, Math.min(pickerX, maxX));
    pickerY = Math.max(STANDARD_GAP, Math.min(pickerY, maxY));

    this._wayPickerContainer.x = pickerX;
    this._wayPickerContainer.y = pickerY;
  }

  // Tracks hover state and opens/closes the Way picker for eligible cards.
  private onPointerMove = (event: PointerEvent) => {
    const promptPlayWaySelectionActive = this._promptPlayWaySelectionResolver !== null;
    if (
      (!this.uiInteractive && !promptPlayWaySelectionActive) ||
      this._selectingPiles ||
      (this._selecting && !promptPlayWaySelectionActive)
    ) {
      this.closeWayPicker();
      return;
    }

    const target = event.target as any;
    const tooltipCloseDelayMs = this.resolveTooltipCloseDelayMs();
    if (this.isTargetInWayPicker(target)) {
      this.cancelScheduledWayPickerClose();
      return;
    }

    const hoveredCardView = this.getCardViewFromTarget(target);
    if (!hoveredCardView) {
      if (this._wayPickerCardId !== null) {
        this.scheduleWayPickerClose(tooltipCloseDelayMs);
      } else {
        this.closeWayPicker();
      }
      return;
    }

    if (!waySelectableCardStore.get().includes(hoveredCardView.card.id)) {
      if (this._wayPickerCardId !== null) {
        this.scheduleWayPickerClose(tooltipCloseDelayMs);
      } else {
        this.closeWayPicker();
      }
      return;
    }

    this.cancelScheduledWayPickerClose();
    this.showWayPickerForCard(hoveredCardView);
  };

  // Closes the Way picker when pointer exits the scene canvas.
  private onPointerLeave = () => {
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

  // Collects all currently rendered card ids in this scene by traversing CardView instances.
  private collectRenderedCardIds(root: Container, renderedCardIds: Set<CardId>) {
    for (const child of root.children) {
      if (child instanceof CardView) {
        renderedCardIds.add(child.card.id);
      }

      if (child instanceof Container && child.children.length > 0) {
        this.collectRenderedCardIds(child, renderedCardIds);
      }
    }
  }

  // Determines whether select-card should use modal fallback because some selectable cards are not currently rendered.
  private shouldUsePromptCardSelectionModal(selectableCardIds: CardId[]): boolean {
    if (selectableCardIds.length < 1) {
      return false;
    }

    // Set-aside selections are often context-specific reveals and can be hard to discover on the board.
    // Force modal selection for these prompts so the player always gets an explicit chooser.
    const setAsideCardIds = new Set<CardId>();
    for (const [sourceKey, sourceCardIds] of Object.entries(cardSourceStore.get())) {
      if (!sourceKey.startsWith('set-aside')) {
        continue;
      }
      for (const sourceCardId of sourceCardIds ?? []) {
        setAsideCardIds.add(sourceCardId);
      }
    }
    const setAsideSelectableIds = selectableCardIds.filter((cardId) => setAsideCardIds.has(cardId));
    if (setAsideSelectableIds.length > 0) {
      console.debug(
        `[selectCard ui] using modal fallback for set-aside selectable cards: ${setAsideSelectableIds.join(',')}`,
      );
      return true;
    }

    const renderedCardIds = new Set<CardId>();
    this.collectRenderedCardIds(this, renderedCardIds);

    const nonRenderedSelectableIds = selectableCardIds.filter((cardId) => !renderedCardIds.has(cardId));
    if (nonRenderedSelectableIds.length < 1) {
      return false;
    }

    console.debug(
      `[selectCard ui] using modal fallback for non-rendered selectable cards: ${nonRenderedSelectableIds.join(',')}`,
    );
    return true;
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

    let doSelectButtonContainer: Container | null;

    // no more selectable cards, remove the done selecting button if it exists
    if (cardIds.length === 0 && this.getChildByLabel('doSelectButtonContainer')) {
      doSelectButtonContainer = this.getChildByLabel('doSelectButtonContainer');
      doSelectButtonContainer?.removeChildren().forEach(c => c.destroy());
      this._selecting = false;
      promptInteractionLockStore.set(false);
      this.resetPromptPlaySelectionState();
      return;
    }

    // Resolve the selection count when it is a fixed number (range selections have no single count).
    const resolvedCountSpec = resolveCountSpec(arg.count);
    const count = resolvedCountSpec.kind === 'fixed'
      ? resolvedCountSpec.count
      : undefined;
    const isSingleSelection = resolvedCountSpec.kind === 'fixed'
      ? resolvedCountSpec.count === 1
      : resolvedCountSpec.min === 1 && resolvedCountSpec.max === 1;
    const promptAllowsWaySelection = Boolean(arg.playCard) || this.inferPromptIsPlaySelection(arg.prompt);
    // Way selection in select-card prompts only applies when there are active Ways in this match.
    const activeWayCount = matchStore.get()?.ways?.length ?? 0;
    const supportsWaySelection = promptAllowsWaySelection && isSingleSelection && activeWayCount > 0;
    console.debug(
      `[selectCard ui] prompt='${arg.prompt}' playCard=${String(arg.playCard)} supportsWaySelection=${supportsWaySelection} activeWays=${activeWayCount} selectable=${cardIds.length}`,
    );

    // Some selections target cards not rendered on the board (e.g., set-aside revealed cards).
    // Use the existing modal selector for those cases so selection remains possible.
    if (this.shouldUsePromptCardSelectionModal(cardIds)) {
      this._selecting = true;
      promptInteractionLockStore.set(true);
      try {
        const modalArgs: UserPromptActionArgs = {
          playerId: this._selfId,
          prompt: arg.prompt,
          content: {
            type: 'select',
            cardIds,
            selectableCardIds: [...cardIds],
            selectCount: arg.count ?? 1,
            playCard: supportsWaySelection,
          },
        };

        if (arg.optional) {
          modalArgs.actionButtons = [
            { label: arg.cancelPrompt ?? 'Cancel', action: 0 },
            { label: arg.validPrompt ?? arg.prompt, action: 1 },
          ];
          modalArgs.validationAction = 1;
        }

        const modalResult = await userPromptModal(
          this._app,
          this._socketService,
          modalArgs,
          this._selfId,
        );
        const parsedSelection = this.parsePromptSelectionResult(modalResult);
        const payload: CardId[] | PlayCardSelectionResult = supportsWaySelection
          ? {
            selectedCardIds: parsedSelection.selectedCardIds,
            selectedWayId: parsedSelection.selectedWayId ?? null,
          }
          : parsedSelection.selectedCardIds;

        selectedCardStore.set([]);
        clientSelectableCardsOverrideStore.set(null);
        this.resetPromptPlaySelectionState();
        this._socketService.emit('userInputReceived', signalId, payload);
      } finally {
        this._selecting = false;
        promptInteractionLockStore.set(false);
      }
      return;
    }

    if (currentPlayerTurnIdStore.get() !== this._selfId) {
      try {
        const s = new Audio(`./assets/sounds/your-turn.mp3`);
        s.volume = .4;
        await s?.play();
      } catch {
        console.error('Could not play start turn sound');
      }
    }

    doSelectButtonContainer = new AppList({
      type: 'horizontal',
      elementsMargin: STANDARD_GAP,
      padding: STANDARD_GAP
    });

    const doneSelectingBtn = new Container();
    const button = createAppButton({
      text: arg.prompt,
      style: {
        fill: this._theme.text.onOverlay,
        fontSize: 36,
      },
    });
    button.button.label = 'doneSelectingButton';
    doneSelectingBtn.eventMode = 'static';
    doneSelectingBtn.on('removed', () => doneSelectingBtn.removeAllListeners());
    doneSelectingBtn.addChild(button.button);

    doSelectButtonContainer.addChild(doneSelectingBtn);

    if (arg.optional) {
      const cancelButton = createAppButton({
        text: arg.cancelPrompt ?? 'Cancel',
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

    const c = new Container({ label: 'cardCountContainer' });

    if (arg.prompt.toLowerCase().includes('trash') || arg.prompt.toLowerCase().includes('discard')) {
      let s: Sprite | undefined = undefined;
      if (arg.prompt.toLowerCase().includes('trash')) {
        s = Sprite.from(await Assets.load(`./assets/ui-icons/trash-card-count.png`));
      }
      else if (arg.prompt.toLowerCase().includes('discard')) {
        s = Sprite.from(await Assets.load(`./assets/ui-icons/discard-card-count.png`));
      }

      if (s) {
        s.x = 5;
        s.y = 5;
        c.addChild(s);

        const g = new Graphics();
        g.roundRect(0, 0, s.x + s.width + 5, s.y + s.height + 5, 5);
        g.fill(this._theme.surfaces.countBadge);
        c.addChildAt(g, 0);
      }

      const countText = new Text({
        label: 'count',
        text: isNumber(arg.count) ? count : 0,
        style: {
          fontSize: 26,
          fill: this._theme.text.onOverlay
        }
      });
      countText.x = Math.floor(c.width - countText.width * .5);
      countText.y = -Math.floor(countText.height * .5);
      c.addChild(countText);
      c.scale = .6;
      c.x = Math.floor(doSelectButtonContainer.x + doSelectButtonContainer.width - 5);
      c.y = Math.floor(doSelectButtonContainer.y - c.height * .25);
      this.addChild(c);
    }

    const cardsSelectedComplete = (cardIds: number[]) => {
      const selectedCardIds = cardIds as CardId[];
      const payload: CardId[] | PlayCardSelectionResult = supportsWaySelection
        ? {
          selectedCardIds,
          selectedWayId:
            selectedCardIds.length === 1 && selectedCardIds[0] === this._promptPlaySelectedCardId
              ? this._promptPlaySelectedWayId
              : null,
        }
        : selectedCardIds;
      // reset selected card state
      selectedCardStore.set([]);
      c.removeFromParent();
      doSelectButtonContainer?.removeChildren();
      selectedCardsListenerCleanup();

      // reset overrides so server can tell us now what cards are selectable
      clientSelectableCardsOverrideStore.set(null);
      this.resetPromptPlaySelectionState();
      this._socketService.emit('userInputReceived', signalId, payload);
    };

    const doneListener = (cancelled?: boolean) => {
      this._selecting = false;
      promptInteractionLockStore.set(false);
      cardsSelectedComplete(!!cancelled ? [] : selectedCardStore.get());
    }

    const updateCountText = (countText: Text, count: number) => {
      countText.text = count;
    }

    const validateSelection = (selectedCards: readonly number[]) => {
      if (arg.count === undefined) {
        console.error('validate requires a count');
        doneListener(true);
        return;
      }

      if (validateCountSpec(arg.count, selectedCards?.length ?? 0)) {
        if (!isUndefined(arg.validPrompt)) {
          button.text(arg.validPrompt);
        }
        else {
          button.text(arg.prompt);
        }

        if (doneSelectingBtn) {
          const b = doneSelectingBtn.getChildByLabel('doneSelectingButton');
          if (b) {
            b.alpha = 1;
          }
          doneSelectingBtn.on('pointerdown', () => doneListener());
        }

        if (isNumber(arg.count) && !arg.optional) {
          // Keep prompt play-selection open so the player can choose a Way after selecting a card.
          if (!supportsWaySelection && arg.count === selectedCardStore.get().length) doneListener();
        }
        if (!isNumber(arg.count) && !arg.optional && arg.count?.kind === 'range') {
          // Auto-complete when range is fixed to a single value.
          if (
            !supportsWaySelection &&
            arg.count.min === arg.count.max &&
            arg.count.max === selectedCardStore.get().length
          ) {
            doneListener();
          }
        }

      }
      else {
        button.text(arg.prompt);
        if (doneSelectingBtn) {
          const b = doneSelectingBtn.getChildByLabel('doneSelectingButton');
          if (b) {
            b.alpha = .6;
          }
          doneSelectingBtn.off('pointerdown', () => doneListener());
        }
      }
    };

    // set the currently selectable cards
    clientSelectableCardsOverrideStore.set(arg.selectableCardIds);
    promptWaySelectableCardsOverrideStore.set(supportsWaySelection ? [...cardIds] : null);

    this._selecting = true;
    // Hide turn action controls while card-selection prompt is active.
    promptInteractionLockStore.set(true);
    if (supportsWaySelection) {
      // Way selections are only meaningful for single-card play prompts.
      this._promptPlayWaySelectionResolver = (selectedCardId: CardId, selectedWayId: CardLikeId) => {
        selectedCardStore.set([selectedCardId]);
        this._promptPlaySelectedCardId = selectedCardId;
        this._promptPlaySelectedWayId = selectedWayId;
        doneListener();
      };
    }

    // listen for cards being selected
    const selectedCardsListenerCleanup = selectedCardStore.subscribe(cardIds => {
      if (
        !supportsWaySelection ||
        cardIds.length !== 1 ||
        cardIds[0] !== this._promptPlaySelectedCardId
      ) {
        this._promptPlaySelectedCardId = null;
        this._promptPlaySelectedWayId = null;
      }

      const countText = this.getChildByLabel('cardCountContainer')?.getChildByLabel('count') as Text;

      if (countText) {
        if (resolvedCountSpec.kind === 'fixed') {
          updateCountText(
            countText,
            Math.max(resolvedCountSpec.count - cardIds.length, 0),
          );
        }
        else {
          updateCountText(countText, cardIds.length);
        }
      }

      validateSelection(cardIds);
    });

    validateSelection(selectedCardStore.get());
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

    doSelectButtonContainer.x = Math.floor(
      (this._playerHand?.x ?? 0) + (this._playerHand?.width ?? 0) * .5 - doSelectButtonContainer.width * .5
    );
    doSelectButtonContainer.y = Math.floor((this._playerHand?.y ?? 0) - doSelectButtonContainer.height - STANDARD_GAP);
    this.addChild(doSelectButtonContainer);

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

    const selectedListenerCleanup = selectedPileStore.subscribe(selected => {
      updateButtonState(selected);
    });

    const cleanupSelection = () => {
      selectedListenerCleanup();
      selectedPileStore.set([]);
      clientSelectablePilesOverrideStore.set(null);
      this._selectingPiles = false;
      promptInteractionLockStore.set(false);
      doSelectButtonContainer.removeChildren();
      doSelectButtonContainer.removeFromParent();
    };

    const doneListener = (cancelled?: boolean) => {
      const selectedPiles = cancelled ? [] : selectedPileStore.get();
      cleanupSelection();
      this._socketService.emit('userInputReceived', signalId, selectedPiles);
    };

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
    if (this._kingdomView && this._baseSupply) {
      // Keep basic supply below the score panel while preferring a mid-screen anchor.
      const minBaseSupplyY = this._scoreViewBottom + STANDARD_GAP;
      const centeredBaseSupplyY = Math.floor(this._app.renderer.height * .5 - this._baseSupply.height * .5);
      this._baseSupply.y = Math.max(minBaseSupplyY, centeredBaseSupplyY);
      this._baseSupply.x = STANDARD_GAP;

      this._kingdomView.y = STANDARD_GAP;
      this._kingdomView.x = Math.max(this._scoreViewRight, this._baseSupply.x + this._baseSupply.width) + STANDARD_GAP;
    }

    // Position the landscape area if events, landmarks, or projects are present.
    const numEvents = matchStore.get()?.events.length ?? 0;
    const numLandmarks = matchStore.get()?.landmarks.length ?? 0;
    const numProjects = matchStore.get()?.projects.length ?? 0;
    const numWays = matchStore.get()?.ways.length ?? 0;
    const numOtherCardLikes = numEvents + numLandmarks + numProjects + numWays;

    if (this._kingdomView && this._otherCardLikes && numOtherCardLikes > 0) {
      this._otherCardLikes.x = this._kingdomView.x;
      this._otherCardLikes.y = this._kingdomView.y + this._kingdomView.height + STANDARD_GAP;
    }

    if (this._kingdomView && this._nonSupplyView) {
      this._nonSupplyView.x = this._kingdomView.x + this._kingdomView.width + STANDARD_GAP;
      this._nonSupplyView.y = STANDARD_GAP;
    }

    if (this._playArea && this._kingdomView && this._nonSupplyView && this._playerHand && this._otherCardLikes) {
      this._playArea.x = this._kingdomView.x;

      const top = Math.max(this._kingdomView.y + this._kingdomView.height, this._nonSupplyView.y + this._nonSupplyView.height, this._otherCardLikes.y + this._otherCardLikes.height);
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
