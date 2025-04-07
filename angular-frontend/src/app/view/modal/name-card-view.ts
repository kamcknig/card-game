import { PlayerId, UserPromptKinds } from 'shared/shared-types';
import { Container, Graphics } from 'pixi.js';
import { Input, List } from '@pixi/ui'
import { CARD_HEIGHT, STANDARD_GAP } from '../../core/app-contants';
import { SocketService } from '../../core/socket-service/socket.service';

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

  c.on('removed', () => {
    c.removeAllListeners();
    inputChangeSignal.disconnect();
  });
  return c;
}
