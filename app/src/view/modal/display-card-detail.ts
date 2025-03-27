import {Container, Graphics} from 'pixi.js';
import {$cardsById} from '../../state/card-state';
import {createCardView} from '../../core/card/create-card-view';
import {app} from '../../core/create-app';

export const displayCardDetail = (cardId: number): void => {
    const container = new Container();
    container.eventMode = 'static';
    const card = $cardsById.get()[cardId];
    const view = createCardView(card);
    view.size = 'full';
    view.scale = 2;
    view.eventMode = 'none';

    const background = new Graphics()
        .rect(0, 0, app.renderer.width, app.renderer.height)
        .fill({
            color: 'black',
            alpha: .6,
        });

    container.addChild(background);
    view.x = Math.floor(app.renderer.width * .5 - view.width * .5);
    view.y = Math.floor(app.renderer.height * .5 - view.height * .5);
    container.addChild(view);
    app.stage.addChild(container);

    const onPointerDown = () => {
        app.stage.removeChild(container);
    };
    const onRemoved = () => {
        container.off('pointerdown', onPointerDown);
        container.off('removed', onRemoved);
    }
    
    container.on('pointerdown', onPointerDown);
    container.on('removed', onRemoved)
}