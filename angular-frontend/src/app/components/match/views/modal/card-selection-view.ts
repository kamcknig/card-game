import { Application, Assets, Container, FederatedPointerEvent, Sprite } from 'pixi.js'
import { Card, CardId, CardLikeId, UserPromptKinds } from 'shared/shared-types';
import { CARD_WIDTH, STANDARD_GAP } from '../../../../core/app-contants';
import { createCardView } from '../../../../core/card/create-card-view';
import { List } from '@pixi/ui';
import { cardStore } from '../../../../state/card-state';
import { toNumber } from 'es-toolkit/compat';
import { CardView } from '../card-view';
import { clientSelectableCardsOverrideStore, selectedCardStore } from '../../../../state/interactive-state';
import { resolveCountSpec } from 'shared/resolve-count-spec';
import { validateCountSpec } from 'shared/validate-count-spec';
import { displayCardDetail } from './display-card-detail';
import { selfPlayerIdStore } from '../../../../state/player-state';
import { matchStore } from '../../../../state/match-state';

// Local id alias used for temporary selection mapping.
type NewCardId = CardId;

// Container extension to track selection ids and detail art for card-like prompts.
type SelectionView = Container & {
  selectionId?: number;
  detailImagePath?: string;
};

export const cardSelectionView = (app: Application, args: UserPromptKinds) => {
  if (args.type !== 'select' && args.type !== 'display-cards') {
    throw new Error('card selection modal requires card or card-like selection types');
  }

  const displayOnly = args.type === 'display-cards';

  // Support combined card and card-like lists in a single prompt.
  const cardIds = args.cardIds ?? [];
  const cardLikeIds = args.cardLikeIds ?? [];
  if (!cardIds.length && !cardLikeIds.length) throw new Error('Cards cannot be empty');

  const selectableCardIds = args.type === 'select'
    ? args.selectableCardIds ?? cardIds
    : [];
  const selectableCardLikeIds = args.type === 'select'
    ? args.selectableCardLikeIds ?? cardLikeIds
    : [];

  let newCardToOldCardMap = new Map<NewCardId, CardId | CardLikeId>();
  let maxId = toNumber(Object.keys(cardStore.get()).sort().slice(-1)[0]);

  const cardCount = cardIds.length;
  const cardLikeCount = cardLikeIds.length;
  const selectCount = 'selectCount' in args ? args.selectCount ?? 1 : 0;
  // Normalize the selection count for auto-finish logic.
  const resolvedCountSpec = resolveCountSpec(selectCount);
  // Parent container hosts card and card-like rows.
  const contentView = new Container();

  const validate = () => {
    let validated = displayOnly || validateCountSpec(selectCount, selectedCardStore.get().length);

    contentView.emit('validationUpdated', validated);

    if (validated) {
      contentView.emit('resultsUpdated', selectedCardStore.get().map(id => newCardToOldCardMap.get(id)));

      if (!displayOnly && resolvedCountSpec.kind === 'fixed' && resolvedCountSpec.count === 1) {
        contentView.emit('finished');
      }
      if (!displayOnly && resolvedCountSpec.kind === 'range' && resolvedCountSpec.min === 1 && resolvedCountSpec.max === 1) {
        // Auto-finish for a fixed range of 1.
        contentView.emit('finished');
      }
    }
    return validated;
  };

  const cardPointerDownListener = (event: FederatedPointerEvent) => {
    const target = event.currentTarget as SelectionView;
    const selectionId = target.selectionId;
    if (!selectionId) return;

    if (event.button === 2) {
      if (target instanceof CardView && target.facing === 'front') {
        const cardId = newCardToOldCardMap.get(target.card.id);
        if (!cardId) return;
        void displayCardDetail(cardId);
        return;
      }
      if (target.detailImagePath) {
        void displayCardDetail({ detailImagePath: target.detailImagePath });
        return;
      }
    }

    if (displayOnly) return;

    if (selectedCardStore.get().includes(selectionId)) {
      selectedCardStore.set(selectedCardStore.get().filter(c => c !== selectionId));
      target.y = 0;
    }
    else {
      selectedCardStore.set(selectedCardStore.get().concat(selectionId));
      target.y = -10;
    }

    validate();
  };

  const cardRemovedListener = (view: Container) => {
    view.removeAllListeners();
  }

  const cardList = new List({ type: 'horizontal' });
  cardList.elementsMargin = cardCount > 6 ? -CARD_WIDTH * .5 : STANDARD_GAP;

  for (const cardId of cardIds) {
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
    newCardToOldCardMap.set(tempCard.id, cardId as CardId);
    const idx = (selectableCardIds as CardId[]).indexOf(cardId as CardId);
    // if it's selectable add the listeners
    if (idx !== -1) {
      (selectableCardIds as CardId[])[idx] = tempCard.id;
      view.on('pointerdown', cardPointerDownListener)
      view.on('removed', cardRemovedListener);
    }
    cardList.addChild(view);
  }

  // Build a separate row for card-like entries below the cards.
  const cardLikeList = new List({ type: 'horizontal' });
  cardLikeList.elementsMargin = cardLikeCount > 6 ? -CARD_WIDTH * .5 : STANDARD_GAP;

  for (const cardLikeId of cardLikeIds) {
    const match = matchStore.get();
    const cardLike = match?.boons?.cards?.find(card => card.id === cardLikeId)
      ?? match?.hexes?.cards?.find(card => card.id === cardLikeId)
      ?? match?.events?.find(card => card.id === cardLikeId)
      ?? match?.landmarks?.find(card => card.id === cardLikeId)
      ?? match?.states?.cards?.find(card => card.id === cardLikeId);

    if (!cardLike) {
      console.warn(`[card-selection] missing card-like data for id ${cardLikeId}`);
      continue;
    }

    const displayId = ++maxId;
    // Build a card-like sprite view for selection prompts.
    const view = new Container() as SelectionView;
    view.label = `card-like-${cardLike.cardKey}:${displayId}`;
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
    cardLikeList.addChild(view);
  }

  // Layout cards first, then card-likes beneath them.
  let yOffset = 0;
  if (cardList.children.length > 0) {
    cardList.x = Math.floor(-cardList.width * .5);
    cardList.y = yOffset;
    contentView.addChild(cardList);
    yOffset += cardList.height + STANDARD_GAP;
  }

  if (cardLikeList.children.length > 0) {
    cardLikeList.x = Math.floor(-cardLikeList.width * .5);
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
