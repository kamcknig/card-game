import {Text, Container, DestroyOptions, Graphics} from "pixi.js";
import {createCardView} from "../core/card/create-card-view";
import { $playerHandStore, $selfPlayerId } from "../state/player-state";
import {$cardsById} from "../state/card-state";
import {Card} from "shared/types";
import { atom, batched } from 'nanostores';
import {$selectedCards} from '../state/interactive-state';
import {CARD_HEIGHT, CARD_WIDTH, STANDARD_GAP} from '../app-contants';
import { PhaseStatus } from './phase-status';
import { AppButton, createAppButton } from '../core/create-app-button';
import { $currentPlayerTurnId, $turnPhase } from '../state/turn-state';
import { CardStackView } from './card-stack';

export class PlayerHandView extends Container {
    private _phaseStatus: PhaseStatus = new PhaseStatus();
    private _nextPhaseButton: AppButton = createAppButton({text: 'NEXT'});
    
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
        this.addChild(this._handContainer);
        this.addChild(this._phaseStatus);
        this._background.y = this._phaseStatus.y + this._phaseStatus.height;
        this._handContainer.y = this._background.y + STANDARD_GAP;
        
        
        this.addChild(this._nextPhaseButton.button);
        $currentPlayerTurnId.subscribe(playerId => {
            this._nextPhaseButton.button.visible = playerId === $selfPlayerId.get();
        });
        $turnPhase.subscribe((phase) => {
            this.removeChild(this._nextPhaseButton.button);
            switch (phase) {
                case 'action':
                    this._nextPhaseButton.text('END ACTIONS');
                    break;
                case 'buy':
                    this._nextPhaseButton.text('END BUYS');
                    break;
            }
            
            this._nextPhaseButton.button.x = this.width - this._nextPhaseButton.button.width - STANDARD_GAP;
            this.addChild(this._nextPhaseButton.button);
        });
        
        const $handState = $playerHandStore(playerId);
        this._cleanup.push(batched([$handState, $selectedCards], (...args) => args).subscribe(this.drawHand.bind(this)));
        
        this._nextPhaseButton.button.on('pointerdown', this.onNextPhasePressed.bind(this));
    }
    
    private onNextPhasePressed() {
        this.emit('nextPhase');
    }

    destroy(options?: DestroyOptions) {
        super.destroy(options);
        this._cleanup.forEach(c => c());
    }

    private drawHand([hand, selectedCardIds]: ReadonlyArray<number[]>) {
        this._handContainer.removeChildren().forEach(c => c.destroy());
        this.removeChild(this._handContainer);

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
        
        for (const [idx, cards] of cardStackCards.entries()) {
            const a = atom<number[]>(cards.map(c => c.id));
            const c = new CardStackView({
                cardStore: a,
                cardFacing: 'front',
                showBackground: false,
            });
            c.x = idx * CARD_WIDTH + idx * STANDARD_GAP;
            c.y -= cards.some(e => selectedCardIds.includes(e.id)) ? 0 : -10;
            this._handContainer.addChild(c);
        }
        
        this._handContainer.x = this.width * .5 - this._handContainer.width * .5;
        this.addChild(this._handContainer);
    }
}
