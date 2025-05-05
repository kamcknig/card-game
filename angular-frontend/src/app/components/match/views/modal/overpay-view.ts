import { Application, Container, Graphics, Text } from 'pixi.js';
import { cofferStore } from '../../../../state/resource-logic';
import { currentPlayerStore, playerTreasureStore } from '../../../../state/turn-state';
import { computed } from 'nanostores';
import { Slider } from '@pixi/ui';
import { UserPromptKinds } from 'shared/shared-types';
import { STANDARD_GAP } from '../../../../core/app-contants';

export const overpayView = (app: Application, args: UserPromptKinds) => {
  if (args.type !== 'overpay') throw new Error(`overpay view requires type 'overpay'`);

  const store = computed(
    [currentPlayerStore, cofferStore, playerTreasureStore],
    (currentPlayer, coffers, playerTreasure) => ({ currentPlayer, coffers, playerTreasure })
  );

  const overpayContainer = new Container();
  const count = 0;
  const sliderWidth = Math.min(700, Math.max(300, Math.ceil(count / 10) * 100));
  const sliderBg = new Graphics();

  sliderBg.roundRect(0, 0, sliderWidth, 4, 2);
  sliderBg.fill('white');

  const sliderFill = new Graphics();
  sliderFill.roundRect(0, 0, sliderWidth, 4, 2);
  sliderFill.fill('white');

  const sliderGraphics = new Graphics();
  sliderGraphics.circle(0, 0, 15);
  sliderGraphics.fill('white');

  const slider = new Slider({
    min: 0,
    max: count,
    value: Math.floor(count * .5),
    showValue: true,
    step: 1,
    valueTextStyle: {
      fill: 'black',
      fontSize: 20,
    },
    bg: sliderBg,
    fill: sliderFill,
    slider: sliderGraphics
  });

  const textGroup = new Container({label: 'textGroup'});
  textGroup.y = slider.y + slider.height + STANDARD_GAP * 2;
  textGroup.x = Math.floor(slider.x + slider.width * .5);

  const treasureOverpayText = new Text({
    text: `Treasure: ${0}`,
    style: {
      fill: 'white',
      fontSize: 24,
    }
  });
  textGroup.addChild(treasureOverpayText);
  treasureOverpayText.visible = false;

  const coffersOverpayText = new Text({
    text: `Coffers: ${0}`,
    style: {
      fill: 'white',
      fontSize: 24,
    }
  });
  textGroup.addChild(coffersOverpayText);
  coffersOverpayText.visible = false;

  const updateSliderMax = ({ currentPlayer, coffers, playerTreasure }: ReturnType<typeof store.get>) => {
    slider.max = playerTreasure + (coffers[currentPlayer.id] ?? 0) - args.cost;

    updateAmountOverpayText(Math.min(slider.value, playerTreasure), slider.value > playerTreasure ? slider.value - playerTreasure : 0);
  }

  const updateAmountOverpayText = (treasure: number, coffers: number) => {
    treasureOverpayText.text = `Treasure: ${treasure}`;
    treasureOverpayText.visible = treasure >= 0;
    coffersOverpayText.text = `Coffers: ${coffers}`;
    coffersOverpayText.visible = coffers > 0;

    if (treasure >= 0 && coffers > 0) {
      treasureOverpayText.x = Math.floor(-treasureOverpayText.width - STANDARD_GAP * .5);
      coffersOverpayText.x = Math.floor(STANDARD_GAP * .5);
    } else if (treasure >= 0) {
      treasureOverpayText.x = Math.floor(-treasureOverpayText.width * .5);
    } else if (coffers > 0) {
      coffersOverpayText.x = Math.floor(-coffersOverpayText.width * .5);
    }
  }

  const storeUnsub = store.subscribe(val => updateSliderMax(val));
  const sliderOnUpdate = slider.onUpdate.connect(val => {
    const playerTreasure = playerTreasureStore.get();
    updateAmountOverpayText(Math.min(val, playerTreasure), val > playerTreasure ? val - playerTreasure : 0);
    overpayContainer.emit('resultsUpdated', val);
  });

  setTimeout(() => updateAmountOverpayText(0, 0));

  overpayContainer.addChild(slider);
  overpayContainer.addChild(textGroup);

  overpayContainer.on('removed', () => {
    storeUnsub();
    overpayContainer.off('removed');
    overpayContainer.destroy();
    sliderOnUpdate.disconnect();
  });

  return overpayContainer;
}
