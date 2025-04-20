import { Application, Color, Container, Graphics } from 'pixi.js';
import { ScrollBox } from '@pixi/ui';
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../../../../core/app-contants';
import { cardStore } from '../../../../state/card-state';
import { createCardView } from '../../../../core/card/create-card-view';
import { trashStore } from '../../../../state/match-logic';

export const displayTrash = (app: Application) => {
  const cards = trashStore.get();

  const c = new Container();
  c.eventMode = 'static';
  const bg = c.addChild(new Graphics());
  bg.rect(0, 0, app.renderer.width, app.renderer.height).fill({ color: 'black', alpha: .6 });
  c.addChild(bg);

  const scrollBox = new ScrollBox({
    background: new Color('0x000000cc'),
    width: CARD_WIDTH * 5 + STANDARD_GAP * 6,
    height: CARD_HEIGHT * 2.5 + STANDARD_GAP * 2,
    padding: STANDARD_GAP,
    elementsMargin: STANDARD_GAP
  });
  scrollBox.x = Math.floor(app.renderer.width * .5 - scrollBox.width * .5);
  scrollBox.y = Math.floor(app.renderer.height * .5 - scrollBox.height * .5);
  c.addChild(scrollBox);

  const cardsById = cardStore.get();
  for (const cardId of cards) {
    const card = cardsById[cardId];
    const view = createCardView(card);
    view.size = 'full';
    scrollBox.addItem(view);
  }

  const onPointerDown = () => {
    app.stage.removeChild(c);
  };
  const onRemoved = () => {
    c.off('pointerdown', onPointerDown);
    c.off('removed', onRemoved);
  }

  c.on('pointerdown', onPointerDown);
  c.on('removed', onRemoved);

  app.stage.addChild(c);
}
