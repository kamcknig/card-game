import {Container, DestroyOptions, Graphics} from "pixi.js";
import {createCardView} from "../core/card/create-card-view";
import { $playerHandStore } from "../state/player-state";
import {$cardsById} from "../state/card-state";
import {Card} from "shared/types";
import {batched} from 'nanostores';
import {$selectedCards} from '../state/interactive-state';
import {CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP} from '../app-contants';
import { PhaseStatus } from './phase-status';

export class PlayerHandView extends Container {
    private _phaseStatus: PhaseStatus = new PhaseStatus();
    
    private readonly _background: Container = new Container();
    private readonly _handContainer: Container = new Container({
        label: `PlayerHandView${this.playerId!}`
    });
    private readonly _cleanup: (() => void)[] = [];
    
    constructor(private playerId: number) {
        super();

        this.label = `PlayerHand ${this.playerId}`;
        this.addChild(this._background);
        this._background.addChild(new Graphics());
        this.addChild(this._handContainer);
        this.addChild(this._phaseStatus);
        this._background.y = this._phaseStatus.y + this._phaseStatus.height;
        this._handContainer.y = this._background.y + STANDARD_GAP;

        const $handState = $playerHandStore(playerId);
        this._cleanup.push(batched([$handState, $selectedCards], (...args) => args).subscribe(this.drawHand.bind(this)));
    }

    destroy(options?: DestroyOptions) {
        console.log(`PlayerHandView [${this.playerId}] destroy`);
        super.destroy(options);
        this._cleanup.forEach(c => c());
    }

    private drawBackground(): void {
        const g = this._background.getChildAt(0) as Graphics;
        g.clear();
        g.roundRect(
          0,
          0,
          this._phaseStatus.width,
          CARD_HEIGHT + STANDARD_GAP * 4,
          5
        )
          .fill({color: 0, alpha: .6});
    }

    private drawHand([hand, selectedCardIds]: ReadonlyArray<number[]>) {
        this._handContainer.removeChildren().forEach(c => c.destroy());

        const cardsById = $cardsById.get();

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
        const treasureOrderRanking = ['copper', 'silver', 'gold'].reduce((prev, curr, idx) => ({...prev, [curr]: idx}), {} as Record<TreasureName, number>);
        const victoryOrderRanking = ['estate', 'duchy', 'province'].reduce((prev, curr, idx) => ({...prev, [curr]: idx}), {} as Record<VictoryName, number>);

        const sortedCards = [
            categorized[0].sort((a, b) => a.cardName.localeCompare(b.cardName)), // actions ordered by name
            categorized[1].sort((a, b) => treasureOrderRanking[a.cardKey as TreasureName] - treasureOrderRanking[b.cardKey as TreasureName]), // treasures ordered by ranking
            categorized[2].sort((a, b) => victoryOrderRanking[a.cardKey as VictoryName] - victoryOrderRanking[b.cardKey as VictoryName]) // victory ordered by ranking
        ].flat();

        // now display them
        sortedCards.forEach((card, idx) => {
            const c = this._handContainer.addChild(createCardView(card));
            c.size = 'full';
            c.facing = 'front';
            c.x = idx * CARD_WIDTH + idx * STANDARD_GAP;
            c.y -= selectedCardIds.includes(c.card.id) ? 0 : -10;
        });

        this.drawBackground();
    }
}
