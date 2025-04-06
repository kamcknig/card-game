import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../../core/scene/scene';
import { PlayerHandView } from '../player-hand';
import { AppButton, createAppButton } from '../../core/create-app-button';
import { $trashStore, supplyStore } from '../../state/match-state';
import {
  playerDeckStore,
  playerDiscardStore,
  playerHandStore,
  playerStore,
  selfPlayerIdStore
} from '../../state/player-state';
import { gameEvents } from '../../core/event/events';
import { PlayAreaView } from '../play-area';
import { KingdomSupplyView } from '../kingdom-supply';
import { PileView } from '../pile';
import { cardStore } from '../../state/card-state';
import { Card, CardKey, PlayerID, SelectCardEffectArgs, UserPromptEffectArgs } from 'shared/shared-types';
import { $runningCardActions, $selectableCards, $selectedCards } from '../../state/interactive-state';
import { CardView } from '../card-view';
import { userPromptModal } from '../modal/user-prompt-modal';
import { CARD_HEIGHT, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../core/app-contants';
import { ScoreView } from '../score-view';
import { GameLogView } from '../game-log-view';
import { displayCardDetail } from '../modal/display-card-detail';
import { validateCountSpec } from '../../shared/validate-count-spec';
import { CardStackView } from '../card-stack';
import { displayTrash } from '../modal/display-trash';
import { $currentPlayerTurnId, $turnPhase } from '../../state/turn-state';
import { isNumber, isUndefined } from 'es-toolkit/compat';
import { AppList } from '../app-list';
import { $gamePaused } from '../../state/game-state';
import { SocketService } from '../../core/socket-service/socket.service';

export class MatchScene extends Scene {
  private _doneSelectingBtn: Container | undefined;
  private _board: Container = new Container();
  private _baseSupply: Container = new Container();
  private _playerHand: PlayerHandView | undefined;
  private _trash: CardStackView | undefined;
  private _deck: CardStackView | undefined;
  private _discard: CardStackView | undefined;
  private _cleanup: (() => void)[] = [];
  private _playArea: PlayAreaView | undefined;
  private _kingdomView: KingdomSupplyView | undefined;
  private _scoreView: ScoreView = new ScoreView();
  private _gameLog: GameLogView = new GameLogView();
  private _selecting: boolean = false;
  private _playAllTreasuresButton: AppButton = createAppButton(
    { text: 'PLAY ALL TREASURES', style: { fill: 'white', fontSize: 24 } }
  );
  private _selfId: PlayerID = selfPlayerIdStore.get()!;

  private get uiInteractive(): boolean {
    return !this._selecting && !$runningCardActions.get();
  }

  constructor(stage: Container, private _socketService: SocketService, private app: Application) {
    super(stage);

    if (!this._selfId) throw new Error('self id not set in match scene');
    this.on('removed', this.onRemoved);
  }

  override async initialize() {
    super.initialize();

    await this.loadAssets();

    this.createBoard();
    this.createGameLog();
    this.createScoreView();

    this._playAllTreasuresButton.button.label = 'playAllTreasureButton';
    this._playAllTreasuresButton.button.visible = false;
    this._playAllTreasuresButton.button.on('pointerdown', () => {
      this._socketService.emit('playAllTreasure', this._selfId);
    });
    this.addChild(this._playAllTreasuresButton.button);

    this._cleanup.push(supplyStore.subscribe(this.drawBaseSupply));
    this.app.renderer.on('resize', this.onRendererResize);
    gameEvents.on('matchStarted', this.onMatchStarted);
    gameEvents.on('selectCard', this.doSelectCards);
    gameEvents.on('userPrompt', this.onUserPrompt);
    gameEvents.on('displayCardDetail', this.onDisplayCardDetail);
    gameEvents.on('waitingForPlayer', this.onWaitingOnPlayer);
    gameEvents.on('doneWaitingForPlayer', this.onDoneWaitingForPlayer);

    this._cleanup.push(() => {
      this.app.renderer.off('resize');
      gameEvents.off('matchStarted');
      gameEvents.off('selectCard');
      gameEvents.off('userPrompt');
      gameEvents.off('displayCardDetail');
      gameEvents.off('waitingForPlayer');
      gameEvents.off('doneWaitingForPlayer');
      this._playAllTreasuresButton?.button.off('pointerdown');
    });

    this._cleanup.push($currentPlayerTurnId.subscribe(this.onCurrentPlayerTurnUpdated));
    this._cleanup.push($gamePaused.subscribe(this.onPauseGameUpdated));
    this._cleanup.push($turnPhase.subscribe(this.onTurnPhaseUpdated));

    this._cleanup.push(playerHandStore(this._selfId).subscribe(this.onTurnPhaseUpdated));

    setTimeout(() => {
      this.onRendererResize();
      this._socketService.emit('clientReady', selfPlayerIdStore.get()!, true);
    });
  }

  private onPauseGameUpdated = (paused: boolean) => {
    if (paused) {
      const c = new Container({ label: 'pause' });
      const g = new Graphics({ label: 'pause' });
      g.rect(0, 0, this.app.renderer.width, this.app.renderer.height)
        .fill({ color: 'black', alpha: .5 });
      c.addChild(g);

      const t = new Text({
        text: 'PLAYER DISCONNECTED',
        style: { fill: 'white', fontSize: 36 },
        anchor: .5
      });

      t.x = Math.floor(this.app.renderer.width * .5);
      t.y = Math.floor(this.app.renderer.height * .5);
      c.addChild(t);
      this.addChild(c);
      return;
    }

    const c = this.getChildByLabel('pause');
    c?.removeFromParent();
  }

  private onCurrentPlayerTurnUpdated = (playerId: number) => {
    document.title = `Dominion - ${playerStore(playerId).get()?.name}`;

    if (playerId !== selfPlayerIdStore.get()) return;

    try {
      const s = new Audio(`./assets/sounds/your-turn.mp3`);
      s.volume = .2;
      void s?.play();
    } catch {
      console.error('Could not play start turn sound');
    }
  }

  private onTurnPhaseUpdated = () => {
    const phase = $turnPhase.get();
    if (isUndefined(phase)) return;

    const playerHand = playerHandStore(this._selfId).get();

    this._playAllTreasuresButton.button.visible = (
      phase === 'buy' &&
      $currentPlayerTurnId.get() === this._selfId &&
      playerHand.some(cardId => cardStore.get()[cardId].type.includes('TREASURE'))
    );
  }

  private async loadAssets() {
    const c = new Container();
    const g = c.addChild(new Graphics());
    g.rect(0, 0, this.app.renderer.width, this.app.renderer.height)
      .fill({ color: 'black', alpha: .6 });
    let ellipsisCount = 0;
    const t = new Text({
      text: 'LOADING...',
      style: {
        fontSize: 24,
        fill: 'white',
      },
      x: this.app.renderer.width * .5,
      y: this.app.renderer.height * .5,
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

    this._board.addChild(this._baseSupply);
    this._kingdomView = this._board.addChild(new KingdomSupplyView());
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
      cardFacing: 'front'
    });
    this.addChild(this._discard);

    this._trash = new CardStackView({
      label: 'TRASH',
      $cardIds: $trashStore,
      cardFacing: 'front'
    });
    this.addChild(this._trash);
    this._trash.eventMode = 'static';
    this._trash.on('pointerdown', this.onTrashPressed);
    this._cleanup.push(() => this._trash?.off('pointerdown', this.onTrashPressed));

    this._playerHand = new PlayerHandView(this._selfId);
    this._playerHand.on('nextPhase', this.onNextPhasePressed);
    this._cleanup.push(() => this._playerHand?.off('nextPhase', this.onNextPhasePressed));
    this.addChild(this._playerHand);
  }

  private onTrashPressed = (e: PointerEvent) => {
    if ($trashStore.get().length === 0) {
      return;
    }
    displayTrash()
  }

  private createGameLog() {
    this.addChild(this._gameLog);
  }

  private createScoreView() {
    this._scoreView = new ScoreView();
    this.addChild(this._scoreView);
    this._scoreView.x = STANDARD_GAP;
    this._scoreView.y = STANDARD_GAP;
  }

  private onNextPhasePressed = (e: PointerEvent) => {
    console.log('call to action pressed');

    if (!this.uiInteractive) {
      console.log('GUI non-interactive, ignoring');
      return
    }

    gameEvents.emit('nextPhase');
  }

  private onDisplayCardDetail = (cardId: number) => {
    displayCardDetail(cardId);
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
    c.x = this.app.renderer.width * .5 - c.width * .5;
    c.y = this.app.renderer.height * .5 - c.height * .5;
  }

  private onDoneWaitingForPlayer = () => {
    this.getChildByLabel('waitingOnPlayer')
      ?.removeFromParent();
  }

  private onMatchStarted = () => {
    this.eventMode = 'static';
    this.on('pointerdown', this.onPointerDown.bind(this));
  }

  private onRemoved = () => {
    this._cleanup.forEach(c => c());
  }

  private onUserPrompt = async (args: UserPromptEffectArgs) => {
    this._selecting = true;
    const result = await userPromptModal(args);
    this._selecting = false;
    gameEvents.emit('userPromptResponse', result);
  }

  // todo move the selection stuff to another class, SelectionManager?
  private doSelectCards = async (arg: SelectCardEffectArgs) => {
    const cardIds = $selectableCards.get();

    if (cardIds.length === 0 && !isUndefined(this._doneSelectingBtn)) {
      this.removeChild(this._doneSelectingBtn);
      return;
    }

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
      console.warn('very hacky way of getting this icon');
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

    const doneListener = () => {
      this._doneSelectingBtn?.off('pointerdown', doneListener);
      this._doneSelectingBtn?.removeFromParent();
      selectedCardsListenerCleanup();
      gameEvents.emit('cardsSelected', $selectedCards.get());
      this._selecting = false;
    }

    const updateCountText = (countText: Text, count: number) => {
      countText.text = count;
    }

    const validate = (selectedCards: readonly number[]) => {
      // if they are valid, allow button press
      if (arg.count === undefined) {
        console.warn('arg.count is undefined, not validating');
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
          if (arg.count === $selectedCards.get().length) doneListener();
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

    // listen for cards being selected
    const selectedCardsListenerCleanup = $selectedCards.subscribe(cardIds => {
      this._doneSelectingBtn?.off('pointerdown', doneListener);

      const countText = this._doneSelectingBtn?.getChildByLabel('cardCountContainer')
        ?.getChildByLabel('count') as Text;

      if (countText) {
        if (isNumber(arg.count)) {
          updateCountText(countText, Math.max(count - cardIds.length, 0));
        } else {
          updateCountText(countText, cardIds.length);
        }
      }

      validate(cardIds);
    });

    validate($selectedCards.get());
    this.addChild(this._doneSelectingBtn);
  }

  private onPointerDown(event: PointerEvent) {
    if (!(event.target instanceof CardView)) {
      return;
    }

    const cardView = event.target as CardView
    if (event.button === 2 && cardView.facing === 'front') {
      gameEvents.emit('displayCardDetail', (event.target as CardView).card.id);
      return;
    }

    const view: CardView = event.target as CardView;
    const cardId = view.card.id;

    if (this._selecting) {
      if (!$selectableCards.get()
        .includes(cardId)) {
        console.log(`Card selected is not in the list of selectable cards`);
        return;
      }
      let current = $selectedCards.get();
      const idx = current.findIndex(c => c === cardId);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(cardId);
      }
      $selectedCards.set([...current]);
    } else {
      if (!this.uiInteractive) {
        console.log('awaiting server response');
        return;
      }

      if ($selectableCards.get()
        .includes(cardId)) {
        $runningCardActions.set(true);
        const updated = () => {
          gameEvents.off('cardEffectsComplete', updated)
          $runningCardActions.set(false);
        }
        gameEvents.on('cardEffectsComplete', updated);
        gameEvents.emit('cardTapped', this._selfId, cardId);
      }
    }
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
    this._gameLog.x = this.app.renderer.width - this._gameLog.width - STANDARD_GAP;
    this._gameLog.y = STANDARD_GAP;

    this._scoreView.x = STANDARD_GAP;
    this._scoreView.y = STANDARD_GAP;

    this._baseSupply.y = STANDARD_GAP;
    this._baseSupply.x = this._scoreView.x + this._scoreView.width + STANDARD_GAP;

    if (this._kingdomView) {
      this._kingdomView.y = STANDARD_GAP;
      this._kingdomView.x = this._baseSupply.x + this._baseSupply.width + STANDARD_GAP;
    }

    if (this._playerHand) {
      this._playerHand.x = this.app.renderer.width * .5 - this._playerHand.getLocalBounds().width * .5;
      this._playerHand.y = this.app.renderer.height - this._playerHand.getLocalBounds().height;

      this._playAllTreasuresButton.button.x = this._playerHand.x + this._playerHand.width * .5 - this._playAllTreasuresButton.button.width * .5;
      this._playAllTreasuresButton.button.y = this._playerHand.y - this._playAllTreasuresButton.button.height - STANDARD_GAP;

      if (this._playArea) {
        this._playArea.x = this._playerHand.x + this._playerHand.width * .5 - this._playArea.width * .5;
        this._playArea.y = this._playerHand.y - this._playArea.height - 75;
      }

      if (this._discard) {
        this._discard.y = this.app.renderer.height - CARD_HEIGHT * .75;
        this._discard.x = this._playerHand.x - this._discard.width - STANDARD_GAP;
      }

      if (this._deck && this._discard) {
        this._deck.y = this.app.renderer.height - CARD_HEIGHT * .75;
        this._deck.x = this._discard.x - this._deck.width - STANDARD_GAP;

        if (this._trash) {
          this._trash.y = this._deck.y;
          this._trash.x = this._playerHand.x + this._playerHand.width + STANDARD_GAP;
        }
      }
    }
  }
}
