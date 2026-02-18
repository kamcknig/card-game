import { Container, Graphics } from 'pixi.js';
import { Slider } from '@pixi/ui';
import { UserPromptKinds } from 'shared/types';
import { STANDARD_GAP } from '../../../../core/app-contants';
import { getPixiSceneTheme } from '../../../../theme/pixi-theme';

export const cardBlindRearrangeView = (args: UserPromptKinds) => {
  const pixiTheme = getPixiSceneTheme();
  if (args.type !== 'blind-rearrange') {
    throw new Error('Card action type is not blind-rearrange');
  }
  if (!args.cardIds) throw new Error('Cards cannot be empty');
  const cardIds = args.cardIds;
  const count = cardIds.length;
  const sliderWidth = Math.min(700, Math.max(300, Math.ceil(count / 10) * 100));
  const container = new Container();

  const bg = new Graphics();
  bg.rect(0, 0, sliderWidth + STANDARD_GAP * 2, 50);
  bg.fill({
    color: pixiTheme.ui.panelBackground,
    alpha: 0
  });

  const sliderBg = new Graphics();
  sliderBg.roundRect(0, 0, sliderWidth, 4, 2);
  sliderBg.fill({ color: pixiTheme.ui.panelBorder });

  const sliderFill = new Graphics();
  sliderFill.roundRect(0, 0, sliderWidth, 4, 2);
  sliderFill.fill({ color: pixiTheme.ui.accent });

  const sliderGraphics = new Graphics();
  sliderGraphics.circle(0, 0, 15);
  sliderGraphics.fill({ color: pixiTheme.ui.buttonBackground });
  sliderGraphics.stroke({ color: pixiTheme.ui.buttonBorder, width: 1.5 });

  const slider = new Slider({
    min: 0,
    max: count,
    value: Math.floor(count * .5) ,
    showValue: true,
    step: 1,
    valueTextStyle: {
      fill: pixiTheme.ui.inputText,
      fontSize: 20,
    },
    bg: sliderBg,
    fill: sliderFill,
    slider: sliderGraphics
  });

  slider.x = Math.floor(bg.width * .5 - slider.width * .5);
  slider.y = Math.floor(bg.height * .5);

  container.addChild(bg);
  container.addChild(slider);
  const sliderOnUpdate = slider.onUpdate.connect(val => container.emit('resultsUpdated', val));

  container.on('removed', () => {
    container.removeAllListeners();
    sliderOnUpdate.disconnect();
  });
  return container;
}
