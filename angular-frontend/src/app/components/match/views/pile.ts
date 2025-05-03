import { Container } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { CountBadgeView } from './count-badge-view';
import { Card, CardFacing } from 'shared/shared-types';
import { CardSize } from '../../../../types';
import { CardView } from './card-view';
import { AdjustmentFilter } from 'pixi-filters';

type PileArgs = {
  cards?: Card[];
  count?: number;
  size?: CardSize;
  facing?: CardFacing;
}

export class PileView extends Container {
  private _cards: Card[] = [];
  private _count: number = 0;
  private _size: CardSize = 'full';
  private _facing: CardFacing = 'front';
  private _cardViewContainer: Container;
  private _cardView: CardView | undefined | null;

  set pile(val: Card[]) {
    this._cards = [...val];
    this._count = this._cards.length;
    this.draw();
  }

  constructor(args: PileArgs) {
    super();

    this._cards = args.cards ?? [];
    this._count = args.count ?? 0;
    this._size = args.size ?? 'full';
    this._facing = args.facing ?? 'front';

    this._cardViewContainer = new Container({ label: 'cardView' });
    this.addChild(this._cardViewContainer);

    if (this._cards.length > 0) {
      this.draw();
    }

    this.eventMode = 'static';

    this.on('pointerdown', (event) => {
      if (event.ctrlKey) {
        console.log(this._cards);
      }
    });

    this.on('removed', () => {
      this.removeAllListeners();
      this.destroy();
    });
  }

  draw() {
    const card = this._cards.sort((a, b) => a.id - b.id).slice(-1)[0];

    let badge;
    if (!card) {
      this.eventMode = 'none';
      this._cardViewContainer.filters = [new AdjustmentFilter({
        saturation: .4,
        brightness: .4
      })];
      badge = this._cardViewContainer.getChildByLabel('countBadge') as CountBadgeView;
      badge?.removeFromParent();
      return;
    }

    if (this._cardView && (this._cardView.card.id !== card.id || this._cardView.card.cardKey !== card.cardKey)) {
      this._cardView.removeFromParent();
      this._cardView = null;
    }

    if (!this._cardView) {
      this._cardView = this.addChild(createCardView(card));
      this._cardView.size = this._size;
      this._cardView.facing = this._facing;
      this._cardViewContainer.addChildAt(this._cardView, 0);
    }
    this._cardView.card = card;

    badge = this._cardViewContainer.getChildByLabel('countBadge') as CountBadgeView;
    if (!badge) {
      badge = new CountBadgeView({ count: this._count });
      badge.label = 'countBadge';
      this._cardViewContainer.addChild(badge);
    }
    badge.count = this._count;
  }
}
