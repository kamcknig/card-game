import { GainTreasureEffect } from '../../core/effects/effect-types/gain-treasure.ts';
import { GainBuyEffect } from '../../core/effects/effect-types/gain-buy.ts';
import { DrawCardEffect } from '../../core/effects/effect-types/draw-card.ts';
import { GainActionEffect } from '../../core/effects/effect-types/gain-action.ts';
import { SelectCardEffect } from '../../core/effects/effect-types/select-card.ts';
import { GainCardEffect } from '../../core/effects/effect-types/gain-card.ts';
import { CardExpansionModule } from '../../types.ts';

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
              yield new GainTreasureEffect({ count: 1});
              
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
              yield new GainBuyEffect({count: 1});
            }
          }]
        }
      }
    },
  }),
  registerScoringFunctions: () => ({}),
  registerEffects: {
    'astrolabe': () => function* () {
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ count: 1});
      
      console.log(`[SEASON EFFECT] gaining 1 buy...`);
      yield new GainBuyEffect({ count: 1});
    },
    'bazaar': () => function* (arg) {
      console.log(`[SEASON EFFECT] drawing 1 card...`);
      yield new DrawCardEffect({
        playerId: arg.playerId,
      });
      
      console.log(`[SEASON EFFECT] gaining 2 actions...`);
      yield new GainActionEffect({ count: 2});
      
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      yield new GainTreasureEffect({ count: 1});
    },
    'blockade': ({ cardLibrary}) => function* (arg) {
      const cardIds = (yield new SelectCardEffect({
        prompt: 'Gain card',
        validPrompt: '',
        playerId: arg.playerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: 4 },
        },
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[BLOCKADE EFFECT] selected card ${cardLibrary.getCard(cardId)}`);
      
      yield new GainCardEffect({
        playerId: arg.playerId,
        cardId,
        to: { location: 'set-aside' },
      });
    }
  }
}

export default expansion;