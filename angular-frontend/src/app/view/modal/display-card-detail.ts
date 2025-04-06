import {Container, Graphics} from 'pixi.js';
import {cardStore} from '../../state/card-state';
import {createCardView} from '../../core/card/create-card-view';
export const displayCardDetail = (cardId: number, stage: Container): void => {
    const container = new Container();
    container.eventMode = 'static';
    const card = cardStore.get()[cardId];
    const view = createCardView(card);
    view.size = 'detail';
    view.facing = 'front'

    view.eventMode = 'none';

    const background = new Graphics()
        .rect(0, 0, stage.width, stage.height)
        .fill({
            color: 'black',
            alpha: .6,
        });

    container.addChild(background);
    view.x = Math.floor(stage.width * .5 - view.width * .5);
    view.y = Math.floor(stage.height * .5 - view.height * .5);
    container.addChild(view);
    stage.addChild(container);

    const onPointerDown = () => {
        stage.removeChild(container);
    };
    const onRemoved = () => {
        container.off('pointerdown', onPointerDown);
        container.off('removed', onRemoved);
    }

    container.on('pointerdown', onPointerDown);
    container.on('removed', onRemoved)
}
