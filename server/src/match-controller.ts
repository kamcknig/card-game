import {Card, Match, MatchConfiguration, MatchUpdate, Player, TurnPhaseOrderValues} from "shared/types.ts";
import {EffectHandlerMap, MatchBaseConfiguration} from "./types.ts";
import {CardEffectController} from "./card-effects-controller.ts";
import {cardLibrary, loadExpansion} from "./utils/load-expansion.ts";
import {CardInteractivityController} from "./card-interactivity-controller.ts";
import {createCard} from "./utils/create-card.ts";
import {createEffectHandlerMap} from "./effect-handler-map.ts";
import {EffectsPipeline} from "./effects-pipeline.ts";
import {fisherYatesShuffle} from "./utils/fisher-yates-shuffler.ts";
import {getPlayerById} from "./utils/get-player-by-id.ts";
import {ReactionManager} from "./reaction-manager.ts";
import {scoringFunctionMap} from "./scoring-function-map.ts";
import {sendToSockets} from "./utils/send-to-sockets.ts";
import {$selectableCards} from "./state/selectable-cards.ts";
import {Socket} from "socket.io";
import {getGameState} from "./utils/get-game-state.ts";
import { map } from 'nanostores';
import { getTurnPhase } from './utils/get-turn-phase.ts';
import { getCurrentPlayerId } from './utils/get-current-player-id.ts';

export class MatchController {
    private $matchState = map<Match>();

    private effectHandlerMap: EffectHandlerMap | undefined;
    private cardEffectsController: CardEffectController | undefined;

    constructor(
        private readonly sockets: Socket[]
    ) {
        (globalThis as any).matchState = this.$matchState;
    }

    public async initialize(matchConfig: MatchConfiguration) {
        for (const expansionName of matchConfig.expansions) {
            await loadExpansion(expansionName);
        }

        const supplyCards = this.createBaseSupply();

        const kingdomCards: Card[] = this.createKingdom();

        const cardsById: Record<number, Card> = {};
        supplyCards.forEach(card => {
            cardsById[card.id] = card;
        });
        kingdomCards.forEach(card => {
            cardsById[card.id] = card;
        });

        const playerCards = this.createPlayerHands(cardsById);

        matchConfig = {
            ...matchConfig,
            supplyCardKeys: supplyCards.reduce((prev, card) => {
                if (prev.includes(card.cardKey)) {
                    return prev;
                }
                return prev.concat(card.cardKey);
            }, [] as string[]),
            kingdomCardKeys: kingdomCards.reduce((prev, card) => {
                if (prev.includes(card.cardKey)) {
                    return prev;
                }
                return prev.concat(card.cardKey);
            }, [] as string[]),
        };

        this.$matchState.set({
            trash: [],
            players: fisherYatesShuffle(getGameState().players.filter(p => p.connected)).map((p: Player) => p.id),
            supply: supplyCards.map(c => c.id),
            kingdom: kingdomCards.map(c => c.id),
            ...playerCards,
            expansions: matchConfig.expansions,
            turnNumber: 0,
            currentPlayerTurnIndex: 0,
            activePlayerId: 0,
            playerBuys: 0,
            playerTreasure: 0,
            playerActions: 0,
            turnPhaseIndex: 0,
            selectableCards: [],
            playArea: [],
            cardsById
        });

        sendToSockets(this.sockets.values(), 'matchReady', this.$matchState.get());

        // now we wait for all players to report ready.
        // TODO: clean up the listeners
        for (const socket of this.sockets) {
            socket.on('ready', this.onPlayerReady.bind(this));
        }
    }

    private createBaseSupply() {
        const supplyCards: Card[] = [];
        Object.entries(MatchBaseConfiguration.cards.supply.baseCards[getGameState().players.length - 1])
            .forEach(([key, count]) => {
                // copper come from the supply. we subtract those counts when
                // initially creating the supplies, and they get manually created later, estates
                // do not come from the supply, so they don't get subtracted here
                if (key === 'copper') {
                    count -= getGameState().players.length * MatchBaseConfiguration.playerStartingHand.copper;
                    console.debug('Setting copper count to', count, 'due to number of players');
                }

                for (let i = 0; i < count; i++) {
                    supplyCards.push(createCard(key));
                }

                console.log('creating', count, key);
            });
        return supplyCards;
    }

    private createKingdom() {
        const kingdomCards: Card[] = [];
        // todo: remove testing code
        const keepers: string[] = [
          'artisan',
          'bandit',
          'bureaucrat',
          'cellar',
          'chapel',
          'council-room',
          'festival',
          'harbinger',
          'laboratory',
          'moat'
        ];
        const chosenKingdom =
            Object.keys(cardLibrary["kingdom"])
                .sort((a, b) => keepers.includes(a) ? 1 : keepers.includes(b) ? -1 : Math.random() > .5 ? 1 : -1)
                .slice(-MatchBaseConfiguration.numberOfKingdomPiles)
                .reduce((prev, key) => {
                    prev[key] = 10;
                    return prev
                }, {} as Record<string, number>);

        console.log('configured kingdom', chosenKingdom);

        Object.entries(chosenKingdom)
            .forEach(([key, count]) => {
                console.log('creating', count, key);
                for (let i = 0; i < count; i++) {
                    kingdomCards.push(createCard(key));
                }
            });

        return kingdomCards;
    }
    
    private createPlayerHands(cardsById: Record<number, Card>) {
        return Object.values(getGameState().players).reduce((prev, p, idx) => {
            console.log('initializing player', p.id, 'cards...');
            let blah = {};
            // todo remove testing code
            if (idx === 0) {
                blah = {
                    silver: 10
                };
            }
            
            if (idx === 1) {
                blah = {
                    silver: 10
                };
            }
            Object.entries(blah).forEach(([key, count]) => {
            // Object.entries(MatchBaseConfiguration.playerStartingHand).forEach(([key, count]) => {
                console.log('adding', count, key, 'to deck');
                prev['playerDecks'][p.id] ??= [];
                let deck = prev['playerDecks'][p.id];
                deck = deck.concat(new Array(count).fill(0).map(_ => {
                    const c = createCard(key);
                    cardsById[c.id] = c;
                    return c.id
                }));
                prev['playerDecks'][p.id] = fisherYatesShuffle(deck);
                console.log('new deck', deck);
            });
            
            prev['playerHands'][p.id] = [];
            prev['playerDiscards'][p.id] = [];
            return prev;
        }, {
            playerHands: {},
            playerDecks: {},
            playerDiscards: {}
        } as Pick<Match, 'playerHands' | 'playerDiscards' | 'playerDecks'>);
    }
    
    private async onPlayerReady(playerId: number) {
        const player = getPlayerById(playerId);
        if (player) {
            player.ready = true;
        }
        if (getGameState().players.some(p => !p.ready)) {
            return;
        }

        console.log('all players ready');

        const effectsController = this.cardEffectsController = new CardEffectController(
            this.$matchState,
        );

        this.effectHandlerMap = createEffectHandlerMap(
            this.sockets,
            new ReactionManager(this.$matchState),
            effectsController
        );
        
        const pipeline = new EffectsPipeline(
          this.effectHandlerMap,
          this.$matchState,
          this.sockets,
          this.onCheckForPlayerActions.bind(this)
        );
        this.cardEffectsController.setEffectPipeline(pipeline);
        
        new CardInteractivityController(
            this.cardEffectsController,
            this.$matchState,
            this.sockets
        );

        for (const socket of this.sockets) {
            socket.on('nextPhase', this.onNextPhase.bind(this));
        }

        const match = {
            ...this.$matchState.get() ?? {},
            turnNumber: 1,
            currentPlayerTurnIndex: 0,
            playerActions: 1,
            playerBuys: 1,
            turnPhaseIndex: 0,
            playerTreasure: 0,
        };

        sendToSockets(this.sockets.values(), 'matchStarted', match as Match);
        
        await this.cardEffectsController?.suspendedCallbackRunner(async () => {
            for (const playerId of match.players!) {
                for (let i = 0; i < 5; i++) {
                    await effectsController.runGameActionEffects('drawCard', match as Match, playerId);
                }
            }
        });

        $selectableCards.listen(this.onSelectableCardsUpdated.bind(this));

        this.$matchState.set({...match});
        this.$matchState.listen(this.onMatchUpdated.bind(this));
        
        playerId = getCurrentPlayerId(match);
        if (!match.playerHands[playerId].some(c => match.cardsById[c].type.includes('ACTION'))) {
            void this.onNextPhase();
        }
    }
    
    private onSelectableCardsUpdated(cards: readonly { playerId: number, cardId: number }[]) {
        sendToSockets(this.sockets.values(), 'selectableCardsUpdated', [...cards]);
    }

    private onMatchUpdated(match: MatchUpdate) {
        this.calculateScores(match);
    }

    private calculateScores(match: MatchUpdate) {
        const scores: Record<number, number> = {};

        for (const playerId of match.players ?? []) {
            const cards = (match.playerHands?.[playerId] ?? [])
                .concat(match.playerDecks?.[playerId] ?? [])
                .concat(match.playerDiscards?.[playerId] ?? [])
                .concat(match.playArea ?? []);
            let score = 0;
            for (const cardId of cards) {
                const card = match.cardsById?.[cardId];
                score += card?.victoryPoints ?? 0;

                const customScoringFn = scoringFunctionMap[card?.cardKey ?? ''];
                if (customScoringFn) {
                    console.log(`processing scoring function for ${card}`);
                    score += customScoringFn(match as Match, playerId);
                }
            }
            scores[playerId] = score;
        }

        // todo only send update if scores differ
        sendToSockets(this.sockets.values(), 'scoresUpdated', scores);
    }

    private async onCheckForPlayerActions() {
        console.log('checking for remaining player actions');
        const match = this.$matchState.get();
        const newPhase = getTurnPhase(match);
        const playerId = match.players[match.currentPlayerTurnIndex % match.players.length];
        
        switch (newPhase) {
            case 'action': {
                const numActionCards = match.playerHands[playerId].filter(c =>
                  match.cardsById[c].type.includes('ACTION')).length;
                
                if (numActionCards <= 0 || match.playerActions <= 0) {
                    console.log(`player ${getPlayerById(playerId)} has ${match.playerActions} actions and ${numActionCards} action cards, skipping to next phase`);
                    this.$matchState.set({ ...this.$matchState.get(), ...match });
                    await this.onNextPhase(match);
                    return;
                }
                break;
            }
            case 'buy': {
                const treasureCardCount = match.playerHands[playerId].filter(c => match.cardsById[c].type.includes('TREASURE')).length;
                
                if (
                  (treasureCardCount <= 0 && match.playerTreasure <= 0)
                  || match.playerBuys <= 0
                ) {
                    console.log(`player ${getPlayerById(playerId)} has ${treasureCardCount} treasure cards in hand, ${match.playerTreasure} treasure, and ${match.playerBuys} buys`);
                    this.$matchState.set({ ...this.$matchState.get(), ...match });
                    await this.onNextPhase(match);
                    return;
                }
                break;
            }
        }
    }
    
    private async onNextPhase(update?: MatchUpdate) {
        const currentMatch = this.$matchState.get() as Match;

        try {
            const match: MatchUpdate = {
                ...update
            };
            match.turnPhaseIndex = currentMatch.turnPhaseIndex + 1;

            const newPhase = getTurnPhase(this.$matchState.get());
            let playerId = getCurrentPlayerId(currentMatch);

            switch (newPhase) {
                case 'action':
                    match.playerActions = 1;
                    match.playerBuys = 1
                    match.playerTreasure = 0;
                    match.currentPlayerTurnIndex = currentMatch.currentPlayerTurnIndex + 1;

                    if (getCurrentPlayerId(currentMatch) === 0) {
                        match.turnNumber = currentMatch.turnNumber + 1;
                        console.log(`Starting new round ${match.turnNumber}`);
                    }
                    
                    playerId = getCurrentPlayerId(currentMatch);
                    console.log(`starting ${newPhase} phase for ${getPlayerById(playerId)}`);
                    break;
                case 'buy':
                    console.log(`starting ${newPhase} phase for ${getPlayerById(playerId)}`);
                    break;
                case 'cleanup': {
                    console.log(`starting ${newPhase} phase for ${getPlayerById(playerId)}`);

                    const cardsToDiscard = currentMatch.playArea.concat(currentMatch.playerHands[playerId]);

                    await this.cardEffectsController?.suspendedCallbackRunner(async () => {
                        for (const cardId of cardsToDiscard) {
                            await this.cardEffectsController!.runGameActionEffects('discardCard', this.$matchState.get(), playerId, cardId);
                        }
                        
                        for (let i = 0; i < 5; i++) {
                            await this.cardEffectsController!.runGameActionEffects('drawCard', this.$matchState.get(), playerId);
                        }
                        
                        this.$matchState.set({...this.$matchState.get(), ...match});
                        await this.onNextPhase(match);
                    });
                    
                    return;
                }
            }

            sendToSockets(this.sockets.values(), 'matchUpdated', match);
            this.$matchState.set({...this.$matchState.get(), ...match});
        } catch (e) {
            console.error('Could not move to next phase', e);
            console.error(e);
        }
    }
}
