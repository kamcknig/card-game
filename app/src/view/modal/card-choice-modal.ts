import {app} from "../../core/create-app";
import {Container, Graphics, Text} from "pixi.js";
import {$cardsById} from "../../state/card-state";
import {createCardView} from "../../core/card/create-card-view";
import {createAppButton} from "../../core/create-app-button";
import {CountSpec} from "shared/types";
import {SMALL_CARD_WIDTH} from '../../app-contants';
import { isBoolean, isUndefined } from 'es-toolkit';
import { isEmpty } from 'es-toolkit/compat';

export type CardChoiceModalArgs = {
    prompt: string;
    confirmLabel?: string;
    declineLabel?: string;
    showDeclineOption?: boolean;
    cardIds?: number[];
    cardSelect?: boolean;
    count?: CountSpec;
}
export let cardChoiceModal: (args: CardChoiceModalArgs) => Promise<boolean | number[]>;

export const createCardChoiceModal = () => {
    cardChoiceModal = async (args: CardChoiceModalArgs) => {
        let {confirmLabel, declineLabel, cardIds, showDeclineOption} = args;
        const {count, cardSelect, prompt} = args;

        cardIds ??= [];
        showDeclineOption = isBoolean(showDeclineOption) ? showDeclineOption : !isUndefined(declineLabel);
        confirmLabel ??= 'YES';
        declineLabel ??= 'NO';

        // draw background;
        const modalBackground = app.stage.addChild(new Container());
        modalBackground.addChild(new Graphics())
            .roundRect(0, 0, app.renderer.width, app.renderer.height)
            .fill({
                color: 0,
                alpha: .6,
            });

        // draw prompt
        if (!isEmpty(prompt)) {
            const t = new Text({
                text: prompt,
                style: {
                    fill: 'white',
                    fontSize: 24
                },
                anchor: .5,
                x: app.renderer.width * .5,
                y: app.renderer.height * .5 - SMALL_CARD_WIDTH,
            });
            modalBackground.addChild(t);
        }

        // draw cards
        if (cardIds?.length > 0) {
            const cardsById = $cardsById.get();
            cardIds?.forEach((card, idx) => {
                const c = modalBackground.addChild(createCardView(cardsById[card]));
                c.x = modalBackground.width * .5 - 300 + idx * 170;
                c.y = modalBackground.height * .5 - 120;
            });
        }

        const declineButton = createAppButton({
            text: declineLabel,
            y: modalBackground.height * .5 + SMALL_CARD_WIDTH,
            x: modalBackground.width * .5 - 100,
            style: {
                fill: 'white',
                fontSize: 24
            }
        });
        const confirmButton = createAppButton({
            text: confirmLabel,
            y: modalBackground.height * .5 + SMALL_CARD_WIDTH,
            x: modalBackground.width * .5 + 100,
            style: {
                fill: 'white',
                fontSize: 24
            }
        });
        if (!cardSelect) {
            modalBackground.addChild(confirmButton);
            confirmButton.on('destroyed', () => confirmButton.removeAllListeners());

            declineButton.on('destroyed', () => declineButton.removeAllListeners());
            if (showDeclineOption) {
                modalBackground.addChild(declineButton);
            }
        }

        return new Promise<boolean | number[]>((resolve, reject) => {
            if (cardSelect) {
                /*ciController.startSelection({
                    cardIds: cardIds,
                    count: count ?? 1,
                }).then(resolve);*/
            } else {
                confirmButton.on('pointerdown', () => {
                    resolve(true);
                });
                declineButton.on('pointerdown', () => {
                    resolve(false);
                });
            }
        }).finally(() => {
            modalBackground.removeChildren().forEach((card) => card.destroy());
            confirmButton.destroy();
            declineButton.destroy();
            modalBackground.removeFromParent();
            modalBackground.destroy();
        });
    }
}