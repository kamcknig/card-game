import { CardExpansionModule } from '@server-types/index.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { Card, CardId, CardKey, CountSpec } from 'shared/types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { adventuresTokenIds } from './token-ids-adventures.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { findEventInMatch } from '@shared/find-card-like-in-match.ts';

const effectMap: CardExpansionModule = {
  'alms': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) return;

      const priceRule: CardPriceRule = (card, context) => {
        if (context.playerId === cardEffectArgs.playerId) {
          return { restricted: true, cost: card.cost };
        }
        return { restricted: false, cost: card.cost };
      };

      const ruleUnsub = cardEffectArgs.cardPriceController.registerRule(
        event,
        priceRule,
      );

      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async () => true,
        triggeredEffectFn: async () => {
          ruleUnsub();
        },
      });

      const treasuresInPlay = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.type.includes('TREASURE'))
        .filter((card) => card.owner === cardEffectArgs.playerId);

      if (treasuresInPlay.length > 0) {
        loggerService.debug(
          `[alms effect] ${treasuresInPlay.length} treasures in play, not gaining card`,
        );
        return;
      }

      const cards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: 4 },
        },
      ] });

      if (!cards.length) {
        loggerService.debug(`[alms effect] no cards to gain`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map((card) => card.id),
          count: 1,
        },
      );

      if (!selectedCardIds.length) {
        loggerService.warn(`[alms effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(
        selectedCardIds[0],
      );

      loggerService.debug(`[alms effect] gaining card ${selectedCard}`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'ball': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[ball effect] event not found`);
        return;
      }

      // Take the -$1 token once if the player does not already have it.
      const alreadyHasToken = Object.values(cardEffectArgs.match.tokens ?? {})
        .some((token) =>
          token.tokenId === adventuresTokenIds.minusCoin &&
          token.ownerId === cardEffectArgs.playerId &&
          token.location.type === 'player' &&
          token.location.playerId === cardEffectArgs.playerId
        );
      if (!alreadyHasToken) {
        loggerService.debug(
          `[ball effect] placing -$1 token for player ${cardEffectArgs.playerId}`,
        );
        await cardEffectArgs.actionService.run('placeToken', {
          tokenId: adventuresTokenIds.minusCoin,
          ownerId: cardEffectArgs.playerId,
          location: { type: 'player', playerId: cardEffectArgs.playerId },
          sourceCardId: event.id,
        }, { loggingContext: { source: event.id } });
      }

      const cards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: 4 },
        },
      ] });

      if (!cards.length) {
        loggerService.debug(`[ball effect] no cards to gain`);
        return;
      }

      const gainCount = Math.min(2, cards.length);

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain ${gainCount} card${gainCount === 1 ? '' : 's'}`,
          restrict: cards.map((card) => card.id),
          count: gainCount,
        },
      );

      if (!selectedCardIds.length) {
        loggerService.warn(`[ball effect] no card selected`);
        return;
      }

      for (const selectedCardId of selectedCardIds) {
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        loggerService.debug(`[ball effect] gaining ${selectedCard}`);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'bonfire': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const coppersInPlay = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.cardKey === 'copper' && card.owner === cardEffectArgs.playerId);

      if (!coppersInPlay.length) {
        loggerService.debug(`[bonfire effect] no coppers in play`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash coppers`,
          restrict: coppersInPlay.map((card) => card.id),
          count: { kind: 'upTo', count: 2 },
        },
      );

      if (!selectedCardIds.length) {
        loggerService.warn(`[bonfire effect] no card selected`);
        return;
      }

      loggerService.debug(
        `[bonfire effect] trashing ${selectedCardIds.length} cards`,
      );

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
      }
    },
  },
  'expedition': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[expedition effect] event not found`);
        return;
      }

      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        'endTurnPhase',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs) => {
            if (
              conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId
            ) return false;
            if (
              getTurnPhase(conditionArgs.match.turnPhaseIndex) !== 'cleanup'
            ) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.warn(
              `[expedition effect] i have programmed this to use the reaction system, but technically the effect should modify the amount of cards drawn, and not take place at the end of cleanup`,
            );

            loggerService.debug(`[expedition endTurnPhase effect] drawing 2 cards`);
            await cardEffectArgs.actionService.run('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 2,
            });
          },
        },
      );
    },
  },
  'plan': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[plan effect] event not found`);
        return;
      }

      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileDefinitionCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes('ACTION')) return null;
          return getCardPileKey(pileCard);
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        loggerService.warn(`[plan effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.actionService.run(
        'userPrompt',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Which Action supply?',
          content: {
            type: 'select-pile',
            pileNames: actionSupplyPiles,
            selectCount: { kind: 'exact', count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        loggerService.warn(`[plan effect] no pile selected`);
        return;
      }

      loggerService.debug(`[plan effect] moving Trashing token to ${selectedPile}`);

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.trashing &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        loggerService.warn(`[plan effect] no Trashing token found for player`);
        return;
      }

      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'supplyPile', cardKey: selectedPile },
      }, { loggingContext: { source: event.id } });
    },
  },
  'ferry': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[ferry effect] event not found`);
        return;
      }

      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileDefinitionCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes('ACTION')) return null;
          return getCardPileKey(pileCard);
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        loggerService.warn(`[ferry effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.actionService.run(
        'userPrompt',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Which Action supply?',
          content: {
            type: 'select-pile',
            pileNames: actionSupplyPiles,
            selectCount: { kind: 'exact', count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        loggerService.warn(`[ferry effect] no pile selected`);
        return;
      }

      loggerService.debug(`[ferry effect] moving -$2 cost token to ${selectedPile}`);

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.minusCostTwo &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        loggerService.warn(`[ferry effect] no -$2 cost token for player`);
        return;
      }

      // Register the Ferry cost rule the first time the token is placed.
      const cards = cardEffectArgs.cardLibrary.getAllCardsAsArray().filter(
        (c) => getCardPileKey(c) === selectedPile,
      );

      // todo: this never cleans up old rules, but those old rules won't work when a token moves because the rule
      // checks the location s that's ok. but it really should be cleaned up. there isn'ta  good way in general to
      // track price rules per effect/card/etc
      for (const card of cards) {
        const rule: CardPriceRule = (_card, ruleContext) => {
          const currentPlayer = getCurrentPlayer(ruleContext.match);
          const tokenMatchesTurn = Object.values(ruleContext.match.tokens ?? {})
            .some((token) =>
              token.tokenId === adventuresTokenIds.minusCostTwo &&
              token.ownerId === currentPlayer.id &&
              token.location.type === 'supplyPile' &&
              token.location.cardKey === selectedPile
            );
          if (!tokenMatchesTurn) {
            return { restricted: false, cost: { treasure: 0 } };
          }
          return { restricted: false, cost: { treasure: -2 } };
        };
        cardEffectArgs.cardPriceController.registerRule(card, rule);
      }

      // Place the -$2 cost token on the chosen pile if it does not exist yet.
      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'supplyPile', cardKey: selectedPile },
      }, { loggingContext: { source: event.id } });
    },
  },
  'inheritance': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[inheritance effect] event not found`);
        return;
      }

      const eligibleCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardType: ['ACTION'] },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: 4, potion: 0 },
        },
      ] }).filter((card) => !card.type.includes('DURATION') && !card.type.includes('COMMAND'));

      if (!eligibleCards.length) {
        loggerService.warn(`[inheritance effect] no eligible Action cards in supply`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Set aside Action card',
          restrict: eligibleCards.map((card) => card.id),
          count: 1,
        },
      );

      if (!selectedCardIds.length) {
        loggerService.warn(`[inheritance effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(
        selectedCardIds[0],
      );

      loggerService.debug(`[inheritance effect] setting aside ${selectedCard}`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'set-aside' },
      });

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.estate &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        loggerService.warn(`[inheritance effect] no Estate token found for player`);
        return;
      }

      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'card', cardId: selectedCard.id },
      }, { loggingContext: { source: event.id } });

      cardEffectArgs.cardPriceController.registerRule(event, (card, context) => {
        if (card.cardKey === 'inheritance' && context.playerId === cardEffectArgs.playerId) {
          return { restricted: true, cost: card.cost };
        }

        return { restricted: false, cost: card.cost };
      });

      const registerCardPlayedReaction = () => {
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `inheritance:${cardEffectArgs.playerId}:cardPlayed`,
          listeningFor: 'afterCardPlayed',
          playerId: cardEffectArgs.playerId,
          system: true,
          autoResolve: true,
          compulsory: true,
          allowMultipleInstances: false,
          condition: async (conditionEffectArgs) => {
            if (conditionEffectArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            const card = conditionEffectArgs.cardLibrary.getCard(conditionEffectArgs.trigger.args.cardId);
            if (card.cardKey !== 'estate') return false;
            const token = Object.values(conditionEffectArgs.match.tokens).find((t) =>
              t.ownerId === conditionEffectArgs.trigger.args.playerId &&
              t.tokenId === adventuresTokenIds.estate &&
              t.location.type === 'card'
            );
            return !!token;
          },
          triggeredEffectFn: async (triggerEffectArgs) => {
            const token = Object.values(triggerEffectArgs.match.tokens).find((t) =>
              t.ownerId === triggerEffectArgs.trigger.args.playerId &&
              t.tokenId === adventuresTokenIds.estate &&
              t.location.type === 'card'
            );

            if (!token || token.location.type !== 'card') {
              loggerService.warn(`[inheritance] card played triggered - no estate token found or not on a card`);
              return;
            }

            loggerService.log(`[inheritance] card played trigger - player estate token card`);

            await triggerEffectArgs.actionService.run('playCard', {
              cardId: token.location.cardId,
              playerId: triggerEffectArgs.trigger.args.playerId,
              overrides: {
                actionCost: 0,
                moveCard: false,
              },
            });
          },
        });
      };

      registerCardPlayedReaction();

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `inheritance:${cardEffectArgs.playerId}:startTurn`,
        listeningFor: 'startTurn',
        system: true,
        once: false,
        playerId: cardEffectArgs.playerId,
        compulsory: true,
        autoResolve: true,
        allowMultipleInstances: false,
        condition: async (conditionEffectArgs) => conditionEffectArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggerEffectArgs) => {
          triggerEffectArgs.reactionManager.registerReactionTemplate({
            id: `inheritance:${triggerEffectArgs.trigger.args.playerId}:endTurn`,
            playerId: triggerEffectArgs.trigger.args.playerId,
            once: true,
            allowMultipleInstances: false,
            compulsory: true,
            autoResolve: true,
            listeningFor: 'endTurn',
            condition: async (endTurnConditionEffectArgs) =>
              endTurnConditionEffectArgs.trigger.args.playerId === triggerEffectArgs.trigger.args.playerId,
            triggeredEffectFn: async (endTurnTriggerEffectArgs) => {
              loggerService.log(`[inheritance] end turn trigger - unregistering card played reaction`);
              endTurnTriggerEffectArgs.reactionManager.unregisterTrigger(
                `inheritance:${endTurnTriggerEffectArgs.trigger.args.playerId}:cardPlayed`,
              );
            },
          });

          loggerService.log(`[inheritance] registering card played reaction`);

          registerCardPlayedReaction();
        },
      });
    },
  },
  'pilgrimage': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Load the event instance so we can scope 'once per turn' price rules.
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[pilgrimage effect] event not found`);
        return;
      }

      // Enforce 'once per turn' by restricting this event for the current player until end of turn.
      const priceUnsub = cardEffectArgs.cardPriceController.registerRule(
        event,
        (card, context) => {
          if (context.playerId === cardEffectArgs.playerId) {
            return { restricted: true, cost: card.cost };
          }
          return { restricted: false, cost: card.cost };
        },
      );
      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async () => true,
        triggeredEffectFn: async () => {
          priceUnsub();
        },
      });

      // Resolve the current player's Journey token, ensuring it exists.
      const existingJourneyTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      ).find(([_tokenInstanceId, token]) =>
        token.tokenId === adventuresTokenIds.journey &&
        token.ownerId === cardEffectArgs.playerId &&
        token.location.type === 'player' &&
        token.location.playerId === cardEffectArgs.playerId
      );
      const journeyTokenInstanceId = existingJourneyTokenEntry?.[0];
      const journeyToken = existingJourneyTokenEntry?.[1];

      if (!journeyTokenInstanceId || !journeyToken) {
        loggerService.warn(`[pilgrimage effect] no journey token for player`);
        return;
      }

      // Flip the Journey token before checking its facing.
      const currentFacing = journeyToken.facing ?? 'faceUp';
      const nextFacing = currentFacing === 'faceUp' ? 'faceDown' : 'faceUp';

      await cardEffectArgs.actionService.run('flipToken', {
        tokenInstanceId: journeyTokenInstanceId,
        facing: nextFacing,
      });

      if (nextFacing === 'faceDown') {
        loggerService.debug(`[pilgrimage effect] Journey face down, no gains`);
        return;
      }

      // Collect unique in-play cards with supply copies available.
      const inPlayCards = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.owner === cardEffectArgs.playerId);
      const uniqueSupplyInPlay: Card[] = [];
      const seenCardKeys = new Set<CardKey>();

      for (const card of inPlayCards) {
        if (seenCardKeys.has(card.cardKey)) continue;
        const supplyTopCard = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
          pileKey: getCardPileKey(card),
        });
        if (!supplyTopCard) continue;
        seenCardKeys.add(card.cardKey);
        uniqueSupplyInPlay.push(card);
      }

      if (!uniqueSupplyInPlay.length) {
        loggerService.debug(`[pilgrimage effect] no eligible cards in play`);
        return;
      }

      // Choose up to 3 differently named cards from the eligible in-play list.
      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose up to 3 cards in play',
          restrict: uniqueSupplyInPlay.map((card) => card.id),
          count: { kind: 'upTo', count: Math.min(3, uniqueSupplyInPlay.length) },
        },
      );

      if (!selectedCardIds.length) {
        loggerService.debug(`[pilgrimage effect] no cards selected`);
        return;
      }

      // Allow the player to set the gain order when multiple cards were selected.
      let orderedSelection = selectedCardIds;
      if (selectedCardIds.length > 1) {
        const orderResult = await cardEffectArgs.actionService.run(
          'userPrompt',
          {
            playerId: cardEffectArgs.playerId,
            prompt: 'Choose gain order',
            content: {
              type: 'rearrange',
              cardIds: selectedCardIds,
            },
            actionButtons: [{ label: 'DONE', action: 1 }],
          },
        ) as { action: number; result: CardId[] };
        if (orderResult?.result?.length) {
          orderedSelection = orderResult.result;
        }
      }

      // Gain a copy of each selected card from the Supply, in the chosen order.
      for (const selectedCardId of orderedSelection) {
        const selectedCard = cardEffectArgs.cardLibrary.getCard(
          selectedCardId,
        );
        await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: getCardPileKey(selectedCard),
          to: { location: 'playerDiscard' },
          logTag: 'pilgrimage effect',
        });
      }
    },
  },
  'lost-arts': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileDefinitionCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes('ACTION')) return null;
          return getCardPileKey(pileCard);
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        loggerService.warn(`[lost-arts effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.actionService.run(
        'userPrompt',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Which Action supply?',
          content: {
            type: 'select-pile',
            pileNames: actionSupplyPiles,
            selectCount: { kind: 'exact', count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        loggerService.warn(`[lost-arts effect] no pile selected`);
        return;
      }

      loggerService.debug(`[lost-arts effect] moving +1 Action token to ${selectedPile}`);

      // Find the player's +1 Action token instance to move.
      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.plusAction &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        loggerService.warn(`[lost-arts effect] no +1 Action token found for player`);
        return;
      }

      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'supplyPile', cardKey: selectedPile },
      }, { loggingContext: { source: cardEffectArgs.cardId } });
    },
  },
  'mission': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[mission effect] event not found`);
        return;
      }

      // Queue the extra turn and tag it with the Mission event id so buy restrictions can be applied on that turn.
      loggerService.debug(`[mission effect] queueing extra turn for player ${cardEffectArgs.playerId}`);
      await cardEffectArgs.actionService.run('queueExtraTurn', {
        turn: {
          playerId: cardEffectArgs.playerId,
          sourceId: event.id,
        },
      });

      // Apply Mission's "you can't buy cards" restriction at the start of the Mission extra turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          // Mission restriction only applies on the turn created by this Mission event.
          const currentTurnStats = conditionArgs.match.stats.turns[conditionArgs.match.stats.turns.length - 1];
          if (!currentTurnStats) {
            return false;
          }

          return currentTurnStats.playerId === cardEffectArgs.playerId && currentTurnStats.sourceId === event.id;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          loggerService.debug(
            `[mission startTurn effect] applying buy restriction for player ${cardEffectArgs.playerId}`,
          );

          const missionBuyRestrictionRule: CardPriceRule = (_card, context) => {
            if (context.playerId !== cardEffectArgs.playerId) {
              return { restricted: false, cost: { treasure: 0 } };
            }
            return { restricted: true, cost: { treasure: 0 } };
          };

          // Apply to every card so buys from any source (including non-supply buys) are restricted.
          const ruleUnsubs = cardEffectArgs.cardLibrary
            .getAllCardsAsArray()
            .map((card) => cardEffectArgs.cardPriceController.registerRule(card, missionBuyRestrictionRule));

          // Remove Mission's buy restriction when the Mission turn ends.
          triggeredArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
            playerId: cardEffectArgs.playerId,
            once: true,
            allowMultipleInstances: true,
            compulsory: true,
            condition: async (endTurnArgs) => endTurnArgs.trigger.args.playerId === cardEffectArgs.playerId,
            triggeredEffectFn: async () => {
              loggerService.debug(
                `[mission endTurn effect] removing buy restriction for player ${cardEffectArgs.playerId}`,
              );
              for (const ruleUnsub of ruleUnsubs) {
                ruleUnsub();
              }
            },
          });
        },
      });
    },
  },
  'pathfinding': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[pathfinding effect] event not found`);
        return;
      }

      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileDefinitionCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes('ACTION')) return null;
          return getCardPileKey(pileCard);
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        loggerService.warn(`[pathfinding effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.actionService.run(
        'userPrompt',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Which Action supply?',
          content: {
            type: 'select-pile',
            pileNames: actionSupplyPiles,
            selectCount: { kind: 'exact', count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        loggerService.warn(`[pathfinding effect] no pile selected`);
        return;
      }

      loggerService.debug(`[pathfinding effect] moving +1 Card token to ${selectedPile}`);

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.plusCard &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        loggerService.warn(`[pathfinding effect] no +1 Card token found for player`);
        return;
      }

      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'supplyPile', cardKey: selectedPile },
      }, { loggingContext: { source: event.id } });
    },
  },
  'quest': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = cardEffectArgs.cardSourceController.getSource(
        'playerHand',
        cardEffectArgs.playerId,
      );
      const handCards = hand.map(cardEffectArgs.cardLibrary.getCard);

      const result = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: 'DISCARD ATTACK', action: 1 },
          { label: 'DISCARD 2 COPPER', action: 2 },
          { label: 'DISCARD 6 CARDS', action: 3 },
        ],
      }) as { action: number; result: number[] };

      let selectedCardIds: CardId[] = [];
      let gainGold = false;

      if (result.action === 1) {
        selectedCardIds = await cardEffectArgs.actionService.run(
          'selectCard',
          {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard attack`,
            restrict: handCards.filter((card) => card.type.includes('ATTACK'))
              .map((card) => card.id),
            count: { kind: 'upTo', count: hand.length },
          },
        );
        gainGold = true;
      } else if (result.action === 2) {
        selectedCardIds = await cardEffectArgs.actionService.run(
          'selectCard',
          {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard 2 copper`,
            restrict: handCards.filter((card) => card.type.includes('ATTACK'))
              .map((card) => card.id),
            count: { kind: 'upTo', count: hand.length },
          },
        );
        gainGold = selectedCardIds.length === 2;
      } else {
        selectedCardIds = await cardEffectArgs.actionService.run(
          'selectCard',
          {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard 6 cards`,
            restrict: hand,
            count: 6,
          },
        );
        gainGold = selectedCardIds.length === 6;
      }

      if (!selectedCardIds.length) {
        loggerService.debug(`[quest effect] no card selected`);
        return;
      }

      if (gainGold) {
        await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: 'gold',
          to: { location: 'playerDiscard' },
          from: 'basicSupply',
          logTag: 'quest effect',
        });
      }
    },
  },
  'raid': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Count Silvers in play for the current player.
      const silversInPlay = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) =>
          card.cardKey === 'silver' &&
          card.owner === cardEffectArgs.playerId
        );

      if (!silversInPlay.length) {
        loggerService.debug(`[raid effect] no silvers in play`);
      } else {
        const gainCount = silversInPlay.length;
        loggerService.debug(`[raid effect] gaining up to ${gainCount} silvers`);
        for (let i = 0; i < gainCount; i++) {
          const gainedSilverCardId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: cardEffectArgs.playerId,
            pileKey: 'silver',
            to: { location: 'playerDiscard' },
            from: 'basicSupply',
            logTag: 'raid effect',
          });
          if (gainedSilverCardId === undefined) {
            break;
          }
        }
      }

      // Each other player puts their -1 Card token on top of their deck.
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      });

      for (const targetPlayerId of targetPlayerIds) {
        const existingTokenEntry = Object.entries(
          cardEffectArgs.match.tokens ?? {},
        ).find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.minusCard &&
          token.ownerId === targetPlayerId
        );

        if (!existingTokenEntry) {
          loggerService.warn(`[raid effect] no -1 Card token for player`);
          continue;
        }

        await cardEffectArgs.actionService.run('moveToken', {
          tokenInstanceId: existingTokenEntry[0],
          location: { type: 'playerDeck', playerId: targetPlayerId },
        }, { loggingContext: { source: cardEffectArgs.cardId } });
      }
    },
  },
  'save': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);

      if (!event) {
        loggerService.warn(`[save effect] event not found`);
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource(
        'playerHand',
        cardEffectArgs.playerId,
      );

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Set aside card`,
          restrict: hand,
          count: 1,
        },
      );

      if (!selectedCardIds.length) {
        loggerService.debug(`[save effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(
        selectedCardIds[0],
      );

      loggerService.debug(`[save effect] setting aside card ${selectedCard}`);

      await cardEffectArgs.actionService.run('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'set-aside' },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async () => true,
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug(
              `[save endTurn effect] moving ${selectedCard} to player ${cardEffectArgs.playerId} hand`,
            );

            await triggeredArgs.actionService.run('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId: selectedCard.id,
              to: { location: 'playerHand' },
            });
          },
        },
      );

      const priceUnsub = cardEffectArgs.cardPriceController.registerRule(
        event,
        (card, context) => {
          if (context.playerId === cardEffectArgs.playerId) {
            return { restricted: true, cost: card.cost };
          }
          return { restricted: false, cost: card.cost };
        },
      );

      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async () => true,
        triggeredEffectFn: async (triggeredArgs) => {
          priceUnsub();
        },
      });
    },
  },
  'seaway': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Gather Action cards in the Supply costing up to $4 with no potion cost.
      const actionCards = cardEffectArgs.findCardService.findCards({ all: [
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardType: ['ACTION'] },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: 4, potion: 0 },
        },
      ] });

      if (!actionCards.length) {
        loggerService.warn(`[seaway effect] no Action cards costing up to $4`);
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain Action card',
          restrict: actionCards.map((card) => card.id),
          count: 1,
        },
      );

      if (!selectedCardIds.length) {
        loggerService.warn(`[seaway effect] no card selected`);
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(
        selectedCardIds[0],
      );

      // Gain the selected card from the Supply first (after on-gain effects resolve, move the token).
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' },
      });

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      ).find(([_tokenInstanceId, token]) =>
        token.tokenId === adventuresTokenIds.plusBuy &&
        token.ownerId === cardEffectArgs.playerId
      );

      if (!existingTokenEntry) {
        loggerService.warn(`[seaway effect] no +1 Buy token for player`);
        return;
      }

      const pileKey = getCardPileKey(selectedCard);
      loggerService.debug(`[seaway effect] moving +1 Buy token to ${pileKey}`);

      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'supplyPile', cardKey: pileKey },
      }, { loggingContext: { source: cardEffectArgs.cardId } });
    },
  },
  'scouting-party': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);

      if (!event) {
        loggerService.warn(`[scouting-party effect] event not found`);
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const deck = cardEffectArgs.cardSourceController.getSource(
        'playerDeck',
        cardEffectArgs.playerId,
      );

      const cardIdsSetAside: CardId[] = [];

      for (let i = 0; i < 5; i++) {
        if (!deck.length) {
          loggerService.debug(`[scouting-party effect] no cards in deck, shuffling`);

          await cardEffectArgs.actionService.run('shuffleDeck', {
            playerId: cardEffectArgs.playerId,
          });

          if (!deck.length) {
            loggerService.debug(`[scouting-party effect] no cards in deck still`);
            break;
          }
        }

        cardIdsSetAside.push(deck.slice(-1)[0]);

        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: deck.slice(-1)[0],
          to: { location: 'set-aside' },
        });
      }

      if (!cardIdsSetAside.length) {
        loggerService.debug(`[scouting-party effect] no cards set aside`);
        return;
      }

      const result = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard 3 cards',
        content: {
          type: 'select',
          cardIds: cardIdsSetAside,
          selectCount: Math.min(3, cardIdsSetAside.length),
        },
      }) as { action: number; result: CardId[] };

      if (!result.result.length) {
        loggerService.warn(`[scouting-party effect] no card selected`);
        return;
      }

      loggerService.debug(
        `[scouting-party effect] discarding ${result.result.length} cards`,
      );

      for (const cardId of result.result) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId,
        });
      }

      const cardIdsToRearrange = cardIdsSetAside.filter((id) => !result.result.includes(id));

      if (!cardIdsToRearrange.length) {
        loggerService.debug(`[scouting-party effect] no cards to rearrange`);
        return;
      }

      if (cardIdsToRearrange.length === 1) {
        loggerService.debug(`[scouting-party effect] one card left, moving to deck`);

        await cardEffectArgs.actionService.run('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardIdsToRearrange[0],
          to: { location: 'playerDeck' },
        });
      } else {
        const result = await cardEffectArgs.actionService.run(
          'userPrompt',
          {
            playerId: cardEffectArgs.playerId,
            prompt: 'Put back in any order',
            actionButtons: [{ label: 'DONE', action: 1 }],
            content: {
              type: 'rearrange',
              cardIds: cardIdsToRearrange,
            },
          },
        ) as { action: number; result: number[] };

        if (!result.result.length) {
          loggerService.warn(`[scouting-party effect] no card selected`);
          return;
        }

        loggerService.debug(
          `[scouting-party effect] putting cards ${result.result} back on deck`,
        );

        for (const cardId of result.result) {
          await cardEffectArgs.actionService.run('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId,
            to: { location: 'playerDeck' },
          });
        }
      }
    },
  },
  'trade': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);

      if (!event) {
        loggerService.warn(`[trade effect] event not found`);
        return;
      }

      const hand = cardEffectArgs.cardSourceController.getSource(
        'playerHand',
        cardEffectArgs.playerId,
      );

      const selectedCardIds = await cardEffectArgs.actionService.run(
        'selectCard',
        {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash cards`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: 2,
          },
        },
      );

      if (!selectedCardIds.length) {
        loggerService.debug(`[trade effect] no card selected`);
        return;
      }

      loggerService.debug(
        `[trade effect] gaining ${selectedCardIds.length} silver cards`,
      );

      for (let i = 0; i < selectedCardIds.length; i++) {
        const gainedSilverCardId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: cardEffectArgs.playerId,
          pileKey: 'silver',
          to: { location: 'playerDiscard' },
          from: 'basicSupply',
          logTag: 'trade effect',
        });

        if (gainedSilverCardId === undefined) {
          break;
        }
      }
    },
  },
  'training': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn(`[training effect] event not found`);
        return;
      }

      // Build the list of Action supply piles using the randomizer card types.
      const actionSupplyPiles = cardEffectArgs.match.config.kingdomSupply
        .map((supply) => {
          const pileCard = getPileDefinitionCard(supply.cards, supply.name);
          if (!pileCard?.type?.includes('ACTION')) return null;
          return getCardPileKey(pileCard);
        })
        .filter((pile): pile is string => !!pile);

      if (!actionSupplyPiles.length) {
        loggerService.warn(`[training effect] no Action supply piles available`);
        return;
      }

      const result = await cardEffectArgs.actionService.run(
        'userPrompt',
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Which Action supply?',
          content: {
            type: 'select-pile',
            pileNames: actionSupplyPiles,
            selectCount: { kind: 'exact', count: 1 } as CountSpec,
          },
        },
      ) as string[];

      const selectedPile = result?.[0];
      if (!selectedPile) {
        loggerService.warn(`[training effect] no pile selected`);
        return;
      }

      loggerService.debug(`[training effect] moving +$1 token to ${selectedPile}`);

      const existingTokenEntry = Object.entries(
        cardEffectArgs.match.tokens ?? {},
      )
        .find(([_tokenInstanceId, token]) =>
          token.tokenId === adventuresTokenIds.plusCoin &&
          token.ownerId === cardEffectArgs.playerId
        );

      if (!existingTokenEntry) {
        loggerService.warn(`[training effect] no +$1 token found for player`);
        return;
      }

      await cardEffectArgs.actionService.run('moveToken', {
        tokenInstanceId: existingTokenEntry[0],
        location: { type: 'supplyPile', cardKey: selectedPile },
      }, { loggingContext: { source: event.id } });
    },
  },
  'travelling-fair': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);

      if (!event) {
        loggerService.warn(`[travelling-fair effect] event not found`);
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 2 });

      cardEffectArgs.reactionManager.registerReactionTemplate(
        event,
        'cardGained',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: async (conditionArgs) => {
            if (
              conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId
            ) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const card = triggeredArgs.cardLibrary.getCard(
              triggeredArgs.trigger.args.cardId,
            );

            loggerService.debug(
              `[travelling-fair cardGained effect] putting ${card} on deck`,
            );

            await triggeredArgs.actionService.run('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId: card.id,
              to: { location: 'playerDeck' },
            });
          },
        },
      );

      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: async () => true,
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.reactionManager.unregisterTrigger(
            `travelling-fair:${cardEffectArgs.cardId}:cardGained`,
          );
        },
      });
    },
  },
};

export default effectMap;
