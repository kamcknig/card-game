import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { combineLatestWith, Subscription } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NgOptimizedImage } from '@angular/common';
import { CardLikeId, Match } from 'shared/shared-types';
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
export class CardLikeComponent implements OnInit, OnDestroy {
  @Input() cardLikeId!: CardLikeId;
  @Input() size: CardSize = 'half';

  // Sanitized image path for UI binding.
  path: SafeUrl | undefined;
  // Detail image path for the right-click detail modal.
  private _detailPath: string | undefined;
  // Tracks the currently resolved image path for fallback handling.
  private _resolvedPath: string | undefined;
  // Stores the full-size fallback path for missing half-size images.
  private _fallbackPath: string | undefined;
  // Subscription to card and match stores for card-like updates.
  private _cardSub: Subscription | undefined;

  constructor(
    private _nanoStores: NanostoresService,
    private _sanitizer: DomSanitizer,
  ) {
  }

  ngOnInit() {
    // Resolve the card-like from the card library or match state on each store update.
    this._cardSub = this._nanoStores.useStore(cardStore).pipe(
      combineLatestWith(this._nanoStores.useStore(matchStore))
    ).subscribe(([cards, match]) => {
      const card = cards[this.cardLikeId];
      if (card) {
        // Cards in the card library always have art paths available.
        this._detailPath = card.detailImagePath;
        const imagePath = this.resolveImagePath(card, this.size);
        this._resolvedPath = imagePath;
        this._fallbackPath = card.fullImagePath;
        this.path = this._sanitizer.bypassSecurityTrustUrl(imagePath);
        return;
      }

      const cardLike = this.findCardLike(match);
      if (!cardLike) {
        // Clear bindings when the card-like cannot be resolved.
        this._detailPath = undefined;
        this.path = undefined;
        return;
      }

      // Resolve card-like art paths from the match state.
      this._detailPath = cardLike.detailImagePath;
      const imagePath = this.resolveImagePath(cardLike, this.size);
      this._resolvedPath = imagePath;
      this._fallbackPath = cardLike.fullImagePath;
      this.path = this._sanitizer.bypassSecurityTrustUrl(imagePath);
    });
  }

  ngOnDestroy() {
    // Clean up the store subscription.
    this._cardSub?.unsubscribe();
  }

  // Opens a detail view when right-clicking the card-like.
  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (!this._detailPath) return;
    void displayCardDetail({ detailImagePath: this._detailPath });
  }

  // Falls back to full-size art if the requested image fails to load.
  onImageError() {
    if (!this._fallbackPath) return;
    if (this._resolvedPath === this._fallbackPath) return;
    this._resolvedPath = this._fallbackPath;
    this.path = this._sanitizer.bypassSecurityTrustUrl(this._fallbackPath);
  }

  // Resolves the first matching card-like from match state.
  private findCardLike(match: Match | null) {
    if (!match) return undefined;
    const boon = match.boons?.cards?.find(card => card.id === this.cardLikeId);
    if (boon) return boon;
    const event = match.events?.find(card => card.id === this.cardLikeId);
    if (event) return event;
    return match.landmarks?.find(card => card.id === this.cardLikeId);
  }

  // Card-likes always use full-size art until half-size assets exist.
  private resolveImagePath(cardLike: { fullImagePath: string; detailImagePath: string }, size: CardSize): string {
    if (size === 'detail') return cardLike.detailImagePath;
    return cardLike.fullImagePath;
  }

  protected readonly CARD_WIDTH = CARD_WIDTH;
}
