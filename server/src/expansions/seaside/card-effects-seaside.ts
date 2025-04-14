import { CardExpansionModule } from '../card-expansion-module.ts';
import { GainTreasureEffect } from '../../core/effects/effect-types/gain-treasure.ts';
import { GainBuyEffect } from '../../core/effects/effect-types/gain-buy.ts';

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
    }
  }),
}

export default expansion;