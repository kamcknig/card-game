import { CardExpansionModule } from '../card-expansion-module.ts';
import { GainTreasureEffect } from '../../core/effects/effect-types/gain-treasure.ts';
import { GainBuyEffect } from '../../core/effects/effect-types/gain-buy.ts';
import { DrawCardEffect } from '../../core/effects/effect-types/draw-card.ts';
import { GainActionEffect } from '../../core/effects/effect-types/gain-action.ts';
import { SelectCardEffect } from '../../core/effects/effect-types/select-card.ts';
import { GainCardEffect } from '../../core/effects/effect-types/gain-card.ts';

const expansion: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    'astrolabe': {
      onCardPlayed: ({ playerId, cardId }) => {
        const id = `astrolabe-${cardId}`;
        return {
          registerTriggeredEvents: [{
            id,
            playerId,
            listeningFor: 'startTurn',
            compulsory: true,
            once: true,
            condition: (args) => {
              const { trigger } = args;
              return trigger.playerId === playerId;
            },
            generatorFn: function*() {
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
              yield new GainTreasureEffect({ count: 1, sourcePlayerId: playerId });
              
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
              yield new GainBuyEffect({count: 1, sourcePlayerId: playerId});
            }
          }]
        }
      }
    }
  }),
  registerScoringFunctions: () => ({}),
  registerEffects: () => ({
    'astrolabe': () => function* ({ triggerPlayerId }) {
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ count: 1, sourcePlayerId: triggerPlayerId });
      
      console.log(`[SEASON EFFECT] gaining 1 buy...`);
      yield new GainBuyEffect({ count: 1, sourcePlayerId: triggerPlayerId });
    },
    'bazaar': () => function* ({triggerPlayerId, triggerCardId}) {
      console.log(`[SEASON EFFECT] drawing 1 card...`);
      yield new DrawCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId
      });
      
      console.log(`[SEASON EFFECT] gaining 2 actions...`);
      yield new GainActionEffect({ count: 2, sourcePlayerId: triggerPlayerId });
      
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ count: 1, sourcePlayerId: triggerPlayerId });
    },
    'blockade': () => function* ({cardLibrary, triggerPlayerId, triggerCardId}) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        validPrompt: '',
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: 4 },
        },
        count: 1,
        sourceCardId: triggerCardId
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[BLOCKADE EFFECT] selected card ${cardLibrary.getCard(cardId)}`);
      
      yield new GainCardEffect({
        playerId: triggerPlayerId,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId!,
        cardId,
        to: { location: 'set-aside' },
      });
    }
  }),
}

export default expansion;