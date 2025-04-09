import {
  EffectGeneratorBlueprint,
  EffectGeneratorFactory,
  EffectGeneratorFn,
  Reaction,
  ReactionTrigger,
} from "../types.ts";
import { DiscardCardEffect } from "./effects/discard-card.ts";
import { DrawCardEffect } from "./effects/draw-card.ts";
import { GainActionEffect } from "./effects/gain-action.ts";
import { GainBuyEffect } from "./effects/gain-buy.ts";
import { GainCardEffect } from "./effects/gain-card.ts";
import { GainTreasureEffect } from "./effects/gain-treasure.ts";
import { PlayCardEffect } from "./effects/play-card.ts";
import { getEffectiveCardCost } from "../utils/get-effective-card-cost.ts";
import { MoveCardEffect } from "./effects/move-card.ts";
import { getOrderStartingFrom } from "../utils/get-order-starting-from.ts";
import { UserPromptEffect } from "./effects/user-prompt.ts";
import { CardLibrary } from "./card-library.ts";
import { SelectCardEffect } from "./effects/select-card.ts";

function groupReactionsByCard(reactions: Reaction[]) {
  const grouped = new Map<string, { count: number; reaction: Reaction }>();
  for (const reaction of reactions) {
    const key = reaction.getSourceKey();
    if (!grouped.has(key)) grouped.set(key, { count: 1, reaction });
    else grouped.get(key)!.count++;
  }
  return grouped;
}

function buildActionButtons(
  grouped: Map<string, { count: number; reaction: Reaction }>,
  cardLibrary: CardLibrary,
) {
  let actionId = 1;
  const buttons = [{ action: 0, label: "Cancel" }];
  for (const [cardKey, { count, reaction: { id } }] of grouped) {
    const [, cardId] = id.split("-");
    const cardName = cardLibrary.getCard(+cardId).cardName;
    buttons.push({ action: actionId++, label: `${cardName} (${count})` });
  }
  return buttons;
}

function buildActionMap(
  grouped: Map<string, { count: number; reaction: Reaction }>,
) {
  let actionId = 1;
  const map = new Map<number, Reaction>();
  for (const [, { reaction }] of grouped) {
    map.set(actionId++, reaction);
  }
  return map;
}

export const createEffectGeneratorMap: EffectGeneratorFactory = (
  { reactionManager },
) => {
  const map: Record<string, EffectGeneratorFn> = {};

  map.playCard = function* (
    { match, cardLibrary, triggerPlayerId, triggerCardId },
  ) {
    if (!triggerCardId) {
      throw new Error("playCard requires a card ID");
    }

    const card = cardLibrary.getCard(triggerCardId);

    if (cardLibrary.getCard(triggerCardId).type.includes("ACTION")) {
      yield new GainActionEffect({
        count: -1,
        sourcePlayerId: triggerPlayerId,
        sourceCardId: triggerCardId,
        triggerImmediateUpdate: true,
      });
    }

    yield new MoveCardEffect({
      cardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      to: {
        location: "playArea",
      },
    });

    yield new PlayCardEffect({
      cardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      playerId: triggerPlayerId,
    });

    const trigger: ReactionTrigger = {
      eventType: "cardPlayed",
      playerId: triggerPlayerId,
      cardId: triggerCardId,
    };

    // now we get the order of players that could be affected by the play (including the current player),
    // then get reactions for them and run them
    const targetOrder = getOrderStartingFrom(
      match.players,
      match.currentPlayerTurnIndex,
    );

    const reactionContext: any = {};

    for (const targetPlayer of targetOrder) {
      console.log(
        `[PLAY CARD EFFECT] checking '${trigger.eventType}' reactions for ${targetPlayer}`,
      );
      const reactions = reactionManager.getReactionsForPlayer(
        trigger,
        targetPlayer.id,
      );
      console.log(
        `[PLAY CARD EFFECT] ${targetPlayer} has ${reactions.length} reactions to start`,
      );
      if (!reactions.length) continue;

      const usedReactionIds = new Set<string>();
      const blockedCardKeys = new Set<string>();

      while (true) {
        const remainingReactions = reactions.filter((r) => {
          const key = r.getSourceKey();
          return !usedReactionIds.has(r.id) && !blockedCardKeys.has(key);
        });

        console.log(
          `[PLAY CARD EFFECT] ${targetPlayer} has ${remainingReactions.length} remaining reactions`,
        );

        if (!remainingReactions.length) break;

        const grouped = groupReactionsByCard(remainingReactions);
        const actionButtons = buildActionButtons(grouped, cardLibrary);
        const actionMap = buildActionMap(grouped);

        const result = (yield new UserPromptEffect({
          playerId: targetPlayer.id,
          sourcePlayerId: triggerPlayerId,
          sourceCardId: triggerCardId,
          actionButtons,
          prompt: "Choose reaction?",
        })) as { action: number };

        if (result.action === 0) {
          console.log(`[PLAY CARD EFFECT] ${targetPlayer} chose not to react`);
          break;
        } else {
          console.log(
            `[PLAY CARD EFFECT] ${targetPlayer} reacts with ${
              actionMap.get(result.action)
            }`,
          );
        }

        const selectedReaction = actionMap.get(result.action);

        if (!selectedReaction) {
          console.log(`[PLAY CARD EFFECT] reaction not found in action map`);
          continue;
        }

        const reactionResult = yield* selectedReaction.generatorFn({
          match,
          cardLibrary,
          trigger,
          reaction: selectedReaction,
        });

        // right now the only card that created that has a reaction that the
        // card triggering it needs to know about is moat giving immunity.
        // every other reaction just returns undefined. so if the reaction
        // doesn't give a result, don't set it on the context. this might
        // have to expand later.
        if (reactionResult !== undefined) {
          reactionContext[targetPlayer.id] = {
            reaction: selectedReaction,
            trigger,
            result: reactionResult,
          };
        }
        
        usedReactionIds.add(selectedReaction.id);

        if (selectedReaction.once) {
          console.log(
            `[PLAY CARD EFFECT] selected reaction is single-use, unregistering it`,
          );
          reactionManager.unregisterTrigger(selectedReaction.id);
        }

        if (!selectedReaction.multipleUse) {
          blockedCardKeys.add(selectedReaction.getSourceKey());
        }
      }
    }

    const generatorFn = map[card.cardKey];
    if (generatorFn) {
      yield* generatorFn({
        match,
        cardLibrary,
        triggerPlayerId,
        triggerCardId,
        reactionContext,
      });
    }
  };
  map.discardCard = function* ({ triggerPlayerId, triggerCardId }) {
    if (!triggerCardId) {
      throw new Error("discardCard requires a card ID");
    }

    yield new DiscardCardEffect({
      playerId: triggerPlayerId,
      cardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
      sourceCardId: triggerCardId,
    });
  };
  map.buyCard = function* (
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
  };
  map.drawCard = function* ({ triggerPlayerId, triggerCardId }) {
    yield new DrawCardEffect({
      playerId: triggerPlayerId,
      sourceCardId: triggerCardId,
      sourcePlayerId: triggerPlayerId,
    });
  };
  map.gainCard = function* ({ triggerPlayerId, triggerCardId }) {
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
  };

  return map;
};

export const effectGeneratorBlueprintMap: Record<
  string,
  EffectGeneratorBlueprint
> = {};
