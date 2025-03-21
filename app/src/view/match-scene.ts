import {Assets, Container, DestroyOptions, Graphics, Text} from "pixi.js";
import {Scene} from "../core/scene/scene";
import {CountBadgeView} from "./count-badge-view";
import {PlayerHandView} from "./player-hand";
import {createAppButton} from "../core/create-app-button";
import {$supplyStore, $trashStore} from "../state/match-state";
import {app} from "../core/create-app";
import {createCardView} from "../core/card/create-card-view";
import {$selfPlayerId} from "../state/player-state";
import {gameEvents} from "../core/event/events";
import {PlayAreaView} from "./play-area";
import {KingdomSupplyView} from "./kingdom-supply";
import {PileView} from "./pile";
import {$cardsById} from "../state/card-state";
import {Card, CountSpec, UserPromptArgs} from "shared/types";
import {$selectableCards, $selectedCards} from '../state/interactive-state';
import {CardView} from './card-view';
import {userPromptModal} from './modal/user-prompt-modal';
import {CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP} from '../app-contants';
import {ScoreView} from './score-view';
import {GameLogView} from './game-log-view';
import {displayCardDetail} from './modal/display-card-detail';
import {ButtonContainer} from '@pixi/ui';
import {$currentPlayerTurnId} from '../state/turn-state';
import {displayTrash} from './modal/display-trash';
import {validateCountSpec} from "../shared/validate-count-spec";
import { socket } from '../client-socket';
import { isUndefined } from 'es-toolkit';

export class MatchScene extends Scene {
    private _doneSelectingBtn: Container = new Container();
    private _board: Container = new Container();
    private _baseSupply: Container = new Container();
    private _playerHand: Container = new Container();
    private _trash: Container = new Container();
    private _cleanup: (() => void)[] = [];
    private _playArea: PlayAreaView | undefined;
    private _kingdomView: KingdomSupplyView | undefined;
    ///private _selectionMode: boolean = false;
    private _scoreView: ScoreView = new ScoreView();
    private _gameLog: GameLogView = new GameLogView();
    private _nextPhaseButton: ButtonContainer = createAppButton({text: 'NEXT'});

    constructor(stage: Container) {
        super(stage);
    }

    private _selecting: boolean = false;
    private onUserDoneSelecting() {
        this._selecting = false;
    }

    private onUserSelecting() {
        this._selecting = true;
    }

    async initialize() {
        console.log('MatchScene initialize');
        super.initialize();

        await Assets.loadBundle('cardLibrary');

        this.createBoard();
        this.createGameLog();
        this.createDoneSelectingButton();
        this.createScoreView();

        this.addChild(this._nextPhaseButton);

        $currentPlayerTurnId.subscribe(playerId => {
            if (playerId === $selfPlayerId.get()) {
                this.addChild(this._nextPhaseButton);
            } else {
                this.removeChild(this._nextPhaseButton);
            }
        });

        this._cleanup.push($supplyStore.subscribe(this.drawBaseSupply.bind(this)));
        this._cleanup.push($trashStore.subscribe(this.drawTrashPile.bind(this)));
        app.renderer.on('resize', this.onRendererResize.bind(this));

        $selfPlayerId.subscribe(this.createPlayerHand.bind(this));

        // todo: clean up listener
        gameEvents.on('matchStarted', this.onMatchStarted.bind(this));
        gameEvents.on('selectCard', this.doSelectCards.bind(this));
        gameEvents.on('selectCard', this.onUserSelecting.bind(this));
        gameEvents.on('userPrompt', this.onUserPrompt.bind(this));
        gameEvents.on('userPrompt', this.onUserSelecting.bind(this));
        gameEvents.on('displayCardDetail', this.onDisplayCardDetail.bind(this));
        gameEvents.on('cardsSelected', this.onUserDoneSelecting.bind(this));
        gameEvents.on('userPromptResponse', this.onUserDoneSelecting.bind(this));

        this._nextPhaseButton.on('pointerdown', (e) => {
            console.log('MatchScene next phase button pressed');
            if (this._selecting) return;

            gameEvents.emit('nextPhase');
        });

        gameEvents.emit('ready', $selfPlayerId.get());

        setTimeout(() => {
            const {width, height} = app.renderer;
            this.onRendererResize(width, height);
        })
    }

    private onDisplayCardDetail(cardId: number) {
        displayCardDetail(cardId);
    }

    private onMatchStarted() {
        this.eventMode = 'static';
        this.on('pointerdown', this.onPointerDown.bind(this))
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup.forEach(c => c());
    }

    private createBoard() {
        console.log('MatchScene createBoard');
        this.addChild(this._board);

        this.createBaseSupplyView();
        this.createKingdomSupplyView();
        this.createTrashView();
        this.createPlayArea();
    }

    private createGameLog() {
        this.addChild(this._gameLog);
    }

    private async onUserPrompt(args: UserPromptArgs) {
        const result = await userPromptModal(args);
        this.onUserDoneSelecting();
        gameEvents.emit('userPromptResponse', result);
    }

    private async doSelectCards(count: CountSpec) {
        const cardIds = $selectableCards.get();

        if (cardIds.length === 0) {
            this.removeChild(this._doneSelectingBtn);
            return;
        }

        //this._selectionMode = true;

        const doneListener = () => {
            this._doneSelectingBtn.off('pointerdown', doneListener);
            this.removeChild(this._doneSelectingBtn);
            selectedCardsListenerCleanup();
            gameEvents.emit('cardsSelected', $selectedCards.get());
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

        console.log('selecting is', this._selecting);
        if (this._selecting) {
            let current = $selectedCards.get();
            const idx = current.findIndex(c => c === cardId);
            if (idx > -1) {
                current.splice(idx, 1);
            } else {
                current.push(cardId);
            }
            $selectedCards.set([...current]);
        } else if ($selectableCards.get().includes(cardId)) {
            const updated = () => {
                socket.off('matchUpdated', updated)
            }
            socket.on('matchUpdated', updated);
            gameEvents.emit('cardTapped', $selfPlayerId.get(), cardId);
        }
    }

    private createBaseSupplyView() {
        console.log('MatchScene createBaseSupplyView');
        this._board.addChild(this._baseSupply);
    }

    private createKingdomSupplyView() {
        console.log('MatchScene createKingdomSupplyView');
        this._kingdomView = this._board.addChild(new KingdomSupplyView());
    }

    private createTrashView() {
        console.log('MatchScene createTrashView');
        this._board.addChild(this._trash);
        // todo: clean up listener
        this._trash.on('pointerdown', () => {
            console.log('display trash');
            if ($trashStore.get().length === 0) {
                return;
            }
            displayTrash();
        });
    }

    private createPlayArea() {
        console.log('MatchScene createPlayArea');
        this._playArea = this.addChild(new PlayAreaView());
    }

    private drawBaseSupply(newVal: ReadonlyArray<number>) {
        console.warn('When a pile runs out, the rest will move to fill in. I have not accounted for this yet.');
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
        this._baseSupply.scale = .9;
    }

    private drawTrashPile(newVal: ReadonlyArray<number>) {
        const cards = newVal.map(id => $cardsById.get()[id]);

        // TODO: move to a TrashView class?
        this._trash.removeChildren().forEach(c => c.destroy());
        this._trash.eventMode = 'static';

        const c = new Container();
        c.x = 10;
        c.y = 30;
        for (const card of cards) {
            const view = c.addChild(createCardView(card));
            view.size = 'full';
        }

        const g = new Graphics()
            .roundRect(0, 0, CARD_WIDTH + STANDARD_GAP * 2, CARD_HEIGHT + STANDARD_GAP * 2)
            .fill({color: 0x000000, alpha: .6});

        this._trash.addChild(g);

        if (newVal.length > 0) {
            const b = new CountBadgeView(newVal.length);
            b.x = 0;
            b.y = 0;
            c.addChild(b);
        }

        const t = new Text({
            x: 20,
            y: 5,
            text: `TRASH`,
            style: {
                fontSize: 20,
                fill: 0xFFFFFF,
            }
        });
        this._trash.addChild(t);
        this._trash.addChild(c);
    }

    private createPlayerHand(id?: number) {
        console.log(`MatchScene createPlayerHand for player ${id}`);
        if (!id) {
            console.log('no id');
            return;
        }

        if (isUndefined(id)) {
            return;
        }
        this.addChild(this._playerHand);
        const hand = new PlayerHandView(id);
        this._playerHand.addChild(hand);
    }

    private onRendererResize(w?: number, h?: number): void {
        this._gameLog.x = app.renderer.width - this._gameLog.width - STANDARD_GAP;
        this._gameLog.y = STANDARD_GAP;

        this._scoreView.x = STANDARD_GAP;
        this._scoreView.y = STANDARD_GAP;

        this._baseSupply.y = STANDARD_GAP;
        this._baseSupply.x = this._scoreView!.x + this._scoreView.width + STANDARD_GAP;

        this._kingdomView.y = STANDARD_GAP;
        this._kingdomView.x = this._baseSupply.x + this._baseSupply.width + STANDARD_GAP;

        this._playerHand.x = this._baseSupply.x;
        this._playerHand.y = app.renderer.height - this._playerHand.height - STANDARD_GAP;

        this._trash.x = this._playerHand.x + this._playerHand.width + STANDARD_GAP;
        this._trash.y = h - this._trash.height - STANDARD_GAP;

        this._playArea.x = this._kingdomView.x + this._kingdomView.width * .5 - this._playArea.width * .5;
        this._playArea.y = this._playerHand.y - this._playArea.height - STANDARD_GAP;

        this._nextPhaseButton.x = this._playArea.x + this._playArea.width + STANDARD_GAP;
        this._nextPhaseButton.y = this._playArea.y + this._playArea.height - this._nextPhaseButton.height;
    }

    private createDoneSelectingButton() {
        const b = createAppButton({
            text: 'DONE SELECTING',
            style: {
                fill: 'white',
                fontSize: 36,
            },
            x: 20,
            y: 20,
        });
        this._doneSelectingBtn.eventMode = 'static';
        this._doneSelectingBtn.addChild(b);
    }

    private createScoreView() {
        this._scoreView = new ScoreView();
        this.addChild(this._scoreView);
        this._scoreView.x = STANDARD_GAP;
        this._scoreView.y = STANDARD_GAP;
    }
}
