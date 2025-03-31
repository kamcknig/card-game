import { Container, FederatedPointerEvent, Graphics, Text } from 'pixi.js';
import { AppButton, createAppButton } from '../../core/create-app-button';
import { app } from '../../core/create-app';
import { createCardView } from '../../core/card/create-card-view';
import { CardView } from '../card-view';
import { $selectableCards, $selectedCards } from '../../state/interactive-state';
import { CARD_WIDTH, STANDARD_GAP } from '../../app-contants';
import { CardId, UserPromptEffectArgs } from 'shared/shared-types';
import { validateCountSpec } from '../../shared/validate-count-spec';
import { List } from '@pixi/ui';
import { $cardsById } from '../../state/card-state';
import { isNumber, toNumber } from 'es-toolkit/compat';
import { gameEvents } from '../../core/event/events';

export const userPromptModal = (args: UserPromptEffectArgs): Promise<unknown> => {
    return new Promise((resolve) => {
        let validationBtn: AppButton;
        const modalContainer = new Container();
        const actionList = new List({
            maxWidth: 250,
            type: 'bidirectional',
            elementsMargin: STANDARD_GAP
        });
        const background = new Graphics();

        const prompt = new Text({
            text: args.prompt,
            style: {
                fontSize: 36,
                fill: 'white',
                wordWrap: true,
                wordWrapWidth: 400,
            }
        });
        prompt.x = Math.floor(-prompt.width * .5);
        
        modalContainer.addChild(prompt);
        
        const cleanup = () => {
            app.stage.removeChild(modalContainer);
            $selectedCards.set([]);
            $selectableCards.set([]);
        };
        
        const validate = () => {
            let validated = true;
            if (args.content?.cardSelection) {
                validated = validateCountSpec(args.content?.cardSelection?.selectCount, $selectedCards.get().length)
                validationBtn && (validationBtn.button.alpha = validated ? 1 : .6);
                validationBtn && (validationBtn.button.eventMode = validated ? 'static' : 'none');
                
                if (validated) {
                    const count = args.content.cardSelection.selectCount;
                    
                    if ((isNumber(count) && count === 1) || (!isNumber(count) && count.kind === 'exact' && count.count === 1)) {
                        actionButtonListener();
                    }
                }
            }
            return validated;
        };
        
        const actionButtonListener = (actionButton?: UserPromptEffectArgs['actionButtons'][number]) => {
            resolve({action: actionButton?.action, cardIds: $selectedCards.get().map(id => newCardToOldCardMap.get(id))});
            cleanup();
        }
        
        // super hacky. $selectable cards is "global". and in cases where we are showing cards
        // from places like a user's discard for the harbinger card then the IDs of the cards used to create
        // the views in the modal are the same as those in the discard. So the cards in both places will highlight and
        // be selectable. So I create new IDs for them here so that only the ones on the modal are selectable and
        // map them to the old IDs. However, CardView has the listener that also shows the detail view when right
        // l, which will fail
        let newCardToOldCardMap = new Map<CardId, CardId>();
        let maxId = toNumber(Object.keys($cardsById.get()).sort().slice(-1)[0]);
        
        if (args.content?.cardSelection) {
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
                view.off('removed');
                view.off('pointerdown');
            }
            
            const cardCount = args.content.cardSelection.cardIds.length;
            const cardList = new List({ type: 'horizontal'});
            cardList.elementsMargin = cardCount > 6 ? -CARD_WIDTH * .5 : STANDARD_GAP;
            
            args.content.cardSelection.selectCount ??= 1;
            
            for (const cardId of args.content.cardSelection.cardIds) {
                const view = createCardView(cardId);
                view.card.id = ++maxId;
                newCardToOldCardMap.set(view.card.id, cardId);
                view.on('pointerdown', cardPointerDownListener)
                view.on('removed', cardRemovedListener);
                cardList.addChild(view);
            }
            
            $selectableCards.set(Array.from(newCardToOldCardMap.keys()));
            
            cardList.x = Math.floor(-cardList.width * .5);
            cardList.y = modalContainer.height + STANDARD_GAP;
            modalContainer.addChild(cardList);
        }
        
        if (args.actionButtons) {
            args.actionButtons?.forEach(actionButton => {
                const btn = createAppButton({
                    text: actionButton.label,
                    style: {
                        wordWrap: true,
                        wordWrapWidth: 100,
                        fill: 'white',
                        fontSize: 24,
                    }
                });
                if (args.validationAction === actionButton.action) {
                    validationBtn = btn;
                }
                btn.button.on('pointerdown', () => actionButtonListener(actionButton));
                btn.button.on('removed', () => btn.button.removeAllListeners());
                actionList.addChild(btn.button);
            });
            
            actionList.y = modalContainer.height + STANDARD_GAP;
            actionList.x = Math.floor(-actionList.width * .5);
            modalContainer.addChild(actionList);
        }
        
        validate();
        
        background.roundRect(
          -modalContainer.width * .5 - STANDARD_GAP,
          -STANDARD_GAP,
          modalContainer.width + STANDARD_GAP * 2,
          modalContainer.height + STANDARD_GAP * 2,
          5
        ).fill({color: 'black', alpha: .6});
        
        modalContainer.addChildAt(background, 0);
        modalContainer.x = app.renderer.width * .5;
        modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
        app.stage.addChild(modalContainer);
    });
}