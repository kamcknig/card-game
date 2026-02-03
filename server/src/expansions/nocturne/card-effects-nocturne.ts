import { CardExpansionModule } from "../../types.ts";

// Nocturne card effects module for non-supply cards and other mechanics.
const expansion: CardExpansionModule = {
  'bard': {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[bard effect] resolving for player ${cardEffectArgs.playerId}`);

      // Apply the immediate +$2.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      // Receive a boon from the boon deck.
      await cardEffectArgs.runGameActionDelegate('receiveBoon', {
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  'blessed-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.info(`[blessed-village onGained] resolving for player ${eventArgs.playerId}`);

        // Take a boon and set it aside so the player can decide timing.
        const boonId = await cardEffectArgs.runGameActionDelegate('receiveBoon', {
          playerId: eventArgs.playerId,
          immediate: false,
        });

        if (boonId === undefined) {
          console.info('[blessed-village onGained] no boon available to defer');
          return;
        }

        // Prompt the player to decide when to receive the boon.
        const decision = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Receive a Boon now or at the start of your next turn?',
          actionButtons: [
            { label: 'NOW', action: 1 },
            { label: 'NEXT TURN', action: 2 },
          ],
        }) as { action: number };

        const immediate = decision.action === 1;
        console.debug(`[blessed-village onGained] player chose ${immediate ? 'now' : 'next turn'} for boon`);

        if (immediate) {
          // Resolve the deferred boon immediately.
          await cardEffectArgs.runGameActionDelegate('receiveBoon', {
            playerId: eventArgs.playerId,
            immediate: true,
            boonId: boonId,
          });
          return;
        }

        const deferredBoon = cardEffectArgs.match.boons?.cards?.find(card => card.id === boonId);
        if (!deferredBoon) {
          console.warn(`[blessed-village onGained] deferred boon ${boonId} not found in match`);
          return;
        }

        // Register a one-shot start-of-turn trigger to resolve the deferred boon.
        const turnNumber = cardEffectArgs.match.turnNumber;
        cardEffectArgs.reactionManager.registerSystemTemplate(deferredBoon, 'startTurn', {
          playerId: eventArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) {
              return false;
            }
            return conditionArgs.trigger.args.turnNumber !== turnNumber;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            // Resolve the deferred boon at the start of the next turn.
            await triggeredArgs.runGameActionDelegate('receiveBoon', {
              playerId: eventArgs.playerId,
              immediate: true,
              boonId: boonId,
            });
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[blessed-village effect] resolving for player ${cardEffectArgs.playerId}`);

      // Apply the immediate +1 Card and +2 Actions.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    },
  },
  "will-o-wisp": {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(
        `[will-o-wisp effect] resolving for player ${cardEffectArgs.playerId}`,
      );

      // Apply the immediate +1 Card and +1 Action.
      await cardEffectArgs.runGameActionDelegate("drawCard", {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.runGameActionDelegate("gainAction", { count: 1 });

      let deck = cardEffectArgs.cardSourceController.getSource(
        "playerDeck",
        cardEffectArgs.playerId,
      );

      if (!deck.length) {
        console.debug(
          `[will-o-wisp effect] deck empty for player ${cardEffectArgs.playerId}, shuffling discard`,
        );
        await cardEffectArgs.runGameActionDelegate("shuffleDeck", {
          playerId: cardEffectArgs.playerId,
        });

        deck = cardEffectArgs.cardSourceController.getSource(
          "playerDeck",
          cardEffectArgs.playerId,
        );
      }

      if (!deck.length) {
        console.debug(
          `[will-o-wisp effect] no cards to reveal after shuffling for player ${cardEffectArgs.playerId}`,
        );

        return;
      }

      const topCardId = deck.slice(-1)[0];

      console.debug(`[will-o-wisp effect] revealing top card ${topCardId}`);

      await cardEffectArgs.runGameActionDelegate("revealCard", {
        playerId: cardEffectArgs.playerId,
        cardId: topCardId,
      });

      const revealedCardId = topCardId;

      if (!revealedCardId) {
        console.debug("[will-o-wisp effect] no card revealed");
        return;
      }

      const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        revealedCard,
        { playerId: cardEffectArgs.playerId },
      );

      const treasureCost = cost.treasure ?? 0;
      const potionCost = cost.potion ?? 0;
      const debtCost = cost.debt ?? 0;
      // Only treasure costs of $2 or less qualify; potion/debt costs do not.
      const qualifiesForDraw = treasureCost <= 2 && potionCost === 0 &&
        debtCost === 0;
      if (!qualifiesForDraw) {
        console.debug(
          `[will-o-wisp effect] revealed ${revealedCard.cardKey} does not cost $2 or less`,
        );
        return;
      }

      console.info(
        `[will-o-wisp effect] revealed ${revealedCard.cardKey} costs $2 or less, moving to hand`,
      );

      await cardEffectArgs.runGameActionDelegate("moveCard", {
        cardId: revealedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: "playerHand" },
      });
    },
  },
};

export default expansion;
