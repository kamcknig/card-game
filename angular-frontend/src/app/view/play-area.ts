import { Container, Graphics } from "pixi.js";
import { createCardView } from "../core/card/create-card-view";
import { playAreaStore } from "../state/match-state";
import { cardStore } from "../state/card-state";
import { List } from "@pixi/ui";
import { STANDARD_GAP } from '../core/app-contants';

export class PlayAreaView extends Container {
    private _background: Graphics = new Graphics();
    private _cardView: List = new List({elementsMargin: STANDARD_GAP});
    private readonly _cleanup: (() => void)[] = [];

    constructor() {
        super();

        this._cardView.label = 'cardView';

        this._background.roundRect(0, 0, 1000, 340);
        this._background.fill({color: 0, alpha: .6});

        this.addChild(this._background);

        this._cardView.x = STANDARD_GAP;
        this._cardView.y = STANDARD_GAP * 3;
        this.addChild(this._cardView);

        this._cleanup.push(playAreaStore.subscribe(this.drawCards.bind(this)));
        this.on('removed', this.onRemoved);
    }

    private onRemoved = () => {
        this._cleanup.forEach(cb => cb());
        this.off('removed', this.onRemoved);
    }

    private drawCards(val: ReadonlyArray<number>) {
        this._cardView.removeChildren();
        const cards = val.concat().map(id => cardStore.get()[id]);
        for (const card of cards) {
            const view = this._cardView.addChild(createCardView(card));
            view.size = 'full';
        }
    }
}
