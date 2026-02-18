import { CardId, PlayerId } from 'shared/types/index.ts';
import { CardExpansionModule, CardLifecycleCallbackContext } from '@server-types/index.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansion: CardExpansionModule = {
  'berserker': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const actionCardsInPlay = args.findCardService.getCardsInPlay()
          .some((card) => card.type.includes('ACTION') && card.owner === eventArgs.playerId);

        if (!actionCardsInPlay) {
          loggerService.debug(`[berserker onGained effect] no action cards in play`);
          return;
        }

        const card = args.cardLibrary.getCard(eventArgs.cardId);

        loggerService.debug(`[berserker onGained effect] playing ${card}`);

        await args.actionService.run('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        card,
        { playerId: cardEffectArgs.playerId },
      );

      const cardIds = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          playerId: cardEffectArgs.playerId,
          kind: 'upTo',
          amount: { treasure: cost.treasure - 1 },
        },
      ]);

      if (cardIds.length === 0) {
        loggerService.debug(`[berserker effect] no cards costing less than ${cost.treasure - 1}`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cardIds.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[berserker effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[berserker effect] gaining card ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter((playerId) => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);

        const numToDiscard = hand.length - 3;
        if (numToDiscard <= 0) {
          loggerService.debug(`[berserker triggered effect] no cards to discard for player ${targetPlayerId}`);
          continue;
        }

        loggerService.debug(`[berserker triggered effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);

        for (let i = 0; i < numToDiscard; i++) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: hand.slice(-1)[0],
            playerId: targetPlayerId,
          });
        }
      }
    },
  },
  'border-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        const { cost } = args.cardPriceController.applyRules(
          card,
          { playerId: eventArgs.playerId },
        );

        const cardIds = args.findCardService.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: eventArgs.playerId, kind: 'upTo', amount: { treasure: cost.treasure - 1 } },
        ]);

        if (!cardIds.length) {
          loggerService.debug(`[border-village onGained effect] no cards costing less than ${cost.treasure - 1}`);
          return;
        }

        const selectedCardId = await args.actionService.run('selectSingleCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: cardIds.map((card) => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[border-village onGained effect] no card selected`);
          return;
        }

        const selectedCard = args.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[border-village onGained effect] gaining card ${selectedCard}`);

        await args.actionService.run('gainCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        }, { loggingContext: { source: eventArgs.cardId } });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[border-village effect] drawing 1 card and 2 actions`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  'cartographer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[cartographer effect] drawing 1 card and 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);

      const numToLookAt = Math.min(4, deck.length + discard.length);

      loggerService.debug(`[cartographer effect] looking at ${numToLookAt} cards`);

      if (deck.length < numToLookAt) {
        loggerService.debug(`[cartographer effect] no cards in deck, shuffling`);
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
      }

      const cardsToLookAt = deck.slice(-numToLookAt);

      let result = await cardEffectArgs.promptService.requestActionResult<CardId[]>({
        prompt: `May discard up to ${cardsToLookAt.length}`,
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DONE', action: 1 },
        ],
        content: {
          type: 'select',
          cardIds: cardsToLookAt,
          selectCount: {
            kind: 'upTo',
            count: cardsToLookAt.length,
          },
        },
      });

      if (!result?.result?.length) {
        loggerService.warn(`[cartographer effect] no card selected`);
      } else {
        loggerService.debug(`[cartographer effect] discarding ${result.result.length} cards`);

        for (const cardId of result.result) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: cardId,
            playerId: cardEffectArgs.playerId,
          });
        }
      }

      const cardsToRearrange = cardsToLookAt.filter((id) => !result?.result?.includes(id));

      if (!cardsToRearrange.length) {
        loggerService.debug(`[cartographer effect] no cards to rearrange`);
        return;
      }

      loggerService.debug(`[cartographer effect] rearranging ${cardsToRearrange.length} cards`);
      result = await cardEffectArgs.promptService.requestActionResult<CardId[]>({
        prompt: 'Put back on top of deck in any order',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DONE', action: 1 },
        ],
        content: {
          type: 'rearrange',
          cardIds: cardsToRearrange,
        },
      });

      for (const cardId of result?.result ?? []) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'cauldron': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`cauldron:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[cauldron effect] gaining 1 treasure, and 1 buy`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      let actionGainCount = 0;

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `cauldron:${cardEffectArgs.cardId}:cardGained`,
        listeningFor: 'cardGained',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (card.type.includes('ACTION')) {
            actionGainCount++;
            loggerService.debug(
              `[cauldron triggered condition] incrementing action gains for cauldron card ${cardEffectArgs.cardId} to ${actionGainCount}`,
            );
          }
          return actionGainCount === 3;
        },
        triggeredEffectFn: async () => {
          cardEffectArgs.reactionManager.unregisterTrigger(`cauldron:${cardEffectArgs.cardId}:cardGained`);
          const targetPlayerIds = findOrderedTargets({
            match: cardEffectArgs.match,
            appliesTo: 'ALL_OTHER',
            startingPlayerId: cardEffectArgs.playerId,
          }).filter((playerId) => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

          for (const targetPlayerId of targetPlayerIds) {
            const curseIds = cardEffectArgs.findCardService.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'curse' },
            ]);

            if (!curseIds.length) {
              loggerService.debug(`[cauldron triggered effect] no curse cards in supply`);
              break;
            }

            loggerService.debug(
              `[cauldron triggered effect] player ${targetPlayerId} gaining ${curseIds.slice(-1)[0]}`,
            );
            await cardEffectArgs.actionService.run('gainCard', {
              playerId: targetPlayerId,
              cardId: curseIds.slice(-1)[0].id,
              to: { location: 'playerDiscard' },
            });
          }
        },
      });
    },
  },
  'crossroads': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      loggerService.debug(`[crossroads effect] revealing ${hand.length} cards`);

      for (const cardId of hand) {
        await cardEffectArgs.actionService.run('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }

      const victoryCardInHandCount = hand.map(cardEffectArgs.cardLibrary.getCard)
        .filter((card) => card.type.includes('VICTORY'))
        .length;

      loggerService.debug(`[crossroads effect] drawing ${victoryCardInHandCount} cards`);

      for (let i = 0; i < victoryCardInHandCount; i++) {
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      }

      const crossroadsPlayedThisTurnCount =
        (cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.stats.turns.length - 1] ?? [])
          .map(cardEffectArgs.cardLibrary.getCard)
          .filter((card) => card.owner === cardEffectArgs.playerId && card.cardKey === 'crossroads')
          .length;

      if (crossroadsPlayedThisTurnCount === 1) {
        loggerService.debug(
          `[crossroads effect] crossroads played this turn ${crossroadsPlayedThisTurnCount}, gaining 3 actions`,
        );
        await cardEffectArgs.actionService.run('gainAction', { count: 3 });
      } else {
        loggerService.debug(
          `[crossroads effect] crossroads played this turn ${crossroadsPlayedThisTurnCount}, not gaining actions`,
        );
      }
    },
  },
  'develop': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (hand.length === 0) {
        loggerService.debug(`[develop effect] no cards in hand`);
        return;
      }

      let selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[develop effect] no card selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[develop effect] trashing ${card}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: card.id,
      });

      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        card,
        { playerId: cardEffectArgs.playerId },
      );

      const oneLessCards = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'exact', amount: { treasure: cost.treasure - 1 } },
      ]);

      const oneMoreCards = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'exact', amount: { treasure: cost.treasure + 1 } },
      ]);

      let combined = oneLessCards.concat(oneMoreCards);

      if (!combined) {
        loggerService.debug(`[develop effect] no cards costing 1 less or 1 more in supply`);
        return;
      }

      selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card costing 1 less, or 1 more`,
        restrict: combined.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[develop effect] no card selected`);
        return;
      }

      combined = [];

      let nextPrompt = '';
      if (oneLessCards.findIndex((card) => card.id === selectedCardId) !== -1) {
        loggerService.debug(`[develop effect] card gained was one less`);
        nextPrompt = `Gain card costing 1 more`;
        combined = oneMoreCards;
      } else if (oneMoreCards.findIndex((card) => card.id === selectedCardId) !== -1) {
        loggerService.debug(`[develop effect] card gained was one more`);
        nextPrompt = `Gain card costing 1 less`;
        combined = oneLessCards;
      }

      if (!combined) {
        loggerService.debug(`[develop effect] no remaining cards to gain`);
        return;
      }

      selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: nextPrompt,
        restrict: combined.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[develop effect] no card selected`);
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'farmland': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, rest) => {
        const loggerService = args.loggerService;
        const hand = args.cardSourceController.getSource('playerHand', rest.playerId);
        if (hand.length === 0) {
          loggerService.debug(`[farmland onGained effect] no cards in hand`);
          return;
        }

        let selectedCardId = await args.actionService.run('selectSingleCard', {
          playerId: rest.playerId,
          prompt: `Trash a card`,
          restrict: { location: 'playerHand', playerId: rest.playerId },
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[farmland onGained effect] no card selected`);
          return;
        }

        let selectedCard = args.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[farmland onGained effect] trashing ${selectedCard}`);

        await args.actionService.run('trashCard', {
          playerId: rest.playerId,
          cardId: selectedCard.id,
        });

        const { cost } = args.cardPriceController.applyRules(selectedCard, {
          playerId: rest.playerId,
        });

        const nonFarmlandCards = args.findCardService.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: rest.playerId, kind: 'exact', amount: { treasure: cost.treasure + 2 } },
        ])
          .filter((card) => card.cardKey !== 'farmland');

        if (!nonFarmlandCards) {
          loggerService.debug(
            `[farmland onGained effect] no non-farmland cards costing exactly 2 more than ${selectedCard} in supply`,
          );
          return;
        }

        selectedCardId = await args.actionService.run('selectSingleCard', {
          playerId: rest.playerId,
          prompt: `Gain card`,
          restrict: nonFarmlandCards.map((card) => card.id),
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[farmland onGained effect] no card selected`);
          return;
        }

        selectedCard = args.cardLibrary.getCard(selectedCardId);

        loggerService.debug(`[farmland onGained effect] gaining card ${selectedCard}`);

        await args.actionService.run('gainCard', {
          playerId: rest.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        });
      },
    }),
  },
  'fools-gold': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`fools-gold:${eventArgs.cardId}:cardGained`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `fools-gold:${eventArgs.cardId}:cardGained`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardGained',
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (card.cardKey !== 'province') return false;
            return true;
          },
          triggeredEffectFn: async (triggeredEffectArgs) => {
            loggerService.debug(`[fools-gold triggered effect] trashing fools gold`);
            await triggeredEffectArgs.actionService.run('trashCard', {
              playerId: triggeredEffectArgs.trigger.args.playerId,
              cardId: eventArgs.cardId,
            });

            const goldCardIds = triggeredEffectArgs.findCardService.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'gold' },
            ]);

            if (!goldCardIds.length) {
              loggerService.debug(`[fools-gold triggered effect] no gold cards in supply`);
              return;
            }

            const card = goldCardIds.slice(-1)[0];

            loggerService.debug(`[fools-gold triggered effect] gaining ${card}`);

            await triggeredEffectArgs.actionService.run('gainCard', {
              playerId: eventArgs.playerId,
              cardId: card.id,
              to: { location: 'playerDeck' },
            });
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const foolsGoldPlayedThisTurnCount =
        (cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.stats.turns.length - 1] ?? [])
          .map(cardEffectArgs.cardLibrary.getCard)
          .filter((card) => card.owner === cardEffectArgs.playerId && card.cardKey === 'fools-gold')
          .length;

      loggerService.debug(`[fools-gold effect] fools-gold played this turn ${foolsGoldPlayedThisTurnCount}`);

      if (foolsGoldPlayedThisTurnCount === 1) {
        loggerService.debug(`[fools-gold effect] gaining 1 treasure`);
        await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      } else {
        loggerService.debug(`[fools-gold effect] gaining 4 treasure`);
        await cardEffectArgs.actionService.run('gainTreasure', { count: 4 });
      }
    },
  },
  'guard-dog': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`guard-dog:${eventArgs.cardId}:cardPlayed`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `guard-dog:${eventArgs.cardId}:cardPlayed`,
          listeningFor: 'cardPlayed',
          once: false,
          playerId: eventArgs.playerId,
          allowMultipleInstances: true,
          compulsory: false,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async () => {
            loggerService.debug(`[guard-dog triggered effect] playing guard-dog ${eventArgs.cardId}`);

            await args.actionService.run('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId,
              overrides: {
                actionCost: 0,
              },
            });
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[guard-dog effect] drawing 2 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (hand.length <= 5) {
        loggerService.debug(`[guard-dog effect] hand size is ${hand.length}, drawing 2 more cards`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      }
    },
  },
  'haggler': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`haggler:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[haggler effect] gaining 2 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `haggler:${cardEffectArgs.cardId}:cardGained`,
        listeningFor: 'cardGained',
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        playerId: cardEffectArgs.playerId,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (!conditionArgs.trigger.args.bought) return false;
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const card = triggeredEffectArgs.cardLibrary.getCard(triggeredEffectArgs.trigger.args.cardId);

          const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
            playerId: cardEffectArgs.playerId,
          });

          const cards = cardEffectArgs.findCardService.findCards([
            { location: ['basicSupply', 'kingdomSupply'] },
            {
              playerId: cardEffectArgs.playerId,
              kind: 'upTo',
              amount: { treasure: cost.treasure - 1, potion: cost.potion },
            },
          ])
            .filter((card) => !card.type.includes('VICTORY'));

          if (cards.length === 0) {
            loggerService.debug(
              `[haggler triggered effect] no cards non-victory cards costing 2 less than ${cost.treasure}`,
            );
            return;
          }

          const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain non-Victory card`,
            restrict: cards.map((card) => card.id),
            count: 1,
          });

          if (!selectedCardId) {
            loggerService.debug(`[haggler triggered effect] no card selected`);
            return;
          }

          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

          loggerService.debug(`[haggler triggered effect] gaining ${selectedCard}`);

          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: { location: 'playerDiscard' },
          }, { loggingContext: { source: cardEffectArgs.cardId } });
        },
      });
    },
  },
  'highway': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[highway effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const cards = cardEffectArgs.cardLibrary.getAllCardsAsArray();

      const unsubs: (() => void)[] = [];

      const rule: CardPriceRule = (card, context) => {
        return { restricted: false, cost: { treasure: -1, potion: 0 } };
      };

      for (const card of cards) {
        unsubs.push(cardEffectArgs.cardPriceController.registerRule(card, rule));
      }

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `highway:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        condition: () => true,
        once: true,
        compulsory: true,
        playerId: cardEffectArgs.playerId,
        allowMultipleInstances: true,
        triggeredEffectFn: async () => {
          unsubs.forEach((c) => c());
        },
      });
    },
  },
  'inn': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const actionsInDiscard = args.findCardService.findCards({
          location: 'playerDiscard',
          playerId: eventArgs.playerId,
        })
          .filter((card) => card.type.includes('ACTION'));

        if (!actionsInDiscard.length) {
          loggerService.debug(`[inn onGained effect] no actions in discard`);
          return;
        }

        const result = await args.promptService.requestActionResult<CardId[]>({
          prompt: 'Reveal actions to shuffle into deck?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'DONE', action: 1 },
          ],
          content: {
            type: 'select',
            cardIds: actionsInDiscard.map((card) => card.id),
            selectCount: {
              kind: 'upTo',
              count: actionsInDiscard.length,
            },
          },
        });

        if (!result?.result?.length) {
          loggerService.debug(`[inn onGained effect] no cards selected`);
          return;
        }

        loggerService.debug(`[inn onGained effect] revealing ${result.result.length} cards and moving to deck`);

        for (const cardId of result.result) {
          await args.actionService.run('revealCard', {
            cardId: cardId,
            playerId: eventArgs.playerId,
          });

          await args.actionService.run('moveCard', {
            cardId: cardId,
            toPlayerId: eventArgs.playerId,
            to: { location: 'playerDeck' },
          });
        }

        loggerService.debug(`[inn onGained effect] shuffling player deck`);

        fisherYatesShuffle(args.cardSourceController.getSource('playerDeck', eventArgs.playerId), true);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[inn effect] drawing 2 cards, and gaining 2 actions`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: Math.min(
          2,
          cardEffectArgs.findCardService.findCards({
            location: 'playerHand',
            playerId: cardEffectArgs.playerId,
          }).length,
        ),
      });

      if (!selectedCardIds) {
        loggerService.warn(`[inn effect] no card selected`);
        return;
      }

      loggerService.debug(`[inn effect] discarding ${selectedCardIds.length} cards`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('discardCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
        });
      }
    },
  },
  'jack-of-all-trades': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const silverCardIds = cardEffectArgs.findCardService.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'silver' },
      ]);

      if (!silverCardIds.length) {
        loggerService.debug(`[jack-of-all-trades effect] no silver cards in supply`);
      } else {
        loggerService.debug(`[jack-of-all-trades effect] gaining a silver`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }

      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

      if (deck.length === 0) {
        loggerService.debug(`[jack-of-all-trades effect] no cards in deck, shuffling`);
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId: cardEffectArgs.playerId });
      }

      if (deck.length === 0) {
        loggerService.debug(`[jack-of-all-trades effect] no cards in deck after shuffling`);
      } else {
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);

        const action = await cardEffectArgs.promptService.requestAction({
          prompt: `Discard ${card.cardName}`,
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 },
            { label: 'DISCARD', action: 2 },
          ],
        });

        if (action === 2) {
          loggerService.debug(`[jack-of-all-trades effect] discarding ${card}`);
          await cardEffectArgs.actionService.run('discardCard', {
            cardId,
            playerId: cardEffectArgs.playerId,
          });
        }
      }

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      while (deck.length > 0 && hand.length < 5) {
        loggerService.debug(`[jack-of-all-trades effect] drawing card`);
        await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      }

      const nonTreasureCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard)
        .filter((card) => !card.type.includes('TREASURE'));

      if (nonTreasureCardsInHand.length === 0) {
        loggerService.debug(`[jack-of-all-trades effect] no non-treasure cards in hand`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash a card`,
        restrict: nonTreasureCardsInHand.map((card) => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[jack-of-all-trades effect] no card selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[jack-of-all-trades effect] trashing ${card}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'margrave': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[margrave effect] drawing 3 cards, and gaining 1 buy`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER',
      }).filter((playerId) => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.actionService.run('drawCard', { playerId: targetPlayerId });

        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        const numToDiscard = hand.length > 3 ? hand.length - 3 : 0;

        if (numToDiscard === 0) {
          loggerService.debug(`[margrave effect] player ${targetPlayerId} already at 3 or less cards`);
          continue;
        }

        loggerService.debug(`[margrave effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);

        const selectedCardId = await cardEffectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard card/s`,
          restrict: hand,
          count: numToDiscard,
        });

        if (!selectedCardId.length) {
          loggerService.warn(`[margrave effect] no card selected`);
          continue;
        }

        for (let i = 0; i < selectedCardId.length; i++) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: selectedCardId[i],
            playerId: targetPlayerId,
          });
        }
      }
    },
  },
  'nomads': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        if (eventArgs.playerId !== getCurrentPlayer(args.match).id) {
          return;
        }

        loggerService.debug(`[nomads onTrashed effect] gaining 2 treasure`);
        await args.actionService.run('gainTreasure', { count: 2 });
      },
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        if (eventArgs.playerId !== getCurrentPlayer(args.match).id) {
          return;
        }

        loggerService.debug(`[nomads onGained effect] gaining 2 treasure`);
        await args.actionService.run('gainTreasure', { count: 2 });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[nomads effect] gaining 1 buy, and 2 treasure`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
    },
  },
  'oasis': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[oasis effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[oasis effect] no card selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[oasis effect] discarding ${card}`);

      await cardEffectArgs.actionService.run('discardCard', { cardId: card.id, playerId: cardEffectArgs.playerId });
    },
  },
  'scheme': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[scheme effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `scheme:${cardEffectArgs.cardId}:discardCard`,
        listeningFor: 'discardCard',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async (conditionArgs) => {
          if (!conditionArgs.trigger.args.previousLocation) return false;
          if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation.location)) return false;
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (card.owner !== cardEffectArgs.playerId) return false;
          if (!card.type.includes('ACTION')) return false;

          const action = await conditionArgs.promptService.requestAction({
            prompt: `Top-deck ${card.cardName}?`,
            playerId: conditionArgs.trigger.args.playerId,
            actionButtons: [
              { label: 'CANCEL', action: 1 },
              { label: 'CONFIRM', action: 2 },
            ],
          });
          if (action === 1 || action === null) return false;

          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const card = triggeredEffectArgs.cardLibrary.getCard(triggeredEffectArgs.trigger.args.cardId);

          loggerService.debug(`[scheme triggered effect] moving ${card} to deck`);

          await triggeredEffectArgs.actionService.run('moveCard', {
            cardId: triggeredEffectArgs.trigger.args.cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });
    },
  },
  'souk': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const numToTrash = Math.min(2, args.cardSourceController.getSource('playerHand', eventArgs.playerId).length);
        const selectedCardId = await args.actionService.run('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Trash card/s`,
          restrict: { location: 'playerHand', playerId: eventArgs.playerId },
          count: {
            kind: 'upTo',
            count: numToTrash,
          },
          optional: true,
        });

        if (!selectedCardId.length) {
          loggerService.debug(`[souk onGained effect] no card selected`);
          return;
        }

        loggerService.debug(`[souk onGained effect] trashing ${selectedCardId.length} cards`);

        for (const cardId of selectedCardId) {
          await args.actionService.run('trashCard', {
            playerId: eventArgs.playerId,
            cardId: cardId,
          });
        }
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[souk effect] gaining 1 buy, and gaining 7 treasure`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 7 });

      const handSize = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length;
      const numToLose = Math.min(cardEffectArgs.match.playerTreasure, handSize);
      loggerService.debug(`[souk effect] losing ${numToLose} treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: -handSize });
    },
  },
  'spice-merchant': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const treasuresInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter((card) => card.type.includes('TREASURE'));

      if (!treasuresInHand.length) {
        loggerService.debug(`[spice-merchant effect] no treasure cards in hand`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: treasuresInHand.map((card) => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[spice-merchant effect] no card selected`);
        return;
      }

      const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[spice-merchant effect] trashing ${card}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: card.id,
      });

      const action = await cardEffectArgs.promptService.requestAction({
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: '+2 Cards, + 1 Action', action: 1 },
          { label: '+1 Buy, +2 Treasure', action: 2 },
        ],
      });

      switch (action) {
        case 1:
          loggerService.debug(`[spice-merchant effect] drawing 2 cards and gaining 1 action`);
          await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
          await cardEffectArgs.actionService.run('gainAction', { count: 1 });
          break;
        case 2:
          loggerService.debug(`[spice-merchant effect] gaining 1 buy, and 2 treasure`);
          await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
          await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
          break;
      }
    },
  },
  'stables': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const treasuresInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter((card) => card.type.includes('TREASURE'));

      if (!treasuresInHand.length) {
        loggerService.debug(`[stables effect] no treasure cards in hand`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: treasuresInHand.map((card) => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[stables effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[stables effect] discarding ${selectedCard}`);

      await cardEffectArgs.actionService.run('discardCard', {
        cardId: selectedCard.id,
        playerId: cardEffectArgs.playerId,
      });

      loggerService.debug(`[stables effect] drawing 3 cards, and gaining 1 action `);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  'trader': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`trader:${eventArgs.cardId}:cardGained`);
      },
      onEnterHand: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        args.reactionManager.registerReactionTemplate({
          id: `trader:${eventArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          playerId: eventArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggerArgs) => {
            const traderCard = triggerArgs.cardLibrary.getCard(eventArgs.cardId);

            loggerService.debug(`[trader onEnterHand event] revealing trader`);

            await triggerArgs.actionService.run('revealCard', {
              cardId: traderCard.id,
              playerId: eventArgs.playerId,
            });

            const gainedCard = triggerArgs.cardLibrary.getCard(triggerArgs.trigger.args.cardId);

            if (triggerArgs.trigger.args.previousLocation) {
              loggerService.debug(`[trader onEnterHand event] putting ${gainedCard} back in previous location`);
              await triggerArgs.actionService.run('moveCard', {
                cardId: gainedCard.id,
                toPlayerId: triggerArgs.trigger.args.previousLocation.playerId,
                to: { location: triggerArgs.trigger.args.previousLocation.location },
              });
            } else {
              loggerService.warn(`[trader onEnterHand event] gained ${gainedCard} has no previous location`);
            }

            const silverCardIds = triggerArgs.findCardService.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'silver' },
            ]);

            if (!silverCardIds.length) {
              loggerService.debug(`[trader onEnterHand event] no silvers in supply`);
              return;
            }

            const silverCard = silverCardIds[0];

            loggerService.debug(`[trader onEnterHand event] gaining ${silverCard} instead`);
            await triggerArgs.actionService.run('moveCard', {
              cardId: silverCard.id,
              toPlayerId: eventArgs.playerId,
              to: { location: 'playerDiscard' },
            });
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length === 0) {
        loggerService.debug(`[trader effect] no cards in hand`);
        return;
      }
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[trader effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[trader effect] trashing ${selectedCard}`);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });

      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        selectedCard,
        { playerId: cardEffectArgs.playerId },
      );

      const silverCardIds = cardEffectArgs.findCardService.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'silver' },
      ]);

      if (!silverCardIds.length) {
        loggerService.debug(`[trader effect] no silver cards in supply`);
        return;
      }

      const numToGain = Math.min(silverCardIds.length, cost.treasure);

      loggerService.debug(`[trader effect] gaining ${numToGain} silver cards`);

      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCardIds.slice(-i - 1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'trail': {
    registerLifeCycleMethods: () => {
      async function doTrail(args: CardLifecycleCallbackContext, eventArgs: { playerId: PlayerId; cardId: CardId }) {
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          args.loggerService.debug(`[trail onGained/Trashed/Discarded event] happening during clean-up, skipping`);
          return;
        }

        const action = await args.promptService.requestAction({
          prompt: 'Play Trail?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 },
            { label: 'PLAY', action: 2 },
          ],
        });

        if (action === 1 || action === null) {
          args.loggerService.debug(`[trail onGained/Trashed/Discarded event] not playing trail`);
          return;
        }

        args.loggerService.debug(`[trail onGained/Trashed/Discarded event] playing trail`);

        await args.actionService.run('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
          overrides: {
            actionCost: 0,
          },
        });
      }

      return {
        onGained: async (args, eventArgs) => {
          await doTrail(args, eventArgs);
        },
        onTrashed: async (args, eventArgs) => {
          await doTrail(args, eventArgs);
        },
        onDiscarded: async (args, eventArgs) => {
          await doTrail(args, eventArgs);
        },
      };
    },
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[trail effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  'tunnel': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          loggerService.debug(`[tunnel onDiscarded event] happening during clean-up, skipping`);
          return;
        }

        const action = await args.promptService.requestAction({
          prompt: 'Reveal tunnel?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 },
            { label: 'REVEAL', action: 2 },
          ],
        });

        if (action === 1 || action === null) {
          loggerService.debug(`[tunnel onDiscarded event] not revealing tunnel`);
          return;
        }

        loggerService.debug(`[tunnel onDiscarded event] revealing tunnel`);

        await args.actionService.run('revealCard', {
          cardId: eventArgs.cardId,
          playerId: eventArgs.playerId,
        });

        const goldCardIds = args.findCardService.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'gold' },
        ]);

        if (!goldCardIds.length) {
          loggerService.debug(`[tunnel onDiscarded event] no gold cards in supply`);
          return;
        }

        const goldCard = goldCardIds.slice(-1)[0];

        loggerService.debug(`[tunnel onDiscarded event] gaining ${goldCard}`);

        await args.actionService.run('gainCard', {
          playerId: eventArgs.playerId,
          cardId: goldCard.id,
          to: { location: 'playerDiscard' },
        });
      },
    }),
  },
  'weaver': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          loggerService.debug(`[weaver onDiscarded event] happening during clean-up, skipping`);
          return;
        }

        const action = await args.promptService.requestAction({
          prompt: 'Play Weaver?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 },
            { label: 'PLAY', action: 2 },
          ],
        });

        if (action === 1 || action === null) {
          loggerService.debug(`[weaver onDiscarded event] not playing weaver`);
          return;
        }

        loggerService.debug(`[weaver onDiscarded event] playing weaver`);

        await args.actionService.run('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const action = await cardEffectArgs.promptService.requestAction({
        prompt: 'Choose two silvers, or gain a card costing up to $4',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'SILVERS', action: 1 },
          { label: 'GAIN CARD', action: 2 },
        ],
      });

      if (action === 1) {
        loggerService.debug(`[weaver effect] choosing silvers`);

        const silverCardIds = cardEffectArgs.findCardService.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'silver' },
        ]);

        if (!silverCardIds.length) {
          loggerService.debug(`[weaver effect] no silver cards in supply`);
          return;
        }

        const numToGain = Math.min(silverCardIds.length, 2);

        loggerService.debug(`[weaver effect] gaining ${numToGain} silver cards`);

        for (let i = 0; i < numToGain; i++) {
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCardIds.slice(-i - 1)[0].id,
            to: { location: 'playerDiscard' },
          });
        }
      } else {
        loggerService.debug(`[weaver effect] choosing card costing up to $4`);

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } },
          ],
          count: 1,
        });

        if (!selectedCardId) {
          loggerService.warn(`[weaver effect] no card selected`);
          return;
        }
      }
    },
  },
  'wheelwright': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);

      if (hand.length === 0) {
        loggerService.debug(`[wheelwright effect] no cards in hand`);
        return;
      }

      let selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[wheelwright effect] no card selected`);
        return;
      }

      let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      await cardEffectArgs.actionService.run('discardCard', {
        cardId: selectedCard.id,
        playerId: cardEffectArgs.playerId,
      });

      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      });

      const actionCardIds = cardEffectArgs.findCardService.findCards([
        { location: ['kingdomSupply'] },
        { cardType: 'ACTION' },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: cost.treasure, potion: cost.potion },
        },
      ]);

      if (!actionCardIds) {
        loggerService.debug(`[wheelwright effect] no action cards in kingdom`);
        return;
      }

      selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: actionCardIds.map((card) => card.id),
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[wheelwright effect] no card selected`);
        return;
      }

      selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[wheelwright effect] gaining ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'witchs-hut': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.debug(`[witchs-hut effect] drawing 4 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 4 });

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: Math.min(2, cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length),
      });

      loggerService.debug(`[witchs-hut effect] revealing and discarding ${selectedCardIds.length} cards`);

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('revealCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
        });

        await cardEffectArgs.actionService.run('discardCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
        });
      }

      if (selectedCardIds.length === 2) {
        if (selectedCardIds.map(cardEffectArgs.cardLibrary.getCard).every((card) => card.type.includes('ACTION'))) {
          loggerService.debug(`[witchs-hut effect] every card discarded is an action, others gaining a curse`);

          const targetPlayerIds = findOrderedTargets({
            match: cardEffectArgs.match,
            startingPlayerId: cardEffectArgs.playerId,
            appliesTo: 'ALL_OTHER',
          }).filter((playerId) => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

          for (const targetPlayerId of targetPlayerIds) {
            const curseCardIds = cardEffectArgs.findCardService.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'curse' },
            ]);

            if (!curseCardIds.length) {
              loggerService.debug(`[witchs-hut effect] no curse cards in supply`);
              return;
            }

            const curseCard = curseCardIds.slice(-1)[0];

            loggerService.debug(`[witchs-hut effect] gaining ${curseCard} to ${targetPlayerId}`);

            await cardEffectArgs.actionService.run('gainCard', {
              playerId: targetPlayerId,
              cardId: curseCard.id,
              to: { location: 'playerDiscard' },
            });
          }
        } else {
          loggerService.debug(`[witchs-hut effect] not every card discarded is an action`);
        }
      }
    },
  },
};

export default expansion;
