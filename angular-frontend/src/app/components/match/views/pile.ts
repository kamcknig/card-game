import { Container } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { CountBadgeView } from './count-badge-view';
import { Card } from 'shared/shared-types';
import { CardFacing, CardSize } from '../../../../types';
import { CardView } from './card-view';

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
      this.destroy();
      this.removeAllListeners();
    });
  }

  draw() {
    const card = this._cards.reduce<Card | undefined>((prev, next) => {
      if (!prev) {
        return next;
      }

      return prev.id > next.id ? prev : next
    }, undefined);

    if (!card) {
      throw new Error('No card found for this pile');
    }

    let view = this.getChildByLabel(`${card.cardKey}:${card.id}`) as CardView;
    if (!view) {
      view = this.addChild(createCardView(card));
    }

    view.size = this._size;
    view.facing = this._facing;

    const b = new CountBadgeView({ count: this._count });
    b.x = 0;
    b.y = 0;

    this.addChild(b);
  }
}
