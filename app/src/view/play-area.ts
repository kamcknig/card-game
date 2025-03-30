import { Container, Graphics } from "pixi.js";
import { createCardView } from "../core/card/create-card-view";
import { $playAreaStore } from "../state/match-state";
import { $cardsById } from "../state/card-state";

export class PlayAreaView extends Container {
    private _background: Graphics = new Graphics();
    private _cardView: Container = new Container();
    private readonly _cleanup: (() => void)[] = [];
    
    constructor() {
        super();

        this._background
            .roundRect(0, 0, 1000, 340)
            .fill({color: 0, alpha: .6});

        this.addChild(this._background);

        this._cardView.x = 20;
        this._cardView.y = 60;
        this.addChild(this._cardView);

        this._cleanup.push($playAreaStore.subscribe(this.drawCards.bind(this)));
        this.on('removed', this.onRemoved);
    }

    private onRemoved = () => {
        this._cleanup.forEach(cb => cb());
        this.off('removed', this.onRemoved);
    }
    
    private drawCards(val: ReadonlyArray<number>) {
        this._cardView.removeChildren();
        const cards = val.concat()
          .map(id => $cardsById.get()[id]);
        for (const [idx, card] of cards.entries()) {
            const view = this._cardView.addChild(createCardView(card));
            view.size = 'full';
            view.x = idx * 160;
        }
    }
}
