import { Container, Graphics, Text } from 'pixi.js';
import { CountBadgeView } from './count-badge-view';
import { createCardView } from '../../../core/card/create-card-view';
import { cardStore } from '../../../state/card-state';
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { ReadableAtom } from 'nanostores';
import { isUndefined } from 'es-toolkit';
import { CardView } from './card-view';
import { selectedCardStore } from '../../../state/interactive-state';

export type CardStackArgs = {
  label?: string;
  $cardIds: ReadableAtom<number[]>;
  showCountBadge?: boolean;
  alwaysShowCountBadge?: boolean;
  cardFacing: CardView['facing'];
  showBackground?: boolean;
  scale?: number;
}

export class CardStackView extends Container {
  private readonly _$cardIds: ReadableAtom<number[]>;
  private readonly _background: Container = new Container();
  private readonly _cardContainer: Container<CardView> = new Container({ x: STANDARD_GAP * .8, y: STANDARD_GAP * .8 });
  private readonly _cleanup: (() => void)[] = [];
  private readonly _showCountBadge: boolean = true;
  private readonly _label: string | undefined;
  private readonly _labelText: Text | undefined;
  private readonly _cardFacing: CardView['facing'];
  private readonly _selectedBadgeCount: CountBadgeView = new CountBadgeView({ label: 'selectedBadgeCount' });
  private readonly _badgeCount: CountBadgeView = new CountBadgeView({ label: 'badgeCount' });
  private readonly _sscale: number;
  private readonly _alwaysShowCountBadge?: boolean;

  private readonly _showBackground: boolean;

  constructor(args: CardStackArgs) {
    super();

    const {
      showCountBadge,
      label,
      cardFacing,
      showBackground,
      $cardIds,
      scale = 1,
      alwaysShowCountBadge
    } = args;
    this._cardFacing = cardFacing;
    this._showCountBadge = showCountBadge ?? true;
    this._label = label;
    this._showBackground = showBackground ?? true;
    this._$cardIds = $cardIds;
    this._sscale = scale;
    this._alwaysShowCountBadge = alwaysShowCountBadge ?? false;

    if (this._showBackground) {
      this._background.addChild(new Graphics({ label: 'graphics' }));
      this.addChild(this._background);
    }

    if (!isUndefined(this._label)) {
      this._labelText = new Text({
        x: this._showBackground ? STANDARD_GAP : 0,
        y: this._showBackground ? STANDARD_GAP : 0,
        text: this._label,
        style: {
          fontSize: 14,
          fill: 'white'
        }
      });
      this.addChild(this._labelText);
    }

    this._cardContainer.x = STANDARD_GAP * this._sscale;
    this._cardContainer.y = STANDARD_GAP;

    if (this._labelText) {
      this._cardContainer.y = this._labelText.y + this._labelText.height + STANDARD_GAP * this._sscale;
    }

    this.addChild(this._cardContainer);

    this._cleanup.push(this._$cardIds.subscribe(this.drawDeck));
    this._cleanup.push(selectedCardStore.subscribe(this.onSelectedCardsUpdated));

    if (this._showCountBadge) {
      this._cleanup.push(this._$cardIds.subscribe(this.updateBadgeCount));
      this._cleanup.push(selectedCardStore.subscribe(this.updateBadgeCount));
    }

    this.on('removed', this.onRemoved);

    this.eventMode = 'static';

    this.on('pointerdown', (event) => {
      if (event.ctrlKey) {
        console.log(this._$cardIds.get().map(cId => cardStore.get()[cId]));
      }
    });
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.removeAllListeners();
    this.destroy();
  }

  private onSelectedCardsUpdated = (selectedCardIds: readonly number[] = []) => {
    const sortedCardViews = this._cardContainer.children.sort(
      (a, b) => selectedCardIds.includes(a.card.id) ? -1 : selectedCardIds.includes(b.card.id) ? 1 : 0
    );

    for (const [idx, cardView] of sortedCardViews.entries()) {
      this._cardContainer.addChildAt(cardView, idx);
      const card = cardView.card;
      if (selectedCardIds.includes(card.id)) {
        cardView.y = -60;
      } else {
        cardView.y = 0;
      }
      cardView.y *= this._sscale;
    }
  }

  private drawDeck = (cardIds: readonly number[]) => {
    this._cardContainer.removeChildren();

    for (const cardId of cardIds) {
      const c = this._cardContainer.addChild(createCardView(cardStore.get()[cardId]));
      c.size = 'full';
      c.facing = this._cardFacing;
      c.scale = this._sscale;
    }

    if (this._showBackground) {
      const g = this._background.getChildByLabel('graphics') as Graphics;
      let h = CARD_HEIGHT * this._sscale + (STANDARD_GAP) * 2
      if (this._label) {
        h += this._labelText?.height ?? 0;
      }
      g.clear();
      g.roundRect(
        0,
        0,
        CARD_WIDTH * this._sscale + (STANDARD_GAP * this._sscale) * 2,
        h,
        5
      )
        .fill({ color: 0x000000, alpha: .6 });
    }
  }

  private updateBadgeCount = () => {
    const cardIds = this._$cardIds.get();
    const selectedCardsIds = selectedCardStore.get();
    const selectedCardCountInStack = cardIds.filter(e => selectedCardsIds.includes(e)).length;

    if ((cardIds.length !== 0 && this._alwaysShowCountBadge) || (this._showCountBadge && cardIds.length - selectedCardCountInStack > 1)) {
      this._badgeCount.count = cardIds.length - selectedCardCountInStack;
      this._badgeCount.x = this._cardContainer.x + 5;
      this._badgeCount.y = this._cardContainer.y + 5;
      this.addChild(this._badgeCount);
      this._badgeCount.scale = this._sscale;
    } else {
      this.removeChild(this._badgeCount);
    }

    if (selectedCardCountInStack > 1) {
      this._selectedBadgeCount.count = selectedCardCountInStack;
      this._selectedBadgeCount.y = -60 * this._sscale;
      this._selectedBadgeCount.scale = this._sscale;
      this.addChild(this._selectedBadgeCount);
    } else {
      this.removeChild(this._selectedBadgeCount);
    }

    if (this._showBackground) {
      const g = this._background.getChildByLabel('graphics') as Graphics;
      let h = CARD_HEIGHT * this._sscale + (STANDARD_GAP) * 2
      if (this._label) {
        h += this._labelText?.height ?? 0;
      }
      g.clear();
      g.roundRect(
        0,
        0,
        CARD_WIDTH * this._sscale + (STANDARD_GAP * this._sscale) * 2,
        h,
        5
      )
        .fill({ color: 0x000000, alpha: .6 });
    }
  }
}
