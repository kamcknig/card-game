import { CardEffectFunctionContext, CardExpansionModule } from '../../types.ts';
import { CardId, CardLikeId } from 'shared/shared-types';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { compareCardCosts } from 'shared/compare-card-cost.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

// Prompts a player to choose an Action from hand not already represented in play.
const promptUniqueActionFromHand = async (
  cardEffectArgs: CardEffectFunctionContext,
  prompt: string,
  logPrefix: string,
): Promise<CardId | undefined> => {
  // Gather Action cards in hand for eligibility filtering.
  const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
  const handActions = hand
    .map(cardEffectArgs.cardLibrary.getCard)
    .filter(card => card.type.includes('ACTION'));

  if (!handActions.length) {
    console.debug(`[${logPrefix}] no action cards in hand to play`);
    return undefined;
  }

  // Determine which Action card keys are already in play for this player.
  const inPlayCards = getCardsInPlay(cardEffectArgs.findCards)
    .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
  const inPlayKeys = new Set(inPlayCards.map(card => card.cardKey));

  // Only allow Actions that are not already represented in play.
  const eligibleActions = handActions.filter(card => !inPlayKeys.has(card.cardKey));
  if (!eligibleActions.length) {
    console.debug(`[${logPrefix}] no eligible action cards not already in play`);
    return undefined;
  }

  // Prompt the player to optionally select an eligible Action card to play.
  const selectionResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
    playerId: cardEffectArgs.playerId,
    prompt,
    actionButtons: [{ label: 'CANCEL', action: 1 }],
    content: {
      type: 'select',
      cardIds: eligibleActions.map(card => card.id),
      selectCount: 1,
    },
  }) as { action: number; result: CardId[] };

  if (selectionResult.action === 1 || !selectionResult.result.length) {
    console.debug(`[${logPrefix}] player declined to play an action`);
    return undefined;
  }

  const selectedCardId = selectionResult.result[0];
  if (!selectedCardId) {
    console.debug(`[${logPrefix}] no action selected to play`);
    return undefined;
  }

  return selectedCardId;
};

// Nocturne card effects module for non-supply cards and other mechanics.
const expansion: CardExpansionModule = {
  'bard': {
    registerEffects: () => async (cardEffectArgs) => {

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

      // Apply the immediate +$2.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      // Prompt the player to choose a unique Action card to play.
      const selectedCardId = await promptUniqueActionFromHand(
        cardEffectArgs,
        'You may play an Action card you do not have in play',
        'conclave effect',
      );

      if (!selectedCardId) {
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
  'imp': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +2 Cards.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      // Prompt the player to choose a unique Action card to play.
      const selectedCardId = await promptUniqueActionFromHand(
        cardEffectArgs,
        'You may play an Action card you do not have in play',
        'imp effect',
      );

      if (!selectedCardId) {
        return;
      }

      // Play the chosen Action card.
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      console.debug(`[imp effect] playing ${selectedCard}`);
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'crypt': {
    registerEffects: () => async (cardEffectArgs) => {

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
  'cursed-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.info(`[cursed-village onGained] resolving for player ${eventArgs.playerId}`);

        // Cursed Village forces the gaining player to receive a Hex.
        await cardEffectArgs.runGameActionDelegate('receiveHex', {
          playerId: eventArgs.playerId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +2 Actions.
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });

      // Draw one at a time so triggered draws are accounted for before checking again.
      let hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      console.debug(`[cursed-village effect] starting draw loop at ${hand.length} card(s) in hand`);

      while (hand.length < 6) {
        console.debug('[cursed-village effect] drawing 1 card to reach 6 in hand');
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 1,
        });

        hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        console.debug(`[cursed-village effect] hand now has ${hand.length} card(s)`);
      }
    },
  },
  'den-of-sin': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.info(`[den-of-sin onGained] resolving for player ${eventArgs.playerId}`);

        // Only move to hand if it was gained to the player's discard pile.
        const source = cardEffectArgs.cardSourceController.findCardSource(eventArgs.cardId);
        if (source.sourceKey !== 'playerDiscard' || source.playerId !== eventArgs.playerId) {
          console.debug('[den-of-sin onGained] not in discard pile, skipping move to hand');
          return;
        }

        console.debug('[den-of-sin onGained] moving gained card from discard to hand');
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: {
            location: 'playerHand',
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {

      const denOfSinCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Register the start-of-next-turn draw effect.
      cardEffectArgs.registerDurationEffect(denOfSinCard, {
        id: `den-of-sin:${denOfSinCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(`[den-of-sin startTurn] resolving for player ${cardEffectArgs.playerId}`);

          // Apply the +2 Cards at the start of the next turn.
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          });
        },
      });
    },
  },
  'ghost-town': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.info(`[ghost-town onGained] resolving for player ${eventArgs.playerId}`);

        console.debug('[ghost-town onGained] moving gained card from discard to hand');
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: {
            location: 'playerHand',
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {

      const ghostTownCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Register the start-of-next-turn +1 Card/+1 Action.
      cardEffectArgs.registerDurationEffect(ghostTownCard, {
        id: `ghost-town:${ghostTownCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(`[ghost-town startTurn] resolving for player ${cardEffectArgs.playerId}`);

          // Apply +1 Card.
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });

          // Apply +1 Action.
          await triggeredArgs.runGameActionDelegate('gainAction', {
            count: 1,
          });
        },
      });
    },
  },
  'devils-workshop': {
    registerEffects: () => async (cardEffectArgs) => {

      // Count the cards this player has gained this turn.
      const gainedThisTurn = cardEffectArgs.match.stats.cardsGainedByTurn[cardEffectArgs.match.turnNumber] ?? [];
      const gainedCount = gainedThisTurn.filter(cardId =>
        cardEffectArgs.match.stats.cardsGained[cardId]?.playerId === cardEffectArgs.playerId
      ).length;

      console.debug(`[devils-workshop effect] player gained ${gainedCount} card(s) this turn`);

      if (gainedCount >= 2) {
        // Gain an Imp from the non-supply pile.
        const impCards = cardEffectArgs.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'imp' },
        ]);

        if (!impCards.length) {
          console.warn('[devils-workshop effect] no Imp cards available to gain');
          return;
        }

        const impCardId = impCards.slice(-1)[0].id;
        console.debug(`[devils-workshop effect] gaining Imp ${impCardId}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: impCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      if (gainedCount === 1) {
        // Gain a card costing up to $4 from the supply.
        const eligibleCards = cardEffectArgs.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
        ]);

        if (!eligibleCards.length) {
          console.debug('[devils-workshop effect] no eligible cards in supply to gain');
          return;
        }

        const gainCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          prompt: 'Gain a card costing up to $4',
          playerId: cardEffectArgs.playerId,
          count: 1,
          restrict: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
          ],
        }) as CardId[];

        const gainCardId = gainCardIds[0];
        if (!gainCardId) {
          console.debug('[devils-workshop effect] no card selected to gain');
          return;
        }

        console.debug(`[devils-workshop effect] gaining ${cardEffectArgs.cardLibrary.getCard(gainCardId)}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: gainCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      // Gain a Gold if no cards were gained previously this turn.
      const goldCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'gold' },
      ]);

      if (!goldCards.length) {
        console.warn('[devils-workshop effect] no Gold cards available to gain');
        return;
      }

      const goldCardId = goldCards.slice(-1)[0].id;
      console.debug(`[devils-workshop effect] gaining Gold ${goldCardId}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: goldCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'druid': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +1 Buy.
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });

      const setAsideBoons = cardEffectArgs.match.boons?.setAside ?? [];
      if (!setAsideBoons.length) {
        console.warn('[druid effect] no set-aside boons available');
        return;
      }

      console.debug(`[druid effect] selecting from ${setAsideBoons.length} set-aside boon(s)`);
      const selectionResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a boon to receive',
        content: {
          type: 'select',
          cardIds: [],
          cardLikeIds: setAsideBoons,
          selectCount: 1,
        },
      }) as { result?: CardLikeId[] };

      const selectedBoonId = selectionResult?.result?.[0] ?? setAsideBoons[0];
      if (!selectedBoonId) {
        console.warn('[druid effect] no boon selected to receive');
        return;
      }

      console.debug(`[druid effect] receiving boon ${selectedBoonId}`);
      await cardEffectArgs.runGameActionDelegate('receiveBoon', {
        playerId: cardEffectArgs.playerId,
        boonId: selectedBoonId,
        immediate: true,
        keepSetAside: true,
      });
    },
  },
  'exorcist': {
    registerEffects: () => async (cardEffectArgs) => {

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        console.debug('[exorcist effect] no cards in hand to trash');
        return;
      }

      const selectedIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        prompt: 'Trash a card from your hand',
        playerId: cardEffectArgs.playerId,
        count: 1,
        restrict: hand,
      }) as CardId[];

      const trashedCardId = selectedIds[0];
      if (!trashedCardId) {
        console.debug('[exorcist effect] no card selected to trash');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(trashedCardId);
      const trashedCost = cardEffectArgs.cardPriceController.applyRules(trashedCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;

      console.debug(`[exorcist effect] trashing ${trashedCard}`);
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: trashedCardId,
      });

      const spiritCards = cardEffectArgs.findCards([
        { location: 'nonSupplyCards' },
        { cardType: ['SPIRIT'] },
      ]);

      if (!spiritCards.length) {
        console.warn('[exorcist effect] no Spirit cards available to gain');
        return;
      }

      const eligibleSpirits = spiritCards.filter(spirit => {
        const spiritCost = cardEffectArgs.cardPriceController.applyRules(spirit, {
          playerId: cardEffectArgs.playerId,
        }).cost;
        return compareCardCosts(spiritCost, trashedCost) === -1;
      });

      if (!eligibleSpirits.length) {
        console.debug('[exorcist effect] no cheaper Spirit available to gain');
        return;
      }

      const eligibleIds = eligibleSpirits.map(spirit => spirit.id);
      const gainIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        prompt: 'Gain a cheaper Spirit',
        playerId: cardEffectArgs.playerId,
        count: 1,
        restrict: eligibleIds,
      }) as CardId[];

      const gainId = gainIds[0];
      if (!gainId) {
        console.debug('[exorcist effect] no Spirit selected to gain');
        return;
      }

      console.debug(`[exorcist effect] gaining ${cardEffectArgs.cardLibrary.getCard(gainId)}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: gainId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'fool': {
    registerEffects: () => async (cardEffectArgs) => {

      // Check current Lost in the Woods ownership to decide whether to resolve Fool.
      const lostInTheWoods = cardEffectArgs.match.states?.cards?.find(state => state.cardKey === 'lost-in-the-woods');
      let currentOwnerId: number | undefined;
      if (lostInTheWoods) {
        for (const [playerId, stateIds] of Object.entries(cardEffectArgs.match.states?.byPlayer ?? {})) {
          if (stateIds.includes(lostInTheWoods.id)) {
            currentOwnerId = Number(playerId);
            break;
          }
        }
      }

      if (currentOwnerId === cardEffectArgs.playerId) {
        console.debug('[fool effect] player already has Lost in the Woods, skipping');
        return;
      }

      if (lostInTheWoods) {
        console.debug('[fool effect] taking Lost in the Woods');
        await cardEffectArgs.runGameActionDelegate('gainState', {
          playerId: cardEffectArgs.playerId,
          stateId: lostInTheWoods.id,
        });
      }
      else {
        console.warn('[fool effect] Lost in the Woods state not found');
      }

      const boons = cardEffectArgs.match.boons;
      if (!boons || boons.cards.length < 1) {
        console.warn('[fool effect] no boons configured for this match');
        return;
      }

      // Draw up to three boons from the shared boon deck.
      const boonsToReceive: CardLikeId[] = [];
      for (let index = 0; index < 3; index++) {
        if (boons.deck.length < 1 && boons.discard.length > 0) {
          console.debug('[fool effect] boon deck empty, reshuffling discard');
          boons.deck = fisherYatesShuffle(boons.discard, false);
          boons.discard = [];
        }

        const boonId = boons.deck.pop();
        if (boonId === undefined) {
          console.warn('[fool effect] boon deck empty, stopping early');
          break;
        }
        boonsToReceive.push(boonId);
      }

      if (!boonsToReceive.length) {
        console.warn('[fool effect] no boons available to receive');
        return;
      }

      // Prompt the player to choose the order to receive the boons.
      while (boonsToReceive.length > 0) {
        let chosenBoonId = boonsToReceive[0];
        if (boonsToReceive.length > 1) {
          const selectionResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Choose a Boon to receive',
            content: {
              type: 'select',
              cardIds: [],
              cardLikeIds: boonsToReceive,
              selectCount: 1,
            },
          }) as { result?: CardLikeId[] };

          chosenBoonId = selectionResult?.result?.[0] ?? boonsToReceive[0];
        }

        const chosenIndex = boonsToReceive.indexOf(chosenBoonId);
        if (chosenIndex !== -1) {
          boonsToReceive.splice(chosenIndex, 1);
        }

        console.debug(`[fool effect] receiving boon ${chosenBoonId}`);
        await cardEffectArgs.runGameActionDelegate('receiveBoon', {
          playerId: cardEffectArgs.playerId,
          boonId: chosenBoonId,
          immediate: true,
        });
      }
    },
  },
  'faithful-hound': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        // Faithful Hound does nothing if discarded during cleanup.
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          console.debug('[faithful-hound onDiscarded] discard during cleanup, skipping');
          return;
        }

        // Prompt the owner to set it aside for end-of-turn return.
        const faithfulHound = args.cardLibrary.getCard(eventArgs.cardId);
        console.info(`[faithful-hound onDiscarded] resolving for ${faithfulHound}`);

        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Set Faithful Hound aside?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 },
            { label: 'SET ASIDE', action: 2 },
          ],
        }) as { action: number };

        if (result.action === 1) {
          console.debug('[faithful-hound onDiscarded] player declined to set aside');
          return;
        }

        // Set the card aside on the owner's mat.
        console.debug(`[faithful-hound onDiscarded] setting aside ${faithfulHound}`);
        await args.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'set-aside' },
        });

        // Return it to hand at the end of the current turn.
        const discardTurnNumber = args.match.turnNumber;
        args.reactionManager.registerReactionTemplate(
          faithfulHound,
          'endTurn',
          {
            playerId: eventArgs.playerId,
            once: true,
            allowMultipleInstances: true,
            compulsory: true,
            condition: (conditionArgs) => conditionArgs.trigger.args.turnNumber === discardTurnNumber,
            triggeredEffectFn: async (triggeredArgs) => {
              console.debug(`[faithful-hound endTurn] moving ${faithfulHound} to hand`);
              await triggeredArgs.runGameActionDelegate('moveCard', {
                cardId: eventArgs.cardId,
                toPlayerId: eventArgs.playerId,
                to: { location: 'playerHand' },
              });
            },
          },
        );
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +2 Cards.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'lucky-coin': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$1.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });

      const silverCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'silver' },
      ]);

      if (!silverCards.length) {
        console.debug('[lucky-coin effect] no Silver cards available to gain');
        return;
      }

      const silverCardId = silverCards.slice(-1)[0].id;
      console.debug(`[lucky-coin effect] gaining ${cardEffectArgs.cardLibrary.getCard(silverCardId)}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: silverCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'ghost': {
    registerEffects: () => async (cardEffectArgs) => {

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

      // Haunted Mirror is a $1 Treasure.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
    },
  },
  "will-o-wisp": {
    registerEffects: () => async (cardEffectArgs) => {

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
