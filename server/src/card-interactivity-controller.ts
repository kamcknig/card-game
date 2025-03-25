import { PreinitializedWritableAtom } from "nanostores";
import { AppSocket } from "./types.ts";
import { CardEffectController } from "./card-effects-controller.ts";
import { getPlayerById } from './utils/get-player-by-id.ts';
import { Match } from "shared/types.ts";
import { getTurnPhase } from './utils/get-turn-phase.ts';
import { getCurrentPlayerId } from './utils/get-current-player-id.ts';
import { playerSocketMap } from './player-socket-map.ts';

export class CardInteractivityController {

    constructor(
        private readonly cardEffectController: CardEffectController,
        private readonly $matchState: PreinitializedWritableAtom<Match>,
        private readonly sockets: AppSocket[]
    ) {
        $matchState.subscribe(this.onMatchStateUpdated.bind(this));

        // todo: clean up listeners
        for (const socket of this.sockets) {
            socket.on('cardTapped', this.onCardTapped.bind(this));
        }
    }

    private async onCardTapped(triggerPlayerId: number, tappedCardId: number) {
        const match = this.$matchState.get();
        const cardsById = match.cardsById;
        const player = getPlayerById(triggerPlayerId);

        const card = cardsById?.[tappedCardId];

        console.log(`player ${player} tapped card ${card}`);

        const turnPhase = getTurnPhase(match);
        
        if (turnPhase === 'action') {
            await this.cardEffectController.runGameActionEffects('playCard', match, triggerPlayerId, tappedCardId);
        } else if (turnPhase === 'buy') {
            if (!match.playerHands?.[triggerPlayerId]) {
                console.debug(`could not find player hand for ${getPlayerById(triggerPlayerId)}`);
                return;
            }
            if (match.playerHands[triggerPlayerId].includes(tappedCardId)) {
                await this.cardEffectController.runGameActionEffects('playCard', match, triggerPlayerId, tappedCardId);
            } else {
                await this.cardEffectController.runGameActionEffects('buyCard', match, triggerPlayerId, tappedCardId);
            }
        }

        console.log(`card tapped handler complete ${card} for ${player}`);
    }

    private onMatchStateUpdated(match: Match, _oldMatch?: Match): void {
        if (!match) {
            return;
        }

        const cardsById = this.$matchState.get().cardsById;
        const currentPlayerId = getCurrentPlayerId(match);
        const currentPlayer = getPlayerById(currentPlayerId);
        const turnPhase = getTurnPhase(match);

        console.log(`determining selectable cards - phase '${turnPhase}, player ${currentPlayer}', player Index '${match.currentPlayerTurnIndex}'`);
        const selectableCards: number[] = [];

        const hand = match.playerHands[currentPlayerId].map(id => cardsById[id]);

        if (turnPhase === 'buy') {
            const cardsAdded: string[] = [];
            const supply = match.supply.concat(match.kingdom).map(id => cardsById[id]);

            for (let i = supply.length - 1; i >=0; i--) {
                const card = supply[i];
                if (cardsAdded.includes(card.cardKey)) {
                    continue;
                }

                if (card.cost.treasure <= match.playerTreasure && match.playerBuys > 0) {
                    selectableCards.push(card.id);
                    cardsAdded.push(card.cardKey);
                }
            }

            for (const card of hand) {
                if (card.type.includes('TREASURE')) {
                    selectableCards.push(card.id);
                }
            }
        } else if (turnPhase === 'action') {
            for (const card of hand) {
                if (card.type.includes('ACTION') && match.playerActions > 0) {
                    selectableCards.push(card.id);
                }
            }
        }

        match.players.forEach(playerId => {
            playerSocketMap.get(playerId)?.emit('selectableCardsUpdated', playerId === currentPlayerId ? selectableCards : []);
        });
    }
}
