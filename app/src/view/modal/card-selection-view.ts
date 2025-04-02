import { Container, FederatedPointerEvent } from "pixi.js"
import { CardId, UserPromptEffectArgs } from 'shared/shared-types';
import { CARD_WIDTH, STANDARD_GAP } from '../../app-contants';
import { createCardView } from '../../core/card/create-card-view';
import { List } from "@pixi/ui";
import { $cardsById } from '../../state/card-state';
import { isNumber, toNumber } from "es-toolkit/compat";
import { gameEvents } from '../../core/event/events';
import { CardView } from '../card-view';
import { $selectableCards, $selectedCards } from '../../state/interactive-state';
import { validateCountSpec } from '../../shared/validate-count-spec';

export const cardSelectionView = (cards: UserPromptEffectArgs['content']['cards']) => {
  // super hacky. $selectable cards is "global". and in cases where we are showing cards
  // from places like a user's discard for the harbinger card then the IDs of the cards used to create
  // the views in the modal are the same as those in the discard. So the cards in both places will highlight and
  // be selectable. So I create new IDs for them here so that only the ones on the modal are selectable and
  // map them to the old IDs. However, CardView has the listener that also shows the detail view when right
  // l, which will fail
  let newCardToOldCardMap = new Map<CardId, CardId>();
  let maxId = toNumber(Object.keys($cardsById.get()).sort().slice(-1)[0]);
  
  const cardCount = cards.cardIds.length;
  cards.selectCount ??= 1;
  
  const validate = () => {
    let validated = validateCountSpec(cards?.selectCount, $selectedCards.get().length)
    
    cardList.emit('validationUpdated', validated);
    
    if (validated) {
      const count = cards.selectCount;
      
      cardList.emit('resultsUpdated', $selectedCards.get().map(id => newCardToOldCardMap.get(id)));
      
      if ((isNumber(count) && count === 1) || (!isNumber(count) && count.kind === 'exact' && count.count === 1)) {
        cardList.emit('finished');
      }
    }
    return validated;
  };
  
  const cardPointerDownListener = (event: FederatedPointerEvent) => {
    if (event.button === 2) {
      gameEvents.emit('displayCardDetail', newCardToOldCardMap.get((event.target as CardView).card.id));
      return;
    }
    const target = event.target as CardView;
    const cardId = target.card.id;
    if ($selectedCards.get().includes(cardId)) {
      $selectedCards.set($selectedCards.get().filter(c => c !== cardId));
      target.y = 0;
    } else {
      $selectedCards.set($selectedCards.get().concat(cardId));
      target.y = -10;
    }
    
    validate();
  };
  const cardRemovedListener = (view: Container) => {
    view.removeAllListeners();
  }
  
  const cardList = new List({ type: 'horizontal'});
  cardList.elementsMargin = cardCount > 6 ? -CARD_WIDTH * .5 : STANDARD_GAP;
  
  for (const cardId of cards.cardIds) {
    const view = createCardView(cardId);
    view.card.id = ++maxId;
    newCardToOldCardMap.set(view.card.id, cardId);
    view.on('pointerdown', cardPointerDownListener)
    view.on('removed', cardRemovedListener);
    cardList.addChild(view);
  }
  
  cardList.x = Math.floor(-cardList.width * .5);
  
  validate();
  
  $selectableCards.set(Array.from(newCardToOldCardMap.keys()));
  
  return cardList
}
