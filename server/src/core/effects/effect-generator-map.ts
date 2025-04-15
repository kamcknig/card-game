import {
  CardEffectGeneratorMapFactory, CardEffectGeneratorFn,
  GameActionEffectGeneratorFn,
  GameActionEffectGeneratorMapFactory,
  GameActions,
  GameActionTypes,
  ReactionTrigger,
} from '../../types.ts';
import { DiscardCardEffect } from './effect-types/discard-card.ts';
import { DrawCardEffect } from './effect-types/draw-card.ts';
import { GainActionEffect } from './effect-types/gain-action.ts';
import { GainBuyEffect } from './effect-types/gain-buy.ts';
import { GainCardEffect } from './effect-types/gain-card.ts';
import { GainTreasureEffect } from './effect-types/gain-treasure.ts';
import { CardPlayedEffect } from './effect-types/card-played.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { MoveCardEffect } from './effect-types/move-card.ts';
import { CardKey, TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { EndTurnEffect } from './effect-types/end-turn.ts';

export const gameActionEffectGeneratorFactory: GameActionEffectGeneratorMapFactory = ({
  reactionManager,
  logManager,
  match,
  cardLibrary
}) => {
  const map: {
    [K in GameActionTypes]: GameActionEffectGeneratorFn<GameActions[K]>;
  } = {} as const;
  
  map.checkForPlayerActions = function* () {
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
          yield* map.nextPhase(undefined);
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
          yield* map.nextPhase(undefined);
        }
        break;
      }
    }
  };
  
  
  map.nextPhase = function* () {
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
          });
        }
        
        for (let i = 0; i < 5; i++) {
          console.log(`[NEXT PHASE EFFECT] drawing card...`);
          
          yield new DrawCardEffect({
            playerId: player.id,
          });
        }
        
        yield new EndTurnEffect();
        
        yield* map.nextPhase(undefined);
      }
    }
    
    yield* map.checkForPlayerActions(undefined);
  };
  
  
  map.playCard = function* (
    { cardId, playerId },
    { actionCost, moveCard, playCard } = { actionCost: -1, playCard: true, moveCard: true }
  ) {
    const card = cardLibrary.getCard(cardId);
    
    if (moveCard) {
      console.log(`[PLAY CARD EFFECT] moving card to play area...`);
      
      yield new MoveCardEffect({
        cardId,
        to: { location: 'playArea' }
      });
    }
    else {
      console.log(`[PLAY CARD EFFECT] not physically moving card`);
    }
    
    if (actionCost !== 0) {
      if (cardLibrary.getCard(cardId).type.includes('ACTION')) {
        yield new GainActionEffect({
          count: actionCost ?? -1,
          /*logEffect: false,*/
        });
      }
    }
    
    if (playCard) {
      console.log(`[PLAY CARD EFFECT] updating card played stats...`);
      
      yield new CardPlayedEffect({
        cardId: cardId,
        playerId: playerId,
        /*isRootLog*/
      });
    }
    else {
      console.log(`[PLAY CARD EFFECT] card played doesn't count towards stats`);
    }
    
    const trigger: ReactionTrigger = {
      eventType: 'cardPlayed',
      playerId: playerId,
      cardId: cardId,
    };
    
    const reactionContext = {};
    yield* reactionManager.runTrigger({ trigger, reactionContext });
    
    const generatorFn = cardEffectGeneratorMap[card.cardKey];
    if (generatorFn) {
      yield* generatorFn({
        playerId,
        cardId: card.id,
        reactionContext
      });
    }
  };
  
  
  map.buyCard = function* (
    { cardId, playerId },
  ) {
    const cardCost = getEffectiveCardCost(
      playerId,
      cardId,
      match,
      cardLibrary,
    );
    
    if (cardCost !== 0) {
      yield new GainTreasureEffect({
        count: -cardCost,
        /*logEffect: false*/
      });
    }
    
    yield new GainBuyEffect({
      count: -1,
      /*logEffect: false,*/
    });
    
    yield new GainCardEffect({
      playerId: playerId,
      cardId: cardId,
      to: { location: 'playerDiscards' }
      /*isRootLog*/
    });
  };
  
  
  map.drawCard = function* ({ playerId }) {
    yield new DrawCardEffect({
      playerId,
    });
  };
  
  return map;
};

export const cardEffectGeneratorMap: Record<CardKey, CardEffectGeneratorFn> = {};

export const cardEffectGeneratorMapFactory: CardEffectGeneratorMapFactory = {};
