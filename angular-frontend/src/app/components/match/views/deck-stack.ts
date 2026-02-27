import { cardStore } from '../../../state/card-state';
import { CountBadgeView } from './count-badge-view';
import { CardStackArgs, CardStackCardRenderLayout, CardStackView } from './card-stack';
import { selectedCardStore } from '../../../state/interactive-state';

type DeckStackArgs = CardStackArgs & {
  shadowGroupOffsetPx?: number;
};

type ShadowGroupEntry = {
  cardId: number;
  globalIndex: number;
};

type ShadowGroupRenderData = {
  cardKey: string;
  count: number;
  offsetY: number;
  members: ShadowGroupEntry[];
  topGlobalIndex: number;
};

export class DeckStackView extends CardStackView {
  private readonly _shadowGroupOffsetPx: number;
  private _shadowGroups: ShadowGroupRenderData[] = [];

  constructor(args: DeckStackArgs) {
    super(args);
    this._shadowGroupOffsetPx = args.shadowGroupOffsetPx ?? 30;
  }

  // Builds deck-only shadow card layout overrides while preserving source order and ids.
  protected override buildCardRenderLayout(cardIds: readonly number[]): Map<number, CardStackCardRenderLayout> {
    const renderLayoutByCardId = new Map<number, CardStackCardRenderLayout>();
    const shadowGroupEntriesByKey = new Map<string, ShadowGroupEntry[]>();
    this._shadowGroups = [];

    for (const [globalIndex, cardId] of cardIds.entries()) {
      const card = cardStore.get()[cardId];
      if (!card || !card.type.includes('SHADOW')) {
        continue;
      }

      const existingEntries = shadowGroupEntriesByKey.get(card.cardKey);
      if (!existingEntries) {
        shadowGroupEntriesByKey.set(card.cardKey, [{ cardId, globalIndex }]);
        continue;
      }
      existingEntries.push({ cardId, globalIndex });
    }

    const groupedShadowCards = Array.from(shadowGroupEntriesByKey.entries()).map(([cardKey, members]) => {
      const topEntry = members[members.length - 1];
      return {
        cardKey,
        count: members.length,
        members,
        topGlobalIndex: topEntry.globalIndex,
      };
    });

    if (groupedShadowCards.length < 1) {
      return renderLayoutByCardId;
    }

    // Rank groups by top-of-group position in global deck order (higher index is closer to top of deck).
    groupedShadowCards.sort((left, right) => right.topGlobalIndex - left.topGlobalIndex);

    const deckTopIndex = cardIds.length - 1;
    const firstGroupIsDeckTop = groupedShadowCards[0].topGlobalIndex === deckTopIndex;
    const firstGroupOffset = firstGroupIsDeckTop ? 0 : this._shadowGroupOffsetPx;

    this._shadowGroups = groupedShadowCards.map((group, groupRank) => ({
      ...group,
      offsetY: -(firstGroupOffset + groupRank * this._shadowGroupOffsetPx),
    }));

    for (const group of this._shadowGroups) {
      for (const member of group.members) {
        renderLayoutByCardId.set(member.cardId, {
          facing: 'front',
          y: group.offsetY,
        });
      }
    }

    return renderLayoutByCardId;
  }

  // Adds per-group shadow counters in the top-left corner of each grouped stack.
  protected override drawStackOverlays(_cardIds: readonly number[]): void {
    super.drawStackOverlays(_cardIds);
    const selectedCardIds = new Set(selectedCardStore.get());

    for (const group of this._shadowGroups) {
      // Keep the group badge aligned with a lifted selected shadow stack.
      const hasSelectedCardInGroup = group.members.some((member) => selectedCardIds.has(member.cardId));
      const selectedYOffset = hasSelectedCardInGroup ? -60 : 0;
      const badge = new CountBadgeView({
        count: group.count,
        label: `shadow-group-count:${group.cardKey}:${group.topGlobalIndex}`,
      });
      badge.x = this._cardContainer.x + 5;
      badge.y = this._cardContainer.y + 5 + (group.offsetY + selectedYOffset) * this._sscale;
      badge.scale = this._sscale;
      this._stackOverlayContainer.addChild(badge);
    }
  }
}
