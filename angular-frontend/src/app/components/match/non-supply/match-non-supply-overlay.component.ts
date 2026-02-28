import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { Card, CardId, CardKey, CardLikeId, Match, PlayerId, TokenDefinition, TokenId, Trait } from 'shared/types';
import { SocketService } from '../../../core/socket-service/socket.service';
import { CardComponent } from '../../card/card.component';
import { cardStore } from '../../../state/card-state';
import { nonSupplyKingdomMapStore } from '../../../state/card-source-logic';
import { matchStore } from '../../../state/match-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { tokenDefinitionStore } from '../../../state/token-definition-state';
import { awaitingServerLockReleaseStore, promptInteractionLockStore, selectedCardStore, selectedPileStore } from '../../../state/interactive-state';
import { selectablePileStore } from '../../../state/interactive-pile-logic';
import { selectableCardStore, waySelectableCardStore } from '../../../state/interactive-logic';
import { getSupplyPileTokenVisualMap } from '../views/token-utils';
import { displayCardDetail } from '../views/modal/display-card-detail';
import { WayPickerOverlayService } from '../../../core/way-picker/way-picker-overlay.service';
import {
  SUPPLY_BASIC_PANEL_WIDTH_PX,
  SUPPLY_KINGDOM_PANEL_WIDTH_PX,
  SUPPLY_PANEL_GAP_PX
} from '../supply/supply-layout.constants';

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NonSupplyTokenBadgeViewModel = {
  id: string;
  label: string;
  color: string;
};

type NonSupplyTokenBadgeStackViewModel = {
  id: string;
  label: string;
  color: string;
  count: number;
};

type NonSupplyTokenChipViewModel = {
  id: string;
  imagePath: string;
  count: number;
  textColor: string;
};

type NonSupplyPileRowViewModel = {
  trackKey: string;
  pileKey: string;
  cardId: CardId | null;
  count: number;
  forceFacing: 'front' | 'back';
  empty: boolean;
  selectableCard: boolean;
  selectedCard: boolean;
  waySelectable: boolean;
  selectablePile: boolean;
  selectedPile: boolean;
  tokenBadgeStacks: NonSupplyTokenBadgeStackViewModel[];
  tokenChips: NonSupplyTokenChipViewModel[];
  trait: Trait | null;
};

type NonSupplyKingdomSectionViewModel = {
  trackKey: string;
  displayName: string;
  isLoot: boolean;
  rows: NonSupplyPileRowViewModel[];
  estimatedHeight: number;
};

type NonSupplyKingdomColumnViewModel = {
  trackKey: string;
  sections: NonSupplyKingdomSectionViewModel[];
};

const PANEL_MAX_COLUMN_HEIGHT_PX = 425;
const HALF_CARD_HEIGHT_PX = 175;
const PILE_ROW_OFFSET_PX = 30;
const PANEL_SECTION_GAP_PX = 10;
const PANEL_SECTION_TITLE_HEIGHT_PX = 24;
const PANEL_SECTION_PADDING_PX = 10;
const WAY_PICKER_PANEL_WIDTH_PX = 220;
const WAY_PICKER_EDGE_OVERLAP_PX = 5;

@Component({
  selector: 'app-match-non-supply-overlay',
  imports: [
    CardComponent,
  ],
  templateUrl: './match-non-supply-overlay.component.html',
  styleUrl: './match-non-supply-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchNonSupplyOverlayComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);

  scoreRect = input<RectLike | null>(null);
  visible = input(false);

  private readonly _cardsById = toSignal(this._nanoStores.useStore(cardStore), {
    initialValue: cardStore.get(),
  });

  private readonly _nonSupplyKingdomMap = toSignal(this._nanoStores.useStore(nonSupplyKingdomMapStore), {
    initialValue: nonSupplyKingdomMapStore.get(),
  });

  private readonly _match = toSignal(this._nanoStores.useStore(matchStore), {
    initialValue: matchStore.get(),
  });

  private readonly _tokenDefinitions = toSignal(this._nanoStores.useStore(tokenDefinitionStore), {
    initialValue: tokenDefinitionStore.get(),
  });

  private readonly _selfPlayerId = toSignal(this._nanoStores.useStore(selfPlayerIdStore), {
    initialValue: selfPlayerIdStore.get(),
  });

  private readonly _selectableCards = toSignal(this._nanoStores.useStore(selectableCardStore), {
    initialValue: selectableCardStore.get(),
  });

  private readonly _selectedCards = toSignal(this._nanoStores.useStore(selectedCardStore), {
    initialValue: selectedCardStore.get(),
  });

  private readonly _waySelectableCards = toSignal(this._nanoStores.useStore(waySelectableCardStore), {
    initialValue: waySelectableCardStore.get(),
  });

  private readonly _selectablePiles = toSignal(this._nanoStores.useStore(selectablePileStore), {
    initialValue: selectablePileStore.get(),
  });

  private readonly _selectedPiles = toSignal(this._nanoStores.useStore(selectedPileStore), {
    initialValue: selectedPileStore.get(),
  });

  private readonly _awaitingServerLockRelease = toSignal(this._nanoStores.useStore(awaitingServerLockReleaseStore), {
    initialValue: awaitingServerLockReleaseStore.get(),
  });

  private readonly _promptInteractionLocked = toSignal(this._nanoStores.useStore(promptInteractionLockStore), {
    initialValue: promptInteractionLockStore.get(),
  });

  readonly panelLayout = computed(() => {
    const rect = this.scoreRect();
    const basicLeft = SUPPLY_PANEL_GAP_PX;
    const kingdomLeft = Math.max((rect?.x ?? 0) + (rect?.width ?? 0), basicLeft + SUPPLY_BASIC_PANEL_WIDTH_PX) + SUPPLY_PANEL_GAP_PX;
    return {
      left: kingdomLeft + SUPPLY_KINGDOM_PANEL_WIDTH_PX + SUPPLY_PANEL_GAP_PX,
      top: SUPPLY_PANEL_GAP_PX,
    };
  });

  readonly pileSelectionModeActive = computed(() => (this._selectablePiles()?.length ?? 0) > 0);

  readonly kingdomColumns = computed<NonSupplyKingdomColumnViewModel[]>(() => {
    const kingdomMap = this._nonSupplyKingdomMap() ?? {};
    const cardsById = this._cardsById() ?? {};

    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const waySelectableCards = new Set(this._waySelectableCards() ?? []);
    const selectablePiles = new Set(this._selectablePiles() ?? []);
    const selectedPiles = new Set(this._selectedPiles() ?? []);
    const traitByPile = this.buildTraitByPile(this._match() ?? null);
    const tokenVisualByPile = this.buildTokenVisualByPile(this._match() ?? null, this._tokenDefinitions());

    const sections = Object.entries(kingdomMap).map(([kingdomName, kingdomModel]) => {
      const isLoot = kingdomName === 'loot';
      const startingCards = this.resolveDisplayStartingCards(kingdomName, kingdomModel.startingCards, kingdomModel.cards);
      const rows = startingCards.map((startingCard, rowIndex) => {
        const pileCards = isLoot
          ? [...kingdomModel.cards]
          : kingdomModel.cards.filter((card) => card.cardKey === startingCard.cardKey);
        const sortedPileCards = [...pileCards].sort((left, right) => left.id - right.id);
        const topCard = sortedPileCards[sortedPileCards.length - 1] ?? null;
        const representativeCard = topCard ?? this.findCardByKey(startingCard.cardKey, cardsById);
        const cardId = representativeCard?.id ?? null;
        const pileKey = kingdomName;
        const tokenVisual = rowIndex === 0
          ? tokenVisualByPile[pileKey] ?? { tokenBadges: [], tokenChips: [] }
          : { tokenBadges: [], tokenChips: [] };

        return {
          trackKey: `${kingdomName}:${startingCard.cardKey}:${rowIndex}`,
          pileKey,
          cardId,
          count: sortedPileCards.length,
          forceFacing: isLoot ? 'back' : 'front',
          empty: sortedPileCards.length < 1,
          selectableCard: cardId !== null && selectableCards.has(cardId),
          selectedCard: cardId !== null && selectedCards.has(cardId),
          waySelectable: cardId !== null && waySelectableCards.has(cardId),
          selectablePile: selectablePiles.has(pileKey),
          selectedPile: selectedPiles.has(pileKey),
          tokenBadgeStacks: this.buildTokenBadgeStacks(tokenVisual.tokenBadges.map((badge) => ({
            id: badge.id,
            label: badge.label,
            color: this.toColorHex(badge.color),
          }))),
          tokenChips: tokenVisual.tokenChips.map((chip) => ({
            id: chip.id,
            imagePath: this.resolveTokenChipImagePath(chip.assetKey),
            count: chip.count,
            textColor: chip.textColor ?? '#f4ebde',
          })),
          trait: traitByPile[pileKey] ?? null,
        } as NonSupplyPileRowViewModel;
      });

      const effectiveRows = rows.length > 0 ? rows : [this.buildFallbackRow(kingdomName, selectablePiles, selectedPiles, traitByPile)];
      const pileHeight = HALF_CARD_HEIGHT_PX + (Math.max(0, effectiveRows.length - 1) * (isLoot ? 0 : PILE_ROW_OFFSET_PX));
      const estimatedHeight =
        (PANEL_SECTION_PADDING_PX * 2)
        + PANEL_SECTION_TITLE_HEIGHT_PX
        + PANEL_SECTION_GAP_PX
        + pileHeight;

      return {
        trackKey: `section:${kingdomName}`,
        displayName: this.toDisplayLabel(kingdomName),
        isLoot,
        rows: effectiveRows,
        estimatedHeight,
      } as NonSupplyKingdomSectionViewModel;
    });

    const columns: NonSupplyKingdomColumnViewModel[] = [];
    let currentColumn: NonSupplyKingdomColumnViewModel = {
      trackKey: 'column:0',
      sections: [],
    };
    let currentHeight = 0;

    for (const section of sections) {
      if (currentColumn.sections.length > 0 && currentHeight > PANEL_MAX_COLUMN_HEIGHT_PX) {
        columns.push(currentColumn);
        currentColumn = {
          trackKey: `column:${columns.length}`,
          sections: [],
        };
        currentHeight = 0;
      }

      currentColumn.sections.push(section);
      currentHeight += section.estimatedHeight;
      if (currentColumn.sections.length > 1) {
        currentHeight += PANEL_SECTION_GAP_PX;
      }
    }

    if (currentColumn.sections.length > 0) {
      columns.push(currentColumn);
    }

    return columns;
  });

  readonly hasColumns = computed(() => this.kingdomColumns().length > 0);

  // Handles card clicks using existing pile-select and card-tap flows.
  onPileClick(pile: NonSupplyPileRowViewModel, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.pileSelectionModeActive()) {
      if (!pile.selectablePile) {
        return;
      }
      const selected = [...(this._selectedPiles() ?? [])];
      const existingIndex = selected.indexOf(pile.pileKey as CardKey);
      if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
      } else {
        selected.push(pile.pileKey as CardKey);
      }
      selectedPileStore.set(selected);
      return;
    }

    if (
      this._awaitingServerLockRelease()
      || this._promptInteractionLocked()
      || pile.cardId === null
      || !pile.selectableCard
    ) {
      return;
    }

    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    const cardId = pile.cardId;
    if (cardId === null) {
      return;
    }

    this._wayPickerOverlay.hidePicker();
    this.emitCardTapWithLock(selfPlayerId, cardId, () => {
      this._socketService.emit('cardTapped', selfPlayerId, cardId);
    });
  }

  // Opens way picker for one hovered non-supply pile.
  onPileMouseEnter(pile: NonSupplyPileRowViewModel, event: MouseEvent): void {
    if (
      pile.cardId === null
      || !pile.waySelectable
      || this.pileSelectionModeActive()
      || this._awaitingServerLockRelease()
      || this._promptInteractionLocked()
    ) {
      return;
    }

    const ways = [...(this._match()?.ways ?? [])].sort((left, right) => left.cardKey.localeCompare(right.cardKey));
    if (ways.length < 1) {
      return;
    }

    const anchorElement = event.currentTarget as HTMLElement | null;
    if (!anchorElement) {
      return;
    }

    const rect = anchorElement.getBoundingClientRect();
    const maxLeft = Math.max(SUPPLY_PANEL_GAP_PX, window.innerWidth - WAY_PICKER_PANEL_WIDTH_PX - SUPPLY_PANEL_GAP_PX);
    let left = Math.floor(rect.right - WAY_PICKER_EDGE_OVERLAP_PX);
    const top = Math.max(SUPPLY_PANEL_GAP_PX, Math.floor(rect.top));
    if (left > maxLeft) {
      left = Math.floor(rect.left - WAY_PICKER_PANEL_WIDTH_PX + WAY_PICKER_EDGE_OVERLAP_PX);
    }
    left = Math.max(SUPPLY_PANEL_GAP_PX, Math.min(left, maxLeft));

    this._wayPickerOverlay.showPicker(
      {
        cardId: pile.cardId,
        wayCardLikeIds: ways.map((way) => way.id),
        left,
        top,
      },
      this.onWaySelected
    );
  }

  // Defers close so pointer can move from pile to way picker.
  onPileMouseLeave(pile: NonSupplyPileRowViewModel): void {
    if (pile.cardId === null) {
      return;
    }
    const activeCardId = this._wayPickerOverlay.activePicker()?.cardId;
    if (activeCardId === pile.cardId) {
      this._wayPickerOverlay.scheduleClose();
    }
  }

  // Opens trait detail art using the existing right-click detail dialog.
  onTraitContextMenu(event: MouseEvent, pile: NonSupplyPileRowViewModel): void {
    event.preventDefault();
    event.stopPropagation();
    if (!pile.trait) {
      return;
    }
    void displayCardDetail({ detailImagePath: pile.trait.detailImagePath });
  }

  // Forwards way selections from overlay to existing card-tap-as-way flow.
  private readonly onWaySelected = (selectedCardId: CardId, selectedWayId: CardLikeId) => {
    if (this._awaitingServerLockRelease() || this._promptInteractionLocked()) {
      return;
    }
    if (!(this._waySelectableCards() ?? []).includes(selectedCardId)) {
      return;
    }
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    this.emitCardTapWithLock(selfPlayerId, selectedCardId, () => {
      this._socketService.emit('cardTappedAsWay', selfPlayerId, selectedCardId, selectedWayId);
    });
  };

  // Reuses lock semantics used across Angular overlays for tap actions.
  private emitCardTapWithLock(selfPlayerId: PlayerId, cardId: CardId, emitTap: () => void): void {
    awaitingServerLockReleaseStore.set(true);
    const updated = (finishedPlayerId: PlayerId, finishedCardId?: CardId) => {
      if (finishedPlayerId !== selfPlayerId || finishedCardId !== cardId) {
        return;
      }
      this._socketService.off('cardTappedComplete', updated);
      awaitingServerLockReleaseStore.set(false);
    };
    this._socketService.on('cardTappedComplete', updated);
    emitTap();
  }

  private resolveDisplayStartingCards(kingdomName: string, startingCards: readonly { cardKey: string }[], cards: readonly Card[]) {
    if (kingdomName === 'loot') {
      if (startingCards.length > 0) {
        return [...startingCards];
      }
      const topCard = cards[cards.length - 1];
      return topCard ? [{ cardKey: topCard.cardKey }] : [];
    }

    const seen = new Set<string>();
    const deduped = startingCards.filter((card) => {
      if (seen.has(card.cardKey)) {
        return false;
      }
      seen.add(card.cardKey);
      return true;
    });
    if (deduped.length > 0) {
      return deduped;
    }

    const fallbackSeen = new Set<string>();
    return cards
      .filter((card) => {
        if (fallbackSeen.has(card.cardKey)) {
          return false;
        }
        fallbackSeen.add(card.cardKey);
        return true;
      })
      .map((card) => ({ cardKey: card.cardKey }));
  }

  private findCardByKey(cardKey: string, cardsById: Record<CardId, Card>): Card | null {
    return Object.values(cardsById).find((card) => card.cardKey === cardKey) ?? null;
  }

  private buildFallbackRow(
    kingdomName: string,
    selectablePiles: Set<CardKey>,
    selectedPiles: Set<CardKey>,
    traitByPile: Record<string, Trait>
  ): NonSupplyPileRowViewModel {
    return {
      trackKey: `${kingdomName}:empty`,
      pileKey: kingdomName,
      cardId: null,
      count: 0,
      forceFacing: kingdomName === 'loot' ? 'back' : 'front',
      empty: true,
      selectableCard: false,
      selectedCard: false,
      waySelectable: false,
      selectablePile: selectablePiles.has(kingdomName as CardKey),
      selectedPile: selectedPiles.has(kingdomName as CardKey),
      tokenBadgeStacks: [],
      tokenChips: [],
      trait: traitByPile[kingdomName] ?? null,
    };
  }

  private buildTraitByPile(match: Match | null): Record<string, Trait> {
    const traitByPile: Record<string, Trait> = {};
    for (const trait of match?.traits ?? []) {
      if (!trait.pileKey) {
        continue;
      }
      traitByPile[trait.pileKey] = trait;
    }
    return traitByPile;
  }

  private buildTokenVisualByPile(match: Match | null, tokenDefinitions: Record<TokenId, TokenDefinition>) {
    return getSupplyPileTokenVisualMap(match, tokenDefinitions);
  }

  private resolveTokenChipImagePath(assetKey: string): string {
    if (assetKey === 'debt-token-chip') {
      return '/assets/ui-icons/debt-icon.png';
    }
    return `/assets/ui-icons/${assetKey}.png`;
  }

  private toColorHex(color: number): string {
    const normalized = Number.isFinite(color) ? Math.max(0, Math.min(0xffffff, Math.floor(color))) : 0xffffff;
    return `#${normalized.toString(16).padStart(6, '0')}`;
  }

  private buildTokenBadgeStacks(badges: NonSupplyTokenBadgeViewModel[]): NonSupplyTokenBadgeStackViewModel[] {
    const grouped = new Map<string, { firstId: string; label: string; color: string; count: number }>();
    for (const badge of badges) {
      const key = `${badge.label}:${badge.color}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      grouped.set(key, {
        firstId: badge.id,
        label: badge.label,
        color: badge.color,
        count: 1,
      });
    }

    return [...grouped.values()].map((group) => ({
      id: `stack:${group.firstId}`,
      label: group.label,
      color: group.color,
      count: group.count,
    }));
  }

  private toDisplayLabel(value: string): string {
    if (!value) {
      return value;
    }
    return `${value[0].toUpperCase()}${value.slice(1)}`;
  }
}
