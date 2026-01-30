import { Container, Graphics, Text } from 'pixi.js';

type TokenBadgeArgs = {
  size: number;
  labelText: string;
  color: number;
};

export class TokenBadgeView extends Container {
  private _size: number;
  private _labelText: string;
  private _color: number;
  private readonly _bg: Graphics;
  private readonly _text: Text;
  
  // Updates the label text displayed on the token badge.
  set labelText(val: string) {
    this._labelText = val;
    this._text.text = val;
  }
  
  // Updates the fill color of the token badge.
  set color(val: number) {
    this._color = val;
    this.draw();
  }
  
  constructor(args: TokenBadgeArgs) {
    super();

    this._size = args.size;
    this._labelText = args.labelText;
    this._color = args.color;
    
    this._bg = new Graphics();
    this.addChild(this._bg);
    
    this._text = new Text({
      text: this._labelText,
      style: {
        fill: 'black',
        fontSize: Math.max(10, Math.floor(this._size * 0.40)),
      }
    });
    this._text.anchor.set(0.5);
    this.addChild(this._text);
    
    this.draw();
  }
  
  // Draws the badge background and positions the label.
  private draw() {
    const radius = this._size / 2;
    const border = 2;
    
    this._bg.clear()
      .circle(radius, radius, radius)
      .fill(0x000000)
      .circle(radius, radius, radius - border)
      .fill(this._color);
    
    this._text.x = radius;
    this._text.y = radius;
  }
}
