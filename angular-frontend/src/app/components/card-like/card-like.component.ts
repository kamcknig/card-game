import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CardLike, CardLikeId, CardLikeNoId } from 'shared/types';
import { findCardLikeInMatch } from 'shared/find-card-like-in-match';
import { CardSize } from '../../../types';
import { cardStore } from '../../state/card-state';
import { matchStore } from '../../state/match-state';
import { displayCardDetail } from '../match/views/modal/display-card-detail';

/**
 * Semantic kind of a card-like — drives the bottom accent strip color so
 * landscape cards (events, projects, ways, etc.) read consistently with the
 * portrait card type bar treatment.
 */
export type CardLikeKind =
  | 'event'
  | 'landmark'
  | 'project'
  | 'way'
  | 'prophecy'
  | 'boon'
  | 'hex'
  | 'state'
  | 'artifact'
  | 'ally'
  | 'trait';

// Card-like kind → CSS source-color custom property used for the bottom accent
// strip and the cost badge border. Falls through to the default cream when the
// kind is unknown (e.g. mat-preview surface, set-aside zones).
const KIND_COLOR_VAR: Record<CardLikeKind, string> = {
  event: 'var(--theme-color-source-event)',
  landmark: 'var(--theme-color-source-landmark)',
  project: 'var(--theme-color-source-project)',
  way: 'var(--theme-color-way)',
  prophecy: 'var(--theme-color-source-default)',
  boon: 'var(--theme-color-source-boon)',
  hex: 'var(--theme-color-source-hex)',
  state: 'var(--theme-color-source-state)',
  artifact: 'var(--theme-color-source-artifact)',
  ally: 'var(--theme-color-source-default)',
  trait: 'var(--theme-color-source-default)',
};

@Component({
  selector: 'app-card-like',
  imports: [],
  templateUrl: './card-like.component.html',
  styleUrl: './card-like.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardLikeComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _sanitizer = inject(DomSanitizer);

  // Either pass `cardLikeId` (resolved against cardStore + active match —
  // the in-match flow) or pass a full card-like object via `cardLikeData`
  // for surfaces that render pre-match data (e.g. the match configuration
  // screen, where landscape templates exist before the match starts).
  cardLikeId = input<CardLikeId | undefined>(undefined);
  cardLikeData = input<CardLike | CardLikeNoId | undefined>(undefined);
  size = input<CardSize>('half');
  // When unset, the SCSS default (--card-landscape-width) takes effect, so
  // landscape cards render at their intrinsic width. Pass an explicit value
  // only for surfaces that need a non-default width (e.g. way-picker overlay).
  displayWidthPx = input<number | undefined>(undefined);
  // Optional kind drives the bottom accent strip color and cost badge accent.
  kind = input<CardLikeKind | undefined>(undefined);
  // When true, render the small bottom accent strip. Surfaces that don't have
  // a meaningful kind (mat preview, set-aside) suppress it by passing false.
  showAccentStrip = input<boolean>(true);
  // When true, render the top-left cost cluster (treasure / potion / debt).
  // Most landscapes (landmarks, ways, prophecies) have no cost; events and
  // projects pass true.
  showCost = input<boolean>(false);

  private readonly _cards = toSignal(this._nanoStores.useStore(cardStore), { initialValue: cardStore.get() });
  private readonly _match = toSignal(this._nanoStores.useStore(matchStore), { initialValue: matchStore.get() });
  // Tracks a one-time image fallback after load error.
  private readonly _fallbackOverridePath = signal<string | undefined>(undefined);

  // Resolved card-like data — prefers a directly-supplied cardLikeData
  // (pre-match surfaces) and otherwise falls back to a cardStore / active
  // match lookup keyed by cardLikeId (in-match surfaces).
  readonly cardLike = computed(() => {
    const data = this.cardLikeData();
    if (data) return data;
    const cardLikeId = this.cardLikeId();
    if (cardLikeId === undefined) return undefined;
    const cards = this._cards();
    const match = this._match();
    return cards[cardLikeId] ?? findCardLikeInMatch(match, cardLikeId);
  });

  // Detail image path for right-click detail modal.
  readonly detailPath = computed(() => this.cardLike()?.detailImagePath);

  // Detail-resolution fallback for the rare case where the in-card art image
  // fails to load — swap to the larger detail image so something still renders.
  readonly fallbackPath = computed(() => this.cardLike()?.detailImagePath);

  // Primary resolved image path before fallback override.
  readonly resolvedPath = computed(() => {
    const cardLike = this.cardLike();
    if (!cardLike) return undefined;
    return this.resolveImagePath(cardLike, this.size());
  });

  // Final image path honoring load-error fallback override.
  readonly imagePath = computed(() => this._fallbackOverridePath() ?? this.resolvedPath());

  // Sanitized image path for UI binding.
  readonly path = computed<SafeUrl | undefined>(() => {
    const imagePath = this.imagePath();
    if (!imagePath) return undefined;
    return this._sanitizer.bypassSecurityTrustUrl(imagePath);
  });

  // Inline style for the host element. Always includes the accent color,
  // and only includes --card-like-width when a custom width was passed —
  // otherwise the SCSS default (--card-landscape-width) wins.
  readonly hostStyle = computed(() => {
    const accent = this.kindAccent();
    const width = this.displayWidthPx();
    if (width === undefined) {
      return `--card-like-accent: ${accent}`;
    }
    return `--card-like-accent: ${accent}; --card-like-width: ${width}px`;
  });

  // CSS color for the bottom accent strip — derived from the card-like's kind.
  readonly kindAccent = computed<string>(() => {
    const kind = this.kind();
    if (!kind) return 'var(--theme-color-source-default)';
    return KIND_COLOR_VAR[kind];
  });

  // Treasure cost shown in the circular badge.
  readonly treasureCost = computed<number>(() => this.cardLike()?.cost?.treasure ?? 0);

  // Optional potion cost (Alchemy expansion).
  readonly potionCost = computed<number>(() => this.cardLike()?.cost?.potion ?? 0);

  // Optional debt cost (Empires expansion).
  readonly debtCost = computed<number>(() => this.cardLike()?.cost?.debt ?? 0);

  // Reset fallback override whenever source card-like or desired size changes.
  private readonly _resetFallbackOverrideEffect = effect(() => {
    this.cardLikeId();
    this.cardLikeData();
    this.size();
    this._fallbackOverridePath.set(undefined);
  });

  // Opens a detail view when right-clicking the card-like.
  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.detailPath()) return;
    void displayCardDetail({ detailImagePath: this.detailPath()! });
  }

  // Falls back to the detail image if the requested art image fails to load.
  onImageError() {
    const fallbackPath = this.fallbackPath();
    const resolvedPath = this.resolvedPath();
    if (!fallbackPath) return;
    if (resolvedPath === fallbackPath) return;
    this._fallbackOverridePath.set(fallbackPath);
  }

  // Card-likes use the small art image in-card and the large detail image
  // for the right-click zoom view.
  private resolveImagePath(cardLike: { artImagePath: string; detailImagePath: string }, size: CardSize): string {
    if (size === 'detail') return cardLike.detailImagePath;
    return cardLike.artImagePath;
  }
}
