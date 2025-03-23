import {Graphics, Text, TextOptions} from "pixi.js";
import {ButtonContainer} from "@pixi/ui";

export const createAppButton = (textOpts?: TextOptions) => {
    const button = new ButtonContainer();
    const text = new Text({
        ...textOpts,
        style: { ...textOpts?.style ?? {}, fill: 'white' },
        anchor: .5
    });

    const background = new Graphics();
    background
        .roundRect(0, 0, text.width + 20, text.height + 20, 10)
        .fill({color: 'black', alpha: .9});

    button.addChildAt(background, 0);

    text.x = button.width * .5;
    text.y = button.height * .5;
    button.addChild(text);
    return button;
};