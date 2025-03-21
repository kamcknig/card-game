import {Container, FederatedPointerEvent, Graphics, Text} from 'pixi.js';
import {createAppButton} from '../../core/create-app-button';
import {app} from '../../core/create-app';
import {createCardView} from '../../core/card/create-card-view';
import {CardView} from '../card-view';
import {$selectableCards} from '../../state/interactive-state';
import {SMALL_CARD_WIDTH} from '../../app-contants';
import {UserPromptArgs} from "shared/types";
import {validateCountSpec} from "../../shared/validate-count-spec";

export const userPromptModal = (args: UserPromptArgs): Promise<unknown> => {
    let selectedCards = new Set<number>();
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
            if (args.content?.cardSelection?.selectCount) {
                if(validateCountSpec(args.content?.cardSelection?.selectCount, selectedCards.size)) {
                    confirmBtn.alpha = 1;
                } else {
                    confirmBtn.alpha = .6;
                }
            }
        };

        const cardPointerDownListener = (event: FederatedPointerEvent) => {
            const target = event.target as CardView;
            const cardId = target.card.id;
            if (selectedCards.has(cardId)) {
                selectedCards.delete(cardId);
                target.y = 0;
            } else {
                selectedCards.add(cardId);
                target.y = -10;
            }

            validate();
        };

        if (args.content?.cardSelection) {
            $selectableCards.set(args.content.cardSelection.cardIds);
            for (const [idx, cardId] of args.content.cardSelection.cardIds.entries()) {
                const view = createCardView(cardId);
                view.on('pointerdown', cardPointerDownListener)
                view.x = idx * SMALL_CARD_WIDTH + idx * 20;
                contentContainer.addChild(view);
            }

            validate();
        }

        prompt.x = -prompt.width * .5
        contentContainer.x = -contentContainer.width * .5;
        contentContainer.y = prompt.height + 40;
        declineBtn.y = confirmBtn.y = contentContainer.children.length > 0 ? contentContainer.y + contentContainer.height + 40 : prompt.height + 40;
        declineBtn.x = -declineBtn.width - 20;
        confirmBtn.x = (args.showDeclineOption ? 20 : -confirmBtn.width * .5);

        hudContainer.addChild(prompt);

        if (args.showDeclineOption) {
            hudContainer.addChild(declineBtn);
        }

        background.roundRect(
            -hudContainer.width * .5 - 20,
            -20,
            hudContainer.width + 40,
            hudContainer.height + 40 + contentContainer.children.length > 0 ? 400 + 40 : 0
        ).fill({color: 'black', alpha: .8});

        hudContainer.addChild(confirmBtn);
        modalContainer.addChild(background);
        modalContainer.addChild(hudContainer);
        modalContainer.addChild(contentContainer);

        const cleanup = (confirm: boolean) => {
            app.stage.removeChild(modalContainer);
            modalContainer.destroy();
            confirmBtn.removeAllListeners();
            declineBtn.removeAllListeners();

            if (args.content?.cardSelection) {
                resolve([...selectedCards]);
            } else {
                resolve(confirm);
            }
        };

        declineBtn.on('pointerdown', () => {
            cleanup(false)
        });

        confirmBtn.on('pointerdown', () => {
            cleanup(true);
        });

        modalContainer.addChild(hudContainer);
        modalContainer.x = app.renderer.width * .5;
        modalContainer.y = app.renderer.height * .5 - modalContainer.height * .5;
        app.stage.addChild(modalContainer);
    });
}