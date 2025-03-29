import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene } from '../../core/scene/scene';
import { PlayerHandView } from '../player-hand';
import { AppButton, createAppButton } from '../../core/create-app-button';
import { $supplyStore, $trashStore } from '../../state/match-state';
import { app } from '../../core/create-app';
import {
  $playerDeckStore,
  $playerDiscardStore,
  $playerHandStore,
  $players,
  $selfPlayerId
} from '../../state/player-state';
import { gameEvents } from '../../core/event/events';
import { PlayAreaView } from '../play-area';
import { KingdomSupplyView } from '../kingdom-supply';
import { PileView } from '../pile';
import { $cardsById } from '../../state/card-state';
import { Card, SelectCardEffectArgs, UserPromptEffectArgs } from 'shared/shared-types';
import { $runningCardActions, $selectableCards, $selectedCards } from '../../state/interactive-state';
import { CardView } from '../card-view';
import { userPromptModal } from '../modal/user-prompt-modal';
import { CARD_HEIGHT, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../app-contants';
import { ScoreView } from '../score-view';
import { GameLogView } from '../game-log-view';
import { displayCardDetail } from '../modal/display-card-detail';
import { validateCountSpec } from '../../shared/validate-count-spec';
import { CardStackView } from '../card-stack';
import { displayTrash } from '../modal/display-trash';
import { $currentPlayerTurnId, $turnPhase } from '../../state/turn-state';
import { socket } from '../../client-socket';
import { isNumber, isUndefined } from 'es-toolkit/compat';
import { AppList } from '../../app-list';

export class MatchScene extends Scene {
  private _doneSelectingBtn: Container;
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
  private _playAllTreasuresButton: AppButton;
  
  private get uiInteractive(): boolean {
    return !this._selecting && !$runningCardActions.get();
  }
  
  constructor(stage: Container) {
    super(stage);
    
    this.on('removed', this.onRemoved);
  }
  
  async initialize() {
    super.initialize();
    
    await this.loadAssets();
    
    this.createBoard();
    this.createGameLog();
    this.createScoreView();
    
    this._cleanup.push($supplyStore.subscribe(this.drawBaseSupply));
    app.renderer.on('resize', this.onRendererResize);
    gameEvents.on('matchStarted', this.onMatchStarted);
    gameEvents.on('selectCard', this.doSelectCards);
    gameEvents.on('userPrompt', this.onUserPrompt);
    gameEvents.on('displayCardDetail', this.onDisplayCardDetail);
    gameEvents.on('waitingForPlayer', this.onWaitingOnPlayer);
    gameEvents.on('doneWaitingForPlayer', this.onDoneWaitingForPlayer);
    gameEvents.on('pauseGame', this.onPauseGame);
    gameEvents.on('unpauseGame', this.onUnpauseGame);
    
    this._cleanup.push(() => {
      app.renderer.off('resize', this.onRendererResize);
      gameEvents.off('matchStarted', this.onMatchStarted);
      gameEvents.off('selectCard', this.doSelectCards);
      gameEvents.off('userPrompt', this.onUserPrompt);
      gameEvents.off('displayCardDetail', this.onDisplayCardDetail);
      gameEvents.off('waitingForPlayer', this.onWaitingOnPlayer);
      gameEvents.off('doneWaitingForPlayer', this.onDoneWaitingForPlayer);
      gameEvents.off('pauseGame', this.onPauseGame);
      gameEvents.off('unpauseGame', this.onUnpauseGame);
    });
    
    this._cleanup.push($currentPlayerTurnId.subscribe(async playerId => {
      if (playerId !== $selfPlayerId.get()) return;
      
      document.title = `Dominion - ${$players.get()[playerId].name}`;
      
      try {
        const s = new Audio(`./assets/sounds/your-turn.mp3`);
        s.volume = .2;
        await s?.play();
      } catch {
        console.error('Could not play start turn sound');
      }
    }));
    
    this._cleanup.push($turnPhase.subscribe(phase => {
      if (isUndefined(phase)) return;
      
      if (
        phase === 'buy' &&
        $currentPlayerTurnId.get() === $selfPlayerId.get() &&
        $playerHandStore($selfPlayerId.get())
          .get()
          .some(cardId => $cardsById.get()[cardId].type.includes('TREASURE'))
      ) {
        this._playAllTreasuresButton = createAppButton(
          { text: 'PLAY ALL TREASURES', style: { fill: 'white', fontSize: 24 } });
        const b = this._playAllTreasuresButton.button;
        b.label = 'playAllTreasureButton';
        b.x = this._playerHand.x + this._playerHand.width * .5 - b.width * .5;
        b.y = this._playerHand.y - b.height - STANDARD_GAP;
        b.on('pointerdown', () => {
          socket.emit('playAllTreasure', $selfPlayerId.get());
          const b = this._playAllTreasuresButton?.button;
          if (!b) {
            return;
          }
          b.removeFromParent();
          b.removeAllListeners();
          this._playAllTreasuresButton = null;
        });
        this.addChild(b);
      } else {
        const b = this._playAllTreasuresButton?.button;
        if (!b) {
          return;
        }
        b.removeFromParent();
        b.removeAllListeners();
        this._playAllTreasuresButton = null;
      }
    }));
    
    setTimeout(() => {
      this.onRendererResize();
      socket.emit('clientReady', $selfPlayerId.get(), true);
    });
  }
  
  private onPauseGame = () => {
    const c = new Container({ label: 'pause' });
    const g = new Graphics({ label: 'pause' });
    g.rect(0, 0, app.renderer.width, app.renderer.height)
      .fill({ color: 'black', alpha: .5 });
    c.addChild(g);
    
    const t = new Text({
      text: 'PLAYER DISCONNECTED',
      style: { fill: 'white', fontSize: 36 },
      anchor: .5
    });
    
    t.x = Math.floor(app.renderer.width * .5);
    t.y = Math.floor(app.renderer.height * .5);
    c.addChild(t);
    this.addChild(c);
  }
  
  private onUnpauseGame = () => {
    const c = this.getChildByLabel('pause');
    c?.removeFromParent();
    c?.destroy();
  }
  
  private async loadAssets() {
    const c = new Container();
    const g = c.addChild(new Graphics());
    g.rect(0, 0, app.renderer.width, app.renderer.height)
      .fill({ color: 'black', alpha: .6 });
    let ellipsisCount = 0;
    const t = new Text({
      text: 'LOADING...',
      style: {
        fontSize: 24,
        fill: 'white',
      },
      x: app.renderer.width * .5,
      y: app.renderer.height * .5,
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
      cardStore: $playerDeckStore($selfPlayerId.get()),
      label: 'DECK',
      cardFacing: 'back'
    });
    this.addChild(this._deck);
    
    this._discard = new CardStackView({
      cardStore: $playerDiscardStore($selfPlayerId.get()),
      label: 'DISCARD',
      cardFacing: 'front'
    });
    this.addChild(this._discard);
    
    this._trash = new CardStackView({
      label: 'TRASH',
      cardStore: $trashStore,
      cardFacing: 'front'
    });
    this.addChild(this._trash);
    this._trash.eventMode = 'static';
    this._trash.on('pointerdown', this.onTrashPressed);
    this._cleanup.push(() => this._trash.off('pointerdown', this.onTrashPressed));
    
    this._playerHand = new PlayerHandView($selfPlayerId.get());
    this._playerHand.on('nextPhase', this.onNextPhasePressed);
    this._cleanup.push(() => this._playerHand.off('nextPhase', this.onNextPhasePressed));
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
    const c = new Container({ label: 'waitingOnPlayer' });
    
    const t = new Text({
      text: `Waiting for ${$players.get()[playerId].name}`,
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
    c.x = app.renderer.width * .5 - c.width * .5;
    c.y = app.renderer.height * .5 - c.height * .5;
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
  
  private doSelectCards = async (arg: SelectCardEffectArgs) => {
    const cardIds = $selectableCards.get();
    
    if (cardIds.length === 0 && !isUndefined(this._doneSelectingBtn)) {
      this.removeChild(this._doneSelectingBtn);
      this._doneSelectingBtn.destroy();
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
    this._doneSelectingBtn.y = this._playArea.y + this._playArea.height + STANDARD_GAP;
    this._doneSelectingBtn.addChild(button.button);
    
    if (isNumber(arg.count) || arg.count.kind === 'exact') {
      const c = new Container({label:'cardCountContainer'});
      
      let s: Sprite;
      console.warn('very hacky way of getting this icon');
      if (arg.prompt.includes('trash')) {
        s = Sprite.from(await Assets.load(`./assets/ui-icons/trash-card-count.png`));
      } else if (arg.prompt.includes('discard')) {
        s = Sprite.from(await Assets.load(`./assets/ui-icons/discard-card-count.png`));
      }
      
      const count = isNumber(arg.count) ? arg.count : arg.count.count;
      const countText = new Text({
        label: 'count',
        text: count,
        style: {
          fontSize: 26,
          fill: 'white'
        }
      });
      
      s.x = 5;
      s.y = 5;
      c.addChild(s);
      
      const g = new Graphics();
      g.roundRect(0, 0, s.x + s.width + 5, s.y + s.height + 5, 5);
      g.fill(0xaaaaaa);
      c.addChildAt(g, 0);
      countText.x = Math.floor(c.width - countText.width * .5);
      countText.y = -Math.floor(countText.height * .5);
      c.addChild(countText);
      this._doneSelectingBtn.addChild(c);
    }
    
    this._doneSelectingBtn.x = Math.floor(
      this._playArea.x + this._playArea.width * .5 - this._doneSelectingBtn.width * .5)
    
    const doneListener = () => {
      this._doneSelectingBtn.off('pointerdown', doneListener);
      this.removeChild(this._doneSelectingBtn);
      this._doneSelectingBtn.destroy();
      selectedCardsListenerCleanup();
      gameEvents.emit('cardsSelected', $selectedCards.get());
      this._selecting = false;
    }
    
    const updateCountText = (countText: Text, count: number) => {
      countText.text = count;
    }
    
    const validate = (selectedCards: readonly number[]) => {
      // if they are valid, allow button press
      if (validateCountSpec(arg.count, selectedCards?.length ?? 0)) {
        if (!isUndefined(arg.validPrompt) && selectedCards?.length > 0) {
          button.text(arg.validPrompt);
        } else {
          button.text(arg.prompt);
        }
        
        this._doneSelectingBtn.getChildByLabel('doneSelectingButton').alpha = 1;
        this._doneSelectingBtn.on('pointerdown', doneListener);
      } else {
        button.text(arg.prompt);
        this._doneSelectingBtn.getChildByLabel('doneSelectingButton').alpha = .6;
        this._doneSelectingBtn.off('pointerdown', doneListener);
      }
    };
    
    // listen for cards being selected
    const selectedCardsListenerCleanup = $selectedCards.subscribe(cardIds => {
      this._doneSelectingBtn.off('pointerdown', doneListener);
      
      const countText = this._doneSelectingBtn.getChildByLabel('cardCountContainer')?.getChildByLabel('count') as Text;
      if (countText) {
        if (isNumber(arg.count) || arg.count.kind === 'exact') {
          const count = isNumber(arg.count) ? arg.count : arg.count.count;
          updateCountText(countText, Math.max(count - cardIds.length, 0));
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
    
    if (event.button === 2) {
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
        gameEvents.emit('cardTapped', $selfPlayerId.get(), cardId);
      }
    }
  }
  
  private drawBaseSupply = (newVal: ReadonlyArray<number>) => {
    if (!newVal || newVal.length === 0) {
      return;
    }
    
    this._baseSupply.removeChildren()
      .forEach(c => c.destroy());
    
    const cards = newVal.map(id => $cardsById.get()[id]);
    
    // reduce to Record of card name to a Card array of those named cards
    const piles = cards.reduce((prev, card) => {
      prev[card.cardKey] ||= [];
      prev[card.cardKey].push(card);
      return prev;
    }, {} as Record<string, Card[]>);
    
    const columns = 2;
    Object.entries(piles)
      .forEach(([_cardKey, pile], oIdx) => {
        const card = pile[pile.length - 1];
        const c = new PileView(card, pile.length);
        c.x = oIdx % columns * SMALL_CARD_WIDTH + oIdx % columns * STANDARD_GAP;
        c.y = Math.floor(oIdx / columns) * SMALL_CARD_HEIGHT + Math.floor(oIdx / columns) * STANDARD_GAP;
        this._baseSupply.addChild(c);
      });
    this._baseSupply.scale = .8;
  }
  
  private onRendererResize = (): void => {
    this._gameLog.x = app.renderer.width - this._gameLog.width - STANDARD_GAP;
    this._gameLog.y = STANDARD_GAP;
    
    this._scoreView.x = STANDARD_GAP;
    this._scoreView.y = STANDARD_GAP;
    
    this._kingdomView.y = STANDARD_GAP;
    this._kingdomView.x = app.renderer.width * .5 - this._kingdomView.width * .5;
    
    this._baseSupply.y = this._kingdomView.y;
    this._baseSupply.x = this._kingdomView.x - this._baseSupply.width - STANDARD_GAP;
    
    this._playerHand.x = app.renderer.width * .5 - this._playerHand.getLocalBounds().width * .5;
    this._playerHand.y = app.renderer.height - this._playerHand.getLocalBounds().height;
    
    this._playArea.x = this._kingdomView.x + this._kingdomView.width * .5 - this._playArea.width * .5;
    this._playArea.y = this._playerHand.y - this._playArea.height - 75;
    
    this._discard.y = app.renderer.height - CARD_HEIGHT * .75;
    this._discard.x = this._playerHand.x - this._discard.width - STANDARD_GAP;
    
    this._deck.y = app.renderer.height - CARD_HEIGHT * .75;
    this._deck.x = this._discard.x - this._deck.width - STANDARD_GAP;
    
    this._trash.y = this._deck.y;
    this._trash.x = this._playerHand.x + this._playerHand.width + STANDARD_GAP;
  }
}
