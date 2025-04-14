import { EffectGeneratorBlueprint, EffectGeneratorFactory, EffectGeneratorFn, ReactionTrigger, } from '../../types.ts';
import { DiscardCardEffect } from './effect-types/discard-card.ts';
import { DrawCardEffect } from './effect-types/draw-card.ts';
import { GainActionEffect } from './effect-types/gain-action.ts';
import { GainBuyEffect } from './effect-types/gain-buy.ts';
import { GainCardEffect } from './effect-types/gain-card.ts';
import { GainTreasureEffect } from './effect-types/gain-treasure.ts';
import { CardPlayedEffect } from './effect-types/card-played.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { MoveCardEffect } from './effect-types/move-card.ts';
import { TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { EndTurnEffect } from './effect-types/end-turn.ts';
import { NewTurnEffect } from './effect-types/new-turn.ts';

export const createEffectGeneratorMap: EffectGeneratorFactory = (
  { reactionManager, logManager },
) => {
  const map: Record<string, EffectGeneratorFn> = {};
  
  map.checkForPlayerActions = function* ({ match, cardLibrary, triggerPlayerId, triggerCardId }) {
    const turnPhase = TurnPhaseOrderValues[match.turnPhaseIndex];
    const player = match.players[match.currentPlayerTurnIndex];
    
    console.log(`[CHECK PLAYER ACTIONS EFFECT] checking remaining plays/actions for ${player} in turn phase ${turnPhase}`);
    
    switch (turnPhase) {
      case 'action': {
        const numActionCards = match.playerHands[player.id].filter((c) =>
          cardLibrary.getCard(c).type.includes('ACTION')
        ).length;
        
        if (numActionCards <= 0 || match.playerActions <= 0) {
          console.log(`[CHECK PLAYER ACTIONS EFFECT] player has 0 actions or action cards, skipping to next phase`);
          yield* map.nextPhase({ match, cardLibrary, triggerPlayerId, triggerCardId });
        }
        
        break;
      }
      
      case 'buy': {
        const treasureCards = match.playerHands[player.id].filter((c) =>
          cardLibrary.getCard(c).type.includes('TREASURE')
        ).length;
        
        if (
          (treasureCards <= 0 && match.playerTreasure <= 0) ||
          match.playerBuys <= 0
        ) {
          console.log(`[CHECK PLAYER ACTIONS EFFECT] player has 0 buys or no treasures, skipping to next phase`);
          yield* map.nextPhase({ match, cardLibrary, triggerPlayerId, triggerCardId });
        }
        break;
      }
    }
  };
  
  
  map.nextPhase = function* (args) {
    const { match, cardLibrary, triggerPlayerId, triggerCardId } = args;
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
    }
    
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    const player = match.players[match.currentPlayerTurnIndex];
    
    console.log(`[NEXT PHASE EFFECT] entering phase: ${newPhase}`);
    
    switch (newPhase) {
      case 'action': {
        match.playerActions = 1;
        match.playerBuys = 1;
        match.playerTreasure = 0;
        match.currentPlayerTurnIndex++;
        
        if (match.currentPlayerTurnIndex >= match.players.length) {
          match.currentPlayerTurnIndex = 0;
          match.turnNumber++;
          
          console.log(`[NEXT PHASE EFFECT] new round: ${match.turnNumber}`);
          
          logManager.rootLog({
            type: 'newTurn',
            turn: match.turnNumber,
          });
        }
        
        logManager.rootLog({
          type: 'newPlayerTurn',
          turn: match.turnNumber,
          playerId: match.players[match.currentPlayerTurnIndex].id
        });
        
        const trigger: ReactionTrigger = {
          eventType: 'startTurn',
          playerId: match.players[match.currentPlayerTurnIndex].id
        };
        
        const reactionContext = {};
        yield* reactionManager.runTrigger({ trigger, reactionContext });
        
        break;
      }
      case 'buy':
        // no explicit behavior
        break;
      case 'cleanup': {
        const cardsToDiscard = match.playArea.concat(match.playerHands[player.id]);
        
        for (const cardId of cardsToDiscard) {
          console.log(`[NEXT PHASE EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
          
          yield new DiscardCardEffect({
            cardId,
            playerId: player.id,
            sourcePlayerId: triggerPlayerId,
            isRootLog: true
          });
        }
        
        for (let i = 0; i < 5; i++) {
          console.log(`[NEXT PHASE EFFECT] drawing card...`);
          
          yield new DrawCardEffect({
            playerId: player.id,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            isRootLog: true
          });
        }
        
        yield new EndTurnEffect();
        
        yield* map.nextPhase({ match, cardLibrary, triggerCardId, triggerPlayerId });
      }
    }
    
    yield* map.checkForPlayerActions({ match, cardLibrary, triggerPlayerId, triggerCardId });
  };
  
  
  map.playCard = function* (
    { match, cardLibrary, triggerPlayerId, triggerCardId, isRootLog },
    { actionCost, moveCard, playCard } = { actionCost: -1, playCard: true, moveCard: true }
  ) {
    if (!triggerCardId) {
      throw new Error('playCard requires a card ID');
    }
    
    const card = cardLibrary.getCard(triggerCardId);
    
    if (moveCard) {
      console.log(`[PLAY CARD EFFECT] moving card to play area...`);
      
      yield new MoveCardEffect({
        cardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        to: { location: 'playArea' }
      });
    }
    else {
      console.log(`[PLAY CARD EFFECT] not physically moving card`);
    }
    
    if (actionCost !== 0) {
      if (cardLibrary.getCard(triggerCardId).type.includes('ACTION')) {
        yield new GainActionEffect({
          count: actionCost ?? -1,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          logEffect: false,
        });
      }
    }
    
    if (playCard) {
      console.log(`[PLAY CARD EFFECT] updating card played stats...`);
      
      yield new CardPlayedEffect({
        cardId: triggerCardId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        playerId: triggerPlayerId,
        isRootLog
      });
    }
    else {
      console.log(`[PLAY CARD EFFECT] card played doesn't count towards stats`);
    }
    
    const trigger: ReactionTrigger = {
      eventType: 'cardPlayed',
      playerId: triggerPlayerId,
      cardId: triggerCardId,
    };
    
    const reactionContext = {};
    yield* reactionManager.runTrigger({ trigger, reactionContext });
    
    const generatorFn = map[card.cardKey];
    if (generatorFn) {
      yield* generatorFn({
        match,
        cardLibrary,
        triggerPlayerId,
        triggerCardId,
        reactionContext
      });
    }
  };
  
  
  map.discardCard = function* ({ triggerPlayerId, triggerCardId }) {
    if (!triggerCardId) {
      throw new Error('discardCard requires a card ID');
    }
    
    yield new DiscardCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
    });
  };
  
  
  map.buyCard = function* (
    { match, cardLibrary, triggerPlayerId, triggerCardId, isRootLog },
  ) {
    if (!triggerCardId) {
      throw new Error('buyCard requires a card ID');
    }
    
    const cardCost = getEffectiveCardCost(
      triggerPlayerId,
      triggerCardId,
      match,
      cardLibrary,
    );
    
    if (cardCost !== 0) {
      yield new GainTreasureEffect({
        count: -cardCost,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        logEffect: false
      });
    }
    
    yield new GainBuyEffect({
      count: -1,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      logEffect: false,
    });
    
    yield new GainCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      to: { location: 'playerDiscards' },
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      isRootLog
    });
  };
  
  
  map.drawCard = function* ({ triggerPlayerId, triggerCardId }) {
    yield new DrawCardEffect({
      playerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
    });
  };
  
  
  map.gainCard = function* ({ triggerPlayerId, triggerCardId }) {
    if (!triggerCardId) {
      throw new Error('gainCard requires a card ID');
    }
    
    yield new GainCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      to: { location: 'playerDiscards' },
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
    });
  };
  
  return map;
};

export const effectGeneratorBlueprintMap: Record<
  string,
  EffectGeneratorBlueprint
> = {};
