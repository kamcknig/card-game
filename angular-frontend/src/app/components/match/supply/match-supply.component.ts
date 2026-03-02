import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { Card, CardId, CardKey, CardLikeId, Match, PlayerId, TokenDefinition, TokenId, Trait } from 'shared/types';
import { SocketService } from '../../../core/socket-service/socket.service';
import { CardComponent } from '../../card/card.component';
import { TokenImageBadgeComponent } from '../token-image-badge/token-image-badge.component';
import { cardStore } from '../../../state/card-state';
import { getCardSourceStore } from '../../../state/card-source-store';
import { awaitingServerLockReleaseStore, promptInteractionLockStore, selectedCardStore, selectedPileStore } from '../../../state/interactive-state';
import { selectablePileStore } from '../../../state/interactive-pile-logic';
import { selectableCardStore, waySelectableCardStore } from '../../../state/interactive-logic';
import { cardOverrideStore } from '../../../state/card-logic';
import { basicSupplies, kingdomSupplies } from '../../../state/match-logic';
import { matchStore } from '../../../state/match-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { tokenDefinitionStore } from '../../../state/token-definition-state';
import { displayCardDetail } from '../views/modal/display-card-detail';
import { getSupplyPileTokenVisualMap } from '../views/token-utils';
import { WayPickerOverlayService } from '../../../core/way-picker/way-picker-overlay.service';
import {
  SUPPLY_BASIC_PANEL_HEIGHT_PX,
  SUPPLY_BASIC_PANEL_WIDTH_PX,
  SUPPLY_PANEL_GAP_PX
} from './supply-layout.constants';

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SupplyTokenBadgeViewModel = {
  id: string;
  label: string;
  color: string;
  imagePath?: string;
  badgeImagePath?: string;
};

type SupplyTokenBadgeStackViewModel = {
  id: string;
  label: string;
  color: string;
  count: number;
  imagePath?: string;
  badgeImagePath?: string;
};

type SupplyTokenChipViewModel = {
  id: string;
  imagePath: string;
  count: number;
  textColor: string;
};

type SupplyPileViewModel = {
  trackKey: string;
  sourceKey: string;
  pileKey: string;
  cardId: CardId | null;
  count: number;
  treasureCost: number;
  potionCost: number;
  debtCost: number;
  trait: Trait | null;
  tokenBadgeStacks: SupplyTokenBadgeStackViewModel[];
  tokenChips: SupplyTokenChipViewModel[];
  selectableCard: boolean;
  selectedCard: boolean;
  waySelectable: boolean;
  selectablePile: boolean;
  selectedPile: boolean;
};

@Component({
  selector: 'app-match-supply',
  imports: [
    CardComponent,
    TokenImageBadgeComponent,
  ],
  templateUrl: './match-supply.component.html',
  styleUrl: './match-supply.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchSupplyComponent {
  private static readonly WAY_PICKER_PANEL_WIDTH_PX = 220;
  private static readonly WAY_PICKER_EDGE_OVERLAP_PX = 5;

  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);

  scoreRect = input<RectLike | null>(null);
  visible = input(false);

  private readonly _viewport = signal({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  private readonly _cardsById = toSignal(this._nanoStores.useStore(cardStore), {
    initialValue: cardStore.get(),
  });

  private readonly _basicSupplies = toSignal(this._nanoStores.useStore(basicSupplies), {
    initialValue: basicSupplies.get(),
  });

  private readonly _kingdomSupplies = toSignal(this._nanoStores.useStore(kingdomSupplies), {
    initialValue: kingdomSupplies.get(),
  });

  private readonly _basicSupplyCardIds = toSignal(this._nanoStores.useStore(getCardSourceStore('basicSupply')), {
    initialValue: getCardSourceStore('basicSupply').get(),
  });

  private readonly _kingdomSupplyCardIds = toSignal(this._nanoStores.useStore(getCardSourceStore('kingdomSupply')), {
    initialValue: getCardSourceStore('kingdomSupply').get(),
  });

  private readonly _match = toSignal(this._nanoStores.useStore(matchStore), {
    initialValue: matchStore.get(),
  });

  private readonly _tokenDefinitions = toSignal(this._nanoStores.useStore(tokenDefinitionStore), {
    initialValue: tokenDefinitionStore.get(),
  });

  // Per-card cost overrides for the viewing player (e.g. Ferry's -$2).
  private readonly _cardOverrides = toSignal(this._nanoStores.useStore(cardOverrideStore), {
    initialValue: cardOverrideStore.get(),
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

  readonly supplyLayout = computed(() => {
    const rect = this.scoreRect();
    const viewport = this._viewport();
    const basicLeft = SUPPLY_PANEL_GAP_PX;
    const minBasicTop = (rect?.y ?? 0) + (rect?.height ?? 0) + SUPPLY_PANEL_GAP_PX;
    const centeredBasicTop = Math.floor(viewport.height * 0.5 - SUPPLY_BASIC_PANEL_HEIGHT_PX * 0.5);
    const basicTop = Math.max(minBasicTop, centeredBasicTop);
    const kingdomLeft = Math.max((rect?.x ?? 0) + (rect?.width ?? 0), basicLeft + SUPPLY_BASIC_PANEL_WIDTH_PX) + SUPPLY_PANEL_GAP_PX;
    const kingdomTop = SUPPLY_PANEL_GAP_PX;
    return {
      basicLeft,
      basicTop,
      kingdomLeft,
      kingdomTop,
    };
  });

  private readonly _traitByPile = computed(() => this.buildTraitByPile(this._match() ?? null));

  private readonly _tokenVisualByPile = computed(() => this.buildTokenVisualByPile(this._match() ?? null, this._tokenDefinitions()));

  readonly basicVictoryPiles = computed(() => {
    const supplies = this._basicSupplies();
    const victoryKeys = supplies?.[0] ?? [];
    return this.buildSupplyPileModels(victoryKeys, this._basicSupplyCardIds() ?? []);
  });

  readonly basicTreasurePiles = computed(() => {
    const supplies = this._basicSupplies();
    const treasureKeys = supplies?.[1] ?? [];
    return this.buildSupplyPileModels(treasureKeys, this._basicSupplyCardIds() ?? []);
  });

  readonly kingdomPiles = computed(() => {
    const keys = this._kingdomSupplies() ?? [];
    const cardsById = this._cardsById() ?? {};
    const groupedByKey = this.groupCardIdsByKingdom(this._kingdomSupplyCardIds() ?? [], cardsById);
    const sortedKeys = [...keys].sort((leftKey, rightKey) => {
      const leftCard = this.getRepresentativeCard(leftKey, groupedByKey[leftKey] ?? [], cardsById);
      const rightCard = this.getRepresentativeCard(rightKey, groupedByKey[rightKey] ?? [], cardsById);
      if (!leftCard || !rightCard) {
        return leftKey.localeCompare(rightKey);
      }
      const costResult = (rightCard.cost?.treasure ?? 0) - (leftCard.cost?.treasure ?? 0);
      if (costResult !== 0) {
        return costResult;
      }
      return rightCard.cardName.localeCompare(leftCard.cardName);
    });
    return this.buildSupplyPileModels(sortedKeys, this._kingdomSupplyCardIds() ?? []);
  });

  readonly pileSelectionModeActive = computed(() => (this._selectablePiles()?.length ?? 0) > 0);

  @HostListener('window:resize')
  onWindowResize() {
    this._viewport.set({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  // Handles pile card clicks for normal taps and select-pile prompt toggles.
  onPileClick(pile: SupplyPileViewModel, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (this.pileSelectionModeActive()) {
      if (!pile.selectablePile) {
        return;
      }
      const selected = [...(this._selectedPiles() ?? [])];
      const existingIndex = selected.indexOf(pile.pileKey);
      if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
      } else {
        selected.push(pile.pileKey);
      }
      selectedPileStore.set(selected);
      return;
    }

    if (
      this._awaitingServerLockRelease() ||
      this._promptInteractionLocked() ||
      pile.cardId === null ||
      !pile.selectableCard
    ) {
      return;
    }

    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    const cardId = pile.cardId;

    this._wayPickerOverlay.hidePicker();
    this.emitCardTapWithLock(selfPlayerId, cardId, () => {
      this._socketService.emit('cardTapped', selfPlayerId, cardId);
    });
  }

  // Opens the shared way-picker overlay for one hovered way-selectable supply pile.
  onPileMouseEnter(pile: SupplyPileViewModel, event: MouseEvent) {
    if (
      pile.cardId === null ||
      !pile.waySelectable ||
      this.pileSelectionModeActive() ||
      this._awaitingServerLockRelease() ||
      this._promptInteractionLocked()
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
    const panelWidth = MatchSupplyComponent.WAY_PICKER_PANEL_WIDTH_PX;
    const maxLeft = Math.max(SUPPLY_PANEL_GAP_PX, window.innerWidth - panelWidth - SUPPLY_PANEL_GAP_PX);
    let left = Math.floor(rect.right - MatchSupplyComponent.WAY_PICKER_EDGE_OVERLAP_PX);
    const top = Math.max(SUPPLY_PANEL_GAP_PX, Math.floor(rect.top));
    if (left > maxLeft) {
      left = Math.floor(rect.left - panelWidth + MatchSupplyComponent.WAY_PICKER_EDGE_OVERLAP_PX);
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

  // Defers overlay close so pointer can move from the pile to the way-picker panel.
  onPileMouseLeave(pile: SupplyPileViewModel) {
    if (pile.cardId === null) {
      return;
    }
    const activeCardId = this._wayPickerOverlay.activePicker()?.cardId;
    if (activeCardId === pile.cardId) {
      this._wayPickerOverlay.scheduleClose();
    }
  }

  // Opens trait detail art using the existing right-click detail dialog.
  onTraitContextMenu(event: MouseEvent, pile: SupplyPileViewModel) {
    event.preventDefault();
    event.stopPropagation();
    if (!pile.trait) {
      return;
    }
    void displayCardDetail({ detailImagePath: pile.trait.detailImagePath });
  }

  // Forwards way selections from the shared overlay to the existing socket event flow.
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

  // Reuses standard card tap lock semantics for Angular supply interactions.
  private emitCardTapWithLock(selfPlayerId: PlayerId, cardId: CardId, emitTap: () => void) {
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

  // Converts one source-key list and card-source ids into render-ready supply pile models.
  private buildSupplyPileModels(keys: readonly CardKey[], cardIds: readonly CardId[]): SupplyPileViewModel[] {
    const cardsById = this._cardsById() ?? {};
    const groupedByKey = this.groupCardIdsByKingdom(cardIds, cardsById);
    return keys.map((key) => this.buildPileModel(key, groupedByKey[key] ?? [], cardsById));
  }

  // Builds a stable render model for one pile, including overlays and selectability.
  private buildPileModel(sourceKey: CardKey, pileCards: readonly Card[], cardsById: Record<CardId, Card>): SupplyPileViewModel {
    const sortedPileCards = [...pileCards].sort((left, right) => left.id - right.id);
    const topCard = sortedPileCards[sortedPileCards.length - 1] ?? null;
    const representativeCard = this.getRepresentativeCard(sourceKey, sortedPileCards, cardsById);
    const pileCard = topCard ?? representativeCard ?? null;
    const pileKey = pileCard?.randomizerData?.randomizer ?? pileCard?.cardKey ?? sourceKey;

    const tokenVisual = this._tokenVisualByPile()[pileKey] ?? { tokenBadges: [], tokenChips: [] };
    const trait = this._traitByPile()[pileKey] ?? null;
    const cardId = pileCard?.id ?? null;

    // Use the effective cost from card overrides if available, otherwise fall back to the base cost.
    const overrides = this._cardOverrides();
    const effectiveCost = (representativeCard && overrides[representativeCard.id]?.cost) ?? representativeCard?.cost;

    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const waySelectableCards = new Set(this._waySelectableCards() ?? []);
    const selectablePiles = new Set(this._selectablePiles() ?? []);
    const selectedPiles = new Set(this._selectedPiles() ?? []);

    return {
      trackKey: `${sourceKey}:${pileKey}`,
      sourceKey,
      pileKey,
      cardId,
      count: sortedPileCards.length,
      treasureCost: effectiveCost?.treasure ?? 0,
      potionCost: effectiveCost?.potion ?? 0,
      debtCost: effectiveCost?.debt ?? 0,
      trait,
      tokenBadgeStacks: this.buildTokenBadgeStacks(tokenVisual.tokenBadges.map((badge) => ({
        id: badge.id,
        label: badge.label,
        color: this.toColorHex(badge.color),
        imagePath: badge.imagePath,
        badgeImagePath: badge.badgeImagePath,
      }))),
      tokenChips: tokenVisual.tokenChips.map((chip) => ({
        id: chip.id,
        imagePath: this.resolveTokenChipImagePath(chip.assetKey),
        count: chip.count,
        textColor: chip.textColor ?? '#f4ebde',
      })),
      selectableCard: cardId !== null && selectableCards.has(cardId),
      selectedCard: cardId !== null && selectedCards.has(cardId),
      waySelectable: cardId !== null && waySelectableCards.has(cardId),
      selectablePile: selectablePiles.has(pileKey),
      selectedPile: selectedPiles.has(pileKey),
    };
  }

  // Groups supply card ids by their kingdom key.
  private groupCardIdsByKingdom(cardIds: readonly CardId[], cardsById: Record<CardId, Card>): Record<CardKey, Card[]> {
    return cardIds.reduce((acc, cardId) => {
      const card = cardsById[cardId];
      if (!card) {
        return acc;
      }
      const key = card.kingdom ?? card.cardKey;
      acc[key] ??= [];
      acc[key].push(card);
      return acc;
    }, {} as Record<CardKey, Card[]>);
  }

  // Finds a stable representative card even when a pile is empty.
  private getRepresentativeCard(sourceKey: CardKey, pileCards: readonly Card[], cardsById: Record<CardId, Card>): Card | null {
    if (pileCards.length > 0) {
      return pileCards[pileCards.length - 1] ?? null;
    }
    return Object.values(cardsById).find((card) => card.kingdom === sourceKey || card.cardKey === sourceKey) ?? null;
  }

  // Maps active traits by pile key.
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

  // Maps pile token visuals used by both basic and kingdom supply piles.
  private buildTokenVisualByPile(match: Match | null, tokenDefinitions: Record<TokenId, TokenDefinition>) {
    return getSupplyPileTokenVisualMap(match, tokenDefinitions);
  }

  // Resolves chip asset ids into concrete frontend image paths.
  private resolveTokenChipImagePath(assetKey: string): string {
    if (assetKey === 'debt-token-chip') {
      return '/assets/ui-icons/debt-icon.png';
    }
    return `/assets/ui-icons/${assetKey}.png`;
  }

  // Converts numeric token colors to CSS hex strings.
  private toColorHex(color: number): string {
    const normalized = Number.isFinite(color) ? Math.max(0, Math.min(0xffffff, Math.floor(color))) : 0xffffff;
    return `#${normalized.toString(16).padStart(6, '0')}`;
  }

  // Groups identical pile token badges and renders them as one stack with a count.
  private buildTokenBadgeStacks(badges: SupplyTokenBadgeViewModel[]): SupplyTokenBadgeStackViewModel[] {
    const grouped = new Map<string, { firstId: string; label: string; color: string; count: number; imagePath?: string; badgeImagePath?: string }>();
    for (const badge of badges) {
      const key = `${badge.label}:${badge.color}:${badge.imagePath ?? ''}:${badge.badgeImagePath ?? ''}`;
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
        imagePath: badge.imagePath,
        badgeImagePath: badge.badgeImagePath,
      });
    }

    return [...grouped.values()].map((group) => {
      return {
        id: `stack:${group.firstId}`,
        label: group.label,
        color: group.color,
        count: group.count,
        imagePath: group.imagePath,
        badgeImagePath: group.badgeImagePath,
      };
    });
  }
}
