import { Card, CardData, CardKey, PlayerId, UserPromptKinds } from 'shared/shared-types';
import { Application, Assets, Color, Container, Graphics, Point, Sprite } from 'pixi.js';
import { Input, List } from '@pixi/ui'
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../../core/app-contants';
import { SocketService } from '../../core/socket-service/socket.service';
import { compare } from 'fast-json-patch/';
import { displayCardDetail } from './display-card-detail';

export const nameCardView = (
  app: Application,
  args: UserPromptKinds,
  socketService: SocketService,
  selfPlayerId: PlayerId,
) => {
  const inputBg = new Graphics();
  inputBg.roundRect(0, 0, 200, 50, 5);
  inputBg.fill('white');

  const cardListWidth = 1100;

  const input = new Input({
    bg: inputBg,
    addMask: true,
    padding: STANDARD_GAP,
    textStyle: {
      fill: 'black',
      fontSize: 24
    }
  });

  const cardListMask = new Graphics();
  cardListMask.x = STANDARD_GAP;
  cardListMask.rect(0, -60, cardListWidth, CARD_HEIGHT + 60);
  cardListMask.fill('black');

  const cardListContainer = new Container();

  const cardListContainerBg = new Graphics();
  cardListContainerBg.rect(0, 0, cardListWidth + STANDARD_GAP * 2, CARD_HEIGHT + STANDARD_GAP * 2);
  cardListContainerBg.fill(new Color('0x00000000'));

  const cardList = new List({
    type: 'horizontal',
    elementsMargin: STANDARD_GAP
  });
  cardList.x = STANDARD_GAP;
  cardList.y = STANDARD_GAP * 3;
  cardList.mask = cardListMask;

  cardListContainer.addChild(cardListContainerBg);
  cardListContainer.addChild(cardList);
  cardListContainer.addChild(cardListMask);

  input.y = cardList.y + CARD_HEIGHT + STANDARD_GAP * 2;
  input.x = Math.floor(cardListWidth * .5 - input.width * .5);

  const c = new Container();
  c.addChild(cardListContainer);
  c.addChild(input);

  let inputChangeTimeout: any;
  const inputChangeSignal = input.onChange.connect(val => {
    clearTimeout(inputChangeTimeout);
    inputChangeTimeout = setTimeout(() => {
      socketService.emit('searchCards', selfPlayerId, val);
    }, 300);
  });

  let cardMap = new Map();
  const onCardPointerDown = (event: PointerEvent) => {
    const cardData = cardMap.get(event.target);

    if (event.button === 2) {
      void displayCardDetail(app, cardData);
      return
    }

    c.emit('resultsUpdated', cardData.cardKey);
    c.emit('finished');
  }

  const onCardHover = (event: PointerEvent) => {
    const s = event.target as Sprite;
    s.y = -60;
  };

  const onCardHoverOut = (event: PointerEvent) => {
    const s = event.target as Sprite;
    s.y = 0;
  };

  let prev: any;
  const searchResponse = async (data: (CardData & { cardKey: CardKey })[]) => {
    if (!prev) {
      prev = data;
    } else {
      const changes = compare(prev, data);
      if (!changes) return;
    }

    cardMap.clear();
    cardList.removeChildren();
    cardList.elementsMargin = data.length > 10 ? -CARD_WIDTH * .65 : STANDARD_GAP;
    cardList.x = 0;

    for (const d of data) {
      try {
        const img = await Assets.load(`${d.fullImagePath}`);
        const s = Sprite.from(img);
        cardMap.set(s, d);
        s.eventMode = 'static';
        s.on('pointerdown', onCardPointerDown);
        s.on('pointerover', onCardHover);
        s.on('pointerout', onCardHoverOut)
        s.on('removed', () => s.removeAllListeners());
        img.anchor = new Point(0, 0);
        cardList.addChild(s);
      } catch (err) {
        console.error(err);
      }
    }
  };

  socketService.on('searchCardResponse', searchResponse);

  cardListContainer.eventMode = 'static';
  cardListContainer.on('wheel', wheelEvent => {
    cardList.mask = null;
    let newX = cardList.x + (wheelEvent.deltaY * -.25);

    if (wheelEvent.deltaY < 0) {
      newX = Math.min(newX, 0);
    } else {
      newX = Math.max(newX, (cardList.width - cardListWidth) * -1);
    }
    cardList.x = newX;
    cardList.mask = cardListMask;
  });

  c.on('removed', () => {
    cardListContainer.off('wheel');
    socketService.off('searchCardResponse', searchResponse);
    c.removeAllListeners();
    inputChangeSignal.disconnect();
  });

  return c;
}
