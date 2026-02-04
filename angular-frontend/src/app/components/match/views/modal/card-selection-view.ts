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
  const isCardLike = args.type === 'select-card-likes' || args.type === 'display-card-likes';
  if (!isCardLike && args.type !== 'select' && args.type !== 'display-cards') {
    throw new Error('card selection modal requires card or card-like selection types');
  }

  const displayOnly = args.type === 'display-cards' || args.type === 'display-card-likes';

  const cardLikeIds = isCardLike ? (args as { cardLikeIds: CardLikeId[] }).cardLikeIds : undefined;
  const cardIds = isCardLike ? cardLikeIds : (args as { cardIds: CardId[] }).cardIds;
  if (!cardIds) throw new Error('Cards cannot be empty');

  const selectableCardIds = args.type === 'select'
    ? (args as { selectableCardIds?: CardId[] }).selectableCardIds ?? cardIds
    : args.type === 'select-card-likes'
    ? (args as { selectableCardLikeIds?: CardLikeId[] }).selectableCardLikeIds ?? cardIds
    : [];

  let newCardToOldCardMap = new Map<NewCardId, CardId | CardLikeId>();
  let maxId = toNumber(Object.keys(cardStore.get()).sort().slice(-1)[0]);

  const cardCount = cardIds.length;
  const selectCount = 'selectCount' in args ? args.selectCount ?? 1 : 0;
  // Normalize the selection count for auto-finish logic.
  const resolvedCountSpec = resolveCountSpec(selectCount);

  const validate = () => {
    let validated = displayOnly || validateCountSpec(selectCount, selectedCardStore.get().length);

    cardList.emit('validationUpdated', validated);

    if (validated) {
      cardList.emit('resultsUpdated', selectedCardStore.get().map(id => newCardToOldCardMap.get(id)));

      if (!displayOnly && resolvedCountSpec.kind === 'fixed' && resolvedCountSpec.count === 1) {
        cardList.emit('finished');
      }
      if (!displayOnly && resolvedCountSpec.kind === 'range' && resolvedCountSpec.min === 1 && resolvedCountSpec.max === 1) {
        // Auto-finish for a fixed range of 1.
        cardList.emit('finished');
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
    if (isCardLike) {
      const match = matchStore.get();
      const cardLike = match?.boons?.cards?.find(card => card.id === cardId)
        ?? match?.hexes?.cards?.find(card => card.id === cardId)
        ?? match?.events?.find(card => card.id === cardId)
        ?? match?.landmarks?.find(card => card.id === cardId)
        ?? match?.states?.cards?.find(card => card.id === cardId);

      if (!cardLike) {
        console.warn(`[card-selection] missing card-like data for id ${cardId}`);
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
      newCardToOldCardMap.set(displayId, cardId);

      const idx = (selectableCardIds as CardLikeId[]).indexOf(cardId as CardLikeId);
      if (idx !== -1) {
        (selectableCardIds as CardLikeId[])[idx] = displayId;
        view.on('pointerdown', cardPointerDownListener);
        view.on('removed', cardRemovedListener);
      }
      cardList.addChild(view);
      continue;
    }

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

  cardList.x = Math.floor(-cardList.width * .5);

  if (!displayOnly) {
    setTimeout(() => {
      validate();
    }, 0);

    clientSelectableCardsOverrideStore.set(selectableCardIds);
  }

  return cardList
}
