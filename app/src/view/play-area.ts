import {Container, DestroyOptions, Graphics, Text} from "pixi.js";
import {createCardView} from "../core/card/create-card-view";
import {batched} from "nanostores";
import {$playAreaStore} from "../state/match-state";
import {
    $currentPlayerTurnId,
    $playerActions,
    $playerBuys,
    $playerTreasure,
    $turnPhase
} from "../state/turn-state";
import {$cardsById} from "../state/card-state";
import {$selfPlayerId} from "../state/player-state";
import {TurnPhase} from "shared/types";
import {ButtonContainer} from '@pixi/ui';
import {createAppButton} from '../core/create-app-button';
import {gameEvents} from '../core/event/events';
import {SignalConnection} from 'typed-signals';
import {STANDARD_GAP} from '../app-contants';

export class PlayAreaView extends Container {
    private _background: Graphics = new Graphics();
    private _cardView: Container = new Container();
    private _cleanup: (() => void)[] = [];
    private _phaseLabel: Text = new Text({x: 10, y: 10, style: { fill: 0xffffff, fontSize: 24 }});
    private _treasureLabel: Text = new Text({x: 200, y: 10, style: { fill: 0xffffff, fontSize: 24 }});
    private _buyLabel: Text = new Text({x: 400, y: 10, style: { fill: 0xffffff, fontSize: 24 }});
    private _actionLabel: Text = new Text({x: 100, y: 10, style: { fill: 0xffffff, fontSize: 24 }});

    constructor() {
        super();

        this._background
            .roundRect(0, 0, 1000, 340)
            .fill({color: 0, alpha: .6});

        this.addChild(this._background);

        this._cardView.x = 20;
        this._cardView.y = 60;
        this.addChild(this._cardView);

        this.addChild(this._phaseLabel);
        this.addChild(this._treasureLabel);
        this.addChild(this._buyLabel);
        this.addChild(this._actionLabel);

        $playAreaStore.subscribe(this.drawCards.bind(this));

        this._cleanup.push(batched([$turnPhase, $playerTreasure, $playerBuys, $playerActions, $selfPlayerId, $currentPlayerTurnId], (turnPhase, treasure, buys, actions, selfPlayerId, currentPlayerId) => ({
            turnPhase,
            treasure,
            buys,
            actions,
            selfPlayerId,
            currentPlayerId,
        })).subscribe(this.drawPhase.bind(this)));
    }



    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup.forEach(c => c());
    }

    private drawCards(val: ReadonlyArray<number>) {
        this._cardView.removeChildren().forEach(c => c.destroy());
        const cards = val.concat().map(id => $cardsById.get()[id]);
        for (const [idx, card] of cards.entries()) {
            const view = this._cardView.addChild(createCardView(card));
            view.size = 'full';
            view.x = idx * 160;
        }
    }

    private drawPhase({turnPhase, treasure, buys, actions, selfPlayerId, currentPlayerId}: { turnPhase: TurnPhase; treasure: number; buys: number; actions: number; selfPlayerId: number; currentPlayerId: number }) {
        this._buyLabel.text = `BUYS ${buys}`;
        this._treasureLabel.text = `TREASURE ${treasure}`;

        if (selfPlayerId === currentPlayerId) {
            this._phaseLabel.text = turnPhase?.toUpperCase() === 'BUY' ? 'Play Treasures / Buy' : 'Play Actions';
        } else {
            this._phaseLabel.text = '';
        }

        this._actionLabel.text = `ACTIONS ${actions}`;

        this._buyLabel.x = this._background.width - this._buyLabel.width - 10;
        this._treasureLabel.x = this._buyLabel.x - this._treasureLabel.width - 40;
        this._actionLabel.x = this._treasureLabel.x - this._actionLabel.width - 40;
    }
}
