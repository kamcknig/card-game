import { Container, Graphics, Text } from 'pixi.js';
import { CountBadgeView } from './count-badge-view';
import { createCardView } from '../core/card/create-card-view';
import { $cardsById } from '../state/card-state';
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../core/app-contants';
import { batched, PreinitializedWritableAtom } from 'nanostores';
import { isUndefined } from 'es-toolkit';
import { CardView } from './card-view';
import { $selectedCards } from '../state/interactive-state';

export type CardStackArgs = {
  label?: string;
  $cardIds: PreinitializedWritableAtom<number[]>;
  showCountBadge?: boolean;
  cardFacing: CardView['facing'];
  showBackground?: boolean;
}

export class CardStackView extends Container {
  private readonly _$cardIds: PreinitializedWritableAtom<number[]>;
  private readonly _background: Container = new Container();
  private readonly _cardContainer: Container<CardView> = new Container({ x: STANDARD_GAP * .8, y: STANDARD_GAP * .8 });
  private readonly _cleanup: (() => void)[] = [];
  private readonly _showCountBadge: boolean = true;
  private readonly _label: string;
  private readonly _labelText: Text;
  private readonly _cardFacing: CardView['facing'];
  private readonly _selectedBadgeCount: CountBadgeView = new CountBadgeView({ label: 'selectedBadgeCount' });
  private readonly _badgeCount: CountBadgeView = new CountBadgeView({ label: 'badgeCount' });

  private readonly _showBackground: boolean;

  constructor(args: CardStackArgs) {
    super();

    const {
      showCountBadge,
      label,
      cardFacing,
      showBackground,
      $cardIds
    } = args;
    this._cardFacing = cardFacing;
    this._showCountBadge = showCountBadge ?? true;
    this._label = label;
    this._showBackground = showBackground ?? true;
    this._$cardIds = $cardIds;

    if (this._showBackground) {
      this._background.addChild(
        new Graphics()
          .roundRect(0, 0, CARD_WIDTH + STANDARD_GAP * 2, CARD_HEIGHT + STANDARD_GAP * 2)
          .fill({ color: 0x000000, alpha: .6 })
      );

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

    this._cardContainer.x = STANDARD_GAP;
    this._cardContainer.y = STANDARD_GAP;

    if (this._labelText) {
      this._cardContainer.y = this._labelText.y + this._labelText.height + STANDARD_GAP;
    }

    this.addChild(this._cardContainer);

    this._cleanup.push(this._$cardIds.subscribe(this.drawDeck));
    this._cleanup.push($selectedCards.subscribe(this.onSelectedCardsUpdated));

    this._cleanup.push(this._$cardIds.subscribe(this.updateBadgeCount));
    this._cleanup.push($selectedCards.subscribe(this.updateBadgeCount));
    this.on('removed', this.onRemoved);
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.off('removed');
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
    }
  }

  private drawDeck = (cardIds: readonly number[]) => {
    this._cardContainer.removeChildren();

    for (const cardId of cardIds) {
      const c = this._cardContainer.addChild(createCardView($cardsById.get()[cardId]));
      c.size = 'full';
      c.facing = this._cardFacing
    }
  }

  private updateBadgeCount = () => {
    const cardIds = this._$cardIds.get();
    const selectedCardsIds = $selectedCards.get();
    const selectedCardCountInStack = cardIds.filter(e => selectedCardsIds.includes(e)).length;

    if (this._showCountBadge && cardIds.length - selectedCardCountInStack > 1) {
      this._badgeCount.count = cardIds.length - selectedCardCountInStack;
      this._badgeCount.x = this._cardContainer.x + 5;
      this._badgeCount.y = this._cardContainer.y + 5;
      this.addChild(this._badgeCount);
    } else {
      this.removeChild(this._badgeCount);
    }

    if (selectedCardCountInStack > 1) {
      this._selectedBadgeCount.count = selectedCardCountInStack;
      this._selectedBadgeCount.y = -60;
      this.addChild(this._selectedBadgeCount);
    } else {
      this.removeChild(this._selectedBadgeCount);
    }
  }
}
