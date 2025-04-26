import { Container, Graphics } from 'pixi.js';
import { PileView } from './pile';
import { cardStore } from '../../../state/card-state';
import { Card, CardKey } from 'shared/shared-types';
import { SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { kingdomStore } from '../../../state/match-logic';

export class KingdomSupplyView extends Container {
    private _background: Container;
    private _cardContainer: Container;
    private _cleanup: (() => void)[] = [];

    constructor() {
        super();

        this._background = this.addChild(new Container());
        this._background.addChild(new Graphics());

        this._cardContainer = this.addChild(new Container({x: STANDARD_GAP, y: STANDARD_GAP}));

        this._cleanup.push(kingdomStore.subscribe(this.draw.bind(this)));
        this.off('removed', this.onRemoved);
    }

    private onRemoved = () => {
        this._cleanup.forEach(cb => cb());
        this.on('removed', this.onRemoved);
    }

    private draw(val: ReadonlyArray<number>) {
        if (!val || val.length === 0) return;

        this._cardContainer.removeChildren().forEach(c => c.destroy());

        const cards = val.map(id => cardStore.get()[id]);
        const piles = cards.reduce((prev, card) => {
            prev[card.cardKey] ||= [];
            prev[card.cardKey].push(card);
            return prev;
        }, {} as Record<CardKey, Card[]>);

        const numRows = 2;
        Object.entries(piles)
            .sort(([_cardKeyA, cardsA], [_cardKeyB, cardsB]) => {
                const costCompare = cardsA[0].cost.treasure - cardsB[0].cost.treasure;
                if (costCompare !== 0) {
                    return costCompare;
                }

                return cardsA[0].cardName.localeCompare(cardsB[0].cardName);
            })
            .forEach(([_cardName, pile], idx) => {
                const p = new PileView({ cards: pile, count: pile.length, size: 'half' });
                p.x = Math.floor(idx % 5 * SMALL_CARD_WIDTH + idx % 5 * STANDARD_GAP);
                p.y = Math.floor(((numRows - 1 - Math.floor((idx) / 5)) * SMALL_CARD_HEIGHT) + ((numRows - 1 - Math.floor((idx) / 5)) * STANDARD_GAP));
                this._cardContainer.addChild(p);
            });

        const g = this._background.getChildAt(0) as Graphics;
        g.clear();
        g.roundRect(0, 0, 5 * SMALL_CARD_WIDTH + 6 * STANDARD_GAP, 2 * SMALL_CARD_HEIGHT + STANDARD_GAP * 3)
            .fill({
                color: 0,
                alpha: .6
            });
    }
}
