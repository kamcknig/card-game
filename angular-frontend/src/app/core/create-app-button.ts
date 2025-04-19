import { Container, FillInput, Graphics, Text, TextOptions } from 'pixi.js';

export interface AppButton {
  button: Container;
  text: (val: string) => void;
}

export const createAppButton = (
  textOpts?: TextOptions,
  backgroundFill: FillInput = { color: 'black', alpha: .9 }
) => {
  const button = new Container();
  button.eventMode = 'static';
  const text = new Text({
    ...textOpts,
    style: { fill: 'white', ...textOpts?.style ?? {} },
    anchor: .5
  });

  const background = new Graphics();
  background
    .roundRect(0, 0, text.width + 20, text.height + 20, 5)
    .fill(backgroundFill)
    .stroke('white');

  button.addChildAt(background, 0);
  button.on('removed', () => {
    button.destroy();
  })

  text.x = button.width * .5;
  text.y = button.height * .5;
  button.addChild(text);
  return {
    button,
    text: (val: string) => {
      button.removeChild(text);
      text.text = val;
      background
        .clear()
        .roundRect(0, 0, text.width + 20, text.height + 20, 5)
        .fill({ color: 'black', alpha: .9 })
        .stroke('white');
      text.x = button.width * .5;
      text.y = button.height * .5;
      button.addChild(text);
    }
  };
};
