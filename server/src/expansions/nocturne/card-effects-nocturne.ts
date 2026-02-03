import { CardExpansionModule } from '../../types.ts';
import { CardId } from 'shared/shared-types';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';

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
  'changeling': {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[changeling effect] resolving for player ${cardEffectArgs.playerId}`);

      // Changeling trashes itself before gaining a copy.
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });
      console.debug('[changeling effect] trashed changeling');

      // Gather all cards this player has in play, including active durations.
      const cardsInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);

      if (!cardsInPlay.length) {
        console.debug('[changeling effect] no cards in play to copy');
        return;
      }
      console.debug(`[changeling effect] ${cardsInPlay.length} cards in play available to copy`);

      // Prompt to select a card in play to copy.
      const selectionResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card in play to gain a copy of',
        content: {
          type: 'select',
          cardIds: cardsInPlay.map(card => card.id),
          selectCount: 1,
        }
      }) as { result: CardId[] };

      const selectedCardId = selectionResult.result[0];
      if (!selectedCardId) {
        console.debug('[changeling effect] no card selected to copy');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const pileKey = getCardPileKey(selectedCard);
      console.debug(`[changeling effect] selected ${selectedCard} (pile ${pileKey})`);

      // Determine which supply pile matches the selected card's pile key.
      const basicPileCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { kingdom: pileKey },
      ]);
      const kingdomPileCards = cardEffectArgs.findCards([
        { location: 'kingdomSupply' },
        { kingdom: pileKey },
      ]);

      const pileCards = basicPileCards.length ? basicPileCards : kingdomPileCards;
      if (!pileCards.length) {
        console.debug(`[changeling effect] no supply pile found for ${selectedCard}`);
        return;
      }
      console.debug(`[changeling effect] found ${pileCards.length} cards in pile ${pileKey}`);

      // The top card must match the selected card's name for split piles.
      const topCard = pileCards.slice(-1)[0];
      if (!topCard || topCard.cardKey !== selectedCard.cardKey) {
        console.debug(`[changeling effect] top of pile does not match ${selectedCard}`);
        return;
      }

      console.debug(`[changeling effect] gaining a copy of ${selectedCard}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: topCard.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'cobbler': {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[cobbler effect] resolving for player ${cardEffectArgs.playerId}`);

      const cobblerCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Register the start-of-next-turn gain effect.
      cardEffectArgs.registerDurationEffect(cobblerCard, {
        id: `cobbler:${cobblerCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(`[cobbler startTurn] resolving for player ${cardEffectArgs.playerId}`);

          // Skip if no eligible cards remain in supply.
          const eligibleCards = triggeredArgs.findCards([
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
          ]);
          if (!eligibleCards.length) {
            console.debug('[cobbler startTurn] no eligible cards in supply');
            return;
          }

          const gainCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            prompt: 'Gain a card to your hand costing up to $4',
            playerId: cardEffectArgs.playerId,
            count: 1,
            restrict: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
            ],
          }) as CardId[];

          const gainCardId = gainCardIds[0];
          if (!gainCardId) {
            console.debug('[cobbler startTurn] no eligible card selected to gain');
            return;
          }

          console.debug(`[cobbler startTurn] gaining ${triggeredArgs.cardLibrary.getCard(gainCardId)} to hand`);
          await triggeredArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: gainCardId,
            to: { location: 'playerHand' },
          });
        },
      });
    },
  },
  'conclave': {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[conclave effect] resolving for player ${cardEffectArgs.playerId}`);

      // Apply the immediate +$2.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      // Gather Action cards in hand for eligibility filtering.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const handActions = hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('ACTION'));

      if (!handActions.length) {
        console.debug('[conclave effect] no action cards in hand to play');
        return;
      }

      // Determine which Action card keys are already in play for this player.
      const inPlayCards = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const inPlayKeys = new Set(inPlayCards.map(card => card.cardKey));

      // Only allow Actions that are not already represented in play.
      const eligibleActions = handActions.filter(card => !inPlayKeys.has(card.cardKey));
      if (!eligibleActions.length) {
        console.debug('[conclave effect] no eligible action cards not already in play');
        return;
      }

      // Prompt the player to optionally select an eligible Action card to play.
      const selectionResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may play an Action card you do not have in play',
        actionButtons: [{ label: 'CANCEL', action: 1 }],
        content: {
          type: 'select',
          cardIds: eligibleActions.map(card => card.id),
          selectCount: 1,
        },
      }) as { action: number; result: CardId[] };

      if (selectionResult.action === 1 || !selectionResult.result.length) {
        console.debug('[conclave effect] player declined to play an action');
        return;
      }

      const selectedCardId = selectionResult.result[0];
      if (!selectedCardId) {
        console.debug('[conclave effect] no action selected to play');
        return;
      }

      // Play the chosen Action card, then award +1 Action.
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      console.debug(`[conclave effect] playing ${selectedCard}`);
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      console.debug('[conclave effect] gained +1 Action for playing an action');
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
    },
  },
  'crypt': {
    registerEffects: () => async (cardEffectArgs) => {
      console.info(`[crypt effect] resolving for player ${cardEffectArgs.playerId}`);

      // Determine eligible non-Duration Treasures in play for this player.
      const inPlayCards = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const eligibleTreasures = inPlayCards.filter(card =>
        card.type.includes('TREASURE') && !card.type.includes('DURATION')
      );

      if (!eligibleTreasures.length) {
        console.debug('[crypt effect] no eligible Treasures in play to set aside');
        return;
      }

      console.debug(`[crypt effect] eligible treasures: ${eligibleTreasures.length}`);

      // Prompt the player to set aside any number of eligible treasures.
      const selectionResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Set aside any number of non-Duration Treasures',
        actionButtons: [{ label: 'DONE', action: 1 }],
        content: {
          type: 'select',
          cardIds: eligibleTreasures.map(card => card.id),
          selectCount: { kind: 'upTo', count: eligibleTreasures.length },
        },
      }) as { result: CardId[] };

      const setAsideTreasureIds = selectionResult.result ?? [];
      if (!setAsideTreasureIds.length) {
        console.debug('[crypt effect] no treasures selected to set aside');
        return;
      }

      console.info(`[crypt effect] setting aside ${setAsideTreasureIds.length} treasure(s)`);
      for (const cardId of setAsideTreasureIds) {
        console.debug(`[crypt effect] setting aside ${cardEffectArgs.cardLibrary.getCard(cardId)}`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'set-aside' },
          facing: 'back',
        });
      }

      const cryptCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Move one set-aside treasure to hand at the start of each of the player's next turns.
      cardEffectArgs.registerDurationEffect(cryptCard, {
        id: `crypt:${cryptCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed
          && setAsideTreasureIds.length > 0,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(`[crypt startTurn] resolving for player ${cardEffectArgs.playerId}`);
          console.debug(`[crypt startTurn] remaining set aside: ${setAsideTreasureIds.length}`);

          // Bring Crypt back into play while it continues to resolve.
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: cryptCard.id,
            to: { location: 'playArea' },
          });

          let chosenTreasureId = setAsideTreasureIds[0];
          if (setAsideTreasureIds.length > 1) {
            const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
              playerId: cardEffectArgs.playerId,
              prompt: 'Choose a set aside Treasure to put into your hand',
              content: {
                type: 'select',
                cardIds: setAsideTreasureIds,
                selectCount: 1,
              },
            }) as { result: CardId[] };
            chosenTreasureId = promptResult.result?.[0] ?? chosenTreasureId;
          }

          if (!chosenTreasureId) {
            console.warn('[crypt startTurn] no set aside treasure selected');
            return;
          }

          console.debug(`[crypt startTurn] moving ${triggeredArgs.cardLibrary.getCard(chosenTreasureId)} to hand`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: chosenTreasureId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
            facing: 'front',
          });

          const index = setAsideTreasureIds.indexOf(chosenTreasureId);
          if (index >= 0) {
            setAsideTreasureIds.splice(index, 1);
          }

          console.debug(`[crypt startTurn] remaining set aside: ${setAsideTreasureIds.length}`);

          if (!setAsideTreasureIds.length) {
            console.info('[crypt startTurn] set-aside treasures exhausted, cleaning duration triggers');
            triggeredArgs.reactionManager.cleanupDurationTriggers(cryptCard.id);
          }
        },
      }, {
        cleanupCount: setAsideTreasureIds.length,
      });
    },
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
        });

        // Move the revealed card to set-aside (face up) to avoid shuffling it back.
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: revealedCardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'set-aside' },
          facing: 'front',
        });

        if (revealedCard.type.includes('ACTION')) {
          console.info(`[ghost effect] set aside Action ${revealedCard}`);
          actionCardId = revealedCardId;
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

      // Move the set-aside Action card to active duration at cleanup to keep it in play.
      const actionCard = cardEffectArgs.cardLibrary.getCard(actionCardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;
      cardEffectArgs.reactionManager.registerSystemTemplate(actionCard, 'startTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        autoResolve: true,
        condition: ({ trigger, match }) => getTurnPhase(trigger.args.phaseIndex) === 'cleanup'
          && match.turnNumber === turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          console.debug(`[ghost cleanup effect] moving ${actionCard} to active duration`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: actionCardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'activeDuration' },
            facing: 'front',
          });
        },
      });

      // Register the start-of-turn trigger to play the Action twice next turn.
      const ghostCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const ghostTurnPlayed = cardEffectArgs.match.turnNumber;
      cardEffectArgs.registerDurationEffect(ghostCard, {
        id: `ghost:${ghostCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== ghostTurnPlayed,
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
