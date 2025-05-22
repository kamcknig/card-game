import { Assets, Container, ContainerOptions, Sprite, Texture } from 'pixi.js';
import { EventNoId } from 'shared/shared-types';

interface CardLikeViewOptions {
  event: EventNoId;
}

export class CardLikeView extends Container {
  private _event: EventNoId | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  public set event(value: EventNoId) {
    if (this._event?.cardKey === value.cardKey) return;

    this._event = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  constructor({ event, ...args }: ContainerOptions & CardLikeViewOptions) {
    super(args);
    this.event = event;

    this.addChild(this._cardSprite);
  }

  private draw() {

  }
}
