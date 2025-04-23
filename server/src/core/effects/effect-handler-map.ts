import { AppSocket, } from '../../types.ts';
import { MatchStats, PlayerId } from 'shared/shared-types.ts';
import { findSourceByCardId } from '../../utils/find-source-by-card-id.ts';
import { findSpecLocationBySource } from '../../utils/find-spec-location-by-source.ts';
import { findSourceByLocationSpec } from '../../utils/find-source-by-location-spec.ts';
import { castArray, isUndefined, toNumber } from 'es-toolkit/compat';
import { MoveCardEffect } from './effect-types/move-card.ts';
import { CardLibrary } from '../card-library.ts';
import { LogManager } from '../log-manager.ts';
import { EffectsPipeline } from './effects-pipeline.ts';

type CreateEffectHandlerMapArgs = {
  socketMap: Map<PlayerId, AppSocket>,
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
    /*switch (oldLoc) {
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
    
    unregisterIds?.forEach((id) => reactionManager.unregisterTrigger(id));*/
    
    newStore.splice(
      isNaN(toNumber(effect.to.index)) ? newStore.length : effect.to.index!,
      0,
      effect.cardId,
    );
    
    // when a card moves to a new location, check if we need to register any triggers for the card
    // todo: account for moves to non-player locations i.e., deck, trash, discard, etc.
    // todo: this can also remove triggers, not just add
    /*let triggerTemplates: ReactionTemplate[] | void = undefined;
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
    
    triggerTemplates?.forEach((triggerTemplate) =>
      reactionManager.registerReactionTemplate(triggerTemplate)
    );*/
  };
  
  
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
