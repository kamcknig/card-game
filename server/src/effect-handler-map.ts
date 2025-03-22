import {AppSocket, EffectHandlerMap, IEffectRunner, ReactionTemplate, ReactionTrigger} from "./types.ts";
import {sendToSockets} from "./utils/send-to-sockets.ts";
import {fisherYatesShuffle} from "./utils/fisher-yates-shuffler.ts";
import {findCards} from './utils/find-cards.ts';
import {ReactionManager} from './reaction-manager.ts';
import {Match, MatchUpdate} from "shared/types.ts";
import {MoveCardEffect} from "./effect.ts";
import {cardLifecycleMap} from "./effect-generator-map.ts";
import {findOrderedEffectTargets} from "./utils/find-ordered-effect-targets.ts";
import {findSourceByCardId} from "./utils.find-source-by-card-id.ts";
import {findSpecLocationBySource} from "./utils/find-spec-location-by-source.ts";
import {findSourceByLocationSpec} from "./utils/find-source-by-location-spec.ts";
import {playerSocketMap} from './player-socket-map.ts';
import { isUndefined } from 'es-toolkit';
import { castArray } from "es-toolkit/compat";

/**
 * Returns an object whose properties are functions. The names are a union of Effect types
 * and whose values are functions to implement that Effect within the system
 */
export const createEffectHandlerMap =
    (sockets: AppSocket[],
     reactionManager: ReactionManager,
     cardEffectRunner: IEffectRunner
    ): EffectHandlerMap => {
        async function moveCard(effect: MoveCardEffect, match: Match, reactionManager: ReactionManager, acc: MatchUpdate) {
            const card = match.cardsById[effect.cardId];
            
            const {
                sourceStore: oldStore,
                index,
                storeKey: oldStoreKey
            } = findSourceByCardId(effect.cardId, match);
            
            if (!oldStoreKey || isUndefined(index)) {
                console.log('could not find card in a store to move it');
                return;
            }
            
            effect.to.location = castArray(effect.to.location);
            
            const newStore = findSourceByLocationSpec({playerId: effect.playerId!, spec: effect.to}, match);
            
            if (!newStore) {
                console.log('could not find new store');
                return;
            }
            
            oldStore.splice(index, 1);
            
            const oldLoc = findSpecLocationBySource(match, oldStore);
            let unregisterIds: string[] | undefined = undefined;
            
            // when a card moves out of a location, check if we need to unregister any triggers for the card
            // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
            // todo: this can also add triggers, not just remove
            switch (oldLoc) {
                case 'playerHands':
                    unregisterIds =
                      cardLifecycleMap[card.cardKey]?.['onLeaveHand']?.(effect.playerId!, effect.cardId)?.unregisterTriggers;
                    break;
                case 'playArea':
                    unregisterIds =
                      cardLifecycleMap[card.cardKey]?.['onLeavePlay']?.(effect.playerId!, effect.cardId)?.unregisterTriggers;
                    break;
            }
            
            unregisterIds?.forEach(id => reactionManager.unregisterTrigger((id)));
            
            newStore.push(effect.cardId);
            
            // when a card moves to a new location, check if we need to register any triggers for the card
            // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
            // todo: this can also remove triggers, not just add
            if (effect.playerId) {
                let triggerTemplates: ReactionTemplate[] | void = undefined;
                switch (effect.to.location[0]) {
                    case 'playerHands':
                        triggerTemplates =
                          cardLifecycleMap[card.cardKey]?.['onEnterHand']?.(effect.playerId, effect.cardId)?.registerTriggers;
                        break;
                    case 'playArea':
                        triggerTemplates =
                          cardLifecycleMap[card.cardKey]?.['onEnterPlay']?.(effect.playerId, effect.cardId)?.registerTriggers;
                }
                
                triggerTemplates?.forEach((triggerTemplate) => reactionManager.registerReactionTemplate(triggerTemplate));
            }
            
            const interimUpdate: MatchUpdate = {};
            
            // update the accumulator with the card's old location
            if (['playerHands', 'playerDecks', 'playerDiscards'].includes(oldStoreKey)) {
                if (effect.playerId) {
                    switch (oldStoreKey) {
                        case 'playerHands':
                            acc.playerHands = {
                                ...acc.playerHands,
                                [effect.playerId]: oldStore
                            };
                            interimUpdate.playerHands = {[effect.playerId]: oldStore};
                            break;
                        case 'playerDiscards':
                            acc.playerDiscards = {
                                ...acc.playerDiscards,
                                [effect.playerId]: oldStore
                            };
                            interimUpdate.playerDiscards = {[effect.playerId]: oldStore};
                            break;
                        case 'playerDecks':
                            acc.playerDecks = {
                                ...acc.playerDecks,
                                [effect.playerId]: oldStore
                            };
                            interimUpdate.playerDecks = {[effect.playerId]: oldStore};
                            break;
                    }
                }
            } else {
                acc[oldStoreKey] = oldStore;
                interimUpdate[oldStoreKey] = oldStore;
            }
            
            // update the accumulator with the cards new location
            if (effect.to.location.some(l => ['playerHands', 'playerDecks', 'playerDiscards'].includes(l))) {
                if (effect.playerId) {
                    switch (effect.to.location[0]) {
                        case 'playerHands':
                            acc.playerHands = {
                                ...acc.playerHands,
                                [effect.playerId]: newStore
                            };
                            interimUpdate.playerHands = {[effect.playerId]: newStore};
                            break;
                        case 'playerDiscards':
                            acc.playerDiscards = {
                                ...acc.playerDiscards,
                                [effect.playerId]: newStore
                            };
                            interimUpdate.playerDiscards = {[effect.playerId]: newStore};
                            break;
                        case 'playerDecks':
                            acc.playerDecks = {
                                ...acc.playerDecks,
                                [effect.playerId]: newStore
                            };
                            interimUpdate.playerDecks = {[effect.playerId]: newStore};
                            break;
                    }
                }
            } else {
                acc[effect.to.location[0]] = newStore as unknown as any;
                interimUpdate[effect.to.location[0]] = newStore as unknown as any;
            }
            
            sendToSockets(sockets.values(), 'matchUpdated', interimUpdate)
        }
        
        return {
            async discardCard(effect, match, acc) {
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'discard',
                    playerSourceId: effect.playerId,
                    cardId: effect.cardId
                });

                return moveCard(
                    new MoveCardEffect({
                        sourceCardId: effect.sourceCardId,
                        sourcePlayerId: effect.sourcePlayerId,
                        cardId: effect.cardId,
                        playerId: effect.playerId,
                        to: {location: 'playerDiscards'}
                    }),
                    match,
                    reactionManager,
                    acc
                );
            },
            async drawCard(effect, match, acc) {
                const deck = match.playerDecks[effect.playerId];
                const discard = match.playerDiscards[effect.playerId];

                if (discard.length + deck.length === 0) {
                    console.log('not enough cards to draw in deck + hand');
                    return;
                }

                // todo: here and other places, i'm manually shuffling the discard into the deck.
                // this might mess with reaction triggers as they are added when cards are moved
                // to different play areas via the moveCard effect handler. (there are some in
                // later sets that can be played from the deck for example and if those are handled
                // via reactions and triggers then their reactions wont' get registered properly
                if (deck.length === 0) {
                    console.log('player', effect.playerId, 'does not have enough cards to draw, moving discard to deck');
                    const discard = match.playerDiscards[effect.playerId];
                    fisherYatesShuffle(discard);

                    for (const card of discard) {
                        deck.push(card);
                    }

                    match.playerDiscards[effect.playerId] = [];
                    
                    acc.playerDecks = {
                        ...(acc.playerDecks ?? {}),
                        [effect.playerId]: deck
                    };
                    
                    acc.playerDiscards = {
                        ...(acc.playerDiscards ?? {}),
                        [effect.playerId]: []
                    };
                }

                const drawnCardId = deck.slice(-1)?.[0]
                if (!drawnCardId) {
                    return
                }

                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'draw',
                    playerSourceId: effect.playerId,
                    cardId: drawnCardId
                });

                return moveCard(
                    new MoveCardEffect({
                        sourceCardId: effect.sourceCardId,
                        sourcePlayerId: effect.sourcePlayerId,
                        cardId: drawnCardId,
                        playerId: effect.playerId,
                        to: {location: 'playerHands'},
                    }),
                    match,
                    reactionManager,
                    acc
                );
            },
            async gainAction(effect, match, acc) {
                acc.playerActions = match.playerActions + effect.count;
                match.playerActions = acc.playerActions;
                
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainAction',
                    count: effect.count,
                    playerSourceId: effect.sourcePlayerId
                });
                return;
            },
            async gainBuy(effect, match, acc) {
                acc.playerBuys = match.playerBuys + effect.count;
                match.playerBuys = acc.playerBuys;
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainBuy',
                    count: effect.count,
                    playerSourceId: effect.sourcePlayerId
                });
                return;
            },
            async gainCard(effect, match, acc) {
                effect.to.location ??= 'playerDiscards';

                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainCard',
                    cardId: effect.cardId,
                    playerSourceId: effect.playerId
                });

                return moveCard(
                    new MoveCardEffect({
                        to: effect.to,
                        sourcePlayerId: effect.sourcePlayerId,
                        sourceCardId: effect.sourceCardId,
                        playerId: effect.playerId,
                        cardId: effect.cardId
                    }),
                    match,
                    reactionManager,
                    acc
                );
            },
            async gainTreasure(effect, match, acc) {
                acc.playerTreasure = match.playerTreasure + effect.count;
                match.playerTreasure = acc.playerTreasure;
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainTreasure',
                    count: effect.count,
                    playerSourceId: effect.sourcePlayerId
                });
                return null;
            },
            async moveCard(effect, match, acc) {
                return moveCard(effect, match, reactionManager, acc);
            },
            async playCard(effect, match, acc) {
                const {playerId, sourceCardId, sourcePlayerId, cardId} = effect;

                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'playCard',
                    cardId: effect.cardId,
                    playerSourceId: effect.sourcePlayerId
                });

                await moveCard(
                    new MoveCardEffect({
                        cardId,
                        playerId,
                        sourcePlayerId,
                        sourceCardId,
                        to: {location: 'playArea'}
                    }),
                    match,
                    reactionManager,
                    acc
                );

                //sendToSockets(sockets.values(), 'matchUpdated', newMatch);

                const trigger: ReactionTrigger = {eventType: 'cardPlayed', playerId, cardId};
                let reactions = reactionManager.getReactions(
                    match,
                    trigger
                );

                const card = match.cardsById[cardId];

                if (!isUndefined(card.targetScheme)) {
                    const targetScheme = card.targetScheme ?? 'ALL_OTHER';
                    const potentialTargets = findOrderedEffectTargets(sourcePlayerId, targetScheme, match);
                    reactions = reactions.filter(r => potentialTargets.includes(r.playerId));
                    reactions.sort((a, b) =>
                        potentialTargets.findIndex(p => p === a.playerId) - potentialTargets.findIndex(p => p === b.playerId));
                }

                const reactionContext: any = {};
                // if we have any reactions for a 'cardPlayed'
                if (reactions.length > 0) {
                    // sort reactions based on the order of the potential targets
                    for (const reaction of reactions) {
                        const reactionGenerator = await reaction.generatorFn(match, trigger, reaction);
                        const reactionResults = await cardEffectRunner.runGenerator(reactionGenerator, match, acc);
                        if (reaction.once) {
                            reactionManager.unregisterTrigger(reaction.id);
                        }
                        reactionContext[reaction.playerId] = reactionResults;
                    }
                }

                // We just call the runner’s method:
                return await cardEffectRunner.runCardEffects(match, sourcePlayerId, cardId, acc, reactionContext);
            },
            async revealCard(effect) {
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'revealCard',
                    cardId: effect.cardId,
                    playerSourceId: effect.playerId
                });

                return null;
            },
            async selectCard(effect, match) {
                console.log('effectHandler selectCard', effect);

                effect.count ??= 1;

                let selectableCardIds: number[] = [];
                const playerId = effect.playerId;
                if (effect.restrict === 'SELF') { // the card that triggered the effect action
                    if (effect.sourceCardId) {
                        console.log('setting selection to effect source', effect.sourceCardId);
                        selectableCardIds = [effect.sourceCardId];
                    } else {
                        throw new Error("effect restriction set to 'SELF' but no sourceCardId was found.")
                    }
                } else if (Array.isArray(effect.restrict)) { // should be a list of card IDs
                    console.log('setting selection to list of cards', effect.restrict);
                    return {match: {...match}, results: effect.restrict};
                } else if (effect.restrict.from) {
                    if (effect.restrict.from.location === 'playerDecks') {
                        console.warn('will not be able to select from deck, not sending it to client, nor able to show them to them right now');
                    }
                    selectableCardIds = findCards(match, effect.restrict, match.cardsById, playerId);
                }

                if (selectableCardIds?.length === 0) {
                    console.log('found no cards within restricted set', effect.restrict);
                    return {match: {...match}, results: []};
                }

                // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
                // because the player would be forced to select hem all anyway
                if ((typeof effect.count === 'number') || (effect.count.kind === 'exact')) {
                    let count: number = 0;
                    if ((typeof effect.count === 'number')) {
                        count = effect.count;
                    } else if (effect.count.kind === 'exact') {
                        count = effect.count.count;
                    }
                    console.log('selection count is an exact count', count, 'checking if user has that many cards');

                    if (selectableCardIds.length <= count) {
                        console.log('user does not have enough, or has exactly the amount of cards to select from, selecting all automatically');
                        return {match: {...match}, results: selectableCardIds};
                    }
                }

                return new Promise((resolve, reject) => {
                    try {
                        console.warn('not the best way to get players sockets? in effect-handler-map.ts');

                        const socket = playerSocketMap.get(playerId);

                        const socketListener = (selectedCards: number[]) => {
                            socket?.off('selectCardResponse', socketListener);
                            resolve(selectedCards);
                        }
                        socket?.on('selectCardResponse', socketListener);

                        socket?.emit('selectCard', {selectableCardIds, count: effect.count ?? 1});
                    } catch (e) {
                        reject(new Error(`could not find player socket in game state... ${e}`));
                    }
                });
            },
            async trashCard(effect, match, acc) {
                const cardId = effect.cardId;
                const {sourceStore} = findSourceByCardId(cardId, match);

                if (sourceStore === match.trash) {
                    console.log(`Card is already in trash`)
                    return;
                }

                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'trashCard',
                    cardId: effect.cardId,
                    playerSourceId: effect.playerId!,
                })

                return moveCard(
                    new MoveCardEffect({
                        to: {location: 'trash'},
                        sourcePlayerId: effect.sourcePlayerId,
                        sourceCardId: effect.sourceCardId,
                        playerId: effect.playerId,
                        cardId: effect.cardId
                    }),
                    match,
                    reactionManager,
                    acc
                );
            },
            async userPrompt(effect, match) {
                console.log('effectHandler userPrompt', effect);

                return new Promise((resolve, reject) => {
                    try {
                        const socket = playerSocketMap.get(effect.playerId);

                        const socketListener = (result: unknown) => {
                            socket?.off('userPromptResponse', socketListener);
                            resolve(result);
                        }
                        socket?.on('userPromptResponse', socketListener);

                        socket?.emit('userPrompt', {...effect});
                    } catch (e) {
                        reject(new Error(`could not find player socket in game state... ${e}`));
                    }
                });
            }
        };
    };
