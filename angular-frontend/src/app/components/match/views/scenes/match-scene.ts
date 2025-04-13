import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../../../../core/scene/scene';
import { PlayerHandView } from '../player-hand';
import { AppButton, createAppButton } from '../../../../core/create-app-button';
import { matchStartedStore, supplyStore, trashStore } from '../../../../state/match-state';
import {
  playerDeckStore,
  playerDiscardStore,
  playerHandStore,
  playerStore,
  selfPlayerIdStore
} from '../../../../state/player-state';
import { PlayAreaView } from '../play-area';
import { KingdomSupplyView } from '../kingdom-supply';
import { PileView } from '../pile';
import { cardStore } from '../../../../state/card-state';
import { Card, CardId, CardKey, PlayerId, SelectCardArgs, UserPromptEffectArgs } from 'shared/shared-types';
import {
  awaitingServerLockReleaseStore,
  clientSelectableCardsOverrideStore,
  selectableCardStore,
  selectedCardStore
} from '../../../../state/interactive-state';
import { CardView } from '../card-view';
import { userPromptModal } from '../modal/user-prompt-modal';
import { CARD_HEIGHT, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../../core/app-contants';
import { displayCardDetail } from '../modal/display-card-detail';
import { validateCountSpec } from '../../../../shared/validate-count-spec';
import { CardStackView } from '../card-stack';
import { displayTrash } from '../modal/display-trash';
import { currentPlayerTurnIdStore, turnPhaseStore } from '../../../../state/turn-state';
import { isNumber, isUndefined } from 'es-toolkit/compat';
import { AppList } from '../app-list';
import { gamePausedStore } from '../../../../state/game-state';
import { SocketService } from '../../../../core/socket-service/socket.service';

export class MatchScene extends Scene {
  private _doneSelectingBtn: Container | undefined;
  private _board: Container = new Container();
  private _baseSupply: Container = new Container({scale: .7});
  private _playerHand: PlayerHandView | undefined;
  private _trash: CardStackView | undefined;
  private _deck: CardStackView | undefined;
  private _discard: CardStackView | undefined;
  private _cleanup: (() => void)[] = [];
  private _playArea: PlayAreaView | undefined;
  private _kingdomView: KingdomSupplyView | undefined;
  private _selecting: boolean = false;
  private _supply: Container = new Container();
  private _scoreViewRight: number = 0;
  private _playAllTreasuresButton: AppButton = createAppButton(
    { text: 'PLAY ALL TREASURES', style: { fill: 'white', fontSize: 24 } }
  );
  private _selfId: PlayerId = selfPlayerIdStore.get()!;

  private get uiInteractive(): boolean {
    return !this._selecting && !awaitingServerLockReleaseStore.get();
  }

  public scoreViewWidth(right: number): void {
    this._scoreViewRight = right;
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

    this._playAllTreasuresButton.button.label = 'playAllTreasureButton';
    this._playAllTreasuresButton.button.visible = false;
    this._playAllTreasuresButton.button.on('pointerdown', () => {
      awaitingServerLockReleaseStore.set(true);
      this._socketService.on('playAllTreasureComplete', () => {
        this._socketService.off('playAllTreasureComplete');
        awaitingServerLockReleaseStore.set(false);
      });
      this._socketService.emit('playAllTreasure', this._selfId);
    });
    this.addChild(this._playAllTreasuresButton.button);

    this._cleanup.push(supplyStore.subscribe(this.drawBaseSupply));
    this._cleanup.push(matchStartedStore.subscribe(this.onMatchStarted));
    this._app.renderer.on('resize', this.onRendererResize);
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
      this._playAllTreasuresButton?.button.off('pointerdown');
    });

    this._cleanup.push(currentPlayerTurnIdStore.subscribe(this.onCurrentPlayerTurnUpdated));
    this._cleanup.push(gamePausedStore.subscribe(this.onPauseGameUpdated));
    this._cleanup.push(turnPhaseStore.subscribe(this.onTurnPhaseUpdated));
    this._cleanup.push(playerHandStore(this._selfId).subscribe(this.onTurnPhaseUpdated));

    setTimeout(() => {
      this.onRendererResize();
      this._socketService.emit('clientReady', this._selfId, true);
    });
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
      s.volume = .4;
      void s?.play();
    } catch {
      console.error('Could not play start turn sound');
    }
  }

  private onTurnPhaseUpdated = () => {
    const phase = turnPhaseStore.get();
    if (isUndefined(phase)) return;

    const playerHand = playerHandStore(this._selfId).get();

    this._playAllTreasuresButton.button.visible = (
      phase === 'buy' &&
      currentPlayerTurnIdStore.get() === this._selfId &&
      playerHand.some(cardId => cardStore.get()[cardId].type.includes('TREASURE'))
    );
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

    this.addChild(c);

    await Assets.loadBundle('cardLibrary');

    this.removeChild(c);
    clearInterval(i);
  }

  private createBoard() {
    this.addChild(this._board);

    this._supply.addChild(this._baseSupply);
    this._kingdomView = this._supply.addChild(new KingdomSupplyView());
    this._kingdomView.scale = .8;

    this._trash = new CardStackView({
      label: 'TRASH',
      $cardIds: trashStore,
      cardFacing: 'front',
      scale: .6,
    });
    this._trash.eventMode = 'static';
    this._trash.on('pointerdown', this.onTrashPressed);
    this._cleanup.push(() => this._trash?.off('pointerdown', this.onTrashPressed));

    this._supply.addChild(this._trash);

    this._board.addChild(this._supply);
    this._playArea = this.addChild(new PlayAreaView());

    this._deck = new CardStackView({
      $cardIds: playerDeckStore(this._selfId),
      label: 'DECK',
      cardFacing: 'back'
    });
    this.addChild(this._deck);

    this._discard = new CardStackView({
      $cardIds: playerDiscardStore(this._selfId),
      label: 'DISCARD',
      showCountBadge: false,
      cardFacing: 'front'
    });
    this.addChild(this._discard);

    this._playerHand = new PlayerHandView(this._selfId);
    this._playerHand.on('nextPhase', this.onNextPhasePressed);
    this._cleanup.push(() => this._playerHand?.off('nextPhase', this.onNextPhasePressed));
    this.addChild(this._playerHand);
  }

  private onTrashPressed = (e: PointerEvent) => {
    if (trashStore.get().length === 0 || e.button === 2) {
      return;
    }

    displayTrash(this._app)
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
    if (playerId === this._selfId) {
      try {
        const s = new Audio(`./assets/sounds/your-turn.mp3`);
        s.volume = .2;
        void s?.play();
      } catch {
        console.error('Could not play start turn sound');
      }
    }

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
    if (started) {
      this.eventMode = 'static';
      this.on('pointerdown', this.onPointerDown);
    }
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
  }

  private onUserPrompt = async (signalId: string, args: UserPromptEffectArgs) => {
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
    if (!(event.target instanceof CardView)) {
      return;
    }

    const cardView = event.target as CardView;

    if (event.ctrlKey) {
      console.log(cardView.card);
      return;
    }

    if (event.button === 2 && cardView.facing === 'front') {
      void displayCardDetail(this._app, event.target.card);
      return;
    }

    const view: CardView = event.target as CardView;
    const cardId = view.card.id;

    if (this._selecting) {
      if (!selectableCardStore.get()
        .includes(cardId)) {
        return;
      }
      let current = selectedCardStore.get();
      const idx = current.findIndex(c => c === cardId);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(cardId);
      }
      selectedCardStore.set([...current]);
    } else {
      if (!this.uiInteractive) {
        return;
      }

      if (selectableCardStore.get()
        .includes(cardId)) {
        awaitingServerLockReleaseStore.set(true);
        const updated = (finishedPlayerId: PlayerId, finishedCardId?: CardId) => {
          if (finishedPlayerId !== this._selfId || finishedCardId !== cardId) return;
          this._socketService.off('cardEffectsComplete', updated)
          awaitingServerLockReleaseStore.set(false);
        }
        this._socketService.on('cardEffectsComplete', updated);
        this._socketService.emit('cardTapped', this._selfId, cardId);
      }
    }
  }

  private doSelectCards = async (signalId: string, arg: SelectCardArgs) => {
    const cardIds = selectableCardStore.get();

    // no more selectable cards, remove the done selecting button if it exists
    if (cardIds.length === 0 && !isUndefined(this._doneSelectingBtn)) {
      this.removeChild(this._doneSelectingBtn);
      return;
    }

    const cardsSelectedComplete = (cardIds: number[]) => {
      // reset selected card state
      selectedCardStore.set([]);

      // reset overrides so server can tell us now what cards are selectable
      clientSelectableCardsOverrideStore.set(null);
      this._socketService.emit('userInputReceived', signalId, cardIds);
    };

    const doneListener = () => {
      this._doneSelectingBtn?.off('pointerdown');
      this._doneSelectingBtn?.removeFromParent();
      this._doneSelectingBtn = undefined;
      this._selecting = false;
      selectedCardsListenerCleanup();
      cardsSelectedComplete(selectedCardStore.get());
    }

    const updateCountText = (countText: Text, count: number) => {
      countText.text = count;
    }

    const validateSelection = (selectedCards: readonly number[]) => {
      if (arg.count === undefined) {
        console.error('validate requires a count');
        return;
      }

      if (validateCountSpec(arg.count, selectedCards?.length ?? 0)) {
        if (!isUndefined(arg.validPrompt) && selectedCards?.length > 0) {
          button.text(arg.validPrompt);
        } else {
          button.text(arg.prompt);
        }

        if (this._doneSelectingBtn) {
          const b = this._doneSelectingBtn.getChildByLabel('doneSelectingButton');
          if (b) {
            b.alpha = 1;
          }
          this._doneSelectingBtn.on('pointerdown', doneListener);
        }

        if (isNumber(arg.count)) {
          if (arg.count === selectedCardStore.get().length) doneListener();
        }

      } else {
        button.text(arg.prompt);
        if (this._doneSelectingBtn) {
          const b = this._doneSelectingBtn.getChildByLabel('doneSelectingButton');
          if (b) {
            b.alpha = .6;
          }
          this._doneSelectingBtn.off('pointerdown', doneListener);
        }
      }
    };

    // set the currently selectable cards
    clientSelectableCardsOverrideStore.set(arg.selectableCardIds);

    this._selecting = true;

    const button = createAppButton({
      text: arg.prompt,
      style: {
        fill: 'white',
        fontSize: 36,
      },
    });
    button.button.label = 'doneSelectingButton';
    this._doneSelectingBtn = new AppList({ type: 'horizontal', elementsMargin: STANDARD_GAP, padding: STANDARD_GAP });
    this._doneSelectingBtn.eventMode = 'static';
    this._doneSelectingBtn.y = (this._playArea?.y ?? 0) + (this._playArea?.height ?? 0) + STANDARD_GAP;
    this._doneSelectingBtn.addChild(button.button);

    const count = isNumber(arg.count) ? arg.count : (!isNumber(arg.count) ? arg.count?.count : NaN);
    if (count === undefined || isNaN(count)) {
      throw new Error(`Selection count couldn't be determined`);
    }

    if (count > 1) {
      const c = new Container({ label: 'cardCountContainer' });

      let s: Sprite | undefined = undefined;
      if (arg.prompt.includes('trash')) {
        s = Sprite.from(await Assets.load(`./assets/ui-icons/trash-card-count.png`));
      } else if (arg.prompt.includes('discard')) {
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
      this._doneSelectingBtn.addChild(c);
    }

    this._doneSelectingBtn.x = Math.floor(
      (this._playerHand?.x ?? 0) + (this._playerHand?.width ?? 0) * .5 - this._doneSelectingBtn.width * .5
    );
    this._doneSelectingBtn.y = Math.floor((this._playerHand?.y ?? 0) - this._doneSelectingBtn.height - STANDARD_GAP);

    // listen for cards being selected
    const selectedCardsListenerCleanup = selectedCardStore.subscribe(cardIds => {
      this._doneSelectingBtn?.off('pointerdown');

      const countText = this._doneSelectingBtn?.getChildByLabel('cardCountContainer')
        ?.getChildByLabel('count') as Text;

      if (countText) {
        if (isNumber(arg.count)) {
          updateCountText(countText, Math.max(count - cardIds.length, 0));
        } else {
          updateCountText(countText, cardIds.length);
        }
      }

      validateSelection(cardIds);
    });

    validateSelection(selectedCardStore.get());
    this.addChild(this._doneSelectingBtn);
  }

  private drawBaseSupply = (newVal: ReadonlyArray<number>) => {
    if (!newVal || newVal.length === 0) {
      return;
    }

    this._baseSupply.removeChildren();

    const cards = newVal.map(id => cardStore.get()[id]);

    // first reduces and then gets teh values to make an array of Card arrays, then reduces again
    // into a tuple whose first element is an array of piles of victory cards and the curse, and the 2nd
    // element is an array of treasure card piles
    const [victoryPiles, treasurePiles] = Object.values(cards.reduce((prev, card) => {
      prev[card.cardKey] ||= [];
      prev[card.cardKey].push(card);
      return prev;
    }, {} as Record<CardKey, Card[]>))
      .reduce((prev, next) => {
        const firstCard = next[0];
        if (firstCard.type.includes('VICTORY') || firstCard.cardKey === 'curse') {
          prev[0].push(next);
        } else {
          prev[1].push(next);
        }
        return prev;
      }, [[], []] as [Card[][], Card[][]]);

    for (const [idx, pile] of victoryPiles.entries()) {
      const pileView = new PileView(pile, pile.length, 'half');
      pileView.y = idx * SMALL_CARD_HEIGHT + idx * STANDARD_GAP;
      this._baseSupply.addChild(pileView);
    }

    for (const [idx, pile] of treasurePiles.entries()) {
      const pileView = new PileView(pile, pile.length, 'half');
      pileView.x = SMALL_CARD_WIDTH + STANDARD_GAP;
      pileView.y = idx * SMALL_CARD_HEIGHT + idx * STANDARD_GAP;
      this._baseSupply.addChild(pileView);
    }
  }

  private onRendererResize = (): void => {
    if (this._supply && this._kingdomView && this._baseSupply) {
      this._supply.y = STANDARD_GAP;

      this._kingdomView.x = Math.floor(this._baseSupply.width + STANDARD_GAP);

      if (this._trash) {
        this._trash.x = this._kingdomView.x + this._kingdomView.width + STANDARD_GAP;
      }

      this._supply.x = Math.max(this._scoreViewRight + STANDARD_GAP);
    }

    if (this._playerHand) {
      this._playerHand.x = this._app.renderer.width * .5 - this._playerHand.width * .5;
      this._playerHand.y = this._app.renderer.height - this._playerHand.height;

      this._playAllTreasuresButton.button.x = this._playerHand.x + this._playerHand.width * .5 - this._playAllTreasuresButton.button.width * .5;
      this._playAllTreasuresButton.button.y = this._playerHand.y - this._playAllTreasuresButton.button.height - STANDARD_GAP;

      if (this._playArea) {
        this._playArea.x = this._playerHand.x + this._playerHand.width * .5 - this._playArea.width * .5;
        this._playArea.y = this._playerHand.y - this._playArea.height - 75;
      }

      if (this._discard) {
        this._discard.y = this._app.renderer.height - CARD_HEIGHT * .75;
        this._discard.x = this._playerHand.x + this._playerHand.width + STANDARD_GAP;
      }

      if (this._deck) {
        this._deck.y = this._app.renderer.height - CARD_HEIGHT * .75;
        this._deck.x = this._playerHand.x - this._deck.width - STANDARD_GAP;
      }
    }
  }
}
