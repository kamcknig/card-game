import {$trashStore} from '../../state/match-state';
import {Color, Container, Graphics} from 'pixi.js';
import {app} from '../../core/create-app';
import {ScrollBox} from '@pixi/ui';
import {CARD_HEIGHT, STANDARD_GAP} from '../../app-contants';
import {$cardsById} from '../../state/card-state';
import {createCardView} from '../../core/card/create-card-view';

export const displayTrash = () => {
    const cards = $trashStore.get();

    const c = new Container();
    c.eventMode = 'static';
    const bg = c.addChild(new Graphics());
    bg.rect(0, 0, app.renderer.width, app.renderer.height).fill({ color: 'black', alpha: .6});
    c.addChild(bg);

    const scrollBox = new ScrollBox({
        background: new Color('0x00000000'),
        width: 800,
        height: CARD_HEIGHT + STANDARD_GAP * 2
    });
    scrollBox.x = Math.floor(app.renderer.width * .5 - scrollBox.width * .5);
    scrollBox.y = Math.floor(app.renderer.height * .5 - scrollBox.height * .5);
    c.addChild(scrollBox);

    const cardsById = $cardsById.get();
    for(const cardId of cards) {
        const card = cardsById[cardId];
        const view = createCardView(card);
        view.size = 'full';
        scrollBox.addItem(view);
    }

    c.on('pointerdown', () => {
        c.removeAllListeners();
        app.stage.removeChild(c);
    });

    app.stage.addChild(c);
}