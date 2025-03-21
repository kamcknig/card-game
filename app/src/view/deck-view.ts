import {Container, ContainerOptions, DestroyOptions, Graphics} from "pixi.js";
import {CountBadgeView} from "./count-badge-view";
import {createCardView} from "../core/card/create-card-view";
import {$playerDeckStore} from "../state/player-state";
import {$cardsById} from "../state/card-state";
import {CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP} from '../app-contants';

export type DeckViewArgs = {
    owner: number;
} & ContainerOptions

export class DeckView extends Container {
    private readonly _background: Container = new Container();
    private readonly _cardContainer: Container = new Container({x: STANDARD_GAP, y: STANDARD_GAP});
    private readonly _cleanup: () => void;

    constructor(private args: DeckViewArgs) {
        super();

        this.createBackground();
        this.addChild(this._cardContainer);

        this._cleanup = $playerDeckStore(this.args.owner).subscribe(this.drawDeck.bind(this))
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup();
    }

    private createBackground() {
        console.log(`DeckView createBackground for player ${this.args.owner}`);
        this._background.addChild(
            new Graphics()
                .roundRect(0, 0, CARD_WIDTH + STANDARD_GAP * 2, + CARD_HEIGHT + STANDARD_GAP * 2)
                .fill({color: 0x000000, alpha: .6})
        )
        this.addChild(this._background);
    }

    private drawDeck(val: ReadonlyArray<number>) {
        this._cardContainer.removeChildren().forEach(c => c.destroy());
        
        if (!val || val.length === 0) {
            return;
        }

        const cards = val.concat().map(id => $cardsById.get()[id]);

        for (const card of cards ?? []) {
            const c = this._cardContainer.addChild(createCardView(card));
            c.size = 'full';
            c.facing = 'back';
        }

        if (cards.length > 0) {
            const b = new CountBadgeView(cards.length ?? 0);
            this._cardContainer.addChild(b);
        }
    }
}