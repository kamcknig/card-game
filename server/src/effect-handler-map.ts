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

// separated this function out so that I could invoke it from within other effect handlers.
// otherwise I wasn't able to invoke it via this.moveCard because this wasn't bound within the handlers
async function moveCard(effect: MoveCardEffect, match: Match, reactionManager: ReactionManager) {
    const card = match.cardsById[effect.cardId];

    const {sourceStore: oldStore, index, storeKey: oldStoreKey} = findSourceByCardId(effect.cardId, match);

    if (!oldStoreKey || isUndefined(index)) {
        console.log('could not find card in a store to move it');
        return {match: {} };
    }

    const newStore = findSourceByLocationSpec({playerId: effect.playerId!, spec: effect.to}, match);

    if (!newStore) {
        console.log('could not find new store');
        return {match: {} };
    }

    oldStore.splice(index, 1);

    const oldLoc = findSpecLocationBySource(match, oldStore);
    let unregisterIds: string[] | undefined = undefined;

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

    if (unregisterIds !== undefined && unregisterIds?.length > 0) {
        for (const id of unregisterIds) {
            reactionManager.unregisterTrigger(id);
        }
    }

    newStore.push(effect.cardId);

    if (effect.playerId) {
        let triggerTemplates: ReactionTemplate[] | void = undefined;
        switch (effect.to.location) {
            case 'playerHands':
                triggerTemplates =
                    cardLifecycleMap[card.cardKey]?.['onEnterHand']?.(effect.playerId, effect.cardId)?.registerTriggers;
                break;
            case 'playArea':
                triggerTemplates =
                    cardLifecycleMap[card.cardKey]?.['onEnterPlay']?.(effect.playerId, effect.cardId)?.registerTriggers;
        }

        if (triggerTemplates && triggerTemplates.length > 0) {
            for (const triggerTemplate of triggerTemplates) {
                reactionManager.registerReactionTemplate(triggerTemplate);
            }
        }
    }

    const newMatch: MatchUpdate = {};
    if (['playerHands', 'playerDecks', 'playerDiscards'].includes(oldStoreKey)) {
        if (effect.playerId) {
            switch (oldStoreKey) {
                case 'playerHands':
                    newMatch.playerHands = {
                        ...match.playerHands,
                        [effect.playerId]: oldStore
                    }
                    break;
                case 'playerDiscards':
                    newMatch.playerDiscards = {
                        ...match.playerDiscards,
                        [effect.playerId]: oldStore
                    }
                    break;
                case 'playerDecks':
                    newMatch.playerDecks = {
                        ...match.playerDecks,
                        [effect.playerId]: oldStore
                    }
                    break;
            }
        }
    } else {
        newMatch[oldStoreKey] = oldStore;
    }

    if (['playerHands', 'playerDecks', 'playerDiscards'].includes(effect.to.location)) {
        if (effect.playerId) {
            switch (effect.to.location) {
                case 'playerHands':
                    newMatch.playerHands = {
                        ...match.playerHands,
                        [effect.playerId]: newStore
                    }
                    break;
                case 'playerDiscards':
                    newMatch.playerDiscards = {
                        ...match.playerDiscards,
                        [effect.playerId]: newStore
                    }
                    break;
                case 'playerDecks':
                    newMatch.playerDecks = {
                        ...match.playerDecks,
                        [effect.playerId]: newStore
                    }
                    break;
            }
        }
    } else {
        newMatch[effect.to.location] = newStore as unknown as any;
    }

    return {
        match: newMatch,
        results: []
    };
}

/**
 * Returns an object whose properties are functions. The names are a union of Effect types
 * and whose values are functions to implement that Effect within the system
 */
export const createEffectHandlerMap =
    (sockets: AppSocket[],
     reactionManager: ReactionManager,
     cardEffectRunner: IEffectRunner
    ): EffectHandlerMap => {
        return {
            async discardCard(effect, match) {

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
                    reactionManager
                );
            },
            async drawCard(effect, match) {
                const deck = match.playerDecks[effect.playerId];
                const discard = match.playerDiscards[effect.playerId];

                if (discard.length + deck.length === 0) {
                    console.log('not enough cards to draw in deck + hand');
                    return {match: {}, results: undefined};
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
                    sendToSockets(sockets.values(), 'matchUpdated', { playerDiscards: { [effect.playerId]: []}});

                    for (const card of discard) {
                        deck.push(card);
                    }

                    match.playerDiscards[effect.playerId] = [];
                }

                const drawnCardId = deck.slice(-1)?.[0]
                if (!drawnCardId) {
                    return {
                        match: {playerDecks: match.playerDecks, playerHands: match.playerHands},
                        results: undefined
                    };
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
                    reactionManager
                );
            },
            async gainAction(effect, match) {
                const playerActions = match.playerActions + effect.count;
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainAction',
                    count: effect.count,
                    playerSourceId: effect.sourcePlayerId
                });
                return {match: {playerActions}, results: null};
            },
            async gainBuy(effect, match) {
                const playerBuys = match.playerBuys + effect.count;
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainBuy',
                    count: effect.count,
                    playerSourceId: effect.sourcePlayerId
                });
                return {match: {playerBuys}, results: null};
            },
            async gainCard(effect, match) {
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
                        cardId: effect.sourceCardId
                    }),
                    match,
                    reactionManager
                );
            },
            async gainTreasure(effect, match) {
                const playerTreasure = match.playerTreasure + effect.count;
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'gainTreasure',
                    count: effect.count,
                    playerSourceId: effect.sourcePlayerId
                });
                return {match: {playerTreasure}, results: null};
            },
            async moveCard(effect, match) {
                return moveCard(effect, match, reactionManager);
            },
            async playCard(effect, match) {
                const {playerId, sourceCardId, sourcePlayerId, cardId} = effect;

                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'playCard',
                    cardId: effect.cardId,
                    playerSourceId: effect.sourcePlayerId
                });

                let {match: newMatch} = await moveCard(
                    new MoveCardEffect({
                        cardId,
                        playerId,
                        sourcePlayerId,
                        sourceCardId,
                        to: {location: 'playArea'}
                    }),
                    match,
                    reactionManager
                );

                sendToSockets(sockets.values(), 'matchUpdated', newMatch);

                match = {
                    ...match,
                    ...newMatch
                }

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
                        const reactionResults = await cardEffectRunner.runGenerator(reactionGenerator, match);
                        if (reaction.once) {
                            reactionManager.unregisterTrigger(reaction.id);
                        }
                        match = {...match, ...reactionResults.match};
                        reactionContext[reaction.playerId] = reactionResults.results;
                    }
                }

                // We just call the runner’s method:
                return await cardEffectRunner.runCardEffects(match, sourcePlayerId, cardId, reactionContext);
            },
            async revealCard(effect, match) {
                console.log('effectHandler revealCard', effect);
                sendToSockets(sockets.values(), 'addLogEntry', {
                    type: 'revealCard',
                    cardId: effect.cardId,
                    playerSourceId: effect.playerId
                });

                return {match: {}, results: null};
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
                            resolve({match: {}, results: selectedCards ?? []});
                        }
                        socket?.on('selectCardResponse', socketListener);

                        socket?.emit('selectCard', {selectableCardIds, count: effect.count ?? 1});
                    } catch (e) {
                        reject(new Error(`could not find player socket in game state... ${e}`));
                    }
                });
            },
            async trashCard(effect, match) {
                console.log('effectHandler trashCard', effect);

                const cardId = effect.cardId;
                const {sourceStore} = findSourceByCardId(cardId, match);

                if (sourceStore === match.trash) {
                    console.log(`Card is already in trash`)
                    return {match: {}, results: null};
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
                    reactionManager
                );
            },
            async userPrompt(effect, match) {
                console.log('effectHandler userPrompt', effect);

                return new Promise((resolve, reject) => {
                    try {
                        const socket = playerSocketMap.get(effect.playerId);

                        const socketListener = (result: unknown) => {
                            socket?.off('userPromptResponse', socketListener);
                            resolve({match: {}, results: result});
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
