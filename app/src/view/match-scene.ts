import { Assets, Container, DestroyOptions, Graphics, Text } from "pixi.js";
import { Scene } from "../core/scene/scene";
import { PlayerHandView } from "./player-hand";
import { createAppButton } from "../core/create-app-button";
import { $supplyStore, $trashStore } from "../state/match-state";
import { app } from "../core/create-app";
import { $playerDeckStore, $playerDiscardStore, $players, $selfPlayerId } from "../state/player-state";
import { gameEvents } from "../core/event/events";
import { PlayAreaView } from "./play-area";
import { KingdomSupplyView } from "./kingdom-supply";
import { PileView } from "./pile";
import { $cardsById } from "../state/card-state";
import { Card, CountSpec, UserPromptArgs } from "shared/types";
import { $runningCardActions, $selectableCards, $selectedCards } from '../state/interactive-state';
import { CardView } from './card-view';
import { userPromptModal } from './modal/user-prompt-modal';
import { CARD_HEIGHT, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../app-contants';
import { ScoreView } from './score-view';
import { GameLogView } from './game-log-view';
import { displayCardDetail } from './modal/display-card-detail';
import { validateCountSpec } from "../shared/validate-count-spec";
import { CardStackView } from './card-stack';
import { displayTrash } from './modal/display-trash';

export class MatchScene extends Scene {
    private _doneSelectingBtn: Container = new Container();
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
    
    private get uiInteractive(): boolean {
        return !this._selecting && !$runningCardActions.get();
    }
    
    constructor(stage: Container) {
        super(stage);
    }

    async initialize() {
        super.initialize();

        await this.loadAssets();
        
        this.createBoard();
        this.createGameLog();
        this.createScoreView();
        this.createDoneSelectingButton();

        this._cleanup.push($supplyStore.subscribe(this.drawBaseSupply.bind(this)));
        app.renderer.on('resize', this.onRendererResize.bind(this));
        gameEvents.on('matchStarted', this.onMatchStarted.bind(this));
        gameEvents.on('selectCard', this.doSelectCards.bind(this));
        gameEvents.on('userPrompt', this.onUserPrompt.bind(this));
        gameEvents.on('displayCardDetail', this.onDisplayCardDetail.bind(this));
        gameEvents.on('waitingForPlayer', this.onWaitingOnPlayer.bind(this));
        gameEvents.on('doneWaitingForPlayer', this.onDoneWaitingForPlayer.bind(this));

        setTimeout(() => {
            this.onRendererResize();
            gameEvents.emit('ready', $selfPlayerId.get());
        });
    }
    
    private async loadAssets() {
        const c = new Container();
        const g= c.addChild(new Graphics());
        g.rect(0, 0, app.renderer.width, app.renderer.height).fill({color: 'black', alpha: .6});
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
        this._trash.on('pointerdown', () => {
            if ($trashStore.get().length === 0) {
                return;
            }
            displayTrash()
        });
        
        this._playerHand = new PlayerHandView($selfPlayerId.get());
        this._playerHand.on('nextPhase', this.onNextPhasePressed.bind(this));
        this.addChild(this._playerHand);
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
    private createDoneSelectingButton() {
        const b = createAppButton({
            text: 'DONE SELECTING',
            style: {
                fill: 'white',
                fontSize: 36,
            },
            x: 20,
            y: 100,
        });
        this._doneSelectingBtn.eventMode = 'static';
        this._doneSelectingBtn.addChild(b.button);
    }
    
    private onNextPhasePressed() {
        console.log('call to action pressed');
        
        if (!this.uiInteractive) {
            console.log('GUI non-interactive, ignoring');
            return
        }
        
        gameEvents.emit('nextPhase');
    }
    
    private onDisplayCardDetail(cardId: number) {
        displayCardDetail(cardId);
    }
    
    private onWaitingOnPlayer(playerId: number) {
        const c = new Container({label: 'waitingOnPlayer'});
        
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
          .fill({color: 'black', alpha: .8});
        
        c.addChild(g);
        t.x = c.width * .5;
        t.y = c.height * .5;
        c.addChild(t);
        
        this.addChild(c);
        c.x = app.renderer.width * .5 - c.width * .5;
        c.y = app.renderer.height * .5 - c.height * .5;
    }
    
    private onDoneWaitingForPlayer() {
        this.getChildByLabel('waitingOnPlayer')?.removeFromParent();
    }

    private onMatchStarted() {
        this.eventMode = 'static';
        this.on('pointerdown', this.onPointerDown.bind(this));
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup.forEach(c => c());
    }

    private async onUserPrompt(args: UserPromptArgs) {
        this._selecting = true;
        const result = await userPromptModal(args);
        this._selecting = false;
        gameEvents.emit('userPromptResponse', result);
    }

    private async doSelectCards(count: CountSpec) {
        const cardIds = $selectableCards.get();

        if (cardIds.length === 0) {
            this.removeChild(this._doneSelectingBtn);
            return;
        }
        
        this._selecting = true;
        
        const doneListener = () => {
            this._doneSelectingBtn.off('pointerdown', doneListener);
            this.removeChild(this._doneSelectingBtn);
            selectedCardsListenerCleanup();
            gameEvents.emit('cardsSelected', $selectedCards.get());
            this._selecting = false;
        }

        // listen for cards being selected
        const selectedCardsListenerCleanup = $selectedCards.subscribe(cardIds => {
            this._doneSelectingBtn.off('pointerdown', doneListener);
            // if they are valid, allow button press
            if (validateCountSpec(count, cardIds?.length ?? 0)) {
                this._doneSelectingBtn.alpha = 1;
                this._doneSelectingBtn.on('pointerdown', doneListener);
            } else {
                this._doneSelectingBtn.alpha = .6;
                this._doneSelectingBtn.off('pointerdown', doneListener);
            }
        });

        this._doneSelectingBtn.x = app.renderer.width * .5 - this._doneSelectingBtn.width * .5;
        this._doneSelectingBtn.y = 20;
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
            
            if ($selectableCards.get().includes(cardId)) {
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

    private drawBaseSupply(newVal: ReadonlyArray<number>) {
        this._baseSupply.removeChildren().forEach(c => c.destroy());

        const cards = newVal.map(id => $cardsById.get()[id]);

        // reduce to Record of card name to a Card array of those named cards
        const piles = cards.reduce((prev, card) => {
            prev[card.cardKey] ||= [];
            prev[card.cardKey].push(card);
            return prev;
        }, {} as Record<string, Card[]>);

        const columns = 2;
        Object.entries(piles).forEach(([_cardKey, pile], oIdx) => {
            const card = pile[pile.length - 1];
            const c = new PileView(card, pile.length);
            c.x = oIdx % columns * SMALL_CARD_WIDTH + oIdx % columns * STANDARD_GAP;
            c.y = Math.floor(oIdx / columns) * SMALL_CARD_HEIGHT + Math.floor(oIdx / columns) * STANDARD_GAP;
            this._baseSupply.addChild(c);
        });
        this._baseSupply.scale = .8;
    }

    private onRendererResize(): void {
        this._gameLog.x = app.renderer.width - this._gameLog.width - STANDARD_GAP;
        this._gameLog.y = STANDARD_GAP;

        this._scoreView.x = STANDARD_GAP;
        this._scoreView.y = STANDARD_GAP;

        this._kingdomView.y = STANDARD_GAP;
        this._kingdomView.x = app.renderer.width * .5 - this._kingdomView.width * .5;
        
        this._baseSupply.y = this._kingdomView.y;
        this._baseSupply.x = this._kingdomView.x - this._baseSupply.width - STANDARD_GAP;

        this._playerHand.x = app.renderer.width * .5 - this._playerHand.width * .5;
        this._playerHand.y = app.renderer.height - this._playerHand.height;
        
        this._playArea.x = this._kingdomView.x + this._kingdomView.width * .5 - this._playArea.width * .5;
        this._playArea.y = this._playerHand.y - this._playArea.height - STANDARD_GAP;

        this._discard.y = app.renderer.height - CARD_HEIGHT * .75;
        this._discard.x = this._playerHand.x - this._discard.width - STANDARD_GAP;
        
        this._deck.y = app.renderer.height - CARD_HEIGHT * .75;
        this._deck.x = this._discard.x - this._deck.width - STANDARD_GAP;
        
        this._trash.y = this._deck.y;
        this._trash.x = this._playerHand.x + this._playerHand.width + STANDARD_GAP;
    }
}
