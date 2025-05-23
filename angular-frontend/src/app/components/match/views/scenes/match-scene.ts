import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import { Scene } from '../../../../core/scene/scene';
import { PlayerHandView } from '../player-hand';
import { createAppButton } from '../../../../core/create-app-button';
import { matchStartedStore, matchStore } from '../../../../state/match-state';
import { playerStore, selfPlayerIdStore, } from '../../../../state/player-state';
import { PlayAreaView } from '../play-area';
import { KingdomSupplyView } from '../kingdom-supply';
import { CardId, CardLike, PlayerId, UserPromptActionArgs } from 'shared/shared-types';
import {
  awaitingServerLockReleaseStore,
  clientSelectableCardsOverrideStore,
  selectedCardStore
} from '../../../../state/interactive-state';
import { CardView } from '../card-view';
import { userPromptModal } from '../modal/user-prompt-modal';
import { CARD_HEIGHT, STANDARD_GAP } from '../../../../core/app-contants';
import { validateCountSpec } from '../../../../shared/validate-count-spec';
import { CardStackView } from '../card-stack';
import { currentPlayerTurnIdStore } from '../../../../state/turn-state';
import { isNumber, isUndefined } from 'es-toolkit/compat';
import { AppList } from '../app-list';
import { SocketService } from '../../../../core/socket-service/socket.service';
import { gamePausedStore } from '../../../../state/game-logic';
import { selectableCardStore } from '../../../../state/interactive-logic';
import { SelectCardArgs } from '../../../../../types';
import { BasicSupplyView } from '../basic-supply';
import { NonSupplyKingdomView } from '../non-supply-kingdom-view';
import { getCardSourceStore } from '../../../../state/card-source-store';
import { OtherCardLikeView } from '../other-card-like-view';
import { CardLikeView } from '../card-like-view';

export class MatchScene extends Scene {
  private _board: Container = new Container();
  private _baseSupply: Container = new Container({ scale: 1 });
  private _playerHand: PlayerHandView | undefined;
  private _deck: CardStackView | undefined;
  private _discard: CardStackView | undefined;
  private _cleanup: (() => void)[] = [];
  private _playArea: PlayAreaView | undefined;
  private _kingdomView: KingdomSupplyView | undefined;
  private _selecting: boolean = false;
  private _scoreViewRight: number = 0;
  private _scoreViewBottom: number = 0;
  private _nonSupplyView: NonSupplyKingdomView | undefined;
  private _selfId: PlayerId = selfPlayerIdStore.get()!;
  private _otherCardLikes: OtherCardLikeView | undefined;

  private get uiInteractive(): boolean {
    return !this._selecting && !awaitingServerLockReleaseStore.get();
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
    });

    this._cleanup.push(currentPlayerTurnIdStore.subscribe(this.onCurrentPlayerTurnUpdated));
    this._cleanup.push(gamePausedStore.subscribe(this.onPauseGameUpdated));

    setTimeout(() => {
      this._socketService.emit('clientReady', this._selfId, true);
    });

    setTimeout(() => {
      this.onRendererResize();
    }, 100);
  }

  private onPing = (pingCount: number) => {
    try {
      const s = new Audio(`./assets/sounds/your-turn.mp3`);
      s.volume = Math.min(.3 + .12 * pingCount, 1);
      void s?.play();
    } catch (error) {
      console.error('Could not play start turn sound');
      console.log(error);
    }
  }

  private onPauseGameUpdated = (paused: boolean) => {
    if (paused) {
      const c = new Container({ label: 'pause' });
      const g = new Graphics({ label: 'pause' });
      g.rect(0, 0, this._app.renderer.width, this._app.renderer.height)
        .fill({ color: 'black', alpha: .5 });
      c.addChild(g);

      const t = new Text({
        text: 'PLAYER DISCONNECTED',
        style: { fill: 'white', fontSize: 36 },
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

  private onCurrentPlayerTurnUpdated = (playerId: number) => {
    document.title = `Dominion - ${playerStore(playerId).get()?.name}`;

    if (playerId !== selfPlayerIdStore.get()) return;

    try {
      const s = new Audio(`./assets/sounds/your-turn.mp3`);
      s.volume = .3;
      void s?.play();
    } catch {
      console.error('Could not play start turn sound');
    }
  }

  private async loadAssets() {
    const c = new Container();
    const g = c.addChild(new Graphics());
    g.rect(0, 0, this._app.renderer.width, this._app.renderer.height)
      .fill({ color: 'black', alpha: .6 });
    let ellipsisCount = 0;
    const t = new Text({
      text: 'LOADING...',
      style: {
        fontSize: 24,
        fill: 'white',
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
    this._baseSupply.scale = 1;

    this._kingdomView = this.addChild(new KingdomSupplyView());
    this._kingdomView.scale = 1;

    this._nonSupplyView = this.addChild(new NonSupplyKingdomView());
    this._nonSupplyView.scale = 1;

    this._otherCardLikes = new OtherCardLikeView({label: 'otherCardLikes'});
    this.addChild(this._otherCardLikes);
    this._otherCardLikes.scale = 1;

    this._playArea = this.addChild(new PlayAreaView());

    this._deck = new CardStackView({
      $cardIds: getCardSourceStore('playerDeck', this._selfId),
      label: 'DECK',
      cardFacing: 'back',
      alwaysShowCountBadge: true
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
        fill: 'white',
      },
      anchor: .5,
    });

    const g = new Graphics();
    g.roundRect(0, 0, t.width + STANDARD_GAP * 2, t.height + STANDARD_GAP * 2)
      .fill({ color: 'black', alpha: .8 });

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
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
  }

  private onUserPrompt = async (signalId: string, args: UserPromptActionArgs) => {
    if (currentPlayerTurnIdStore.get() !== this._selfId) {
      try {
        const s = new Audio(`./assets/sounds/your-turn.mp3`);
        s.volume = .3;
        void s?.play();
      } catch {
        console.error('Could not play start turn sound');
      }
    }
    this._selecting = true;
    const result = await userPromptModal(
      this._app,
      this._socketService,
      args,
      this._selfId
    );
    this._selecting = false;
    this._socketService.emit('userInputReceived', signalId, result);
  }

  // todo move the selection stuff to another class, SelectionManager?
  private onPointerDown(event: PointerEvent) {
    if (!(event.target instanceof CardLikeView)) {
      return;
    }

    if (event.ctrlKey) {
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
        awaitingServerLockReleaseStore.set(true);
        const updated = (finishedPlayerId: PlayerId, finishedCardId?: CardId) => {
          if (finishedPlayerId !== this._selfId || finishedCardId !== cardId) return;
          this._socketService.off('cardTappedComplete', updated)
          awaitingServerLockReleaseStore.set(false);
        }
        this._socketService.on('cardTappedComplete', updated);
        this._socketService.emit(view instanceof CardView ? 'cardTapped' : 'cardLikeTapped', this._selfId, cardId);
      }
    }
  }

  private doSelectCards = async (signalId: string, arg: SelectCardArgs) => {
    const cardIds = selectableCardStore.get();

    let doSelectButtonContainer: Container | null;

    // no more selectable cards, remove the done selecting button if it exists
    if (cardIds.length === 0 && this.getChildByLabel('doSelectButtonContainer')) {
      doSelectButtonContainer = this.getChildByLabel('doSelectButtonContainer');
      doSelectButtonContainer?.removeChildren().forEach(c => c.destroy());
      return;
    }

    const count = isNumber(arg.count) ? arg.count : (!isNumber(arg.count) ? arg.count?.count : NaN);
    if (count === undefined || isNaN(count)) {
      throw new Error(`Selection count couldn't be determined`);
    }

    if (currentPlayerTurnIdStore.get() !== this._selfId) {
      try {
        const s = new Audio(`./assets/sounds/your-turn.mp3`);
        s.volume = .4;
        void s?.play();
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
        fill: 'white',
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
          fill: 'white',
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
        g.fill(0xaaaaaa);
        c.addChildAt(g, 0);
      }

      const countText = new Text({
        label: 'count',
        text: isNumber(arg.count) ? count : 0,
        style: {
          fontSize: 26,
          fill: 'white'
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
      // reset selected card state
      selectedCardStore.set([]);
      c.removeFromParent();
      doSelectButtonContainer?.removeChildren();
      selectedCardsListenerCleanup();

      // reset overrides so server can tell us now what cards are selectable
      clientSelectableCardsOverrideStore.set(null);
      this._socketService.emit('userInputReceived', signalId, cardIds);
    };

    const doneListener = (cancelled?: boolean) => {
      this._selecting = false;
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
          if (arg.count === selectedCardStore.get().length) doneListener();
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

    this._selecting = true;

    // listen for cards being selected
    const selectedCardsListenerCleanup = selectedCardStore.subscribe(cardIds => {
      const countText = this.getChildByLabel('cardCountContainer')?.getChildByLabel('count') as Text;

      if (countText) {
        if (isNumber(arg.count)) {
          updateCountText(countText, Math.max(count - cardIds.length, 0));
        }
        else {
          updateCountText(countText, cardIds.length);
        }
      }

      validateSelection(cardIds);
    });

    validateSelection(selectedCardStore.get());
  }

  private onRendererResize = (): void => {
    if (this._kingdomView && this._baseSupply) {
      this._baseSupply.y = this._scoreViewBottom + STANDARD_GAP;
      this._baseSupply.x = STANDARD_GAP;

      this._kingdomView.y = STANDARD_GAP;
      this._kingdomView.x = Math.max(this._scoreViewRight, this._baseSupply.x + this._baseSupply.width) + STANDARD_GAP;
    }

    const numEvents = matchStore.get()?.events.length ?? 0;

    if (this._kingdomView && this._otherCardLikes && numEvents > 0) {
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
