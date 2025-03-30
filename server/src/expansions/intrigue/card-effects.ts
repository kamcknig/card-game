import { AsyncEffectGeneratorFn, EffectGeneratorFn } from '../../types.ts';
import { DiscardCardEffect } from '../../effects/discard-card.ts';
import { GainBuyEffect } from '../../effects/gain-buy.ts';
import { GainCardEffect } from '../../effects/gain-card.ts';
import { GainTreasureEffect } from '../../effects/gain-treasure.ts';
import { UserPromptEffect } from '../../effects/user-prompt.ts';
import { ModifyCostEffect } from '../../effects/modify-cost.ts';
import { DrawCardEffect } from '../../effects/draw-card.ts';
import { GainActionEffect } from '../../effects/gain-action.ts';

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
          confirmLabel: 'DISCARD',
          declineLabel: 'NO',
        })) as boolean;

        if (confirm) {
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
      reactionContext,
    ) {
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
