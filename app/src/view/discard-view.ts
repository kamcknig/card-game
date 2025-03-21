import {Container, DestroyOptions, Graphics} from "pixi.js";
import {CountBadgeView} from "./count-badge-view";
import {createCardView} from "../core/card/create-card-view";
import {$playerDiscardStore} from "../state/player-state";
import {$cardsById} from "../state/card-state";
import {CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP} from '../app-contants';

export type DiscardViewArgs = {
    owner: number;
}

export class DiscardView extends Container {
    private readonly _background: Container = new Container();
    private readonly _cardContainer: Container = new Container({x: STANDARD_GAP, y: STANDARD_GAP});
    private readonly _cleanup: () => void;

    constructor(private args: DiscardViewArgs) {
        super();

        this.createBackground();
        this.addChild(this._cardContainer);

        this._cleanup = $playerDiscardStore(this.args.owner).subscribe(this.drawDeck.bind(this));
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup();
    }

    private createBackground() {
        console.log(`DiscardView createBackground for player ${this.args.owner}`);
        this._background.addChild(
            new Graphics()
                .roundRect(0, 0, CARD_WIDTH + STANDARD_GAP * 2, CARD_HEIGHT + STANDARD_GAP * 2)
                .fill({color: 0x000000, alpha: .6})
        )
        this.addChild(this._background);
    }

    private drawDeck(val: ReadonlyArray<number>) {
        this._cardContainer.removeChildren().forEach(c => c.destroy());

        const cardId = val?.concat()?.splice(-1)?.[0];

        if (cardId) {
            const c = this._cardContainer.addChild(createCardView($cardsById.get()[cardId]));
            c.size = 'full';
            c.facing = 'front';
        }

        if (val.length > 0) {
            const b = new CountBadgeView(val.length ?? 0);
            this._cardContainer.addChild(b);
        }
    }
}