import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { CardId } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { isPlayerImmune, markPlayerImmune } from '../../utils/reaction-immunity.ts';

const getTurnHistoryIndex = (args: { match: { stats: { turns: unknown[] } } }): number => {
  return Math.max(0, args.match.stats.turns.length - 1);
};

const registerThisTurnTopdeckOnGain = (cardEffectArgs: CardEffectFunctionContext) => {
  const loggerService = cardEffectArgs.loggerService;
  const turnHistoryIndex = getTurnHistoryIndex(cardEffectArgs);
  const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
  const triggerId = cardEffectArgs.reactionManager.registerReactionTemplate(sourceCard, 'cardGained', {
    playerId: cardEffectArgs.playerId,
    once: false,
    allowMultipleInstances: true,
    compulsory: false,
    condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
    triggeredEffectFn: async (triggeredArgs) => {
      const gainedCardId = triggeredArgs.trigger.args.cardId as CardId;
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
        return;
      }

      if (
        !isCardStillAtGainedLocation(
          triggeredArgs.cardSourceController,
          gainedCardId,
          triggeredArgs.trigger.args.gainedLocation,
        )
      ) {
        loggerService.debug('[insignia effect] gained card moved before topdeck choice resolved');
        return;
      }

      await triggeredArgs.actionService.run('moveCard', {
        cardId: gainedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDeck' },
      });
    },
  });

  cardEffectArgs.reactionManager.registerSystemTemplate(sourceCard, 'endTurn', {
    playerId: cardEffectArgs.playerId,
    once: true,
    allowMultipleInstances: true,
    compulsory: true,
    condition: ({ trigger, match }) =>
      trigger.args.playerId === cardEffectArgs.playerId && getTurnHistoryIndex({ match }) === turnHistoryIndex,
    triggeredEffectFn: async (triggeredArgs) => {
      triggeredArgs.reactionManager.unregisterTrigger(triggerId);
    },
  }, {
    idSuffix: `insignia:${cardEffectArgs.cardId}:turn:${turnHistoryIndex}`,
  });
};

const gainTreasureAndBuy = async (args: {
  actionService: CardEffectFunctionContext['actionService'];
  treasure: number;
  buy: number;
}) => {
  if (args.treasure > 0) {
    await args.actionService.run('gainTreasure', { count: args.treasure });
  }
  if (args.buy > 0) {
    await args.actionService.run('gainBuy', { count: args.buy });
  }
};

const cardEffects: CardExpansionModule = {
  'amphora': {
    registerEffects: () => async (cardEffectArgs) => {
      const decision = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain +$3 and +1 Buy now or at the start of your next turn?',
        actionButtons: [
          { label: 'NOW', action: 1 },
          { label: 'NEXT TURN', action: 2 },
        ],
      }) as { action: number };

      if (decision.action === 1) {
        await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });
        return;
      }

      const amphoraCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(amphoraCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: amphoraCard.id,
            to: { location: 'playArea' },
          });
          await gainTreasureAndBuy({ actionService: triggeredArgs.actionService, treasure: 3, buy: 1 });
        },
      });
    },
  },
  'doubloons': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const goldCards = cardEffectArgs.findCardService.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'gold' },
        ]);
        const goldCard = goldCards.slice(-1)[0];
        if (!goldCard) {
          return;
        }
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: eventArgs.playerId,
          cardId: goldCard.id,
          to: { location: 'playerDiscard' },
        }, {
          loggingContext: { source: eventArgs.cardId },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { loggingContext: { source: cardEffectArgs.cardId } });
    },
  },
  'endless-chalice': {
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 1, buy: 1 });

      const chaliceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(chaliceCard, {
        playerId: cardEffectArgs.playerId,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: chaliceCard.id,
            to: { location: 'playArea' },
          });
          await gainTreasureAndBuy({ actionService: triggeredArgs.actionService, treasure: 1, buy: 1 });
        },
      }, {
        // Endless Chalice repeats "for the rest of the game"; keep duration cleanup tracking effectively permanent.
        cleanupCount: Number.MAX_SAFE_INTEGER,
      });
    },
  },
  'figurehead': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { loggingContext: { source: cardEffectArgs.cardId } });

      const figureheadCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(figureheadCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: figureheadCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          }, {
            loggingContext: { source: figureheadCard.id },
          });
        },
      });
    },
  },
  'hammer': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { loggingContext: { source: cardEffectArgs.cardId } });

      const gainableCardIds = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } },
      ]).map((card) => card.id);

      if (!gainableCardIds.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $4',
        restrict: gainableCardIds,
        count: 1,
      });

      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'insignia': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { loggingContext: { source: cardEffectArgs.cardId } });
      registerThisTurnTopdeckOnGain(cardEffectArgs);
    },
  },
  'jewels': {
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const jewelsCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(jewelsCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: jewelsCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck', index: 0 },
          });
        },
      });
    },
  },
  'orb': {
    registerEffects: () => async (cardEffectArgs) => {
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      const discardPlayable = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId)
        .filter((cardId) => {
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          return card.type.includes('ACTION') || card.type.includes('TREASURE');
        });

      const decision = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: 'PLAY ACTION/TREASURE', action: 1 },
          { label: '+$3 AND +1 BUY', action: 2 },
        ],
        content: {
          type: 'display-cards',
          cardIds: discard,
        },
      }) as { action: number };

      if (decision.action === 2) {
        await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });
        return;
      }

      if (!discardPlayable.length) {
        cardEffectArgs.loggerService.debug('[orb effect] no Action/Treasure in discard to play');
        return;
      }

      const selectPrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Play an Action or Treasure from your discard',
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'PLAY', action: 2 },
        ],
        content: {
          type: 'select',
          cardIds: discardPlayable,
          selectCount: 1,
        },
      }) as { action?: number; result?: CardId[] } | null;

      if (selectPrompt?.action !== 2) {
        return;
      }

      const selectedCardId = selectPrompt?.result?.[0];

      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        overrides: { actionCost: 0 },
      });
    },
  },
  'prize-goat': {
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may trash a card from your hand',
        restrict: hand,
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });
      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
    },
  },
  'puzzle-box': {
    registerEffects: () => async (cardEffectArgs) => {
      const puzzleBoxCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may set aside a card from your hand',
        restrict: hand,
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });
      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: selectedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'set-aside' },
        facing: 'back',
        setAsideSource: {
          ownerPlayerId: cardEffectArgs.playerId,
          sourceKind: 'card',
          sourceCardId: cardEffectArgs.cardId,
          sourceCardKey: 'puzzle-box',
        },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(puzzleBoxCard, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          const setAside = triggeredArgs.cardSourceController.getSource('set-aside', cardEffectArgs.playerId);
          if (!setAside.includes(selectedCardId)) {
            return;
          }
          await triggeredArgs.actionService.run('moveCard', {
            cardId: selectedCardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
          });
        },
      });
    },
  },
  'sextant': {
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const playerId = cardEffectArgs.playerId;
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', playerId);
      let deck = cardEffectArgs.cardSourceController.getSource('playerDeck', playerId);
      const cardsToLookAtCount = Math.min(5, deck.length + discard.length);

      if (!cardsToLookAtCount) {
        return;
      }

      if (deck.length < cardsToLookAtCount) {
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId });
        deck = cardEffectArgs.cardSourceController.getSource('playerDeck', playerId);
      }

      const cardsToLookAt = deck.slice(-cardsToLookAtCount);
      let promptResult = await cardEffectArgs.promptService.requestActionResult<CardId[]>({
        prompt: `Discard any number of these ${cardsToLookAt.length} cards`,
        playerId,
        actionButtons: [{ label: 'DONE', action: 1 }],
        content: {
          type: 'select',
          cardIds: cardsToLookAt,
          selectCount: { kind: 'upTo', count: cardsToLookAt.length },
        },
      });

      for (const selectedCardId of promptResult?.result ?? []) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId,
          cardId: selectedCardId,
        });
      }

      const remainingCards = cardsToLookAt.filter((cardId) => !(promptResult?.result ?? []).includes(cardId));
      if (!remainingCards.length) {
        return;
      }

      if (remainingCards.length === 1) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: remainingCards[0],
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
        return;
      }

      promptResult = await cardEffectArgs.promptService.requestActionResult<CardId[]>({
        prompt: 'Put the rest back in any order',
        playerId,
        actionButtons: [{ label: 'DONE', action: 1 }],
        content: {
          type: 'rearrange',
          cardIds: remainingCards,
        },
      });

      for (const cardId of promptResult?.result ?? []) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'shield': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (cardEffectArgs, eventArgs) => {
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `shield:${eventArgs.cardId}:cardPlayed`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardPlayed',
          allowMultipleInstances: false,
          condition: ({ cardLibrary, trigger }) =>
            cardLibrary.getCard(trigger.args.cardId!).type.includes('ATTACK') &&
            trigger.args.playerId !== eventArgs.playerId,
          triggeredEffectFn: async ({ actionService, reaction, reactionContext }) => {
            const sourceCardId = reaction.getSourceId();
            await actionService.run('revealCard', {
              cardId: sourceCardId,
              playerId: reaction.playerId,
            });
            markPlayerImmune(reaction.playerId, reactionContext);
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`shield:${cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });
    },
  },
  'spell-scroll': {
    registerEffects: () => async (cardEffectArgs) => {
      const playerId = cardEffectArgs.playerId;
      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: sourceCost } = cardEffectArgs.cardPriceController.applyRules(sourceCard, { playerId });

      await cardEffectArgs.actionService.run('trashCard', {
        playerId,
        cardId: cardEffectArgs.cardId,
      });

      const gainableCards = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
      ]).filter((card) => compareCardCosts(cardEffectArgs.cardPriceController.applyRules(card, { playerId }).cost, sourceCost) === -1);

      if (!gainableCards.length) {
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Gain a cheaper card',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      });
      if (!selectedGainCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });

      const gainedCard = cardEffectArgs.cardLibrary.getCard(selectedGainCardId);
      if (!gainedCard.type.includes('ACTION') && !gainedCard.type.includes('TREASURE')) {
        return;
      }

      const shouldPlay = await cardEffectArgs.promptService.confirm({
        playerId,
        prompt: `Play ${gainedCard.cardName}?`,
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      }, 2);

      if (!shouldPlay) {
        return;
      }

      await cardEffectArgs.actionService.run('playCard', {
        playerId,
        cardId: gainedCard.id,
        overrides: { actionCost: 0 },
      });
    },
  },
  'staff': {
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const actionCardsInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
        .map((cardId) => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter((card) => card.type.includes('ACTION'));

      if (!actionCardsInHand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may play an Action from your hand',
        restrict: actionCardsInHand.map((card) => card.id),
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });
      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        overrides: { actionCost: 0 },
      });
    },
  },
  'sword': {
    registerEffects: () => async (cardEffectArgs) => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter((playerId) => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        await discardDownTo(cardEffectArgs, {
          playerId: targetPlayerId,
          targetHandSize: 4,
          prompt: 'Discard down to 4 cards in hand',
          logTag: 'sword effect',
        });
      }
    },
  },
};

export default cardEffects;
