import { Application, Assets, Container, FederatedPointerEvent, Graphics, Sprite } from 'pixi.js'
import { Card, CardId, CardLikeId, UserPromptKinds } from 'shared/types';
import { CARD_WIDTH, STANDARD_GAP } from '../../../../core/app-contants';
import { createCardView } from '../../../../core/card/create-card-view';
import { List } from '@pixi/ui';
import { cardStore } from '../../../../state/card-state';
import { toNumber } from 'es-toolkit/compat';
import { clientSelectableCardsOverrideStore, selectedCardStore } from '../../../../state/interactive-state';
import { resolveCountSpec } from 'shared/resolve-count-spec';
import { validateCountSpec } from 'shared/validate-count-spec';
import { findCardLikeInMatch } from 'shared/find-card-like-in-match';
import { displayCardDetail } from './display-card-detail';
import { selfPlayerIdStore } from '../../../../state/player-state';
import { matchStore } from '../../../../state/match-state';
import { getCardSourceStore } from '../../../../state/card-source-store';
import { getPixiSceneTheme } from '../../../../theme/pixi-theme';
import { debugRuntimeContextStore } from '../../../../state/debug-runtime-state';

// Local id alias used for temporary selection mapping.
type NewCardId = CardId;

// Container extension to track selection ids and detail art for landscape prompts.
type SelectionView = Container & {
  selectionId?: number;
  detailImagePath?: string;
};

// Structural typing for card views to avoid instanceof checks in Pixi containers.
type CardViewLike = Container & {
  card: Card;
  facing: string;
};

// Type guard for card view containers.
const isCardViewLike = (target: Container): target is CardViewLike => 'card' in target && 'facing' in target;
// Type guard for landscape selection containers.
const isSelectionView = (target: Container): target is SelectionView => 'selectionId' in target;

export const cardSelectionView = (app: Application, args: UserPromptKinds) => {
  const DEFAULT_TOOLTIP_CLOSE_DELAY_MS = 160;
  if (args.type !== 'select' && args.type !== 'display-cards') {
    throw new Error('card selection modal requires card or landscape selection types');
  }

  const displayOnly = args.type === 'display-cards';

  // Support combined card and landscape lists in a single prompt.
  const cardIds = args.cardIds ?? [];
  const cardLikeIds = args.cardLikeIds ?? [];
  if (!cardIds.length && !cardLikeIds.length) throw new Error('Cards cannot be empty');

  const selectableCardIds = args.type === 'select'
    ? args.selectableCardIds ?? cardIds
    : [];
  const selectableCardLikeIds = args.type === 'select'
    ? args.selectableCardLikeIds ?? cardLikeIds
    : [];

  // Snapshot the trash pile so cards from trash render face up in prompts.
  const trashCardIds = new Set(getCardSourceStore('trash').get());

  let newCardToOldCardMap = new Map<NewCardId, CardId | CardLikeId>();
  let maxId = toNumber(Object.keys(cardStore.get()).sort().slice(-1)[0]);
  const selectionViewById = new Map<NewCardId, Container>();

  const cardCount = cardIds.length;
  const cardLikeCount = cardLikeIds.length;
  const selectCount = 'selectCount' in args ? args.selectCount ?? 1 : 0;
  // Normalize the selection count for auto-finish logic.
  const resolvedCountSpec = resolveCountSpec(selectCount);
  const singleSelect = resolvedCountSpec.kind === 'fixed'
    ? resolvedCountSpec.count === 1
    : resolvedCountSpec.min === 1 && resolvedCountSpec.max === 1;
  // Parent container hosts card and landscape rows.
  const contentView = new Container();
  const pixiTheme = getPixiSceneTheme();
  const tooltipCloseDelayMs = Math.max(
    0,
    Math.floor(debugRuntimeContextStore.get()?.tooltipDefaultCloseDelayMs ?? DEFAULT_TOOLTIP_CLOSE_DELAY_MS),
  );
  const match = matchStore.get();
  const activeWays = match?.ways ?? [];
  const playCardSelectionEnabled = !displayOnly && args.type === 'select' && args.playCard === true && singleSelect;
  const showWayPicker = playCardSelectionEnabled && activeWays.length > 0;
  let selectedWayId: CardLikeId | null = null;
  let selectedWaySelectionId: NewCardId | null = null;
  const wayTooltipContainer = new Container({ label: 'promptWayTooltip' });
  wayTooltipContainer.visible = false;
  wayTooltipContainer.eventMode = 'static';
  contentView.addChild(wayTooltipContainer);
  let wayTooltipCardSelectionId: NewCardId | null = null;
  let wayTooltipCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  const validate = () => {
    let validated = displayOnly || validateCountSpec(selectCount, selectedCardStore.get().length);

    contentView.emit('validationUpdated', validated);

    if (validated) {
      const selectedCardIds = selectedCardStore.get()
        .map((id) => newCardToOldCardMap.get(id))
        .filter((id): id is CardId => typeof id === 'number');
      contentView.emit('resultsUpdated', selectedCardIds);
      if (playCardSelectionEnabled) {
        contentView.emit(
          'selectedWayUpdated',
          selectedCardIds.length === 1 && selectedCardStore.get()[0] === selectedWaySelectionId
            ? selectedWayId
            : null,
        );
      }

      // Keep play-selection prompts open so the player can pick a Way before finishing.
      if (!displayOnly && !showWayPicker && resolvedCountSpec.kind === 'fixed' && resolvedCountSpec.count === 1) {
        contentView.emit('finished');
      }
      if (
        !displayOnly &&
        !showWayPicker &&
        resolvedCountSpec.kind === 'range' &&
        resolvedCountSpec.min === 1 &&
        resolvedCountSpec.max === 1
      ) {
        // Auto-finish for a fixed range of 1.
        contentView.emit('finished');
      }
    }
    return validated;
  };

  // Keeps selected-card offsets visually in sync with selectedCardStore.
  const syncSelectionOffsets = () => {
    const selectedIds = new Set(selectedCardStore.get());
    selectionViewById.forEach((view, selectionId) => {
      view.y = selectedIds.has(selectionId) ? -10 : 0;
    });
  };

  // Clears any delayed tooltip close timer.
  const cancelWayTooltipClose = () => {
    if (wayTooltipCloseTimeout) {
      clearTimeout(wayTooltipCloseTimeout);
      wayTooltipCloseTimeout = null;
    }
  };

  // Schedules delayed close so cursor can move from card to tooltip without flicker.
  const scheduleWayTooltipClose = () => {
    cancelWayTooltipClose();
    wayTooltipCloseTimeout = setTimeout(() => {
      wayTooltipCloseTimeout = null;
      hideWayTooltip();
    }, tooltipCloseDelayMs);
  };

  // Hides and destroys the prompt-local Way tooltip contents.
  const hideWayTooltip = () => {
    cancelWayTooltipClose();
    wayTooltipCardSelectionId = null;
    wayTooltipContainer.visible = false;
    wayTooltipContainer.removeChildren().forEach((child) => {
      child.removeAllListeners();
      child.destroy({ children: true });
    });
  };

  // Applies a Way selection to the selected card and re-runs prompt validation/auto-finish.
  const selectCardAsWay = (selectionId: NewCardId, wayId: CardLikeId) => {
    selectedCardStore.set([selectionId]);
    selectedWaySelectionId = selectionId;
    selectedWayId = wayId;
    syncSelectionOffsets();
    validate();
    hideWayTooltip();
  };

  // Builds and displays the prompt-local Way tooltip for the hovered card.
  const showWayTooltipForCard = (cardView: CardViewLike) => {
    if (!showWayPicker) {
      return;
    }
    const selectionId = cardView.card.id as NewCardId;
    if (wayTooltipCardSelectionId === selectionId && wayTooltipContainer.visible) {
      return;
    }

    hideWayTooltip();
    wayTooltipContainer.visible = true;
    wayTooltipCardSelectionId = selectionId;
    const sortedWays = [...activeWays].sort((a, b) => a.cardKey.localeCompare(b.cardKey));
    const pickerPadding = 8;
    const wayGap = 8;
    const wayScale = .75;
    let y = pickerPadding;
    let maxRowWidth = 0;

    for (const way of sortedWays) {
      const row = new Container({ label: `promptWayRow:${way.id}` });
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.x = pickerPadding;
      row.y = y;

      const texture = Assets.get(`${way.cardKey}-full`);
      const sprite = new Sprite({ texture: texture });
      if (!texture) {
        Assets.load(way.fullImagePath).then((loadedTexture) => {
          sprite.texture = loadedTexture;
        });
      }
      sprite.scale = wayScale;
      row.addChild(sprite);

      const hoverHighlight = new Graphics({ label: `promptWayHover:${way.cardKey}` });
      row.addChildAt(hoverHighlight, 0);

      // Draws row highlight state for tooltip item hover feedback.
      const drawHoverState = (hovered: boolean) => {
        hoverHighlight.clear();
        if (!hovered) {
          return;
        }
        hoverHighlight
          .roundRect(-4, -4, sprite.width + 8, sprite.height + 8, 6)
          .fill({ color: 0x00d5ff, alpha: .25 })
          .stroke({ color: 0x00d5ff, width: 2 });
      };

      row.on('pointerover', () => {
        cancelWayTooltipClose();
        drawHoverState(true);
      });
      row.on('pointerout', () => {
        drawHoverState(false);
        scheduleWayTooltipClose();
      });
      row.on('pointerdown', (event) => {
        event.stopPropagation();
        if (event.button === 2) {
          return;
        }
        selectCardAsWay(selectionId, way.id);
      });

      wayTooltipContainer.addChild(row);
      maxRowWidth = Math.max(maxRowWidth, Math.floor(sprite.width));
      y += Math.floor(sprite.height) + wayGap;
    }

    const panelHeight = y - wayGap + pickerPadding;
    const panelWidth = maxRowWidth + pickerPadding * 2;
    const panel = new Graphics({ label: 'promptWayPanel' });
    panel.roundRect(0, 0, panelWidth, panelHeight, 8);
    panel.fill({ color: pixiTheme.overlay.color, alpha: pixiTheme.overlay.mediumAlpha });
    panel.stroke({ color: 0x00d5ff, width: 1.5 });
    wayTooltipContainer.addChildAt(panel, 0);

    const globalCardPosition = cardView.getGlobalPosition();
    const localCardPosition = contentView.toLocal(globalCardPosition);
    let tooltipX = Math.floor(localCardPosition.x + cardView.width + STANDARD_GAP);
    let tooltipY = Math.floor(localCardPosition.y);
    const maxX = app.renderer.width - panelWidth - STANDARD_GAP;
    const maxY = app.renderer.height - panelHeight - STANDARD_GAP;

    if (tooltipX > maxX) {
      tooltipX = Math.floor(localCardPosition.x - panelWidth - STANDARD_GAP);
    }

    tooltipX = Math.max(STANDARD_GAP, Math.min(tooltipX, maxX));
    tooltipY = Math.max(STANDARD_GAP, Math.min(tooltipY, maxY));
    wayTooltipContainer.x = tooltipX;
    wayTooltipContainer.y = tooltipY;
  };

  wayTooltipContainer.on('pointerover', () => cancelWayTooltipClose());
  wayTooltipContainer.on('pointerout', () => scheduleWayTooltipClose());
  contentView.on('removed', () => hideWayTooltip());

  const cardPointerDownListener = (event: FederatedPointerEvent) => {
    const target = event.currentTarget as Container;
    const isCardView = isCardViewLike(target);
    const selectionId = isCardView
      ? target.card.id
      : 'selectionId' in target
        ? (target as SelectionView).selectionId
        : undefined;
    if (!selectionId) return;

    if (event.button === 2) {
      if (isCardView && target.facing === 'front') {
        const cardId = newCardToOldCardMap.get(target.card.id);
        if (!cardId) return;
        void displayCardDetail(cardId);
        return;
      }
      // Landscape views expose a detail image path for right-click inspection.
      if (isSelectionView(target) && target.detailImagePath) {
        void displayCardDetail({ detailImagePath: target.detailImagePath });
        return;
      }
    }

    if (displayOnly) return;

    if (selectedCardStore.get().includes(selectionId)) {
      selectedCardStore.set(selectedCardStore.get().filter(c => c !== selectionId));
      if (selectedWaySelectionId === selectionId) {
        selectedWaySelectionId = null;
        selectedWayId = null;
      }
    }
    else {
      if (selectedWaySelectionId !== null && selectedWaySelectionId !== selectionId) {
        selectedWaySelectionId = null;
        selectedWayId = null;
      }
      selectedCardStore.set(selectedCardStore.get().concat(selectionId));
    }

    hideWayTooltip();
    syncSelectionOffsets();
    validate();
  };

  const cardRemovedListener = (view: Container) => {
    view.removeAllListeners();
  }

  const cardList = new List({ type: 'horizontal' });
  cardList.elementsMargin = cardCount > 6 ? -CARD_WIDTH * .5 : STANDARD_GAP;

  for (const cardId of cardIds) {
    const isTrashCard = trashCardIds.has(cardId as CardId);
    const baseCard = cardStore.get()[cardId as CardId];
    if (!baseCard) {
      console.warn(`[card-selection] missing card data for id ${cardId}`);
      continue;
    }
    // Clone the card data so we don't mutate the shared card store when remapping IDs.
    const tempCard = new Card({ ...baseCard, id: ++maxId });
    const view = createCardView(tempCard);
    if (baseCard.owner === selfPlayerIdStore.get()) {
      // Allow the owning player to see their own facedown cards in selection prompts.
      view.facing = 'front';
    }
    if (isTrashCard) {
      // Trash viewing should always show the card face up regardless of owner.
      view.facing = 'front';
    }
    newCardToOldCardMap.set(tempCard.id, cardId as CardId);
    const idx = (selectableCardIds as CardId[]).indexOf(cardId as CardId);
    // if it's selectable add the listeners
    if (idx !== -1) {
      (selectableCardIds as CardId[])[idx] = tempCard.id;
      view.on('pointerdown', cardPointerDownListener)
      if (showWayPicker && baseCard.type.includes('ACTION')) {
        view.on('pointerover', () => {
          cancelWayTooltipClose();
          showWayTooltipForCard(view);
        });
        view.on('pointerout', () => {
          scheduleWayTooltipClose();
        });
      }
      view.on('removed', cardRemovedListener);
    }
    selectionViewById.set(tempCard.id, view);
    cardList.addChild(view);
  }

  // Build a separate row for landscape entries below the cards.
  const cardLikeList = new List({ type: 'horizontal' });
  cardLikeList.elementsMargin = cardLikeCount > 6 ? -CARD_WIDTH * .5 : STANDARD_GAP;

  for (const cardLikeId of cardLikeIds) {
    const cardLike = findCardLikeInMatch(match, cardLikeId);

    if (!cardLike) {
      console.warn(`[card-selection] missing landscape data for id ${cardLikeId}`);
      continue;
    }

    const displayId = ++maxId;
    // Build a landscape sprite view for selection prompts.
    const view = new Container() as SelectionView;
    view.label = `landscape-${cardLike.cardKey}:${displayId}`;
    view.eventMode = 'static';
    const sprite = new Sprite({ label: 'cardLikeSprite' });
    const texture = Assets.get(`${cardLike.cardKey}-full`);
    if (texture) {
      sprite.texture = texture;
    }
    else {
      Assets.load(cardLike.fullImagePath).then(result => {
        sprite.texture = result;
      });
    }
    view.addChild(sprite);

    view.selectionId = displayId;
    view.detailImagePath = cardLike.detailImagePath;
    newCardToOldCardMap.set(displayId, cardLikeId);

    const idx = selectableCardLikeIds.indexOf(cardLikeId);
    if (idx !== -1) {
      selectableCardLikeIds[idx] = displayId;
      view.on('pointerdown', cardPointerDownListener);
      view.on('removed', cardRemovedListener);
    }
    selectionViewById.set(displayId, view);
    cardLikeList.addChild(view);
  }

  // Layout cards first, then landscapes beneath them using a positive-width container.
  // The modal container handles final centering, so rows should not use negative x offsets.
  const rowWidths = [
    cardList.children.length > 0 ? cardList.width : 0,
    cardLikeList.children.length > 0 ? cardLikeList.width : 0,
  ];
  const contentWidth = Math.max(...rowWidths);

  let yOffset = 0;
  if (cardList.children.length > 0) {
    cardList.x = Math.floor((contentWidth - cardList.width) * .5);
    cardList.y = yOffset;
    contentView.addChild(cardList);
    yOffset += cardList.height + STANDARD_GAP;
  }

  if (cardLikeList.children.length > 0) {
    cardLikeList.x = Math.floor((contentWidth - cardLikeList.width) * .5);
    cardLikeList.y = yOffset;
    contentView.addChild(cardLikeList);
  }

  if (!displayOnly) {
    setTimeout(() => {
      validate();
    }, 0);

    clientSelectableCardsOverrideStore.set([...selectableCardIds, ...selectableCardLikeIds]);
  }

  return contentView
}
