import { Container, FillInput, Graphics, Text, TextOptions } from 'pixi.js';
import { getPixiSceneTheme } from '../theme/pixi-theme';

export interface AppButton {
  button: Container;
  text: (val: string) => void;
}

export const createAppButton = (
  textOpts?: TextOptions,
  backgroundFill?: FillInput
) => {
  const pixiTheme = getPixiSceneTheme();
  const resolvedBackgroundFill: FillInput = backgroundFill ?? { color: pixiTheme.ui.buttonBackground, alpha: 1 };

  const button = new Container();
  button.eventMode = 'static';
  const text = new Text({
    ...textOpts,
    style: { fill: pixiTheme.ui.buttonText, ...textOpts?.style ?? {} },
    anchor: .5
  });

  const background = new Graphics();
  const drawBackground = () => {
    background
      .clear()
      .roundRect(0, 0, text.width + 20, text.height + 20, 5)
      .fill(resolvedBackgroundFill)
      .stroke({ color: pixiTheme.ui.buttonBorder, width: 1.5 });
  };

  background
    .roundRect(0, 0, text.width + 20, text.height + 20, 5);
  drawBackground();

  button.addChildAt(background, 0);

  text.x = button.width * .5;
  text.y = button.height * .5;
  button.addChild(text);
  return {
    button,
    text: (val: string) => {
      button.removeChild(text);
      text.text = val;
      drawBackground();
      text.x = button.width * .5;
      text.y = button.height * .5;
      button.addChild(text);
    }
  };
};
