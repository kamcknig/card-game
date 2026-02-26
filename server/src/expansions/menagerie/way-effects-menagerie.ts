import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { CardCost, CardId, CardLocation, PlayerId } from 'shared/types/index.ts';
import { findWayInMatch } from '@shared/find-card-like-in-match.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getPlayerSourceSafe } from '../../utils/get-player-source-safe.ts';
import { resolvePileDestinationForCardKey } from '../../utils/resolve-pile-destination-for-card-key.ts';

type WayOfTheMouseWayMetadata = {
  menagerie?: {
    wayOfTheMouse?: {
      runtimeSetAsidePileKey?: string;
      setAsideCardKey?: string;
    };
  };
};

// Resolves the configured Way of the Mouse metadata from active match ways.
const getWayOfTheMouseMetadata = (args: CardEffectFunctionContext) => {
  const wayOfTheMouse = args.match.ways.find((way) => way.cardKey === 'way-of-the-mouse');
  if (!wayOfTheMouse) {
    return undefined;
  }
  return findWayInMatch<WayOfTheMouseWayMetadata>(args.match, wayOfTheMouse.id)?.metadata?.menagerie?.wayOfTheMouse;
};

// Returns the number of times this card id has been played this turn.
const getCurrentPlayInstanceCount = (args: CardEffectFunctionContext): number => {
  const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: args.match }) ?? 0;
  const playedThisTurn = args.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
  return playedThisTurn.filter((playedCardId) => playedCardId === args.cardId).length;
};

// Best-effort return helper used by Ways that return the played card to a pile.
const returnCardToPile = async (args: CardEffectFunctionContext, logTag: string): Promise<boolean> => {
  const loggerService = args.loggerService;
  const card = args.cardLibrary.getCard(args.cardId);

  let currentLocation: { sourceKey: CardLocation; playerId?: PlayerId } | null = null;
  try {
    const source = args.cardSourceController.findCardSource(args.cardId);
    currentLocation = { sourceKey: source.sourceKey, playerId: source.playerId };
  } catch {
    loggerService.debug(`[${logTag}] could not find ${card} source to return it to a pile`);
    return false;
  }

  if (currentLocation.sourceKey !== 'playArea' && currentLocation.sourceKey !== 'activeDuration') {
    loggerService.debug(
      `[${logTag}] ${card} is not in play (source=${currentLocation.sourceKey}), skipping return to pile`,
    );
    return false;
  }

  const destination = resolvePileDestinationForCardKey({
    findCardService: args.findCardService,
    cardKey: card.cardKey,
  });
  if (!destination) {
    loggerService.debug(`[${logTag}] no destination pile found for ${card.cardKey}`);
    return false;
  }

  await args.actionService.run('moveCard', {
    cardId: args.cardId,
    to: { location: destination },
  });
  loggerService.debug(`[${logTag}] returned ${card} to ${destination}`);
  return true;
};

// Returns the top card in supply for a pile key.
const findTopSupplyCard = (
  args: CardEffectFunctionContext,
  pileKey: string,
) => {
  return args.findCardService.findTopSupplyCardForPileKey({
    pileKey,
    from: ['basicSupply', 'kingdomSupply'],
  });
};

// Runs the played card's normal effect pipeline from maps exposed on the effect context.
const runOriginalCardEffectsFromContext = async (args: CardEffectFunctionContext): Promise<void> => {
  const loggerService = args.loggerService;
  const playedCard = args.cardLibrary.getCard(args.cardId);

  const baseEffectFn = args.cardEffectFunctionMap[playedCard.cardKey];
  if (baseEffectFn) {
    loggerService.debug(`[way-of-the-chameleon effect] running base effect for ${playedCard}`);
    await baseEffectFn(args);
  }

  for (const expansion of Object.keys(args.customCardEffectHandlers)) {
    const expansionEffectFn = args.customCardEffectHandlers[expansion][playedCard.cardKey];
    if (!expansionEffectFn) {
      continue;
    }

    loggerService.debug(`[way-of-the-chameleon effect] running ${expansion} effect for ${playedCard}`);
    await expansionEffectFn(args);
  }
};

// Registers this-turn Chameleon conversion from +Cards into +$ for the current player.
const registerWayOfTheChameleonDrawSwap = (args: CardEffectFunctionContext): void => {
  const loggerService = args.loggerService;
  const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: args.match }) ?? 0;
  const playInstance = getCurrentPlayInstanceCount(args);
  const sourceCard = args.cardLibrary.getCard(args.cardId);

  // This trigger edits draw counts before cards are moved, then grants matching treasure.
  const drawSwapTriggerId = args.reactionManager.registerSystemTemplate(
    sourceCard,
    'drawCards',
    {
      playerId: args.playerId,
      once: false,
      allowMultipleInstances: true,
      compulsory: true,
      autoResolve: true,
      condition: ({ trigger, match }) =>
        trigger.args.playerId === args.playerId &&
        trigger.args.count > 0 &&
        trigger.args.source === sourceCard.id &&
        match.stats.turns.length - 1 === turnHistoryIndex,
      triggeredEffectFn: async (triggeredArgs) => {
        const swappedCount = Math.max(0, triggeredArgs.trigger.args.count);
        if (swappedCount < 1) {
          loggerService.debug('[way-of-the-chameleon effect] draw swap skipped because draw count is 0');
          return;
        }

        loggerService.info(`[way-of-the-chameleon effect] converting +${swappedCount} Cards into +$${swappedCount}`);
        triggeredArgs.trigger.args.count = 0;
        await triggeredArgs.actionService.run('gainTreasure', {
          count: swappedCount,
        }, {
          loggingContext: {
            source: triggeredArgs.trigger.args.source,
          },
        });
      },
    },
    { idSuffix: `way-of-the-chameleon:draw:turn:${turnHistoryIndex}:play:${playInstance}` },
  );

  // Always remove the draw swap at end of turn so it cannot leak into future turns.
  args.reactionManager.registerSystemTemplate(sourceCard, 'endTurn', {
    playerId: args.playerId,
    once: true,
    allowMultipleInstances: true,
    compulsory: true,
    condition: ({ trigger, match }) =>
      trigger.args.playerId === args.playerId &&
      match.stats.turns.length - 1 === turnHistoryIndex,
    triggeredEffectFn: async (triggeredArgs) => {
      triggeredArgs.reactionManager.unregisterTrigger(drawSwapTriggerId);
      loggerService.debug('[way-of-the-chameleon effect] removed draw swap trigger at end of turn');
    },
  }, {
    idSuffix: `way-of-the-chameleon:cleanup:turn:${turnHistoryIndex}:play:${playInstance}`,
  });
};

const expansion: CardExpansionModule = {
  'way-of-the-butterfly': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const shouldReturn = await cardEffectArgs.promptService.confirm({
        playerId: cardEffectArgs.playerId,
        prompt: 'Return this to its pile to gain a card costing exactly $1 more?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }, 2);

      if (!shouldReturn) {
        loggerService.debug('[way-of-the-butterfly effect] player declined to return card to pile');
        return;
      }

      const returnedToPile = await returnCardToPile(cardEffectArgs, 'way-of-the-butterfly effect');
      if (!returnedToPile) {
        loggerService.debug('[way-of-the-butterfly effect] card could not be returned, skipping gain');
        return;
      }

      // Gain a card costing exactly $1 more than the returned card.
      const returnedCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: returnedCost } = cardEffectArgs.cardPriceController.applyRules(returnedCard, {
        playerId: cardEffectArgs.playerId,
      });
      const targetCost: CardCost = {
        treasure: (returnedCost.treasure ?? 0) + 1,
        potion: returnedCost.potion ?? 0,
        debt: returnedCost.debt ?? 0,
      };

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing exactly $1 more',
        restrict: { all: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'exact', playerId: cardEffectArgs.playerId, amount: targetCost },
        ] },
        count: 1,
        optional: true,
      });
      const selectedCardId = selectedCardIds[0];

      if (!selectedCardId) {
        loggerService.debug('[way-of-the-butterfly effect] no gain target selected');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'way-of-the-chameleon': {
    registerEffects: () => async (cardEffectArgs) => {
      cardEffectArgs.loggerService.debug(
        '[way-of-the-chameleon effect] registering this-turn draw-to-treasure conversion trigger',
      );
      registerWayOfTheChameleonDrawSwap(cardEffectArgs);
      // Chameleon follows the played card's instructions after the swap trigger is armed.
      await runOriginalCardEffectsFromContext(cardEffectArgs);
    },
  },
  'way-of-the-camel': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Way of the Camel exiles a Gold from the Supply.
      const topGold = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
        pileKey: 'gold',
        from: 'basicSupply',
      });
      if (!topGold) {
        loggerService.debug('[way-of-the-camel effect] no Gold remains in the Supply');
        return;
      }

      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: topGold.id,
      });
    },
  },
  'way-of-the-frog': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Way of the Frog gives +1 Action immediately.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const playInstance = getCurrentPlayInstanceCount(cardEffectArgs);
      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Then, this turn, when the played card is discarded from play, topdeck it.
      cardEffectArgs.reactionManager.registerReactionTemplate(
        sourceCard,
        'discardCard',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: ({ trigger, match }) =>
            trigger.args.playerId === cardEffectArgs.playerId &&
            trigger.args.cardId === cardEffectArgs.cardId &&
            match.stats.turns.length - 1 === turnHistoryIndex &&
            (
              trigger.args.previousLocation.location === 'playArea' ||
              trigger.args.previousLocation.location === 'activeDuration'
            ),
          triggeredEffectFn: async (triggeredArgs) => {
            const discardPile = getPlayerSourceSafe(triggeredArgs, 'playerDiscard', cardEffectArgs.playerId);
            if (!discardPile.includes(cardEffectArgs.cardId)) {
              loggerService.debug('[way-of-the-frog effect] card is no longer in discard, skipping topdeck');
              return;
            }
            await triggeredArgs.actionService.run('moveCard', {
              cardId: cardEffectArgs.cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'playerDeck' },
            });
          },
        },
        { idSuffix: `way-of-the-frog:turn:${turnHistoryIndex}:play:${playInstance}` },
      );
    },
  },
  'way-of-the-goat': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (hand.length < 1) {
        loggerService.debug('[way-of-the-goat effect] no cards in hand to trash');
        return;
      }

      // Way of the Goat trashes one card from hand.
      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      });

      if (!selectedCardId) {
        loggerService.debug('[way-of-the-goat effect] no card selected to trash');
        return;
      }

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'way-of-the-horse': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Horse gives +2 Cards and +1 Action.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Then it tries to return "this" card to its pile.
      await returnCardToPile(cardEffectArgs, 'way-of-the-horse effect');
    },
  },
  'way-of-the-mole': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Mole gives +1 Action first.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Then discard the full hand and draw 3 cards.
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (hand.length > 0) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: [...hand],
        });
      }

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
    },
  },
  'way-of-the-monkey': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Monkey gives +1 Buy and +$1.
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
    },
  },
  'way-of-the-mule': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Mule gives +1 Action and +$1.
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
    },
  },
  'way-of-the-mouse': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const metadata = getWayOfTheMouseMetadata(cardEffectArgs);
      const runtimeSetAsidePileKey = metadata?.runtimeSetAsidePileKey;
      if (!runtimeSetAsidePileKey) {
        loggerService.warn('[way-of-the-mouse effect] missing runtime set-aside pile metadata');
        return;
      }

      // Resolve the runtime set-aside card id from the shared set-aside area using the synthetic pile key.
      const setAsideCardIds = cardEffectArgs.cardSourceController.getSource('set-aside');
      const setAsideCardId = setAsideCardIds.find((candidateId) => {
        const candidate = cardEffectArgs.cardLibrary.getCard(candidateId);
        return candidate.kingdom === runtimeSetAsidePileKey;
      });
      if (setAsideCardId === undefined) {
        loggerService.warn(`[way-of-the-mouse effect] no set-aside card found in pile ${runtimeSetAsidePileKey}`);
        return;
      }

      const setAsideCard = cardEffectArgs.cardLibrary.getCard(setAsideCardId);
      if (metadata?.setAsideCardKey && setAsideCard.cardKey !== metadata.setAsideCardKey) {
        loggerService.warn(
          `[way-of-the-mouse effect] expected ${metadata.setAsideCardKey} but found ${setAsideCard.cardKey}`,
        );
      }

      // Play the set-aside card without moving it and force the normal path (cannot recurse into Way of the Mouse).
      loggerService.info(`[way-of-the-mouse effect] playing set-aside card ${setAsideCard}`);
      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: setAsideCardId,
        wayId: null,
        overrides: {
          actionCost: 0,
          moveCard: false,
        },
      });
    },
  },
  'way-of-the-otter': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Otter gives +2 Cards.
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'way-of-the-owl': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Owl draws until the player has 6 cards in hand.
      while (getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId).length < 6) {
        const drawnCard = await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
        });
        if (!drawnCard) {
          cardEffectArgs.loggerService.debug('[way-of-the-owl effect] no cards left to draw');
          return;
        }
      }
    },
  },
  'way-of-the-ox': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Ox gives +2 Actions.
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  'way-of-the-pig': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Pig gives +1 Card and +1 Action.
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
    },
  },
  'way-of-the-rat': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      const handTreasureIds = hand.filter((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE'));
      if (handTreasureIds.length < 1) {
        loggerService.debug('[way-of-the-rat effect] no Treasure in hand to discard');
        return;
      }

      // Way of the Rat optionally discards a Treasure.
      const selectedTreasureId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Discard a Treasure to gain a copy of this?',
        restrict: handTreasureIds,
        count: 1,
        optional: true,
      });

      if (!selectedTreasureId) {
        loggerService.debug('[way-of-the-rat effect] player declined to discard a Treasure');
        return;
      }

      await cardEffectArgs.actionService.run('discardCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedTreasureId,
      });

      const playedCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const copyToGain = findTopSupplyCard(cardEffectArgs, playedCard.cardKey);
      if (!copyToGain) {
        loggerService.debug(`[way-of-the-rat effect] no supply copy remains for ${playedCard.cardKey}`);
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: copyToGain.id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'way-of-the-seal': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Way of the Seal grants +$1 immediately.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      // Then it enables a rest-of-turn "topdeck gained card" choice.
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const playInstance = getCurrentPlayInstanceCount(cardEffectArgs);
      const gainTriggerId =
        `way-of-the-seal:${cardEffectArgs.playerId}:turn:${turnHistoryIndex}:source:${cardEffectArgs.cardId}:play:${playInstance}`;

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: gainTriggerId,
        listeningFor: 'cardGained',
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCardId = triggeredArgs.trigger.args.cardId;
          const gainedCard = triggeredArgs.cardLibrary.getCard(gainedCardId);

          const decision = await triggeredArgs.actionService.run('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: `Put ${gainedCard.cardName} onto your deck?`,
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
          }) as { action: number };

          if (decision.action !== 2) {
            loggerService.debug('[way-of-the-seal effect] player declined to topdeck gained card');
            return;
          }

          // Stop-moving guard: only move the card if it has not moved since being gained.
          if (!isCardStillAtGainedLocation(
            triggeredArgs.cardSourceController,
            gainedCardId,
            triggeredArgs.trigger.args.gainedLocation,
          )) {
            loggerService.debug('[way-of-the-seal effect] gained card moved before topdeck choice resolved');
            return;
          }

          await triggeredArgs.actionService.run('moveCard', {
            cardId: gainedCardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });

      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.reactionManager.registerSystemTemplate(sourceCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: ({ trigger, match }) =>
          trigger.args.playerId === cardEffectArgs.playerId &&
          match.stats.turns.length - 1 === turnHistoryIndex,
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.reactionManager.unregisterTrigger(gainTriggerId);
          loggerService.debug('[way-of-the-seal effect] removed gain trigger at end of turn');
        },
      }, {
        idSuffix: `way-of-the-seal:${cardEffectArgs.cardId}:turn:${turnHistoryIndex}:play:${playInstance}`,
      });
    },
  },
  'way-of-the-sheep': {
    registerEffects: () => async (cardEffectArgs) => {
      // Way of the Sheep gives +$2.
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
    },
  },
  'way-of-the-squirrel': {
    registerEffects: () => async (cardEffectArgs) => {
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const playInstance = getCurrentPlayInstanceCount(cardEffectArgs);
      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Way of the Squirrel draws 2 cards at end of turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(sourceCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: ({ trigger, match }) =>
          trigger.args.playerId === cardEffectArgs.playerId &&
          match.stats.turns.length - 1 === turnHistoryIndex,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          });
        },
      }, {
        idSuffix: `way-of-the-squirrel:${cardEffectArgs.cardId}:turn:${turnHistoryIndex}:play:${playInstance}`,
      });
    },
  },
  'way-of-the-turtle': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Way of the Turtle sets the played card aside.
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: cardEffectArgs.cardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'set-aside' },
      });

      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const playInstance = getCurrentPlayInstanceCount(cardEffectArgs);
      // Then it plays that card at the start of the next turn.
      cardEffectArgs.reactionManager.registerReactionTemplate(
        sourceCard,
        'startTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: ({ trigger, cardSourceController }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }
            return getPlayerSourceSafe(
              { ...cardEffectArgs, cardSourceController },
              'set-aside',
              cardEffectArgs.playerId,
            ).includes(cardEffectArgs.cardId);
          },
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[way-of-the-turtle effect] replaying set-aside card at start of turn');
            await triggeredArgs.actionService.run('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardEffectArgs.cardId,
              overrides: { actionCost: 0 },
            });
          },
        },
        { idSuffix: `way-of-the-turtle:turn:${turnHistoryIndex}:play:${playInstance}` },
      );
    },
  },
  'way-of-the-worm': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      // Way of the Worm exiles an Estate from the Supply.
      const topEstate = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
        pileKey: 'estate',
        from: 'basicSupply',
      });
      if (!topEstate) {
        loggerService.debug('[way-of-the-worm effect] no Estate remains in the Supply');
        return;
      }

      await cardEffectArgs.actionService.run('exileCard', {
        playerId: cardEffectArgs.playerId,
        cardId: topEstate.id,
      });
    },
  },
};

export default expansion;
