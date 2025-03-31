import { AsyncEffectGeneratorFn, EffectGeneratorFn } from '../../types.ts';
import { DiscardCardEffect } from '../../effects/discard-card.ts';
import { GainBuyEffect } from '../../effects/gain-buy.ts';
import { GainCardEffect } from '../../effects/gain-card.ts';
import { GainTreasureEffect } from '../../effects/gain-treasure.ts';
import { UserPromptEffect } from '../../effects/user-prompt.ts';
import { ModifyCostEffect } from '../../effects/modify-cost.ts';
import { DrawCardEffect } from '../../effects/draw-card.ts';
import { GainActionEffect } from '../../effects/gain-action.ts';
import { RevealCardEffect } from '../../effects/reveal-card.ts';
import { SelectCardEffect } from '../../effects/select-card.ts';

export default {
  registerEffects: (): Record<
    string,
    EffectGeneratorFn | AsyncEffectGeneratorFn
  > => ({
    'baron': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      _reactionContext,
    ) {
      yield new GainBuyEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId,
      });

      const hand = match.playerHands[triggerPlayerId];
      const idx = hand.findIndex((cId) =>
        cardLibrary.getCard(cId).cardKey === 'estate'
      );
      if (idx !== -1) {
        const confirm = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          prompt: 'Discard estate?',
          actionButtons: [{label: 'NO', action: 1}, {label: 'DISCARD', action: 2}],
        })) as { action: number };

        if (confirm.action === 2) {
          console.debug(`[BARON EFFECT] player discarded estate`);
          yield new DiscardCardEffect({
            cardId: idx,
            sourceCardId: triggerCardId,
            sourcePlayerId: triggerPlayerId,
            playerId: triggerPlayerId,
          });
          yield new GainTreasureEffect({
            count: 4,
            sourcePlayerId: triggerPlayerId,
          });
        } else {
          console.debug(`[BARON EFFECT] player not discarding estate`);
          const idx = match.supply.findLastIndex((cId) =>
            cardLibrary.getCard(cId).cardKey === 'estate'
          );
          if (idx !== -1) {
            yield new GainCardEffect({
              playerId: triggerPlayerId,
              sourcePlayerId: triggerPlayerId,
              sourceCardId: triggerCardId,
              cardId: idx,
              to: {
                location: 'playerDiscards',
              },
            });
          } else {
            console.debug(`[BARON EFFECT] supply has no estates`);
          }
        }
      } else {
        console.debug(`[BARON EFFECT] player has no estates in hand`);
      }
    },
    'bridge': function* (
      _match,
      _cardLibrary,
      triggerPlayerId,
      triggerCardId,
      _reactionContext,
    ) {
      yield new GainBuyEffect({ count: 1, sourcePlayerId: triggerPlayerId });

      yield new GainTreasureEffect({
        count: 1,
        sourcePlayerId: triggerPlayerId,
      });

      yield new ModifyCostEffect({
        appliesToCard: 'ALL',
        appliesToPlayer: 'ALL',
        amount: -1,
        sourceCardId: triggerCardId!,
        sourcePlayerId: triggerPlayerId,
        expiresAt: 'TURN_END',
      });
    },
    'conspirator': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      _triggerCardId,
      _reactionContext,
    ) {
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
      });

      const actionCardCount = match.cardsPlayed[triggerPlayerId]?.filter((cardId) =>
        cardLibrary.getCard(cardId).type.includes('ACTION')
      );
      
      console.debug(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount}`);
      if (actionCardCount?.length >= 3) {
        yield new DrawCardEffect({
          playerId: triggerPlayerId,
          sourcePlayerId: triggerPlayerId,
        });

        yield new GainActionEffect({
          count: 1,
          sourcePlayerId: triggerPlayerId,
        });
      }
    },
    'courtier': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      _reactionContext,
    ) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Reveal card',
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
        playerId: triggerPlayerId,
        restrict: {
          from: {
            location: 'playerHands'
          }
        }
      })) as number[];
      
      const cardId = cardIds[0];
      
      yield new RevealCardEffect({
        cardId,
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
      });
      
      const cardTypeCount = cardLibrary.getCard(cardId).type.length;
      console.log(`[COURTIER EFFECT] card has ${cardTypeCount} types`);
      
      const choices = [
        {label: '+1 Action', action: 1},
        {label: '+1 Buy', action: 2},
        {label: '+3 Treasure', action: 3},
        {label: 'Gain a gold', action: 4},
      ];
      
      for (let i = 0; i < cardTypeCount; i++) {
        const result = (yield new UserPromptEffect({
          playerId: triggerPlayerId,
          prompt: 'Choose one',
          sourcePlayerId: triggerPlayerId,
          actionButtons: choices
        })) as { action: number };
        
        const resultAction = result.action;
        
        console.debug(`[COURTIER EFFECT] player chose ${resultAction}`);
        
        const idx = choices.findIndex(c => c.action === resultAction);
        choices.splice(idx, 1);
        
        switch (resultAction) {
          case 1:
            yield new GainActionEffect({count: 1, sourcePlayerId: triggerPlayerId});
            break;
          case 2:
            yield new GainBuyEffect({count: 1, sourcePlayerId: triggerPlayerId});
            break;
          case 3:
            yield new GainTreasureEffect({count: 3, sourcePlayerId: triggerPlayerId});
            break;
          case 4:
            for (let i = match.kingdom.length - 1; i >= 0; i--) {
              const card = cardLibrary.getCard(match.kingdom[i]);
              if (card.cardKey === 'gold') {
                yield new GainCardEffect({
                  cardId: card.id,
                  playerId: triggerPlayerId,
                  to: {
                    location: 'playerDiscards'
                  },
                  sourcePlayerId: triggerPlayerId
                })
                break;
              }
            }
            break;
        }
      }
    },
    'courtyard': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'diplomat': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'duke': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'farm': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'ironworks': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'lurker': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'masquerade': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'mill': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'mining-village': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'minion': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'nobles': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'patrol': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'pawn': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'replace': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'secret-passage': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'shanty-town': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'steward': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'swindler': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'torturer': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'trading-post': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'upgrade': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
    'wishing-well': function* (
      match,
      cardLibrary,
      triggerPlayerId,
      triggerCardId,
      reactionContext,
    ) {
    },
  }),
};
