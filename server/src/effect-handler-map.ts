import {
  AppSocket,
  EffectHandlerMap,
  IEffectRunner, PlayerID,
  ReactionTemplate,
  ReactionTrigger,
} from './types.ts';
import { fisherYatesShuffle } from './utils/fisher-yates-shuffler.ts';
import { findCards } from './utils/find-cards.ts';
import { ReactionManager } from './reaction-manager.ts';
import { Match, MatchUpdate } from 'shared/shared-types.ts';
import { MoveCardEffect } from './effect.ts';
import { cardLifecycleMap } from './effect-generator-map.ts';
import { findOrderedEffectTargets } from './utils/find-ordered-effect-targets.ts';
import { findSourceByCardId } from './utils.find-source-by-card-id.ts';
import { findSpecLocationBySource } from './utils/find-spec-location-by-source.ts';
import { findSourceByLocationSpec } from './utils/find-source-by-location-spec.ts';
import { castArray, isUndefined } from 'es-toolkit/compat';
import { CardLibrary } from "./match-controller.ts";

/**
 * Returns an object whose properties are functions. The names are a union of Effect types
 * and whose values are functions to implement that Effect within the system
 */
export const createEffectHandlerMap = (
  socketMap: Map<PlayerID, AppSocket>,
  reactionManager: ReactionManager,
  cardEffectRunner: IEffectRunner,
  cardLibrary: CardLibrary,
): EffectHandlerMap => {
  async function moveCard(
    effect: MoveCardEffect,
    match: Match,
    acc: MatchUpdate,
  ) {
    const card = cardLibrary.getCard(effect.cardId);

    const {
      sourceStore: oldStore,
      index,
      storeKey: oldStoreKey,
    } = findSourceByCardId(effect.cardId, match, cardLibrary);

    if (!oldStoreKey || isUndefined(index)) {
      console.debug('could not find card in a store to move it');
      return;
    }

    console.log(`moving card ${card} from ${oldStoreKey} to ${effect.to}`);

    effect.to.location = castArray(effect.to.location);

    const newStore = findSourceByLocationSpec({
      playerId: effect.playerId!,
      spec: effect.to,
    }, match);

    if (!newStore) {
      console.debug('could not find new store to move card to');
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
        unregisterIds = cardLifecycleMap[card.cardKey]?.['onLeaveHand']?.(
          effect.playerId!,
          effect.cardId,
        )?.unregisterTriggers;
        break;
      case 'playArea':
        unregisterIds = cardLifecycleMap[card.cardKey]?.['onLeavePlay']?.(
          effect.playerId!,
          effect.cardId,
        )?.unregisterTriggers;
        break;
    }

    unregisterIds?.forEach((id) => reactionManager.unregisterTrigger(id));

    newStore.push(effect.cardId);

    // when a card moves to a new location, check if we need to register any triggers for the card
    // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
    // todo: this can also remove triggers, not just add
    if (effect.playerId) {
      let triggerTemplates: ReactionTemplate[] | void = undefined;
      switch (effect.to.location[0]) {
        case 'playerHands':
          triggerTemplates = cardLifecycleMap[card.cardKey]?.['onEnterHand']?.(
            effect.playerId,
            effect.cardId,
          )?.registerTriggers;
          break;
        case 'playArea':
          triggerTemplates = cardLifecycleMap[card.cardKey]?.['onEnterPlay']?.(
            effect.playerId,
            effect.cardId,
          )?.registerTriggers;
      }

      triggerTemplates?.forEach((triggerTemplate) =>
        reactionManager.registerReactionTemplate(triggerTemplate)
      );
    }

    const interimUpdate: MatchUpdate = {};

    // update the accumulator with the card's old location
    if (
      ['playerHands', 'playerDecks', 'playerDiscards'].includes(oldStoreKey)
    ) {
      if (effect.playerId) {
        switch (oldStoreKey) {
          case 'playerHands':
            acc.playerHands = {
              ...acc.playerHands,
              [effect.playerId]: oldStore,
            };
            interimUpdate.playerHands = { [effect.playerId]: oldStore };
            break;
          case 'playerDiscards':
            acc.playerDiscards = {
              ...acc.playerDiscards,
              [effect.playerId]: oldStore,
            };
            interimUpdate.playerDiscards = { [effect.playerId]: oldStore };
            break;
          case 'playerDecks':
            acc.playerDecks = {
              ...acc.playerDecks,
              [effect.playerId]: oldStore,
            };
            interimUpdate.playerDecks = { [effect.playerId]: oldStore };
            break;
        }
      }
    } else {
      acc[oldStoreKey] = oldStore;
      interimUpdate[oldStoreKey] = oldStore;
    }

    // update the accumulator with the cards new location
    if (
      effect.to.location.some((l) =>
        ['playerHands', 'playerDecks', 'playerDiscards'].includes(l)
      )
    ) {
      if (effect.playerId) {
        switch (effect.to.location[0]) {
          case 'playerHands':
            acc.playerHands = {
              ...acc.playerHands,
              [effect.playerId]: newStore,
            };
            interimUpdate.playerHands = { [effect.playerId]: newStore };
            break;
          case 'playerDiscards':
            acc.playerDiscards = {
              ...acc.playerDiscards,
              [effect.playerId]: newStore,
            };
            interimUpdate.playerDiscards = { [effect.playerId]: newStore };
            break;
          case 'playerDecks':
            acc.playerDecks = {
              ...acc.playerDecks,
              [effect.playerId]: newStore,
            };
            interimUpdate.playerDecks = { [effect.playerId]: newStore };
            break;
        }
      }
    } else {
      acc[effect.to.location[0]] = newStore as unknown as any;
      interimUpdate[effect.to.location[0]] = newStore as unknown as any;
    }

    // because where a card is on the board, we immediately send an update with the new cards location to
    // clients to visually update them. normally we'd wait.
    // TODO: can this go in the effects pipeline? Maybe checking if the effect was a move effect and if
    // so send the interim update there? Having it here special-cases it and that's rarely good
    socketMap.forEach(s => s.emit('matchUpdated', interimUpdate));
  }

  async function shuffleDeck(playerId: number, match: Match, acc: MatchUpdate) {
    console.log(`shuffling deck for ${match.players.find(player => player.id === playerId)}`);

    let interimUpdate: MatchUpdate = {};

    const deck = match.playerDecks[playerId];
    const discard = match.playerDiscards[playerId];

    match.playerDecks[playerId] = fisherYatesShuffle(discard).concat(deck);
    match.playerDiscards[playerId] = [];

    acc.playerDecks = {
      ...acc.playerDecks ?? {},
      [playerId]: match.playerDecks[playerId],
    };
    acc.playerDiscards = {
      ...acc.playerDiscards ?? {},
      [playerId]: [],
    };

    interimUpdate = {
      playerDecks: {
        [playerId]: match.playerDecks[playerId],
      },
      playerDiscards: {
        [playerId]: [],
      },
    };

    // because where a card is on the board, we immediately send an update with the new cards location to
    // clients to visually update them. normally we'd wait.
    // TODO: can this go in the effects pipeline? Maybe checking if the effect was a move effect and if
    // so send the interim update there? Having it here special-cases it and that's rarely good
    socketMap.forEach(s => s.emit('matchUpdated', interimUpdate));
  }

  return {
    async discardCard(effect, match, acc) {
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'discard',
        playerSourceId: effect.playerId,
        cardId: effect.cardId,
      }));

      return moveCard(
        new MoveCardEffect({
          sourceCardId: effect.sourceCardId,
          sourcePlayerId: effect.sourcePlayerId,
          cardId: effect.cardId,
          playerId: effect.playerId,
          to: { location: 'playerDiscards' },
        }),
        match,
        acc,
      );
    },
    async drawCard(effect, match, acc) {
      let deck = match.playerDecks[effect.playerId];
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
        console.debug(`not enough cards in deck, shuffling`);
        await shuffleDeck(effect.playerId, match, acc);
        deck = match.playerDecks[effect.playerId];
      }

      const drawnCardId = deck.slice(-1)?.[0];
      if (!drawnCardId) {
        console.debug(`no card drawn`);
        return;
      }

      console.debug(`card drawn ${cardLibrary.getCard(drawnCardId)}`);

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'draw',
        playerSourceId: effect.playerId,
        cardId: drawnCardId,
      }));

      await moveCard(
        new MoveCardEffect({
          sourceCardId: effect.sourceCardId,
          sourcePlayerId: effect.sourcePlayerId,
          cardId: drawnCardId,
          playerId: effect.playerId,
          to: { location: 'playerHands' },
        }),
        match,
        acc,
      );

      return drawnCardId;
    },
    async gainAction(effect, match, acc) {
      acc.playerActions = match.playerActions + effect.count;
      match.playerActions = acc.playerActions;

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainAction',
        count: effect.count,
        playerSourceId: effect.sourcePlayerId,
      }));
      return;
    },
    async gainBuy(effect, match, acc) {
      acc.playerBuys = match.playerBuys + effect.count;
      match.playerBuys = acc.playerBuys;
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainBuy',
        count: effect.count,
        playerSourceId: effect.sourcePlayerId,
      }));
      return;
    },
    async gainCard(effect, match, acc) {
      effect.to.location ??= 'playerDiscards';

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainCard',
        cardId: effect.cardId,
        playerSourceId: effect.playerId,
      }));

      return moveCard(
        new MoveCardEffect({
          to: effect.to,
          sourcePlayerId: effect.sourcePlayerId,
          sourceCardId: effect.sourceCardId,
          playerId: effect.playerId,
          cardId: effect.cardId,
        }),
        match,
        acc,
      );
    },
    async gainTreasure(effect, match, acc) {
      acc.playerTreasure = match.playerTreasure + effect.count;
      match.playerTreasure = acc.playerTreasure;
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainTreasure',
        count: effect.count,
        playerSourceId: effect.sourcePlayerId,
      }));
      return null;
    },
    async moveCard(effect, match, acc) {
      return await moveCard(effect, match, acc);
    },
    async playCard(effect, match, acc) {
      const { playerId, sourceCardId, sourcePlayerId, cardId } = effect;

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'playCard',
        cardId: effect.cardId,
        playerSourceId: effect.sourcePlayerId,
      }));

      await moveCard(
        new MoveCardEffect({
          cardId,
          playerId,
          sourcePlayerId,
          sourceCardId,
          to: { location: 'playArea' },
        }),
        match,
        acc,
      );

      const trigger: ReactionTrigger = {
        eventType: 'cardPlayed',
        playerId,
        cardId,
      };

      console.debug(`finding reactions for 'cardPlayed' trigger`);

      let reactions = reactionManager.getReactions(
        match,
        trigger,
      );

      const card = cardLibrary.getCard(cardId);

      if (!isUndefined(card.targetScheme)) {
        const targetScheme = card.targetScheme ?? 'ALL_OTHER';
        console.debug(`card's target scheme ${targetScheme}`);
        const potentialTargets = findOrderedEffectTargets(
          sourcePlayerId,
          targetScheme,
          match,
        );
        console.debug(
          `potential card targets ${
            potentialTargets.map((id) => match.players.find(player => player.id === id))
          }`,
        );
        reactions = reactions.filter((r) =>
          potentialTargets.includes(r.playerId)
        );
        console.debug(`found ${reactions.length} reactions`);
        reactions.sort((a, b) =>
          potentialTargets.findIndex((p) => p === a.playerId) -
          potentialTargets.findIndex((p) => p === b.playerId)
        );
      } else {
        console.debug(`card ${card} has no targetScheme`);
      }

      const reactionContext: any = {};
      if (reactions.length > 0) {
        for (const reaction of reactions) {
          console.log(`running reaction generator for ${reaction.id}`);
          const reactionGenerator = await reaction.generatorFn(
            match,
            cardLibrary,
            trigger,
            reaction,
          );
          const reactionResults = await cardEffectRunner.runGenerator(
            reactionGenerator,
            match,
            reaction.playerId,
            acc,
          );
          if (reaction.once) {
            console.debug(`reaction registered as a 'once', removing reaction`);
            reactionManager.unregisterTrigger(reaction.id);
          }
          reactionContext[reaction.playerId] = reactionResults;
        }
      }

      return await cardEffectRunner.runCardEffects(
        match,
        sourcePlayerId,
        cardId,
        acc,
        reactionContext,
      );
    },
    async revealCard(effect, _match) {
      console.debug(`revealing card ${cardLibrary.getCard(effect.cardId)}`);
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'revealCard',
        cardId: effect.cardId,
        playerSourceId: effect.playerId,
      }));

      return null;
    },
    async selectCard(effect, match) {
      effect.count ??= 1;

      let selectableCardIds: number[] = [];
      const playerId = effect.playerId;

      if (effect.restrict === 'SELF') { // the card that triggered the effect action
        if (effect.sourceCardId) {
          console.debug(
            `setting selection to effect's source card ${
              cardLibrary.getCard(effect.sourceCardId)
            }`,
          );
          selectableCardIds = [effect.sourceCardId];
        } else {
          throw new Error(
            `effect restriction set to 'SELF' but no sourceCardId was found.`,
          );
        }
      } else if (Array.isArray(effect.restrict)) { // should be a list of card IDs
        console.debug(
          `setting selection to list of cards ${
            effect.restrict.map((id) => cardLibrary.getCard(id))
          }`,
        );
        return effect.restrict;
      } else if (effect.restrict.from) {
        if (effect.restrict.from.location === 'playerDecks') {
          console.warn(
            'will not be able to select from deck, not sending it to client, nor able to show them to them right now',
          );
          return [];
        }
        selectableCardIds = findCards(
          match,
          effect.restrict,
          cardLibrary,
          playerId,
        );
        console.debug(
          `found selectable cards ${
            selectableCardIds.map((id) => cardLibrary.getCard(id))
          }`,
        );
      }

      if (selectableCardIds?.length === 0) {
        console.debug(
          `found no cards within restricted set ${effect.restrict}`,
        );
        return [];
      }

      // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
      // because the player would be forced to select hem all anyway
      if (
        (typeof effect.count === 'number') || (effect.count.kind === 'exact')
      ) {
        let count: number = 0;
        if ((typeof effect.count === 'number')) {
          count = effect.count;
        } else if (effect.count.kind === 'exact') {
          count = effect.count.count;
        }
        console.debug(
          'selection count is an exact count',
          count,
          'checking if user has that many cards',
        );

        if (selectableCardIds.length <= count) {
          console.debug(
            'user does not have enough, or has exactly the amount of cards to select from, selecting all automatically',
          );
          return selectableCardIds;
        }
      }

      return new Promise((resolve, reject) => {
        try {
          const socket = socketMap.get(playerId);
          const currentPlayer = match.players[match.currentPlayerTurnIndex];
          
          const socketListener = (selectedCards: number[]) => {
            console.debug(
              `player selected ${
                selectedCards.map((id) => cardLibrary.getCard(id))
              }`,
            );
            socket?.off('selectCardResponse', socketListener);
            resolve(selectedCards);
            
            // if player selecting isn't the current player, let everyone else know we're done waiting
            if (currentPlayer.id !== playerId) {
              socketMap.forEach(s => s !== socket && s.emit('doneWaitingForPlayer', playerId));
            }
          };
          
          socket?.on('selectCardResponse', socketListener);
          socket?.emit('selectCard', { ...effect, selectableCardIds });
          
          if (currentPlayer.id !== playerId) {
            socketMap.forEach(s => s !== socket && s.emit('waitingForPlayer', playerId));
          }
        } catch (e) {
          reject(
            new Error(`could not find player socket in game state... ${e}`),
          );
        }
      });
    },
    async shuffleDeck(effect, match, acc) {
      return await shuffleDeck(effect.playerId, match, acc);
    },
    async trashCard(effect, match, acc) {
      const cardId = effect.cardId;
      const { sourceStore } = findSourceByCardId(cardId, match, cardLibrary);

      if (sourceStore === match.trash) {
        console.debug(`Card is already in trash`);
        return;
      }

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'trashCard',
        cardId: effect.cardId,
        playerSourceId: effect.playerId!,
      }));

      return moveCard(
        new MoveCardEffect({
          to: { location: 'trash' },
          sourcePlayerId: effect.sourcePlayerId,
          sourceCardId: effect.sourceCardId,
          playerId: effect.playerId,
          cardId: effect.cardId,
        }),
        match,
        acc,
      );
    },
    async userPrompt(effect, match) {
      console.log('effectHandler userPrompt', effect);

      return new Promise((resolve, reject) => {
        try {
          const socket = socketMap.get(effect.playerId);
          const currentPlayer = match.players[match.currentPlayerTurnIndex];
          
          const socketListener = (result: unknown) => {
            console.debug(`player responded with ${result}`);
            socket?.off('userPromptResponse', socketListener);
            resolve(result);
            if (currentPlayer.id !== effect.playerId) {
              socketMap.forEach(s => s !== socket && s.emit('doneWaitingForPlayer', effect.playerId));
            }
          };
          
          socket?.on('userPromptResponse', socketListener);
          socket?.emit('userPrompt', { ...effect });
          
          if (currentPlayer.id !== effect.playerId) {
            socketMap.forEach(s => s !== socket && s.emit('waitingForPlayer', effect.playerId));
          }
        } catch (e) {
          reject(
            new Error(`could not find player socket in game state... ${e}`),
          );
        }
      });
    },
  };
};
