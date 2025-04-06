import { UserPromptEffectArgs } from 'shared/shared-types';
import { CARD_WIDTH, STANDARD_GAP } from '../../core/app-contants';
import { createCardView } from '../../core/card/create-card-view';
import { Text, Container } from 'pixi.js';
import { selectableCardStore } from '../../state/interactive-state';
import { CardView } from '../card-view';
import { inject } from '@angular/core';
import { PIXI_APP } from '../../core/pixi-application.token';

export const cardRearrangeView = (args: UserPromptEffectArgs) => {
  if (!args.content?.cards) throw new Error('Cards must be provided');
  const app = inject(PIXI_APP);

  const cards = args.content.cards;
  const bottomText = new Text({
    text: 'BOTTOM',
    style: {
      fill: 'white',
      fontSize: 24
    }
  });

  const topText = new Text({
    text: 'TOP',
    style: {
      fill: 'white',
      fontSize: 24,
    },
  });

  selectableCardStore.set([]);
  const originalStageEventMode = app.stage.eventMode;

  const cardList = new Container();
  app.stage.eventMode = 'static';

  let dragTarget: CardView | null = null;
  let dragStartX = 0;
  let dragCardStartX = 0;
  let originalIndex = 0;

  // For easy re-ordering, keep references to each card
  const cardViews: CardView[] = [];

  const cardCount = cards.cardIds.length;
  const margin = cardCount > 6 ? -CARD_WIDTH * 0.5 : STANDARD_GAP;

  // --- Layout Helper ---
  const layoutCards = () => {
    cardViews.forEach((card, idx) => {
      card.x = idx * (CARD_WIDTH + margin);
      card.zIndex = idx;
    });
    //cardList.x = Math.floor(-cardList.width * 0.5);
  };

  // --- Create all cards and store them in cardViews array ---
  for (const cardId of cards.cardIds) {
    const view = createCardView(cardId);
    view.eventMode = 'static';
    cardViews.push(view);
    cardList.addChild(view);
  }

  layoutCards();

  topText.y = cardList.height + STANDARD_GAP;
  topText.x = cardList.width - topText.width;

  bottomText.y = cardList.height + STANDARD_GAP;

  cardList.addChild(topText);
  cardList.addChild(bottomText);

  // --- Drag Start ---
  const onStartDrag = (event: PointerEvent) => {
    dragTarget = event.currentTarget as CardView;
    if (!dragTarget) return;

    cardList.setChildIndex(dragTarget, cardList.children.length - 1);

    originalIndex = cardViews.indexOf(dragTarget);
    dragStartX = event.clientX;
    dragCardStartX = dragTarget.x;

    dragTarget.y = -20;
  };

  // --- Drag Move ---
  const onMoveDrag = (event: PointerEvent) => {
    if (!dragTarget) return;

    const deltaX = event.clientX - dragStartX;
    dragTarget.x = dragCardStartX + deltaX;

    const halfSlot = (CARD_WIDTH + margin) * 0.5;
    const currentIndex = cardViews.indexOf(dragTarget);

    const cardCenterX = dragTarget.x + CARD_WIDTH * 0.5; // approximate center

    for (let i = 0; i < cardViews.length; i++) {
      if (cardViews[i] === dragTarget) continue; // skip the dragging card itself

      const otherCardX = i * (CARD_WIDTH + margin) + CARD_WIDTH * 0.5;
      const dist = Math.abs(cardCenterX - otherCardX);

      if (dist < halfSlot) {
        const newIndex = i;
        if (newIndex !== currentIndex) {
          cardViews.splice(currentIndex, 1);
          cardViews.splice(newIndex, 0, dragTarget);

          layoutCards();

          break;
        }
      }
    }
  };

  // --- Drag End ---
  const onEndDrag = () => {
    if (!dragTarget) return;
    layoutCards();
    dragTarget.y = 0;
    dragTarget = null;
    cardList.emit('resultsUpdated', cardViews.map(view => view.card.id));
  };

  cardViews.forEach((view) => {
    view.on('pointerdown', onStartDrag);
    view.on('removed', () => view.removeAllListeners());
  });

  app.stage.on('pointermove', onMoveDrag);
  app.stage.on('pointerupoutside', onEndDrag);
  app.stage.on('pointerup', onEndDrag);

  cardList.on('remove', () => {
    app.stage.eventMode = originalStageEventMode;
    app.stage.off('pointermove', onMoveDrag);
    app.stage.off('pointerupoutside', onEndDrag);
    app.stage.off('pointerup', onEndDrag);
  })

  return cardList;
};
