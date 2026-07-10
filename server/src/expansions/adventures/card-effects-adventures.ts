import { Card, CardKey, CountSpec } from 'shared/types/index.ts';
import {
  CardEffectFunctionContext,
  CardExpansionModule,
  CardLifecycleCallbackContext,
  CardLifecycleEventArgMap,
} from '@server-types/index.ts';
import { markPlayerImmune } from '../../utils/reaction-immunity.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { revealTopDeckCards } from '../../utils/reveal-top-deck-cards.ts';
import { registerStartTurnEffect } from '../../utils/register-start-turn-effect.ts';

const teacherTokenLabels: Record<string, string> = {
  [adventuresTokenIds.plusBuy]: '+1 Buy token',
  [adventuresTokenIds.plusAction]: '+1 Action token',
  [adventuresTokenIds.plusCoin]: '+$1 token',
  [adventuresTokenIds.plusCard]: '+1 Card token',
};

const addTravellerEffect = async (
  card: Card,
  travelTo: CardKey,
  context: CardLifecycleCallbackContext,
  eventArgs: CardLifecycleEventArgMap['onDiscarded'],
) => {
  if (!isLocationInPlay(eventArgs.previousLocation?.location)) {
    return;
  }

  const newCards = context.findCardService.findCards({
    all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardKeys: travelTo }],
  });

  if (!newCards.length) {
    context.loggerService.debug(`[${card.cardKey} onDiscarded effect] no ${travelTo} cards in supply`);
    return;
  }

  const newCard = newCards.slice(-1)[0];

  const result = (await context.actionService.run('userPrompt', {
    playerId: eventArgs.playerId,
    prompt: `Exchange ${card.cardName} for ${newCard.cardName}?`,
    actionButtons: [
      { label: 'CANCEL', action: 1 },
      { label: 'EXCHANGE', action: 2 },
    ],
  })) as { action: number; result: number[] };

  if (result.action === 1) {
    context.loggerService.debug(`[${card.cardKey} onDiscarded effect] user chose not to exchange`);
    return;
  }

  context.loggerService.debug(`[${card.cardKey} onDiscarded effect] moving ${card} back to supply`);

  await context.actionService.run('moveCard', {
    cardId: card.id,
    to: { location: 'kingdomSupply' },
  });

  context.loggerService.debug(`[${card.cardKey} onDiscarded effect] moving ${newCard} to discard pile`);

  await context.actionService.run('moveCard', {
    toPlayerId: eventArgs.playerId,
    cardId: newCard.id,
    to: { location: 'playerDiscard' },
  });
};

// Applies Bridge Troll's cost reduction for a single turn for the owning player.
const applyBridgeTrollCostReduction = (
  context: Pick<CardEffectFunctionContext, 'cardLibrary' | 'cardPriceController' | 'match'>,
  ownerId: number,
): (() => void) => {
  const allCards = context.cardLibrary.getAllCardsAsArray();
  const ruleCleanups: (() => void)[] = [];
  for (const card of allCards) {
    const rule: CardPriceRule = (_card, ruleContext) => {
      if (ruleContext.playerId !== ownerId) {
        return { restricted: false, cost: { treasure: 0 } };
      }
      if (getCurrentPlayer(context.match).id !== ownerId) {
        return { restricted: false, cost: { treasure: 0 } };
      }
      return { restricted: false, cost: { treasure: -1 } };
    };
    ruleCleanups.push(context.cardPriceController.registerRule(card, rule));
  }
  return () => ruleCleanups.forEach(cleanup => cleanup());
};

const expansion: CardExpansionModule = {
  amulet: {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`amulet:${eventArgs.cardId}:startTurn`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const actions = [
        { label: '+1 TREASURE', action: 1 },
        { label: 'TRASH A CARD', action: 2 },
        { label: 'GAIN A SILVER', action: 3 },
      ];

      const decision = async () => {
        const result = (await cardEffectArgs.actionService.run('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one',
          actionButtons: actions,
        })) as { action: number; result: number[] };

        if (result.action === 1) {
          loggerService.debug(`[amulet effect] gaining 1 treasure`);
          await cardEffectArgs.actionService.run('gainTreasure', {
            count: 1,
          });
        } else if (result.action === 2) {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: hand,
            count: 1,
          });

          if (!selectedCardIds.length) {
            loggerService.debug(`[amulet effect] no card selected`);
          } else {
            const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

            loggerService.debug(`[amulet effect] selected ${cardToTrash} to trash`);

            await cardEffectArgs.actionService.run('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToTrash.id,
            });
          }
        } else {
          const gainedSilverId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: cardEffectArgs.playerId,
            pileKey: 'silver',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'amulet effect',
          });
          if (!gainedSilverId) {
            loggerService.debug(`[amulet effect] no silver cards in supply`);
          }
        }
      };

      await decision();

      const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      registerStartTurnEffect(
        cardEffectArgs,
        card,
        async triggeredArgs => {
          loggerService.debug(`[amulet startTurn effect] re-running decision fn`);

          await decision();
        },
        // onLeavePlay unregisters this exact id — must match verbatim.
        { id: `amulet:${cardEffectArgs.cardId}:startTurn` },
      );
    },
  },
  artificer: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[artificer effect] drawing 1 card, gaining 1 action and 1 treasure`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      let selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards?`,
        restrict: hand,
        count: { kind: 'upTo', count: hand.length },
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[artificer effect] no cards selected`);
        return;
      }

      loggerService.debug(`[artificer effect] selected ${selectedCardIds.length} cards to discard`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
      }

      const cardsToSelect = cardEffectArgs.findCardService.findCards({
        all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: { treasure: selectedCardIds.length ?? 0 },
          },
        ],
      });

      if (!cardsToSelect.length) {
        loggerService.debug(`[artificer effect] no cards in supply costing ${selectedCardIds.length ?? 0} treasure`);
        return;
      }

      selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cardsToSelect.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[artificer effect] no card selected`);
        return;
      }

      const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

      loggerService.debug(`[artificer effect] selected ${cardToGain} to gain`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToGain.id,
        to: { location: 'playerDeck' },
      });
    },
  },
  'bridge-troll': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        // Ensure the duration trigger is removed when the card leaves play.
        args.reactionManager.unregisterTrigger(`bridge-troll:${eventArgs.cardId}:startTurn`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[bridge-troll effect] gaining 1 buy`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      loggerService.debug(`[bridge-troll effect] applying cost reduction for this turn`);
      const cleanupCurrentTurnRules = applyBridgeTrollCostReduction(cardEffectArgs, cardEffectArgs.playerId);

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `bridge-troll:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async () => true,
        triggeredEffectFn: async () => {
          // Remove the current-turn cost reduction rules.
          cleanupCurrentTurnRules();
        },
      });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const alreadyActiveToken = Object.values(cardEffectArgs.match.tokens ?? {}).some(
          token =>
            token.tokenId === adventuresTokenIds.minusCoin &&
            token.ownerId === targetPlayerId &&
            token.location.type === 'player' &&
            token.location.playerId === targetPlayerId,
        );
        if (alreadyActiveToken) continue;
        // Move the existing -$1 token from available to active, or create one if absent.
        const availableToken = Object.values(cardEffectArgs.match.tokens ?? {}).find(
          token =>
            token.tokenId === adventuresTokenIds.minusCoin &&
            token.ownerId === targetPlayerId &&
            token.location.type === 'playerAvailable',
        );
        if (availableToken) {
          await cardEffectArgs.actionService.run('moveToken', {
            tokenInstanceId: availableToken.id,
            location: { type: 'player', playerId: targetPlayerId },
          });
        }
      }

      const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      registerStartTurnEffect(
        cardEffectArgs,
        card,
        async triggeredArgs => {
          // Move the duration card back to play and apply the next-turn bonuses.
          loggerService.debug(`[bridge-troll startTurn effect] gaining 1 buy`);
          await triggeredArgs.actionService.run('gainBuy', { count: 1 });
          loggerService.debug(`[bridge-troll startTurn effect] applying cost reduction for this turn`);
          const cleanupNextTurnRules = applyBridgeTrollCostReduction(triggeredArgs, cardEffectArgs.playerId);
          triggeredArgs.reactionManager.registerReactionTemplate({
            id: `bridge-troll:${cardEffectArgs.cardId}:endTurn:duration`,
            listeningFor: 'endTurn',
            playerId: cardEffectArgs.playerId,
            once: true,
            allowMultipleInstances: true,
            compulsory: true,
            condition: async () => true,
            triggeredEffectFn: async () => {
              // Remove the next-turn cost reduction rules.
              cleanupNextTurnRules();
            },
          });
        },
        // onLeavePlay unregisters this exact id — must match verbatim.
        { id: `bridge-troll:${cardEffectArgs.cardId}:startTurn` },
      );
    },
  },
  relic: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[relic effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const alreadyHasToken = Object.values(cardEffectArgs.match.tokens ?? {}).some(
          token =>
            token.tokenId === adventuresTokenIds.minusCard &&
            token.ownerId === targetPlayerId &&
            token.location.type === 'playerDeck' &&
            token.location.playerId === targetPlayerId,
        );
        if (alreadyHasToken) continue;
        // Place the -1 Card token on top of each affected player's deck.
        // Include the source card so token placement logs can attribute it.
        await cardEffectArgs.actionService.run(
          'placeToken',
          {
            tokenId: adventuresTokenIds.minusCard,
            ownerId: targetPlayerId,
            location: { type: 'playerDeck', playerId: targetPlayerId },
          },
          { source: cardEffectArgs.cardId },
        );
      }
    },
  },
  'caravan-guard': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`caravan-guard:${eventArgs.cardId}:startTurn`);
      },
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`caravan-guard:${eventArgs.cardId}:cardPlayed`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `caravan-guard:${eventArgs.cardId}:cardPlayed`,
          listeningFor: 'cardPlayed',
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: async conditionArgs => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) {
              return false;
            }
            const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            return cardPlayed.type.includes('ATTACK');
          },
          triggeredEffectFn: async triggeredArgs => {
            loggerService.debug(`[caravan-guard cardPlayed effect] playing Caravan Guard`);

            await triggeredArgs.actionService.run('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId,
            });
          },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[caravan-guard effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      registerStartTurnEffect(
        cardEffectArgs,
        card,
        async triggeredArgs => {
          loggerService.debug(`[caravan-guard startTurn effect] gaining 1 treasure`);
          await triggeredArgs.actionService.run('gainTreasure', {
            count: 1,
          });
        },
        // onLeavePlay unregisters this exact id — must match verbatim.
        { id: `caravan-guard:${cardEffectArgs.cardId}:startTurn` },
      );
    },
  },
  champion: {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`champion:${eventArgs.cardId}:cardPlayed:attack`);
        args.reactionManager.unregisterTrigger(`champion:${eventArgs.cardId}:cardPlayed:action`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(thisCard, [
        {
          id: `champion:${thisCard.id}:cardPlayed:attack`,
          listeningFor: 'cardPlayed',
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: async conditionArgs => {
            const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!playedCard.type.includes('ATTACK')) return false;
            return conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId;
          },
          triggeredEffectFn: async ({ loggerService, reactionContext }) => {
            loggerService.debug(`[champion cardPlayed effect] attack played, gaining immunity`);
            // Record immunity so downstream attacks skip this player.
            markPlayerImmune(cardEffectArgs.playerId, reactionContext);
          },
        },
        {
          id: `champion:${thisCard.id}:cardPlayed:action`,
          listeningFor: 'cardPlayed',
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: false,
          condition: async conditionArgs => {
            const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!playedCard.type.includes('ACTION')) return false;
            return conditionArgs.trigger.args.playerId === cardEffectArgs.playerId;
          },
          triggeredEffectFn: async triggeredArgs => {
            loggerService.debug(`[champion cardPlayed effect] action played, gaining 1 action`);
            await triggeredArgs.actionService.run(
              'gainAction',
              {
                count: 1,
              },
              { source: thisCard.id },
            );
          },
        },
      ]);
    },
  },
  'coin-of-the-realm': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[coin-of-the-realm effect] gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      loggerService.debug(`[coin-of-the-realm effect] moving card to tavern mat`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'cardPlayed', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          return cardPlayed.type.includes('ACTION');
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[coin-of-the-realm cardPlayed effect] calling back to play`);

          await triggeredArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          loggerService.debug(`[coin-of-the-realm cardPlayed effect] gaining 2 actions`);
          await triggeredArgs.actionService.run('gainAction', {
            count: 2,
          });
        },
      });
    },
  },
  disciple: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'teacher', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const actionCardsInHand = hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('ACTION'));

      if (!actionCardsInHand.length) {
        loggerService.debug(`[disciple effect] no action cards in hand`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play action card`,
        restrict: actionCardsInHand.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[disciple effect] no card selected`);
        return;
      }

      const selectedCardToPlay = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

      loggerService.debug(`[disciple effect] playing ${selectedCardToPlay} twice`);

      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.actionService.run('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardToPlay.id,
          overrides: {
            actionCost: 0,
          },
        });
      }

      loggerService.debug(`[disciple effect] gaining ${selectedCardToPlay}`);

      const gainedCardId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: selectedCardToPlay.cardKey,
        from: ['basicSupply', 'kingdomSupply'],
        to: { location: 'playerDiscard' },
        logTag: 'disciple effect',
      });

      if (!gainedCardId) {
        loggerService.debug(`[disciple effect] no copies of ${selectedCardToPlay} in supply`);
      }
    },
  },
  'distant-lands': {
    registerScoringFunction: () => args => {
      const loggerService = args.loggerService;
      const distantLandCards = args.cardSourceController
        .getSource('tavern', args.ownerId)
        .map(args.cardLibrary.getCard)
        .filter(card => card.cardKey === 'distant-lands');

      loggerService.debug(
        `[distant-lands scoring function] number of distant lands on tavern mat ${distantLandCards.length} for player ${args.ownerId}`,
      );

      return distantLandCards.length * 4;
    },
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[distant-lands effect] moving ${thisCard} to tavern mat`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });
    },
  },
  dungeon: {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`dungeon:${eventArgs.cardId}:startTurn`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[dungeon effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const effects = async () => {
        loggerService.debug(`[dungeon effect] and drawing 2 cards`);
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2,
        });

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 2,
        });

        if (!selectedCardIds.length) {
          loggerService.debug(`[dungeon effect] no cards selected`);
          return;
        }

        loggerService.debug(`[dungeon effect] discarding ${selectedCardIds.length} cards`);

        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.actionService.run('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
          });
        }
      };

      await effects();

      const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      registerStartTurnEffect(
        cardEffectArgs,
        card,
        async triggeredArgs => {
          loggerService.debug(`[dungeon startTurn effect] running`);
          await effects();
        },
        // onLeavePlay unregisters this exact id — must match verbatim.
        { id: `dungeon:${cardEffectArgs.cardId}:startTurn` },
      );
    },
  },
  duplicate: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[duplicate effect] moving ${thisCard} to tavern mat`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          const cardGained = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          const { cost } = conditionArgs.cardPriceController.applyRules(cardGained, {
            playerId: cardEffectArgs.playerId,
          });
          return !(cost.treasure <= 6 && (!cost.potion || cost.potion <= 0));
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[duplicate cardGained] calling ${thisCard} to play area`);

          await triggeredArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          const cardGained = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

          loggerService.debug(`[duplicate cardGained] gaining a copy of ${cardGained}`);

          const gainedCardId = await triggeredArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: cardEffectArgs.playerId,
            pileKey: cardGained.cardKey,
            from: ['basicSupply', 'kingdomSupply'],
            to: { location: 'playerDiscard' },
            logTag: 'duplicate cardGained',
          });

          if (!gainedCardId) {
            loggerService.debug(`[duplicate cardGained], no copies of ${cardGained} in supply`);
          }
        },
      });
    },
  },
  fugitive: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'disciple', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[fugitive effect] drawing 2 cards and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[fugitive effect] no card selected`);
        return;
      }

      const cardToDiscard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

      loggerService.debug(`[fugitive effect] discarding ${cardToDiscard}`);

      await cardEffectArgs.actionService.run('discardCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToDiscard.id,
      });
    },
  },
  gear: {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`gear:${eventArgs.cardId}:startTurn`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Set aside cards`,
        restrict: hand,
        count: {
          kind: 'upTo',
          count: Math.min(2, hand.length),
        },
        optional: true,
      });

      if (!selectedCardIds.length) {
        loggerService.debug(`[gear effect] no cards selected`);
        return;
      }

      loggerService.debug(`[gear effect] set aside ${selectedCardIds.length} cards`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
          to: { location: 'set-aside' },
        });
      }

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      registerStartTurnEffect(
        cardEffectArgs,
        thisCard,
        async triggeredArgs => {
          loggerService.debug(`[gear startTurn effect] moving ${selectedCardIds.length} to hand`);

          for (const selectedCardId of selectedCardIds) {
            await cardEffectArgs.actionService.run('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId: selectedCardId,
              to: { location: 'playerHand' },
            });
          }
        },
        // onLeavePlay unregisters this exact id — must match verbatim.
        { id: `gear:${cardEffectArgs.cardId}:startTurn` },
      );
    },
  },
  giant: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Resolve the current player's Journey token, ensuring it exists.
      const existingJourneyTokenEntry = Object.entries(cardEffectArgs.match.tokens ?? {}).find(
        ([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.journey &&
          token.ownerId === cardEffectArgs.playerId &&
          token.location.type === 'player' &&
          token.location.playerId === cardEffectArgs.playerId,
      );

      const journeyTokenInstanceId = existingJourneyTokenEntry?.[0];
      const journeyToken = existingJourneyTokenEntry?.[1];

      if (!journeyToken) {
        loggerService.warn(`[giant effect] no journey token for user`);
        return;
      }

      // Flip the Journey token before checking its facing.
      const currentFacing = journeyToken.facing ?? 'faceUp';
      const nextFacing = currentFacing === 'faceUp' ? 'faceDown' : 'faceUp';

      await cardEffectArgs.actionService.run('flipToken', {
        tokenInstanceId: journeyTokenInstanceId!,
        facing: nextFacing,
      });

      if (nextFacing === 'faceDown') {
        // Face down: +$1 and no attack.
        loggerService.debug(`[giant effect] Journey face down, gaining 1 treasure`);
        await cardEffectArgs.actionService.run('gainTreasure', {
          count: 1,
        });
        return;
      }

      // Face up: +$5 and attack all other players.
      loggerService.debug(`[giant effect] Journey face up, gaining 5 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 5 });

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const gainCurse = async () => {
          const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: targetPlayerId,
            pileKey: 'curse',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'giant effect',
          });
          if (!gainedCurseId) {
            loggerService.debug(`[giant effect] no curse cards in supply`);
            return false;
          }
          return true;
        };

        // Reveal the top card of the target player's deck, set aside —
        // shuffling the discard back in automatically if the deck is empty.
        const revealed = await revealTopDeckCards(cardEffectArgs, targetPlayerId, 1, { setAside: true });
        const revealedCard = revealed[0];

        if (!revealedCard) {
          // Deck and discard both empty: nothing to reveal, target gains a
          // Curse instead.
          loggerService.debug(`[giant effect] still no cards, gaining a Curse`);
          await gainCurse();
          continue;
        }

        loggerService.debug(`[giant effect] revealing ${revealedCard}`);

        const { cost } = cardEffectArgs.cardPriceController.applyRules(revealedCard, { playerId: targetPlayerId });

        if (cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion) {
          // Trash cards costing $3-$6 with no potion in their cost.
          loggerService.debug(`[giant effect] trashing ${revealedCard}`);
          await cardEffectArgs.actionService.run('trashCard', {
            playerId: targetPlayerId,
            cardId: revealedCard.id,
          });
          continue;
        }

        // Otherwise discard it and gain a Curse.
        loggerService.debug(`[giant effect] discarding ${revealedCard}`);
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: targetPlayerId,
          cardId: revealedCard.id,
        });

        await gainCurse();
      }
    },
  },
  guide: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[guide effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[guide effect] moving ${thisCard} to tavern mat`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          return conditionArgs.trigger.args.playerId === cardEffectArgs.playerId;
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[guide startTurn effect] calling ${thisCard} to playArea`);

          await triggeredArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

          loggerService.debug(`[guide startTurn effect] discarding hand`);

          for (const cardId of [...hand]) {
            await triggeredArgs.actionService.run('discardCard', {
              playerId: cardEffectArgs.playerId,
              cardId,
            });
          }

          loggerService.debug(`[guide startTurn effect] drawing 5 cards`);

          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 5,
          });
        },
      });
    },
  },
  ranger: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      // Ranger always grants +1 Buy first.
      loggerService.debug(`[ranger effect] gaining 1 buy`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      // Resolve the current player's Journey token, ensuring it exists.
      const existingJourneyTokenEntry = Object.entries(cardEffectArgs.match.tokens ?? {}).find(
        ([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.journey &&
          token.ownerId === cardEffectArgs.playerId &&
          token.location.type === 'player' &&
          token.location.playerId === cardEffectArgs.playerId,
      );

      const journeyTokenInstanceId = existingJourneyTokenEntry?.[0];
      const journeyToken = existingJourneyTokenEntry?.[1];

      if (!journeyTokenInstanceId) {
        loggerService.warn(`[ranger effect] missing Journey token instance id`);
        return;
      }

      // Flip the Journey token before checking its facing.
      const currentFacing = journeyToken!.facing ?? 'faceUp';
      const nextFacing = currentFacing === 'faceUp' ? 'faceDown' : 'faceUp';

      await cardEffectArgs.actionService.run('flipToken', {
        tokenInstanceId: journeyTokenInstanceId,
        facing: nextFacing,
      });

      if (nextFacing !== 'faceUp') {
        loggerService.debug(`[ranger effect] Journey face down, no draw`);
        return;
      }

      // Face up: draw 5 cards.
      loggerService.debug(`[ranger effect] Journey face up, drawing 5 cards`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 5,
      });
    },
  },
  'haunted-woods': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`haunted-woods:${eventArgs.cardId}:startTurn`);
        args.reactionManager.unregisterTrigger(`haunted-woods:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `haunted-woods:${cardEffectArgs.cardId}:cardGained`,
        listeningFor: 'cardGained',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) {
            return false;
          }
          return conditionArgs.trigger.args.bought;
        },
        triggeredEffectFn: async triggeredArgs => {
          const triggeringPlayerId = triggeredArgs.trigger.args.playerId;
          loggerService.debug(
            `[haunted-woods cardGained effect] player ${triggeringPlayerId} rearranging hand and top-decking`,
          );
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', triggeringPlayerId);
          const result = (await triggeredArgs.actionService.run('userPrompt', {
            playerId: triggeringPlayerId,
            prompt: 'Rearrange hand to put on deck',
            actionButtons: [{ label: 'DONE', action: 1 }],
            content: {
              type: 'rearrange',
              cardIds: hand,
            },
          })) as { action: number; result: number[] };

          if (!result.result.length) {
            loggerService.warn(`[haunted-woods cardGained effect] no cards rearranged`);
            return;
          }

          loggerService.warn(`[haunted-woods cardGained effect] moving ${result.result.length} cards to deck`);

          for (const cardId of result.result) {
            await triggeredArgs.actionService.run('moveCard', {
              toPlayerId: triggeringPlayerId,
              cardId,
              to: { location: 'playerDeck' },
            });
          }
        },
      });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      registerStartTurnEffect(
        cardEffectArgs,
        thisCard,
        async triggeredArgs => {
          triggeredArgs.reactionManager.unregisterTrigger(`haunted-woods:${cardEffectArgs.cardId}:cardGained`);
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          });
        },
        // onLeavePlay unregisters this exact id — must match verbatim.
        { id: `haunted-woods:${cardEffectArgs.cardId}:startTurn` },
      );
    },
  },
  hero: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'champion', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[hero effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const treasureCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardType: 'TREASURE' }],
      });

      if (!treasureCards.length) {
        loggerService.debug(`[hero effect] no treasure cards in supply`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain treasure`,
        restrict: treasureCards.map(card => card.id),
        count: 1,
      });

      if (!selectedCardIds.length) {
        loggerService.warn(`[hero effect] no card selected`);
        return;
      }

      const selectedCardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

      loggerService.debug(`[hero effect] gaining ${selectedCardToGain}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardToGain.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  hireling: {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`hireling:${eventArgs.cardId}:startTurn`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      cardEffectArgs.registerDurationEffect(thisCard, {
        id: `hireling:${thisCard.id}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[hireling startTurn effect] drawing 1 card`);
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
          });
        },
      });
    },
  },
  'lost-city': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const targetPlayerIds = findOrderedTargets({
          match: args.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: eventArgs.playerId,
        });

        for (const targetPlayerId of targetPlayerIds) {
          loggerService.debug(`[lost-city onGained effect] ${targetPlayerId} drawing 1 card`);
          await args.actionService.run('drawCard', {
            playerId: targetPlayerId,
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  magpie: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[magpie effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Reveal the top card of the deck, set aside — shuffling the discard
      // back in automatically if the deck is empty.
      const revealed = await revealTopDeckCards(cardEffectArgs, cardEffectArgs.playerId, 1, { setAside: true });
      const revealedCard = revealed[0];

      if (!revealedCard) {
        loggerService.debug(`[magpie effect] still no cards in deck, no cards to reveal`);
        return;
      }

      loggerService.debug(`[magpie effect] revealing ${revealedCard}`);

      if (revealedCard.type.includes('TREASURE')) {
        loggerService.debug(`[magpie effect] treasure revealed, moving revealed card to hand`);

        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: revealedCard.id,
          to: { location: 'playerHand' },
        });
      } else if (revealedCard.type.some(t => ['ACTION', 'VICTORY'].includes(t))) {
        loggerService.debug(`[magpie effect] action or victory revealed, gaining magpie`);

        const gainedMagpieId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: 'magpie',
          from: 'kingdomSupply',
          to: { location: 'playerDiscard' },
          logTag: 'magpie effect',
        });
        if (!gainedMagpieId) {
          loggerService.debug(`[magpie effect] no magpie cards in supply`);
          return;
        }

        loggerService.debug(`[magpie effect] gained magpie ${gainedMagpieId}`);
      }
    },
  },
  messenger: {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const stats = args.match.stats;
        const turnHistoryIndex = args.match.stats.turns.length - 1;
        const turnStatsIndex = turnHistoryIndex;
        if (stats.cardsGained?.[eventArgs.cardId]?.turnPhase !== 'buy') {
          return;
        }

        const cardsGainedThisTurnBuyPhase =
          stats.cardsGainedByTurn?.[turnStatsIndex]?.filter(
            cardId =>
              stats.cardsGained[cardId].playerId === eventArgs.playerId &&
              stats.cardsGained[cardId].turnPhase === 'buy',
          )?.length ?? 0;

        if (cardsGainedThisTurnBuyPhase !== 1) {
          loggerService.debug(
            `[messenger onGained effect] player ${eventArgs.playerId} gained more than 1 card in buy phase`,
          );
          return;
        }

        const selectedCardId = await args.actionService.run('selectSingleCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: {
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              {
                kind: 'upTo',
                playerId: eventArgs.playerId,
                amount: { treasure: 4 },
              },
            ],
          },
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[messenger onGained effect] no card selected`);
          return;
        }

        const selectedCard = args.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[messenger onGained effect] selected ${selectedCard}`);

        const copies = args.findCardService.findCards({
          all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardKeys: selectedCard.cardKey }],
        });

        const targetPlayerIds = findOrderedTargets({
          match: args.match,
          appliesTo: 'ALL',
          startingPlayerId: eventArgs.playerId,
        });

        targetPlayerIds.length = Math.min(targetPlayerIds.length, copies.length);

        for (let i = 0; i < targetPlayerIds.length; i++) {
          loggerService.debug(
            `[messenger onGained effect] gaining ${copies.slice(-i - 1)[0]} to ${targetPlayerIds[i]}`,
          );
          await args.actionService.run('gainCard', {
            playerId: targetPlayerIds[i],
            cardId: copies.slice(-i - 1)[0].id,
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[messenger effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put deck into your discard?',
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'PUT IN DISCARD', action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[messenger effect] user cancelled`);
        return;
      } else {
        loggerService.debug(`[messenger effect] putting deck into discard`);
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

        for (const cardId of [...deck]) {
          await cardEffectArgs.actionService.run('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId,
            to: { location: 'playerDiscard' },
          });
        }
      }
    },
  },
  miser: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const copperCardsOnTreasureMat = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'tavern', playerId: cardEffectArgs.playerId }, { cardKeys: 'copper' }],
      });

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: 'PUT COPPER ON TAVERN', action: 1 },
          { label: `+${copperCardsOnTreasureMat.length} TREASURE`, action: 2 },
        ],
      })) as { action: number; result: number[] };

      if (result.action === 1) {
        loggerService.debug(`[miser effect] putting copper on tavern`);
        const coppersInHand = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardKeys: 'copper' }],
        });

        if (!coppersInHand.length) {
          loggerService.debug(`[miser effect] no coppers in hand`);
          return;
        }

        loggerService.debug(`[miser effect] moving ${coppersInHand[0]} to tavern`);

        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: coppersInHand[0].id,
          to: { location: 'tavern' },
        });
      } else {
        loggerService.debug(`[miser effect] gaining ${copperCardsOnTreasureMat.length} treasure`);
        await cardEffectArgs.actionService.run('gainTreasure', {
          count: copperCardsOnTreasureMat.length,
        });
      }
    },
  },
  page: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'treasure-hunter', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[page effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  peasant: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'soldier', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[peasant effect] gaining 1 buy, and 1 treasure`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
    },
  },
  port: {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Extra copies still fire onGained, but must not chain another extra gain.
        // If the gain source is another Port instance, skip chaining.
        if (eventArgs.gainContext?.sourceCardId !== undefined) {
          const gainedCard = args.cardLibrary.getCard(eventArgs.cardId);
          const sourceCard = args.cardLibrary.getCard(eventArgs.gainContext.sourceCardId);
          if (gainedCard.cardKey === sourceCard.cardKey) {
            loggerService.debug('[port onGained effect] skipping chained extra gain for same card key source');
            return;
          }
        }

        const topPortCard = args.findCardService.findTopSupplyCardForPileKey({
          pileKey: 'port',
          from: 'kingdomSupply',
        });
        if (!topPortCard) {
          loggerService.debug(`[port onGained effect] no port cards in supply`);
          return;
        }

        const extraPortCard = args.cardLibrary.getCard(topPortCard.id);

        loggerService.debug(`[port onGained effect] gaining ${extraPortCard}`);

        await args.actionService.run(
          'gainCard',
          {
            playerId: eventArgs.playerId,
            cardId: extraPortCard.id,
            to: { location: 'playerDiscard' },
          },
          {
            lifecycleContext: {
              onGained: {
                sourceCardId: eventArgs.cardId,
              },
            },
          },
        );
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[port effect] drawing 1 card, gaining 2 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  raze: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[raze effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash a card`,
        restrict: cardEffectArgs.cardSourceController
          .getSource('playerHand', cardEffectArgs.playerId)
          .concat(cardEffectArgs.cardId),
        count: 1,
      });

      if (!selectedCardIds.length) {
        loggerService.warn(`[raze effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

      loggerService.debug(`[raze effect] trashing ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });

      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });

      const numToLookAt = cost.treasure;

      if (numToLookAt === 0) {
        loggerService.debug(`[raze effect] cost is 0, not looking at deck`);
        return;
      }

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

      if (deck.length === 0) {
        loggerService.debug(`[raze effect] deck is empty, shuffling deck`);
        await cardEffectArgs.actionService.run('shuffleDeck', {
          playerId: cardEffectArgs.playerId,
        });

        if (deck.length === 0) {
          loggerService.debug(`[raze effect] still empty, no cards to look at`);
          return;
        }
      }

      const lookingAtCards: Card[] = [];

      for (let i = 0; i < numToLookAt; i++) {
        const cardToLookAt = cardEffectArgs.cardLibrary.getCard(deck.slice(-i - 1)[0]);

        loggerService.debug(`[raze effect] looking at ${cardToLookAt}`);

        lookingAtCards.push(cardToLookAt);

        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardToLookAt.id,
          to: { location: 'set-aside' },
        });
      }

      const result = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one to put in hand',
        actionButtons: [{ label: 'DONE', action: 1 }],
        content: {
          type: 'select',
          cardIds: lookingAtCards.map(card => card.id),
          selectCount: 1,
        },
      })) as { action: number; result: number[] };

      if (!result.result.length) {
        loggerService.warn(`[raze effect] no card selected`);
        return;
      }

      const selectedCardToPutInHand = cardEffectArgs.cardLibrary.getCard(result.result[0]);

      loggerService.debug(`[raze effect] putting ${selectedCardToPutInHand} in hand`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedCardToPutInHand.id,
        to: { location: 'playerHand' },
      });

      loggerService.debug(`[raze effect] discarding ${lookingAtCards.length - 1} cards`);

      for (const lookingAtCard of lookingAtCards) {
        if (lookingAtCard.id === selectedCardToPutInHand.id) continue;
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: lookingAtCard.id,
        });
      }
    },
  },
  ratcatcher: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[ratcatcher effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[ratcatcher effect] moving ${thisCard} to play area`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'startTurn', {
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        playerId: cardEffectArgs.playerId,
        condition: async conditionArgs => {
          return conditionArgs.trigger.args.playerId === cardEffectArgs.playerId;
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[ratcatcher startTurn effect] calling ${thisCard} to playArea`);

          await triggeredArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
            count: 1,
          });

          if (!selectedCardIds.length) {
            loggerService.debug(`[ratcatcher startTurn effect] no cards selected`);
            return;
          }

          const selectedCard = triggeredArgs.cardLibrary.getCard(selectedCardIds[0]);

          loggerService.debug(`[ratcatcher startTurn effect] trashing ${selectedCard}`);

          await triggeredArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
          });
        },
      });
    },
  },
  'royal-carriage': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[royal-carriage effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[royal-carriage effect] moving ${thisCard} to tavern`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'afterCardPlayed', {
        // Royal Carriage stays on the Tavern mat until called, then is single-use.
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        playerId: cardEffectArgs.playerId,
        condition: async conditionArgs => {
          // Only respond to actions played by the Royal Carriage owner.
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          // Royal Carriage must still be waiting on the Tavern mat to be called.
          if (!conditionArgs.cardSourceController.getSource('tavern', cardEffectArgs.playerId).includes(thisCard.id))
            return false;
          const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!cardPlayed.type.includes('ACTION')) return false;
          // Only allow calling if the Action is still in play.
          return conditionArgs.findCardService.getCardsInPlay().includes(cardPlayed);
        },
        triggeredEffectFn: async triggeredArgs => {
          const cardToPlay = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);

          loggerService.debug(`[royal-carriage afterCardPlayed effect] calling ${thisCard} to playArea`);

          await triggeredArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          loggerService.debug(`[royal-carriage afterCardPlayed effect] re-playing ${cardToPlay}`);

          await triggeredArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardToPlay.id,
            overrides: {
              actionCost: 0,
            },
          });

          // If the replayed card is a Duration still in play, track Royal Carriage until cleanup.
          if (
            cardToPlay.type.includes('DURATION') &&
            triggeredArgs.findCardService.getCardsInPlay().includes(cardToPlay)
          ) {
            // Keep Royal Carriage in the duration zone during cleanup.
            triggeredArgs.reactionManager.registerSystemTemplate(thisCard, 'startTurnPhase', {
              playerId: cardEffectArgs.playerId,
              once: true,
              allowMultipleInstances: true,
              condition: async conditionArgs =>
                getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'cleanup' &&
                conditionArgs.findCardService.getCardsInPlay().includes(thisCard),
              triggeredEffectFn: async durationArgs => {
                loggerService.debug(`[royal-carriage duration effect] moving ${thisCard} to activeDuration zone`);
                await durationArgs.actionService.run('moveCard', {
                  cardId: thisCard.id,
                  to: { location: 'activeDuration' },
                });
              },
            });

            // Return Royal Carriage to playArea when the owner's next turn starts.
            triggeredArgs.reactionManager.registerReactionTemplate({
              id: `royal-carriage:${thisCard.id}:startTurn`,
              listeningFor: 'startTurn',
              playerId: cardEffectArgs.playerId,
              once: true,
              // Auto-resolve the return after the replayed Duration resolves.
              autoResolve: true,
              compulsory: true,
              allowMultipleInstances: true,
              condition: async conditionArgs => {
                return (
                  conditionArgs.trigger.args.playerId === cardEffectArgs.playerId &&
                  conditionArgs.cardSourceController.getSource('activeDuration').includes(thisCard.id)
                );
              },
              triggeredEffectFn: async durationArgs => {
                loggerService.debug(`[royal-carriage duration effect] returning ${thisCard} to playArea`);
              },
            });
          }
        },
      });
    },
  },
  soldier: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'fugitive', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[soldier effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const attacksInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => card.owner === cardEffectArgs.playerId && card.type.includes('ATTACK'));

      if (attacksInPlay.length > 0) {
        loggerService.debug(`[soldier effect] ${attacksInPlay.length} attacks in play, gaining that much treasure`);
        await cardEffectArgs.actionService.run('gainTreasure', {
          count: attacksInPlay.length,
        });
      }

      const targetPlayerIds = getAttackTargets(
        cardEffectArgs.match,
        cardEffectArgs.playerId,
        cardEffectArgs.reactionContext,
      ).filter(playerId => cardEffectArgs.cardSourceController.getSource('playerHand', playerId).length >= 4);

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard card`,
          restrict: hand,
          count: 1,
        });

        if (!selectedCardIds.length) {
          loggerService.warn(`[soldier effect] no card selected`);
          continue;
        }

        const cardToDiscard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

        loggerService.debug(`[soldier effect] player ${targetPlayerId} discarding ${cardToDiscard}`);

        await cardEffectArgs.actionService.run('discardCard', {
          playerId: targetPlayerId,
          cardId: cardToDiscard.id,
        });
      }
    },
  },
  storyteller: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[storyteller effect] gaining 1 action`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      let treasuresInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter(card => card.type.includes('TREASURE'));

      const numCanPlay = Math.min(3, treasuresInHand.length);

      for (let i = 0; i < numCanPlay; i++) {
        treasuresInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter(card => card.type.includes('TREASURE'));

        if (!treasuresInHand.length) {
          loggerService.debug(`[storyteller effect] no treasures in hand`);
          break;
        }

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play treasure ${i + 1} of ${numCanPlay}?`,
          restrict: treasuresInHand.map(card => card.id),
          count: 1,
          optional: true,
        });

        if (!selectedCardIds.length) {
          loggerService.debug(`[storyteller effect] no treasure selected`);
          break;
        }

        const selectedToPlay = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);

        loggerService.debug(`[storyteller effect] playing ${selectedToPlay}`);

        await cardEffectArgs.actionService.run('playCard', {
          cardId: selectedCardIds[0],
          playerId: cardEffectArgs.playerId,
        });
      }

      loggerService.debug(`[storyteller effect] drawing 1 card`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
      });

      const playerTreasure = cardEffectArgs.match.playerTreasure;

      if (playerTreasure === 0) {
        loggerService.debug(`[storyteller effect] no player treasure, not drawing more cards`);
        return;
      }

      await cardEffectArgs.actionService.run(
        'gainTreasure',
        {
          count: -playerTreasure,
        },
        { loggingContext: { suppress: true } },
      );

      loggerService.debug(`[storyteller effect] drawing ${playerTreasure} cards`);

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: playerTreasure,
      });
    },
  },
  'swamp-hag': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        const thisCard = args.cardLibrary.getCard(eventArgs.cardId);
        for (const player of args.match.players) {
          args.reactionManager.unregisterTrigger(`swamp-hag:${thisCard.id}:cardGained:${player.id}`);
        }
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      const ids: string[] = [];

      registerStartTurnEffect(
        cardEffectArgs,
        thisCard,
        async triggeredArgs => {
          for (const id of ids) {
            triggeredArgs.reactionManager.unregisterTrigger(id);
          }

          loggerService.debug(`[swamp-hag startTurn effect] gaining 3 treasure`);
          await triggeredArgs.actionService.run('gainTreasure', {
            count: 3,
          });
        },
        { id: `swamp-hag:${thisCard.id}:startTurn` },
      );

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const id = `swamp-hag:${thisCard.id}:cardGained:${targetPlayerId}`;
        ids.push(id);
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id,
          listeningFor: 'cardGained',
          playerId: targetPlayerId,
          once: false,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async conditionArgs => {
            if (conditionArgs.trigger.args.playerId !== targetPlayerId) {
              return false;
            }
            return conditionArgs.trigger.args.bought;
          },
          triggeredEffectFn: async triggeredArgs => {
            loggerService.debug(`[swamp-hag cardGained effect] player ${targetPlayerId} gaining a curse`);

            const gainedCurseId = await triggeredArgs.supplyGainService.gainTopSupplyCardForPileKey({
              playerId: targetPlayerId,
              pileKey: 'curse',
              from: 'basicSupply',
              to: { location: 'playerDiscard' },
              logTag: 'swamp-hag cardGained effect',
            });

            if (!gainedCurseId) {
              loggerService.debug(`[swamp-hag cardGained effect] no curse cards in supply`);
            }
          },
        });
      }
    },
  },
  teacher: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
        to: { location: 'tavern' },
      });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: false,
        condition: async conditionArgs => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredEffectArgs => {
          await triggeredEffectArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          const allowedTokens: string[] = [
            adventuresTokenIds.plusBuy,
            adventuresTokenIds.plusAction,
            adventuresTokenIds.plusCoin,
            adventuresTokenIds.plusCard,
          ];
          const tokens = triggeredEffectArgs.match.tokens;
          const tokenInstanceIds = Object.keys(tokens).filter(
            t =>
              allowedTokens.includes(tokens[t].tokenId) &&
              tokens[t].ownerId === triggeredEffectArgs.trigger.args.playerId &&
              tokens[t].location.type === 'playerAvailable',
          );

          const tokenChoice = (await triggeredEffectArgs.actionService.run('userPrompt', {
            playerId: triggeredEffectArgs.trigger.args.playerId,
            prompt: 'Which token?',
            actionButtons: [
              ...tokenInstanceIds.map((t, idx) => ({
                label: teacherTokenLabels[tokens[t].tokenId] ?? tokens[t].tokenId,
                action: idx,
              })),
            ],
          })) as { action: number };

          const selectedTokenInstanceId = tokenInstanceIds[tokenChoice.action];
          if (!selectedTokenInstanceId) {
            loggerService.warn(`[teacher effect] selected token instance not found`);
            return;
          }

          const allTokens = Object.values(triggeredEffectArgs.match.tokens);
          const ownedTokens = allTokens.filter(t => t.ownerId === triggeredEffectArgs.trigger.args.playerId);

          const actionSupplyPiles = triggeredEffectArgs.match.config.kingdomSupply
            .map(supply => {
              const pileCard = getPileDefinitionCard(supply.cards, supply.name);

              if (!pileCard?.type?.includes('ACTION')) return null;

              const pileName = getCardPileKey(pileCard);
              // can't place on pile with any other tokens on it
              if (ownedTokens.find(t => t.location.type === 'supplyPile' && t.location.cardKey === pileName))
                return null;

              return pileName;
            })
            .filter((pile): pile is string => !!pile);

          if (!actionSupplyPiles.length) {
            loggerService.warn(`[teacher effect] no action supply piles available`);
            return;
          }

          const result = (await triggeredEffectArgs.actionService.run('userPrompt', {
            playerId: triggeredEffectArgs.trigger.args.playerId,
            prompt: 'Which Action supply?',
            content: {
              type: 'select-pile',
              pileNames: actionSupplyPiles,
              selectCount: { kind: 'exact', count: 1 } as CountSpec,
            },
          })) as string[];

          const selectedPile = result?.[0];
          if (!selectedPile) {
            loggerService.warn(`[teacher effect] no pile selected`);
            return;
          }

          loggerService.debug(`[teacher effect] selected ${selectedPile}`);

          await triggeredEffectArgs.actionService.run('moveToken', {
            tokenInstanceId: selectedTokenInstanceId,
            location: { type: 'supplyPile', cardKey: selectedPile },
          });
        },
      });
    },
  },
  transmogrify: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: thisCard.id,
        to: { location: 'tavern' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: false,
        condition: async conditionArgs => {
          return conditionArgs.trigger.args.playerId === cardEffectArgs.playerId;
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[transmogrify startTurn effect] calling ${thisCard} to playArea`);

          await triggeredArgs.actionService.run('moveCard', {
            cardId: thisCard.id,
            to: { location: 'playArea' },
          });

          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

          let selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: hand,
            count: 1,
          });

          if (!selectedCardIds.length) {
            loggerService.warn(`[transmogrify startTurn effect] no card selected`);
            return;
          }

          const cardToTrash = triggeredArgs.cardLibrary.getCard(selectedCardIds[0]);

          await triggeredArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardToTrash.id,
          });

          const { cost } = triggeredArgs.cardPriceController.applyRules(cardToTrash, {
            playerId: cardEffectArgs.playerId,
          });

          const cards = triggeredArgs.findCardService.findCards({
            all: [
              { location: ['basicSupply', 'kingdomSupply'] },
              {
                kind: 'upTo',
                playerId: cardEffectArgs.playerId,
                amount: { treasure: cost.treasure + 1, potion: cost.potion },
              },
            ],
          });

          if (!cards.length) {
            loggerService.debug(
              `[transmogrify startTurn effect] no cards costing less than ${
                cost.treasure + 1
              } treasure and ${cost.potion} potions`,
            );
            return;
          }

          selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: cards.map(card => card.id),
            count: 1,
          });

          if (!selectedCardIds.length) {
            loggerService.warn(`[transmogrify startTurn effect] no cards selected to gain`);
            return;
          }

          const cardToGain = triggeredArgs.cardLibrary.getCard(selectedCardIds[0]);

          loggerService.warn(`[transmogrify startTurn effect] gaining ${cardToGain} to hand`);

          await triggeredArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardToGain.id,
            to: { location: 'playerHand' },
          });
        },
      });
    },
  },
  'treasure-hunter': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'warrior', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[treasure-hunter effect] gaining 1 action, gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const silverCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'basicSupply' }, { cardKeys: 'silver' }],
      });

      if (!silverCards.length) {
        loggerService.debug(`[treasure-hunter effect] no silver cards in supply`);
        return;
      }

      const rightPlayer = getPlayerStartingFrom({
        startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
        match: cardEffectArgs.match,
        distance: -1,
      });

      const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const cardsGained =
        cardEffectArgs.match.stats.cardsGainedByTurn?.[turnStatsIndex]
          ?.map(cardEffectArgs.cardLibrary.getCard)
          ?.filter(card => card.owner === rightPlayer.id) ?? [];

      const numToGain = Math.min(silverCards.length, cardsGained.length);

      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCards.slice(-i - 1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'treasure-trove': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[treasure-trove effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'gold',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'treasure-trove effect',
      });
      if (!gainedGoldId) {
        loggerService.debug(`[treasure-trove effect] no gold cards in supply`);
      } else {
        loggerService.debug(`[treasure-trove effect] gaining gold ${gainedGoldId}`);
      }

      const gainedCopperId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: 'copper',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'treasure-trove effect',
      });
      if (!gainedCopperId) {
        loggerService.debug(`[treasure-trove effect] no copper cards in supply`);
      } else {
        loggerService.debug(`[treasure-trove effect] gaining copper ${gainedCopperId}`);
      }
    },
  },
  warrior: {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'hero', args, eventArgs);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[warrior effect] drawing 2 cards`);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      const travellersInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => card.owner === cardEffectArgs.playerId && card.type.includes('TRAVELLER'));

      if (!travellersInPlay.length) {
        loggerService.debug(`[warrior effect] no travellers in play`);
        return;
      }

      const targetPlayerIds = getAttackTargets(cardEffectArgs.match, cardEffectArgs.playerId, cardEffectArgs.reactionContext);

      for (const targetPlayerId of targetPlayerIds) {
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);

        for (let i = 0; i < travellersInPlay.length; i++) {
          if (deck.length === 0) {
            loggerService.debug(`[warrior effect] no cards in deck, shuffling`);

            await cardEffectArgs.actionService.run('shuffleDeck', {
              playerId: cardEffectArgs.playerId,
            });

            if (deck.length === 0) {
              loggerService.debug(`[warrior effect] still empty, no cards to look at`);
              break;
            }
          }

          const cardToDiscard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);

          loggerService.debug(`[warrior effect] discarding ${cardToDiscard}`);

          await cardEffectArgs.actionService.run('discardCard', {
            playerId: targetPlayerId,
            cardId: cardToDiscard.id,
          });

          const { cost } = cardEffectArgs.cardPriceController.applyRules(cardToDiscard, {
            playerId: cardEffectArgs.playerId,
          });

          if (cost.treasure === 3 || cost.treasure === 4) {
            loggerService.debug(`[warrior effect] card costs 3 or 3, trashing ${cardToDiscard}`);

            await cardEffectArgs.actionService.run('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToDiscard.id,
            });
          }
        }
      }
    },
  },
  'wine-merchant': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[wine-merchant effect] gaining 4 treasure, and 1 buy`);

      await cardEffectArgs.actionService.run('gainTreasure', { count: 4 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug(`[wine-merchant effect] moving ${thisCard} to tavern`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: thisCard.id,
        to: { location: 'tavern' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(thisCard, 'endTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          return conditionArgs.match.playerTreasure >= 2;
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[wine-merchant endTurnPhase effect] discarding ${thisCard}`);

          await triggeredArgs.actionService.run('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: thisCard.id,
          });
        },
      });
    },
  },
};

export default expansion;
