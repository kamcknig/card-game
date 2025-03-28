import {Container} from "pixi.js";
import {createCardView} from "../core/card/create-card-view";
import {CountBadgeView} from "./count-badge-view";
import {Card} from "shared/shared-types";

export class PileView extends Container {
    constructor(card: Card, count: number) {
        super();

        this.addChild(createCardView(card));

        const b = new CountBadgeView(count);
        b.x = 0;
        b.y = 0;

        this.addChild(b);
    }
}