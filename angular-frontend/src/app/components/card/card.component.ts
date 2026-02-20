import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { cardStore } from '../../state/card-state';
import { CardFacing, CardId, Match, TokenDefinition, TokenId, TokenInstance } from 'shared/types';
import { NgOptimizedImage } from '@angular/common';
import { CARD_WIDTH } from '../../core/app-contants';
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

@Component({
  selector: 'app-card',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _sanitizer = inject(DomSanitizer);

  cardId = input.required<CardId>();
  size = input<CardSize>('full');
  // Optional override to force a card to render face up/down regardless of ownership.
  forceFacing = input<CardFacing | undefined>(undefined);

  private readonly _cards = toSignal(this._nanoStores.useStore(cardStore), { initialValue: cardStore.get() });
  private readonly _selfPlayerId = toSignal(this._nanoStores.useStore(selfPlayerIdStore), { initialValue: selfPlayerIdStore.get() });
  private readonly _match = toSignal(this._nanoStores.useStore(matchStore));
  private readonly _tokenDefinitions = toSignal(this._nanoStores.useStore(tokenDefinitionStore), { initialValue: tokenDefinitionStore.get() });

  // Active card model for this component instance.
  readonly card = computed(() => this._cards()?.[this.cardId()]);
  // Detail image path for right-click detail modal.
  readonly detailPath = computed(() => this.card()?.detailImagePath);

  // Sanitized card image URL resolved from ownership/facing.
  readonly path = computed<SafeUrl | undefined>(() => {
    const card = this.card();
    if (!card) return undefined;

    const size = this.size();
    const forcedFacing = this.forceFacing();
    const effectiveFacing = forcedFacing ?? card.facing ?? 'front';
    let path = '';

    if (forcedFacing) {
      // Force the facing when requested (e.g. trash previews for all players).
      path = effectiveFacing === 'back'
        ? `/assets/card-images/base-v2/${size}-size/card-back.jpg`
        : size === 'half' ? card.halfImagePath : size === 'full' ? card.fullImagePath : card.detailImagePath;
    }
    else if (card.owner === this._selfPlayerId()) {
      path = size === 'half' ? card.halfImagePath : size === 'full' ? card.fullImagePath : card.detailImagePath;
    }
    else {
      path = effectiveFacing === 'back'
        ? `/assets/card-images/base-v2/${size}-size/card-back.jpg`
        : size === 'half' ? card.halfImagePath : size === 'full' ? card.fullImagePath : card.detailImagePath;
    }

    return this._sanitizer.bypassSecurityTrustUrl(path);
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
    if (!this.detailPath()) return;
    void displayCardDetail(this.cardId());
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

  protected readonly CARD_WIDTH = CARD_WIDTH;
}
