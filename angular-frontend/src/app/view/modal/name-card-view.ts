import { PlayerId, UserPromptKinds } from 'shared/shared-types';
import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { Input, List } from '@pixi/ui'
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../../core/app-contants';
import { SocketService } from '../../core/socket-service/socket.service';
import { createCardView } from '../../core/card/create-card-view';
import { compare } from 'fast-json-patch/';

export const nameCardView = (
  args: UserPromptKinds,
  socketService: SocketService,
  selfPlayerId: PlayerId,
) => {
  const inputBg = new Graphics();
  inputBg.roundRect(0, 0, 200, 50, 5);
  inputBg.fill('white');

  const input = new Input({
    bg: inputBg,
    addMask: true,
    padding: STANDARD_GAP,
    textStyle: {
      fill: 'black',
      fontSize: 24
    }
  });

  const cardList = new List({ type: 'horizontal', elementsMargin: STANDARD_GAP, padding: STANDARD_GAP });

  const c = new Container();
  c.addChild(cardList);

  input.y = cardList.y + CARD_HEIGHT + STANDARD_GAP;
  c.addChild(input);

  let inputChangeTimeout: any;
  const inputChangeSignal = input.onChange.connect(val => {
    clearTimeout(inputChangeTimeout);
    inputChangeTimeout = setTimeout(() => {
      socketService.emit('searchCards', selfPlayerId, val);
    }, 300);
  });

  let prev: any;
  socketService.on('searchCardResponse', async (data) => {
    if (!prev) {
      prev = data;
    } else {
      const changes = compare(prev,  data);
      if (!changes) return;
    }

    cardList.removeChildren();
    cardList.elementsMargin = data.length > 10 ? -CARD_WIDTH * .75 : STANDARD_GAP;

    for (const d of data) {
      try {
        const img = Sprite.from(await Assets.load(`${d.fullImagePath}`));
        cardList.addChild(img);
      }
      catch (err) {
        console.error(err);
      }
    }
  });

  c.on('removed', () => {
    c.removeAllListeners();
    inputChangeSignal.disconnect();
  });
  return c;
}
