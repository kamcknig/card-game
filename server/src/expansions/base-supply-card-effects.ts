import { AsyncEffectGeneratorFn, EffectGeneratorFn } from '../types.ts';

import { GainTreasureEffect } from '../effects/gain-treasure.ts';

export default {
  registerEffects: (): Record<
    string,
    EffectGeneratorFn | AsyncEffectGeneratorFn
  > => ({
    'copper': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ sourcePlayerId, sourceCardId, count: 1 });
    },
    'gold': function* (_match, _cardLibrary, sourcePlayerId, sourceCardId) {
      yield new GainTreasureEffect({ count: 3, sourcePlayerId, sourceCardId });
    },
    'silver': function* (
      _match,
      _cardLibrary,
      sourcePlayerId,
      sourceCardId,
    ) {
      yield new GainTreasureEffect({ count: 2, sourcePlayerId, sourceCardId });
    },
  })
}