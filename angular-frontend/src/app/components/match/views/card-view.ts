import { Assets, Container, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Card, CardFacing } from 'shared/shared-types';
import { batched } from 'nanostores';
import { CardSize } from '../../../../types';
import { selectableCardStore } from '../../../state/interactive-logic';
import { selectedCardStore } from '../../../state/interactive-state';
import { cardOverrideStore } from '../../../state/card-logic';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { TokenBadgeView } from './token-badge-view';

type TokenBadgeData = {
  id: string;
  label: string;
  color: number;
};

type CardArgs = {
  card: Card;
};

type CardViewArgs = {
  size?: CardSize;
}

export class CardView extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private readonly _cardView: Sprite = new Sprite({ label: 'caredView' });
  private readonly _costView: Container = new Container({ label: 'costView' });
  // Token container sits above the card image for badge overlays.
  private readonly _tokenContainer: Container = new Container({ label: 'tokenContainer' });
  private readonly _cleanup: (() => void)[] = [];

  private _frontImage: Texture;
  private _backImage: Texture;
  private _facing: CardFacing = 'back';
  private _size: CardSize = 'full';
  private _useHighlight: boolean = true;
  // Token badges to render on this card view.
  private _tokenBadges: TokenBadgeData[] = [];

  // Updates the tokens rendered on top of the card view.
  set tokenBadges(val: TokenBadgeData[]) {
    this._tokenBadges = [...val];
    this.drawTokenBadges();
  }

  set useHighlight(val: boolean) {
    if (this._useHighlight === val) return;

    this._useHighlight = val;
    this.draw();
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
        this.draw();
      })
    }
    else {
      this.draw();
    }
  }

  public set facing(value: CardFacing) {
    this._facing = value;
    if ((value === 'front' && !this._frontImage) || (value === 'back' && !this._backImage)) return;
    this._cardView.texture = value === 'front' ? this._frontImage : this._backImage;
    this._facing = value;
    this.draw();
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
    this.draw();
  }

  public get size(): CardSize {
    return this._size;
  }

  constructor({ size, card, ...args }: ContainerOptions & CardArgs & CardViewArgs) {
    super({ ...args, id: card.id });

    this._card = card;

    this.label = `${this._card.cardKey}:${this._card.id}`;

    this.eventMode = 'static';

    this.addChild(this._highlight);
    this.addChild(this._cardView);
    this.addChild(this._tokenContainer);

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

    // Track the next cost element position as we add potion/debt icons.
    let nextCostX = costBgSprite.x + costBgSprite.width + 3;

    if ((card.cost?.potion ?? 0) > 0) {
      const potion = Sprite.from(Assets.get('potion-icon'));
      const maxSide = 32;
      potion.scale = Math.min(maxSide / potion.width, maxSide / potion.height);
      potion.x = nextCostX;
      potion.y = Math.floor(costBgSprite.y + costBgSprite.height - potion.height);
      this._costView.addChild(potion);
      nextCostX = potion.x + potion.width + 3;
    }

    // Render debt costs using the debt icon and an overlaid count.
    if ((card.cost?.debt ?? 0) > 0) {
      const debt = Sprite.from(Assets.get('debt-icon'));
      const maxSide = 32;
      debt.scale = Math.min(maxSide / debt.width, maxSide / debt.height);
      debt.x = nextCostX;
      debt.y = Math.floor(costBgSprite.y + costBgSprite.height - debt.height);
      this._costView.addChild(debt);

      const debtText = new Text({
        label: 'debtText',
        text: card.cost.debt,
        style: {
          fill: 'black'
        },
        anchor: .5,
      });
      debtText.x = Math.floor(debt.x + debt.width * .5);
      debtText.y = Math.floor(debt.y + debt.height * .5);
      this._costView.addChild(debtText);
    }

    this.addChild(this._costView);

    this.size = 'full'
    this.facing = this._card.facing ?? 'front';

    this._cleanup.push(
      batched(
        [selectableCardStore, selectedCardStore, cardOverrideStore],
        (...args) => args
      ).subscribe(this.draw));

    const selectableSub =   selectableCardStore.subscribe(selectableCards => {
      this.cursor = selectableCards.includes(this._card.id) ? 'pointer' : 'default';
    });

    this.on('removed', () => {
      selectableSub();
      this._cleanup.forEach(cb => cb());
      this.removeAllListeners();
      this.destroy();
    });
  }

  public draw = () => {
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
    // Update debt text if present in the cost view.
    const debtText = this._costView.getChildByLabel('debtText') as Text;
    if (debtText) {
      debtText.text = overrides?.[this._card.id]?.cost?.debt ?? this._card.cost.debt ?? 0;
    }

    this._costView.x = 2;
    this._costView.y = this._cardView.y + this._cardView.height - this._costView.height - 5;
    this._costView.visible = this.facing === 'front';

    this.drawTokenBadges();
  }

  // Renders token badges in the top-right corner of the card.
  private drawTokenBadges() {
    const tokenSize = this._size === 'half' ? 25 : 35;
    const gap = 2;
    const baseX = (this._cardView.width || 0) - tokenSize - 4;
    const baseY = 4;

    const orderedBadges = [...this._tokenBadges].sort((a, b) => a.id.localeCompare(b.id));
    const existing = new Set(orderedBadges.map(badge => `token:${badge.id}`));

    // Remove any badges that are no longer present.
    for (const child of [...this._tokenContainer.children]) {
      if (!existing.has(child.label ?? '')) {
        child.removeFromParent();
      }
    }

    orderedBadges.forEach((badge, idx) => {
      const label = `token:${badge.id}`;
      let view = this._tokenContainer.getChildByLabel(label) as TokenBadgeView;
      if (!view) {
        view = new TokenBadgeView({ size: tokenSize, labelText: badge.label, color: badge.color });
        view.label = label;
        this._tokenContainer.addChild(view);
      }
      else {
        view.labelText = badge.label;
        view.color = badge.color;
      }
      view.x = baseX;
      view.y = baseY + idx * (tokenSize + gap);
    });
  }

  onPointerdown(event: FederatedPointerEvent): void {
    if (event.ctrlKey) {
      console.log(this.card);
      return;
    }

    if (event.button === 2 && this.facing === 'front') {
      void displayCardDetail(this.card);
      return;
    }
  }
}
