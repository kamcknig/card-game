import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { cardStore } from '../../../../state/card-state';
import { Card, CardData } from 'shared/shared-types';

export async function displayCardDetail(app: Application, arg: number | Card | CardData) {
  let cardImg: Texture;
  if (typeof arg === 'number') {
    cardImg = await Assets.load(cardStore.get()[arg].detailImagePath);
  }
  else {
    cardImg = await Assets.load(arg.detailImagePath);
  }

  const s = Sprite.from(cardImg);
  const container = new Container();
  container.eventMode = 'static';

  const background = new Graphics()
    .rect(0, 0, app.renderer.width, app.renderer.height)
    .fill({
      color: 'black',
      alpha: .6,
    });

  container.addChild(background);
  s.x = Math.floor(app.renderer.width * .5 - s.width * .5);
  s.y = Math.floor(app.renderer.height * .5 - s.height * .5);
  container.addChild(s);
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
