import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { Card, CardCost, CardId, CardKey, CardLikeId, Match, PlayerId, TokenDefinition, TokenId, TokenInstance, Trait } from 'shared/types';
import { SocketService } from '../../../core/socket-service/socket.service';
import { CardComponent } from '../../card/card.component';
import { TokenImageBadgeComponent } from '../token-image-badge/token-image-badge.component';
import { cardStore } from '../../../state/card-state';
import { cardSourceStore, getCardSourceStore } from '../../../state/card-source-store';
import { awaitingServerLockReleaseStore, promptInteractionLockStore, selectedCardStore, selectedPileStore } from '../../../state/interactive-state';
import { selectablePileStore } from '../../../state/interactive-pile-logic';
import { boardSelectionOverlayStore } from '../../../state/board-selection-overlay-state';
import { selectableCardStore, waySelectableCardStore } from '../../../state/interactive-logic';
import { cardOverrideStore } from '../../../state/card-logic';
import { basicSupplies, kingdomSupplies } from '../../../state/match-logic';
import { matchStore } from '../../../state/match-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { tokenDefinitionStore } from '../../../state/token-definition-state';
import { openCardDetailDialog } from '../../../state/card-detail-dialog-state';
import { getSupplyPileTokenVisualMap, getTokenImagePath, getTokenShortLabel } from '../views/token-utils';
import { WAY_PICKER_PANEL_WIDTH_PX, WayPickerOverlayService } from '../../../core/way-picker/way-picker-overlay.service';
import { SUPPLY_PANEL_GAP_PX } from './supply-layout.constants';

/**
 * Which half of the supply this instance renders.
 * - 'basic'   — victory + treasure piles (column 1)
 * - 'kingdom' — kingdom piles (column 2)
 */
export type MatchSupplyArea = 'basic' | 'kingdom';

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

// Render model for the local player's deck/discard stacks, rendered in the
// basic-supply panel.
type SupplyPlayerStackViewModel = {
  cardId: CardId | null;
  count: number;
  showCount: boolean;
  forceFacing: 'front' | 'back';
  selectable: boolean;
  selected: boolean;
  waySelectable: boolean;
  tokenBadges: SupplyTokenBadgeStackViewModel[];
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
    NgTemplateOutlet,
    CardComponent,
    TokenImageBadgeComponent,
  ],
  templateUrl: './match-supply.component.html',
  styleUrl: './match-supply.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Only the basic-area instance (column 1) needs to grow to fill the
    // rest of its column so the deck/discard row can bottom-anchor below
    // the victory/treasure/curse piles. The kingdom-area instance sits in
    // a horizontal row alongside the non-supply panel and must not grow.
    '[class.supply-area-basic]': "area() === 'basic'",
  },
})
export class MatchSupplyComponent {
  private static readonly WAY_PICKER_EDGE_OVERLAP_PX = 5;

  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);

  /** Controls whether this instance renders the basic supply or the kingdom supply. */
  area = input<MatchSupplyArea>('kingdom');
  visible = input(false);

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

  private readonly _boardSelectionOverlay = toSignal(this._nanoStores.useStore(boardSelectionOverlayStore), {
    initialValue: boardSelectionOverlayStore.get(),
  });

  private readonly _awaitingServerLockRelease = toSignal(this._nanoStores.useStore(awaitingServerLockReleaseStore), {
    initialValue: awaitingServerLockReleaseStore.get(),
  });

  private readonly _promptInteractionLocked = toSignal(this._nanoStores.useStore(promptInteractionLockStore), {
    initialValue: promptInteractionLockStore.get(),
  });

  // Full card-source map — used to resolve the local player's deck/discard
  // piles (rendered here, in the basic-supply panel) the same way
  // match-player-area.component.ts resolves hand/play-area cards.
  private readonly _cardSources = toSignal(this._nanoStores.useStore(cardSourceStore), {
    initialValue: cardSourceStore.get(),
  });

  private readonly _traitByPile = computed(() => this.buildTraitByPile(this._match() ?? null));

  private readonly _tokenVisualByPile = computed(() => this.buildTokenVisualByPile(this._match() ?? null, this._tokenDefinitions()));

  // Victory piles excluding Curse — rendered highest-value-first under the
  // VICTORY label in the basic supply (e.g. Colony above Province).
  readonly basicVictoryPiles = computed(() => {
    const supplies = this._basicSupplies();
    const cardIds = this._basicSupplyCardIds() ?? [];
    const victoryKeys = (supplies?.[0] ?? []).filter((key) => key !== 'curse');
    const sortedKeys = this.sortKeysByCostDescending(victoryKeys, cardIds);
    return this.buildSupplyPileModels(sortedKeys, cardIds);
  });

  // Curse pile rendered under its own CURSE label below the victory piles.
  readonly basicCursePiles = computed(() => {
    const supplies = this._basicSupplies();
    const curseKeys = (supplies?.[0] ?? []).filter((key) => key === 'curse');
    return this.buildSupplyPileModels(curseKeys, this._basicSupplyCardIds() ?? []);
  });

  // Treasure piles rendered highest-value-first under the TREASURE label in the
  // basic supply (e.g. Platinum above Gold).
  readonly basicTreasurePiles = computed(() => {
    const supplies = this._basicSupplies();
    const cardIds = this._basicSupplyCardIds() ?? [];
    const treasureKeys = supplies?.[1] ?? [];
    const sortedKeys = this.sortKeysByCostDescending(treasureKeys, cardIds);
    return this.buildSupplyPileModels(sortedKeys, cardIds);
  });

  readonly kingdomPiles = computed(() => {
    const keys = this._kingdomSupplies() ?? [];
    const cardIds = this._kingdomSupplyCardIds() ?? [];
    const sortedKeys = this.sortKeysByCostDescending(keys, cardIds);
    return this.buildSupplyPileModels(sortedKeys, cardIds);
  });

  // Deck/discard piles for the local player — rendered only when
  // area() === 'basic'. Mirrors match-player-area.component.ts's former
  // deckPile/discardPile/buildPileViewModel (moved here so the
  // basic-supply panel, not the player area, owns their layout).
  readonly deckPile = computed(() => {
    const cardsById = this._cardsById() ?? {};
    const cards = this.resolveCardsBySourceKey(this.selfSourceKey('playerDeck'), cardsById);
    const topCard = cards[cards.length - 1] ?? null;
    return this.buildPlayerStackViewModel(topCard, cards.length, 'deck');
  });

  readonly discardPile = computed(() => {
    const cardsById = this._cardsById() ?? {};
    const cards = this.resolveCardsBySourceKey(this.selfSourceKey('playerDiscard'), cardsById);
    const topCard = cards[cards.length - 1] ?? null;
    return this.buildPlayerStackViewModel(topCard, cards.length, 'discard');
  });

  readonly pileSelectionModeActive = computed(() => (this._selectablePiles()?.length ?? 0) > 0);

  // True while a board card-selection prompt is running (gain-from-supply):
  // clicks record the pile's top card id instead of tapping/buying it.
  readonly cardSelectionModeActive = computed(() => {
    const overlay = this._boardSelectionOverlay();
    return overlay.visible && overlay.selectionKind === 'card';
  });

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
        selectedPileStore.set(selected);
      } else if (this._boardSelectionOverlay().singleSelection) {
        // Exact-1 prompts replace the selection so only one pile is ever
        // highlighted at once, matching the dialog selection policy.
        selectedPileStore.set([pile.pileKey]);
      } else {
        // The count spec's maximum is a hard cap — ignore clicks beyond
        // it; the player must deselect a pile before picking another.
        if (selected.length >= this._boardSelectionOverlay().maxSelectable) {
          return;
        }
        selected.push(pile.pileKey);
        selectedPileStore.set(selected);
      }
      return;
    }

    if (this.cardSelectionModeActive()) {
      if (pile.cardId === null || !pile.selectableCard) {
        return;
      }
      const selected = [...(this._selectedCards() ?? [])];
      const existingIndex = selected.indexOf(pile.cardId);
      if (existingIndex >= 0) {
        // Re-clicking the selected pile deselects it; the confirm button
        // disables again when the selection drops below the count spec.
        selected.splice(existingIndex, 1);
        selectedCardStore.set(selected);
      } else if (this._boardSelectionOverlay().singleSelection) {
        // Exact-1 prompts replace the selection so only one pile is ever
        // highlighted at once, matching the dialog selection policy.
        selectedCardStore.set([pile.cardId]);
      } else {
        // The count spec's maximum is a hard cap — ignore clicks beyond
        // it; the player must deselect a card before picking another.
        if (selected.length >= this._boardSelectionOverlay().maxSelectable) {
          return;
        }
        selected.push(pile.cardId);
        selectedCardStore.set(selected);
      }
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
    const panelWidth = WAY_PICKER_PANEL_WIDTH_PX;
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

  // Click handler for the deck/discard stacks — mirrors the former
  // onCardClick from match-player-area.component.ts (kept separate from
  // onPileClick, which has unrelated pile-selection/card-selection
  // semantics for supply piles).
  onPlayerStackClick(cardId: CardId, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (
      this._awaitingServerLockRelease()
      || this._promptInteractionLocked()
      || !(this._selectableCards() ?? []).includes(cardId)
    ) {
      return;
    }
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    this._wayPickerOverlay.hidePicker();
    this.emitCardTapWithLock(selfPlayerId, cardId, () => {
      this._socketService.emit('cardTapped', selfPlayerId, cardId);
    });
  }

  // Way-picker hover for the deck/discard stacks — mirrors the former
  // onCardMouseEnter/onCardMouseLeave from match-player-area.component.ts.
  onPlayerStackMouseEnter(cardId: CardId, event: MouseEvent): void {
    if (
      this._awaitingServerLockRelease()
      || this._promptInteractionLocked()
      || !(this._waySelectableCards() ?? []).includes(cardId)
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
    const panelWidth = WAY_PICKER_PANEL_WIDTH_PX;
    const maxLeft = Math.max(SUPPLY_PANEL_GAP_PX, window.innerWidth - panelWidth - SUPPLY_PANEL_GAP_PX);
    let left = Math.floor(rect.right - MatchSupplyComponent.WAY_PICKER_EDGE_OVERLAP_PX);
    const top = Math.max(SUPPLY_PANEL_GAP_PX, Math.floor(rect.top));
    if (left > maxLeft) {
      left = Math.floor(rect.left - panelWidth + MatchSupplyComponent.WAY_PICKER_EDGE_OVERLAP_PX);
    }
    left = Math.max(SUPPLY_PANEL_GAP_PX, Math.min(left, maxLeft));
    this._wayPickerOverlay.showPicker({ cardId, wayCardLikeIds: ways.map((way) => way.id), left, top }, this.onWaySelected);
  }

  onPlayerStackMouseLeave(cardId: CardId): void {
    const activeCardId = this._wayPickerOverlay.activePicker()?.cardId;
    if (activeCardId === cardId) {
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
    // Build the dialog state directly (bypassing displayCardDetail's
    // cardId-only path, since a Trait isn't a Card) so the base card shows
    // as an extra alongside the trait's own art — makes the trait <-> base
    // card relationship bidirectional (base -> trait already worked via
    // displayCardDetail's extras lookup).
    const baseCard = pile.cardId !== null ? this._cardsById()[pile.cardId] : undefined;
    openCardDetailDialog({
      primary: { detailImagePath: pile.trait.detailImagePath },
      extras: baseCard ? [{ cardId: baseCard.id, detailImagePath: baseCard.detailImagePath }] : [],
    });
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

  // Builds a render model for the local player's deck or discard stack,
  // including selectability/way-picker state and (deck-only) token badges
  // parked on the deck. Mirrors the former buildPileViewModel from
  // match-player-area.component.ts.
  private buildPlayerStackViewModel(topCard: Card | null, count: number, pileType: 'deck' | 'discard'): SupplyPlayerStackViewModel {
    const cardId = topCard?.id ?? null;
    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const waySelectableCards = new Set(this._waySelectableCards() ?? []);
    const match = this._match();
    const selfPlayerId = this._selfPlayerId();
    const tokenDefinitions = this._tokenDefinitions();

    let tokenBadges: SupplyTokenBadgeStackViewModel[] = [];
    if (pileType === 'deck' && match && selfPlayerId !== undefined) {
      const playerColorMap = new Map(match.players.map((player) => [player.id, player.color]));
      const deckTokens = (Object.values(match.tokens ?? {}) as TokenInstance[])
        .filter((token) => token.location.type === 'playerDeck' && token.location.playerId === selfPlayerId)
        .map((token) => ({
          id: token.id,
          label: getTokenShortLabel(token.tokenId, tokenDefinitions[token.tokenId]),
          color: playerColorMap.get(token.ownerId ?? selfPlayerId) ?? '#ffffff',
          imagePath: getTokenImagePath(token.tokenId),
        }));
      tokenBadges = this.buildTokenBadgeStacks(deckTokens);
    }

    return {
      cardId,
      count,
      showCount: pileType !== 'discard',
      forceFacing: topCard && pileType === 'deck' && topCard.type.includes('SHADOW') ? 'front' : (pileType === 'deck' ? 'back' : 'front'),
      selectable: cardId !== null && selectableCards.has(cardId),
      selected: cardId !== null && selectedCards.has(cardId),
      waySelectable: cardId !== null && waySelectableCards.has(cardId),
      tokenBadges,
    };
  }

  // Resolves a source-key's live card list — same lookup match-player-area
  // used for hand/deck/discard/play-area sources.
  private resolveCardsBySourceKey(sourceKey: string, cardsById: Record<CardId, Card>): Card[] {
    const sourceMap = this._cardSources() ?? {};
    return (sourceMap[sourceKey] ?? [])
      .map((cardId) => cardsById[cardId])
      .filter((card): card is Card => !!card);
  }

  // Builds the per-player source key for the local player's deck/discard.
  private selfSourceKey(baseKey: 'playerDeck' | 'playerDiscard'): string {
    const selfPlayerId = this._selfPlayerId();
    return selfPlayerId === undefined ? `${baseKey}:-1` : `${baseKey}:${selfPlayerId}`;
  }

  // Sorts supply pile keys by pile treasure cost descending, then by card
  // name descending. Shared by the kingdom grid and the basic supply
  // victory/treasure columns so the highest-value pile renders first (top).
  private sortKeysByCostDescending(keys: readonly CardKey[], cardIds: readonly CardId[]): CardKey[] {
    const cardsById = this._cardsById() ?? {};
    const groupedByKey = this.groupCardIdsByKingdom(cardIds, cardsById);
    return [...keys].sort((leftKey, rightKey) => {
      const leftCard = this.getRepresentativeCard(leftKey, groupedByKey[leftKey] ?? [], cardsById);
      const rightCard = this.getRepresentativeCard(rightKey, groupedByKey[rightKey] ?? [], cardsById);
      if (!leftCard || !rightCard) {
        return leftKey.localeCompare(rightKey);
      }
      const leftCost = this.resolvePileCost(leftCard);
      const rightCost = this.resolvePileCost(rightCard);
      const costResult = (rightCost?.treasure ?? 0) - (leftCost?.treasure ?? 0);
      if (costResult !== 0) {
        return costResult;
      }
      return rightCard.cardName.localeCompare(leftCard.cardName);
    });
  }

  // Resolves a card's stable display cost: split-pile members (Castles,
  // Clashes, Knights, etc.) all share one pile-level cost stamped onto
  // `randomizerData.cost` at load time (expansion-loader-service.ts:93-97),
  // independent of which member currently sits on top — rotateSplitPile
  // changes the top card (and its own base cost) without changing this.
  // Non-split cards have no randomizerData and fall back to their own cost.
  private resolvePileCost(card: Card | null): CardCost | undefined {
    return card?.randomizerData?.cost ?? card?.cost;
  }

  // Converts one source-key list and card-source ids into render-ready supply pile models.
  private buildSupplyPileModels(keys: readonly CardKey[], cardIds: readonly CardId[]): SupplyPileViewModel[] {
    const cardsById = this._cardsById() ?? {};
    const groupedByKey = this.groupCardIdsByKingdom(cardIds, cardsById);
    return keys.map((key) => this.buildPileModel(key, groupedByKey[key] ?? [], cardsById));
  }

  // Builds a stable render model for one pile, including overlays and selectability.
  private buildPileModel(sourceKey: CardKey, pileCards: readonly Card[], cardsById: Record<CardId, Card>): SupplyPileViewModel {
    // `pileCards` (from groupCardIdsByKingdom) is already in the supply
    // source array's own order — the LAST entry is the true top of the
    // pile. Do not re-sort by id: rotateSplitPile reorders array positions
    // in place without renumbering card ids, so an id-sort would resurrect
    // the pre-rotation top for a rotated split pile.
    const topCard = pileCards[pileCards.length - 1] ?? null;
    const representativeCard = this.getRepresentativeCard(sourceKey, pileCards, cardsById);
    const pileCard = topCard ?? representativeCard ?? null;
    const pileKey = pileCard?.randomizerData?.randomizer ?? pileCard?.cardKey ?? sourceKey;

    const tokenVisual = this._tokenVisualByPile()[pileKey] ?? { tokenBadges: [], tokenChips: [] };
    const trait = this._traitByPile()[pileKey] ?? null;
    const cardId = pileCard?.id ?? null;

    // Use the effective cost from card overrides if available, otherwise fall back to the pile's stable cost.
    const overrides = this._cardOverrides();
    const effectiveCost = (representativeCard && overrides[representativeCard.id]?.cost) ?? this.resolvePileCost(representativeCard);

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
      count: pileCards.length,
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
