import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NanostoresService } from '@nanostores/angular';
import { CardComponent } from '../../card/card.component';
import { SocketService } from '../../../core/socket-service/socket.service';
import { WayPickerOverlayService } from '../../../core/way-picker/way-picker-overlay.service';
import { PromptDialogCoordinatorService } from '../../../core/prompt-dialog/prompt-dialog-coordinator.service';
import {
  Card,
  CardId,
  CardLikeId,
  CardType,
  PlayerId,
  TokenInstance
} from 'shared/types';
import { cardStore } from '../../../state/card-state';
import { cardSourceStore } from '../../../state/card-source-store';
import { matchStore } from '../../../state/match-state';
import { selfPlayerIdStore } from '../../../state/player-state';
import { tokenDefinitionStore } from '../../../state/token-definition-state';
import { selectableCardStore, waySelectableCardStore } from '../../../state/interactive-logic';
import {
  awaitingServerLockReleaseStore,
  promptInteractionLockStore,
  selectedCardStore
} from '../../../state/interactive-state';
import {
  currentPlayerTurnIdStore,
  playerActionsStore,
  playerBuysStore,
  playerPotionStore,
  playerTreasureStore,
  turnPhaseStore
} from '../../../state/turn-state';
import { cofferStore, debtStore, villagerStore } from '../../../state/resource-logic';
import { CARD_WIDTH, STANDARD_GAP } from '../../../core/app-contants';
import { SUPPLY_PANEL_GAP_PX } from '../supply/supply-layout.constants';
import { CountBadgeComponent } from '../count-badge/count-badge.component';
import { TokenImageBadgeComponent } from '../token-image-badge/token-image-badge.component';
import { getTokenImagePath, getTokenShortLabel } from '../views/token-utils';

type CardEntryViewModel = {
  trackKey: string;
  cardId: CardId;
  selectable: boolean;
  selected: boolean;
  waySelectable: boolean;
  dimmed: boolean;
};

type HandGroupViewModel = {
  trackKey: string;
  cardId: CardId;
  count: number;
  selectable: boolean;
  selected: boolean;
  waySelectable: boolean;
};

type TokenBadgeViewModel = {
  id: string;
  label: string;
  color: string;
  count: number;
  imagePath?: string;
};

type TokenCubeViewModel = {
  id: string;
  color: string;
};

type ResourceStateViewModel = {
  actions: number;
  treasure: number;
  buys: number;
  potions: number;
  coffers: number;
  villagers: number;
  debt: number;
};

type CardPileViewModel = {
  cardId: CardId | null;
  forceFacing: 'front' | 'back';
  count: number;
  showCount: boolean;
  selectable: boolean;
  selected: boolean;
  waySelectable: boolean;
  tokenBadges: TokenBadgeViewModel[];
};

const CUBE_TOKEN_ID = 'cube-token';
const VICTORY_TOKEN_ID = 'prosperity:victory';
const WAY_PICKER_PANEL_WIDTH_PX = 220;
const WAY_PICKER_EDGE_OVERLAP_PX = 5;

@Component({
  selector: 'app-match-player-area',
  imports: [
    CardComponent,
    CountBadgeComponent,
    TokenImageBadgeComponent,
  ],
  templateUrl: './match-player-area.component.html',
  styleUrl: './match-player-area.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchPlayerAreaComponent {
  private readonly _nanoStores = inject(NanostoresService);
  private readonly _socketService = inject(SocketService);
  private readonly _wayPickerOverlay = inject(WayPickerOverlayService);
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);

  visible = input(false);

  nextPhaseRequested = output<void>();
  playAllTreasuresRequested = output<void>();

  private readonly _viewport = signal({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  private readonly _cardsById = toSignal(this._nanoStores.useStore(cardStore), {
    initialValue: cardStore.get(),
  });

  private readonly _cardSources = toSignal(this._nanoStores.useStore(cardSourceStore), {
    initialValue: cardSourceStore.get(),
  });

  private readonly _match = toSignal(this._nanoStores.useStore(matchStore), {
    initialValue: matchStore.get(),
  });

  private readonly _selfPlayerId = toSignal(this._nanoStores.useStore(selfPlayerIdStore), {
    initialValue: selfPlayerIdStore.get(),
  });

  private readonly _tokenDefinitions = toSignal(this._nanoStores.useStore(tokenDefinitionStore), {
    initialValue: tokenDefinitionStore.get(),
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

  private readonly _awaitingServerLockRelease = toSignal(this._nanoStores.useStore(awaitingServerLockReleaseStore), {
    initialValue: awaitingServerLockReleaseStore.get(),
  });

  private readonly _promptInteractionLocked = toSignal(this._nanoStores.useStore(promptInteractionLockStore), {
    initialValue: promptInteractionLockStore.get(),
  });

  private readonly _turnPhase = toSignal(this._nanoStores.useStore(turnPhaseStore), {
    initialValue: turnPhaseStore.get(),
  });

  private readonly _currentPlayerTurnId = toSignal(this._nanoStores.useStore(currentPlayerTurnIdStore), {
    initialValue: currentPlayerTurnIdStore.get(),
  });

  private readonly _playerTreasure = toSignal(this._nanoStores.useStore(playerTreasureStore), {
    initialValue: playerTreasureStore.get(),
  });

  private readonly _playerActions = toSignal(this._nanoStores.useStore(playerActionsStore), {
    initialValue: playerActionsStore.get(),
  });

  private readonly _playerBuys = toSignal(this._nanoStores.useStore(playerBuysStore), {
    initialValue: playerBuysStore.get(),
  });

  private readonly _playerPotions = toSignal(this._nanoStores.useStore(playerPotionStore), {
    initialValue: playerPotionStore.get(),
  });

  private readonly _coffersByPlayer = toSignal(this._nanoStores.useStore(cofferStore), {
    initialValue: cofferStore.get(),
  });

  private readonly _villagersByPlayer = toSignal(this._nanoStores.useStore(villagerStore), {
    initialValue: villagerStore.get(),
  });

  private readonly _debtByPlayer = toSignal(this._nanoStores.useStore(debtStore), {
    initialValue: debtStore.get(),
  });

  private readonly _showCofferControls = signal(false);
  private readonly _showVillagerControls = signal(false);
  private readonly _showDebtControls = signal(false);
  private readonly _cofferExchangeAmount = signal(0);
  private readonly _villagerSpendAmount = signal(0);
  private readonly _debtPayAmount = signal(0);

  /**
   * Computes responsive hand-panel sizing from the current viewport width.
   *
   * `handMaxWidth` caps the hand-panel-shell so it does not overflow the column
   * when many cards are in play alongside deck and discard stacks.
   * `handCompact` activates the overlap-stacking style for the hand cards when
   * the viewport is narrower than 1680px.
   */
  readonly layout = computed(() => {
    const viewport = this._viewport();
    return {
      handMaxWidth: Math.max(460, viewport.width - (CARD_WIDTH * 2 + STANDARD_GAP * 8)),
      handCompact: viewport.width < 1680,
    };
  });

  readonly handGroups = computed(() => {
    const cardsById = this._cardsById() ?? {};
    const handCards = this.resolveCardsBySourceKey(this.selfSourceKey('playerHand'), cardsById);
    const sortedCards = this.sortHandCards(handCards);
    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const waySelectableCards = new Set(this._waySelectableCards() ?? []);

    const groups = Object.values(
      sortedCards.reduce((acc, card) => {
        acc[card.cardKey] ??= [];
        acc[card.cardKey].push(card);
        return acc;
      }, {} as Record<string, Card[]>)
    );

    return groups.map((group) => {
      const topCard = group[group.length - 1];
      return {
        trackKey: `${topCard.cardKey}:${topCard.id}:${group.length}`,
        cardId: topCard.id,
        count: group.length,
        selectable: selectableCards.has(topCard.id),
        selected: selectedCards.has(topCard.id),
        waySelectable: waySelectableCards.has(topCard.id),
      } as HandGroupViewModel;
    });
  });

  readonly playAreaCards = computed(() => {
    const cardsById = this._cardsById() ?? {};
    const match = this._match();
    const currentTurnHistoryIndex = match ? Math.max(0, match.stats.turns.length - 1) : -1;
    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const waySelectableCards = new Set(this._waySelectableCards() ?? []);

    return this.resolveCardsBySourceKey('playArea', cardsById).map((card) => {
      const playedCardStats = match?.stats?.playedCards?.[card.id];
      const dimmed =
        card.type.includes('DURATION')
        && playedCardStats?.turnHistoryIndex !== undefined
        && playedCardStats.turnHistoryIndex !== currentTurnHistoryIndex;
      return {
        trackKey: `play:${card.id}`,
        cardId: card.id,
        selectable: selectableCards.has(card.id),
        selected: selectedCards.has(card.id),
        waySelectable: waySelectableCards.has(card.id),
        dimmed,
      } as CardEntryViewModel;
    });
  });

  readonly deckPile = computed(() => {
    const cardsById = this._cardsById() ?? {};
    const cards = this.resolveCardsBySourceKey(this.selfSourceKey('playerDeck'), cardsById);
    const topCard = cards[cards.length - 1] ?? null;
    return this.buildPileViewModel(topCard, cards.length, 'deck');
  });

  readonly discardPile = computed(() => {
    const cardsById = this._cardsById() ?? {};
    const cards = this.resolveCardsBySourceKey(this.selfSourceKey('playerDiscard'), cardsById);
    const topCard = cards[cards.length - 1] ?? null;
    return this.buildPileViewModel(topCard, cards.length, 'discard');
  });

  readonly activeDurationCardIds = computed(() => {
    const sourceMap = this._cardSources() ?? {};
    return [...(sourceMap['activeDuration'] ?? [])];
  });

  readonly stateCardLikeIds = computed(() => {
    const selfPlayerId = this._selfPlayerId();
    const match = this._match();
    if (selfPlayerId === undefined || !match) {
      return [];
    }
    return [...(match.states?.byPlayer?.[selfPlayerId] ?? [])];
  });

  readonly artifactCardLikeIds = computed(() => {
    const selfPlayerId = this._selfPlayerId();
    const match = this._match();
    if (selfPlayerId === undefined || !match) {
      return [];
    }
    return [...(match.artifacts?.byPlayer?.[selfPlayerId] ?? [])];
  });

  readonly resourceState = computed<ResourceStateViewModel>(() => {
    const selfPlayerId = this._selfPlayerId();
    return {
      actions: this._playerActions() ?? 0,
      treasure: this._playerTreasure() ?? 0,
      buys: this._playerBuys() ?? 0,
      potions: this._playerPotions() ?? 0,
      coffers: selfPlayerId === undefined ? 0 : (this._coffersByPlayer()?.[selfPlayerId] ?? 0),
      villagers: selfPlayerId === undefined ? 0 : (this._villagersByPlayer()?.[selfPlayerId] ?? 0),
      debt: selfPlayerId === undefined ? 0 : (this._debtByPlayer()?.[selfPlayerId] ?? 0),
    };
  });

  // Controls visibility of turn action buttons (next phase, play all treasures).
  readonly canUseTurnActions = computed(() => {
    const selfPlayerId = this._selfPlayerId();
    return (
      selfPlayerId !== undefined
      && this._currentPlayerTurnId() === selfPlayerId
      && !this._awaitingServerLockRelease()
      && !this._promptInteractionLocked()
    );
  });

  // Label for the next-phase button based on current turn phase.
  readonly nextPhaseLabel = computed(() => {
    const phase = this._turnPhase();
    switch (phase) {
      case 'action':
        return 'END ACTIONS';
      case 'buy':
        return 'END BUYS';
      default:
        return 'NEXT';
    }
  });

  // Whether the play-all-treasures shortcut should appear.
  readonly showPlayAllTreasures = computed(() => {
    if (!this.canUseTurnActions() || this._turnPhase() !== 'buy') {
      return false;
    }
    const cardsById = this._cardsById() ?? {};
    const handCards = this.resolveCardsBySourceKey(this.selfSourceKey('playerHand'), cardsById);
    return handCards.some((card) => card.type?.includes('TREASURE'));
  });

  readonly canSpendVillagers = computed(() => {
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return false;
    }
    return (
      this._currentPlayerTurnId() === selfPlayerId
      && this._turnPhase() === 'action'
      && this.resourceState().villagers > 0
    );
  });

  readonly availableCubeTokens = computed(() => {
    const match = this._match();
    const selfPlayerId = this._selfPlayerId();
    if (!match || selfPlayerId === undefined) {
      return [];
    }

    const playerColor = match.players.find((player) => player.id === selfPlayerId)?.color ?? '#ffffff';
    return (Object.values(match.tokens ?? {}) as TokenInstance[])
      .filter((token) =>
        token.ownerId === selfPlayerId
        && token.tokenId === CUBE_TOKEN_ID
        && token.location.type === 'playerAvailable'
      )
      .map((token) => ({
        id: token.id,
        color: playerColor,
      } as TokenCubeViewModel))
      .sort((left, right) => left.id.localeCompare(right.id));
  });

  readonly availableTokenBadges = computed(() => {
    const match = this._match();
    const selfPlayerId = this._selfPlayerId();
    const tokenDefinitions = this._tokenDefinitions();
    if (!match || selfPlayerId === undefined) {
      return [];
    }

    const playerColorMap = new Map(match.players.map((player) => [player.id, player.color]));
    const tokenBadges = (Object.values(match.tokens ?? {}) as TokenInstance[])
      .filter((token) =>
        token.ownerId === selfPlayerId
        && token.tokenId !== CUBE_TOKEN_ID
        && token.tokenId !== VICTORY_TOKEN_ID
        && token.location.type === 'playerAvailable'
      )
      .map((token) => ({
        id: token.id,
        label: getTokenShortLabel(token.tokenId, tokenDefinitions[token.tokenId]),
        color: playerColorMap.get(token.ownerId ?? selfPlayerId) ?? '#ffffff',
        imagePath: getTokenImagePath(token.tokenId),
      }));

    return this.buildTokenBadgeStacks(tokenBadges);
  });

  readonly activeTokenBadges = computed(() => {
    const match = this._match();
    const selfPlayerId = this._selfPlayerId();
    const tokenDefinitions = this._tokenDefinitions();
    if (!match || selfPlayerId === undefined) {
      return [];
    }

    const playerColorMap = new Map(match.players.map((player) => [player.id, player.color]));
    const tokenBadges = (Object.values(match.tokens ?? {}) as TokenInstance[])
      .filter((token) =>
        token.ownerId === selfPlayerId
        && token.tokenId !== VICTORY_TOKEN_ID
        && token.location.type === 'player'
      )
      .map((token) => ({
        id: token.id,
        label: getTokenShortLabel(token.tokenId, tokenDefinitions[token.tokenId]),
        color: playerColorMap.get(token.ownerId ?? selfPlayerId) ?? '#ffffff',
        imagePath: getTokenImagePath(token.tokenId),
      }));

    return this.buildTokenBadgeStacks(tokenBadges);
  });

  readonly showCofferControls = this._showCofferControls.asReadonly();
  readonly showVillagerControls = this._showVillagerControls.asReadonly();
  readonly showDebtControls = this._showDebtControls.asReadonly();
  readonly cofferExchangeAmount = this._cofferExchangeAmount.asReadonly();
  readonly villagerSpendAmount = this._villagerSpendAmount.asReadonly();
  readonly debtPayAmount = this._debtPayAmount.asReadonly();

  private readonly _resourceControlsSyncEffect = effect(() => {
    const resourceState = this.resourceState();
    const debtPayMax = Math.min(resourceState.debt, resourceState.treasure);
    this._cofferExchangeAmount.update((value) => Math.min(value, resourceState.coffers));
    this._villagerSpendAmount.update((value) => Math.min(value, resourceState.villagers));
    this._debtPayAmount.update((value) => Math.min(value, debtPayMax));

    if (resourceState.coffers < 1) {
      this._showCofferControls.set(false);
    }
    if (!this.canSpendVillagers()) {
      this._showVillagerControls.set(false);
    }
    if (debtPayMax < 1) {
      this._showDebtControls.set(false);
    }
  });

  @HostListener('window:resize')
  onWindowResize(): void {
    this._viewport.set({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  // Emits the next-phase request to parent for relay to the match controller.
  onNextPhaseRequested(): void {
    this.nextPhaseRequested.emit();
  }

  // Emits the play-all-treasures request to parent for relay to the match controller.
  onPlayAllTreasuresRequested(): void {
    this.playAllTreasuresRequested.emit();
  }

  // Forwards card taps using the same lock behavior used by other Angular overlays.
  onCardClick(cardId: CardId, event: MouseEvent): void {
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

  // Opens the shared way picker for cards that can currently be played as a Way.
  onCardMouseEnter(cardId: CardId, event: MouseEvent): void {
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
    const maxLeft = Math.max(
      SUPPLY_PANEL_GAP_PX,
      window.innerWidth - WAY_PICKER_PANEL_WIDTH_PX - SUPPLY_PANEL_GAP_PX
    );
    let left = Math.floor(rect.right - WAY_PICKER_EDGE_OVERLAP_PX);
    const top = Math.max(SUPPLY_PANEL_GAP_PX, Math.floor(rect.top));
    if (left > maxLeft) {
      left = Math.floor(rect.left - WAY_PICKER_PANEL_WIDTH_PX + WAY_PICKER_EDGE_OVERLAP_PX);
    }
    left = Math.max(SUPPLY_PANEL_GAP_PX, Math.min(left, maxLeft));

    this._wayPickerOverlay.showPicker(
      {
        cardId,
        wayCardLikeIds: ways.map((way) => way.id),
        left,
        top,
      },
      this.onWaySelected
    );
  }

  // Defers close so pointer can move from one card to the way-picker panel.
  onCardMouseLeave(cardId: CardId): void {
    const activeCardId = this._wayPickerOverlay.activePicker()?.cardId;
    if (activeCardId === cardId) {
      this._wayPickerOverlay.scheduleClose();
    }
  }

  // Opens a prompt dialog listing active duration cards currently in effect.
  onActiveDurationCardsRequested(): void {
    const selfPlayerId = this._selfPlayerId();
    const activeDurationCardIds = this.activeDurationCardIds();
    if (selfPlayerId === undefined || activeDurationCardIds.length < 1) {
      return;
    }
    void this._promptDialogCoordinator.openPrompt(
      {
        playerId: selfPlayerId,
        prompt: 'Active duration cards',
        content: {
          type: 'display-cards',
          cardIds: activeDurationCardIds,
          cardLikeIds: [],
        },
      },
      selfPlayerId
    ).catch((error) => {
      console.warn('[player area overlay] failed to open active duration dialog');
      console.debug(error);
    });
  }

  // Opens a prompt dialog listing currently-owned States.
  onStatesRequested(): void {
    const selfPlayerId = this._selfPlayerId();
    const stateCardLikeIds = this.stateCardLikeIds();
    if (selfPlayerId === undefined || stateCardLikeIds.length < 1) {
      return;
    }
    void this._promptDialogCoordinator.openPrompt(
      {
        playerId: selfPlayerId,
        prompt: 'States',
        content: {
          type: 'display-cards',
          cardIds: [],
          cardLikeIds: stateCardLikeIds,
        },
      },
      selfPlayerId
    ).catch((error) => {
      console.warn('[player area overlay] failed to open states dialog');
      console.debug(error);
    });
  }

  // Opens a prompt dialog listing currently-owned Artifacts.
  onArtifactsRequested(): void {
    const selfPlayerId = this._selfPlayerId();
    const artifactCardLikeIds = this.artifactCardLikeIds();
    if (selfPlayerId === undefined || artifactCardLikeIds.length < 1) {
      return;
    }
    void this._promptDialogCoordinator.openPrompt(
      {
        playerId: selfPlayerId,
        prompt: 'Artifacts',
        content: {
          type: 'display-cards',
          cardIds: [],
          cardLikeIds: artifactCardLikeIds,
        },
      },
      selfPlayerId
    ).catch((error) => {
      console.warn('[player area overlay] failed to open artifacts dialog');
      console.debug(error);
    });
  }

  // Toggles coffer exchange controls.
  onToggleCofferControls(): void {
    if (this._showCofferControls()) {
      this._showCofferControls.set(false);
      return;
    }
    this.closeResourceControls();
    this._cofferExchangeAmount.set(0);
    this._showCofferControls.set(true);
  }

  onIncreaseCofferExchange(): void {
    const maxValue = this.resourceState().coffers;
    if (this._cofferExchangeAmount() >= maxValue) {
      return;
    }
    this._cofferExchangeAmount.update((value) => value + 1);
  }

  onDecreaseCofferExchange(): void {
    if (this._cofferExchangeAmount() < 1) {
      return;
    }
    this._cofferExchangeAmount.update((value) => value - 1);
  }

  onExecuteCofferExchange(): void {
    const amount = this._cofferExchangeAmount();
    this._showCofferControls.set(false);
    this._cofferExchangeAmount.set(0);
    if (amount < 1) {
      return;
    }
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    this._socketService.emit('exchangeCoffer', selfPlayerId, amount);
  }

  // Toggles villager spend controls.
  onToggleVillagerControls(): void {
    if (this._showVillagerControls()) {
      this._showVillagerControls.set(false);
      return;
    }
    this.closeResourceControls();
    this._villagerSpendAmount.set(0);
    this._showVillagerControls.set(true);
  }

  onIncreaseVillagerSpend(): void {
    const maxValue = this.resourceState().villagers;
    if (this._villagerSpendAmount() >= maxValue) {
      return;
    }
    this._villagerSpendAmount.update((value) => value + 1);
  }

  onDecreaseVillagerSpend(): void {
    if (this._villagerSpendAmount() < 1) {
      return;
    }
    this._villagerSpendAmount.update((value) => value - 1);
  }

  onExecuteVillagerSpend(): void {
    const amount = this._villagerSpendAmount();
    this._showVillagerControls.set(false);
    this._villagerSpendAmount.set(0);
    if (amount < 1) {
      return;
    }
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    this._socketService.emit('spendVillager', selfPlayerId, amount);
  }

  // Toggles debt payment controls.
  onToggleDebtControls(): void {
    if (this._showDebtControls()) {
      this._showDebtControls.set(false);
      return;
    }
    this.closeResourceControls();
    this._debtPayAmount.set(0);
    this._showDebtControls.set(true);
  }

  onIncreaseDebtPay(): void {
    const maxValue = Math.min(this.resourceState().debt, this.resourceState().treasure);
    if (this._debtPayAmount() >= maxValue) {
      return;
    }
    this._debtPayAmount.update((value) => value + 1);
  }

  onDecreaseDebtPay(): void {
    if (this._debtPayAmount() < 1) {
      return;
    }
    this._debtPayAmount.update((value) => value - 1);
  }

  onExecuteDebtPay(): void {
    const amount = this._debtPayAmount();
    this._showDebtControls.set(false);
    this._debtPayAmount.set(0);
    if (amount < 1) {
      return;
    }
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return;
    }
    this._socketService.emit('payDebt', selfPlayerId, amount);
  }

  private closeResourceControls(): void {
    this._showCofferControls.set(false);
    this._showVillagerControls.set(false);
    this._showDebtControls.set(false);
  }

  // Forwards a Way choice through the existing server event flow.
  private readonly onWaySelected = (selectedCardId: CardId, selectedWayId: CardLikeId) => {
    if (
      this._awaitingServerLockRelease()
      || this._promptInteractionLocked()
      || !(this._waySelectableCards() ?? []).includes(selectedCardId)
    ) {
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

  // Wraps one card tap emission in the same await-lock flow used elsewhere.
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

  private buildPileViewModel(topCard: Card | null, count: number, pileType: 'deck' | 'discard'): CardPileViewModel {
    const cardId = topCard?.id ?? null;
    const selectableCards = new Set(this._selectableCards() ?? []);
    const selectedCards = new Set(this._selectedCards() ?? []);
    const waySelectableCards = new Set(this._waySelectableCards() ?? []);
    const match = this._match();
    const selfPlayerId = this._selfPlayerId();
    const tokenDefinitions = this._tokenDefinitions();

    let tokenBadges: TokenBadgeViewModel[] = [];
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

  private resolveCardsBySourceKey(sourceKey: string, cardsById: Record<CardId, Card>): Card[] {
    const sourceMap = this._cardSources() ?? {};
    return (sourceMap[sourceKey] ?? [])
      .map((cardId) => cardsById[cardId])
      .filter((card): card is Card => !!card);
  }

  private selfSourceKey(baseKey: 'playerHand' | 'playerDeck' | 'playerDiscard'): string {
    const selfPlayerId = this._selfPlayerId();
    if (selfPlayerId === undefined) {
      return `${baseKey}:-1`;
    }
    return `${baseKey}:${selfPlayerId}`;
  }

  // Matches previous hand sort order: Actions, Reactions, Treasures, Victory, Other.
  private sortHandCards(cards: readonly Card[]): Card[] {
    const categoryMap: Record<string, number> = { ACTION: 0, REACTION: 1, TREASURE: 2, VICTORY: 3, OTHER: 4 };
    const categorized = cards.reduce(
      (acc, card) => {
        const category = Object.keys(categoryMap).find((type) => card.type.includes(type as CardType));
        if (category) {
          acc[categoryMap[category]].push(card);
        } else {
          acc[4].push(card);
        }
        return acc;
      },
      [[], [], [], [], []] as Card[][]
    );

    const treasureRankings = ['copper', 'silver', 'gold'];
    const treasureOrderRanking = treasureRankings.reduce(
      (acc, name, index) => ({ ...acc, [name]: index }),
      {} as Record<string, number>
    );

    const victoryRankings = ['estate', 'duchy', 'province'];
    const victoryOrderRanking = victoryRankings.reduce(
      (acc, name, index) => ({ ...acc, [name]: index }),
      {} as Record<string, number>
    );

    return [
      categorized[0].sort((left, right) => left.cardName.localeCompare(right.cardName)),
      categorized[1].sort((left, right) => left.cardName.localeCompare(right.cardName)),
      categorized[2].sort((left, right) => {
        const leftRank = treasureOrderRanking[left.cardKey] ?? Infinity;
        const rightRank = treasureOrderRanking[right.cardKey] ?? Infinity;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.cardName.localeCompare(right.cardName);
      }),
      categorized[3].sort((left, right) => {
        const leftRank = victoryOrderRanking[left.cardKey] ?? Infinity;
        const rightRank = victoryOrderRanking[right.cardKey] ?? Infinity;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.cardName.localeCompare(right.cardName);
      }),
      categorized[4].sort((left, right) => left.cardName.localeCompare(right.cardName))
    ].flat();
  }

  // Groups matching token badges into one badge with a count.
  private buildTokenBadgeStacks(badges: Array<{ id: string; label: string; color: string; imagePath?: string }>): TokenBadgeViewModel[] {
    const grouped = new Map<string, TokenBadgeViewModel>();
    for (const badge of badges) {
      const key = `${badge.label}:${badge.color}:${badge.imagePath ?? ''}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      grouped.set(key, {
        id: `token-stack:${badge.id}`,
        label: badge.label,
        color: badge.color,
        count: 1,
        imagePath: badge.imagePath,
      });
    }
    return [...grouped.values()].sort((left, right) => {
      const labelComparison = left.label.localeCompare(right.label);
      if (labelComparison !== 0) {
        return labelComparison;
      }
      return left.color.localeCompare(right.color);
    });
  }
}
