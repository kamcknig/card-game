import {Container, Graphics, Text} from "pixi.js";
import {createCardView} from "../../core/card/create-card-view";
import {$cardsById} from "../../state/card-state";
import {app} from "../../core/create-app";

export let reactModal: (triggerCardId: number, potentialReactionCardIds: number[]) => Promise<number[]>;

export const createReactModal = () => {
    reactModal = async (triggerCardId: number, potentialReactionCardIds: number[]) => {
        console.log('displaying react modal to trigger card', triggerCardId, 'potential reaction cards', potentialReactionCardIds);

        const c = new Container();

        const background = new Container();
        c.addChild(background);

        const graphics = background.addChild(new Graphics());

        const cardsById = $cardsById.get();
        const triggerCard = cardsById[triggerCardId];
        const prompt = new Text({
            text: `Do you want to react to ${triggerCard.cardName}?`,
            style: {
                fill: 'white',
                fontSize: 24
            },
            anchor: .5
        });

        const cardView = createCardView(triggerCardId);
        c.addChild(cardView);

        prompt.x = c.width * .5;
        prompt.y = prompt.height * .5;
        c.addChild(prompt);

        cardView.y = prompt.height + 20;
        graphics
            .roundRect(Math.min(-20, prompt.x - prompt.width * .5 - 20), -20, c.width + 40, c.height + 40)
            .fill({
                color: 0,
                alpha: .6
            });

        c.x = 715;
        c.y = 145;
        app.stage.addChild(c);

        return Promise.resolve([]);
        /*return ciController
            .startSelection({count: { kind: 'upTo', count: 1}, cardIds: [...potentialReactionCardIds]})
            .finally(() => {
                c.destroy();
            });*/
    }
}