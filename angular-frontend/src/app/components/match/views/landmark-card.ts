import { Landmark } from 'shared/shared-types';
import { Assets, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { selectableCardStore } from 'src/app/state/interactive-logic';

export interface LandmarkCardArgs {
  landmark: Landmark;
}

// Renders a landmark card-like with optional highlight and detail-view support.
export class LandmarkCard extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private _landmark: Landmark | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  // Update the landmark sprite when the backing data changes.
  public set landmark(value: Landmark) {
    if (this._landmark?.cardKey === value.cardKey) return;

    this._landmark = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  // Builds the display objects for the landmark card.
  constructor({ landmark, ...args }: ContainerOptions & LandmarkCardArgs) {
    super({ ...args, id: landmark.id });
    this.addChild(this._highlight);
    this.addChild(this._cardSprite);
    this.landmark = landmark;

    const selectableCardSub = selectableCardStore.subscribe(() => this.draw());
    this.on('removed', () => {
      selectableCardSub();
    });
  }

  // Supports debug logging and right-click detail view.
  override onPointerdown(event: FederatedPointerEvent) {
    if (this._landmark) {
      if (event.ctrlKey) {
        console.debug(this._landmark);
        return;
      }

      if (event.button === 2) {
        void displayCardDetail(this._landmark);
        return;
      }
    }
  }

  // Draws selection highlights when the landmark is selectable.
  public draw() {
    this._highlight.clear();

    const selectableCards = selectableCardStore.get();
    if (this._landmark && selectableCards.includes(this._landmark.id)) {
      this._highlight
        .roundRect(-3, -3, this._cardSprite.width + 6, this._cardSprite.height + 6, 5)
        .fill(0xffaaaa);
    }
  }
}
