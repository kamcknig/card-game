import { Container, Graphics } from "pixi.js";
import { playerHandStore, selfPlayerIdStore } from "../state/player-state";
import { cardStore } from "../state/card-state";
import { Card } from "shared/shared-types";
import { atom } from 'nanostores';
import { CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_WIDTH, STANDARD_GAP } from '../core/app-contants';
import { PhaseStatus } from './phase-status';
import { AppButton, createAppButton } from '../core/create-app-button';
import { currentPlayerTurnIdStore, turnPhaseStore } from '../state/turn-state';
import { CardStackView } from './card-stack';
import { List } from "@pixi/ui";

export class PlayerHandView extends Container {
    private _phaseStatus: PhaseStatus = new PhaseStatus();
    private _nextPhaseButton: AppButton = createAppButton({text: 'NEXT'});

    private readonly _cleanup: (() => void)[] = [];
    private readonly _background: Graphics = new Graphics({label: 'background'});
    private readonly _cardList: List = new List({ type: 'horizontal', elementsMargin: STANDARD_GAP });

    constructor(private playerId: number) {
        super();

        this._cardList.label = `cardList`;
        this._cardList.elementsMargin = STANDARD_GAP;

        this.label = `player-hand-${this.playerId}`;

        this.addChild(this._background);
        this.addChild(this._phaseStatus);
        this.addChild(this._cardList);
        this.addChild(this._nextPhaseButton.button);

        this._background.y = this._phaseStatus.y + this._phaseStatus.height;
        this._cardList.y = this._background.y + STANDARD_GAP;

        this._background.clear();
        this._background.roundRect(0, 0, CARD_WIDTH * 6 + STANDARD_GAP * 6, CARD_HEIGHT + STANDARD_GAP * 4, 5);
        this._background.fill({color: 0, alpha: .6});

        this._phaseStatus.x = this._background.width * .5 - this._phaseStatus.width * .5;

        this._cleanup.push(currentPlayerTurnIdStore.subscribe(playerId => {
            this._nextPhaseButton.button.visible = playerId === selfPlayerIdStore.get();
        }));
        this._cleanup.push(turnPhaseStore.subscribe((phase) => {
            this.removeChild(this._nextPhaseButton.button);
            switch (phase) {
                case 'action':
                    this._nextPhaseButton.text('END ACTIONS');
                    break;
                case 'buy':
                    this._nextPhaseButton.text('END BUYS');
                    break;
            }

            this._nextPhaseButton.button.x = this._phaseStatus.x + this._phaseStatus.width - this._nextPhaseButton.button.width;
            this.addChild(this._nextPhaseButton.button);
        }));
        this._cleanup.push(playerHandStore(playerId).subscribe(this.drawHand));
        this._nextPhaseButton.button.on('pointerdown', this.onNextPhasePressed);
        this.on('removed', this.onRemoved);
    }

    private onNextPhasePressed = () => {
        this.emit('nextPhase');
    }

    private onRemoved = () => {
        this._cleanup.forEach(c => c());
        this._nextPhaseButton.button.off('pointerdown');
        this.off('removed');
    }

    private drawHand = (hand: ReadonlyArray<number>) => {
        this._cardList.removeChildren().forEach(c => c.destroy({children: true}));

        const cardsById = cardStore.get();

        // first reduce the cards by card type, actions, then treasures, then victory cards
        const categoryMap: Record<string, number> = {ACTION: 0, TREASURE: 1, VICTORY: 2};
        const categorized = hand.reduce(
            (acc, cardId) => {
                const category = Object.keys(categoryMap).find(type => cardsById[cardId].type.includes(type));
                if (category) {
                    acc[categoryMap[category]].push(cardsById[cardId]);
                }
                return acc;
            },
            [[], [], []] as Card[][]
        );

        type TreasureName = 'copper' | 'silver' | 'gold';
        type VictoryName = 'estate' | 'duchy' | 'gold';

        // now sort within each type. actions by name, treasure and victory by predefined rankings,
        // then flatten to a single dimensional array. probably better to type this array or something
        // elsewhere later on
        const treasureOrderRanking =['copper', 'silver', 'gold'].reduce((prev, curr, idx) => ({...prev, [curr]: idx}), {} as Record<TreasureName, number>);
        const victoryOrderRanking = ['estate', 'duchy', 'province'].reduce((prev, curr, idx) => ({...prev, [curr]: idx}), {} as Record<VictoryName, number>);

        const sortedCards = [
            categorized[0].sort((a, b) => a.cardName.localeCompare(b.cardName)), // actions ordered by name
            categorized[1].sort((a, b) => treasureOrderRanking[a.cardKey as TreasureName] - treasureOrderRanking[b.cardKey as TreasureName]), // treasures ordered by ranking
            categorized[2].sort((a, b) => victoryOrderRanking[a.cardKey as VictoryName] - victoryOrderRanking[b.cardKey as VictoryName]) // victory ordered by ranking
        ].flat();

        let cardStackCards: Card[][] = [];
        let lastCardKey: string;

        sortedCards.forEach((card, idx) => {
            const nextCardKey = card.cardKey;

            if (nextCardKey === lastCardKey) {
                cardStackCards[cardStackCards.length - 1].push(card);
            } else {
                cardStackCards.push([card]);
            }

            lastCardKey = nextCardKey;
        });

        for (const cards of cardStackCards) {
            const c = new CardStackView({
                $cardIds: atom(cards.map(c => c.id)),
                cardFacing: 'front',
                showBackground: false,
            });
            this._cardList.addChild(c);
        }

        this._cardList.elementsMargin = cardStackCards.length > 5 ? -SMALL_CARD_WIDTH * .50 : STANDARD_GAP
        this._cardList.x = Math.floor(this.width * .5 - this._cardList.width * .5);
    }
}
