import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NgOptimizedImage } from '@angular/common';
import { CardLikeId } from 'shared/types';
import { findCardLikeInMatch } from 'shared/find-card-like-in-match';
import { CardSize } from '../../../types';
import { cardStore } from '../../state/card-state';
import { matchStore } from '../../state/match-state';
import { CARD_WIDTH } from '../../core/app-contants';
import { displayCardDetail } from '../match/views/modal/display-card-detail';

@Component({
  selector: 'app-card-like',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './card-like.component.html',
  styleUrl: './card-like.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardLikeComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _sanitizer = inject(DomSanitizer);

  cardLikeId = input.required<CardLikeId>();
  size = input<CardSize>('half');
  displayWidthPx = input<number>(CARD_WIDTH);

  private readonly _cards = toSignal(this._nanoStores.useStore(cardStore), { initialValue: cardStore.get() });
  private readonly _match = toSignal(this._nanoStores.useStore(matchStore), { initialValue: matchStore.get() });
  // Tracks a one-time image fallback after load error.
  private readonly _fallbackOverridePath = signal<string | undefined>(undefined);

  // Resolved card-like data from library or active match.
  readonly cardLike = computed(() => {
    const cards = this._cards();
    const match = this._match();
    const cardLikeId = this.cardLikeId();
    return cards[cardLikeId] ?? findCardLikeInMatch(match, cardLikeId);
  });

  // Detail image path for right-click detail modal.
  readonly detailPath = computed(() => this.cardLike()?.detailImagePath);

  // Full-size fallback image path for missing half-size assets.
  readonly fallbackPath = computed(() => this.cardLike()?.fullImagePath);

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

  // Width used by image-based layouts (way-picker, landscape overlay).
  readonly imageWidth = computed(() => this.displayWidthPx());

  // Reset fallback override whenever source card-like or desired size changes.
  private readonly _resetFallbackOverrideEffect = effect(() => {
    this.cardLikeId();
    this.size();
    this._fallbackOverridePath.set(undefined);
  });

  // Opens a detail view when right-clicking the card-like.
  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (!this.detailPath()) return;
    void displayCardDetail({ detailImagePath: this.detailPath()! });
  }

  // Falls back to full-size art if the requested image fails to load.
  onImageError() {
    const fallbackPath = this.fallbackPath();
    const resolvedPath = this.resolvedPath();
    if (!fallbackPath) return;
    if (resolvedPath === fallbackPath) return;
    this._fallbackOverridePath.set(fallbackPath);
  }

  // Card-likes always use full-size art until half-size assets exist.
  private resolveImagePath(cardLike: { fullImagePath: string; detailImagePath: string }, size: CardSize): string {
    if (size === 'detail') return cardLike.detailImagePath;
    return cardLike.fullImagePath;
  }
}
