import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { cardStore } from '../../state/card-state';
import { CardFacing, CardId, CardType, Match, TokenDefinition, TokenId, TokenInstance } from 'shared/types';
import { CardSize } from '../../../types';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { selfPlayerIdStore } from '../../state/player-state';
import { matchStore } from '../../state/match-state';
import { tokenDefinitionStore } from '../../state/token-definition-state';
import { getTokenShortLabel } from '../match/views/token-utils';
import { displayCardDetail } from '../match/views/modal/display-card-detail';

type CardTokenBadge = {
  id: string;
  label: string;
  color: string;
};

// Card type → CSS source-color custom property used for the type bar gradient
// and the cost-badge / value accent colors. Types that are not visually
// distinct fall through to the default (white/cream) source color.
const CARD_TYPE_COLOR_VAR: Partial<Record<CardType, string>> = {
  TREASURE: 'var(--theme-color-source-treasure)',
  VICTORY: 'var(--theme-color-source-victory)',
  CURSE: 'var(--theme-color-source-curse)',
  DURATION: 'var(--theme-color-source-duration)',
  ATTACK: 'var(--theme-color-source-attack)',
  REACTION: 'var(--theme-color-source-reaction)',
};

// Hardcoded treasure values for the basic treasure piles. Other treasure cards
// use variable / conditional values (e.g. Bank, Crown), so we only display the
// large value indicator when the value is unambiguous.
const FIXED_TREASURE_VALUES: Record<string, number> = {
  copper: 1,
  silver: 2,
  gold: 3,
  platinum: 5,
};

/**
 * Render context for the card. Drives hover behaviour:
 * - 'default' — subtle scale-up on hover (used in supply, play area, modals)
 * - 'hand'    — card lifts on hover, signalling it is the player's own and
 *               ready to be played
 */
export type CardRenderContext = 'default' | 'hand';

@Component({
  selector: 'app-card',
  imports: [],
  host: {
    '[attr.data-context]': 'context()',
  },
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent {
  private static readonly CARD_BACK_DETAIL_IMAGE_PATH = '/assets/card-images/base-v2/detail/card-back.jpg';

  private readonly _nanoStores = inject(NanostoresService);
  private readonly _sanitizer = inject(DomSanitizer);

  cardId = input.required<CardId>();
  size = input<CardSize>('full');
  // Optional override to force a card to render face up/down regardless of ownership.
  forceFacing = input<CardFacing | undefined>(undefined);
  // When false, the structured cost badge inside the card is suppressed. Parent
  // surfaces (supply piles, non-supply piles) that already render their own
  // multi-currency cost overlay set this to false to avoid double-display.
  showCost = input<boolean>(true);
  // Context drives hover behaviour — see CardRenderContext.
  context = input<CardRenderContext>('default');
  // Optional pile/group count rendered as a top-right pill badge when greater
  // than 1. Parents that group identical cards (e.g. hand groups, deck stacks)
  // pass the group size; surfaces with no count semantics leave this 0.
  count = input<number>(0);

  private readonly _cards = toSignal(this._nanoStores.useStore(cardStore), { initialValue: cardStore.get() });
  private readonly _selfPlayerId = toSignal(this._nanoStores.useStore(selfPlayerIdStore), { initialValue: selfPlayerIdStore.get() });
  private readonly _match = toSignal(this._nanoStores.useStore(matchStore));
  private readonly _tokenDefinitions = toSignal(this._nanoStores.useStore(tokenDefinitionStore), { initialValue: tokenDefinitionStore.get() });

  // Active card model for this component instance.
  readonly card = computed(() => this._cards()?.[this.cardId()]);

  // True when the card should render face down (opponent-owned + face: 'back',
  // or an explicit forceFacing='back' override).
  readonly isFaceDown = computed<boolean>(() => {
    const card = this.card();
    if (!card) return false;
    const forced = this.forceFacing();
    const effectiveFacing = forced ?? card.facing ?? 'front';
    if (forced) return forced === 'back';
    if (card.owner === this._selfPlayerId()) return false;
    return effectiveFacing === 'back';
  });

  // Sanitized image URL — full card art when face up, card-back image when face down.
  readonly path = computed<SafeUrl | undefined>(() => {
    const card = this.card();
    if (!card) return undefined;

    const size = this.size();
    if (this.isFaceDown()) {
      return this._sanitizer.bypassSecurityTrustUrl(
        `/assets/card-images/base-v2/${size}-size/card-back.jpg`,
      );
    }
    const path = size === 'half' ? card.halfImagePath
      : size === 'full' ? card.fullImagePath
      : card.detailImagePath;
    return this._sanitizer.bypassSecurityTrustUrl(path);
  });

  // Detail image path for right-click detail modal.
  readonly detailPath = computed(() => this.card()?.detailImagePath);

  // Treasure cost shown in the circular badge.
  readonly treasureCost = computed<number>(() => this.card()?.cost?.treasure ?? 0);

  // Optional potion cost (Alchemy expansion). Rendered as a small chip next
  // to the main cost badge when present.
  readonly potionCost = computed<number>(() => this.card()?.cost?.potion ?? 0);

  // Optional debt cost (Empires expansion). Rendered as a small chip next to
  // the main cost badge when present.
  readonly debtCost = computed<number>(() => this.card()?.cost?.debt ?? 0);

  // The card's primary type drives the badge / value accent color and is the
  // first segment of the type bar gradient.
  readonly primaryType = computed<CardType | undefined>(() => this.card()?.type?.[0]);

  // CSS color for the cost badge border and the value indicator — derived from
  // the card's primary type so a Treasure shows gold, a Victory shows green, etc.
  readonly accentColor = computed<string>(() => {
    const type = this.primaryType();
    if (!type) return 'var(--theme-color-source-default)';
    return CARD_TYPE_COLOR_VAR[type] ?? 'var(--theme-color-source-default)';
  });

  // Linear gradient (or solid color) for the type bar at the bottom of the card.
  // Each card type maps to its source color; multi-typed cards render a left-to-right
  // gradient with one stop per type.
  readonly typeBarBackground = computed<string>(() => {
    const types = this.card()?.type ?? [];
    if (types.length === 0) {
      return 'var(--theme-color-source-default)';
    }
    if (types.length === 1) {
      return CARD_TYPE_COLOR_VAR[types[0]] ?? 'var(--theme-color-source-default)';
    }
    const stops = types
      .map((type, index) => {
        const color = CARD_TYPE_COLOR_VAR[type] ?? 'var(--theme-color-source-default)';
        const percent = Math.round((index / (types.length - 1)) * 100);
        return `${color} ${percent}%`;
      })
      .join(', ');
    return `linear-gradient(90deg, ${stops})`;
  });

  // The large centered number shown between the name and the type bar.
  // Populated for cards with an unambiguous numeric value: VP for victory and
  // curse cards, fixed treasure values for the basic treasure piles.
  readonly displayValue = computed<number | null>(() => {
    const card = this.card();
    if (!card) return null;
    if (card.type.includes('VICTORY') && card.victoryPoints !== undefined && card.victoryPoints !== 0) {
      return card.victoryPoints;
    }
    if (card.type.includes('CURSE') && card.victoryPoints !== undefined && card.victoryPoints !== 0) {
      return card.victoryPoints;
    }
    const fixedTreasure = FIXED_TREASURE_VALUES[card.cardKey];
    if (card.type.includes('TREASURE') && fixedTreasure !== undefined) {
      return fixedTreasure;
    }
    return null;
  });

  // Token badges to display on top of the card image.
  readonly tokenBadges = computed<CardTokenBadge[]>(() => {
    return this.buildTokenBadges(this._match() ?? null, this._tokenDefinitions(), this.cardId());
  });

  // Token size mirrors pile badges: smaller for half-sized cards.
  readonly tokenSizePx = computed(() => this.size() === 'half' ? 25 : 35);

  // Opens a detail view when right-clicking the card.
  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const card = this.card();
    if (!card) {
      return;
    }

    const detailImagePath = this.isFaceDown()
      ? CardComponent.CARD_BACK_DETAIL_IMAGE_PATH
      : card.detailImagePath;

    if (!detailImagePath) {
      return;
    }

    void displayCardDetail({
      detailImagePath,
      kingdom: card.kingdom,
    });
  }

  // Computes token badge data for tokens located on this card.
  private buildTokenBadges(
    match: Match | null,
    tokenDefinitions: Record<TokenId, TokenDefinition>,
    cardId: CardId
  ): CardTokenBadge[] {
    if (!match) return [];
    const playerColorMap = new Map(match.players.map(player => [player.id, player.color]));
    const tokens = Object.values(match.tokens ?? {}) as TokenInstance[];
    return tokens
      .filter(token => token.location.type === 'card' && token.location.cardId === cardId)
      .map(token => {
        const definition = tokenDefinitions[token.tokenId];
        return {
          id: token.id,
          label: getTokenShortLabel(token.tokenId, definition),
          color: token.ownerId !== undefined && token.ownerId !== null
            ? playerColorMap.get(token.ownerId) ?? '#ffffff'
            : '#ffffff',
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }

}
