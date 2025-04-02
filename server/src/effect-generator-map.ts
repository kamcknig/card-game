import { AsyncEffectGeneratorFn, EffectGeneratorFn, LifecycleCallbackMap } from './types.ts';
import { DiscardCardEffect } from "./effects/discard-card.ts";
import { DrawCardEffect } from "./effects/draw-card.ts";
import { GainActionEffect } from "./effects/gain-action.ts";
import { GainBuyEffect } from "./effects/gain-buy.ts";
import { GainCardEffect } from "./effects/gain-card.ts";
import { GainTreasureEffect } from "./effects/gain-treasure.ts";
import { PlayCardEffect } from "./effects/play-card.ts";

import { getEffectiveCardCost } from "./utils/get-effective-card-cost.ts";

export const cardLifecycleMap: Record<string, Partial<LifecycleCallbackMap>> =
  {};

export const effectGeneratorMap: Record<string, EffectGeneratorFn | AsyncEffectGeneratorFn> = {
  "playCard": function* ({ cardLibrary, triggerPlayerId, triggerCardId }) {
    if (!triggerCardId) {
      throw new Error("playCard requires a card ID");
    }

    if (cardLibrary.getCard(triggerCardId).type.includes("ACTION")) {
      yield new GainActionEffect({
        count: -1,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        triggerImmediateUpdate: true,
      });
    }

    yield new PlayCardEffect({
      cardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      playerId: triggerPlayerId,
    });
  },
  "discardCard": function* ({ triggerPlayerId, triggerCardId }) {
    if (!triggerCardId) {
      throw new Error("discardCard requires a card ID");
    }

    yield new DiscardCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
    });
  },
  "buyCard": function* (
    { match, cardLibrary, triggerPlayerId, triggerCardId },
  ) {
    if (!triggerCardId) {
      throw new Error("buyCard requires a card ID");
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
      });
    }
    yield new GainBuyEffect({
      count: -1,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      triggerImmediateUpdate: true,
    });
    yield new GainCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      to: { location: "playerDiscards" },
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
    });
  },
  "drawCard": function* ({ triggerPlayerId, triggerCardId }) {
    yield new DrawCardEffect({
      playerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
    });
  },
  "gainCard": function* ({ triggerPlayerId, triggerCardId }) {
    if (!triggerCardId) {
      throw new Error("gainCard requires a card ID");
    }

    yield new GainCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      to: { location: "playerDiscards" },
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
    });
  },
};
