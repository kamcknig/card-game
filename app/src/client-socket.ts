import {
    $playerDeckStore,
    $playerDiscardStore,
    $playerHandStore,
    $players,
    $playerScoreStore,
    $selfPlayer,
    $selfPlayerId,
    PlayerState
} from "./state/player-state";
import {
    $expansionList
} from './state/expansion-list-state';
import {v4 as uuidv4} from 'uuid'
import {
    $currentPlayerTurnIndexActual,
    $playerActions,
    $playerBuys,
    $playerTreasure,
    $playerTurnOrder,
    $turnNumber,
    $turnPhase
} from "./state/turn-state";
import {displayScene} from "./core/scene/display-scene";
import {$gameOwner} from "./state/game-state";
import {io, Socket} from "socket.io-client";
import {$cardsById} from "./state/card-state";
import { $kingdomStore, $matchConfiguration, $playAreaStore, $supplyStore, $trashStore } from "./state/match-state";
import {$selectableCards, $selectedCards} from "./state/interactive-state";
import {gameEvents} from "./core/event/events";
import {Assets} from 'pixi.js';
import {
    ClientEmitEvents,
    ClientListenEventNames,
    ClientListenEvents,
    LogEntry,
    Match,
    ServerEmitEventNames,
    TurnPhaseOrderValues
} from "shared/types";
import { toNumber } from 'es-toolkit/compat';

export let socket: Socket<ClientListenEvents, ClientEmitEvents>;

export const socketToGameEventMap: { [p in ClientListenEventNames]: ClientListenEvents[p] } = {
    addLogEntry: (logEntry: LogEntry) => {
        let msg: string;
        switch (logEntry.type) {
            case 'draw': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                const cardName = $cardsById.get()[logEntry.cardId].cardName;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You drew a ${cardName}`;
                } else {
                    msg = `${playerName} drew a card`;
                }
                break;
            }
            case 'discard': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                const cardName = $cardsById.get()[logEntry.cardId].cardName;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You discarded a ${cardName}`;
                } else {
                    msg = `${playerName} discarded a card`;
                }
                break;
            }
            case 'gainBuy': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You gained ${logEntry.count} buy/s`;
                } else {
                    msg = `${playerName} gained ${logEntry.count} buy/s`;
                }
                break;
            }
            case 'gainTreasure': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You gained ${logEntry.count} treasure`;
                } else {
                    msg = `${playerName} gained ${logEntry.count} treasure`;
                }
                break;
            }
            case 'gainAction': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You gained ${logEntry.count} action/s`;
                } else {
                    msg = `${playerName} gained ${logEntry.count} action/s`;
                }
                break;
            }
            case 'gainCard': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                const cardName = $cardsById.get()[logEntry.cardId].cardName;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You gained a ${cardName}`;
                } else {
                    msg = `${playerName} gained a ${cardName}`;
                }
                break;
            }
            case 'playCard': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                const cardName = $cardsById.get()[logEntry.cardId].cardName;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You played a ${cardName}`;
                } else {
                    msg = `${playerName} played a ${cardName}`;
                }
                break;
            }
            case 'revealCard': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                const cardName = $cardsById.get()[logEntry.cardId].cardName;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You revealed a ${cardName}`;
                } else {
                    msg = `${playerName} revealed a ${cardName}`;
                }
                break;
            }
            case 'trashCard': {
                const playerName = $players.get()[logEntry.playerSourceId].name;
                const cardName = $cardsById.get()[logEntry.cardId].cardName;
                if ($selfPlayerId.get() === logEntry.playerSourceId) {
                    msg = `You trashed a ${cardName}`;
                } else {
                    msg = `${playerName} trashed a ${cardName}`;
                }
                break;
            }
        }

        if (!msg) return;
        gameEvents.emit('addLogEntry', msg);
    },
    cardEffectsComplete: () => gameEvents.emit('cardEffectsComplete'),
    doneWaitingForPlayer: playerId => {
        gameEvents.emit('doneWaitingForPlayer', playerId);
    },
    waitingForPlayer: playerId => {
        gameEvents.emit('waitingForPlayer', playerId);
    },
    expansionList: val => {
        $expansionList.set(val);
    },
    gameOwnerUpdated: playerId => {
        $gameOwner.set(playerId);
    },
    matchConfigurationUpdated: val => {
        $matchConfiguration.set(val);
    },
    matchReady: match => {
        $supplyStore.set(match.supply);
        $kingdomStore.set(match.kingdom);
        $playerTurnOrder.set(match.players);

        Object.values(match.players).forEach(p => {
            const pId = toNumber(p);
            $playerHandStore(pId).set(match?.playerHands[pId] ?? []);
            $playerDiscardStore(pId).set(match?.playerDiscards[pId] ?? []);
            $playerDeckStore(pId).set(match?.playerDecks[pId] ?? []);
        });

        $cardsById.set(match.cardsById);

        Assets.addBundle('cardLibrary', Object.values(match.cardsById).reduce((prev, c) => {
            prev[c.cardKey] = `./assets/${c.cardKey}.jpg`;
            prev[`${c.cardKey}-full`] = `./assets/full-size/${c.cardKey}.jpg`;
            return prev;
        }, {'card-back': './assets/full-size/card-back.jpg'} as Record<string, string>));

        void displayScene('match', match);
    },
    matchStarted: match => {
        socketToGameEventMap.matchUpdated(match);
        gameEvents.emit('matchStarted');
    },
    matchUpdated: match => {
        const keys = Object.keys(match);
        for (const key of keys) {
            switch (key) {
                case 'turnNumber':
                    $turnNumber.set(match.turnNumber);
                    break;
                case 'turnPhaseIndex':
                    $turnPhase.set(TurnPhaseOrderValues[match.turnPhaseIndex]);
                    break;
                case 'currentPlayerTurnIndex':
                    $currentPlayerTurnIndexActual.set(match.currentPlayerTurnIndex);
                    break;
                case 'playerBuys':
                    $playerBuys.set(match.playerBuys);
                    break;
                case 'playerActions':
                    $playerActions.set(match.playerActions);
                    break;
                case 'playerTreasure':
                    $playerTreasure.set(match.playerTreasure);
                    break;
                case 'playArea':
                    $playAreaStore.set(match.playArea);
                    break;
                case 'supply':
                    $supplyStore.set(match.supply);
                    break;
                case 'kingdom':
                    $kingdomStore.set(match.kingdom);
                    break;
                case 'playerHands':
                    for (const playerId of Object.keys(match.playerHands)) {
                        $playerHandStore(toNumber(playerId)).set(match.playerHands[toNumber(playerId)] ?? []);
                    }
                    break;
                case 'playerDecks':
                    for (const playerId of Object.keys(match.playerDecks)) {
                        $playerDeckStore(toNumber(playerId)).set(match.playerDecks[toNumber(playerId)] ?? []);
                    }
                    break;
                case 'playerDiscards':
                    for (const playerId of Object.keys(match.playerDiscards)) {
                        $playerDiscardStore(toNumber(playerId)).set(match.playerDiscards[toNumber(playerId)] ?? []);
                    }
                    break;
                case 'trash':
                    $trashStore.set(match.trash);
                    break;
            }
        }
    },
    playerConnected: (player, players) => {
        $players.set(players.reduce((prev, nextPlayer) => {
            prev[nextPlayer.id] = nextPlayer;
            return prev;
        }, {} as PlayerState));
    },
    playerDisconnected: (player, players) => {
        $players.set(players.reduce((prev, nextPlayer) => {
            prev[nextPlayer.id] = nextPlayer;
            return prev;
        }, {} as PlayerState));
    },
    playerSet: player => {
        $selfPlayer.set({...player});
        void displayScene('matchConfiguration');
    },
    reconnectedToGame: (player, state?: Match) => {
        $players.setKey(player.id, player);

        if (state) {
            socketToGameEventMap.matchUpdated(state);
        }
    },
    scoresUpdated: scores => {
        Object.keys(scores).forEach(playerId => {
            const pId = toNumber(playerId);
            $playerScoreStore(pId).set(scores[pId]);
        })
    },
    selectableCardsUpdated: cards => {
        // todo: maybe server really should send only the cards for this player. but right now it's a limitation
        // on how the back-end is storing some data for itself. the sending of data needs an overhaul anyway
        // rather than sending this update as a whole
        $selectableCards.set(cards);
    },
    selectCard: ({selectableCardIds, count}) => {
        const eventListener = (cardIds: number[]) => {
            gameEvents.off('cardsSelected', eventListener);
            $selectedCards.set([]);
            socket.emit('selectCardResponse', cardIds);
        };

        // warning, state must be updated currently before emitting 'selectCard' event
        $selectableCards.set(selectableCardIds);
        gameEvents.emit('selectCard', count);
        gameEvents.on('cardsSelected', eventListener);
    },
    userPrompt: userPromptArgs => {
        const userPromptResponseListener = (result: unknown) => {
            gameEvents.off('userPromptResponse', userPromptResponseListener);
            socket.emit('userPromptResponse', result);
        };

        console.log('kyle');
        gameEvents.on('userPromptResponse', userPromptResponseListener);
        gameEvents.emit('userPrompt', userPromptArgs);
    }
}

const wrapHandler = <F extends (this: null, ...args: any[]) => any>(
    eventName: string,
    handler: F
): F => {
    const wrapped = function (this: null, ...args: Parameters<F>): ReturnType<F> {
        console.log(`Socket event '${eventName}' invoked with arguments:`, ...args);
        return handler.apply(null, args);
    };
    // First cast to unknown, then to F.
    return wrapped as unknown as F;
};

export const createSocket = () => {
    socket = io(process.env.WS_HOST, {
        timeout: 5000,
        requestTimeout: 5000,
        query: {sessionId},
        transports: ["websocket", "polling"]
    });
    socket.on('connect_error', function (error) {
        console.log(error.message);
    });


    (Object.keys(socketToGameEventMap) as ServerEmitEventNames[]).forEach(eventName => {
        console.log('creating handler for event', eventName);
        const handler = socketToGameEventMap[eventName];
        socket.on(eventName, wrapHandler(eventName, handler));
    });

    socket.on('disconnect', (arg1, arg2) => {
        console.log('SOCKET disconnected reason', arg1, 'description', arg2);
    });

    gameEvents.on('ready', playerId => socket.emit('ready', playerId));
    gameEvents.on('nextPhase', () => socket.emit('nextPhase'));
    gameEvents.on('cardTapped', (playerId, cardId) => socket.emit('cardTapped', playerId, cardId));
}

const sessionId = localStorage.getItem('sessionId');

if (!sessionId) {
    localStorage.setItem('sessionId', uuidv4());
    console.log('No session ID found creating new ID', localStorage.getItem('sessionId'));
} else {
    console.log('using pre-existing session ID', localStorage.getItem('sessionId'));
}
