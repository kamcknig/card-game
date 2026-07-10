import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { CardId, CardLikeId } from 'shared/types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { markPlayerImmune } from '../../utils/reaction-immunity.ts';
import { findBoonInMatch } from '@shared/find-card-like-in-match.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';
import { revealTopDeckCards } from '../../utils/reveal-top-deck-cards.ts';
import { registerStartTurnEffect } from '../../utils/register-start-turn-effect.ts';

// Prompts a player to choose an Action from hand not already represented in play.
const promptUniqueActionFromHand = async (
  cardEffectArgs: CardEffectFunctionContext,
  prompt: string,
  logPrefix: string,
): Promise<CardId | undefined> => {
  // Gather Action cards in hand for eligibility filtering.
  const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
  const handActions = hand.map(cardEffectArgs.cardLibrary.getCard).filter(card => card.type.includes('ACTION'));

  // Determine which Action card keys are already in play for this player.
  const inPlayCards = cardEffectArgs.findCardService
    .getCardsInPlay()
    .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
  const inPlayKeys = new Set(inPlayCards.map(card => card.cardKey));

  // Only allow Actions that are not already represented in play.
  const eligibleActions = handActions.filter(card => !inPlayKeys.has(card.cardKey));
  // Shadow Actions in deck can also satisfy this "play from hand" opportunity via engine Shadow handling.
  const eligibleShadowActionsInDeck = cardEffectArgs.cardSourceController
    .getSource('playerDeck', cardEffectArgs.playerId)
    .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
    .filter(card => card.type.includes('ACTION') && card.type.includes('SHADOW') && !inPlayKeys.has(card.cardKey));
  if (!eligibleActions.length && !eligibleShadowActionsInDeck.length) {
    cardEffectArgs.loggerService.debug(`[${logPrefix}] no eligible action cards not already in play`);
    return undefined;
  }

  // Prompt the player to optionally select an eligible Action card to play.
  const selectionResult = (await cardEffectArgs.actionService.run('userPrompt', {
    playerId: cardEffectArgs.playerId,
    prompt,
    actionButtons: [{ label: 'CANCEL', action: 1 }],
    content: {
      type: 'select',
      cardIds: eligibleActions.map(card => card.id),
      // Keep a canonical filter so server-side Shadow injection can honor the exact restriction.
      cardFilter: {
        all: [
          { location: 'playerHand', playerId: cardEffectArgs.playerId },
          { cardType: ['ACTION'] },
          ...(inPlayKeys.size > 0 ? [{ not: { cardKeys: [...inPlayKeys] } }] : []),
        ],
      },
      selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
      selectCount: 1,
    },
  })) as { action: number; result: CardId[] };

  if (selectionResult.action === 1 || !selectionResult.result.length) {
    cardEffectArgs.loggerService.debug(`[${logPrefix}] player declined to play an action`);
    return undefined;
  }

  const selectedCardId = selectionResult.result[0];
  if (!selectedCardId) {
    cardEffectArgs.loggerService.debug(`[${logPrefix}] no action selected to play`);
    return undefined;
  }

  return selectedCardId;
};

// Nocturne card effects module for non-supply cards and other mechanics.
const expansion: CardExpansionModule = {
  bard: {
    registerEffects: () => async cardEffectArgs => {
      // Apply the immediate +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Receive a boon from the boon deck.
      await cardEffectArgs.actionService.run('receiveBoon', {
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  bat: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Gather cards in hand for trashing.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[bat effect] no cards in hand to trash');
        return;
      }

      const maxTrashCount = Math.min(2, hand.length);
      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash up to 2 cards from your hand',
        count: { kind: 'upTo', count: maxTrashCount },
        restrict: hand,
      });

      if (!selectedCardIds.length) {
        loggerService.debug('[bat effect] no cards selected to trash');
        return;
      }

      for (const cardId of selectedCardIds) {
        loggerService.debug(`[bat effect] trashing ${cardEffectArgs.cardLibrary.getCard(cardId)}`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      // Exchange Bat for a Vampire if available and pile exists.
      const batPileExists = cardEffectArgs.match.config.nonSupply?.some(supply => supply.name === 'bat');
      if (!batPileExists) {
        loggerService.warn('[bat effect] bat pile not configured, skipping exchange');
        return;
      }

      const vampireCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'kingdomSupply' }, { cardKeys: 'vampire' }],
      });

      if (!vampireCards.length) {
        loggerService.debug('[bat effect] no Vampire cards available to exchange');
        return;
      }

      const vampireCard = vampireCards.slice(-1)[0];
      loggerService.debug(`[bat effect] exchanging for ${vampireCard}`);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' },
      });
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: vampireCard.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'blessed-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        // Take a boon and set it aside so the player can decide timing.
        const boonId = await cardEffectArgs.actionService.run('receiveBoon', {
          playerId: eventArgs.playerId,
          immediate: false,
        });

        if (boonId === undefined) {
          loggerService.info('[blessed-village onGained] no boon available to defer');
          return;
        }

        // Prompt the player to decide when to receive the boon.
        const immediate = await cardEffectArgs.promptService.confirm(
          {
            playerId: eventArgs.playerId,
            prompt: 'Receive a Boon now or at the start of your next turn?',
            actionButtons: [
              { label: 'NOW', action: 1 },
              { label: 'NEXT TURN', action: 2 },
            ],
          },
          1,
        );
        loggerService.debug(`[blessed-village onGained] player chose ${immediate ? 'now' : 'next turn'} for boon`);

        if (immediate) {
          // Resolve the deferred boon immediately.
          await cardEffectArgs.actionService.run('receiveBoon', {
            playerId: eventArgs.playerId,
            immediate: true,
            boonId: boonId,
          });
          return;
        }

        const deferredBoon = findBoonInMatch(cardEffectArgs.match, boonId);
        if (!deferredBoon) {
          loggerService.warn(`[blessed-village onGained] deferred boon ${boonId} not found in match`);
          return;
        }

        // Register a one-shot start-of-turn trigger to resolve the deferred boon.
        cardEffectArgs.reactionManager.registerSystemTemplate(deferredBoon, 'startTurn', {
          playerId: eventArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: conditionArgs => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) {
              return false;
            }
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            // Resolve the deferred boon at the start of the next turn.
            await triggeredArgs.actionService.run('receiveBoon', {
              playerId: eventArgs.playerId,
              immediate: true,
              boonId: boonId,
            });
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      // Apply the immediate +1 Card and +2 Actions.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  cemetery: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        // Gather the player's hand for the on-gain trash.
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
        if (!hand.length) {
          loggerService.debug('[cemetery onGained] no cards in hand to trash');
          return;
        }

        // Prompt the player to trash up to 4 cards from hand.
        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          optional: true,
          prompt: 'Trash up to 4 cards',
          playerId: eventArgs.playerId,
          count: { kind: 'upTo', count: 4 },
          restrict: hand,
        });

        if (!selectedCardIds.length) {
          loggerService.debug('[cemetery onGained] no cards selected to trash');
          return;
        }

        // Trash the selected cards.
        for (const cardId of selectedCardIds) {
          loggerService.debug(`[cemetery onGained] trashing ${cardEffectArgs.cardLibrary.getCard(cardId)}`);
          await cardEffectArgs.actionService.run('trashCard', {
            playerId: eventArgs.playerId,
            cardId: cardId,
          });
        }
      },
    }),
  },
  changeling: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Changeling trashes itself before gaining a copy.
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });
      loggerService.debug('[changeling effect] trashed changeling');

      // Gather all cards this player has in play, including active durations.
      const cardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);

      if (!cardsInPlay.length) {
        loggerService.debug('[changeling effect] no cards in play to copy');
        return;
      }
      loggerService.debug(`[changeling effect] ${cardsInPlay.length} cards in play available to copy`);

      // Prompt to select a card in play to copy.
      const selectionResult = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a card in play to gain a copy of',
        content: {
          type: 'select',
          cardIds: cardsInPlay.map(card => card.id),
          selectCount: 1,
        },
      })) as { result: CardId[] };

      const selectedCardId = selectionResult.result[0];
      if (!selectedCardId) {
        loggerService.debug('[changeling effect] no card selected to copy');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const pileKey = getCardPileKey(selectedCard);
      loggerService.debug(`[changeling effect] selected ${selectedCard} (pile ${pileKey})`);

      // Determine which supply pile matches the selected card's pile key, preferring basic supply.
      let supplyLocation: 'basicSupply' | 'kingdomSupply' = 'basicSupply';
      let topCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({ pileKey, from: 'basicSupply' });
      if (!topCard) {
        supplyLocation = 'kingdomSupply';
        topCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({ pileKey, from: 'kingdomSupply' });
      }

      if (!topCard) {
        loggerService.debug(`[changeling effect] no supply pile found for ${selectedCard}`);
        return;
      }

      // The top card must match the selected card's name for split piles.
      if (topCard.cardKey !== selectedCard.cardKey) {
        loggerService.debug(`[changeling effect] top of pile does not match ${selectedCard}`);
        return;
      }

      loggerService.debug(`[changeling effect] gaining a copy of ${selectedCard}`);
      await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey,
        from: supplyLocation,
        to: { location: 'playerDiscard' },
        logTag: 'changeling effect',
      });
    },
  },
  cobbler: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const cobblerCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Register the start-of-next-turn gain effect.
      registerStartTurnEffect(
        cardEffectArgs,
        cobblerCard,
        async triggeredArgs => {
          // Skip if no eligible cards remain in supply.
          const eligibleCards = triggeredArgs.findCardService.findCards({
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
            ],
          });
          if (!eligibleCards.length) {
            loggerService.debug('[cobbler startTurn] no eligible cards in supply');
            return;
          }

          const gainCardId = await triggeredArgs.actionService.run('selectSingleCard', {
            prompt: 'Gain a card to your hand costing up to $4',
            playerId: cardEffectArgs.playerId,
            count: 1,
            restrict: {
              all: [
                { location: ['basicSupply', 'kingdomSupply'] },
                { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
              ],
            },
          });

          if (!gainCardId) {
            loggerService.debug('[cobbler startTurn] no eligible card selected to gain');
            return;
          }

          loggerService.debug(`[cobbler startTurn] gaining ${triggeredArgs.cardLibrary.getCard(gainCardId)} to hand`);
          await triggeredArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: gainCardId,
            to: { location: 'playerHand' },
          });
        },
        { id: `cobbler:${cobblerCard.id}:startTurn` },
      );
    },
  },
  conclave: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

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
      loggerService.debug(`[conclave effect] playing ${selectedCard}`);
      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      loggerService.debug('[conclave effect] gained +1 Action for playing an action');
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  imp: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +2 Cards.
      await cardEffectArgs.actionService.run('drawCard', {
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
      loggerService.debug(`[imp effect] playing ${selectedCard}`);
      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  crypt: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Determine eligible non-Duration Treasures in play for this player.
      const inPlayCards = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const eligibleTreasures = inPlayCards.filter(
        card => card.type.includes('TREASURE') && !card.type.includes('DURATION'),
      );

      if (!eligibleTreasures.length) {
        loggerService.debug('[crypt effect] no eligible Treasures in play to set aside');
        return;
      }

      loggerService.debug(`[crypt effect] eligible treasures: ${eligibleTreasures.length}`);

      // Prompt the player to set aside any number of eligible treasures.
      const selectionResult = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Set aside any number of non-Duration Treasures',
        actionButtons: [{ label: 'DONE', action: 1 }],
        content: {
          type: 'select',
          cardIds: eligibleTreasures.map(card => card.id),
          selectCount: { kind: 'upTo', count: eligibleTreasures.length },
        },
      })) as { result: CardId[] };

      const setAsideTreasureIds = selectionResult.result ?? [];
      if (!setAsideTreasureIds.length) {
        loggerService.debug('[crypt effect] no treasures selected to set aside');
        return;
      }

      loggerService.info(`[crypt effect] setting aside ${setAsideTreasureIds.length} treasure(s)`);
      for (const cardId of setAsideTreasureIds) {
        loggerService.debug(`[crypt effect] setting aside ${cardEffectArgs.cardLibrary.getCard(cardId)}`);
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'set-aside' },
          facing: 'back',
        });
      }

      const cryptCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Move one set-aside treasure to hand at the start of each of the player's next turns.
      cardEffectArgs.registerDurationEffect(
        cryptCard,
        {
          id: `crypt:${cryptCard.id}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) =>
            trigger.args.playerId === cardEffectArgs.playerId && setAsideTreasureIds.length > 0,
          triggeredEffectFn: async triggeredArgs => {
            loggerService.debug(`[crypt startTurn] remaining set aside: ${setAsideTreasureIds.length}`);

            // Bring Crypt back into play while it continues to resolve.

            let chosenTreasureId = setAsideTreasureIds[0];
            if (setAsideTreasureIds.length > 1) {
              const promptResult = (await triggeredArgs.actionService.run('userPrompt', {
                playerId: cardEffectArgs.playerId,
                prompt: 'Choose a set aside Treasure to put into your hand',
                content: {
                  type: 'select',
                  cardIds: setAsideTreasureIds,
                  selectCount: 1,
                },
              })) as { result: CardId[] };
              chosenTreasureId = promptResult.result?.[0] ?? chosenTreasureId;
            }

            if (!chosenTreasureId) {
              loggerService.warn('[crypt startTurn] no set aside treasure selected');
              return;
            }

            loggerService.debug(
              `[crypt startTurn] moving ${triggeredArgs.cardLibrary.getCard(chosenTreasureId)} to hand`,
            );
            await triggeredArgs.actionService.run('moveCard', {
              cardId: chosenTreasureId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'playerHand' },
              facing: 'front',
            });

            const index = setAsideTreasureIds.indexOf(chosenTreasureId);
            if (index >= 0) {
              setAsideTreasureIds.splice(index, 1);
            }

            loggerService.debug(`[crypt startTurn] remaining set aside: ${setAsideTreasureIds.length}`);

            if (!setAsideTreasureIds.length) {
              loggerService.info('[crypt startTurn] set-aside treasures exhausted, cleaning duration triggers');
              triggeredArgs.reactionManager.cleanupDurationTriggers(cryptCard.id);
            }
          },
        },
        {
          // Keep Crypt in the duration zone while there are still set-aside Treasures to resolve.
          hasActiveEffects: () => setAsideTreasureIds.length > 0,
        },
      );
    },
  },
  'cursed-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        // Cursed Village forces the gaining player to receive a Hex.
        await cardEffectArgs.actionService.run('receiveHex', {
          playerId: eventArgs.playerId,
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +2 Actions.
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      // Draw one at a time so triggered draws are accounted for before checking again.
      let hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      loggerService.debug(`[cursed-village effect] starting draw loop at ${hand.length} card(s) in hand`);

      while (hand.length < 6) {
        loggerService.debug('[cursed-village effect] drawing 1 card to reach 6 in hand');
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 1,
        });

        hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        loggerService.debug(`[cursed-village effect] hand now has ${hand.length} card(s)`);
      }
    },
  },
  'den-of-sin': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        // Only move to hand if it was gained to the player's discard pile.
        const source = cardEffectArgs.cardSourceController.findCardSource(eventArgs.cardId);
        if (source.sourceKey !== 'playerDiscard' || source.playerId !== eventArgs.playerId) {
          loggerService.debug('[den-of-sin onGained] not in discard pile, skipping move to hand');
          return;
        }

        loggerService.debug('[den-of-sin onGained] moving gained card from discard to hand');
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: {
            location: 'playerHand',
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const denOfSinCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Register the start-of-next-turn draw effect.
      registerStartTurnEffect(
        cardEffectArgs,
        denOfSinCard,
        async triggeredArgs => {
          // Apply the +2 Cards at the start of the next turn.
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          });
        },
        { id: `den-of-sin:${denOfSinCard.id}:startTurn` },
      );
    },
  },
  'ghost-town': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        loggerService.debug('[ghost-town onGained] moving gained card from discard to hand');
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: {
            location: 'playerHand',
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const ghostTownCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Register the start-of-next-turn +1 Card/+1 Action.
      registerStartTurnEffect(
        cardEffectArgs,
        ghostTownCard,
        async triggeredArgs => {
          // Apply +1 Card.
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });

          // Apply +1 Action.
          await triggeredArgs.actionService.run('gainAction', {
            count: 1,
          });
        },
        { id: `ghost-town:${ghostTownCard.id}:startTurn` },
      );
    },
  },
  guardian: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        loggerService.debug('[guardian onGained] moving gained card from discard to hand');
        await cardEffectArgs.actionService.run('moveCard', {
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
    registerEffects: () => async cardEffectArgs => {
      // Register Guardian immunity against attacks until the next turn.
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `guardian:${cardEffectArgs.cardId}:cardPlayed`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'cardPlayed',
        condition: ({ trigger, cardLibrary }) => {
          const playedCard = cardLibrary.getCard(trigger.args.cardId!);
          return trigger.args.playerId !== cardEffectArgs.playerId && playedCard.type.includes('ATTACK');
        },
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        triggeredEffectFn: async ({ loggerService, reactionContext }) => {
          loggerService.debug(`[guardian reaction] granting immunity to player ${cardEffectArgs.playerId}`);
          // Record immunity so downstream attacks skip this player.
          markPlayerImmune(cardEffectArgs.playerId, reactionContext);
        },
      });

      const guardianCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Keep the duration card active through cleanup and apply next-turn bonus.
      registerStartTurnEffect(
        cardEffectArgs,
        guardianCard,
        async triggeredArgs => {
          // Return Guardian to the play area before resolving its next-turn effect.

          // Stop granting immunity after the start of the next turn.
          cardEffectArgs.reactionManager.unregisterTrigger(`guardian:${guardianCard.id}:cardPlayed`);

          // Apply the +$1 at the start of the next turn.
          await triggeredArgs.actionService.run(
            'gainTreasure',
            {
              count: 1,
            },
            { loggingContext: { source: guardianCard.id } },
          );
        },
        { id: `guardian:${guardianCard.id}:startTurn`, autoResolve: true },
      );
    },
  },
  idol: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Count Idols in play for the current player (including this one).
      const idolsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(
          card =>
            card.cardKey === 'idol' &&
            cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId,
        );
      const idolCount = idolsInPlay.length;
      const isOdd = idolCount % 2 === 1;

      loggerService.debug(`[idol effect] player has ${idolCount} Idol(s) in play (odd=${isOdd})`);

      if (isOdd) {
        // Receive a boon when the count is odd.
        await cardEffectArgs.actionService.run('receiveBoon', {
          playerId: cardEffectArgs.playerId,
        });
        return;
      }

      // Otherwise, each other player gains a Curse (respecting immunity).
      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      loggerService.debug(
        `[idol effect] curse targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`,
      );

      for (const targetPlayerId of targetPlayerIds) {
        loggerService.debug(`[idol effect] giving curse to ${getPlayerById(cardEffectArgs.match, targetPlayerId)}`);

        const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'idol effect',
        });

        if (!gainedCurseId) {
          loggerService.debug('[idol effect] no curse cards in supply');
          return;
        }
      }
    },
  },
  leprechaun: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Gain a Gold first.
      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'leprechaun effect',
      });

      if (!gainedGoldId) {
        loggerService.debug('[leprechaun effect] no Gold cards in supply');
      }

      // Count cards in play after the Gold gain resolves.
      const cardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const inPlayCount = cardsInPlay.length;

      loggerService.debug(`[leprechaun effect] player has ${inPlayCount} card(s) in play`);

      if (inPlayCount === 7) {
        // Gain a Wish when the count is exactly 7.
        const wishCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'nonSupplyCards' }, { cardKeys: 'wish' }],
        });

        if (!wishCards.length) {
          loggerService.warn('[leprechaun effect] no Wish cards available to gain');
          return;
        }

        const wishCardId = wishCards.slice(-1)[0].id;
        loggerService.debug(`[leprechaun effect] gaining Wish ${cardEffectArgs.cardLibrary.getCard(wishCardId)}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: wishCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      // Otherwise, receive a Hex.
      await cardEffectArgs.actionService.run('receiveHex', {
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  monastery: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Count cards gained earlier this turn (do not update during trashing).
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const gainedThisTurn = cardEffectArgs.match.stats.cardsGainedByTurn[turnStatsIndex] ?? [];
      const gainedCount = gainedThisTurn.filter(
        cardId => cardEffectArgs.match.stats.cardsGained[cardId]?.playerId === cardEffectArgs.playerId,
      ).length;

      loggerService.debug(`[monastery effect] player gained ${gainedCount} card(s) earlier this turn`);

      if (gainedCount < 1) {
        return;
      }

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const copperInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(
          card =>
            card.cardKey === 'copper' &&
            cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId,
        )
        .map(card => card.id);

      const eligibleIds = [...hand, ...copperInPlay];
      if (!eligibleIds.length) {
        loggerService.debug('[monastery effect] no eligible cards to trash');
        return;
      }

      const maxTrashCount = Math.min(gainedCount, eligibleIds.length);
      const selectedIds = await cardEffectArgs.actionService.run('selectCard', {
        prompt: 'Trash cards from your hand or Coppers in play',
        playerId: cardEffectArgs.playerId,
        count: { kind: 'upTo', count: maxTrashCount },
        optional: true,
        restrict: eligibleIds,
      });

      if (!selectedIds.length) {
        loggerService.debug('[monastery effect] player declined to trash');
        return;
      }

      for (const selectedId of selectedIds) {
        loggerService.debug(`[monastery effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedId)}`);
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedId,
        });
      }
    },
  },
  pooka: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Gather Treasures in hand excluding Cursed Gold.
      const treasuresInHand = cardEffectArgs.findCardService
        .findCards({ all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: ['TREASURE'] }] })
        .filter(card => card.cardKey !== 'cursed-gold');

      if (!treasuresInHand.length) {
        loggerService.debug('[pooka effect] no eligible Treasures to trash');
        return;
      }

      // Prompt the player to optionally trash a Treasure for +4 Cards.
      const selectedCardId = (await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a Treasure to draw 4 cards?',
        count: 1,
        optional: true,
        restrict: treasuresInHand.map(card => card.id),
      })) as CardId | null;
      if (!selectedCardId) {
        loggerService.debug('[pooka effect] player declined to trash a Treasure');
        return;
      }

      loggerService.debug(`[pooka effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Draw 4 cards after trashing.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 4,
      });
    },
  },
  raider: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Determine the card keys currently in play for the Raider's owner.
      const inPlayCards = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const inPlayKeys = new Set(inPlayCards.map(card => card.cardKey));

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      loggerService.debug(
        `[raider effect] targeting ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`,
      );

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.findCardService.findCards({ location: 'playerHand', playerId: targetPlayerId });

        if (hand.length < 5) {
          loggerService.debug(
            `[raider effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} has ${hand.length} cards, skipping`,
          );
          continue;
        }

        const eligibleIds = hand.filter(card => inPlayKeys.has(card.cardKey)).map(card => card.id);

        if (!eligibleIds.length) {
          loggerService.debug(
            `[raider effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} cannot discard, revealing hand`,
          );
          for (const card of hand) {
            await cardEffectArgs.actionService.run('revealCard', {
              playerId: targetPlayerId,
              cardId: card.id,
            });
          }
          continue;
        }

        let discardId = eligibleIds[0];
        if (eligibleIds.length > 1) {
          const selectedId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId: targetPlayerId,
            prompt: 'Discard a copy of a card in play',
            count: 1,
            restrict: eligibleIds,
          });
          discardId = selectedId ?? discardId;
        }

        if (!discardId) {
          loggerService.warn(
            `[raider effect] no card selected for ${getPlayerById(cardEffectArgs.match, targetPlayerId)}`,
          );
          continue;
        }

        loggerService.debug(
          `[raider effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} discarding ${cardEffectArgs.cardLibrary.getCard(
            discardId,
          )}`,
        );
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: targetPlayerId,
          cardId: discardId,
        });
      }

      const raiderCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Register the start-of-next-turn +$3.
      registerStartTurnEffect(
        cardEffectArgs,
        raiderCard,
        async triggeredArgs => {
          await triggeredArgs.actionService.run(
            'gainTreasure',
            {
              count: 3,
            },
            { loggingContext: { source: raiderCard.id } },
          );
        },
        { id: `raider:${raiderCard.id}:startTurn` },
      );
    },
  },
  'sacred-grove': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +1 Buy and +$3.
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      // Receive a boon and determine whether it grants +$1.
      const boonId = await cardEffectArgs.actionService.run('receiveBoon', {
        playerId: cardEffectArgs.playerId,
      });

      if (!boonId) {
        loggerService.debug('[sacred-grove effect] no boon received');
        return;
      }

      const boon = findBoonInMatch(cardEffectArgs.match, boonId);
      if (!boon) {
        loggerService.warn(`[sacred-grove effect] boon ${boonId} not found in match`);
        return;
      }

      // Only share boons that do not grant +$1 (Field's Gift, Forest's Gift are excluded).
      const grantsTreasure = new Set(['the-fields-gift', 'the-forests-gift']);
      if (grantsTreasure.has(boon.cardKey)) {
        loggerService.debug('[sacred-grove effect] boon grants +$1, not sharing');
        return;
      }

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
        match: cardEffectArgs.match,
      });

      for (const targetPlayerId of targetPlayerIds) {
        const shouldReceive = await cardEffectArgs.promptService.confirm(
          {
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
          },
          2,
        );

        if (!shouldReceive) {
          loggerService.debug(`[sacred-grove effect] ${getPlayerById(cardEffectArgs.match, targetPlayerId)} declined`);
          continue;
        }

        await cardEffectArgs.actionService.run('receiveBoon', {
          playerId: targetPlayerId,
          immediate: true,
          boonId: boonId,
        });
      }
    },
  },
  shepherd: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +1 Action.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const victoryCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: ['VICTORY'] }],
      });

      if (!victoryCards.length) {
        loggerService.debug('[shepherd effect] no Victory cards in hand to discard');
        return;
      }

      // Prompt the player to discard any number of Victory cards.
      const selectedIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard any number of Victory cards',
        count: { kind: 'upTo', count: victoryCards.length },
        optional: true,
        restrict: victoryCards.map(card => card.id),
      });

      if (!selectedIds.length) {
        loggerService.debug('[shepherd effect] player declined to discard Victory cards');
        return;
      }

      loggerService.debug(`[shepherd effect] revealing and discarding ${selectedIds.length} card(s)`);
      for (const cardId of selectedIds) {
        await cardEffectArgs.actionService.run('revealCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      // Draw 2 cards per discarded Victory card.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: selectedIds.length * 2,
      });
    },
  },
  skulk: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        // Gain a Gold when Skulk is gained.
        const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: eventArgs.playerId,
          pileKey: 'gold',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'skulk onGained',
        });

        if (!gainedGoldId) {
          loggerService.debug('[skulk onGained] no Gold cards available to gain');
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +1 Buy.
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      loggerService.debug(
        `[skulk effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`,
      );

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.actionService.run('receiveHex', {
          playerId: targetPlayerId,
        });
      }
    },
  },
  tracker: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$1.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

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
        condition: conditionArgs => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

          const shouldTopdeck = await triggeredArgs.promptService.confirm(
            {
              playerId: cardEffectArgs.playerId,
              prompt: `Put ${gainedCard.cardName} onto your deck?`,
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            },
            2,
          );

          if (!shouldTopdeck) {
            loggerService.debug('[tracker effect] player declined to topdeck gained card');
            return;
          }

          loggerService.debug(`[tracker effect] moving ${gainedCard} to top of deck`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: gainedCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });

      // Unregister the gain trigger at end of turn.
      const trackerCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      cardEffectArgs.reactionManager.registerSystemTemplate(trackerCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs =>
          conditionArgs.trigger.args.playerId === cardEffectArgs.playerId &&
          conditionArgs.match.stats.turns.length - 1 === turnHistoryIndex,
        triggeredEffectFn: async triggeredArgs => {
          triggeredArgs.reactionManager.unregisterTrigger(gainTriggerId);
          loggerService.debug('[tracker effect] end turn cleanup, removed gain trigger');
        },
      });

      // Receive a boon after setting up the gain trigger.
      await cardEffectArgs.actionService.run('receiveBoon', {
        playerId: cardEffectArgs.playerId,
      });
    },
  },
  'tragic-hero': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +3 Cards and +1 Buy.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      loggerService.debug(`[tragic-hero effect] hand size after draw: ${hand.length}`);

      if (hand.length < 8) {
        return;
      }

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });

      const treasureCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardType: 'TREASURE' }],
      });

      if (!treasureCards.length) {
        loggerService.debug('[tragic-hero effect] no Treasure cards available to gain');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a Treasure',
        count: 1,
        restrict: treasureCards.map(card => card.id),
      });

      if (!selectedCardId) {
        loggerService.debug('[tragic-hero effect] no Treasure selected');
        return;
      }

      loggerService.debug(`[tragic-hero effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  vampire: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Each other player receives a Hex (respecting immunity).
      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      loggerService.debug(
        `[vampire effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`,
      );

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.actionService.run('receiveHex', {
          playerId: targetPlayerId,
        });
      }

      // Gain a card costing up to $5 other than a Vampire.
      const eligibleCards = cardEffectArgs.findCardService
        .findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 5 } },
          ],
        })
        .filter(card => card.cardKey !== 'vampire');

      if (!eligibleCards.length) {
        loggerService.debug('[vampire effect] no eligible cards to gain');
      } else {
        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain a card costing up to $5 (not Vampire)',
          count: 1,
          restrict: eligibleCards.map(card => card.id),
        });

        if (selectedCardId) {
          loggerService.debug(`[vampire effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            to: { location: 'playerDiscard' },
          });
        } else {
          loggerService.debug('[vampire effect] no card selected to gain');
        }
      }

      // Exchange Vampire for a Bat if possible.
      const batCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'nonSupplyCards' }, { cardKeys: 'bat' }],
      });

      if (!batCards.length) {
        loggerService.debug('[vampire effect] no Bat cards available to exchange');
        return;
      }

      const pileKey = getCardPileKey(cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId));
      const inKingdomSupply = cardEffectArgs.match.config.kingdomSupply.some(supply =>
        supply.cards.some(card => getCardPileKey(card) === pileKey),
      );
      const inBasicSupply = cardEffectArgs.match.config.basicSupply.some(supply =>
        supply.cards.some(card => getCardPileKey(card) === pileKey),
      );

      if (!inKingdomSupply && !inBasicSupply) {
        loggerService.warn('[vampire effect] vampire pile not found in match config, skipping exchange');
        return;
      }

      try {
        cardEffectArgs.cardSourceController.findCardSource(cardEffectArgs.cardId);
      } catch (error) {
        loggerService.warn('[vampire effect] vampire source not found, skipping exchange');
        return;
      }

      const returnLocation = inBasicSupply ? 'basicSupply' : 'kingdomSupply';
      const batCard = batCards.slice(-1)[0];

      loggerService.debug(`[vampire effect] exchanging for ${batCard}`);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: returnLocation },
      });
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: batCard.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  werewolf: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Check if this is the current player's Night phase.
      const currentPhase = getTurnPhase(cardEffectArgs.match.turnPhaseIndex);
      const currentPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
      const isOwnNightPhase = currentPhase === 'night' && currentPlayerId === cardEffectArgs.playerId;
      loggerService.debug(
        `[werewolf effect] phase=${currentPhase} currentPlayer=${currentPlayerId} ownNight=${isOwnNightPhase}`,
      );

      if (!isOwnNightPhase) {
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3,
        });
        return;
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      loggerService.debug(
        `[werewolf effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`,
      );

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.actionService.run('receiveHex', {
          playerId: targetPlayerId,
        });
      }
    },
  },
  tormentor: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const cardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);
      const otherCardsInPlay = cardsInPlay.filter(card => card.id !== cardEffectArgs.cardId);

      loggerService.debug(`[tormentor effect] other cards in play: ${otherCardsInPlay.length}`);

      if (!otherCardsInPlay.length) {
        const impCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'nonSupplyCards' }, { cardKeys: 'imp' }],
        });

        if (!impCards.length) {
          loggerService.warn('[tormentor effect] no Imp cards available to gain');
          return;
        }

        const impCardId = impCards.slice(-1)[0].id;
        loggerService.debug(`[tormentor effect] gaining Imp ${cardEffectArgs.cardLibrary.getCard(impCardId)}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: impCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      loggerService.debug(
        `[tormentor effect] hex targets ${targetPlayerIds.map(id => getPlayerById(cardEffectArgs.match, id))}`,
      );

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.actionService.run('receiveHex', {
          playerId: targetPlayerId,
        });
      }
    },
  },
  'secret-cave': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the cantrip bonus.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[secret-cave effect] no cards in hand to discard');
        return;
      }

      const shouldDiscard = await cardEffectArgs.promptService.confirm(
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Discard 3 cards?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        },
        2,
      );

      if (!shouldDiscard) {
        loggerService.debug('[secret-cave effect] player chose not to discard');
        return;
      }

      let discardIds: CardId[];
      if (hand.length <= 3) {
        // When fewer than 3 cards in hand, discard all of them.
        discardIds = [...hand];
      } else {
        discardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Discard 3 cards',
          count: 3,
          restrict: hand,
        });
      }

      if (!discardIds.length) {
        loggerService.warn('[secret-cave effect] no cards selected to discard after confirming');
        return;
      }

      loggerService.debug(`[secret-cave effect] discarding ${discardIds.length} card(s)`);
      for (const cardId of discardIds) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      if (discardIds.length < 3) {
        loggerService.debug('[secret-cave effect] discarded fewer than 3 cards, skipping duration bonus');
        return;
      }

      const secretCaveCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Register the start-of-next-turn +$3 if 3 cards were discarded.
      registerStartTurnEffect(
        cardEffectArgs,
        secretCaveCard,
        async triggeredArgs => {
          await triggeredArgs.actionService.run(
            'gainTreasure',
            {
              count: 3,
            },
            { loggingContext: { source: secretCaveCard.id } },
          );
        },
        { id: `secret-cave:${secretCaveCard.id}:startTurn` },
      );
    },
  },
  pixie: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the cantrip bonus.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      if (!cardEffectArgs.match.boons) {
        loggerService.warn('[pixie effect] no boons configured');
        return;
      }

      if (cardEffectArgs.match.boons.cards.length < 1) {
        loggerService.warn('[pixie effect] boon list empty');
        return;
      }

      if (cardEffectArgs.match.boons.deck.length < 1 && cardEffectArgs.match.boons.discard.length > 0) {
        loggerService.debug('[pixie effect] boon deck empty, reshuffling discard');
        await cardEffectArgs.actionService.run('shuffleCardLike', {
          kind: 'boon',
          includeDiscard: true,
          playerId: cardEffectArgs.playerId,
        });
      }

      if (cardEffectArgs.match.boons.deck.length < 1) {
        loggerService.debug('[pixie effect] no boons available to discard');
        return;
      }

      // Discard the top boon without receiving its effect.
      const boonId = cardEffectArgs.match.boons.deck.pop();
      if (boonId === undefined) {
        loggerService.warn('[pixie effect] boon draw failed');
        return;
      }

      const boon = findBoonInMatch(cardEffectArgs.match, boonId);
      if (!boon) {
        loggerService.warn(`[pixie effect] missing boon ${boonId}, discarding id only`);
        cardEffectArgs.match.boons.discard.push(boonId);
        return;
      }

      cardEffectArgs.match.boons.discard.push(boonId);
      loggerService.debug(`[pixie effect] discarded ${boon}`);

      // Prompt to trash Pixie to receive the discarded boon twice.
      const shouldTrash = await cardEffectArgs.promptService.confirm(
        {
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
        },
        2,
      );

      if (!shouldTrash) {
        loggerService.debug('[pixie effect] player declined to trash Pixie');
        return;
      }

      loggerService.debug('[pixie effect] trashing Pixie to receive boon twice');
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });

      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.actionService.run('receiveBoon', {
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
        const loggerService = cardEffectArgs.loggerService;
        loggerService.debug('[night-watchman onGained] moving gained Night Watchman to hand');
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'playerHand' },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Resolve the top 5 cards of the deck (shuffling if needed).
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      let numToLookAt = 5;
      if (deck.length + discard.length < numToLookAt) {
        numToLookAt = deck.length + discard.length;
        loggerService.debug(`[night-watchman effect] adjusting look count to ${numToLookAt}`);
      }

      if (numToLookAt === 0) {
        loggerService.debug('[night-watchman effect] no cards to look at');
        return;
      }

      if (deck.length < numToLookAt) {
        loggerService.debug('[night-watchman effect] deck short, shuffling discard');
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      const cardsToLookAt = deck.slice(-numToLookAt);
      loggerService.debug(`[night-watchman effect] looking at ${cardsToLookAt.length} card(s)`);

      // Prompt the player to discard any number of the looked-at cards.
      const discardResult = (await cardEffectArgs.actionService.run('userPrompt', {
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
      })) as { action: number; result: CardId[] };

      const cardsToDiscard = discardResult.action === 1 ? (discardResult.result ?? []) : [];
      if (!cardsToDiscard.length) {
        loggerService.debug('[night-watchman effect] no cards selected to discard');
      } else {
        loggerService.debug(`[night-watchman effect] discarding ${cardsToDiscard.length} card(s)`);
        for (const cardId of cardsToDiscard) {
          await cardEffectArgs.actionService.run('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardId,
          });
        }
      }

      const remainingCards = cardsToLookAt.filter(cardId => !cardsToDiscard.includes(cardId));
      if (remainingCards.length <= 1) {
        loggerService.debug('[night-watchman effect] no reorder needed');
        return;
      }

      // Prompt the player to reorder the remaining cards.
      const reorderResult = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put the rest back on top of your deck in any order',
        actionButtons: [{ action: 1, label: 'DONE' }],
        content: {
          type: 'rearrange',
          cardIds: remainingCards,
        },
      })) as { action: number; result: CardId[] };

      for (const cardId of reorderResult.result) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  necromancer: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Identify face-up non-Duration Action cards in the trash.
      const trashCards = cardEffectArgs.findCardService.findCards({ location: 'trash' });
      const eligibleCards = trashCards.filter(
        card => card.type.includes('ACTION') && !card.type.includes('DURATION') && card.facing !== 'back',
      );

      if (!eligibleCards.length) {
        loggerService.debug('[necromancer effect] no eligible Action cards in trash');
        return;
      }

      // Prompt the player to choose a trashed Action to play.
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a trashed Action to play',
        count: 1,
        restrict: eligibleCards.map(card => card.id),
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
      });

      if (!selectedCardId) {
        loggerService.debug('[necromancer effect] no card selected');
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[necromancer effect] selected ${selectedCard}`);

      // Turn the selected card face down for the turn to prevent reuse.
      selectedCard.facing = 'back';
      loggerService.debug(`[necromancer effect] turned ${selectedCard} face down`);

      // Flip the card back face up at end of turn.
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      cardEffectArgs.reactionManager.registerReactionTemplate(selectedCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs => conditionArgs.match.stats.turns.length - 1 === turnHistoryIndex,
        triggeredEffectFn: async triggeredArgs => {
          const faceUpCard = triggeredArgs.cardLibrary.getCard(selectedCardId);
          faceUpCard.facing = 'front';
          loggerService.debug(`[necromancer endTurn] turned ${faceUpCard} face up`);
        },
      });

      // Play the trashed card without moving it or spending an Action.
      await cardEffectArgs.actionService.run('playCard', {
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
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Gather Action cards in hand for the optional trash.
      const actionCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: ['ACTION'] }],
      });

      if (!actionCards.length) {
        loggerService.debug('[zombie-apprentice effect] no Action cards in hand to trash');
        return;
      }

      // Prompt the player to optionally trash an Action for the bonus.
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash an Action for +3 Cards and +1 Action',
        count: 1,
        optional: true,
        restrict: actionCards.map(card => card.id),
      });

      if (!selectedCardId) {
        loggerService.debug('[zombie-apprentice effect] player declined to trash an Action');
        return;
      }

      loggerService.debug(`[zombie-apprentice effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      // Apply the bonus after trashing.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  'zombie-mason': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Ensure there is at least one card to trash from the deck.
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      if (!deck.length && discard.length) {
        loggerService.debug('[zombie-mason effect] deck empty, shuffling discard');
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      if (!deck.length) {
        loggerService.debug('[zombie-mason effect] no cards in deck to trash');
        return;
      }

      const topCardId = deck.slice(-1)[0];
      const trashedCard = cardEffectArgs.cardLibrary.getCard(topCardId);
      loggerService.debug(`[zombie-mason effect] trashing top card ${trashedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
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

      const eligibleCards = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: maxCost },
        ],
      });

      if (!eligibleCards.length) {
        loggerService.debug('[zombie-mason effect] no cards available to gain');
        return;
      }

      // Prompt the player to optionally gain a card.
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $1 more',
        count: 1,
        optional: true,
        restrict: eligibleCards.map(card => card.id),
      });

      if (!selectedCardId) {
        loggerService.debug('[zombie-mason effect] player declined to gain a card');
        return;
      }

      loggerService.debug(`[zombie-mason effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'zombie-spy': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the cantrip bonus first.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Ensure there is a top card to look at.
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      if (!deck.length && discard.length) {
        loggerService.debug('[zombie-spy effect] deck empty, shuffling discard');
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      }

      if (!deck.length) {
        loggerService.debug('[zombie-spy effect] no cards left to look at');
        return;
      }

      const topCardId = deck.slice(-1)[0];
      const topCard = cardEffectArgs.cardLibrary.getCard(topCardId);
      loggerService.debug(`[zombie-spy effect] looking at top card ${topCard}`);

      const shouldDiscard = await cardEffectArgs.promptService.confirm(
        {
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
        },
        1,
      );

      if (shouldDiscard) {
        loggerService.debug(`[zombie-spy effect] discarding ${topCard}`);
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: topCardId,
        });
        return;
      }

      loggerService.debug('[zombie-spy effect] leaving top card in place');
    },
  },
  'devils-workshop': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Count the cards this player has gained this turn.
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const gainedThisTurn = cardEffectArgs.match.stats.cardsGainedByTurn[turnStatsIndex] ?? [];
      const gainedCount = gainedThisTurn.filter(
        cardId => cardEffectArgs.match.stats.cardsGained[cardId]?.playerId === cardEffectArgs.playerId,
      ).length;

      loggerService.debug(`[devils-workshop effect] player gained ${gainedCount} card(s) this turn`);

      if (gainedCount >= 2) {
        // Gain an Imp from the non-supply pile.
        const impCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'nonSupplyCards' }, { cardKeys: 'imp' }],
        });

        if (!impCards.length) {
          loggerService.warn('[devils-workshop effect] no Imp cards available to gain');
          return;
        }

        const impCardId = impCards.slice(-1)[0].id;
        loggerService.debug(`[devils-workshop effect] gaining Imp ${impCardId}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: impCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      if (gainedCount === 1) {
        // Gain a card costing up to $4 from the supply.
        const eligibleCards = cardEffectArgs.findCardService.findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
          ],
        });

        if (!eligibleCards.length) {
          loggerService.debug('[devils-workshop effect] no eligible cards in supply to gain');
          return;
        }

        const gainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          prompt: 'Gain a card costing up to $4',
          playerId: cardEffectArgs.playerId,
          count: 1,
          restrict: {
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
            ],
          },
        });

        if (!gainCardId) {
          loggerService.debug('[devils-workshop effect] no card selected to gain');
          return;
        }

        loggerService.debug(`[devils-workshop effect] gaining ${cardEffectArgs.cardLibrary.getCard(gainCardId)}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: gainCardId,
          to: { location: 'playerDiscard' },
        });
        return;
      }

      // Gain a Gold if no cards were gained previously this turn.
      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'devils-workshop effect',
      });

      if (!gainedGoldId) {
        loggerService.warn('[devils-workshop effect] no Gold cards available to gain');
      }
    },
  },
  druid: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +1 Buy.
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const setAsideBoons = cardEffectArgs.match.boons?.setAside ?? [];
      if (!setAsideBoons.length) {
        loggerService.warn('[druid effect] no set-aside boons available');
        return;
      }

      loggerService.debug(`[druid effect] selecting from ${setAsideBoons.length} set-aside boon(s)`);
      const selectionResult = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose a boon to receive',
        content: {
          type: 'select',
          cardIds: [],
          cardLikeIds: setAsideBoons,
          selectCount: 1,
        },
      })) as { result?: CardLikeId[] };

      const selectedBoonId = selectionResult?.result?.[0] ?? setAsideBoons[0];
      if (!selectedBoonId) {
        loggerService.warn('[druid effect] no boon selected to receive');
        return;
      }

      loggerService.debug(`[druid effect] receiving boon ${selectedBoonId}`);
      await cardEffectArgs.actionService.run('receiveBoon', {
        playerId: cardEffectArgs.playerId,
        boonId: selectedBoonId,
        immediate: true,
        keepSetAside: true,
      });
    },
  },
  exorcist: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[exorcist effect] no cards in hand to trash');
        return;
      }

      const trashedCardId = (await cardEffectArgs.actionService.run('selectSingleCard', {
        prompt: 'Trash a card from your hand',
        playerId: cardEffectArgs.playerId,
        count: 1,
        restrict: hand,
      })) as CardId | null;
      if (!trashedCardId) {
        loggerService.debug('[exorcist effect] no card selected to trash');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(trashedCardId);
      const trashedCost = cardEffectArgs.cardPriceController.applyRules(trashedCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;

      loggerService.debug(`[exorcist effect] trashing ${trashedCard}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: trashedCardId,
      });

      const spiritCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'nonSupplyCards' }, { cardType: ['SPIRIT'] }],
      });

      if (!spiritCards.length) {
        loggerService.warn('[exorcist effect] no Spirit cards available to gain');
        return;
      }

      const eligibleSpirits = spiritCards.filter(spirit => {
        const spiritCost = cardEffectArgs.cardPriceController.applyRules(spirit, {
          playerId: cardEffectArgs.playerId,
        }).cost;
        return compareCardCosts(spiritCost, trashedCost) === -1;
      });

      if (!eligibleSpirits.length) {
        loggerService.debug('[exorcist effect] no cheaper Spirit available to gain');
        return;
      }

      const eligibleIds = eligibleSpirits.map(spirit => spirit.id);
      const gainId = (await cardEffectArgs.actionService.run('selectSingleCard', {
        prompt: 'Gain a cheaper Spirit',
        playerId: cardEffectArgs.playerId,
        count: 1,
        restrict: eligibleIds,
      })) as CardId | null;
      if (!gainId) {
        loggerService.debug('[exorcist effect] no Spirit selected to gain');
        return;
      }

      loggerService.debug(`[exorcist effect] gaining ${cardEffectArgs.cardLibrary.getCard(gainId)}`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: gainId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  fool: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
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
        loggerService.debug('[fool effect] player already has Lost in the Woods, skipping');
        return;
      }

      if (lostInTheWoods) {
        loggerService.debug('[fool effect] taking Lost in the Woods');
        await cardEffectArgs.actionService.run('gainState', {
          playerId: cardEffectArgs.playerId,
          stateId: lostInTheWoods.id,
          // Lost in the Woods can only be owned by one player at a time.
          removeFromCurrentOwner: true,
        });
      } else {
        loggerService.warn('[fool effect] Lost in the Woods state not found');
      }

      const boons = cardEffectArgs.match.boons;
      if (!boons || boons.cards.length < 1) {
        loggerService.warn('[fool effect] no boons configured for this match');
        return;
      }

      // Draw up to three boons from the shared boon deck.
      const boonsToReceive: CardLikeId[] = [];
      for (let index = 0; index < 3; index++) {
        if (boons.deck.length < 1 && boons.discard.length > 0) {
          loggerService.debug('[fool effect] boon deck empty, reshuffling discard');
          await cardEffectArgs.actionService.run('shuffleCardLike', {
            kind: 'boon',
            includeDiscard: true,
            playerId: cardEffectArgs.playerId,
          });
        }

        const boonId = boons.deck.pop();
        if (boonId === undefined) {
          loggerService.warn('[fool effect] boon deck empty, stopping early');
          break;
        }
        boonsToReceive.push(boonId);
      }

      if (!boonsToReceive.length) {
        loggerService.warn('[fool effect] no boons available to receive');
        return;
      }

      // Prompt the player to choose the order to receive the boons.
      while (boonsToReceive.length > 0) {
        let chosenBoonId = boonsToReceive[0];
        if (boonsToReceive.length > 1) {
          const selectionResult = (await cardEffectArgs.actionService.run('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Choose a Boon to receive',
            content: {
              type: 'select',
              cardIds: [],
              cardLikeIds: boonsToReceive,
              selectCount: 1,
            },
          })) as { result?: CardLikeId[] };

          chosenBoonId = selectionResult?.result?.[0] ?? boonsToReceive[0];
        }

        const chosenIndex = boonsToReceive.indexOf(chosenBoonId);
        if (chosenIndex !== -1) {
          boonsToReceive.splice(chosenIndex, 1);
        }

        loggerService.debug(`[fool effect] receiving boon ${chosenBoonId}`);
        await cardEffectArgs.actionService.run('receiveBoon', {
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
        const loggerService = args.loggerService;
        // Faithful Hound does nothing if discarded during cleanup.
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          loggerService.debug('[faithful-hound onDiscarded] discard during cleanup, skipping');
          return;
        }

        // Prompt the owner to set it aside for end-of-turn return.
        const faithfulHound = args.cardLibrary.getCard(eventArgs.cardId);

        const shouldSetAside = await args.promptService.confirm(
          {
            prompt: 'Set Faithful Hound aside?',
            playerId: eventArgs.playerId,
            actionButtons: [
              { label: 'CANCEL', action: 1 },
              { label: 'SET ASIDE', action: 2 },
            ],
          },
          2,
        );

        if (!shouldSetAside) {
          loggerService.debug('[faithful-hound onDiscarded] player declined to set aside');
          return;
        }

        // Set the card aside on the owner's mat.
        loggerService.debug(`[faithful-hound onDiscarded] setting aside ${faithfulHound}`);
        await args.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'set-aside' },
        });

        // Return it to hand at the end of the current turn.
        const discardTurnHistoryIndex = args.match.stats.turns.length - 1;
        args.reactionManager.registerReactionTemplate(faithfulHound, 'endTurn', {
          playerId: eventArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: conditionArgs => conditionArgs.match.stats.turns.length - 1 === discardTurnHistoryIndex,
          triggeredEffectFn: async triggeredArgs => {
            loggerService.debug(`[faithful-hound endTurn] moving ${faithfulHound} to hand`);
            await triggeredArgs.actionService.run('moveCard', {
              cardId: eventArgs.cardId,
              toPlayerId: eventArgs.playerId,
              to: { location: 'playerHand' },
            });
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      // Apply the immediate +2 Cards.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'lucky-coin': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$1.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const gainedSilverId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'silver',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'lucky-coin effect',
      });

      if (!gainedSilverId) {
        loggerService.debug('[lucky-coin effect] no Silver cards available to gain');
      }
    },
  },
  ghost: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Reveal cards until an Action card is found or the deck is exhausted;
      // revealTopDeckCards shuffles the discard in automatically whenever
      // the deck runs dry mid-reveal.
      const cardsToDiscard: CardId[] = [];
      let actionCardId: CardId | undefined;

      while (!actionCardId) {
        const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
        const revealedCard = revealed[0];
        if (!revealedCard) {
          loggerService.debug('[ghost effect] no cards left to reveal');
          break;
        }

        loggerService.debug(`[ghost effect] revealing ${revealedCard}`);

        if (revealedCard.type.includes('ACTION')) {
          loggerService.info(`[ghost effect] set aside Action ${revealedCard}`);
          actionCardId = revealedCard.id;
          break;
        }

        cardsToDiscard.push(revealedCard.id);
      }

      // Discard any non-Action cards that were revealed.
      if (cardsToDiscard.length) {
        loggerService.debug(`[ghost effect] discarding ${cardsToDiscard.length} revealed card(s)`);
        for (const cardId of cardsToDiscard) {
          await cardEffectArgs.actionService.run('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardId,
          });
        }
      }

      if (!actionCardId) {
        loggerService.info('[ghost effect] no Action card found to set aside');
        return;
      }

      // Move the set-aside Action card to active duration at cleanup to keep it in play.
      const actionCard = cardEffectArgs.cardLibrary.getCard(actionCardId);
      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      cardEffectArgs.reactionManager.registerSystemTemplate(actionCard, 'startTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        autoResolve: true,
        condition: ({ trigger, match }) =>
          getTurnPhase(trigger.args.phaseIndex) === 'cleanup' && match.stats.turns.length - 1 === turnHistoryIndex,
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[ghost cleanup effect] moving ${actionCard} to active duration`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: actionCardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'activeDuration' },
            facing: 'front',
          });
        },
      });

      // Register the start-of-turn trigger to play the Action twice next turn.
      const ghostCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      registerStartTurnEffect(
        cardEffectArgs,
        ghostCard,
        async triggeredArgs => {
          // Bring Ghost back to play area for its next-turn effect.

          const actionCard = triggeredArgs.cardLibrary.getCard(actionCardId);
          loggerService.debug(`[ghost startTurn effect] playing ${actionCard} twice`);
          for (let i = 0; i < 2; i++) {
            await triggeredArgs.actionService.run('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: actionCardId,
              overrides: {
                actionCost: 0,
              },
            });
          }
        },
        { id: `ghost:${ghostCard.id}:startTurn` },
      );
    },
  },
  'haunted-mirror': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        // Find Action cards in the player's hand to discard.
        const actionCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'playerHand', playerId: eventArgs.playerId }, { cardType: ['ACTION'] }],
        });

        if (!actionCards.length) {
          loggerService.debug('[haunted-mirror onTrashed] no Action cards to discard');
          return;
        }

        // Prompt the player to discard an Action to gain a Ghost.
        const selectedCardId = (await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: eventArgs.playerId,
          prompt: 'Discard an Action to gain a Ghost?',
          restrict: actionCards.map(card => card.id),
          count: 1,
          optional: true,
        })) as CardId | null;
        if (!selectedCardId) {
          loggerService.debug('[haunted-mirror onTrashed] player declined to discard an Action');
          return;
        }

        // Discard the selected Action card.
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCardId,
        });

        // Gain a Ghost from the non-supply pile.
        const ghostCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'nonSupplyCards' }, { cardKeys: 'ghost' }],
        });

        if (!ghostCards.length) {
          loggerService.warn('[haunted-mirror onTrashed] no Ghost cards available to gain');
          return;
        }

        const ghostCardId = ghostCards.slice(-1)[0].id;
        loggerService.debug(`[haunted-mirror onTrashed] gaining Ghost ${ghostCardId}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: eventArgs.playerId,
          cardId: ghostCardId,
          to: { location: 'playerDiscard' },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      // Haunted Mirror is a $1 Treasure.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
    },
  },
  goat: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$1.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        loggerService.debug('[goat effect] no cards in hand to trash');
        return;
      }

      // Prompt the player to optionally trash a card from hand.
      const selectedCardId = (await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand?',
        count: 1,
        optional: true,
        restrict: hand,
      })) as CardId | null;
      if (!selectedCardId) {
        loggerService.debug('[goat effect] player declined to trash');
        return;
      }

      loggerService.debug(`[goat effect] trashing ${cardEffectArgs.cardLibrary.getCard(selectedCardId)}`);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'cursed-gold': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$3.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      // Gain a Curse when played.
      const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'curse',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'cursed-gold effect',
      });

      if (!gainedCurseId) {
        loggerService.debug('[cursed-gold effect] no Curses available to gain');
      }
    },
  },
  'magic-lamp': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +$1.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      // Count cards in play for this player with exactly one copy (including this).
      const cardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => cardEffectArgs.match.stats.playedCards[card.id]?.playerId === cardEffectArgs.playerId);

      const countsByKey: Record<string, number> = {};
      for (const card of cardsInPlay) {
        countsByKey[card.cardKey] = (countsByKey[card.cardKey] ?? 0) + 1;
      }

      const uniqueCount = Object.values(countsByKey).filter(count => count === 1).length;
      loggerService.debug(`[magic-lamp effect] unique-in-play count ${uniqueCount}`);

      if (uniqueCount < 6) {
        return;
      }

      // Trash Magic Lamp to gain 3 Wishes.
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });
      loggerService.debug('[magic-lamp effect] trashed Magic Lamp, gaining 3 Wishes');

      for (let i = 0; i < 3; i++) {
        const wishCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'nonSupplyCards' }, { cardKeys: 'wish' }],
        });

        if (!wishCards.length) {
          loggerService.warn('[magic-lamp effect] no Wishes available to gain');
          return;
        }

        const wishCardId = wishCards.slice(-1)[0].id;
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: wishCardId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  pasture: {
    registerScoringFunction:
      () =>
      ({ match, ownerId, ...args }) => {
        // Pasture is worth 1VP per Estate the owner has.
        const estates = args.findCardService.findCards({ all: [{ owner: ownerId }, { cardKeys: 'estate' }] });
        args.loggerService.debug(
          `[pasture scoring] player ${getPlayerById(match, ownerId)} has ${estates.length} Estate(s)`,
        );
        return estates.length;
      },
    registerEffects: () => async cardEffectArgs => {
      // Apply the immediate +$1.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
    },
  },
  pouch: {
    registerEffects: () => async cardEffectArgs => {
      // Apply the immediate +$1 and +1 Buy.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  wish: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +1 Action.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const wishCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      loggerService.debug(`[wish effect] returning ${wishCard} to wish pile`);

      const moveResult = await cardEffectArgs.actionService.run('moveCard', {
        cardId: wishCard.id,
        to: { location: 'nonSupplyCards' },
      });

      if (!moveResult) {
        loggerService.debug('[wish effect] wish did not return to pile, skipping gain');
        return;
      }

      const gainCardId = (await cardEffectArgs.actionService.run('selectSingleCard', {
        prompt: 'Gain a card to your hand costing up to $6',
        playerId: cardEffectArgs.playerId,
        count: 1,
        restrict: {
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: 6 } },
          ],
        },
      })) as CardId | null;
      if (!gainCardId) {
        loggerService.debug('[wish effect] no card selected to gain');
        return;
      }

      loggerService.debug(`[wish effect] gaining ${cardEffectArgs.cardLibrary.getCard(gainCardId)} to hand`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: gainCardId,
        to: { location: 'playerHand' },
      });
    },
  },
  'will-o-wisp': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Apply the immediate +1 Card and +1 Action.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Reveal the top card of the deck, shuffling the discard in
      // automatically if the deck is empty.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1);
      const revealedCard = revealed[0];

      if (!revealedCard) {
        loggerService.debug(
          `[will-o-wisp effect] no cards to reveal after shuffling for player ${cardEffectArgs.playerId}`,
        );
        return;
      }

      const revealedCardId = revealedCard.id;

      loggerService.debug(`[will-o-wisp effect] revealing top card ${revealedCard}`);

      const { cost } = cardEffectArgs.cardPriceController.applyRules(revealedCard, {
        playerId: cardEffectArgs.playerId,
      });

      const treasureCost = cost.treasure ?? 0;
      const potionCost = cost.potion ?? 0;
      const debtCost = cost.debt ?? 0;
      // Only treasure costs of $2 or less qualify; potion/debt costs do not.
      const qualifiesForDraw = treasureCost <= 2 && potionCost === 0 && debtCost === 0;
      if (!qualifiesForDraw) {
        loggerService.debug(`[will-o-wisp effect] revealed ${revealedCard.cardKey} does not cost $2 or less`);
        return;
      }

      loggerService.info(`[will-o-wisp effect] revealed ${revealedCard.cardKey} costs $2 or less, moving to hand`);

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: revealedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerHand' },
      });
    },
  },
};

export default expansion;
