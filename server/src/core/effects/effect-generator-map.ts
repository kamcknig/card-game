import {
  EffectGeneratorBlueprint,
  EffectGeneratorFactory,
  EffectGeneratorFn,
  Reaction,
  ReactionTrigger,
} from '../types.ts';
import { DiscardCardEffect } from './effects/discard-card.ts';
import { DrawCardEffect } from './effects/draw-card.ts';
import { GainActionEffect } from './effects/gain-action.ts';
import { GainBuyEffect } from './effects/gain-buy.ts';
import { GainCardEffect } from './effects/gain-card.ts';
import { GainTreasureEffect } from './effects/gain-treasure.ts';
import { CardPlayedEffect } from './effects/card-played.ts';
import { getEffectiveCardCost } from '../utils/get-effective-card-cost.ts';
import { MoveCardEffect } from './effects/move-card.ts';
import { getOrderStartingFrom } from '../utils/get-order-starting-from.ts';
import { UserPromptEffect } from './effects/user-prompt.ts';
import { TurnPhaseOrderValues } from 'shared/shared-types.ts';
import { getTurnPhase } from '../utils/get-turn-phase.ts';
import { EndTurnEffect } from './effects/end-turn.ts';
import { groupReactionsByCardKey } from './reactions/group-reactions-by-card-key.ts';
import { buildActionButtons } from './reactions/build-action-buttons.ts';
import { buildActionMap } from './reactions/build-action-map.ts';

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
  
  
  
  map.nextPhase = function* (
    { match, cardLibrary, triggerPlayerId, triggerCardId }
  ) {
    match.turnPhaseIndex = match.turnPhaseIndex + 1;
    
    if (match.turnPhaseIndex >= TurnPhaseOrderValues.length) {
      match.turnPhaseIndex = 0;
    }
    
    const newPhase = getTurnPhase(match.turnPhaseIndex);
    const player = match.players[match.currentPlayerTurnIndex];
    
    console.log(`[NEXT PHASE EFFECT] entering phase: ${newPhase}`);
    
    switch (newPhase) {
      case 'action':
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
        
        break;
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
    } else {
      console.log(`[PLAY CARD EFFECT] not physically moving card`);
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
    } else {
      console.log(`[PLAY CARD EFFECT] card played doesn't count towards stats`);
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
    
    const trigger: ReactionTrigger = {
      eventType: 'cardPlayed',
      playerId: triggerPlayerId,
      cardId: triggerCardId,
    };
    
    // now we get the order of players that could be affected by the play (including the current player),
    // then get reactions for them and run them
    const targetOrder = getOrderStartingFrom(
      match.players,
      match.currentPlayerTurnIndex,
    );
    
    const reactionContext: any = {};
    
    for (const targetPlayer of targetOrder) {
      console.log(`[PLAY CARD EFFECT] checking '${trigger.eventType}' reactions for ${targetPlayer}`);
      
      const usedReactionIds = new Set<string>();
      const blockedCardKeys = new Set<string>();
      
      while (true) {
        const reactions = reactionManager.getReactionsForPlayer(
          trigger,
          targetPlayer.id,
        ).filter((r) => {
          const key = r.getSourceKey();
          return !usedReactionIds.has(r.id) && !blockedCardKeys.has(key);
        });
        
        console.log(`[PLAY CARD EFFECT] ${targetPlayer} has ${reactions.length} remaining actions`);
        
        if (!reactions.length) break;
        
        const compulsoryReactions = reactions.filter(r => r.compulsory);
        
        let selectedReaction: Reaction | undefined = undefined;
        
        // when you have more than one reaction, the player chooses.
        // if there is only one reaction though, and it's compulsory (such as the merchant's
        // reaction-like card effect to gain a treasure) then we just do it with no choice.
        if (reactions.length > 1 || compulsoryReactions.length === 0) {
          const grouped = groupReactionsByCardKey(reactions);
          const actionButtons = buildActionButtons(grouped, cardLibrary);
          const actionMap = buildActionMap(grouped);
          
          const result = (yield new UserPromptEffect({
            playerId: targetPlayer.id,
            sourcePlayerId: triggerPlayerId,
            sourceCardId: triggerCardId,
            actionButtons,
            prompt: 'Choose reaction?',
          })) as { action: number };
          
          if (result.action === 0) {
            console.log(`[PLAY CARD EFFECT] ${targetPlayer} chose not to react`);
            break;
          } else {
            console.log(`[PLAY CARD EFFECT] ${targetPlayer} reacts with ${actionMap.get(result.action)}`);
          }
          
          selectedReaction = actionMap.get(result.action);
        } else {
          selectedReaction = compulsoryReactions[0];
        }
        
        if (!selectedReaction) {
          console.warn(`[PLAY CARD EFFECT] reaction not found in action map`);
          continue;
        }
        
        const reactionResult = yield* selectedReaction.generatorFn({
          match,
          cardLibrary,
          trigger,
          reaction: selectedReaction,
        });
        
        // right now the only card that created that has a reaction that the
        // card triggering it needs to know about is moat giving immunity.
        // every other reaction just returns undefined. so if the reaction
        // doesn't give a result, don't set it on the context. this might
        // have to expand later.
        if (reactionResult !== undefined) {
          reactionContext[targetPlayer.id] = {
            reaction: selectedReaction,
            trigger,
            result: reactionResult,
          };
        }
        
        usedReactionIds.add(selectedReaction.id);
        
        if (selectedReaction.once) {
          console.log(`[PLAY CARD EFFECT] selected reaction is single-use, unregistering it`);
          reactionManager.unregisterTrigger(selectedReaction.id);
        }
        
        if (!selectedReaction.multipleUse) {
          blockedCardKeys.add(selectedReaction.getSourceKey());
        }
      }
    }
    
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
