import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { cardStore } from '../../state/card-state';
import { Card, CardFacing, CardId, CardNoId, CardType, Match, TokenDefinition, TokenId, TokenInstance } from 'shared/types';
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

// Card type → CSS source-color custom property used for the type bar
// gradient and the cost-badge / value accent colors. Only the six visually
// distinct types below contribute to the bar; anything else (ACTION,
// ATTACK, COMMAND, etc.) is ignored when building the gradient and falls
// through to the default (white) source color for the accent.
const CARD_TYPE_COLOR_VAR: Partial<Record<CardType, string>> = {
  DURATION: 'var(--theme-color-source-duration)',
  REACTION: 'var(--theme-color-source-reaction)',
  NIGHT: 'var(--theme-color-source-night)',
  VICTORY: 'var(--theme-color-source-victory)',
  TREASURE: 'var(--theme-color-source-treasure)',
  CURSE: 'var(--theme-color-source-curse)',
};

// Mute factor for type-bar backgrounds — 55% source color blended with 45%
// neutral gray. The cost-badge border and the value-indicator text continue
// to read the vibrant source color directly.
const muteBarColor = (color: string): string => `color-mix(in srgb, ${color} 55%, gray)`;

// Half-width of each color's solid plateau when building a multi-type bar
// gradient. With this value, two-type cards render ~35% solid on each side
// and a 30%-wide transition zone in the centre instead of a smooth fade
// across the whole bar.
const TYPE_BAR_PLATEAU_HALF_WIDTH = 35;

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
  private static readonly CARD_BACK_DETAIL_IMAGE_PATH = '/assets/card-images/base-v2/card-back-detail.jpg';

  private readonly _nanoStores = inject(NanostoresService);
  private readonly _sanitizer = inject(DomSanitizer);

  // Either pass `cardId` (resolved against cardStore — the in-match flow) or
  // pass a full card object via `cardData` (used on surfaces that render
  // pre-match data, e.g. the match configuration screen, where cards exist
  // as pre-selected templates without a runtime id yet).
  cardId = input<CardId | undefined>(undefined);
  cardData = input<Card | CardNoId | undefined>(undefined);
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

  // Active card model for this component instance — prefers the directly
  // supplied cardData (pre-match surfaces), falling back to the
  // cardStore lookup keyed by cardId (in-match surfaces).
  readonly card = computed(() => {
    const data = this.cardData();
    if (data) return data;
    const id = this.cardId();
    if (id === undefined) return undefined;
    return this._cards()?.[id];
  });

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

  // Sanitized image URL — flat art image when face up, card-back art when face down.
  // The URL is derived from expansionName + cardKey rather than read from
  // card.artImagePath so stale saved configurations (with legacy paths or no
  // artImagePath at all) still resolve to the current flat asset layout.
  // imageKeyOverride wins over cardKey when present — set on multi-card pile
  // catalog representatives so the kingdom modal renders the pile cover image.
  readonly path = computed<SafeUrl | undefined>(() => {
    const card = this.card();
    if (!card) return undefined;

    if (this.isFaceDown()) {
      return this._sanitizer.bypassSecurityTrustUrl('/assets/card-images/base-v2/card-back-art.jpg');
    }
    const imageKey = card.imageKeyOverride ?? card.cardKey;
    return this._sanitizer.bypassSecurityTrustUrl(
      `/assets/card-images/${card.expansionName}/${imageKey}-art.jpg`,
    );
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

  // Linear gradient (or solid color) for the type bars at the top and bottom
  // of the card. Only the six types listed in CARD_TYPE_COLOR_VAR (DURATION,
  // REACTION, NIGHT, VICTORY, TREASURE, CURSE) contribute. Cards with no
  // qualifying type render a solid muted-default bar; single-type cards a
  // single solid muted color; multi-typed cards a horizontal gradient where
  // each color holds a solid plateau on its side with a narrow transition
  // zone between adjacent colors.
  //
  // All output colors are passed through muteBarColor() so the bar reads ~45%
  // softer than the source-color tokens used elsewhere. The Curse card itself
  // is mis-typed as VICTORY in the card library, so we override it to render
  // the CURSE color instead of green.
  readonly typeBarBackground = computed<string>(() => {
    const card = this.card();
    if (card?.cardKey === 'curse') {
      return muteBarColor(CARD_TYPE_COLOR_VAR.CURSE ?? 'var(--theme-color-source-default)');
    }
    const types = (card?.type ?? []).filter((type) => type in CARD_TYPE_COLOR_VAR);
    if (types.length === 0) {
      return muteBarColor('var(--theme-color-source-default)');
    }
    if (types.length === 1) {
      return muteBarColor(CARD_TYPE_COLOR_VAR[types[0]] ?? 'var(--theme-color-source-default)');
    }
    // Each colour gets two stops — one entering its plateau, one leaving it —
    // so the visible gradient sits between the inner stops only.
    const solidExtent = TYPE_BAR_PLATEAU_HALF_WIDTH / (types.length - 1);
    const stops = types.flatMap((type, index) => {
      const color = muteBarColor(CARD_TYPE_COLOR_VAR[type] ?? 'var(--theme-color-source-default)');
      const center = (index / (types.length - 1)) * 100;
      const start = Math.max(0, center - solidExtent);
      const end = Math.min(100, center + solidExtent);
      return [`${color} ${start.toFixed(2)}%`, `${color} ${end.toFixed(2)}%`];
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  });

  // Token badges to display on top of the card image. Pre-match surfaces
  // (cardData passed without a runtime cardId) never have tokens, so we
  // skip the lookup entirely when no id is available.
  readonly tokenBadges = computed<CardTokenBadge[]>(() => {
    const cardId = this.cardId();
    if (cardId === undefined) return [];
    return this.buildTokenBadges(this._match() ?? null, this._tokenDefinitions(), cardId);
  });

  // Token badge size — small to match the half-size card frame the rest of
  // the app renders.
  readonly tokenSizePx = 25;

  // Opens a detail view when right-clicking the card.
  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const card = this.card();
    if (!card) {
      return;
    }

    // Derive the detail URL from expansionName + (override ?? cardKey) for the
    // same reason path() does — saved configurations may carry stale legacy
    // paths, and pile catalog representatives need the pile-level detail image.
    const imageKey = card.imageKeyOverride ?? card.cardKey;
    const detailImagePath = this.isFaceDown()
      ? CardComponent.CARD_BACK_DETAIL_IMAGE_PATH
      : `/assets/card-images/${card.expansionName}/${imageKey}-detail.jpg`;

    if (!detailImagePath) {
      return;
    }

    void displayCardDetail({
      detailImagePath,
      kingdom: card.kingdom,
      cardId: this.cardId(),
      expansionName: card.expansionName,
      pileMembers: card.pileMembers,
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
