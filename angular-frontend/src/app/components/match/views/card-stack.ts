import { Container, Graphics, Text } from 'pixi.js';
import { CountBadgeView } from './count-badge-view';
import { createCardView } from '../../../core/card/create-card-view';
import { cardStore } from '../../../state/card-state';
import { CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { computed, ReadableAtom } from 'nanostores';
import { isUndefined } from 'es-toolkit';
import { CardView } from './card-view';
import { selectedCardStore } from '../../../state/interactive-state';
import { TokenBadgeView } from './token-badge-view';
import { Match, PlayerId, TokenDefinition, TokenId, TokenInstance } from 'shared/types';
import { getTokenShortLabel } from './token-utils';

type TokenBadgeData = {
  id: string;
  label: string;
  color: number;
};

export type CardStackArgs = {
  label?: string;
  $cardIds: ReadableAtom<number[]>;
  showCountBadge?: boolean;
  alwaysShowCountBadge?: boolean;
  cardFacing: CardView['facing'];
  showBackground?: boolean;
  scale?: number;
  tokenPlayerId?: PlayerId;
  $match?: ReadableAtom<Match | null>;
  $tokenDefinitions?: ReadableAtom<Record<TokenId, TokenDefinition>>;
}

export type CardStackCardRenderLayout = {
  facing: CardView['facing'];
  y: number;
};

export class CardStackView extends Container {
  protected readonly _$cardIds: ReadableAtom<number[]>;
  private readonly _background: Container = new Container();
  protected readonly _cardContainer: Container<CardView> = new Container({ x: STANDARD_GAP * .8, y: STANDARD_GAP * .8 });
  protected readonly _stackOverlayContainer: Container = new Container({ label: 'stackOverlayContainer' });
  private readonly _tokenContainer: Container<TokenBadgeView> = new Container({ label: 'tokenContainer' });
  private readonly _cleanup: (() => void)[] = [];
  private readonly _showCountBadge: boolean = true;
  private readonly _label: string | undefined;
  private readonly _labelText: Text | undefined;
  protected readonly _cardFacing: CardView['facing'];
  private readonly _selectedBadgeCount: CountBadgeView = new CountBadgeView({ label: 'selectedBadgeCount' });
  private readonly _badgeCount: CountBadgeView = new CountBadgeView({ label: 'badgeCount' });
  protected readonly _sscale: number;
  private readonly _alwaysShowCountBadge?: boolean;
  private _tokenBadges: TokenBadgeData[] = [];
  private readonly _tokenPlayerId?: PlayerId;
  private readonly _matchStore?: ReadableAtom<Match | null>;
  private readonly _tokenDefinitionsStore?: ReadableAtom<Record<TokenId, TokenDefinition>>;
  private readonly _cardBaseYById: Map<number, number> = new Map();

  private readonly _showBackground: boolean;

  // Updates the tokens rendered on top of the stack view.
  set tokenBadges(val: TokenBadgeData[]) {
    this._tokenBadges = [...val];
    this.drawTokenBadges();
  }

  constructor(args: CardStackArgs) {
    super();

    const {
      showCountBadge,
      label,
      cardFacing,
      showBackground,
      $cardIds,
      scale = 1,
      alwaysShowCountBadge,
      tokenPlayerId,
      $match,
      $tokenDefinitions
    } = args;
    this._cardFacing = cardFacing;
    this._showCountBadge = showCountBadge ?? true;
    this._label = label;
    this._showBackground = showBackground ?? true;
    this._$cardIds = $cardIds;
    this._sscale = scale;
    this._alwaysShowCountBadge = alwaysShowCountBadge ?? false;
    this._tokenPlayerId = tokenPlayerId;
    this._matchStore = $match;
    this._tokenDefinitionsStore = $tokenDefinitions;

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
    // Overlay container is reserved for stack-specific badges above cards.
    this.addChild(this._stackOverlayContainer);
    // Token container sits above the card stack for deck tokens.
    this.addChild(this._tokenContainer);

    this._cleanup.push(this._$cardIds.subscribe(this.drawDeck));
    this._cleanup.push(selectedCardStore.subscribe(this.onSelectedCardsUpdated));

    if (this._showCountBadge) {
      this._cleanup.push(this._$cardIds.subscribe(this.updateBadgeCount));
      this._cleanup.push(selectedCardStore.subscribe(this.updateBadgeCount));
    }
    if (this._tokenPlayerId !== undefined && this._matchStore && this._tokenDefinitionsStore) {
      this._cleanup.push(
        computed(
          [this._matchStore, this._tokenDefinitionsStore],
          (match, tokenDefinitions) => ({ match, tokenDefinitions })
        ).subscribe(({ match, tokenDefinitions }) => this.updateTokenBadges(match, tokenDefinitions))
      );
    }

    this.on('removed', this.onRemoved);

    this.eventMode = 'static';

    this.on('pointerdown', (event) => {
      if (event.ctrlKey) {
        console.debug(this._$cardIds.get().map(cId => cardStore.get()[cId]));
      }
    });
  }

  private onRemoved = () => {
    this._cleanup.forEach(cb => cb());
    this.removeAllListeners();
  }

  // Returns optional per-card layout overrides without mutating source order/state.
  protected buildCardRenderLayout(_cardIds: readonly number[]): Map<number, CardStackCardRenderLayout> {
    return new Map();
  }

  // Draws stack overlays (group badges, labels) after cards are positioned.
  protected drawStackOverlays(_cardIds: readonly number[]): void {
    this._stackOverlayContainer.removeChildren().forEach((child) => child.destroy());
  }

  private onSelectedCardsUpdated = (selectedCardIds: readonly number[] = []) => {
    const sortedCardViews = this._cardContainer.children.sort(
      (a, b) => selectedCardIds.includes(a.card.id) ? -1 : selectedCardIds.includes(b.card.id) ? 1 : 0
    );

    for (const [idx, cardView] of sortedCardViews.entries()) {
      this._cardContainer.addChildAt(cardView, idx);
      const card = cardView.card;
      const baseY = this._cardBaseYById.get(card.id) ?? 0;
      if (selectedCardIds.includes(card.id)) {
        cardView.y = baseY - 60;
      } else {
        cardView.y = baseY;
      }
      cardView.y *= this._sscale;
    }
  }

  private drawDeck = (cardIds: readonly number[]) => {
    this._cardContainer.removeChildren();
    this._cardBaseYById.clear();

    const renderLayoutByCardId = this.buildCardRenderLayout(cardIds);

    for (const cardId of cardIds) {
      const cardData = cardStore.get()[cardId];
      // Guard against stale card sources pointing at missing card data.
      if (!cardData) {
        console.warn(`[card-stack] missing card data for id ${cardId}`);
        continue;
      }

      const renderLayout = renderLayoutByCardId.get(cardId);
      const cardFacing = renderLayout?.facing ?? cardData?.facing ?? this._cardFacing;
      const cardBaseY = renderLayout?.y ?? 0;
      const c = this._cardContainer.addChild(createCardView(cardData));
      c.size = 'full';
      c.facing = cardFacing;
      c.scale = this._sscale;
      c.y = cardBaseY * this._sscale;
      this._cardBaseYById.set(cardId, cardBaseY);
    }

    this.drawStackOverlays(cardIds);

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
        .fill({ color: 0x000000, alpha: .4 });
    }
    // Reposition token badges after the stack layout updates.
    this.drawTokenBadges();
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
        .fill({ color: 0x000000, alpha: .4 });
    }
  }

  // Renders token badges in the top-right corner of the stack.
  private drawTokenBadges() {
    const tokenSize = Math.max(18, Math.floor(28 * this._sscale));
    const gap = 2;
    const baseX = this._cardContainer.x + (this._cardContainer.width || (CARD_WIDTH * this._sscale)) - tokenSize - 4;
    const baseY = this._cardContainer.y + 4;

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
      } else {
        view.labelText = badge.label;
        view.color = badge.color;
      }
      view.x = baseX;
      view.y = baseY + idx * (tokenSize + gap);
    });
  }

  // Maps match tokens to deck badges for the configured player.
  private updateTokenBadges(match: Match | null, tokenDefinitions: Record<TokenId, TokenDefinition>): void {
    if (this._tokenPlayerId === undefined) return;
    if (!match) {
      this.tokenBadges = [];
      return;
    }

    const playerColorMap = new Map(match.players.map(player => [player.id, player.color]));
    const tokens = Object.values(match.tokens ?? {}) as TokenInstance[];
    const deckTokens = tokens.filter(token =>
      token.location.type === 'playerDeck' &&
      token.location.playerId === this._tokenPlayerId
    );

    this.tokenBadges = deckTokens.map(token => {
      const tokenDefinition = tokenDefinitions[token.tokenId];
      const label = getTokenShortLabel(token.tokenId, tokenDefinition);
      const color = this.parseColor(playerColorMap.get(token.ownerId ?? this._tokenPlayerId!) ?? '#ffffff');
      return {
        id: token.id,
        label,
        color,
      };
    });
  }

  // Parses a hex color string into a numeric color for Pixi.
  private parseColor(color: string): number {
    if (!color) return 0xffffff;
    const normalized = color.replace('#', '');
    return Number.parseInt(normalized, 16);
  }
}
