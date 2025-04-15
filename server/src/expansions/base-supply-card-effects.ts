import { GainTreasureEffect } from '../core/effects/effect-types/gain-treasure.ts';

import { CardExpansionModule } from '../types.ts';

const expansionModule: CardExpansionModule = {
  registerEffects: {
    'copper': () => function* () {
      yield new GainTreasureEffect({
        count: 1,
      });
    },
    'gold': () => function* () {
      yield new GainTreasureEffect({
        count: 3,
      });
    },
    'silver': () => function* () {
      yield new GainTreasureEffect({
        count: 2,
      });
    },
  }
};

export default expansionModule;
