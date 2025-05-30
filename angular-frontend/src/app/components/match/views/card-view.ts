import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Card, CardFacing } from 'shared/shared-types';
import { batched } from 'nanostores';
import { CardSize } from '../../../../types';
import { selectableCardStore } from '../../../state/interactive-logic';
import { selectedCardStore } from '../../../state/interactive-state';
import { cardOverrideStore } from '../../../state/card-logic';

type CardArgs = Card;

type CardViewArgs = {
  size?: CardSize;
}

export class CardView extends Container {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private readonly _cardView: Sprite = new Sprite({ label: 'caredView' });
  private readonly _costView: Container = new Container({ label: 'costView' });
  private readonly _cleanup: (() => void)[] = [];

  private _frontImage: Texture;
  private _backImage: Texture;
  private _facing: CardFacing = 'back';
  private _size: CardSize = 'full';
  private _useHighlight: boolean = true;

  set useHighlight(val: boolean) {
    if (this._useHighlight === val) return;

    this._useHighlight = val;
    this.onDraw();
  }

  private _card: Card;

  public get card(): Card {
    return this._card;
  }

  public set card(value: Card) {
    this._card = value;
    this._frontImage = Assets.get(`${this._card.cardKey}-full`);

    if (!this._frontImage) {
      const size = ['full', 'half'].includes(this._size) ? `${this._size}-size` : 'detail';
      Assets.load(`/assets/card-images/${this._card.expansionName}/${size}/${this._card.cardKey}.jpg`).then(result => {
        this._frontImage = result;
        this._cardView.texture = this._facing === 'front' ? this._frontImage : this._backImage;
        this.onDraw();
      })
    }
    else {
      this.onDraw();
    }
  }

  public set facing(value: CardFacing) {
    this._facing = value;
    if ((value === 'front' && !this._frontImage) || (value === 'back' && !this._backImage)) return;
    this._cardView.texture = value === 'front' ? this._frontImage : this._backImage;
    this._facing = value;
    this.onDraw();
  }

  public get facing(): CardFacing {
    return this._facing;
  }

  public set size(value: CardSize) {
    this._size = value;
    this._frontImage = Assets.get(`${this._card.cardKey}-${value}`);
    this._backImage = Assets.get(`card-back-${value}`);
    this._cardView.texture = this._facing === 'front' ? this._frontImage : this._backImage;
    this._size = value;
    this.onDraw();
  }

  public get size(): CardSize {
    return this._size;
  }

  constructor({ size, ...card }: CardArgs & CardViewArgs) {
    super();

    this._card = card;

    this.label = `${this._card.cardKey}:${this._card.id}`;

    this.eventMode = 'static';

    this.addChild(this._highlight);
    this.addChild(this._cardView);

    this._frontImage = Assets.get(`${this._card.cardKey}-full`);
    this._backImage = Assets.get('card-back-full');
    this._backImage.label = 'backImageSprite';

    const costBgSprite = Sprite.from(Assets.get('treasure-bg'));
    const maxSide = 32;
    costBgSprite.scale = Math.min(maxSide / costBgSprite.width, maxSide / costBgSprite.height);
    this._costView.addChild(costBgSprite);

    const costText = new Text({
      label: 'costText',
      text: this._card.cost.treasure,
      style: {
        fill: 'black'
      },
      anchor: .5,
    });
    costText.x = Math.floor(costBgSprite.width * .5);
    costText.y = Math.floor(costBgSprite.height * .5);
    this._costView.addChild(costText);

    if ((card.cost?.potion ?? 0) > 0) {
      const potion = Sprite.from(Assets.get('potion-icon'));
      const maxSide = 32;
      potion.scale = Math.min(maxSide / potion.width, maxSide / potion.height);
      potion.x = costBgSprite.x + costBgSprite.width + 3;
      potion.y = Math.floor(costBgSprite.y + costBgSprite.height - potion.height);
      this._costView.addChild(potion);
    }

    this.addChild(this._costView);

    this.size = 'full'
    this.facing = 'front';

    this._cleanup.push(
      batched(
        [selectableCardStore, selectedCardStore, cardOverrideStore],
        (...args) => args
      ).subscribe(this.onDraw));

    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.removeAllListeners();
    this.destroy();
  }

  private onDraw = () => {
    const selected = selectedCardStore.get();
    const selectable = selectableCardStore.get().filter(s => !selected.includes(s));
    const overrides = cardOverrideStore.get();

    this._highlight.clear();

    if (this._useHighlight) {
      for (const cardId of selectable) {
        if (cardId === this._card.id) {
          this._highlight
            .roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5)
            .fill(0xffaaaa);
        }
      }

      for (const cardId of selected) {
        if (cardId === this._card.id) {
          this._highlight
            .roundRect(-3, -3, this._cardView.width + 6, this._cardView.height + 6, 5)
            .fill(0x6DFF8C);
        }
      }
    }

    const costText = this._costView.getChildByLabel('costText') as Text;
    if (costText) {
      costText.text = overrides?.[this._card.id]?.cost?.treasure ?? this._card.cost.treasure;
    }

    this._costView.x = 2;
    this._costView.y = this._cardView.y + this._cardView.height - this._costView.height - 5;
    this._costView.visible = this.facing === 'front';
  }
}
