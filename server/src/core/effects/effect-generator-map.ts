import {
  CardEffectFunctionMap, CardEffectFunctionMapFactory,
  CardEffectGeneratorMapFactory,
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
import { TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { EndTurnEffect } from './effect-types/end-turn.ts';
import { NewTurnEffect } from './effect-types/new-turn.ts';

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
          
          console.log(`[NEXT PHASE EFFECT] new round: ${match.turnNumber} (${match.turnNumber + 1})`);
          
          yield new NewTurnEffect();
        }
        
        logManager.addLogEntry({
          root: true,
          type: 'newPlayerTurn',
          turn: match.turnNumber,
          playerId: match.players[match.currentPlayerTurnIndex].id
        });
        
        const trigger = new ReactionTrigger({
          eventType: 'startTurn',
          playerId: match.players[match.currentPlayerTurnIndex].id
        });
        
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
          const card = cardLibrary.getCard(cardId);
          
          // if the card is a duration card, and it was played this turn
          if (card.type.includes('DURATION')) {
            const playedCardsInfo = match.stats.playedCardsInfo?.[card.id];
            
            if (!playedCardsInfo) continue;
            const turnPlayed = playedCardsInfo.turnNumber;
            
            // if cleaning up for the player that played the duration card
            if (playedCardsInfo.playedPlayerId === player.id) {
              // and the turn is different, it's time to discard
              if (turnPlayed !== match.turnNumber) {
                yield new DiscardCardEffect({
                  cardId,
                  playerId: player.id,
                });
              }
              else {
                // if it's the same turn number,
                const playerTurnPlayedId = match.stats.playedCardsInfo[card.id].turnPlayerId;
                const playedTurnPlayerIndex = match.players.findIndex(p => p.id === playerTurnPlayedId);
                
                if (playedTurnPlayerIndex !== match.currentPlayerTurnIndex) {
                  yield new DiscardCardEffect({
                    cardId,
                    playerId: player.id,
                  });
                }
              }
            }
            
            console.log(`[NEXT PHASE EFFECT] ${card} is duration, leaving in play`);
            continue;
          }
          
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
        break;
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
          log: false,
        });
      }
    }
    
    if (playCard) {
      console.log(`[PLAY CARD EFFECT] updating card played stats...`);
      
      yield new CardPlayedEffect({
        cardId,
        playerId,
        log: false,
      });
    }
    else {
      console.log(`[PLAY CARD EFFECT] card played doesn't count towards stats`);
    }
    
    const trigger = new ReactionTrigger({
      eventType: 'cardPlayed',
      playerId,
      cardId,
    });
    
    const reactionContext = {};
    yield* reactionManager.runTrigger({ trigger, reactionContext });

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
        log: false
      });
    }
    
    yield new GainBuyEffect({
      count: -1,
      log: false
    });
    
    yield new GainCardEffect({
      playerId: playerId,
      cardId: cardId,
      to: { location: 'playerDiscards' },
      isRootLog: true
    });
    
    yield* map.gainCard({ playerId, cardId });
  };
  
  
  map.gainCard = function* (args) {
    const trigger = new ReactionTrigger({
      cardId: args.cardId,
      playerId: args.playerId,
      eventType: 'gainCard'
    });
    
    yield* reactionManager.runTrigger({ trigger });
  }
  
  return map;
};

export const cardEffectFunctionMapFactory: CardEffectFunctionMapFactory = {};

export const cardEffectGeneratorMapFactory: CardEffectGeneratorMapFactory = {};
