import { GainTreasureEffect } from "../core/effects/gain-treasure.ts";
import { CardExpansionModule } from "./card-expansion-module.ts";

const expansionModule: CardExpansionModule = {
  registerEffects: () => ({
    "copper": () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainTreasureEffect({
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        count: 1,
      });
    },
    "gold": () => function* ({ triggerCardId, triggerPlayerId }) {
      yield new GainTreasureEffect({
        count: 3,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
    },
    "silver": () => function* ({
      triggerPlayerId,
      triggerCardId,
    }) {
      yield new GainTreasureEffect({
        count: 2,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
      });
    },
  }),
};

export default expansionModule;
