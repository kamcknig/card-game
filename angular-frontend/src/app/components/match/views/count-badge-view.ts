import { Container, ContainerOptions, Graphics, Text } from 'pixi.js';

type Args = {
  count?: number
};

export class CountBadgeView extends Container {
  public set count(val: number) {
    (this.getChildByLabel('count') as Text).text = val;
  }

  constructor({ count, ...arg }: ContainerOptions & Args = { count: 0 }) {
    super(arg);

    const c = new Graphics()
      .roundRect(0, 0, 30, 26, 4)
      .fill(0x000000)
      .roundRect(2, 2, 26, 22, 4)
      .fill(0xFD5849);

    this.addChild(c);

    const l = new Text({
      label: 'count',
      text: count,
      style: {
        fontSize: 18,
      }
    });
    l.anchor.set(0.5);
    l.x = this.width * .5;
    l.y = this.height * .5;
    this.addChild(l);
  }
}
