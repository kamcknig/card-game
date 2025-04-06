import {trashStore} from '../../state/match-state';
import {Color, Container, Graphics} from 'pixi.js';
import {ScrollBox} from '@pixi/ui';
import {CARD_HEIGHT, STANDARD_GAP} from '../../core/app-contants';
import {cardStore} from '../../state/card-state';
import {createCardView} from '../../core/card/create-card-view';

export const displayTrash = (stage: Container) => {
    const cards = trashStore.get();

    const c = new Container();
    c.eventMode = 'static';
    const bg = c.addChild(new Graphics());
    bg.rect(0, 0, stage.width, stage.height).fill({ color: 'black', alpha: .6});
    c.addChild(bg);

    const scrollBox = new ScrollBox({
        background: new Color('0x00000000'),
        width: 800,
        height: CARD_HEIGHT + STANDARD_GAP * 2
    });
    scrollBox.x = Math.floor(stage.width * .5 - scrollBox.width * .5);
    scrollBox.y = Math.floor(stage.height * .5 - scrollBox.height * .5);
    c.addChild(scrollBox);

    const cardsById = cardStore.get();
    for(const cardId of cards) {
        const card = cardsById[cardId];
        const view = createCardView(card);
        view.size = 'full';
        scrollBox.addItem(view);
    }

    const onPointerDown = () => {
        stage.removeChild(c);
    };
    const onRemoved = () => {
        c.off('pointerdown', onPointerDown);
        c.off('removed', onRemoved);
    }

    c.on('pointerdown', onPointerDown);
    c.on('removed', onRemoved);

    stage.addChild(c);
}
