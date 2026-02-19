import { Way } from 'shared/types';
import { Assets, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { selectableCardStore } from 'src/app/state/interactive-logic';

export interface WayCardArgs {
  way: Way;
}

// Renders a way landscape with optional highlight and detail-view support.
export class WayCard extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private _way: Way | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  // Update the way sprite when the backing data changes.
  public set way(value: Way) {
    if (this._way?.cardKey === value.cardKey) return;

    this._way = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  // Builds the display objects for the way card.
  constructor({ way, ...args }: ContainerOptions & WayCardArgs) {
    super({ ...args, id: way.id });
    this.addChild(this._highlight);
    this.addChild(this._cardSprite);
    this.way = way;

    const selectableCardSub = selectableCardStore.subscribe(() => this.draw());
    this.on('removed', () => {
      selectableCardSub();
    });
  }

  // Supports debug logging and right-click detail view.
  override onPointerdown(event: FederatedPointerEvent) {
    if (this._way) {
      if (event.ctrlKey) {
        console.debug(this._way);
        return;
      }

      if (event.button === 2) {
        void displayCardDetail(this._way);
        return;
      }
    }
  }

  // Draws selection highlights when the way is selectable.
  public draw() {
    this._highlight.clear();

    const selectableCards = selectableCardStore.get();
    if (this._way && selectableCards.includes(this._way.id)) {
      this._highlight
        .roundRect(-3, -3, this._cardSprite.width + 6, this._cardSprite.height + 6, 5)
        .fill(0xffaaaa);
    }
  }
}
