import { Application, Container, FederatedPointerEvent } from 'pixi.js'
import { CardId, UserPromptKinds } from 'shared/shared-types';
import { CARD_WIDTH, STANDARD_GAP } from '../../../../core/app-contants';
import { createCardView } from '../../../../core/card/create-card-view';
import { List } from '@pixi/ui';
import { cardStore } from '../../../../state/card-state';
import { isNumber, toNumber } from 'es-toolkit/compat';
import { CardView } from '../card-view';
import { clientSelectableCardsOverrideStore, selectedCardStore } from '../../../../state/interactive-state';
import { validateCountSpec } from '../../../../shared/validate-count-spec';
import { displayCardDetail } from './display-card-detail';

export const cardSelectionView = (app: Application, args: UserPromptKinds) => {
  if (args.type !== 'select' && args.type !== 'display-cards') throw new Error('card selection modal requires type "select" or "display-cards');
  if (!args.cardIds) throw new Error('Cards cannot be empty');

  const displayOnly = args.type === 'display-cards';

  const cardIds = args.cardIds;

  let newCardToOldCardMap = new Map<CardId, CardId>();
  let maxId = toNumber(Object.keys(cardStore.get()).sort().slice(-1)[0]);

  const cardCount = cardIds.length;
  const selectCount = 'selectCount' in args ? args.selectCount ?? 1 : 0;

  const validate = () => {
    let validated = displayOnly ?? validateCountSpec(selectCount, selectedCardStore.get().length);

    cardList.emit('validationUpdated', validated);

    if (validated) {
      const count = selectCount;

      cardList.emit('resultsUpdated', selectedCardStore.get().map(id => newCardToOldCardMap.get(id)));

      if (!displayOnly && isNumber(count) && count === 1) {
        cardList.emit('finished');
      }
    }
    return validated;
  };

  const cardPointerDownListener = (event: FederatedPointerEvent) => {
    const cardView = event.target as CardView;
    if (event.button === 2 && cardView.facing === 'front') {
      const cardId = newCardToOldCardMap.get(cardView.card.id);
      if (!cardId) return;
      void displayCardDetail(app, cardId);
      return;
    }

    if (displayOnly) return;

    const target = event.target as CardView;
    const cardId = target.card.id;
    if (selectedCardStore.get().includes(cardId)) {
      selectedCardStore.set(selectedCardStore.get().filter(c => c !== cardId));
      target.y = 0;
    }
    else {
      selectedCardStore.set(selectedCardStore.get().concat(cardId));
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
    const view = createCardView(cardId);
    view.card.id = ++maxId;
    newCardToOldCardMap.set(view.card.id, cardId);
    view.on('pointerdown', cardPointerDownListener)
    view.on('removed', cardRemovedListener);
    cardList.addChild(view);
  }

  cardList.x = Math.floor(-cardList.width * .5);

  if (!displayOnly) {
    setTimeout(() => {
      validate();
    }, 0);
    
    clientSelectableCardsOverrideStore.set(Array.from(newCardToOldCardMap.keys()));
  }

  return cardList
}
