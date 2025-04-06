import {Container} from "pixi.js";
import {createCardView} from "../core/card/create-card-view";
import {CountBadgeView} from "./count-badge-view";
import { Card, CardFacing, CardSize } from 'shared/shared-types';

export class PileView extends Container {
    constructor(cards: Card[], count: number, size: CardSize = 'full', facing: CardFacing = 'front') {
        super();

        const card = cards.reduce<Card | undefined>((prev, next) => {
            if (!prev) {
                return next;
            }

            return prev.id > next.id ? prev : next
        }, undefined);

        if (!card) {
          throw new Error('No card found for this pile');
        }

        const view = this.addChild(createCardView(card));
        view.size = size;
        view.facing = facing;

        const b = new CountBadgeView({ count });
        b.x = 0;
        b.y = 0;

        this.addChild(b);
    }
}
