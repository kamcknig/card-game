import { Container } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { CountBadgeView } from './count-badge-view';
import { Card } from 'shared/shared-types';
import { CardFacing, CardSize } from '../../../../types';
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
  private _cardView: Container;

  set pile(val: Card[]) {
    this._cards = [...val];
    this._count = this._cards.length;
    this.draw();
  }

  constructor(args: PileArgs) {
    super();
    console.log('creating pile');

    this._cards = args.cards ?? [];
    this._count = args.count ?? 0;
    this._size = args.size ?? 'full';
    this._facing = args.facing ?? 'front';

    this._cardView = new Container({ label: 'cardView' });
    this.addChild(this._cardView);

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
    });
  }

  draw() {
    const card = this._cards.sort((a, b) => a.id - b.id).slice(-1)[0];

    if (!card) {
      this._cardView.filters = [new AdjustmentFilter({
        saturation: .4
      })];
      return;
    }

    let view = this.getChildByLabel(`${card.cardKey}:${card.id}`) as CardView;
    if (!view || view.card.cardKey !== card.cardKey) {
      view?.removeFromParent();
      view = this.addChild(createCardView(card));
      view.size = this._size;
      view.facing = this._facing;
      this._cardView.addChild(view);
    }

    let badge = this.getChildByLabel('countBadge') as CountBadgeView;
    if (!badge) {
      badge = new CountBadgeView({ count: this._count });
      badge.label = 'countBadge';
      this._cardView.addChild(badge);
    }
    badge.count = this._count;
  }
}
