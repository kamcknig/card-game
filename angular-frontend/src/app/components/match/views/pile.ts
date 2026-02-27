import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { createCardView } from '../../../core/card/create-card-view';
import { CountBadgeView } from './count-badge-view';
import { Card, CardFacing, CardKey, Trait } from 'shared/types';
import { CardSize } from '../../../../types';
import { CardView } from './card-view';
import { AdjustmentFilter } from 'pixi-filters';
import { TokenBadgeView } from './token-badge-view';
import { selectablePileStore } from '../../../state/interactive-pile-logic';
import { selectedPileStore } from '../../../state/interactive-state';
import { CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH } from '../../../core/app-contants';
import { displayCardDetail } from './modal/display-card-detail';

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

export type TokenChipData = {
  id: string;
  assetKey: string;
  count: number;
  textColor?: string;
};

export class PileView extends Container {
  private _cards: Card[] = [];
  private _count: number = 0;
  private readonly _size: CardSize = 'full';
  private readonly _facing: CardFacing = 'front';
  private readonly _cardViewContainer: Container;
  private readonly _tokenContainer: Container;
  private readonly _tokenChipContainer: Container;
  private readonly _highlight: Graphics = new Graphics({ label: 'pileHighlight' });
  private _cardView: CardView | undefined | null;
  private _pileKey: CardKey | undefined;
  private _trait: Trait | null = null;
  private readonly _traitTagContainer: Container;
  private readonly _traitTagBackground: Graphics = new Graphics({ label: 'traitTagBackground' });
  private readonly _traitTagText: Text = new Text({ label: 'traitTagText', text: '' });
  private _tokenBadges: TokenBadgeData[] = [];
  private _tokenChips: TokenChipData[] = [];
  private _cleanup: (() => void)[] = [];

  set pile(val: Card[]) {
    this._cards = [...val];
    this._count = this._cards.length;
    this.draw();
  }

  // Sets a stable pile key so tokens can be mapped to this pile.
  set pileKey(val: CardKey) {
    this._pileKey = val;
    this.drawHighlight();
  }

  get pileKey(): CardKey | undefined {
    return this._pileKey;
  }

  // Sets the active trait displayed beside this pile.
  set trait(value: Trait | null | undefined) {
    this._trait = value ?? null;
    this.drawTraitTag();
  }

  // Updates the tokens rendered on top of the pile view.
  set tokenBadges(val: TokenBadgeData[]) {
    this._tokenBadges = [...val];
    this.drawTokenBadges();
    this.drawHighlight();
  }

  // Updates icon+count token chips rendered on this pile.
  set tokenChips(value: TokenChipData[]) {
    this._tokenChips = value.filter((chip) => chip.count > 0);
    this.drawTokenChips();
    this.drawHighlight();
  }

  constructor(args: PileArgs) {
    super();

    this._cards = args.cards ?? [];
    this._count = this._cards.length
    this._size = args.size ?? 'full';
    this._facing = args.facing ?? 'front';

    this._cardViewContainer = new Container({ label: 'cardView' });
    this.addChild(this._highlight);
    this.addChild(this._cardViewContainer);

    // Token container sits above the card view for token indicators.
    this._tokenContainer = new Container({ label: 'tokenContainer' });
    this.addChild(this._tokenContainer);
    // Token chip container sits above token badges so icon+count remains readable.
    this._tokenChipContainer = new Container({ label: 'tokenChipContainer' });
    this.addChild(this._tokenChipContainer);
    this._traitTagContainer = new Container({ label: 'traitTagContainer' });
    this._traitTagContainer.addChild(this._traitTagBackground);
    this._traitTagContainer.addChild(this._traitTagText);
    this.addChild(this._traitTagContainer);
    this._traitTagContainer.eventMode = 'none';
    this._traitTagContainer.cursor = 'default';
    this._traitTagContainer.on('pointerdown', (event) => {
      if (event.button !== 2 || !this._trait) {
        return;
      }
      event.preventDefault?.();
      event.stopPropagation?.();
      void displayCardDetail({ detailImagePath: this._trait.detailImagePath });
    });

    if (this._cards.length > 0) {
      this.draw();
    }

    this.eventMode = 'static';

    this.on('pointerdown', (event) => {
      if (event.ctrlKey) {
        console.debug(this._cards);
      }
    });

    this.on('removed', () => {
      this._cleanup.forEach(cb => cb());
      this._traitTagContainer.removeAllListeners();
      this.removeAllListeners();
      this.destroy();
    });

    this._cleanup.push(selectablePileStore.subscribe(this.drawHighlight));
    this._cleanup.push(selectedPileStore.subscribe(this.drawHighlight));
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
      this.drawTraitTag();
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
    this.drawTokenChips();
    this.drawTraitTag();
  }

  // Draws highlight around the pile if selectable or selected.
  private drawHighlight = () => {
    if (!this._pileKey) {
      this._highlight.clear();
      return;
    }

    const selectable = selectablePileStore.get();
    const selected = selectedPileStore.get();

    this._highlight.clear();

    // Use canonical card dimensions so pile highlights stay visually consistent across card textures.
    const width = this._size === 'half' ? SMALL_CARD_WIDTH : CARD_WIDTH;
    const height = this._size === 'half' ? SMALL_CARD_HEIGHT : CARD_HEIGHT;

    if (selectable.includes(this._pileKey)) {
      this._highlight
        .roundRect(-3, -3, width + 6, height + 6, 5)
        .fill(0xffaaaa);
    }

    if (selected.includes(this._pileKey)) {
      this._highlight
        .roundRect(-3, -3, width + 6, height + 6, 5)
        .fill(0x6DFF8C);
    }
  }

  // Renders token badges in the top-right corner of the pile.
  private drawTokenBadges() {
    const tokenSize = this._size === 'half' ? 25 : 35;
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

  // Draws icon+count chips for pile-level token visuals.
  private drawTokenChips() {
    this._tokenChipContainer.removeChildren();
    if (this._tokenChips.length < 1) {
      return;
    }

    const orderedChips = [...this._tokenChips].sort((a, b) => a.id.localeCompare(b.id));
    const maxSide = this._size === 'half' ? 32 : 42;
    const gap = 2;
    let currentY = 6;

    for (const chip of orderedChips) {
      const iconTexture = Assets.get(chip.assetKey);
      if (!iconTexture) {
        continue;
      }

      const icon = Sprite.from(iconTexture);
      icon.scale = Math.min(maxSide / icon.width, maxSide / icon.height);
      icon.x = (this._cardView?.width ?? this.width) - icon.width - 6;
      icon.y = currentY;
      this._tokenChipContainer.addChild(icon);

      const countText = new Text({
        text: chip.count,
        style: {
          fill: chip.textColor ?? '#f4ebde',
          fontSize: this._size === 'half' ? 15 : 20,
          fontWeight: '700',
        },
        anchor: 0.5,
      });
      countText.x = icon.x + icon.width * 0.5;
      countText.y = icon.y + icon.height * 0.5;
      this._tokenChipContainer.addChild(countText);
      currentY += icon.height + gap;
    }
  }

  // Renders a vertical trait tag attached to the right edge of the pile.
  private drawTraitTag() {
    const fallbackWidth = this._size === 'half' ? SMALL_CARD_WIDTH : CARD_WIDTH;
    const fallbackHeight = this._size === 'half' ? SMALL_CARD_HEIGHT : CARD_HEIGHT;
    const width = this._cardView?.width ?? fallbackWidth;
    const height = this._cardView?.height ?? fallbackHeight;

    if (!this._trait) {
      this._traitTagContainer.visible = false;
      this._traitTagContainer.eventMode = 'none';
      return;
    }

    const tagWidth = this._size === 'half' ? 24 : 32;
    const tagHeight = Math.max(24, height - 20);
    const tagY = Math.floor((height - tagHeight) / 2);
    this._traitTagBackground.clear();
    this._traitTagBackground.roundRect(0, tagY, tagWidth, tagHeight, 4);
    this._traitTagBackground.stroke({ color: 0xf3dfb4, width: 1.25 });
    this._traitTagBackground.fill({ color: 0xb9b4d4, alpha: 1 });

    this._traitTagText.text = this._trait.cardName.toUpperCase();
    this._traitTagText.style = {
      fontSize: this._size === 'half' ? 13 : 16,
      fill: 0x2f2a4f,
      fontWeight: '700',
      align: 'center',
      letterSpacing: 0.5,
      padding: 4,
    };
    this._traitTagText.anchor.set(0.5);
    this._traitTagText.rotation = Math.PI / 2;
    this._traitTagText.x = Math.floor(tagWidth / 2) - 2;
    this._traitTagText.y = Math.floor(height / 2);

    // Align trait tag so its left edge is exactly on the pile's right edge.
    this._traitTagContainer.x = width;
    this._traitTagContainer.y = 0;
    this._traitTagContainer.visible = true;
    this._traitTagContainer.eventMode = 'static';
  }
}
