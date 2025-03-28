import {Container, FederatedPointerEvent, Graphics, Text} from 'pixi.js';
import {createAppButton} from '../../core/create-app-button';
import {app} from '../../core/create-app';
import {createCardView} from '../../core/card/create-card-view';
import {CardView} from '../card-view';
import { $selectableCards, $selectedCards } from '../../state/interactive-state';
import { SMALL_CARD_WIDTH, STANDARD_GAP } from '../../app-contants';
import {UserPromptArgs} from "shared/types";
import {validateCountSpec} from "../../shared/validate-count-spec";

export const userPromptModal = (args: UserPromptArgs): Promise<unknown> => {
    return new Promise((resolve) => {
        const modalContainer = new Container();
        const hudContainer = new Container();
        const contentContainer = new Container();
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

        const declineBtn = createAppButton({
            text: args.declineLabel,
            style: {
                fill: 'white',
                fontSize: 24,
            }
        });

        const confirmBtn = createAppButton({
            text: args.confirmLabel,
            style: {
                fill: 'white',
                fontSize: 24,
            }
        });
        
        const validate = () => {
            let validated = true;
            if (args.content?.cardSelection) {
                validated = validateCountSpec(args.content?.cardSelection?.selectCount, $selectedCards.get().length)
                if(validated) {
                    confirmBtn.button.alpha = 1;
                } else {
                    confirmBtn.button.alpha = .6;
                }
            }
            return validated;
        };

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
            view.off('removed', cardRemovedListener);
            view.off('pointerdown', cardPointerDownListener);
        }

        if (args.content?.cardSelection) {
            const cardCount = args.content.cardSelection.cardIds.length;
            args.content.cardSelection.selectCount ??= 1;
            $selectableCards.set(args.content.cardSelection.cardIds);
            for (const [idx, cardId] of args.content.cardSelection.cardIds.entries()) {
                const view = createCardView(cardId);
                view.on('pointerdown', cardPointerDownListener)
                view.on('removed', cardRemovedListener);
                view.x = cardCount > 5
                  ? idx * SMALL_CARD_WIDTH * .25 + idx * STANDARD_GAP
                  : idx * SMALL_CARD_WIDTH + idx * STANDARD_GAP;
                contentContainer.addChild(view);
            }

            validate();
        }

        prompt.x = -prompt.width * .5
        contentContainer.x = -contentContainer.width * .5;
        contentContainer.y = prompt.height + 40;
        declineBtn.button.y = confirmBtn.button.y = contentContainer.children.length > 0 ? contentContainer.y + contentContainer.height + 40 : prompt.height + 40;
        declineBtn.button.x = -declineBtn.button.width - 20;
        confirmBtn.button.x = (args.showDeclineOption ? 20 : -confirmBtn.button.width * .5);

        hudContainer.addChild(prompt);

        if (args.showDeclineOption) {
            hudContainer.addChild(declineBtn.button);
        }

        hudContainer.addChild(confirmBtn.button);
        
        modalContainer.addChild(hudContainer);
        modalContainer.addChild(contentContainer);
        
        background.roundRect(
          -modalContainer.width * .5 - STANDARD_GAP,
          -STANDARD_GAP,
          modalContainer.width + STANDARD_GAP,
          modalContainer.height + STANDARD_GAP,
          5
        ).fill({color: 'black', alpha: .8});
        
        modalContainer.addChildAt(background, 0);

        const cleanup = (confirm: boolean) => {
            app.stage.removeChild(modalContainer);
            modalContainer.destroy();
            confirmBtn.button.removeAllListeners();
            declineBtn.button.removeAllListeners();

            if (args.content?.cardSelection) {
                resolve($selectedCards.get());
                $selectedCards.set([]);
            } else {
                resolve(confirm);
            }
        };

        const declinePointerDown = () => {
            cleanup(false);
        };
        const confirmPointerDown = () => {
            if (!validate()) {
                return;
            }
            cleanup(true);
        };
        const onConfirmRemoved = () => {
            confirmBtn.button.off('pointerdown', confirmPointerDown);
            confirmBtn.button.off('removed', onConfirmRemoved);
        }
        const onDeclineRemoved = () => {
            declineBtn.button.off('pointerdown', declinePointerDown);
            declineBtn.button.off('removed', onDeclineRemoved);
        }
        
        declineBtn.button.on('pointerdown', declinePointerDown);
        confirmBtn.button.on('pointerdown', confirmPointerDown);
        confirmBtn.button.on('removed', onConfirmRemoved);
        declineBtn.button.on('removed', onDeclineRemoved);

        modalContainer.addChild(hudContainer);
        modalContainer.x = app.renderer.width * .5;
        modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
        app.stage.addChild(modalContainer);
    });
}