import { Prophecy, TokenInstance } from 'shared/types';
import { Assets, Container, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { selectableCardStore } from 'src/app/state/interactive-logic';
import { matchStore } from '../../../state/match-state';

export interface ProphecyCardArgs {
  prophecy: Prophecy;
}

const sunTokenId = 'rising-sun:sun';

// Renders a prophecy landscape with optional highlight and Sun-token count overlay.
export class ProphecyCard extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private readonly _tokenContainer: Container = new Container({ label: 'tokenContainer' });
  private _prophecy: Prophecy | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  // Update the prophecy sprite when the backing data changes.
  public set prophecy(value: Prophecy) {
    if (this._prophecy?.cardKey === value.cardKey) return;

    this._prophecy = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  // Builds the display objects for the prophecy card.
  constructor({ prophecy, ...args }: ContainerOptions & ProphecyCardArgs) {
    super({ ...args, id: prophecy.id });
    this.addChild(this._highlight);
    this.addChild(this._cardSprite);
    this.addChild(this._tokenContainer);
    this.prophecy = prophecy;

    const selectableCardSub = selectableCardStore.subscribe(() => this.draw());
    const matchSub = matchStore.subscribe(() => this.draw());
    this.on('removed', () => {
      selectableCardSub();
      matchSub();
    });
  }

  // Supports debug logging and right-click detail view.
  override onPointerdown(event: FederatedPointerEvent) {
    if (this._prophecy) {
      if (event.ctrlKey) {
        console.debug(this._prophecy);
        return;
      }

      if (event.button === 2) {
        void displayCardDetail(this._prophecy);
        return;
      }
    }
  }

  // Draws selection highlights and updates Sun token overlays.
  public draw() {
    this._highlight.clear();

    const selectableCards = selectableCardStore.get();
    if (this._prophecy && selectableCards.includes(this._prophecy.id)) {
      this._highlight
        .roundRect(-3, -3, this._cardSprite.width + 6, this._cardSprite.height + 6, 5)
        .fill(0xffaaaa);
    }

    if (this._prophecy) {
      this.drawSunTokenCount(this._prophecy);
    }
  }

  // Draws the Sun token icon with centered count on top of the prophecy image.
  private drawSunTokenCount(prophecy: Prophecy): void {
    this._tokenContainer.removeChildren();

    const match = matchStore.get();
    if (!match) return;

    const sunTokenCount = (Object.values(match.tokens ?? {}) as TokenInstance[])
      .filter((token) =>
        token.tokenId === sunTokenId
        && token.location.type === 'cardLike'
        && token.location.cardLikeId === prophecy.id
      )
      .reduce((total, token) => total + (token.counters && token.counters > 0 ? token.counters : 1), 0);

    if (sunTokenCount < 1) {
      return;
    }

    const iconTexture = Assets.get('sun-token-icon');
    if (!iconTexture) {
      return;
    }

    const icon = Sprite.from(iconTexture);
    const maxSide = 56;
    icon.scale = Math.min(maxSide / icon.width, maxSide / icon.height);
    icon.x = this._cardSprite.width - icon.width - 8;
    icon.y = 8;
    this._tokenContainer.addChild(icon);

    const countText = new Text({
      text: sunTokenCount,
      style: {
        fill: '#1f1400',
        fontSize: 22,
        fontWeight: '700',
      },
      anchor: 0.5,
    });
    countText.x = icon.x + icon.width * 0.5;
    countText.y = icon.y + icon.height * 0.5;
    this._tokenContainer.addChild(countText);
  }
}
