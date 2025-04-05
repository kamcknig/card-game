import { AppSocket, EffectHandlerMap, IEffectRunner, Reaction, ReactionTemplate, ReactionTrigger, } from './types.ts';
import { fisherYatesShuffle } from './utils/fisher-yates-shuffler.ts';
import { findCards } from './utils/find-cards.ts';
import { ReactionManager } from './reaction-manager.ts';
import { Match, MatchUpdate, PlayerID } from 'shared/shared-types.ts';
import { cardLifecycleMap } from './effect-generator-map.ts';
import { findOrderedEffectTargets } from './utils/find-ordered-effect-targets.ts';
import { findSourceByCardId } from './utils/find-source-by-card-id.ts';
import { findSpecLocationBySource } from './utils/find-spec-location-by-source.ts';
import { findSourceByLocationSpec } from './utils/find-source-by-location-spec.ts';
import { castArray, isNumber, isUndefined, toNumber } from 'es-toolkit/compat';
import { MoveCardEffect } from './effects/move-card.ts';
import { cardDataOverrides, getCardOverrides } from './card-data-overrides.ts';
import { CardInteractivityController } from './card-interactivity-controller.ts';
import { getOrderStartingFrom } from './utils/get-order-starting-from.ts';
import { UserPromptEffect } from './effects/user-prompt.ts';
import { CardLibrary } from './card-library.ts';

/**
 * Returns an object whose properties are functions. The names are a union of Effect types
 * and whose values are functions to implement that Effect within the system
 */
export const createEffectHandlerMap = (
  socketMap: Map<PlayerID, AppSocket>,
  reactionManager: ReactionManager,
  cardEffectRunner: IEffectRunner,
  interactivityController: CardInteractivityController,
  cardLibrary: CardLibrary,
): EffectHandlerMap => {
  function moveCard(
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
      console.log('[MOVE CARD EFFECT HANDLER] could not find card in a store to move it');
      return;
    }

    console.log(`[MOVE CARD EFFECT HANDLER] moving card ${card} from ${oldStoreKey} to ${effect.to.location}`);

    effect.to.location = castArray(effect.to.location);

    const newStore = findSourceByLocationSpec({ spec: effect.to, playerId: effect.toPlayerId }, match);

    if (!newStore) {
      console.log('[MOVE CARD EFFECT HANDLER] could not find new store to move card to');
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
        unregisterIds = cardLifecycleMap[card.cardKey]?.['onLeaveHand']?.({
          playerId: effect.toPlayerId!,
          cardId: effect.cardId,
        })?.unregisterTriggers;
        break;
      case 'playArea':
        unregisterIds = cardLifecycleMap[card.cardKey]?.['onLeavePlay']?.({
          playerId: effect.toPlayerId!,
          cardId: effect.cardId,
        })?.unregisterTriggers;
        break;
    }

    unregisterIds?.forEach((id) => reactionManager.unregisterTrigger(id));
    
    newStore.splice(isNaN(toNumber(effect.to.index)) ? newStore.length : effect.to.index!, 0, effect.cardId);
    // newStore.push(effect.cardId);

    // when a card moves to a new location, check if we need to register any triggers for the card
    // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
    // todo: this can also remove triggers, not just add
    if (effect.toPlayerId) {
      let triggerTemplates: ReactionTemplate[] | void = undefined;
      switch (effect.to.location[0]) {
        case 'playerHands':
          triggerTemplates = cardLifecycleMap[card.cardKey]?.['onEnterHand']?.({
            playerId: effect.toPlayerId,
            cardId: effect.cardId,
          })?.registerTriggers;
          break;
        case 'playArea':
          triggerTemplates = cardLifecycleMap[card.cardKey]?.['onEnterPlay']?.({
            playerId: effect.toPlayerId,
            cardId: effect.cardId,
          })?.registerTriggers;
      }

      triggerTemplates?.forEach((triggerTemplate) =>
        reactionManager.registerReactionTemplate(triggerTemplate)
      );
    }

    // update the accumulator with the card's old location
    if (
      ['playerHands', 'playerDecks', 'playerDiscards'].includes(oldStoreKey)
    ) {
      if (effect.toPlayerId) {
        switch (oldStoreKey) {
          case 'playerHands':
            acc.playerHands = {
              ...acc.playerHands,
              [effect.toPlayerId]: oldStore,
            };
            break;
          case 'playerDiscards':
            acc.playerDiscards = {
              ...acc.playerDiscards,
              [effect.toPlayerId]: oldStore,
            };
            break;
          case 'playerDecks':
            acc.playerDecks = {
              ...acc.playerDecks,
              [effect.toPlayerId]: oldStore,
            };
            break;
        }
      }
    } else {
      acc[oldStoreKey] = oldStore;
    }

    // update the accumulator with the cards new location
    if (
      effect.to.location.some((l) =>
        ['playerHands', 'playerDecks', 'playerDiscards'].includes(l)
      )
    ) {
      if (effect.toPlayerId) {
        switch (effect.to.location[0]) {
          case 'playerHands':
            acc.playerHands = {
              ...acc.playerHands,
              [effect.toPlayerId]: newStore,
            };
            break;
          case 'playerDiscards':
            acc.playerDiscards = {
              ...acc.playerDiscards,
              [effect.toPlayerId]: newStore,
            };
            break;
          case 'playerDecks':
            acc.playerDecks = {
              ...acc.playerDecks,
              [effect.toPlayerId]: newStore,
            };
            break;
        }
      }
    } else {
      acc[effect.to.location[0]] = newStore as unknown as any;
    }

    // because where a card is on the board, we immediately send an update with the new cards location to
    // clients to visually update them. normally we'd wait.
    // TODO: can this go in the effects pipeline? Maybe checking if the effect was a move effect and if
    // so send the interim update there? Having it here special-cases it and that's rarely good
    socketMap.forEach(s => s.emit('matchUpdated', acc));
  }
  
  function userPrompt(effect: UserPromptEffect, match: Match) {
    console.log('[USER PROMPT EFFECT HANDLER] effectHandler userPrompt', effect);
    
    return new Promise((resolve, reject) => {
      try {
        const socket = socketMap.get(effect.playerId);
        const currentPlayer = match.players[match.currentPlayerTurnIndex];
        
        const socketListener = (result: unknown) => {
          console.log(`[USER PROMPT EFFECT HANDLER]player responded with ${result}`);
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
  }

  function shuffleDeck(playerId: number, match: Match, acc: MatchUpdate) {
    console.log(`[SHUFFLE DECK EFFECT HANDLER] shuffling deck for ${match.players.find(player => player.id === playerId)}`);

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

    // because where a card is on the board, we immediately send an update with the new cards location to
    // clients to visually update them. normally we'd wait.
    // TODO: can this go in the effects pipeline? Maybe checking if the effect was a move effect and if
    // so send the interim update there? Having it here special-cases it and that's rarely good
    socketMap.forEach(s => s.emit('matchUpdated', acc));
  }

  return {
    discardCard(effect, match, acc) {
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
          toPlayerId: effect.playerId,
          to: { location: 'playerDiscards' },
        }),
        match,
        acc,
      );
    },
    drawCard(effect, match, acc) {
      let deck = match.playerDecks[effect.playerId];
      const discard = match.playerDiscards[effect.playerId];

      if (discard.length + deck.length === 0) {
        console.log('[DRAW CARD EFFECT HANDLER] not enough cards to draw in deck + hand');
        return;
      }

      // todo: here and other places, i'm manually shuffling the discard into the deck.
      // this might mess with reaction triggers as they are added when cards are moved
      // to different play areas via the moveCard effect handler. (there are some in
      // later sets that can be played from the deck for example and if those are handled
      // via reactions and triggers then their reactions wont' get registered properly
      if (deck.length === 0) {
        console.log(`[DRAW CARD EFFECT HANDLER] not enough cards in deck, shuffling`);
        shuffleDeck(effect.playerId, match, acc);
        deck = match.playerDecks[effect.playerId];
      }

      const drawnCardId = deck.slice(-1)?.[0];
      if (!drawnCardId) {
        console.log(`[DRAW CARD EFFECT HANDLER] no card drawn`);
        return;
      }

      console.log(`[DRAW CARD EFFECT HANDLER] card drawn ${cardLibrary.getCard(drawnCardId)}`);

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'draw',
        playerSourceId: effect.playerId,
        cardId: drawnCardId,
      }));

      moveCard(
        new MoveCardEffect({
          sourceCardId: effect.sourceCardId,
          sourcePlayerId: effect.sourcePlayerId,
          cardId: drawnCardId,
          toPlayerId: effect.playerId,
          to: { location: 'playerHands' },
        }),
        match,
        acc,
      );

      return drawnCardId;
    },
    gainAction(effect, match, acc) {
      acc.playerActions = match.playerActions + effect.count;
      match.playerActions = acc.playerActions;

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainAction',
        count: effect.count,
        playerSourceId: effect.sourcePlayerId,
      }));
      return;
    },
    gainBuy(effect, match, acc) {
      acc.playerBuys = match.playerBuys + effect.count;
      match.playerBuys = acc.playerBuys;
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainBuy',
        count: effect.count,
        playerSourceId: effect.sourcePlayerId,
      }));
      return;
    },
    gainCard(effect, match, acc) {
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
          toPlayerId: effect.playerId,
          cardId: effect.cardId,
        }),
        match,
        acc,
      );
    },
    gainTreasure(effect, match, acc) {
      acc.playerTreasure = match.playerTreasure + effect.count;
      match.playerTreasure = acc.playerTreasure;
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'gainTreasure',
        count: effect.count,
        playerSourceId: effect.sourcePlayerId,
      }));
      return null;
    },
    moveCard(effect, match, acc) {
      return moveCard(effect, match, acc);
    },
    async playCard(effect, match, acc) {
      const { playerId, sourceCardId, sourcePlayerId, cardId } = effect;

      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'playCard',
        cardId: effect.cardId,
        playerSourceId: effect.sourcePlayerId,
      }));

      moveCard(
        new MoveCardEffect({
          cardId,
          toPlayerId: playerId,
          sourcePlayerId,
          sourceCardId,
          to: { location: 'playArea' },
        }),
        match,
        acc,
      );
      
      match.cardsPlayed[sourcePlayerId] ??= [];
      match.cardsPlayed[sourcePlayerId].push(sourceCardId);
      
      const trigger: ReactionTrigger = {
        eventType: 'cardPlayed',
        playerId,
        cardId,
      };
      
      // get reactions the current player could react with. these are things like Merchant
      let reactions = reactionManager.getReactionsForPlayer(trigger, sourcePlayerId);
      for (const reaction of reactions) {
        const generator = await reaction.generatorFn({match, cardLibrary, trigger, reaction});
        
        await cardEffectRunner.runGenerator(
          generator,
          match,
          reaction.playerId,
          acc,
        );
        
        if (reaction.once) {
          console.log(`[PLAY CARD EFFECT HANDLER] reaction registered as a 'once', removing reaction`);
          reactionManager.unregisterTrigger(reaction.id);
        }
      }
      
      // now we get the order of players that could be affected by the play (including the current player),
      // then get reactions for them and run them
      const targetOrder = getOrderStartingFrom(match.players, match.currentPlayerTurnIndex).filter(player => player.id !== sourcePlayerId);
      console.log(`[PLAY CARD EFFECT HANDLER] player order for reaction targets ${targetOrder}`);
      
      const reactionContext: any = {};
      
      for (const targetPlayer of targetOrder) {
        reactions = reactionManager.getReactionsForPlayer(trigger, targetPlayer.id);
        console.log(`[PLAY CARD EFFECT HANDLER] found ${reactions.length} reactions for ${targetPlayer}`);
        
        if (reactions.length === 0) continue;
        
        const usedReactionMap = new Map<string, number>(); // key: cardKey, value: usage count
        
        while (true) {
          const actionButtons: { action: number; label: string }[] = [];
          const actionMap = new Map<number, Reaction>();
          const grouped = new Map<string, { count: number; reaction: Reaction }>();
          
          console.log(`[PLAY CARD EFFECT HANDLER] grouping reactions by card key`);
          
          // Group available reactions by cardKey
          for (const reaction of reactions) {
            const key = reaction.getSourceKey();
            if (!grouped.has(key)) {
              grouped.set(key, { count: 1, reaction });
            } else {
              grouped.get(key)!.count++;
            }
          }
          
          console.log(`[PLAY CARD EFFECT HANDLER] reactions grouped by card key ${grouped}`);
          
          let actionId = 1;
          
          for (const [cardKey, { count, reaction }] of grouped.entries()) {
            console.log(`[PLAY CARD EFFECT HANDLER] build action buttons and mapping for ${cardKey}`);
            
            const usedCount = usedReactionMap.get(cardKey) ?? 0;
            console.log(`[PLAY CARD EFFECT HANDLER] ${usedCount} already used for ${cardKey}`);
            
            const multipleUse = reaction.multipleUse ?? true;
            console.log(`[PLAY CARD EFFECT HANDLER] ${cardKey} can be used multiple? ${multipleUse}`);
            
            const canUse = multipleUse
              ? usedCount < count
              : usedCount === 0;
            
            console.log(`[PLAY CARD EFFECT HANDLER] ${cardKey} can be used? ${canUse}`);
            
            if (!canUse) continue;
            
            const remainingCount = count - usedCount;
            console.log(`[PLAY CARD EFFECT HANDLER] ${usedCount} remaining for ${cardKey}`);
            
            if (remainingCount <= 0) continue; // All copies used, skip
            
            const card = cardLibrary.getCard(reaction.getSourceId());
            const label = `${card.cardName} (${remainingCount})`;
            
            const action = { action: actionId, label }
            console.log(`[PLAY CARD EFFECT HANDLER] adding action ${action.action} with label '${action.label}'`);
            actionButtons.push(action);
            actionMap.set(actionId, reaction); // Any one reaction from that group
            actionId++;
          }
          
          if (actionButtons.length === 0) break; // out of while loop
          
          const cancelAction = ++actionId;
          
          actionButtons.unshift({action: cancelAction, label: 'Cancel'});
          
          console.log(`[PLAY CARD EFFECT HANDLER] adding cancel action ${cancelAction} with label 'Cancel'`);
          
          const result = (await userPrompt(
            new UserPromptEffect({
              playerId: targetPlayer.id,
              sourcePlayerId,
              actionButtons,
              prompt: 'Choose reaction?',
            }),
            match,
          )) as { action: number };
          
          if (result.action === cancelAction) {
            break; // out of the while loop
          }
          
          const selectedReaction = actionMap.get(result.action);
          if (!selectedReaction) throw new Error('[PLAY CARD EFFECT HANDLER] could not find reaction for selected action');
          
          const cardKey = selectedReaction.getSourceKey();
          usedReactionMap.set(cardKey, (usedReactionMap.get(cardKey) ?? 0) + 1);
          
          const reactionGenerator = await selectedReaction.generatorFn({
            match,
            cardLibrary,
            trigger,
            reaction: selectedReaction,
          });
          
          const reactionResults = await cardEffectRunner.runGenerator(
            reactionGenerator,
            match,
            selectedReaction.playerId,
            acc,
          );
          
          if (selectedReaction.once) {
            console.debug(`[PLAY CARD EFFECT HANDLER] reaction registered as a 'once', removing reaction`);
            reactionManager.unregisterTrigger(selectedReaction.id);
          }
          
          if (!isUndefined(reactionResults)) {
            reactionContext[selectedReaction.playerId] = reactionResults;
          }
          
          reactions = reactionManager.getReactions(trigger);
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
    revealCard(effect, _match) {
      console.debug(`[REVEAL CARD EFFECT HANDLER] revealing card ${cardLibrary.getCard(effect.cardId)}`);
      socketMap.forEach(s => s.emit('addLogEntry', {
        type: 'revealCard',
        cardId: effect.cardId,
        playerSourceId: effect.playerId,
      }));

      return null;
    },
    selectCard(effect, match) {
      effect.count ??= 1;

      let selectableCardIds: number[] = [];
      const playerId = effect.playerId;

      if (effect.restrict === 'SELF') { // the card that triggered the effect action
        if (effect.sourceCardId) {
          console.debug(
            `[SELECT CARD EFFECT HANDLER] setting selection to effect's source card ${
              cardLibrary.getCard(effect.sourceCardId)
            }`,
          );
          selectableCardIds = [effect.sourceCardId];
        } else {
          throw new Error(
            `[SELECT CARD EFFECT HANDLER] effect restriction set to 'SELF' but no sourceCardId was found.`,
          );
        }
      } else if (Array.isArray(effect.restrict)) { // should be a list of card IDs
        console.debug(
          `[SELECT CARD EFFECT HANDLER] setting selection to list of cards ${
            effect.restrict.map((id) => cardLibrary.getCard(id))
          }`,
        );
        return effect.restrict;
      } else if (effect.restrict.from) {
        if (effect.restrict.from.location === 'playerDecks') {
          console.warn(
            '[SELECT CARD EFFECT HANDLER] will not be able to select from deck, not sending it to client, nor able to show them to them right now',
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
          `[SELECT CARD EFFECT HANDLER] found selectable cards ${
            selectableCardIds.map((id) => cardLibrary.getCard(id))
          }`,
        );
      }

      if (selectableCardIds?.length === 0) {
        console.debug(
          `[SELECT CARD EFFECT HANDLER] found no cards within restricted set ${effect.restrict}`,
        );
        return [];
      }

      // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
      // because the player would be forced to select hem all anyway
      if (isNumber(effect.count)) {
        const count= effect.count;
        
        console.debug(`[SELECT CARD EFFECT HANDLER] selection count is an exact count ${count} checking if user has that many cards`);

        if (selectableCardIds.length <= count) {
          console.debug(
            '[SELECT CARD EFFECT HANDLER] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically',
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
              `[SELECT CARD EFFECT HANDLER] player selected ${
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
    shuffleDeck(effect, match, acc) {
      return shuffleDeck(effect.playerId, match, acc);
    },
    trashCard(effect, match, acc) {
      const cardId = effect.cardId;
      const { sourceStore } = findSourceByCardId(cardId, match, cardLibrary);

      if (sourceStore === match.trash) {
        console.debug(`[TRASH CARD EFFECT HANDLER] Card is already in trash`);
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
          toPlayerId: effect.playerId,
          cardId: effect.cardId,
        }),
        match,
        acc,
      );
    },
    async userPrompt(effect, match) {
      return await userPrompt(effect, match);
    },
    modifyCost(effect, match, _acc) {
      const targets = findOrderedEffectTargets(effect.sourcePlayerId, effect.appliesTo, match);
      
      cardDataOverrides.push({targets, overrideEffect: effect});
      
      const overrides = getCardOverrides(match, cardLibrary);
      
      for (const targetId of targets) {
        const playerOverrides = overrides?.[targetId];
        const socket = socketMap.get(targetId);
        socket?.emit('setCardDataOverrides', playerOverrides)
      }
      
      interactivityController.checkCardInteractivity(match);
    }
  };
};
