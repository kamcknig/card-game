import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NanostoresService } from '@nanostores/angular';
import { cardStore } from '../../state/card-state';
import { combineLatestWith, map, Subscription } from 'rxjs';
import { CardFacing, CardId, Match, TokenDefinition, TokenId, TokenInstance } from 'shared/types/index.ts';
import { NgOptimizedImage } from '@angular/common';
import { CARD_WIDTH } from '../../core/app-contants';
import { CardSize } from '../../../types';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { selfPlayerIdStore } from '../../state/player-state';
import { matchStore } from '../../state/match-state';
import { tokenDefinitionStore } from '../../state/token-definition-state';
import { getTokenShortLabel } from '../match/views/token-utils';

type CardTokenBadge = {
  id: string;
  label: string;
  color: string;
};

@Component({
  selector: 'app-card',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent implements OnInit, OnDestroy {
  @Input() cardId!: CardId;
  @Input() size: CardSize = 'full';
  // Optional override to force a card to render face up/down regardless of ownership.
  @Input() forceFacing?: CardFacing;

  path: SafeUrl | undefined;
  // Token badges to display on top of the card image.
  tokenBadges: CardTokenBadge[] = [];

  cardSub$: Subscription | undefined;

  constructor(
    private _nanoStores: NanostoresService,
    private _sanitizer: DomSanitizer,
  ) {
  }

  ngOnDestroy() {
    this.cardSub$?.unsubscribe();
  }

  ngOnInit() {
    this.cardSub$ = this._nanoStores.useStore(cardStore).pipe(
      map(store => store[this.cardId]),
      combineLatestWith(
        this._nanoStores.useStore(selfPlayerIdStore),
        this._nanoStores.useStore(matchStore),
        this._nanoStores.useStore(tokenDefinitionStore),
      ),
    ).subscribe(([card, selfId, match, tokenDefinitions]) => {
      let path: string = '';

      const effectiveFacing = this.forceFacing ?? card.facing ?? 'front';
      if (this.forceFacing) {
        // Force the facing when requested (e.g. trash previews for all players).
        path = effectiveFacing === 'back'
          ? `/assets/card-images/base-v2/${this.size}-size/card-back.jpg`
          : this.size === 'half' ? card.halfImagePath : this.size === 'full' ? card.fullImagePath : card.detailImagePath;
      }
      else if (card.owner === selfId) {
        path = this.size === 'half' ? card.halfImagePath : this.size === 'full' ? card.fullImagePath : card.detailImagePath;
      }
      else {
        path = effectiveFacing === 'back'
          ? `/assets/card-images/base-v2/${this.size}-size/card-back.jpg`
          : this.size === 'half' ? card.halfImagePath : this.size === 'full' ? card.fullImagePath : card.detailImagePath;
      }

      this.path = this._sanitizer.bypassSecurityTrustUrl(path);

      // Render tokens that are currently attached to this card.
      this.tokenBadges = this.buildTokenBadges(match, tokenDefinitions);

    });
  }

  // Computes token badge data for tokens located on this card.
  private buildTokenBadges(match: Match | null, tokenDefinitions: Record<TokenId, TokenDefinition>): CardTokenBadge[] {
    if (!match) return [];
    const playerColorMap = new Map(match.players.map(player => [player.id, player.color]));
    const tokens = Object.values(match.tokens ?? {}) as TokenInstance[];
    return tokens
      .filter(token => token.location.type === 'card' && token.location.cardId === this.cardId)
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

  // Token size mirrors pile badges: smaller for half-sized cards.
  get tokenSize(): number {
    return this.size === 'half' ? 25 : 35;
  }

  protected readonly CARD_WIDTH = CARD_WIDTH;
}
