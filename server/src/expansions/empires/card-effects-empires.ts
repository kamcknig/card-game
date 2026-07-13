import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { CardId, CardKey, CardLocation, CostSpec, PlayerId } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { validateCostSpec } from '@shared/validate-cost-spec.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getAttackTargets } from '../../utils/get-attack-targets.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';
import { resolveChooseAbilities } from '../../utils/resolve-choose-abilities.ts';
import { prosperityTokenIds } from '../prosperity/token-prosperity-ids.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { revealTopDeckCards } from '../../utils/reveal-top-deck-cards.ts';

type ArchiveEffectContext = Pick<CardEffectFunctionContext, 'actionService' | 'cardLibrary' | 'cardSourceController'>;

type GainTopSupplyContext = Pick<CardEffectFunctionContext, 'findCardService' | 'actionService' | 'loggerService' | 'supplyGainService'>;

// Count the number of Castle cards owned by a player for variable scoring.
const countOwnedCastles = (args: { cardLibrary: CardEffectFunctionContext['cardLibrary']; ownerId: PlayerId }) => {
  const ownedCards = args.cardLibrary.getCardsByOwner(args.ownerId);
  return ownedCards.filter(card => card.type.includes('CASTLE')).length;
};

// Gain the top copy of a specific card from a supply location into a destination.
const gainTopSupplyCard = async (
  context: GainTopSupplyContext,
  args: {
    playerId: PlayerId;
    cardKey: CardKey;
    location: 'basicSupply' | 'kingdomSupply';
    to: { location: 'playerDiscard' | 'playerDeck' | 'playerHand' };
    logTag: string;
  },
) => {
  await context.supplyGainService.gainTopSupplyCardForPileKey({
    playerId: args.playerId,
    pileKey: args.cardKey,
    from: args.location,
    to: args.to,
    logTag: args.logTag,
  });
};

// Gain the current top Castle card to the player's discard pile.
const gainTopCastleCard = async (context: GainTopSupplyContext, playerId: PlayerId) => {
  await context.supplyGainService.gainTopSupplyCardForPileKey({
    playerId,
    pileKey: 'castles',
    from: 'kingdomSupply',
    to: { location: 'playerDiscard' },
    logTag: 'castle pile',
  });
};

// Apply the shared Crumbling Castle bonus (+1 VP and gain a Silver).
const resolveCrumblingCastleBonus = async (context: GainTopSupplyContext, playerId: PlayerId) => {
  context.loggerService.debug(`[crumbling castle bonus] gaining 1 VP token`);
  await context.actionService.run('gainVictoryToken', {
    playerId,
    count: 1,
  });
  await gainTopSupplyCard(context, {
    playerId,
    cardKey: 'silver',
    location: 'basicSupply',
    to: { location: 'playerDiscard' },
    logTag: 'crumbling castle bonus',
  });
};

// Resolve the Rocks on-gain/on-trash Silver bonus with buy-phase routing.
const resolveRocksSilverGain = async (
  context: Pick<CardEffectFunctionContext, 'match' | 'findCardService' | 'actionService' | 'loggerService'>,
  args: { playerId: PlayerId; source: 'gained' | 'trashed' },
) => {
  // Determine whether the gain happens during the player's buy phase.
  const currentPlayerId = getCurrentPlayer(context.match).id;
  const isBuyPhase = currentPlayerId === args.playerId && getTurnPhase(context.match.turnPhaseIndex) === 'buy';
  const toLocation = isBuyPhase ? { location: 'playerDeck' as const } : { location: 'playerHand' as const };

  context.loggerService.debug(
    `[rocks ${args.source}] player ${args.playerId} ${
      isBuyPhase ? 'in buy phase' : 'not in buy phase'
    }; gaining Silver to ${toLocation.location}`,
  );

  await gainTopSupplyCard(context, {
    playerId: args.playerId,
    cardKey: 'silver',
    location: 'basicSupply',
    to: toLocation,
    logTag: `rocks ${args.source}`,
  });
};

const expansion: CardExpansionModule = {
  archive: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      const { playerId, cardId } = args;

      loggerService.debug(`[archive effect] gaining 1 action...`);
      await args.actionService.run('gainAction', { count: 1 });

      const setAsideCardIds: CardId[] = [];
      loggerService.info(`[archive effect] preparing to set aside up to 3 cards for player ${playerId}`);

      // Set aside up to 3 cards from the top of the deck, shuffling as needed.
      for (let i = 0; i < 3; i += 1) {
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        if (deck.length < 1) {
          await args.actionService.run('shuffleDeck', { playerId });
        }

        if (deck.length < 1) {
          loggerService.debug(`[archive effect] no cards left to set aside`);
          break;
        }

        const topCardId = deck.slice(-1)[0];
        await args.actionService.run('moveCard', {
          cardId: topCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          facing: 'back',
        });
        loggerService.debug(`[archive effect] set aside card ${topCardId}`);
        setAsideCardIds.push(topCardId);
      }

      loggerService.info(`[archive effect] set aside cards: ${setAsideCardIds.join(', ') || 'none'}`);

      const moveSetAsideCardToHand = async (effectArgs: ArchiveEffectContext) => {
        if (!setAsideCardIds.length) return;

        let chosenCardId: CardId | undefined = setAsideCardIds[0];
        if (setAsideCardIds.length > 1) {
          loggerService.debug(`[archive effect] prompting selection from set-aside cards`);
          const selectionResult = (await effectArgs.actionService.run('userPrompt', {
            playerId,
            prompt: 'Choose a set aside card',
            content: {
              type: 'select',
              cardIds: setAsideCardIds,
              selectableCardIds: setAsideCardIds,
              selectCount: 1,
            },
          })) as { result?: CardId[] };
          chosenCardId = selectionResult?.result?.[0] ?? chosenCardId;
        }

        if (!chosenCardId) return;

        loggerService.info(`[archive effect] moving chosen set-aside card ${chosenCardId} to hand`);
        await effectArgs.actionService.run('moveCard', {
          cardId: chosenCardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
          facing: 'front',
        });

        const idx = setAsideCardIds.indexOf(chosenCardId);
        if (idx >= 0) {
          setAsideCardIds.splice(idx, 1);
        }
        loggerService.info(`[archive effect] remaining set-aside cards: ${setAsideCardIds.join(', ') || 'none'}`);
      };

      // Gain one of the set-aside cards immediately.
      await moveSetAsideCardToHand(args);

      if (!setAsideCardIds.length) {
        return;
      }

      const archiveCard = args.cardLibrary.getCard(cardId);

      // Keep Archive active for each remaining set-aside card.
      args.registerDurationEffect(
        archiveCard,
        {
          id: `archive:${cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === playerId && setAsideCardIds.length > 0,
          triggeredEffectFn: async triggeredArgs => {
            loggerService.info(
              `[archive trigger] startTurn for player ${playerId}, remaining: ${setAsideCardIds.length}`,
            );
            loggerService.debug(`[archive triggered effect] moving Archive back to play area...`);

            await moveSetAsideCardToHand(triggeredArgs);

            // When the last card is taken, remove lingering duration triggers.
            if (setAsideCardIds.length <= 0) {
              loggerService.info(`[archive trigger] set-aside cards exhausted; cleaning up duration triggers`);
              triggeredArgs.reactionManager.cleanupDurationTriggers(cardId);
            }
          },
        },
        {
          // Keep Archive in the duration zone while there are still set-aside cards to resolve.
          hasActiveEffects: () => setAsideCardIds.length > 0,
        },
      );
    },
  },
  capital: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Capital grants treasure and buys immediately on play.
      loggerService.debug(`[capital effect] gaining +6 treasure and +1 buy`);
      // Gain the $ from Capital.
      await args.actionService.run('gainTreasure', { count: 6 });
      // Gain the extra buy from Capital.
      await args.actionService.run('gainBuy', { count: 1 });
    },
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Only apply debt when Capital is discarded from play.
        const previousLocation = eventArgs.previousLocation?.location;
        if (previousLocation !== 'playArea') {
          loggerService.debug(`[capital onDiscarded] not discarded from play, skipping`);
          return;
        }
        // Apply the debt penalty when Capital leaves play.
        loggerService.debug(`[capital onDiscarded] gaining +6 debt for player ${eventArgs.playerId}`);
        await args.actionService.run('gainDebt', {
          playerId: eventArgs.playerId,
          count: 6,
        });
      },
    }),
  },
  charm: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Charm offers a choice between immediate +Buy/+Treasure or a delayed gain trigger.
      loggerService.debug(`[charm effect] prompting player ${args.playerId} to choose an option`);
      const choice = await args.promptService.requestAction({
        playerId: args.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { action: 1, label: '+1 Buy and +2 Treasure' },
          {
            action: 2,
            label: 'Next gain: different extra card with same cost',
          },
        ],
      });

      if (choice === 1) {
        loggerService.debug(`[charm effect] granting +1 buy and +2 treasure`);
        await args.actionService.run('gainBuy', { count: 1 });
        await args.actionService.run('gainTreasure', { count: 2 });
        return;
      }

      // Register a one-time reaction for the next gained card this turn.
      loggerService.info(`[charm effect] registering next-gain reaction for player ${args.playerId}`);
      const charmCard = args.cardLibrary.getCard(args.cardId);
      const reactionId = `charm:${args.cardId}:cardGained`;

      args.reactionManager.registerReactionTemplate({
        id: reactionId,
        listeningFor: 'cardGained',
        playerId: args.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: conditionArgs => {
          // Only trigger off the current player's gains.
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async triggeredArgs => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          // Apply price rules to the gained card to determine the comparison cost.
          const { cost: gainedCost } = triggeredArgs.cardPriceController.applyRules(gainedCard, {
            playerId: args.playerId,
          });

          loggerService.debug(`[charm cardGained] gained ${gainedCard}, matching cost ${JSON.stringify(gainedCost)}`);

          // Find supply cards with the exact same cost but a different name.
          const matchingCards = triggeredArgs.findCardService
            .findCards({
              all: [
                { location: ['basicSupply', 'kingdomSupply'] },
                { playerId: args.playerId, kind: 'exact', amount: gainedCost },
              ],
            })
            .filter(card => card.cardKey !== gainedCard.cardKey);

          if (!matchingCards.length) {
            loggerService.debug(`[charm cardGained] no differently named cards with same cost`);
            return;
          }

          loggerService.debug(`[charm cardGained] prompting to gain one of ${matchingCards.length} cards`);
          const selectedIds = await triggeredArgs.actionService.run('selectCard', {
            playerId: args.playerId,
            prompt: 'Gain a differently named card with the same cost',
            restrict: matchingCards.map(card => card.id),
            count: 1,
            optional: true,
          });

          if (!selectedIds.length) {
            loggerService.debug(`[charm cardGained] player chose not to gain a card`);
            return;
          }

          const selectedCard = triggeredArgs.cardLibrary.getCard(selectedIds[0]);
          loggerService.debug(`[charm cardGained] gaining ${selectedCard} to discard`);
          await triggeredArgs.actionService.run(
            'gainCard',
            {
              playerId: args.playerId,
              cardId: selectedCard.id,
              to: { location: 'playerDiscard' },
            },
            { source: args.cardId },
          );
        },
      });

      // Clean up the pending reaction at end of turn if it never triggers.
      args.reactionManager.registerSystemTemplate(charmCard, 'endTurn', {
        playerId: args.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        autoResolve: true,
        condition: conditionArgs => conditionArgs.trigger.args.playerId === args.playerId,
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[charm endTurn] clearing pending next-gain reaction`);
          triggeredArgs.reactionManager.unregisterTrigger(reactionId);
        },
      });
    },
  },
  catapult: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      const { playerId, match, reactionContext, cardLibrary } = args;

      // Catapult always grants +$1 on play.
      loggerService.debug(`[catapult effect] gaining 1 treasure`);
      await args.actionService.run('gainTreasure', { count: 1 });

      // Catapult requires trashing a card from hand if possible.
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      if (hand.length < 1) {
        loggerService.debug(`[catapult effect] no cards in hand to trash`);
        return;
      }

      loggerService.debug(`[catapult effect] prompting player ${playerId} to trash a card`);
      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Trash a card',
        restrict: { location: 'playerHand', playerId },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[catapult effect] no card selected to trash`);
        return;
      }

      const trashedCard = cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[catapult effect] trashing ${trashedCard}`);
      await args.actionService.run('trashCard', {
        playerId,
        cardId: trashedCard.id,
      });

      // Determine which attack effects apply based on the trashed card.
      const { cost } = args.cardPriceController.applyRules(trashedCard, {
        playerId,
      });
      const triggersCurse = (cost.treasure ?? 0) >= 3;
      const triggersDiscard = trashedCard.type.includes('TREASURE');

      loggerService.debug(`[catapult effect] trashed card cost=${cost.treasure ?? 0}, treasure=${triggersDiscard}`);

      const targetPlayerIds = getAttackTargets(match, playerId, reactionContext);

      loggerService.debug(`[catapult effect] targets ${targetPlayerIds.join(', ') || 'none'}`);

      // Apply curse gains in turn order when the trashed card costs $3+.
      if (triggersCurse) {
        for (const targetPlayerId of targetPlayerIds) {
          loggerService.debug(`[catapult effect] ${targetPlayerId} gaining Curse`);

          const gainedCurseId = await args.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: targetPlayerId,
            pileKey: 'curse',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'catapult effect',
          });

          if (!gainedCurseId) {
            loggerService.debug(`[catapult effect] no curse cards left in supply`);
            break;
          }
        }
      }

      // Apply discard-down-to-3 in turn order after curses when the trashed card is a Treasure.
      if (triggersDiscard) {
        for (const targetPlayerId of targetPlayerIds) {
          await discardDownTo(
            {
              cardSourceController: args.cardSourceController,
              actionService: args.actionService,
              cardLibrary: args.cardLibrary,
              loggerService,
            },
            {
              playerId: targetPlayerId,
              targetHandSize: 3,
              prompt: 'Confirm discard',
              logTag: 'catapult effect',
            },
          );
        }
      }
    },
  },
  'chariot-race': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Pull commonly used effect context fields.
      const { playerId, match, cardLibrary } = args;

      // Chariot Race grants +1 Action.
      loggerService.debug(`[chariot race effect] gaining 1 action`);
      await args.actionService.run('gainAction', { count: 1 });

      // Draw one card, then reveal it.
      loggerService.debug(`[chariot race effect] drawing 1 card to reveal`);
      const drawnCardId = await args.actionService.run('drawCard', {
        playerId,
      });
      if (drawnCardId) {
        loggerService.debug(`[chariot race effect] revealing drawn card ${drawnCardId}`);
        await args.actionService.run('revealCard', {
          playerId,
          cardId: drawnCardId,
        });
      } else {
        loggerService.debug(`[chariot race effect] no card drawn to reveal`);
      }

      // Identify the player to the left (next in turn order).
      const leftPlayerId = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      })[0];

      if (!leftPlayerId) {
        loggerService.debug(`[chariot race effect] no left player found, skipping comparison`);
        return;
      }

      // Reveal the top card of the left player's deck, shuffling in the
      // discard automatically if the deck is empty.
      const leftRevealed = await revealTopDeckCards(args, leftPlayerId, 1);
      const leftCard = leftRevealed[0];

      if (!drawnCardId || !leftCard) {
        loggerService.debug(`[chariot race effect] missing revealed cards, skipping rewards`);
        return;
      }

      // Compare effective costs (including price rules) for each player.
      const drawnCard = cardLibrary.getCard(drawnCardId);
      const { cost: drawnCost } = args.cardPriceController.applyRules(drawnCard, { playerId });
      const { cost: leftCost } = args.cardPriceController.applyRules(leftCard, {
        playerId: leftPlayerId,
      });

      // Compare costs using shared multi-axis rules.
      const costsMore = compareCardCosts(drawnCost, leftCost) > 0;
      loggerService.debug(
        `[chariot race effect] costsMore=${costsMore} (drawn=${JSON.stringify(drawnCost)} left=${JSON.stringify(
          leftCost,
        )})`,
      );

      if (!costsMore) {
        return;
      }

      // Award the +$1 and +1 VP token when the revealed card costs more.
      loggerService.debug(`[chariot race effect] gaining 1 treasure and 1 victory token`);
      await args.actionService.run('gainTreasure', { count: 1 });
      await args.actionService.run('gainVictoryToken', {
        playerId,
        count: 1,
      });
    },
  },
  'city-quarter': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      const { playerId } = args;

      // City Quarter grants +2 Actions.
      loggerService.debug(`[city quarter effect] gaining 2 actions`);
      await args.actionService.run('gainAction', { count: 2 });

      // Reveal the player's hand.
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      loggerService.debug(`[city quarter effect] revealing ${hand.length} cards`);
      for (const cardId of hand) {
        await args.actionService.run('revealCard', {
          cardId,
          playerId,
        });
      }

      // Count revealed Action cards and draw that many cards.
      const actionCardCount = hand
        .map(cardId => args.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('ACTION')).length;

      loggerService.debug(`[city quarter effect] drawing ${actionCardCount} card(s)`);
      if (actionCardCount > 0) {
        await args.actionService.run('drawCard', {
          playerId,
          count: actionCardCount,
        });
      }
    },
  },
  crown: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      const currentPlayerId = getCurrentPlayer(args.match).id;
      if (args.playerId !== currentPlayerId) {
        loggerService.debug(`[crown effect] not current player's turn, skipping`);
        return;
      }

      const isActionPhase = getTurnPhase(args.match.turnPhaseIndex) === 'action';
      const isBuyPhase = getTurnPhase(args.match.turnPhaseIndex) === 'buy';

      if (isActionPhase) {
        loggerService.debug(`[crown effect] player ${args.playerId} is in action phase`);

        const selectedCardIds = await args.actionService.run('selectCard', {
          playerId: args.playerId,
          prompt: `Choose an action card`,
          // Filter-based restriction lets prompt selection include Shadow Actions from deck when legal.
          restrict: {
            all: [{ location: 'playerHand', playerId: args.playerId }, { cardType: ['ACTION'] }],
          },
          count: 1,
          selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
          optional: true,
          cancelPrompt: 'Cancel',
        });

        if (!selectedCardIds.length) {
          loggerService.debug(`[crown effect] player chose not to use an action card`);
        } else {
          for (let i = 0; i < 2; i++) {
            await args.actionService.run('playCard', {
              cardId: selectedCardIds[0],
              playerId: args.playerId,
              overrides: {
                actionCost: 0,
              },
            });
          }
        }
      }

      if (isBuyPhase) {
        loggerService.debug(`[crown effect] player ${args.playerId} is in buy phase`);

        // Restrict Crown's buy-phase effect to Treasure cards.
        const treasureInHand = args.cardSourceController
          .getSource('playerHand', args.playerId)
          .filter(card => args.cardLibrary.getCard(card)?.type.includes('TREASURE'));

        if (treasureInHand.length) {
          const selectedCardIds = await args.actionService.run('selectCard', {
            playerId: args.playerId,
            prompt: `Choose a treasure card`,
            restrict: treasureInHand,
            count: 1,
            selectionIntent: { kind: 'play-card', cardTypes: ['TREASURE'] },
            optional: true,
            cancelPrompt: 'Cancel',
          });

          if (!selectedCardIds.length) {
            loggerService.debug(`[crown effect] player chose not to use a treasure card`);
          } else {
            for (let i = 0; i < 2; i++) {
              await args.actionService.run('playCard', {
                cardId: selectedCardIds[0],
                playerId: args.playerId,
                overrides: {
                  actionCost: 0,
                },
              });
            }
          }
        } else {
          loggerService.debug(`[crown effect] player ${args.playerId} has no treasure cards, skipping`);
        }
      }
    },
  },
  'crumbling-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Apply the Crumbling Castle bonus when gained.
        loggerService.debug(`[crumbling castle onGained] player ${eventArgs.playerId} gained Crumbling Castle`);
        await resolveCrumblingCastleBonus(args, eventArgs.playerId);
      },
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Apply the Crumbling Castle bonus when trashed.
        loggerService.debug(`[crumbling castle onTrashed] player ${eventArgs.playerId} trashed Crumbling Castle`);
        await resolveCrumblingCastleBonus(args, eventArgs.playerId);
      },
    }),
  },
  encampment: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[encampment effect] drawing 2 cards`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 2,
      });

      loggerService.debug(`[encampment effect] gaining 2 actions`);
      await args.actionService.run('gainAction', { count: 2 });

      const validCards = args.findCardService.findCards({
        all: [{ location: 'playerHand', playerId: args.playerId }, { cardKeys: ['gold', 'plunder'] }],
      });

      const doSetAside = async () => {
        const thisCard = args.cardLibrary.getCard(args.cardId);
        const thisId = thisCard.id;
        await args.actionService.run('moveCard', {
          toPlayerId: args.playerId,
          cardId: thisId,
          to: { location: 'set-aside' },
        });

        args.reactionManager.registerReactionTemplate(thisCard, 'startTurnPhase', {
          playerId: args.playerId,
          once: true,
          allowMultipleInstances: false,
          compulsory: true,
          condition: async conditionArgs => {
            return getTurnPhase(conditionArgs.trigger.args.phaseIndex) === 'cleanup';
          },
          triggeredEffectFn: async () => {
            loggerService.debug(`[encampment startTurnPhase effect] moving back to pile`);

            const pile = getPileDefinitionCard([thisCard], 'encampment/plunder');

            if (!pile) {
              loggerService.debug(`[encampment startTurnPhase effect] pile not in kingdom`);
              return;
            }

            await args.actionService.run('moveCard', {
              cardId: thisId,
              to: { location: 'kingdomSupply' },
            });
          },
        });
      };

      if (!validCards.length) {
        loggerService.debug(`[encampment effect] no valid cards in hand`);
        await doSetAside();
        return;
      }

      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: `Select Gold or Plunder to reveal?`,
        restrict: validCards.map(c => c.id),
        count: 1,
        optional: true,
        cancelPrompt: 'NO',
      });

      if (!selectedCardId) {
        loggerService.debug(`[encampment effect] no card selected`);
        await doSetAside();
        return;
      }
    },
  },
  enchantress: {
    registerEffects: () => async args => {},
  },
  engineer: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      const gainCard = async () => {
        const validCards = args.findCardService.findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { amount: { treasure: 4 }, playerId: args.playerId, kind: 'upTo' },
          ],
        });

        if (!validCards.length) {
          loggerService.debug(`[engineer effect] no valid cards in supply`);
        } else {
          const selectedCardId = await args.actionService.run('selectCard', {
            playerId: args.playerId,
            prompt: `Select card up to $4`,
            restrict: validCards.map(c => c.id),
            count: 1,
            optional: false,
          });

          if (!selectedCardId.length) {
            loggerService.debug(`[engineer effect] no card selected`);
          } else {
            loggerService.debug(`[engineer effect] gaining ${selectedCardId[0]}`);
            await args.actionService.run('gainCard', {
              playerId: args.playerId,
              cardId: selectedCardId[0],
              to: { location: 'playerDiscard' },
            });
          }
        }
      };

      await gainCard();

      const result = await args.promptService.requestAction({
        playerId: args.playerId,
        prompt: 'Trash Engineer?',
        actionButtons: [
          { label: 'TRASH', action: 1 },
          { label: 'NO', action: 2 },
        ],
      });

      if (result !== 1) {
        loggerService.debug(`[engineer effect] user chose not to trash Engineer`);
        return;
      }

      await args.actionService.run('trashCard', {
        playerId: args.playerId,
        cardId: args.cardId,
      });

      await gainCard();
    },
  },
  'farmers-market': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[farmers market effect] gaining 1 buy`);
      await args.actionService.run('gainBuy', { count: 1 });

      const tokensOnPile = Object.values(args.match.tokens).filter(
        t =>
          t.tokenId === prosperityTokenIds.victory &&
          t.location.type === 'supplyPile' &&
          t.location.cardKey === 'farmers-market',
      );

      if (tokensOnPile.length >= 4) {
        loggerService.debug(`[farmers market effect] 4 or more tokens on pile`);

        // Move pile victory tokens into the player's victory token pool.
        for (const token of tokensOnPile) {
          await args.actionService.run('moveToken', {
            tokenInstanceId: token.id,
            location: { type: 'player', playerId: args.playerId },
            ownerId: args.playerId,
          });
        }

        loggerService.debug(`[farmers market effect] trashing farmer's market`);

        await args.actionService.run('trashCard', {
          playerId: args.playerId,
          cardId: args.cardId,
        });
      } else {
        loggerService.debug(`[farmers market effect] less than 4 tokens on pile`);

        await args.actionService.run('placeToken', {
          tokenId: prosperityTokenIds.victory,
          location: { type: 'supplyPile', cardKey: 'farmers-market' },
        });

        await args.actionService.run('gainTreasure', {
          count: tokensOnPile.length + 1,
        });
      }
    },
  },
  fortune: {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        loggerService.debug(`[fortune onGained] running`);

        const gladiatorsInPlay = args.findCardService
          .getCardsInPlay()
          .filter(card => card.cardKey === 'gladiator' && card.owner === eventArgs.playerId);

        if (!gladiatorsInPlay.length) {
          loggerService.debug(`[fortune onGained] no gladiators in play`);
          return;
        }

        loggerService.debug(`[fortune onGained] gaining ${gladiatorsInPlay.length} gold`);
        for (let i = 0; i < gladiatorsInPlay.length; i++) {
          const gainedGoldId = await args.supplyGainService.gainTopSupplyCardForPileKey({
            playerId: eventArgs.playerId,
            pileKey: 'gold',
            from: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'fortune onGained',
          });
          if (!gainedGoldId) {
            loggerService.debug(`[fortune onGained] no gold left in supply`);
            break;
          }
        }
      },
    }),
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[fortune effect] gaining 1 buy`);
      await args.actionService.run('gainBuy', { count: 1 });

      const thisCard = args.cardLibrary.getCard(args.cardId);
      if (!args.match.fortuneDoubledThisTurn[args.playerId]) {
        loggerService.debug(`[fortune effect] doubling treasure`);
        await args.actionService.run('gainTreasure', {
          count: args.match.playerTreasure,
        });
        args.match.fortuneDoubledThisTurn[args.playerId] = true;
      } else {
        loggerService.debug(`[fortune effect] already doubled this turn, skipping`);
      }

      args.reactionManager.registerReactionTemplate(thisCard, 'endTurn', {
        playerId: args.playerId,
        once: true,
        compulsory: true,
        autoResolve: true,
        allowMultipleInstances: false,
        condition: async conditionArgs => {
          const fortuneCards = conditionArgs.findCardService.getCardsInPlay().filter(c => c.cardKey === 'fortune');
          if (fortuneCards.length > 0) return false;
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async triggeredArgs => {
          loggerService.debug(`[fortune endTurn trigger] running`);
          triggeredArgs.match.fortuneDoubledThisTurn[args.playerId] = false;
        },
      });
    },
  },
  forum: {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        loggerService.debug(`[forum onGained] player ${eventArgs.playerId} gained Forum`);
        await args.actionService.run('gainBuy', { count: 1 });
      },
    }),
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[forum effect] gaining 3 cards`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 3,
      });

      loggerService.debug(`[forum effect] gaining 1 action`);
      await args.actionService.run('gainAction', { count: 1 });

      // Forum requires discarding 2 cards after drawing.
      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      if (!hand.length) {
        loggerService.debug(`[forum effect] no cards to discard`);
        return;
      }
      const discardCount = Math.min(2, hand.length);
      const selectedCardIds = await args.actionService.run('selectCard', {
        playerId: args.playerId,
        prompt: `Select ${discardCount} card${discardCount === 1 ? '' : 's'} to discard`,
        restrict: hand,
        count: discardCount,
        optional: false,
      });
      for (const cardId of selectedCardIds) {
        await args.actionService.run('discardCard', {
          playerId: args.playerId,
          cardId,
        });
      }
    },
  },
  groundskeeper: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[groundskeeper effect] drawing 1 card and gaining 1 action`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.actionService.run('gainAction', { count: 1 });

      const thisCard = args.cardLibrary.getCard(args.cardId);

      const cardGainedReactionId = args.reactionManager.registerReactionTemplate(thisCard, 'cardGained', {
        playerId: args.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== args.playerId) {
            return false;
          }
          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          return gainedCard.type.includes('VICTORY');
        },
        triggeredEffectFn: async triggeredArgs => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          loggerService.debug(`[groundskeeper cardGained effect] awarding token for ${gainedCard}`);
          await triggeredArgs.actionService.run('gainVictoryToken', {
            playerId: args.playerId,
            count: 1,
          });
        },
      });

      const endTurnReactionId = args.reactionManager.registerReactionTemplate(thisCard, 'endTurn', {
        playerId: args.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs => conditionArgs.trigger.args.playerId === args.playerId,
        triggeredEffectFn: async () => {
          loggerService.debug(`[groundskeeper endTurn effect] cleaning up reactions`);
          args.reactionManager.unregisterTrigger(cardGainedReactionId);
          args.reactionManager.unregisterTrigger(endTurnReactionId);
        },
      });
    },
  },
  gladiator: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[gladiator effect] gaining 2 treasure`);
      await args.actionService.run('gainTreasure', { count: 2 });

      const hand = args.cardSourceController.getSource('playerHand', args.playerId);

      const trashCard = async () => {
        await args.actionService.run('gainTreasure', { count: 1 });
        const gladiators = args.findCardService.findCards({
          all: [{ location: 'kingdomSupply' }, { cardKeys: 'gladiator' }],
        });

        if (!gladiators.length) {
          loggerService.debug(`[gladiator effect] no gladiators in supply`);
          return;
        }

        loggerService.debug(`[gladiator effect] trashing gladiator from supply`);

        await args.actionService.run('trashCard', {
          playerId: args.playerId,
          cardId: gladiators[0].id,
        });
      };

      if (!hand.length) {
        loggerService.debug(`[gladiator effect] player ${args.playerId} has no cards in hand`);
        await trashCard();
        return;
      }

      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: `Select card to reveal`,
        restrict: hand,
        count: 1,
        optional: false,
      });

      if (!selectedCardId) {
        loggerService.debug(`[gladiator effect] no card selected`);
        await trashCard();
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardId);

      await args.actionService.run('revealCard', {
        playerId: args.playerId,
        cardId: selectedCard.id,
      });

      const leftPlayer = getPlayerStartingFrom({
        startFromIdx: args.match.currentPlayerTurnIndex,
        match: args.match,
        distance: 1,
      });

      const leftPlayerHand = args.cardSourceController
        .getSource('playerHand', leftPlayer.id)
        .map(id => args.cardLibrary.getCard(id))
        .filter(c => c.cardKey === selectedCard.cardKey)
        .map(c => c.id);

      if (!leftPlayerHand.length) {
        loggerService.debug(`[gladiator effect] no cards in left player's hand`);
        await trashCard();
        return;
      }

      const result = await args.promptService.requestAction({
        playerId: leftPlayer.id,
        prompt: `Reveal ${selectedCard.cardName}?`,
        actionButtons: [
          { label: 'YES', action: 1 },
          { label: 'NO', action: 2 },
        ],
      });

      if (result === 1) {
        loggerService.debug(`[gladiator effect] user chose to reveal card`);
        await args.actionService.run('revealCard', {
          playerId: leftPlayer.id,
          cardId: leftPlayerHand[0],
        });
        return;
      }

      loggerService.debug(`[gladiator effect] user chose not to reveal card`);
      await trashCard();
    },
  },
  legionary: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[legionary effect] gaining 3 treasure`);
      await args.actionService.run('gainTreasure', { count: 3 });

      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      const goldInHand = hand.filter(cardId => args.cardLibrary.getCard(cardId).cardKey === 'gold');

      if (!goldInHand.length) {
        loggerService.debug(`[legionary effect] no Gold available to reveal`);
        return;
      }

      const selectedGold = (await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: 'Reveal a Gold to hit each other player?',
        restrict: goldInHand,
        count: 1,
        optional: true,
      })) as CardId | null;

      if (!selectedGold) {
        loggerService.debug(`[legionary effect] player declined to reveal Gold`);
        return;
      }

      const goldCardId = selectedGold;
      loggerService.debug(`[legionary effect] revealing Gold ${goldCardId} for player ${args.playerId}`);
      await args.actionService.run('revealCard', {
        playerId: args.playerId,
        cardId: goldCardId,
      });

      const targetPlayerIds = getAttackTargets(args.match, args.playerId, args.reactionContext);

      if (!targetPlayerIds.length) {
        loggerService.debug(`[legionary effect] no valid targets`);
        return;
      }

      for (const targetPlayerId of targetPlayerIds) {
        await discardDownTo(
          {
            cardLibrary: args.cardLibrary,
            cardSourceController: args.cardSourceController,
            actionService: args.actionService,
            loggerService,
          },
          {
            playerId: targetPlayerId,
            targetHandSize: 2,
            prompt: 'Discard down to 2 cards',
            logTag: 'legionary effect',
          },
        );

        loggerService.debug(`[legionary effect] ${targetPlayerId} drawing a card after discard`);
        await args.actionService.run('drawCard', {
          playerId: targetPlayerId,
          count: 1,
        });
      }
    },
  },
  overlord: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Overlord plays one eligible supply Action at no extra action cost while leaving that pile in place.
      loggerService.debug(`[overlord effect] evaluating supply options for player ${args.playerId}`);

      const supplyLocations: CardLocation[] = ['kingdomSupply', 'basicSupply'];
      const supplyCards = args.findCardService.findCards({ all: [{ location: supplyLocations }] });
      const topCardByPile = new Map<string, (typeof supplyCards)[number]>();
      for (const card of supplyCards) {
        topCardByPile.set(card.kingdom, card);
      }

      const maxCost: CostSpec = { kind: 'upTo', amount: { treasure: 5 }, playerId: args.playerId };
      const eligibleCards = Array.from(topCardByPile.values()).filter(card => {
        if (!card.type.includes('ACTION')) return false;
        if (card.type.includes('COMMAND') || card.type.includes('DURATION')) return false;
        const { cost } = args.cardPriceController.applyRules(card, { playerId: args.playerId });
        return validateCostSpec(maxCost, cost);
      });

      if (!eligibleCards.length) {
        loggerService.debug(`[overlord effect] no eligible supply actions remain`);
        return;
      }

      loggerService.debug(
        `[overlord effect] player ${args.playerId} can play: ${eligibleCards.map(card => card.cardKey).join(', ')}`,
      );

      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: 'Select a supply action costing up to $5 to play',
        restrict: eligibleCards.map(card => card.id),
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug(`[overlord effect] player declined to play a supply action`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardId);
      loggerService.info(`[overlord effect] playing ${selectedCard.cardKey} from supply`);

      await args.actionService.run('playCard', {
        playerId: args.playerId,
        cardId: selectedCardId,
        overrides: {
          actionCost: 0,
          moveCard: false,
        },
      });
    },
  },
  rocks: {
    registerEffects:
      () =>
      async ({ loggerService, actionService }) => {
        // Rocks provides +$1 when played.
        loggerService.debug(`[rocks effect] gaining 1 treasure`);
        await actionService.run('gainTreasure', { count: 1 });
      },
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Apply the Rocks Silver gain when gained.
        loggerService.debug(`[rocks onGained] player ${eventArgs.playerId} gained Rocks`);
        await resolveRocksSilverGain(args, {
          playerId: eventArgs.playerId,
          source: 'gained',
        });
      },
      onTrashed: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Apply the Rocks Silver gain when trashed.
        loggerService.debug(`[rocks onTrashed] player ${eventArgs.playerId} trashed Rocks`);
        await resolveRocksSilverGain(args, {
          playerId: eventArgs.playerId,
          source: 'trashed',
        });
      },
    }),
  },
  'haunted-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Haunted Castle only triggers when gained on the current player's turn.
        const currentPlayerId = getCurrentPlayer(args.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          loggerService.debug(`[haunted castle onGained] not current player's turn, skipping`);
          return;
        }

        loggerService.debug(`[haunted castle onGained] player ${eventArgs.playerId} gained Haunted Castle`);
        await gainTopSupplyCard(args, {
          playerId: eventArgs.playerId,
          cardKey: 'gold',
          location: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'haunted castle onGained',
        });

        const targetPlayerIds = findOrderedTargets({
          startingPlayerId: eventArgs.playerId,
          appliesTo: 'ALL_OTHER',
          match: args.match,
        });

        for (const targetPlayerId of targetPlayerIds) {
          const targetHand = args.findCardService.findCards({
            location: 'playerHand',
            playerId: targetPlayerId,
          });
          if (targetHand.length < 5) {
            loggerService.debug(`[haunted castle onGained] player ${targetPlayerId} has fewer than 5 cards, skipping`);
            continue;
          }

          loggerService.debug(`[haunted castle onGained] prompting player ${targetPlayerId} to put 2 cards on deck`);
          const selectedIds = await args.actionService.run('selectCard', {
            playerId: targetPlayerId,
            prompt: 'Put 2 cards from your hand onto your deck',
            restrict: { location: 'playerHand', playerId: targetPlayerId },
            count: 2,
          });

          for (const selectedId of selectedIds) {
            loggerService.debug(`[haunted castle onGained] moving ${selectedId} to deck for player ${targetPlayerId}`);
            await args.actionService.run('moveCard', {
              cardId: selectedId,
              toPlayerId: targetPlayerId,
              to: { location: 'playerDeck' },
            });
          }
        }
      },
    }),
  },
  'humble-castle': {
    registerScoringFunction: () => args => {
      const loggerService = args.loggerService;
      // Humble Castle is worth 1 VP per Castle you have.
      const castleCount = countOwnedCastles({
        cardLibrary: args.cardLibrary,
        ownerId: args.ownerId,
      });
      loggerService.debug(`[humble castle scoring] owner ${args.ownerId} castles ${castleCount}`);
      return castleCount;
    },
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Humble Castle is a Treasure that produces $1.
      loggerService.debug(`[humble castle effect] gaining 1 treasure`);
      await args.actionService.run('gainTreasure', { count: 1 });
    },
  },
  'grand-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Grand Castle grants VP tokens based on Victory cards in hand and in play.
        const victoryInHand = args.findCardService
          .findCards({
            location: 'playerHand',
            playerId: eventArgs.playerId,
          })
          .filter(card => card.type.includes('VICTORY'));
        const victoryInPlay = args.findCardService.getCardsInPlay().filter(card => card.type.includes('VICTORY'));
        // Reveal the gaining player's hand before awarding VP tokens.
        const handCardIds = args.cardSourceController.getSource('playerHand', eventArgs.playerId);
        loggerService.info(
          `[grand castle onGained] revealing ${handCardIds.length} card(s) in hand for player ${eventArgs.playerId}`,
        );
        for (const handCardId of handCardIds) {
          // Use revealCard to keep reveal effects consistent with other cards.
          await args.actionService.run('revealCard', {
            playerId: eventArgs.playerId,
            cardId: handCardId,
          });
        }
        const totalVictoryCards = victoryInHand.length + victoryInPlay.length;
        loggerService.debug(`[grand castle onGained] granting ${totalVictoryCards} VP tokens`);
        await args.actionService.run('gainVictoryToken', {
          playerId: eventArgs.playerId,
          count: totalVictoryCards,
        });
      },
    }),
  },
  'kings-castle': {
    registerScoringFunction: () => args => {
      const loggerService = args.loggerService;
      // King's Castle is worth 2 VP per Castle you have.
      const castleCount = countOwnedCastles({
        cardLibrary: args.cardLibrary,
        ownerId: args.ownerId,
      });
      const score = castleCount * 2;
      loggerService.debug(`[king's castle scoring] owner ${args.ownerId} castles ${castleCount} score ${score}`);
      return score;
    },
  },
  'opulent-castle': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Opulent Castle discards Victory cards for +$2 each.
      const { playerId } = args;
      const victoryCardsInHand = args.findCardService.findCards({
        all: [
          {
            location: 'playerHand',
            playerId,
          },
          { cardType: ['VICTORY'] },
        ],
      });
      if (victoryCardsInHand.length === 0) {
        loggerService.debug(`[opulent castle effect] no Victory cards in hand to discard`);
        return;
      }

      loggerService.debug(`[opulent castle effect] prompting to discard Victory cards`);
      const selectedIds = await args.actionService.run('selectCard', {
        playerId,
        prompt: 'Discard any number of Victory cards',
        restrict: victoryCardsInHand.map(card => card.id),
        count: { kind: 'upTo', count: victoryCardsInHand.length },
        optional: true,
      });

      if (selectedIds.length === 0) {
        loggerService.debug(`[opulent castle effect] no cards discarded`);
        return;
      }

      for (const selectedId of selectedIds) {
        loggerService.debug(`[opulent castle effect] discarding Victory card ${selectedId}`);
        await args.actionService.run('discardCard', {
          playerId,
          cardId: selectedId,
        });
      }

      const treasureGain = selectedIds.length * 2;
      loggerService.debug(`[opulent castle effect] gaining ${treasureGain} treasure`);
      await args.actionService.run('gainTreasure', { count: treasureGain });
    },
  },
  plunder: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[plunder effect] gaining 2 treasure`);
      await args.actionService.run('gainTreasure', { count: 2 });

      loggerService.debug(`[plunder effect] gaining 1 victory token`);
      await args.actionService.run('gainVictoryToken', {
        playerId: args.playerId,
        count: 1,
      });
    },
  },
  patrician: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[patrician effect] drawing 1 card, gaining 1 action, and revealing top deck card`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
      });
      await args.actionService.run('gainAction', { count: 1 });

      // Reveal the top card of the player's deck, shuffling in the discard
      // automatically if the deck is empty.
      const revealed = await revealTopDeckCards(args, args.playerId, 1);
      const revealedCard = revealed[0];
      if (!revealedCard) {
        loggerService.debug(`[patrician effect] no card revealed`);
        return;
      }

      const { cost: revealedCost } = args.cardPriceController.applyRules(revealedCard, { playerId: args.playerId });

      const qualifiesForDraw = compareCardCosts(revealedCost, { treasure: 5 }) >= 0;
      if (!qualifiesForDraw) {
        loggerService.debug(`[patrician effect] revealed ${revealedCard.cardKey} costs less than $5`);
        return;
      }

      loggerService.info(`[patrician effect] revealed ${revealedCard.cardKey} costs $5 or more, moving to hand`);
      await args.actionService.run('moveCard', {
        cardId: revealedCard.id,
        toPlayerId: args.playerId,
        to: { location: 'playerHand' },
      });
    },
  },
  emporium: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      loggerService.debug(`[emporium effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.actionService.run('gainAction', { count: 1 });
      await args.actionService.run('gainTreasure', { count: 1 });
    },
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        const actionCardsInPlay = args.findCardService
          .getCardsInPlay()
          .filter(card => card.type.includes('ACTION') && card.owner === eventArgs.playerId);

        loggerService.debug(
          `[emporium onGained] player ${eventArgs.playerId} has ${actionCardsInPlay.length} action cards in play`,
        );

        if (actionCardsInPlay.length < 5) {
          loggerService.debug(`[emporium onGained] insufficient actions for bonus`);
          return;
        }

        loggerService.info(`[emporium onGained] awarding 2 victory tokens to player ${eventArgs.playerId}`);
        await args.actionService.run('gainVictoryToken', {
          playerId: eventArgs.playerId,
          count: 2,
        });
      },
    }),
  },
  settlers: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Settlers draws a card, gains an action, then optionally retrieves a Copper from discard.
      loggerService.debug(`[settlers effect] drawing 1 card and gaining 1 action`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.actionService.run('gainAction', { count: 1 });

      const copperInDiscard = args.findCardService.findCards({
        all: [
          {
            location: 'playerDiscard',
            playerId: args.playerId,
          },
          { cardKeys: 'copper' },
        ],
      });

      if (!copperInDiscard.length) {
        loggerService.debug(`[settlers effect] no Copper in discard to reveal`);
        return;
      }

      loggerService.debug(`[settlers effect] prompting player ${args.playerId} to reveal Copper from discard`);
      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: 'Reveal a Copper to put into your hand',
        restrict: copperInDiscard.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[settlers effect] player chose not to reveal Copper`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardId);
      loggerService.info(`[settlers effect] revealing ${selectedCard} from discard to hand`);
      await args.actionService.run('revealCard', {
        playerId: args.playerId,
        cardId: selectedCard.id,
      });
      await args.actionService.run('moveCard', {
        cardId: selectedCard.id,
        toPlayerId: args.playerId,
        to: { location: 'playerHand' },
      });
    },
  },
  'bustling-village': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Bustling Village draws a card, gains 3 actions, then optionally retrieves a Settlers from discard.
      loggerService.debug(`[bustling village effect] drawing 1 card and gaining 3 actions`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.actionService.run('gainAction', { count: 3 });

      const settlersInDiscard = args.findCardService.findCards({
        all: [
          {
            location: 'playerDiscard',
            playerId: args.playerId,
          },
          { cardKeys: 'settlers' },
        ],
      });

      if (!settlersInDiscard.length) {
        loggerService.debug(`[bustling village effect] no Settlers in discard to reveal`);
        return;
      }

      loggerService.debug(
        `[bustling village effect] prompting player ${args.playerId} to reveal Settlers from discard`,
      );
      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: 'Reveal a Settlers to put into your hand',
        restrict: settlersInDiscard.map(card => card.id),
        count: 1,
        optional: true,
      });

      if (!selectedCardId) {
        loggerService.debug(`[bustling village effect] player chose not to reveal Settlers`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardId);
      loggerService.info(`[bustling village effect] revealing ${selectedCard} from discard to hand`);
      await args.actionService.run('revealCard', {
        playerId: args.playerId,
        cardId: selectedCard.id,
      });
      await args.actionService.run('moveCard', {
        cardId: selectedCard.id,
        toPlayerId: args.playerId,
        to: { location: 'playerHand' },
      });
    },
  },
  temple: {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Temple gathers VP tokens on its pile; gaining it transfers them to the player.
        const tokensOnPile = Object.values(args.match.tokens).filter(
          token =>
            token.tokenId === prosperityTokenIds.victory &&
            token.location.type === 'supplyPile' &&
            token.location.cardKey === 'temple',
        );

        if (!tokensOnPile.length) {
          loggerService.debug(`[temple onGained] no victory tokens on Temple pile`);
          return;
        }

        loggerService.info(
          `[temple onGained] moving ${tokensOnPile.length} victory token(s) to player ${eventArgs.playerId}`,
        );

        for (const token of tokensOnPile) {
          await args.actionService.run('moveToken', {
            tokenInstanceId: token.id,
            location: { type: 'player', playerId: eventArgs.playerId },
            ownerId: eventArgs.playerId,
          });
        }
      },
    }),
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Temple grants 1 VP, trashes 1-3 differently named cards, then adds a VP token to the pile.
      loggerService.debug(`[temple effect] gaining 1 victory token`);
      await args.actionService.run('gainVictoryToken', {
        playerId: args.playerId,
        count: 1,
      });

      // Build a list of unique-name cards in hand for the trash selection.
      const handCardIds = [...args.cardSourceController.getSource('playerHand', args.playerId)];
      const uniqueCandidates: { id: CardId; name: string }[] = [];
      const seenNames = new Set<string>();
      for (const cardId of handCardIds) {
        const card = args.cardLibrary.getCard(cardId);
        const cardName = card.cardName ?? card.cardKey;
        if (seenNames.has(cardName)) continue;
        seenNames.add(cardName);
        uniqueCandidates.push({ id: cardId, name: cardName });
      }

      if (!uniqueCandidates.length) {
        loggerService.debug(`[temple effect] no cards in hand to trash`);
      } else {
        const maxSelectable = Math.min(3, uniqueCandidates.length);
        loggerService.debug(`[temple effect] prompting player ${args.playerId} to trash 1 to ${maxSelectable} card(s)`);
        // Use a range count so the player can choose 1-3 cards in a single prompt.
        const selectedCardIds = await args.actionService.run('selectCard', {
          playerId: args.playerId,
          prompt: `Trash 1 to ${maxSelectable} differently named cards`,
          restrict: uniqueCandidates.map(candidate => candidate.id),
          count: { kind: 'range', min: 1, max: maxSelectable },
          optional: false,
        });

        if (!selectedCardIds.length) {
          loggerService.warn(`[temple effect] no card selected to trash`);
        } else {
          loggerService.info(`[temple effect] trashing ${selectedCardIds.length} card(s)`);
          for (const cardId of selectedCardIds) {
            await args.actionService.run('trashCard', {
              playerId: args.playerId,
              cardId,
            });
          }
        }
      }

      // Always add a victory token to the Temple pile after resolving trashing.
      loggerService.debug(`[temple effect] placing 1 victory token on Temple pile`);
      await args.actionService.run('placeToken', {
        tokenId: prosperityTokenIds.victory,
        location: { type: 'supplyPile', cardKey: 'temple' },
      });
    },
  },
  'wild-hunt': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Wild Hunt lets the player choose between drawing and gathering VP, or gaining an Estate to claim VP.
      const tokensOnPileCount = Object.values(args.match.tokens).filter(
        token =>
          token.tokenId === prosperityTokenIds.victory &&
          token.location.type === 'supplyPile' &&
          token.location.cardKey === 'wild-hunt',
      ).length;

      loggerService.debug(
        `[wild hunt effect] prompting player ${args.playerId} to choose an option (pile VP: ${tokensOnPileCount})`,
      );
      await resolveChooseAbilities({
        context: args,
        logTag: 'wild hunt effect',
        prompt: 'Choose one',
        baseChoiceCount: 1,
        options: [
          {
            action: 1,
            label: '+3 Cards and add 1VP to the pile',
            resolve: async () => {
              // Option 1: draw 3 cards, then gather a VP token on the Wild Hunt pile.
              loggerService.debug('[wild hunt effect] drawing 3 cards');
              await args.actionService.run('drawCard', {
                playerId: args.playerId,
                count: 3,
              });

              loggerService.debug('[wild hunt effect] placing 1 victory token on Wild Hunt pile');
              await args.actionService.run('placeToken', {
                tokenId: prosperityTokenIds.victory,
                location: { type: 'supplyPile', cardKey: 'wild-hunt' },
              });
            },
          },
          {
            action: 2,
            label: `Gain an Estate and take the ${tokensOnPileCount}VP from the pile`,
            resolve: async () => {
              // Option 2: gain an Estate; only if gained do we take VP tokens from the pile.
              loggerService.info('[wild hunt effect] gaining an Estate');
              const estateCardId = await args.supplyGainService.gainTopSupplyCardForPileKey({
                playerId: args.playerId,
                pileKey: 'estate',
                from: 'basicSupply',
                to: { location: 'playerDiscard' },
                logTag: 'wild hunt effect',
              });
              if (!estateCardId) {
                loggerService.debug('[wild hunt effect] no Estates left to gain, skipping VP tokens');
                return;
              }

              // Move any gathered VP tokens from the Wild Hunt pile to the player.
              const tokensOnPile = Object.values(args.match.tokens).filter(
                token =>
                  token.tokenId === prosperityTokenIds.victory &&
                  token.location.type === 'supplyPile' &&
                  token.location.cardKey === 'wild-hunt',
              );

              if (!tokensOnPile.length) {
                loggerService.debug('[wild hunt effect] no victory tokens on pile');
                return;
              }

              loggerService.info(
                `[wild hunt effect] moving ${tokensOnPile.length} victory token(s) to player ${args.playerId}`,
              );
              for (const token of tokensOnPile) {
                await args.actionService.run('moveToken', {
                  tokenInstanceId: token.id,
                  location: { type: 'player', playerId: args.playerId },
                  ownerId: args.playerId,
                });
              }
            },
          },
        ],
      });
    },
  },
  villa: {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Villa moves to hand, grants +1 Action, and can return you to the action phase.
        loggerService.debug(`[villa onGained] player ${eventArgs.playerId} gained Villa`);

        const villaCard = args.cardLibrary.getCard(eventArgs.cardId);

        loggerService.info(`[villa onGained] moving ${villaCard} to hand for player ${eventArgs.playerId}`);
        await args.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'playerHand' },
        });

        const currentPlayerId = getCurrentPlayer(args.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          loggerService.info(`[villa onGained] gained off-turn, skipping action gain and phase change`);
          return;
        }

        loggerService.debug(`[villa onGained] gaining 1 action`);
        await args.actionService.run('gainAction', { count: 1 });

        const isBuyPhase = getTurnPhase(args.match.turnPhaseIndex) === 'buy';
        if (!isBuyPhase) {
          loggerService.debug(`[villa onGained] not in buy phase, no phase change`);
          return;
        }

        await args.actionService.run('setTurnPhase', {
          phase: 'action',
          playerId: eventArgs.playerId,
          endCurrentPhase: true,
          startNewPhase: true,
        });
      },
    }),
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Villa grants actions, a buy, and treasure when played.
      loggerService.debug(`[villa effect] gaining 2 actions`);
      await args.actionService.run('gainAction', { count: 2 });
      loggerService.debug(`[villa effect] gaining 1 buy`);
      await args.actionService.run('gainBuy', { count: 1 });
      loggerService.debug(`[villa effect] gaining 1 treasure`);
      await args.actionService.run('gainTreasure', { count: 1 });
    },
  },
  sacrifice: {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Sacrifice trashes a card from hand and grants bonuses based on its types.
      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      if (!hand.length) {
        loggerService.debug(`[sacrifice effect] no cards in hand to trash`);
        return;
      }

      loggerService.debug(`[sacrifice effect] prompting player ${args.playerId} to trash a card`);
      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: 'Trash a card',
        restrict: { location: 'playerHand', playerId: args.playerId },
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.warn(`[sacrifice effect] no card selected to trash`);
        return;
      }

      const trashedCard = args.cardLibrary.getCard(selectedCardId);
      loggerService.debug(`[sacrifice effect] trashing ${trashedCard}`);
      await args.actionService.run('trashCard', {
        playerId: args.playerId,
        cardId: trashedCard.id,
      });

      // Apply all bonuses that match the trashed card's types.
      const isAction = trashedCard.type.includes('ACTION');
      const isTreasure = trashedCard.type.includes('TREASURE');
      const isVictory = trashedCard.type.includes('VICTORY');

      loggerService.debug(
        `[sacrifice effect] trashed types action=${isAction} treasure=${isTreasure} victory=${isVictory}`,
      );

      if (isAction) {
        loggerService.debug(`[sacrifice effect] gaining 2 cards and 2 actions`);
        await args.actionService.run('drawCard', {
          playerId: args.playerId,
          count: 2,
        });
        await args.actionService.run('gainAction', { count: 2 });
      }

      if (isTreasure) {
        loggerService.debug(`[sacrifice effect] gaining 2 treasure`);
        await args.actionService.run('gainTreasure', { count: 2 });
      }

      if (isVictory) {
        loggerService.debug(`[sacrifice effect] gaining 2 victory tokens`);
        await args.actionService.run('gainVictoryToken', {
          playerId: args.playerId,
          count: 2,
        });
      }
    },
  },
  'royal-blacksmith': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Royal Blacksmith draws 5 cards, reveals hand, then discards all Coppers from hand.
      loggerService.debug(`[royal blacksmith effect] drawing 5 cards`);
      await args.actionService.run('drawCard', {
        playerId: args.playerId,
        count: 5,
      });

      const handCardIds = [...args.cardSourceController.getSource('playerHand', args.playerId)];
      loggerService.debug(`[royal blacksmith effect] revealing ${handCardIds.length} cards in hand`);
      for (const cardId of handCardIds) {
        await args.actionService.run('revealCard', {
          cardId,
          playerId: args.playerId,
        });
      }

      // Discard all Copper cards from the revealed hand.
      const copperCardIds = handCardIds
        .map(cardId => args.cardLibrary.getCard(cardId))
        .filter(card => card.cardKey === 'copper')
        .map(card => card.id);

      if (!copperCardIds.length) {
        loggerService.debug(`[royal blacksmith effect] no Coppers to discard`);
        return;
      }

      loggerService.info(`[royal blacksmith effect] discarding ${copperCardIds.length} Copper(s)`);
      for (const cardId of copperCardIds) {
        await args.actionService.run('discardCard', {
          playerId: args.playerId,
          cardId,
        });
      }
    },
  },
  'small-castle': {
    registerEffects: () => async args => {
      const loggerService = args.loggerService;
      // Small Castle allows trashing itself or a Castle from hand to gain a Castle.
      const { playerId, cardId } = args;
      const castlesInHand = args.findCardService.findCards({
        all: [
          {
            location: 'playerHand',
            playerId,
          },
          { cardType: ['CASTLE'] },
        ],
      });
      loggerService.debug(`[small castle effect] castles in hand ${castlesInHand.length}`);

      // Build a single list of trashable Castle ids (Small Castle in play plus any Castles in hand).
      const trashableCastleIds = [cardId, ...castlesInHand.map(card => card.id)].filter(
        (id, idx, arr) => arr.indexOf(id) === idx,
      );

      // Track whether a trash action actually occurred for follow-up gain logic.
      let trashed = false;

      if (trashableCastleIds.length === 0) {
        loggerService.debug(`[small castle effect] no castles available to trash`);
      } else if (trashableCastleIds.length === 1) {
        // Only one possible target, trash it immediately.
        const onlyId = trashableCastleIds[0];
        loggerService.debug(`[small castle effect] only one castle to trash, trashing ${onlyId}`);
        await args.actionService.run('trashCard', {
          playerId,
          cardId: onlyId,
        });
        trashed = true;
      } else {
        // Prompt with card ids when multiple Castles are available.
        loggerService.debug(`[small castle effect] prompting to trash one of ${trashableCastleIds.length} castles`);
        const selectedId = (await args.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Trash a Castle',
          restrict: trashableCastleIds,
          count: 1,
        })) as CardId | null;
        if (selectedId) {
          loggerService.debug(`[small castle effect] trashing Castle ${selectedId}`);
          await args.actionService.run('trashCard', {
            playerId,
            cardId: selectedId,
          });
          trashed = true;
        }
      }

      if (!trashed) {
        loggerService.debug(`[small castle effect] no Castle was trashed, skipping gain`);
        return;
      }

      // Gain the current top Castle if a Castle was trashed.
      await gainTopCastleCard(args, playerId);
    },
  },
  'sprawling-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const loggerService = args.loggerService;
        // Sprawling Castle lets the gainer choose Duchy or 3 Estates.
        loggerService.debug(`[sprawling castle onGained] player ${eventArgs.playerId} gained Sprawling Castle`);
        const result = await args.promptService.requestAction({
          playerId: eventArgs.playerId,
          prompt: 'Gain a Duchy or 3 Estates?',
          actionButtons: [
            { action: 1, label: 'GAIN DUCHY' },
            { action: 2, label: 'GAIN 3 ESTATES' },
          ],
        });

        if (result === 1) {
          await gainTopSupplyCard(args, {
            playerId: eventArgs.playerId,
            cardKey: 'duchy',
            location: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'sprawling castle onGained',
          });
          return;
        }

        const estateCards = args.findCardService.findCards({
          all: [
            { location: 'basicSupply' },
            {
              cardKeys: 'estate',
            },
          ],
        });
        const estatesToGain = Math.min(3, estateCards.length);
        loggerService.debug(`[sprawling castle onGained] gaining ${estatesToGain} estate(s)`);
        for (let i = 0; i < estatesToGain; i += 1) {
          const estateId = estateCards.slice(-(i + 1))[0]?.id;
          if (!estateId) {
            break;
          }
          await args.actionService.run('gainCard', {
            playerId: eventArgs.playerId,
            cardId: estateId,
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
  },
};

export default expansion;
