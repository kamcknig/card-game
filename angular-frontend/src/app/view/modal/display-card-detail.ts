import { Container, Graphics } from 'pixi.js';
import { cardStore } from '../../state/card-state';
import { createCardView } from '../../core/card/create-card-view';
import { inject } from '@angular/core';
import { PIXI_APP } from '../../core/pixi-application.token';

export const displayCardDetail = (cardId: number): void => {
  const app = inject(PIXI_APP);
  const container = new Container();
  container.eventMode = 'static';
  const card = cardStore.get()[cardId];
  const view = createCardView(card);
  view.size = 'detail';
  view.facing = 'front'

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
