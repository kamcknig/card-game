import { Event } from 'shared/shared-types';
import { Assets, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { selectableCardStore } from 'src/app/state/interactive-logic';

export interface EventCardArgs {
  event: Event;
}

export class EventCard extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private _event: Event | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  public set event(value: Event) {
    if (this._event?.cardKey === value.cardKey) return;

    this._event = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  constructor({ event, ...args }: ContainerOptions & EventCardArgs) {
    super({ ...args, id: event.id });
    this.addChild(this._highlight);
    this.addChild(this._cardSprite);
    this.event = event;

    const selectableCardSub = selectableCardStore.subscribe(() => this.draw());
    this.on('removed', () => {
      selectableCardSub();
    });
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

  public draw() {
    this._highlight.clear();

    const selectableCards = selectableCardStore.get();
    if (this._event && selectableCards.includes(this._event.id)) {
      this._highlight
        .roundRect(-3, -3, this._cardSprite.width + 6, this._cardSprite.height + 6, 5)
        .fill(0xffaaaa);
    }
  }
}
