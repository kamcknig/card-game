import {Container, Graphics, Text} from "pixi.js";

export class CountBadgeView extends Container {
    constructor(public count: number = 0) {
        super();

        const c = new Graphics()
            .roundRect(0, 0, 30, 26, 4)
            .fill(0x000000)
            .roundRect(2, 2, 26, 22, 4)
            .fill(0xff0000);

        this.addChild(c);

        const l =  new Text({
            text: this.count,
            style: {
                fontSize: 18,
            }
        });
        l.anchor.set(0.5);
        l.x = this.width * .5;
        l.y = this.height * .5;
        this.addChild(l);
    }
}