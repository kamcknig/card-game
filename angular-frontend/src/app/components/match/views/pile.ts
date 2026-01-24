import { Container } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { CountBadgeView } from './count-badge-view';
import { Card, CardFacing, CardKey } from 'shared/shared-types';
import { CardSize } from '../../../../types';
import { CardView } from './card-view';
import { AdjustmentFilter } from 'pixi-filters';
import { TokenBadgeView } from './token-badge-view';

type PileArgs = {
  cards?: Card[];
  size?: CardSize;
  facing?: CardFacing;
  showBadgeCount?: boolean;
}

export type TokenBadgeData = {
  id: string;
  label: string;
  color: number;
};

export class PileView extends Container {
  private _cards: Card[] = [];
  private _count: number = 0;
  private readonly _size: CardSize = 'full';
  private readonly _facing: CardFacing = 'front';
  private readonly _cardViewContainer: Container;
  private readonly _tokenContainer: Container;
  private _cardView: CardView | undefined | null;
  private _pileKey: CardKey | undefined;
  private _tokenBadges: TokenBadgeData[] = [];

  set pile(val: Card[]) {
    this._cards = [...val];
    this._count = this._cards.length;
    this.draw();
  }
  
  // Sets a stable pile key so tokens can be mapped to this pile.
  set pileKey(val: CardKey) {
    this._pileKey = val;
  }
  
  get pileKey(): CardKey | undefined {
    return this._pileKey;
  }
  
  // Updates the tokens rendered on top of the pile view.
  set tokenBadges(val: TokenBadgeData[]) {
    this._tokenBadges = [...val];
    this.drawTokenBadges();
  }

  constructor(args: PileArgs) {
    super();

    this._cards = args.cards ?? [];
    this._count = this._cards.length
    this._size = args.size ?? 'full';
    this._facing = args.facing ?? 'front';

    this._cardViewContainer = new Container({ label: 'cardView' });
    this.addChild(this._cardViewContainer);
    
    // Token container sits above the card view for token indicators.
    this._tokenContainer = new Container({ label: 'tokenContainer' });
    this.addChild(this._tokenContainer);

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

      if (this._cardView) {
        this._cardView.useHighlight = false;
      }

      badge = this._cardViewContainer.getChildByLabel('countBadge') as CountBadgeView;
      badge?.removeFromParent();
      return;
    }
    else {
      this.eventMode = 'static';
      this._cardViewContainer.filters = [];
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
    else {
      badge.count = this._count;
      badge.x = 5;
      badge.y = 5;
    }
    
    this.drawTokenBadges();
  }
  
  // Renders token badges in the top-right corner of the pile.
  private drawTokenBadges() {
    const tokenSize = this._size === 'half' ? 18 : 22;
    const gap = 2;
    const baseX = (this._cardView?.width ?? this.width) - tokenSize - 4;
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
}
