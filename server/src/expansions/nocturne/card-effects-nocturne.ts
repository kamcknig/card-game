import { CardEffectFunctionContext, CardExpansionModule } from '../../types.ts';
import { CardId, CardLikeId } from 'shared/shared-types';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { compareCardCosts } from 'shared/compare-card-cost.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { isPlayerImmune, markPlayerImmune } from '../../utils/reaction-immunity.ts';

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
  'bat': {
    registerEffects: () => async (cardEffectArgs) => {

      // Gather cards in hand for trashing.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        console.debug('[bat effect] no cards in hand to trash');
        return;
      }

      const maxTrashCount = Math.min(2, hand.length);
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash up to 2 cards from your hand',
        count: { kind: 'upTo', count: maxTrashCount },
        restrict: hand,
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug('[bat effect] no cards selected to trash');
        return;
      }

      for (const cardId of selectedCardIds) {
        console.debug(`[bat effect] trashing ${cardEffectArgs.cardLibrary.getCard(cardId)}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      // Exchange Bat for a Vampire if available and pile exists.
      const batPileExists = cardEffectArgs.match.config.nonSupply?.some(supply => supply.name === 'bat');
      if (!batPileExists) {
        console.warn('[bat effect] bat pile not configured, skipping exchange');
        return;
      }

      const vampireCards = cardEffectArgs.findCards([
        { location: 'kingdomSupply' },
        { cardKeys: 'vampire' },
      ]);

      if (!vampireCards.length) {
        console.debug('[bat effect] no Vampire cards available to exchange');
        return;
      }

      const vampireCard = vampireCards.slice(-1)[0];
      console.debug(`[bat effect] exchanging for ${vampireCard}`);
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' },
      });
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: vampireCard.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'blessed-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {

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
  'guardian': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.debug('[guardian onGained] moving gained card from discard to hand');
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: {
            location: 'playerHand',
          },
        });
      },
      onLeavePlay: async (cardEffectArgs, eventArgs) => {
        // Remove the attack-immunity trigger when Guardian leaves play.
        cardEffectArgs.reactionManager.unregisterTrigger(`guardian:${eventArgs.cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      // Register Guardian immunity against attacks until the next turn.
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `guardian:${cardEffectArgs.cardId}:cardPlayed`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'cardPlayed',
        condition: ({ trigger, cardLibrary }) => {
          const playedCard = cardLibrary.getCard(trigger.args.cardId!);
          return trigger.args.playerId !== cardEffectArgs.playerId
            && playedCard.type.includes('ATTACK');
        },
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        triggeredEffectFn: async ({ reactionContext }) => {
          console.debug(`[guardian reaction] granting immunity to player ${cardEffectArgs.playerId}`);
          // Record immunity so downstream attacks skip this player.
          markPlayerImmune(cardEffectArgs.playerId, reactionContext);
        },
      });

      const guardianCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Keep the duration card active through cleanup and apply next-turn bonus.
      cardEffectArgs.registerDurationEffect(guardianCard, {
        id: `guardian:${guardianCard.id}:startTurn`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'startTurn',
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        autoResolve: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          // Return Guardian to the play area before resolving its next-turn effect.
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: guardianCard.id,
            to: { location: 'playArea' },
          });

          // Stop granting immunity after the start of the next turn.
          cardEffectArgs.reactionManager.unregisterTrigger(`guardian:${guardianCard.id}:cardPlayed`);

          // Apply the +$1 at the start of the next turn.
          await triggeredArgs.runGameActionDelegate('gainTreasure', {
            count: 1,
          }, { loggingContext: { source: guardianCard.id } });
        },
      });
    },
  },
  'idol': {
    registerEffects: () => async (cardEffectArgs) => {
      // Apply the immediate +$2.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      // Count Idols in play for the current player (including this one).
      const idolsInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.cardKey === 'idol'
          && cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const idolCount = idolsInPlay.length;
      const isOdd = idolCount % 2 === 1;

      console.debug(`[idol effect] player has ${idolCount} Idol(s) in play (odd=${isOdd})`);

      if (isOdd) {
        // Receive a boon when the count is odd.
        await cardEffectArgs.runGameActionDelegate('receiveBoon', {
          playerId: cardEffectArgs.playerId,
        });
        return;
      }

      // Otherwise, each other player gains a Curse (respecting immunity).
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      console.debug(`[idol effect] curse targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`);

      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' },
        ]);
        if (!curseCards.length) {
          console.debug('[idol effect] no curse cards in supply');
          return;
        }

        const curseCardId = curseCards.slice(-1)[0].id;
        console.debug(`[idol effect] giving curse to ${getPlayerById(cardEffectArgs.match, targetPlayerId)}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCardId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'leprechaun': {
    registerEffects: () => async (cardEffectArgs) => {
      // Gain a Gold first.
      const goldCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'gold' },
      ]);

      if (!goldCards.length) {
        console.debug('[leprechaun effect] no Gold cards in supply');
      }
      else {
        const goldCardId = goldCards.slice(-1)[0].id;
        console.debug(`[leprechaun effect] gaining Gold ${cardEffectArgs.cardLibrary.getCard(goldCardId)}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCardId,
          to: { location: 'playerDiscard' },
        });
      }

      // Count cards in play after the Gold gain resolves.
      const cardsInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const inPlayCount = cardsInPlay.length;

      console.debug(`[leprechaun effect] player has ${inPlayCount} card(s) in play`);

      if (inPlayCount === 7) {
        // Gain a Wish when the count is exactly 7.
        const wishCards = cardEffectArgs.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'wish' },
        ]);

        if (!wishCards.length) {
          console.warn('[leprechaun effect] no Wish cards available to gain');
          return;
        }

        const wishCardId = wishCards.slice(-1)[0].id;
        console.debug(`[leprechaun effect] gaining Wish ${cardEffectArgs.cardLibrary.getCard(wishCardId)}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: wishCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      // Otherwise, receive a Hex.
      await cardEffectArgs.runGameActionDelegate('receiveHex', {
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  'monastery': {
    registerEffects: () => async (cardEffectArgs) => {
      // Count cards gained earlier this turn (do not update during trashing).
      const gainedThisTurn = cardEffectArgs.match.stats.cardsGainedByTurn[cardEffectArgs.match.turnNumber] ?? [];
      const gainedCount = gainedThisTurn.filter(cardId =>
        cardEffectArgs.match.stats.cardsGained[cardId]?.playerId === cardEffectArgs.playerId
      ).length;

      console.debug(`[monastery effect] player gained ${gainedCount} card(s) earlier this turn`);

      if (gainedCount < 1) {
        return;
      }

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const copperInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.cardKey === 'copper'
          && cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId)
        .map(card => card.id);

      const eligibleIds = [...hand, ...copperInPlay];
      if (!eligibleIds.length) {
        console.debug('[monastery effect] no eligible cards to trash');
        return;
      }

      const maxTrashCount = Math.min(gainedCount, eligibleIds.length);
      const selectedIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        prompt: 'Trash cards from your hand or Coppers in play',
        playerId: cardEffectArgs.playerId,
        count: { kind: 'upTo', count: maxTrashCount },
        optional: true,
        restrict: eligibleIds,
      }) as CardId[];

      if (!selectedIds.length) {
        console.debug('[monastery effect] player declined to trash');
        return;
      }

      for (const selectedId of selectedIds) {
        console.debug(`[monastery effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedId)}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedId,
        });
      }
    },
  },
  'pooka': {
    registerEffects: () => async (cardEffectArgs) => {

      // Gather Treasures in hand excluding Cursed Gold.
      const treasuresInHand = cardEffectArgs.findCards([
        { location: 'playerHand', playerId: cardEffectArgs.playerId },
        { cardType: ['TREASURE'] },
      ]).filter(card => card.cardKey !== 'cursed-gold');

      if (!treasuresInHand.length) {
        console.debug('[pooka effect] no eligible Treasures to trash');
        return;
      }

      // Prompt the player to optionally trash a Treasure for +4 Cards.
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a Treasure to draw 4 cards?',
        count: 1,
        optional: true,
        restrict: treasuresInHand.map(card => card.id),
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (!selectedCardId) {
        console.debug('[pooka effect] player declined to trash a Treasure');
        return;
      }

      console.debug(`[pooka effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Draw 4 cards after trashing.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 4,
      });
    },
  },
  'raider': {
    registerEffects: () => async (cardEffectArgs) => {

      // Determine the card keys currently in play for the Raider's owner.
      const inPlayCards = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const inPlayKeys = new Set(inPlayCards.map(card => card.cardKey));

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      console.debug(`[raider effect] targeting ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.findCards({ location: 'playerHand', playerId: targetPlayerId });

        if (hand.length < 5) {
          console.debug(`[raider effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} has ${hand.length} cards, skipping`);
          continue;
        }

        const eligibleIds = hand.filter(card => inPlayKeys.has(card.cardKey)).map(card => card.id);

        if (!eligibleIds.length) {
          console.debug(`[raider effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} cannot discard, revealing hand`);
          for (const card of hand) {
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              playerId: targetPlayerId,
              cardId: card.id,
            });
          }
          continue;
        }

        let discardId = eligibleIds[0];
        if (eligibleIds.length > 1) {
          const selectedIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: 'Discard a copy of a card in play',
            count: 1,
            autoSelect: true,
            restrict: eligibleIds,
          }) as CardId[];
          discardId = selectedIds[0];
        }

        if (!discardId) {
          console.warn(`[raider effect] no card selected for ${getPlayerById(cardEffectArgs.match, targetPlayerId)}`);
          continue;
        }

        console.debug(`[raider effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} discarding ${cardEffectArgs.cardLibrary.getCard(discardId)}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: targetPlayerId,
          cardId: discardId,
        });
      }

      const raiderCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Register the start-of-next-turn +$3.
      cardEffectArgs.registerDurationEffect(raiderCard, {
        id: `raider:${raiderCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.runGameActionDelegate('gainTreasure', {
            count: 3,
          }, { loggingContext: { source: raiderCard.id } });
        },
      });
    },
  },
  'sacred-grove': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +1 Buy and +$3.
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 3 });

      // Receive a boon and determine whether it grants +$1.
      const boonId = await cardEffectArgs.runGameActionDelegate('receiveBoon', {
        playerId: cardEffectArgs.playerId,
      });

      if (!boonId) {
        console.debug('[sacred-grove effect] no boon received');
        return;
      }

      const boon = cardEffectArgs.match.boons?.cards?.find(candidate => candidate.id === boonId);
      if (!boon) {
        console.warn(`[sacred-grove effect] boon ${boonId} not found in match`);
        return;
      }

      // Only share boons that do not grant +$1 (Field's Gift, Forest's Gift are excluded).
      const grantsTreasure = new Set(['the-fields-gift', 'the-forests-gift']);
      if (grantsTreasure.has(boon.cardKey)) {
        console.debug('[sacred-grove effect] boon grants +$1, not sharing');
        return;
      }

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      });

      for (const targetPlayerId of targetPlayerIds) {
        const decision = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: targetPlayerId,
          prompt: `Receive ${boon.cardName}?\n\n${boon.abilityText}`,
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
          content: {
            type: 'display-cards',
            cardIds: [],
            cardLikeIds: [boonId],
          },
        }) as { action: number };

        if (decision.action !== 2) {
          console.debug(`[sacred-grove effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} declined`);
          continue;
        }

        await cardEffectArgs.runGameActionDelegate('receiveBoon', {
          playerId: targetPlayerId,
          immediate: true,
          boonId: boonId,
        });
      }
    },
  },
  'shepherd': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +1 Action.
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      const victoryCards = cardEffectArgs.findCards([
        { location: 'playerHand', playerId: cardEffectArgs.playerId },
        { cardType: ['VICTORY'] },
      ]);

      if (!victoryCards.length) {
        console.debug('[shepherd effect] no Victory cards in hand to discard');
        return;
      }

      // Prompt the player to discard any number of Victory cards.
      const selectedIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard any number of Victory cards',
        count: { kind: 'upTo', count: victoryCards.length },
        optional: true,
        restrict: victoryCards.map(card => card.id),
      }) as CardId[];

      if (!selectedIds.length) {
        console.debug('[shepherd effect] player declined to discard Victory cards');
        return;
      }

      console.debug(`[shepherd effect] revealing and discarding ${selectedIds.length} card(s)`);
      for (const cardId of selectedIds) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      // Draw 2 cards per discarded Victory card.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: selectedIds.length * 2,
      });
    },
  },
  'skulk': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {

        // Gain a Gold when Skulk is gained.
        const goldCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'gold' },
        ]);

        if (!goldCards.length) {
          console.debug('[skulk onGained] no Gold cards available to gain');
          return;
        }

        const goldCardId = goldCards.slice(-1)[0].id;
        console.debug(`[skulk onGained] gaining Gold ${cardEffectArgs.cardLibrary.getCard(goldCardId)}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: goldCardId,
          to: { location: 'playerDiscard' },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +1 Buy.
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      console.debug(`[skulk effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`);

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.runGameActionDelegate('receiveHex', {
          playerId: targetPlayerId,
        });
      }
    },
  },
  'tracker': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$1.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });

      // Ensure only one tracker gain trigger is active per player per turn.
      const gainTriggerId = `tracker:${cardEffectArgs.playerId}:cardGained`;
      cardEffectArgs.reactionManager.unregisterTrigger(gainTriggerId);

      // Register a gain trigger for the rest of the turn.
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: gainTriggerId,
        listeningFor: 'cardGained',
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

          const decision = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: `Put ${gainedCard.cardName} onto your deck?`,
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
          }) as { action: number };

          if (decision.action !== 2) {
            console.debug('[tracker effect] player declined to topdeck gained card');
            return;
          }

          console.debug(`[tracker effect] moving ${gainedCard} to top of deck`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: gainedCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });

      // Unregister the gain trigger at end of turn.
      const trackerCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;
      cardEffectArgs.reactionManager.registerSystemTemplate(trackerCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId
          && conditionArgs.trigger.args.turnNumber === turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.reactionManager.unregisterTrigger(gainTriggerId);
          console.debug('[tracker effect] end turn cleanup, removed gain trigger');
        },
      });

      // Receive a boon after setting up the gain trigger.
      await cardEffectArgs.runGameActionDelegate('receiveBoon', {
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  'tragic-hero': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +3 Cards and +1 Buy.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      console.debug(`[tragic-hero effect] hand size after draw: ${hand.length}`);

      if (hand.length < 8) {
        return;
      }

      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });

      const treasureCards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardType: 'TREASURE' },
      ]);

      if (!treasureCards.length) {
        console.debug('[tragic-hero effect] no Treasure cards available to gain');
        return;
      }

      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a Treasure',
        count: 1,
        restrict: treasureCards.map(card => card.id),
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (!selectedCardId) {
        console.debug('[tragic-hero effect] no Treasure selected');
        return;
      }

      console.debug(`[tragic-hero effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'vampire': {
    registerEffects: () => async (cardEffectArgs) => {

      // Each other player receives a Hex (respecting immunity).
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      console.debug(`[vampire effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`);

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.runGameActionDelegate('receiveHex', {
          playerId: targetPlayerId,
        });
      }

      // Gain a card costing up to $5 other than a Vampire.
      const eligibleCards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 5 } },
      ]).filter(card => card.cardKey !== 'vampire');

      if (!eligibleCards.length) {
        console.debug('[vampire effect] no eligible cards to gain');
      }
      else {
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain a card costing up to $5 (not Vampire)',
          count: 1,
          restrict: eligibleCards.map(card => card.id),
        }) as CardId[];

        const selectedCardId = selectedCardIds[0];
        if (selectedCardId) {
          console.debug(`[vampire effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            to: { location: 'playerDiscard' },
          });
        }
        else {
          console.debug('[vampire effect] no card selected to gain');
        }
      }

      // Exchange Vampire for a Bat if possible.
      const batCards = cardEffectArgs.findCards([
        { location: 'nonSupplyCards' },
        { cardKeys: 'bat' },
      ]);

      if (!batCards.length) {
        console.debug('[vampire effect] no Bat cards available to exchange');
        return;
      }

      const pileKey = getCardPileKey(cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId));
      const inKingdomSupply = cardEffectArgs.match.config.kingdomSupply.some(supply =>
        supply.cards.some(card => getCardPileKey(card) === pileKey)
      );
      const inBasicSupply = cardEffectArgs.match.config.basicSupply.some(supply =>
        supply.cards.some(card => getCardPileKey(card) === pileKey)
      );

      if (!inKingdomSupply && !inBasicSupply) {
        console.warn('[vampire effect] vampire pile not found in match config, skipping exchange');
        return;
      }

      try {
        cardEffectArgs.cardSourceController.findCardSource(cardEffectArgs.cardId);
      }
      catch (error) {
        console.warn('[vampire effect] vampire source not found, skipping exchange');
        return;
      }

      const returnLocation = inBasicSupply ? 'basicSupply' : 'kingdomSupply';
      const batCard = batCards.slice(-1)[0];

      console.debug(`[vampire effect] exchanging for ${batCard}`);
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: returnLocation },
      });
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: batCard.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'tormentor': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$2.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

      const cardsInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const otherCardsInPlay = cardsInPlay.filter(card => card.id !== cardEffectArgs.cardId);

      console.debug(`[tormentor effect] other cards in play: ${otherCardsInPlay.length}`);

      if (!otherCardsInPlay.length) {
        const impCards = cardEffectArgs.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'imp' },
        ]);

        if (!impCards.length) {
          console.warn('[tormentor effect] no Imp cards available to gain');
          return;
        }

        const impCardId = impCards.slice(-1)[0].id;
        console.debug(`[tormentor effect] gaining Imp ${cardEffectArgs.cardLibrary.getCard(impCardId)}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: impCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      }).filter((id) => !isPlayerImmune(cardEffectArgs.reactionContext, id));

      console.debug(`[tormentor effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`);

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.runGameActionDelegate('receiveHex', {
          playerId: targetPlayerId,
        });
      }
    },
  },
  'secret-cave': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the cantrip bonus.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        console.debug('[secret-cave effect] no cards in hand to discard');
        return;
      }

      const decision = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard 3 cards?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }) as { action: number };

      if (decision.action !== 2) {
        console.debug('[secret-cave effect] player chose not to discard');
        return;
      }

      let discardIds: CardId[];
      if (hand.length <= 3) {
        // When fewer than 3 cards in hand, discard all of them.
        discardIds = [...hand];
      } else {
        discardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Discard 3 cards',
          count: 3,
          restrict: hand,
        }) as CardId[];
      }

      if (!discardIds.length) {
        console.warn('[secret-cave effect] no cards selected to discard after confirming');
        return;
      }

      console.debug(`[secret-cave effect] discarding ${discardIds.length} card(s)`);
      for (const cardId of discardIds) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      if (discardIds.length < 3) {
        console.debug('[secret-cave effect] discarded fewer than 3 cards, skipping duration bonus');
        return;
      }

      const secretCaveCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnPlayed = cardEffectArgs.match.turnNumber;

      // Register the start-of-next-turn +$3 if 3 cards were discarded.
      cardEffectArgs.registerDurationEffect(secretCaveCard, {
        id: `secret-cave:${secretCaveCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId
          && trigger.args.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.runGameActionDelegate('gainTreasure', {
            count: 3,
          }, { loggingContext: { source: secretCaveCard.id } });
        },
      });
    },
  },
  'pixie': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the cantrip bonus.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      if (!cardEffectArgs.match.boons) {
        console.warn('[pixie effect] no boons configured');
        return;
      }

      if (cardEffectArgs.match.boons.cards.length < 1) {
        console.warn('[pixie effect] boon list empty');
        return;
      }

      if (cardEffectArgs.match.boons.deck.length < 1 && cardEffectArgs.match.boons.discard.length > 0) {
        console.debug('[pixie effect] boon deck empty, reshuffling discard');
        await cardEffectArgs.runGameActionDelegate('shuffleCardLike', {
          kind: 'boon',
          includeDiscard: true,
        });
      }

      if (cardEffectArgs.match.boons.deck.length < 1) {
        console.debug('[pixie effect] no boons available to discard');
        return;
      }

      // Discard the top boon without receiving its effect.
      const boonId = cardEffectArgs.match.boons.deck.pop();
      if (boonId === undefined) {
        console.warn('[pixie effect] boon draw failed');
        return;
      }

      const boon = cardEffectArgs.match.boons.cards.find(candidate => candidate.id === boonId);
      if (!boon) {
        console.warn(`[pixie effect] missing boon ${boonId}, discarding id only`);
        cardEffectArgs.match.boons.discard.push(boonId);
        return;
      }

      cardEffectArgs.match.boons.discard.push(boonId);
      console.debug(`[pixie effect] discarded ${boon}`);

      // Prompt to trash Pixie to receive the discarded boon twice.
      const decision = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash Pixie to receive ${boon.cardName} twice?`,
        actionButtons: [
          { label: `DON'T TRASH`, action: 1 },
          { label: 'TRASH', action: 2 },
        ],
        content: {
          type: 'display-cards',
          cardIds: [],
          cardLikeIds: [boonId],
        },
      }) as { action: number };

      if (decision.action !== 2) {
        console.debug('[pixie effect] player declined to trash Pixie');
        return;
      }

      console.debug('[pixie effect] trashing Pixie to receive boon twice');
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });

      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.runGameActionDelegate('receiveBoon', {
          playerId: cardEffectArgs.playerId,
          immediate: true,
          boonId: boonId,
        });
      }
    },
  },
  'night-watchman': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        console.debug('[night-watchman onGained] moving gained Night Watchman to hand');
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'playerHand' },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      // Resolve the top 5 cards of the deck (shuffling if needed).
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      let numToLookAt = 5;
      if (deck.length + discard.length < numToLookAt) {
        numToLookAt = deck.length + discard.length;
        console.debug(`[night-watchman effect] adjusting look count to ${numToLookAt}`);
      }

      if (numToLookAt === 0) {
        console.debug('[night-watchman effect] no cards to look at');
        return;
      }

      if (deck.length < numToLookAt) {
        console.debug('[night-watchman effect] deck short, shuffling discard');
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      const cardsToLookAt = deck.slice(-numToLookAt);
      console.debug(`[night-watchman effect] looking at ${cardsToLookAt.length} card(s)`);

      // Prompt the player to discard any number of the looked-at cards.
      const discardResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose card/s to discard?',
        validationAction: 1,
        actionButtons: [
          { label: `DON'T DISCARD`, action: 2 },
          { label: 'DISCARD', action: 1 },
        ],
        content: {
          type: 'select',
          cardIds: cardsToLookAt,
          selectCount: {
            kind: 'upTo',
            count: cardsToLookAt.length,
          },
        },
      }) as { action: number; result: CardId[] };

      const cardsToDiscard = discardResult.action === 1 ? (discardResult.result ?? []) : [];
      if (!cardsToDiscard.length) {
        console.debug('[night-watchman effect] no cards selected to discard');
      }
      else {
        console.debug(`[night-watchman effect] discarding ${cardsToDiscard.length} card(s)`);
        for (const cardId of cardsToDiscard) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardId,
          });
        }
      }

      const remainingCards = cardsToLookAt.filter(cardId => !cardsToDiscard.includes(cardId));
      if (remainingCards.length <= 1) {
        console.debug('[night-watchman effect] no reorder needed');
        return;
      }

      // Prompt the player to reorder the remaining cards.
      const reorderResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put the rest back on top of your deck in any order',
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        content: {
          type: 'rearrange',
          cardIds: remainingCards,
        }
      }) as { action: number; result: CardId[] };

      for (const cardId of reorderResult.result) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'necromancer': {
    registerEffects: () => async (cardEffectArgs) => {

      // Identify face-up non-Duration Action cards in the trash.
      const trashCards = cardEffectArgs.findCards({ location: 'trash' });
      const eligibleCards = trashCards.filter(card =>
        card.type.includes('ACTION')
        && !card.type.includes('DURATION')
        && card.facing !== 'back',
      );

      if (!eligibleCards.length) {
        console.debug('[necromancer effect] no eligible Action cards in trash');
        return;
      }

      // Prompt the player to choose a trashed Action to play.
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a trashed Action to play',
        count: 1,
        restrict: eligibleCards.map(card => card.id),
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (!selectedCardId) {
        console.debug('[necromancer effect] no card selected');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      console.debug(`[necromancer effect] selected ${selectedCard}`);

      // Turn the selected card face down for the turn to prevent reuse.
      selectedCard.facing = 'back';
      console.debug(`[necromancer effect] turned ${selectedCard} face down`);

      // Flip the card back face up at end of turn.
      const turnNumber = cardEffectArgs.match.turnNumber;
      cardEffectArgs.reactionManager.registerReactionTemplate(selectedCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => conditionArgs.trigger.args.turnNumber === turnNumber,
        triggeredEffectFn: async (triggeredArgs) => {
          const faceUpCard = triggeredArgs.cardLibrary.getCard(selectedCardId);
          faceUpCard.facing = 'front';
          console.debug(`[necromancer endTurn] turned ${faceUpCard} face up`);
        },
      });

      // Play the trashed card without moving it or spending an Action.
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        overrides: {
          moveCard: false,
          actionCost: 0,
        },
      });
    },
  },
  'zombie-apprentice': {
    registerEffects: () => async (cardEffectArgs) => {

      // Gather Action cards in hand for the optional trash.
      const actionCards = cardEffectArgs.findCards([
        { location: 'playerHand', playerId: cardEffectArgs.playerId },
        { cardType: ['ACTION'] },
      ]);

      if (!actionCards.length) {
        console.debug('[zombie-apprentice effect] no Action cards in hand to trash');
        return;
      }

      // Prompt the player to optionally trash an Action for the bonus.
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash an Action for +3 Cards and +1 Action',
        count: 1,
        optional: true,
        restrict: actionCards.map(card => card.id),
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (!selectedCardId) {
        console.debug('[zombie-apprentice effect] player declined to trash an Action');
        return;
      }

      console.debug(`[zombie-apprentice effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Apply the bonus after trashing.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
    },
  },
  'zombie-mason': {
    registerEffects: () => async (cardEffectArgs) => {

      // Ensure there is at least one card to trash from the deck.
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      if (!deck.length && discard.length) {
        console.debug('[zombie-mason effect] deck empty, shuffling discard');
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      if (!deck.length) {
        console.debug('[zombie-mason effect] no cards in deck to trash');
        return;
      }

      const topCardId = deck.slice(-1)[0];
      const trashedCard = cardEffectArgs.cardLibrary.getCard(topCardId);
      console.debug(`[zombie-mason effect] trashing top card ${trashedCard}`);

      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: topCardId,
      });

      // Determine the maximum gain cost (up to $1 more than the trashed card).
      const { cost: trashedCost } = cardEffectArgs.cardPriceController.applyRules(trashedCard, {
        playerId: cardEffectArgs.playerId,
      });
      const maxCost = {
        treasure: trashedCost.treasure + 1,
        potion: trashedCost.potion ?? 0,
        debt: trashedCost.debt ?? 0,
      };

      const eligibleCards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: maxCost },
      ]);

      if (!eligibleCards.length) {
        console.debug('[zombie-mason effect] no cards available to gain');
        return;
      }

      // Prompt the player to optionally gain a card.
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $1 more',
        count: 1,
        optional: true,
        restrict: eligibleCards.map(card => card.id),
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (!selectedCardId) {
        console.debug('[zombie-mason effect] player declined to gain a card');
        return;
      }

      console.debug(`[zombie-mason effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'zombie-spy': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the cantrip bonus first.
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      // Ensure there is a top card to look at.
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      if (!deck.length && discard.length) {
        console.debug('[zombie-spy effect] deck empty, shuffling discard');
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      if (!deck.length) {
        console.debug('[zombie-spy effect] no cards left to look at');
        return;
      }

      const topCardId = deck.slice(-1)[0];
      const topCard = cardEffectArgs.cardLibrary.getCard(topCardId);
      console.debug(`[zombie-spy effect] looking at top card ${topCard}`);

      const decision = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard the top card?',
        actionButtons: [
          { label: 'DISCARD', action: 1 },
          { label: 'PUT BACK', action: 2 },
        ],
        content: {
          type: 'display-cards',
          cardIds: [topCardId],
        },
      }) as { action: number };

      if (decision.action === 1) {
        console.debug(`[zombie-spy effect] discarding ${topCard}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: topCardId,
        });
        return;
      }

      console.debug('[zombie-spy effect] leaving top card in place');
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
          await cardEffectArgs.runGameActionDelegate('shuffleCardLike', {
            kind: 'boon',
            includeDiscard: true,
          });
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
  'goat': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$1.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        console.debug('[goat effect] no cards in hand to trash');
        return;
      }

      // Prompt the player to optionally trash a card from hand.
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand?',
        count: 1,
        optional: true,
        restrict: hand,
      }) as CardId[];

      const selectedCardId = selectedCardIds[0];
      if (!selectedCardId) {
        console.debug('[goat effect] player declined to trash');
        return;
      }

      console.debug(`[goat effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'cursed-gold': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$3.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 3 });

      // Gain a Curse when played.
      const curseCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'curse' },
      ]);

      if (!curseCards.length) {
        console.debug('[cursed-gold effect] no Curses available to gain');
        return;
      }

      const curseCardId = curseCards.slice(-1)[0].id;
      console.debug(`[cursed-gold effect] gaining Curse ${cardEffectArgs.cardLibrary.getCard(curseCardId)}`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: curseCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'magic-lamp': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$1.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });

      // Count cards in play for this player with exactly one copy (including this).
      const cardsInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);

      const countsByKey: Record<string, number> = {};
      for (const card of cardsInPlay) {
        countsByKey[card.cardKey] = (countsByKey[card.cardKey] ?? 0) + 1;
      }

      const uniqueCount = Object.values(countsByKey).filter(count => count === 1).length;
      console.debug(`[magic-lamp effect] unique-in-play count ${uniqueCount}`);

      if (uniqueCount < 6) {
        return;
      }

      // Trash Magic Lamp to gain 3 Wishes.
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });
      console.debug('[magic-lamp effect] trashed Magic Lamp, gaining 3 Wishes');

      for (let i = 0; i < 3; i++) {
        const wishCards = cardEffectArgs.findCards([
          { location: 'nonSupplyCards' },
          { cardKeys: 'wish' },
        ]);

        if (!wishCards.length) {
          console.warn('[magic-lamp effect] no Wishes available to gain');
          return;
        }

        const wishCardId = wishCards.slice(-1)[0].id;
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: wishCardId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'pasture': {
    registerScoringFunction: () => ({ match, ownerId, ...args }) => {
      // Pasture is worth 1VP per Estate the owner has.
      const estates = args.findCards([{ owner: ownerId }, { cardKeys: 'estate' }]);
      console.debug(`[pasture scoring] player ${getPlayerById(match, ownerId)} has ${estates.length} Estate(s)`);
      return estates.length;
    },
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$1.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
    },
  },
  'pouch': {
    registerEffects: () => async (cardEffectArgs) => {

      // Apply the immediate +$1 and +1 Buy.
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
    },
  },
  'wish': {
    registerEffects: () => async (cardEffectArgs) => {
      // Apply the immediate +1 Action.
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      const wishCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      console.debug(`[wish effect] returning ${wishCard} to wish pile`);

      const moveResult = await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: wishCard.id,
        to: { location: 'nonSupplyCards' },
      });

      if (!moveResult) {
        console.debug('[wish effect] wish did not return to pile, skipping gain');
        return;
      }

      const gainCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        prompt: 'Gain a card to your hand costing up to $6',
        playerId: cardEffectArgs.playerId,
        count: 1,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 6 } },
        ],
      }) as CardId[];

      const gainCardId = gainCardIds[0];
      if (!gainCardId) {
        console.debug('[wish effect] no card selected to gain');
        return;
      }

      console.debug(`[wish effect] gaining ${cardEffectArgs.cardLibrary.getCard(gainCardId)} to hand`);
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: gainCardId,
        to: { location: 'playerHand' },
      });
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
