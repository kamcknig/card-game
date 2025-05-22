import { EventNoId } from 'shared/shared-types';
import { Assets, ContainerOptions, FederatedPointerEvent, Sprite, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';

export interface EventCardArgs {
  event: EventNoId;
}

export class EventCard extends CardLikeView {
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
  }

  constructor({ event, ...args }: ContainerOptions & EventCardArgs) {
    super(args);
    this.event = event;
    this.addChild(this._cardSprite);
  }

  override onPointerdown(event: FederatedPointerEvent) {
    if (this._event) {
      if (event.ctrlKey) {
        console.log(this._event);
        return;
      }

      if (event.button === 2) {
        void displayCardDetail(this._event);
        return;
      }
    }
  }
}
