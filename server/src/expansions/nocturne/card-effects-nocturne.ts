import { CardExpansionModule } from '../../types.ts';
import { CardId } from 'shared/shared-types.ts';

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
  'cemetery': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.info(`[cemetery onGained] resolving for player ${eventArgs.playerId}`);

        // Gather the player's hand for the on-gain trash.
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
        if (!hand.length) {
          console.debug('[cemetery onGained] no cards in hand to trash');
          return;
        }

        // Prompt the player to trash up to 4 cards from hand.
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Trash up to 4 cards',
          playerId: eventArgs.playerId,
          count: { kind: 'upTo', count: 4 },
          restrict: hand,
        });

        if (!selectedCardIds.length) {
          console.debug('[cemetery onGained] no cards selected to trash');
          return;
        }

        // Trash the selected cards.
        for (const cardId of selectedCardIds) {
          console.debug(`[cemetery onGained] trashing ${cardEffectArgs.cardLibrary.getCard(cardId)}`);
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: eventArgs.playerId,
            cardId: cardId,
          });
        }
      },
    }),
  },
  'ghost': {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[ghost effect] resolving for player ${cardEffectArgs.playerId}`);

      // Reveal cards until an Action card is found or the deck is exhausted.
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      const cardsToDiscard: CardId[] = [];
      let actionCardId: CardId | undefined;

      while (deck.length + discard.length > 0 && !actionCardId) {
        if (deck.length === 0) {
          console.debug('[ghost effect] deck empty, shuffling discard');
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        }

        if (deck.length === 0) {
          console.debug('[ghost effect] no cards left to reveal');
          break;
        }

        const revealedCardId = deck.slice(-1)[0];
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
        console.debug(`[ghost effect] revealing ${revealedCard}`);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          playerId: cardEffectArgs.playerId,
          cardId: revealedCardId,
          moveToSetAside: true,
        });

        if (revealedCard.type.includes('ACTION')) {
          console.info(`[ghost effect] set aside Action ${revealedCard}`);
          actionCardId = revealedCardId;
          // Keep the action in play/active duration until it is played next turn.
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: revealedCardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'activeDuration' },
          });
          break;
        }

        cardsToDiscard.push(revealedCardId);
      }

      // Discard any non-Action cards that were revealed.
      if (cardsToDiscard.length) {
        console.debug(`[ghost effect] discarding ${cardsToDiscard.length} revealed card(s)`);
        for (const cardId of cardsToDiscard) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardId,
          });
        }
      }

      if (!actionCardId) {
        console.info('[ghost effect] no Action card found to set aside');
        return;
      }

      // Register the start-of-turn trigger to play the Action twice next turn.
      const ghostCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;
      cardEffectArgs.registerDurationEffect(ghostCard, {
        id: `ghost:${ghostCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          // Bring Ghost back to play area for its next-turn effect.
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: ghostCard.id,
            to: { location: 'playArea' },
          });

          const actionCard = triggeredArgs.cardLibrary.getCard(actionCardId);
          console.debug(`[ghost startTurn effect] playing ${actionCard} twice`);
          for (let i = 0; i < 2; i++) {
            await triggeredArgs.runGameActionDelegate('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: actionCardId,
              overrides: {
                actionCost: 0,
              },
            });
          }
        },
      });
    },
  },
  'haunted-mirror': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (cardEffectArgs, eventArgs) => {
        console.info(`[haunted-mirror onTrashed] resolving for player ${eventArgs.playerId}`);

        // Find Action cards in the player's hand to discard.
        const actionCards = cardEffectArgs.findCards([
          { location: 'playerHand', playerId: eventArgs.playerId },
          { cardType: ['ACTION'] },
        ]);

        if (!actionCards.length) {
          console.debug('[haunted-mirror onTrashed] no Action cards to discard');
          return;
        }

        // Prompt the player to discard an Action to gain a Ghost.
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: 'Discard an Action to gain a Ghost?',
          restrict: actionCards.map(card => card.id),
          count: 1,
          optional: true,
        });

        const selectedCardId = selectedCardIds[0];
        if (!selectedCardId) {
          console.debug('[haunted-mirror onTrashed] player declined to discard an Action');
          return;
        }

        // Discard the selected Action card.
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCardId,
        });

        // Gain a Ghost from the non-supply pile.
        const ghostCards = cardEffectArgs.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'ghost' },
        ]);

        if (!ghostCards.length) {
          console.warn('[haunted-mirror onTrashed] no Ghost cards available to gain');
          return;
        }

        const ghostCardId = ghostCards.slice(-1)[0].id;
        console.debug(`[haunted-mirror onTrashed] gaining Ghost ${ghostCardId}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: ghostCardId,
          to: { location: 'playerDiscard' },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[haunted-mirror effect] resolving for player ${cardEffectArgs.playerId}`);

      // Haunted Mirror is a $1 Treasure.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
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
