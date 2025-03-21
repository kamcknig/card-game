import {Container, DestroyOptions, Graphics} from "pixi.js";
import {createCardView} from "../core/card/create-card-view";
import {DiscardView} from "./discard-view";
import {DeckView} from "./deck-view";
import {$playerHandStore} from "../state/player-state";
import {$cardsById} from "../state/card-state";
import {Card} from "shared/types";
import {batched} from 'nanostores';
import {$selectedCards} from '../state/interactive-state';
import {CARD_HEIGHT, CARD_WIDTH, SMALL_CARD_HEIGHT, SMALL_CARD_WIDTH, STANDARD_GAP} from '../app-contants';

export class PlayerHandView extends Container {
    private readonly _background: Container = new Container({
        x: 180,
    });
    private readonly _handContainer: Container = new Container({
        x: 190,
        label: `PlayerHandView${this.playerId!}`
    });
    private readonly _cleanup: (() => void)[] = [];
    private _discard: DiscardView | undefined;
    private _deck: DeckView | undefined;

    constructor(private playerId: number) {
        super();

        this.label = `PlayerHand ${this.playerId}`;
        this.addChild(this._background);
        this.addChild(this._handContainer);

        this.createPlayerDeck();
        this.createPlayerDiscard();

        const $handState = $playerHandStore(playerId);
        this._cleanup.push(batched([$handState, $selectedCards], (...args) => args).subscribe(this.drawHand.bind(this)));
    }

    destroy(options?: DestroyOptions) {
        console.log(`PlayerHandView [${this.playerId}] destroy`);
        super.destroy(options);
        this._cleanup.forEach(c => c());
    }

    private createPlayerDiscard() {
        console.log(`PlayerHand createPlayerDiscard for player ${this.playerId}`);
        this._discard = new DiscardView({owner: this.playerId});
        this.addChild(this._discard);
    }

    private createPlayerDeck() {
        console.log(`PlayerHand createPlayerDeck for player ${this.playerId}`);
        this._deck = new DeckView({owner: this.playerId});
        this.addChild(this._deck);
    }

    private drawBackground(): void {
        this._background.removeChildren().forEach(c => c.destroy());

        const bgGraphics = new Graphics()
            .roundRect(0, 0, (CARD_WIDTH * 5) + (STANDARD_GAP * 4) + (STANDARD_GAP * 2), CARD_HEIGHT + STANDARD_GAP * 2)
            .fill({color: 0, alpha: .6});
        this._background.addChild(bgGraphics);
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

        if (this._discard) {
            this._discard.x = this._background.x + this._background.width + STANDARD_GAP;
        }

        if (this._deck) {
            this._deck.x = this._background.x - this._deck.width - STANDARD_GAP;
        }
    }
}
