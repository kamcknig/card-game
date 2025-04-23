import { AppSocket, EffectHandlerMap, ReactionTemplate, } from '../../types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { ReactionManager } from '../reactions/reaction-manager.ts';
import { MatchStats, PlayerId } from 'shared/shared-types.ts';
import { findSourceByCardId } from '../../utils/find-source-by-card-id.ts';
import { findSpecLocationBySource } from '../../utils/find-spec-location-by-source.ts';
import { findSourceByLocationSpec } from '../../utils/find-source-by-location-spec.ts';
import { castArray, isNumber, isUndefined, toNumber } from 'es-toolkit/compat';
import { MoveCardEffect } from './effect-types/move-card.ts';
import { UserPromptEffect } from './effect-types/user-prompt.ts';
import { CardLibrary } from '../card-library.ts';
import { cardLifecycleMap } from '../card-lifecycle-map.ts';
import { LogManager } from '../log-manager.ts';
import { EffectsPipeline } from './effects-pipeline.ts';

type CreateEffectHandlerMapArgs = {
  socketMap: Map<PlayerId, AppSocket>,
  reactionManager: ReactionManager,
  cardLibrary: CardLibrary,
  logManager: LogManager,
  getEffectsPipeline: () => EffectsPipeline,
  matchStats: MatchStats
}

/**
 * Returns an object whose properties are functions. The names are a union of Effect types
 * and whose values are functions to implement that Effect within the system
 */
export const createEffectHandlerMap = (args: CreateEffectHandlerMapArgs): EffectHandlerMap => {
  const {
    socketMap,
    cardLibrary,
    logManager,
    reactionManager,
  } = args;
  
  const map: EffectHandlerMap = {} as EffectHandlerMap;
  
  map.moveCard = function (effect: MoveCardEffect, match) {
    const card = cardLibrary.getCard(effect.cardId);
    
    // find the current location of the card
    const {
      sourceStore: oldStore,
      index,
      storeKey: oldStoreKey,
    } = findSourceByCardId(effect.cardId, match, cardLibrary);
    
    if (!oldStoreKey || isUndefined(index)) {
      console.log('[MOVE CARD EFFECT HANDLER] could not find card in a store to move it',);
      return;
    }
    
    console.log(`[MOVE CARD EFFECT HANDLER] moving card ${card} from ${oldStoreKey} to ${effect.to.location}`,);
    
    effect.to.location = castArray(effect.to.location);
    
    // find the new location of the card
    const newStore = findSourceByLocationSpec({
      spec: effect.to,
      playerId: effect.toPlayerId,
    }, match);
    
    if (!newStore) {
      console.log('[MOVE CARD EFFECT HANDLER] could not find new store to move card to',);
      return;
    }
    
    if (oldStore === newStore) {
      console.log(`[MOVE CARD EFFECT HANDLER] old store is the same as new store, not moving`);
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
        })?.unregisterTriggeredEvents;
        break;
      case 'playArea':
        unregisterIds = cardLifecycleMap[card.cardKey]?.['onLeavePlay']?.({
          playerId: effect.toPlayerId!,
          cardId: effect.cardId,
        })?.unregisterTriggeredEvents;
        break;
    }
    
    unregisterIds?.forEach((id) => reactionManager.unregisterTrigger(id));
    
    newStore.splice(
      isNaN(toNumber(effect.to.index)) ? newStore.length : effect.to.index!,
      0,
      effect.cardId,
    );
    
    // when a card moves to a new location, check if we need to register any triggers for the card
    // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
    // todo: this can also remove triggers, not just add
    let triggerTemplates: ReactionTemplate[] | void = undefined;
    if (effect.toPlayerId) {
      switch (effect.to.location[0]) {
        case 'playerHands':
          triggerTemplates = cardLifecycleMap[card.cardKey]
            ?.['onEnterHand']?.({
            playerId: effect.toPlayerId,
            cardId: effect.cardId,
          })?.registerTriggeredEvents;
          break;
      }
    }
    /*else {
     switch (effect.to.location[0]) {
     case 'playArea':
     triggerTemplates = cardLifecycleMap[card.cardKey]
     ?.['onEnterPlay']?.({
     playerId: effect.sourcePlayerId!,
     cardId: effect.cardId,
     })?.registerTriggeredEvents;
     break;
     }
     }*/
    
    triggerTemplates?.forEach((triggerTemplate) =>
      reactionManager.registerReactionTemplate(triggerTemplate)
    );
  };
  
  
  map.revealCard = function (effect, match) {
    console.log(`[REVEAL CARD EFFECT HANDLER] revealing card ${cardLibrary.getCard(effect.cardId)}`);
    
    if (effect.moveToRevealed) {
      map.moveCard(new MoveCardEffect({
        cardId: effect.cardId,
        to: { location: 'revealed' }
      }), match);
    }
    
    if (effect.log) {
      logManager.addLogEntry({
        root: effect.isRootLog,
        type: 'revealCard',
        cardId: effect.cardId,
        playerId: effect.playerId,
      });
    }
  }
  
  
  
  map.selectCard = function (effect, match) {
    effect.count ??= 1;
    
    let selectableCardIds: number[] = [];
    const playerId = effect.playerId;
    
    if (Array.isArray(effect.restrict)) {
      console.log(`[SELECT CARD EFFECT HANDLER] setting selection to list of cards${effect.restrict.map((id: number) => cardLibrary.getCard(id))}`);
      selectableCardIds = effect.restrict;
    }
    else if (effect.restrict.from) {
      if (effect.restrict.from.location === 'playerDecks') {
        console.warn('[SELECT CARD EFFECT HANDLER] will not be able to select from deck, not sending it to client, nor able to show them to them right now');
        return [];
      }
      
      selectableCardIds = findCards(
        match,
        effect.restrict,
        cardLibrary,
        playerId,
      );
      
      console.log(`[SELECT CARD EFFECT HANDLER] found ${selectableCardIds.length} selectable cards`);
    }
    
    if (selectableCardIds?.length === 0) {
      console.log(`[SELECT CARD EFFECT HANDLER] found no cards within restricted set ${effect.restrict}`);
      return [];
    }
    
    // if there aren't enough cards, depending on the selection type, we might simply implicitly select cards
    // because the player would be forced to select hem all anyway
    if (isNumber(effect.count) && !effect.optional) {
      const count = effect.count;
      
      console.log(`[SELECT CARD EFFECT HANDLER] selection count is an exact count ${count} checking if user has that many cards`);
      
      if (selectableCardIds.length <= count) {
        console.log('[SELECT CARD EFFECT HANDLER] user does not have enough, or has exactly the amount of cards to select from, selecting all automatically');
        return selectableCardIds;
      }
    }
    
    const socket = socketMap.get(playerId);
    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    const signalId = `selectCard:${playerId}:${Date.now()}`;
    
    // if the player being prompted is not the current player,
    // let the other players know that we are waiting.
    if (currentPlayer.id !== effect.playerId) {
      socket?.on('userInputReceived', (signal) => {
        if (signal !== signalId) return;
        socketMap.forEach((s) =>
          s !== socket && s.emit('doneWaitingForPlayer', effect.playerId));
      });
      
      socketMap.forEach((s) => s !== socket && s.emit('waitingForPlayer', effect.playerId));
    }
    
    socket?.emit('selectCard', signalId, { ...effect, selectableCardIds });
    
    return {
      pause: true,
      signalId
    }
  }
  
  
  map.userPrompt = function (effect: UserPromptEffect, match) {
    console.log('[USER PROMPT EFFECT HANDLER] effectHandler userPrompt', effect);
    
    const socket = socketMap.get(effect.playerId);
    const currentPlayer = match.players[match.currentPlayerTurnIndex];
    const signalId = `userPrompt:${effect.playerId}:${Date.now()}`;
    socket?.emit('userPrompt', signalId, effect);
    
    // if the player being prompted is not the current player,
    // let the other players know that we are waiting.
    if (currentPlayer.id !== effect.playerId) {
      socket?.on('userInputReceived', (signal) => {
        if (signal !== signalId) return;
        socketMap.forEach((s) =>
          s !== socket && s.emit('doneWaitingForPlayer', effect.playerId)
        );
      });
      
      socketMap.forEach((s) =>
        s !== socket && s.emit('waitingForPlayer', effect.playerId)
      );
    }
    
    return {
      pause: true,
      signalId,
    };
  }
  
  
  map.invokeCardEffects = function (effect) {
    const { context, cardKey } = effect;
/*    const generatorFn = cardEffectFunctionMap[cardKey];
    
    if (!generatorFn) {
      throw new Error(`no generator found for '${cardKey}'`);
    }
    
    const generator = generatorFn(context);
    
    return { runGenerator: generator };*/
  }
  
  
  map.invokeGameActionGenerator = function (effect) {
    /*const { context, gameAction, overrides } = effect;
    const generatorFn = effectGeneratorMap[gameAction];
    
    if (!generatorFn) {
      throw new Error(`no generator found for '${gameAction}'`);
    }
    
    const generator = generatorFn(context, overrides);
    
    return { runGenerator: generator };*/
  }
  
  return map;
};
