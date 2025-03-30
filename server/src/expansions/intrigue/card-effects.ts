import { AsyncEffectGeneratorFn, EffectGeneratorFn } from '../../types.ts';
import { sourceMapsEnabled } from "node:process";
import { DiscardCardEffect } from '../../effects/discard-card.ts';
import { GainBuyEffect } from '../../effects/gain-buy.ts';
import { GainCardEffect } from '../../effects/gain-card.ts';
import { GainTreasureEffect } from '../../effects/gain-treasure.ts';
import { ShuffleDeckEffect } from '../../effects/shuffle-card.ts';
import { UserPromptEffect } from '../../effects/user-prompt.ts';

export default {
  registerEffects: (): Record<
    string,
    EffectGeneratorFn | AsyncEffectGeneratorFn
  > => ({
    'baron': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
      yield new GainBuyEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId
      });
      
      const hand = match.playerHands[triggerPlayerId];
      const idx = hand.findIndex(cId => cardLibrary.getCard(cId).cardKey === 'estate');
      if (idx !== -1) {
        const confirm = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          prompt: 'Discard estate?',
          confirmLabel: 'DISCARD',
          declineLabel: 'NO'
        })) as boolean;
        
        if (confirm) {
          console.debug(`[BARON EFFECT] player discarded estate`);
          yield new DiscardCardEffect({
            cardId: idx,
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            playerId: triggerPlayerId,
          });
          yield new GainTreasureEffect({count: 4, sourcePlayerId: triggerPlayerId});
        } else {
          console.debug(`[BARON EFFECT] player not discarding estate`);
          const idx = match.supply.findLastIndex(cId => cardLibrary.getCard(cId).cardKey === 'estate')
          if (idx !== -1) {
            yield new GainCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
              cardId: idx,
              to: {
                location: 'playerDiscards'
              }
            })
          } else {
            console.debug(`[BARON EFFECT] supply has no estates`);
          }
        }
      } else {
        console.debug(`[BARON EFFECT] player has no estates in hand`);
      }
    },
    'bridge': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
      yield new GainBuyEffect({count: 1, sourcePlayerId: triggerPlayerId});
      
      yield new GainTreasureEffect({count: 1, sourcePlayerId: triggerPlayerId});
      
      
    },
    'conspirator': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'courtier': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'courtyard': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'diplomat': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'duke': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'farm': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'ironworks': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'lurker': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'masquerade': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'mill': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'mining-village': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'minion': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'nobles': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'patrol': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'pawn': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'replace': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'secret-passage': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'shanty-town': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'steward': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'swindler': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'torturer': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'trading-post': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'upgrade': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
    'wishing-well': function* (match, cardLibrary, triggerPlayerId, triggerCardId, reactionContext) {
    
    },
  })
}