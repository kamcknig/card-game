import { CardExpansionModule } from '@server-types/index.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { Card, CardId } from 'shared/types/index.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansion: CardExpansionModule = {
  'alchemist': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            loggerService.debug(`[alchemist effect] gaining 2 cards and 1 action`);
      await args.actionService.run('drawCard', { playerId: args.playerId, count: 2 });

      await args.actionService.run('gainAction', { count: 1 });

      args.reactionManager.registerReactionTemplate({
        id: `alchemist:${args.cardId}:endTurn`,
        playerId: args.playerId,
        listeningFor: 'endTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: () => true,
        triggeredEffectFn: async () => {
          args.reactionManager.unregisterTrigger(`alchemist:${args.cardId}:endTurn`);
          args.reactionManager.unregisterTrigger(`alchemist:${args.cardId}:startCleanUpPhase`);
        },
      });

      args.reactionManager.registerReactionTemplate({
        id: `alchemist:${args.cardId}:startCleanUpPhase`,
        playerId: args.playerId,
        listeningFor: 'startTurnPhase',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') {
            return false;
          }

          if (conditionArgs.match.stats.playedCards[args.cardId]?.turnNumber !== conditionArgs.match.turnNumber) {
            return false;
          }

          const cardsInPlay = args.findCardService.getCardsInPlay();
          const ownedCardsInPlay = cardsInPlay.filter((card) => card.owner === args.playerId);
          const potionCardsInPlay = ownedCardsInPlay.filter((card) => card.cardKey === 'potion');

          return potionCardsInPlay.length > 0;
        },
        triggeredEffectFn: async (triggerEffectArgs) => {
          const result = await triggerEffectArgs.actionService.run('userPrompt', {
            prompt: 'Top-deck Alchemist?',
            playerId: args.playerId,
            actionButtons: [
              { label: `Cancel`, action: 1 },
              { label: `Top-deck`, action: 2 },
            ],
          }) as { action: number; cardIds: number[] };

          if (result.action === 2) {
            loggerService.debug(`[alchemist triggered effect] player chose to top-deck alchemist`);
            await triggerEffectArgs.actionService.run('moveCard', {
              cardId: args.cardId,
              toPlayerId: args.playerId,
              to: { location: 'playerDeck' },
            });
          } else {
            loggerService.debug(`[alchemist triggered effect] player chose not to top-deck alchemist`);
          }
        },
      });
    },
  },
  'apothecary': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            loggerService.debug(`[apothecary effect] gaining 1 card and 1 action`);
      await args.actionService.run('drawCard', { playerId: args.playerId });
      await args.actionService.run('gainAction', { count: 1 });

      const playerDeck = args.cardSourceController.getSource('playerDeck', args.playerId);
      const playerDiscard = args.cardSourceController.getSource('playerDiscard', args.playerId);

      const numToReveal = Math.min(4, playerDeck.length + playerDiscard.length);

      if (playerDeck.length < numToReveal) {
        await args.actionService.run('shuffleDeck', { playerId: args.playerId });
      }

      const cardsToReveal = playerDeck.slice(-numToReveal).map(args.cardLibrary.getCard);
      const setAside: Card[] = [];

      for (const card of cardsToReveal) {
        await args.actionService.run('revealCard', {
          cardId: card.id,
          playerId: args.playerId,
        });

        if (['copper', 'potion'].includes(card.cardKey)) {
          await args.actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: args.playerId,
            to: { location: 'playerHand' },
          });
        } else {
          setAside.push(card);
          await args.actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: args.playerId,
            to: { location: 'set-aside' },
          });
        }
      }

      const result = setAside.length === 1
        ? { cardIds: setAside.map((card) => card.id) }
        : await args.actionService.run('userPrompt', {
          prompt: 'Put on top of deck in any order',
          playerId: args.playerId,
          actionButtons: [{ label: 'DONE', action: 1 }],
          content: {
            type: 'rearrange',
            cardIds: setAside.map((card) => card.id),
          },
        }) as { action: number; cardIds: number[] };

      if (result.cardIds.length > 0) {
        loggerService.debug(
          `[apothecary effect] putting cards back on top of deck ${result.cardIds.map(args.cardLibrary.getCard)}`,
        );
        for (const cardId of result.cardIds) {
          await args.actionService.run('moveCard', {
            cardId: cardId,
            toPlayerId: args.playerId,
            to: { location: 'playerDeck' },
          });
        }
      }
    },
  },
  'apprentice': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            loggerService.debug(`[apprentice effect] gaining 1 action`);
      await args.actionService.run('gainAction', { count: 1 });

      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      if (hand.length === 0) {
        loggerService.debug(`[apprentice effect] no cards in hand`);
        return;
      }

      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: `Trash card`,
        restrict: hand,
        count: 1,
      }) as CardId | null;

      if (!selectedCardId) {
        loggerService.warn(`[apprentice effect] no card selected`);
        return;
      }

      const card = args.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[apprentice effect] trashing selected card ${card}`);

      await args.actionService.run('trashCard', {
        playerId: args.playerId,
        cardId: card.id,
      });

      const { cost } = args.cardPriceController.applyRules(card, { playerId: args.playerId });

      const numCardsToDraw = cost.treasure + (cost.potion !== undefined ? 2 : 0);

      loggerService.debug(`[apprentice effect] drawing ${numCardsToDraw} cards`);

      await args.actionService.run('drawCard', { playerId: args.playerId, count: numCardsToDraw });
    },
  },
  'familiar': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            loggerService.debug(`[familiar effect] gaining 1 card and 1 action`);
      await args.actionService.run('drawCard', { playerId: args.playerId });
      await args.actionService.run('gainAction', { count: 1 });

      const targets = findOrderedTargets({
        match: args.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: args.playerId,
      }).filter((id) => !isPlayerImmune(args.reactionContext, id));

      for (const targetId of targets) {
        const curseCardId = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'curse' }])?.slice(-1)?.[0]?.id;

        if (curseCardId === undefined) {
          loggerService.debug(`[familiar effect] no curse card in basic supply`);
          break;
        }

        loggerService.debug(`[familiar effect] gaining curse card to ${getPlayerById(args.match, targetId)}`);

        await args.actionService.run('gainCard', {
          cardId: curseCardId,
          playerId: targetId,
          to: { location: 'playerDiscard' },
        }, {
          loggingContext: {
            source: args.cardId,
          },
        });
      }
    },
  },
  'golem': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            const deck = args.cardSourceController.getSource('playerDeck', args.playerId);
      const discard = args.cardSourceController.getSource('playerDiscard', args.playerId);

      const actionCardsSetAside: Card[] = [];
      const cardsToDiscard: Card[] = [];

      while (deck.length + discard.length > 0 && actionCardsSetAside.length !== 2) {
        if (deck.length === 0) {
          await args.actionService.run('shuffleDeck', { playerId: args.playerId });
        }

        const cardId = deck.slice(-1)[0];
        const card = args.cardLibrary.getCard(cardId);

        loggerService.debug(`[golem effect] revealing card ${card}`);
        await args.actionService.run('revealCard', {
          cardId: card.id,
          playerId: args.playerId,
        });

        loggerService.debug(`[golem effect] card is non-golem action, setting aside`);
        await args.actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: args.playerId,
          to: { location: 'set-aside' },
        });

        if (card.type.includes('ACTION') && card.cardKey !== 'golem') {
          actionCardsSetAside.push(card);
        } else {
          loggerService.debug(`[golem effect] card is golem, or action, setting aside to discard`);
          cardsToDiscard.push(card);
        }
      }

      loggerService.debug(`[golem effect] discarding ${cardsToDiscard.length} cards`);
      for (const card of cardsToDiscard) {
        await args.actionService.run('discardCard', { cardId: card.id, playerId: args.playerId });
      }

      const actions = actionCardsSetAside.map((card, idx) => ({
        label: `Play ${card.cardName}`,
        action: idx + 1,
      }));
      loggerService.debug(`[golem effect] playing ${actionCardsSetAside.length} cards`);

      const getAction = async () => {
        if (actions.length === 1) {
          return actions.shift()?.action;
        }

        const result = await args.actionService.run('userPrompt', {
          prompt: 'Choose to play',
          playerId: args.playerId,
          actionButtons: actions,
        }) as { action: number; cardIds: number[] };
        const idx = actions.findIndex((action) => action.action === result.action);
        actions.splice(idx, 1);
        return result.action;
      };

      while (actions.length > 0) {
        const action = await getAction();
        const card = actionCardsSetAside[action! - 1];
        await args.actionService.run('playCard', {
          cardId: card.id,
          playerId: args.playerId,
          overrides: {
            actionCost: 0,
          },
        });
      }
    },
  },
  'herbalist': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            loggerService.debug(`[herbalist effect] gaining 1 buy and 1 treasure`);
      await args.actionService.run('gainBuy', { count: 1 });
      await args.actionService.run('gainTreasure', { count: 1 });

      args.reactionManager.registerReactionTemplate({
        id: `herbalist:${args.cardId}:endTurn`,
        playerId: args.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        listeningFor: 'endTurn',
        condition: () => true,
        triggeredEffectFn: async () => {
          args.reactionManager.unregisterTrigger(`herbalist:${args.cardId}:endTurn`);
          args.reactionManager.unregisterTrigger(`herbalist:${args.cardId}:discardCard`);
        },
      });

      args.reactionManager.registerReactionTemplate({
        id: `herbalist:${args.cardId}:discardCard`,
        listeningFor: 'discardCard',
        once: true,
        allowMultipleInstances: true,
        compulsory: false,
        playerId: args.playerId,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== args.playerId) return false;
          if (!conditionArgs.trigger.args.previousLocation) return false;
          if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation.location)) return false;
          return conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId).type.includes('TREASURE');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const card = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          loggerService.debug(`[herbalist triggered effect] moving ${card} to top of deck`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: triggeredArgs.trigger.args.cardId,
            toPlayerId: args.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });
    },
  },
  'philosophers-stone': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            const deck = args.cardSourceController.getSource('playerDeck', args.playerId);
      const discard = args.cardSourceController.getSource('playerDiscard', args.playerId);

      const cardCount = deck.length + discard.length;
      const amountToGain = Math.floor(cardCount / 5);
      loggerService.debug(`[philosophers-stone effect] card count ${cardCount}, gaining ${amountToGain} treasure`);
      await args.actionService.run('gainTreasure', { count: amountToGain });
    },
  },
  'scrying-pool': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            loggerService.debug(`[scrying-pool effect] gaining 1 action`);
      await args.actionService.run('gainAction', { count: 1 });

      const targetIds = findOrderedTargets({
        match: args.match,
        appliesTo: 'ALL',
        startingPlayerId: args.playerId,
      }).filter((playerId) => !isPlayerImmune(args.reactionContext, playerId));

      for (const targetPlayerId of targetIds) {
        const deck = args.cardSourceController.getSource('playerDeck', targetPlayerId);

        if (deck.length === 0) {
          loggerService.debug(`[scrying-pool effect] no cards in deck, shuffling`);
          await args.actionService.run('shuffleDeck', { playerId: targetPlayerId });

          if (deck.length === 0) {
            loggerService.debug(`[scrying-pool effect] still no cards in deck, skipping`);
            continue;
          }
        }

        const cardId = deck.slice(-1)[0];
        const card = args.cardLibrary.getCard(cardId);

        loggerService.debug(`[scrying-pool effect] revealing card ${card}`);

        await args.actionService.run('revealCard', {
          cardId: cardId,
          playerId: targetPlayerId,
          moveToSetAside: true,
        });

        const result = await args.actionService.run('userPrompt', {
          prompt: `Discard or top-deck ${card.cardName}?`,
          playerId: args.playerId,
          actionButtons: [
            { label: `Discard`, action: 1 },
            { label: `Top-deck`, action: 2 },
          ],
        }) as { action: number; cardIds: number[] };

        if (result.action === 1) {
          loggerService.debug(`[scrying-pool effect] ${getPlayerById(args.match, args.playerId)} chose discard`);
          await args.actionService.run('discardCard', {
            cardId: cardId,
            playerId: targetPlayerId,
          });
        } else {
          loggerService.debug(`[scrying-pool effect] ${getPlayerById(args.match, args.playerId)} chose top-deck`);
          await args.actionService.run('moveCard', {
            cardId: cardId,
            toPlayerId: targetPlayerId,
            to: { location: 'playerDeck' },
          });
        }
      }

      const deck = args.cardSourceController.getSource('playerDeck', args.playerId);
      const discard = args.cardSourceController.getSource('playerDiscard', args.playerId);

      const cardsRevealed: Card[] = [];

      while (deck.length + discard.length > 0) {
        const cardId = deck.slice(-1)[0];
        if (!cardId) {
          loggerService.debug(`[scrying-pool effect] no cards in deck, shuffling`);
          await args.actionService.run('shuffleDeck', { playerId: args.playerId });

          if (deck.length === 0) {
            loggerService.debug(`[scrying-pool effect] still no cards in deck`);
            return;
          }
        }

        const card = args.cardLibrary.getCard(cardId);
        cardsRevealed.push(card);

        await args.actionService.run('revealCard', {
          cardId: card.id,
          playerId: args.playerId,
          moveToSetAside: true,
        });

        if (!card.type.includes('ACTION')) {
          break;
        }
      }

      loggerService.debug(`[scrying-pool effect] putting ${cardsRevealed.length} cards in hand`);

      for (const card of cardsRevealed) {
        await args.actionService.run('moveCard', {
          cardId: card.id,
          toPlayerId: args.playerId,
          to: { location: 'playerHand' },
        });
      }
    },
  },
  'transmute': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: `Trash card`,
        restrict: args.cardSourceController.getSource('playerHand', args.playerId),
        count: 1,
      }) as CardId | null;
      if (!selectedCardId) {
        loggerService.debug(`[transmute effect] no card selected`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardId);

      await args.actionService.run('trashCard', {
        playerId: args.playerId,
        cardId: selectedCardId,
      });

      let cards: Card[] = [];
      if (selectedCard.type.includes('ACTION')) {
        cards = args.findCardService.findCards([
          { location: ['basicSupply'] },
          { cardKeys: 'duchy' },
        ]);

        const card = cards.slice(-1)[0];
        if (card) {
          loggerService.debug(`[transmute effect] card is action, gaining duchy`);

          await args.actionService.run('gainCard', {
            playerId: args.playerId,
            cardId: card.id,
            to: { location: 'playerDiscard' },
          });
        }
      }

      if (selectedCard.type.includes('TREASURE')) {
        cards = args.findCardService.findCards([
          { location: 'kingdomSupply' },
          { cardKeys: 'transmute' },
        ]);

        const card = cards.slice(-1)[0];
        if (card) {
          loggerService.debug(`[transmute effect] card is treasure, gaining transmute`);

          await args.actionService.run('gainCard', {
            playerId: args.playerId,
            cardId: card.id,
            to: { location: 'playerDiscard' },
          });
        }
      }

      if (selectedCard.type.includes('VICTORY')) {
        cards = args.findCardService.findCards(
          [
            { location: 'basicSupply' },
            { cardKeys: 'gold' },
          ],
        );

        const card = cards.slice(-1)[0];
        if (card) {
          loggerService.debug(`[transmute effect] card is victory, gaining gold`);

          await args.actionService.run('gainCard', {
            playerId: args.playerId,
            cardId: card.id,
            to: { location: 'playerDiscard' },
          });
        }
      }
    },
  },
  'university': {
    registerEffects: () => async (args) => {
      const loggerService = args.loggerService;
            await args.actionService.run('gainAction', { count: 2 });

      const selectedCardId = await args.actionService.run('selectSingleCard', {
        playerId: args.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: 'kingdomSupply' },
          { cardType: 'ACTION' },
          { kind: 'upTo', amount: { treasure: 5 }, playerId: args.playerId },
        ],
        count: 1,
        optional: true,
      }) as CardId | null;

      if (!selectedCardId) {
        loggerService.debug(`[university effect] no card selected`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardId);

      loggerService.debug(`[university effect] gaining ${selectedCard}`);

      await args.actionService.run('gainCard', {
        playerId: args.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'vineyard': {
    registerScoringFunction: () => (args) => {
      const ownedActionCards = args.cardLibrary
        .getCardsByOwner(args.ownerId)
        .filter((card) => card.type.includes('ACTION'));

      const victoryPoints = Math.floor(ownedActionCards.length / 3);
      return victoryPoints;
    },
  },
  'potion': {
    registerEffects: () => async (args) => {
            await args.actionService.run('gainPotion', { count: 1 });
    },
  },
};

export default expansion;
