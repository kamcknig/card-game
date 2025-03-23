import { Container, Graphics } from "pixi.js";
import { createCardView } from "../core/card/create-card-view";
import { $playAreaStore } from "../state/match-state";
import { $cardsById } from "../state/card-state";

export class PlayAreaView extends Container {
    private _background: Graphics = new Graphics();
    private _cardView: Container = new Container();

    constructor() {
        super();

        this._background
            .roundRect(0, 0, 1000, 340)
            .fill({color: 0, alpha: .6});

        this.addChild(this._background);

        this._cardView.x = 20;
        this._cardView.y = 60;
        this.addChild(this._cardView);

        $playAreaStore.subscribe(this.drawCards.bind(this));
    }

    private drawCards(val: ReadonlyArray<number>) {
        this._cardView.removeChildren()
          .forEach(c => c.destroy());
        const cards = val.concat()
          .map(id => $cardsById.get()[id]);
        for (const [idx, card] of cards.entries()) {
            const view = this._cardView.addChild(createCardView(card));
            view.size = 'full';
            view.x = idx * 160;
        }
    }
}
