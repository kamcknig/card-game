import {Container, FederatedPointerEvent, Graphics, Text} from 'pixi.js';
import { AppButton, createAppButton } from '../../core/create-app-button';
import {app} from '../../core/create-app';
import {createCardView} from '../../core/card/create-card-view';
import {CardView} from '../card-view';
import { $selectableCards, $selectedCards } from '../../state/interactive-state';
import { CARD_WIDTH, SMALL_CARD_WIDTH, STANDARD_GAP } from '../../app-contants';
import {UserPromptEffectArgs} from "shared/shared-types";
import {validateCountSpec} from "../../shared/validate-count-spec";
import { List } from '@pixi/ui';

export const userPromptModal = (args: UserPromptEffectArgs): Promise<unknown> => {
    return new Promise((resolve) => {
        let validationBtn: AppButton;
        const modalContainer = new Container();
        const actionList = new List({
            maxWidth: 200,
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
        
        const cleanup = (confirm: boolean) => {
            app.stage.removeChild(modalContainer);
            
            if (args.content?.cardSelection) {
                resolve($selectedCards.get());
                $selectedCards.set([]);
            } else {
                resolve(confirm);
            }
        };
        
        const validate = () => {
            let validated = true;
            if (args.content?.cardSelection) {
                validated = validateCountSpec(args.content?.cardSelection?.selectCount, $selectedCards.get().length)
                validationBtn && (validationBtn.button.alpha = validated ? 1 : .6)
            }
            return validated;
        };
        
        if (args.content?.cardSelection) {
            const cardPointerDownListener = (event: FederatedPointerEvent) => {
                if (event.button === 2) return;
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
            cardList.elementsMargin = cardCount > 6 ? -CARD_WIDTH * .75 : STANDARD_GAP;
            
            args.content.cardSelection.selectCount ??= 1;
            
            $selectableCards.set(args.content.cardSelection.cardIds);
            
            for (const cardId of args.content.cardSelection.cardIds) {
                const view = createCardView(cardId);
                view.on('pointerdown', cardPointerDownListener)
                view.on('removed', cardRemovedListener);
                cardList.addChild(view);
            }
            
            cardList.x = Math.floor(cardList.width * .5);
            cardList.y = modalContainer.height + STANDARD_GAP;
            modalContainer.addChild(cardList);
        }

        const actionButtonListener = (actionButton: UserPromptEffectArgs['actionButtons'][number]) => {
            if (validationBtn && validationBtn.button.alpha !== 1) {
                return;
            }
            
            resolve({action: actionButton.action, cardIds: $selectedCards.get()});
        }
        
        args.actionButtons.forEach(actionButton => {
            const btn = createAppButton({
                text: actionButton.label,
                width: 100,
                style: {
                    wordWrap: true,
                    wordWrapWidth: 100,
                    fill: 'white',
                    fontSize: 24,
                }
            });
            if (actionButton.validationAction) {
                validationBtn = btn;
            }
            btn.button.on('pointerdown', () => actionButtonListener(actionButton));
            btn.button.on('removed', () => btn.button.removeAllListeners());
            actionList.addChild(btn.button);
            actionList.y = modalContainer.height + STANDARD_GAP;
            actionList.x = Math.floor(-actionList.width * .5);
            modalContainer.addChild(actionList);
        });
        
        validate();
        
        background.roundRect(
          -modalContainer.width * .5 - STANDARD_GAP,
          -STANDARD_GAP,
          modalContainer.width + STANDARD_GAP,
          modalContainer.height + STANDARD_GAP,
          5
        ).fill({color: 'black', alpha: .6});
        
        modalContainer.addChildAt(background, 0);
        modalContainer.x = app.renderer.width * .5;
        modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
        app.stage.addChild(modalContainer);
    });
}