import { Card, CardId, CardKey } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getPlayerStartingFrom } from '@shared/get-player-position-utils.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansion: CardExpansionModule = {
  'anvil': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.actionService.run('gainTreasure', { count: 1 });

      const selectedCardToDiscardId = await effectArgs.actionService.run('selectSingleCard', {
        playerId: effectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: [
          { location: 'playerHand', playerId: effectArgs.playerId },
          { cardType: 'TREASURE' },
        ],
        count: 1,
        optional: true,
      }) as CardId | null;
      if (!selectedCardToDiscardId) {
        console.debug(`[anvil effect] no card selected`);
        return;
      }

      const selectedCardToTrash = effectArgs.cardLibrary.getCard(selectedCardToDiscardId);
      console.debug(`[anvil effect] selected ${selectedCardToTrash}`);

      await effectArgs.actionService.run('discardCard', {
        cardId: selectedCardToDiscardId,
        playerId: effectArgs.playerId,
      });

      const selectedCardToGainId = await effectArgs.actionService.run('selectSingleCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: effectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } },
        ],
        count: 1,
      }) as CardId | null;

      if (!selectedCardToGainId) {
        console.debug(`[anvil effect] no card selected`);
        return;
      }

      const selectedCardToGain = effectArgs.cardLibrary.getCard(selectedCardToGainId);

      console.debug(`[anvil effect] selected ${selectedCardToGain}`);

      await effectArgs.actionService.run('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedCardToGainId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'bank': {
    registerEffects: () => async (effectArgs) => {
      const turnHistoryIndex = effectArgs.match.stats.turns.length - 1;
      const turnStatsIndex = turnHistoryIndex;
      const playedCardIds = effectArgs.match.stats.playedCardsByTurn[turnStatsIndex];
      const playedTreasureCards = playedCardIds?.map(effectArgs.cardLibrary.getCard)
        .filter((card) => card.type.includes('TREASURE'));

      if (!playedTreasureCards?.length) {
        console.debug(`[bank effect] no treasure cards played this turn`);
        return;
      }

      console.debug(
        `[bank effect] played ${playedTreasureCards.length} treasure cards, gaining ${playedTreasureCards.length} treasure`,
      );
      await effectArgs.actionService.run('gainTreasure', { count: playedTreasureCards.length });
    },
  },
  'bishop': {
    registerEffects: () => async (effectArgs) => {
      console.debug(`[bishop effect] gaining 1 treasure and 1 victory token`);
      await effectArgs.actionService.run('gainTreasure', { count: 1 });
      await effectArgs.actionService.run('gainVictoryToken', { playerId: effectArgs.playerId, count: 1 });

      const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
      if (hand.length === 0) {
        console.debug(`[bishop effect] no cards in hand`);
      } else {
        console.debug(`[bishop effect] prompting player to select card to trash`);

        const selectedCardId = await effectArgs.actionService.run('selectSingleCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
        }) as CardId | null;

        if (!selectedCardId) {
          console.warn(`[bishop effect] no card selected`);
        } else {
          const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);

          console.debug(`[bishop effect] selected ${selectedCard} to trash`);

          await effectArgs.actionService.run('trashCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardId,
          });

          const { cost: selectedCardCost } = effectArgs.cardPriceController.applyRules(selectedCard, {
            playerId: effectArgs.playerId,
          });

          const tokensToGain = Math.floor(selectedCardCost.treasure / 2);

          console.debug(`[bishop effect] gaining ${tokensToGain} victory tokens`);

          await effectArgs.actionService.run('gainVictoryToken', {
            playerId: effectArgs.playerId,
            count: tokensToGain,
          });
        }
      }

      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId,
      });

      for (const targetPlayerId of targetPlayerIds) {
        const selectedCardId = await effectArgs.actionService.run('selectSingleCard', {
          playerId: targetPlayerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
          optional: true,
        }) as CardId | null;

        if (!selectedCardId) {
          console.debug(`[bishop effect] target player ${targetPlayerId} selected no card`);
          continue;
        }

        await effectArgs.actionService.run('trashCard', {
          playerId: targetPlayerId,
          cardId: selectedCardId,
        });
      }
    },
  },
  'charlatan': {
    registerEffects: () => async (effectArgs) => {
      console.debug(`[charlatan effect] gaining 3 treasure and 1 action`);
      await effectArgs.actionService.run('gainTreasure', { count: 3 });

      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId,
      }).filter((playerId) => !isPlayerImmune(effectArgs.reactionContext, playerId));

      console.debug(`[charlatan effect] targets ${targetPlayerIds} gaining a curse`);

      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = effectArgs.findCardService.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' },
        ]);

        if (!curseCards.length) {
          console.debug(`[charlatan effect] no curse cards in supply`);
          break;
        }

        await effectArgs.actionService.run('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'city': {
    registerEffects: () => async (effectArgs) => {
      console.debug(`[city effect] drawing 1 card and gaining 1 action`);
      await effectArgs.actionService.run('drawCard', { playerId: effectArgs.playerId });
      await effectArgs.actionService.run('gainAction', { count: 2 });

      const emptySupplyCount = getStartingSupplyCount(effectArgs.match) - effectArgs.findCardService.getRemainingSupplyCount();

      if (emptySupplyCount > 0) {
        console.debug(`[city effect] empty supply count is greater than 0; drawing 1 card`);
        await effectArgs.actionService.run('drawCard', { playerId: effectArgs.playerId });
      }

      if (emptySupplyCount > 1) {
        console.debug(`[city effect] empty supply count is greater than 1; gaining 1 buy and 1 treasure`);
        await effectArgs.actionService.run('gainBuy', { count: 1 });
        await effectArgs.actionService.run('gainTreasure', { count: 1 });
      }
    },
  },
  'clerk': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `clerk:${eventArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: eventArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: false,
          condition: (conditionArgs) => conditionArgs.trigger.args.playerId === eventArgs.playerId,
          triggeredEffectFn: async (triggerEffectArgs) => {
            await triggerEffectArgs.actionService.run('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId,
              overrides: {
                actionCost: 0,
              },
            });
          },
        });
      },
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`clerk:${eventArgs.cardId}:startTurn`);
      },
    }),
    registerEffects: () => async (effectArgs) => {
      await effectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId,
      }).filter((playerId) => {
        return !isPlayerImmune(effectArgs.reactionContext, playerId) &&
          effectArgs.cardSourceController.getSource('playerHand', playerId).length >= 5;
      });

      for (const targetPlayerId of targetPlayerIds) {
        const selectedCardIds = await effectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Top-deck card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
        }) as CardId[];

        if (!selectedCardIds) {
          console.debug(`[clerk effect] target player ${targetPlayerId} selected no card`);
          continue;
        }

        await effectArgs.actionService.run('moveCard', {
          cardId: selectedCardIds[0],
          toPlayerId: targetPlayerId,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'collection': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`collection:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (effectArgs) => {
      console.debug(`[collection effect] gaining 2 treasure and 1 buy`);
      await effectArgs.actionService.run('gainTreasure', { count: 2 });
      await effectArgs.actionService.run('gainBuy', { count: 1 });

      effectArgs.reactionManager.registerReactionTemplate({
        id: `collection:${effectArgs.cardId}:cardGained`,
        playerId: effectArgs.playerId,
        listeningFor: 'cardGained',
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          const gainStats = conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId];
          if (!gainStats) return false;
          const currentTurnHistoryIndex = conditionArgs.match.stats.turns.length - 1;
          const gainedThisTurn = gainStats.turnHistoryIndex === currentTurnHistoryIndex;
          if (!gainedThisTurn) return false;
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!card.type.includes('ACTION')) return false;
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          console.debug(`[collection triggered effect] gaining 1 victory token`);
          await triggeredEffectArgs.actionService.run('gainVictoryToken', {
            playerId: effectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'crystal-ball': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.actionService.run('gainBuy', { count: 1 });

      const deck = effectArgs.cardSourceController.getSource('playerDeck', effectArgs.playerId);
      const discard = effectArgs.cardSourceController.getSource('playerDiscard', effectArgs.playerId);

      if (deck.length + discard.length === 0) {
        console.debug(`[crystal-ball effect] no cards to look at`);
        return;
      }

      if (deck.length === 0) {
        await effectArgs.actionService.run('shuffleDeck', { playerId: effectArgs.playerId });
      }

      const cardId = deck.slice(-1)[0];
      const card = effectArgs.cardLibrary.getCard(cardId);

      const actions = [
        { label: 'Trash', action: 1 },
        { label: 'Discard', action: 2 },
      ];

      const isAction = card.type.includes('ACTION');
      const isTreasure = card.type.includes('TREASURE');

      if (isAction || isTreasure) {
        actions.push({ label: 'Play', action: 3 });
      }

      const result = await effectArgs.actionService.run('userPrompt', {
        prompt: `You drew ${card.cardName}`,
        playerId: effectArgs.playerId,
        actionButtons: actions,
      }) as { action: number; cardIds: number[] };

      switch (result.action) {
        case 1:
          await effectArgs.actionService.run('trashCard', { playerId: effectArgs.playerId, cardId });
          break;
        case 2:
          await effectArgs.actionService.run('discardCard', { cardId, playerId: effectArgs.playerId });
          break;
        case 3:
          await effectArgs.actionService.run('playCard', {
            playerId: effectArgs.playerId,
            cardId,
            overrides: { actionCost: 0 },
          });
          break;
      }
    },
  },
  'expand': {
    registerEffects: () => async (effectArgs) => {
      console.debug('[expand effect] prompting to select card to trash');
      const selectedToTrashId = await effectArgs.actionService.run('selectSingleCard', {
        playerId: effectArgs.playerId,
        prompt: `Trash card`,
        restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
        count: 1,
      }) as CardId | null;

      if (!selectedToTrashId) {
        console.debug(`[expand effect] no card selected`);
        return;
      }
      let card = effectArgs.cardLibrary.getCard(selectedToTrashId);
      console.debug(`[expand effect] selected ${card} to trash`);

      const { cost: effectCost } = effectArgs.cardPriceController.applyRules(card, {
        playerId: effectArgs.playerId,
      });

      const selectedToGainId = await effectArgs.actionService.run('selectSingleCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'upTo',
            playerId: effectArgs.playerId,
            amount: { treasure: effectCost.treasure + 3, potion: effectCost.potion },
          },
        ],
        count: 1,
      }) as CardId | null;

      if (!selectedToGainId) {
        console.debug(`[expand effect] no card selected`);
        return;
      }

      card = effectArgs.cardLibrary.getCard(selectedToGainId);

      console.debug(`[expand effect] selected ${card} to gain`);

      await effectArgs.actionService.run('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedToGainId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'forge': {
    registerEffects: () => async (effectArgs) => {
      const selectedCardIdsToTrash = await effectArgs.actionService.run('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Trash cards`,
        restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
        count: {
          kind: 'upTo',
          count: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId).length,
        },
        optional: true,
      }) as CardId[];

      let cost = { treasure: 0, potion: 0 };
      if (!selectedCardIdsToTrash.length) {
        cost = { treasure: 0, potion: 0 };
      } else {
        for (const cardId of selectedCardIdsToTrash) {
          const card = effectArgs.cardLibrary.getCard(cardId);
          const { cost: cardCost } = effectArgs.cardPriceController.applyRules(card, {
            playerId: effectArgs.playerId,
          });
          cost = {
            treasure: cost.treasure + cardCost.treasure,
            potion: cost.potion + (cardCost.potion ?? 0),
          };

          await effectArgs.actionService.run('trashCard', { playerId: effectArgs.playerId, cardId });
        }
      }

      const selectedCardIds = await effectArgs.actionService.run('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'exact',
            amount: { treasure: cost.treasure, potion: 0 },
            playerId: effectArgs.playerId,
          },
        ],
        count: 1,
      }) as CardId[];

      if (selectedCardIds.length === 0) {
        console.debug(`[forge effect] no card selected`);
        return;
      }

      await effectArgs.actionService.run('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedCardIds[0],
        to: { location: 'playerDiscard' },
      });
    },
  },
  'grand-market': {
    registerActionConditions: () => ({
      canBuy: ({ match, cardLibrary, playerId }) =>
        !match.stats.playedCardsByTurn[match.stats.turns.length - 1]?.find((cardId) => {
          return cardLibrary.getCard(cardId).cardKey === 'copper' &&
            match.stats.playedCards[cardId].playerId === playerId;
        }),
    }),
    registerEffects: () => async (effectArgs) => {
      console.debug(`[grand market effect] drawing 1 card, gaining 1 action, gaining 1 buy, and gaining 2 treasure`);
      await effectArgs.actionService.run('drawCard', { playerId: effectArgs.playerId });
      await effectArgs.actionService.run('gainAction', { count: 1 });
      await effectArgs.actionService.run('gainBuy', { count: 1 });
      await effectArgs.actionService.run('gainTreasure', { count: 2 });
    },
  },
  'hoard': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`hoard:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (effectArgs) => {
      await effectArgs.actionService.run('gainTreasure', { count: 2 });

      effectArgs.reactionManager.registerReactionTemplate({
        id: `hoard:${effectArgs.cardId}:cardGained`,
        listeningFor: 'cardGained',
        compulsory: true,
        allowMultipleInstances: true,
        once: false,
        condition: (conditionArgs) => {
          if (
            conditionArgs.match.turnNumber !==
              conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId]?.turnNumber
          ) return false;

          if (!conditionArgs.trigger.args.bought) return false;

          if (conditionArgs.trigger.args.playerId !== effectArgs.playerId) return false;

          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const goldCardIds = effectArgs.findCardService.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'gold' },
          ]);

          if (!goldCardIds.length) {
            console.debug(`[hoard triggered effect] no gold in supply`);
            return;
          }

          await triggeredEffectArgs.actionService.run('gainCard', {
            playerId: effectArgs.playerId,
            cardId: goldCardIds.slice(-1)[0].id,
            to: { location: 'playerDiscard' },
          });
        },
        playerId: effectArgs.playerId,
      });
    },
  },
  'investment': {
    registerEffects: () => async (effectArgs) => {
      if (effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId).length === 0) {
        console.debug(`[investment effect] no cards in hand`);
      } else {
        const selectedCardId = await effectArgs.actionService.run('selectSingleCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
        }) as CardId | null;

        if (!selectedCardId) {
          console.warn(`[investment effect] no card selected to trash`);
        } else {
          await effectArgs.actionService.run('trashCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardId,
          });
        }
      }

      const result = await effectArgs.actionService.run('userPrompt', {
        prompt: 'Choose one',
        playerId: effectArgs.playerId,
        actionButtons: [
          { label: '+1 Treasure', action: 1 },
          { label: 'Trash and reveal', action: 2 },
        ],
      }) as { action: number; cardIds: number[] };

      if (result.action === 1) {
        await effectArgs.actionService.run('gainTreasure', { count: 1 });
      } else {
        const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
        let uniqueTreasureCount: CardKey[] = [];
        const l = hand.length - 1;
        for (let i = l; i >= 0; i--) {
          await effectArgs.actionService.run('revealCard', {
            cardId: hand[i],
            playerId: effectArgs.playerId,
          });
          const card = effectArgs.cardLibrary.getCard(hand[i]);
          uniqueTreasureCount.push(card.cardKey);
        }
        uniqueTreasureCount = Array.from(new Set(uniqueTreasureCount));
        await effectArgs.actionService.run('gainVictoryToken', {
          playerId: effectArgs.playerId,
          count: uniqueTreasureCount.length,
        });
      }
    },
  },
  'kings-court': {
    registerEffects: () => async (effectArgs) => {
      console.debug(`[kings court effect] prompting user to select card`);

      const selectedCardId = await effectArgs.actionService.run('selectSingleCard', {
        playerId: effectArgs.playerId,
        prompt: `Choose action`,
        restrict: [
          { location: 'playerHand', playerId: effectArgs.playerId },
          { cardType: 'ACTION' },
        ],
        count: 1,
        optional: true,
      }) as CardId | null;

      if (!selectedCardId) {
        console.debug(`[kings court effect] no selected card`);
        return;
      }

      const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);

      console.debug(`[kings court effect] selected ${selectedCard}`);

      for (let i = 0; i < 3; i++) {
        await effectArgs.actionService.run('playCard', {
          playerId: effectArgs.playerId,
          cardId: selectedCardId,
          overrides: {
            actionCost: 0,
          },
        });
      }
    },
  },
  'magnate': {
    registerEffects: () => async (effectArgs) => {
      console.debug(`[magnate effect] revealing hand`);
      const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
      let treasureCardCount = 0;
      for (let i = hand.length - 1; i >= 0; i--) {
        const card = effectArgs.cardLibrary.getCard(hand[i]);
        treasureCardCount += card.type.includes('TREASURE') ? 1 : 0;
        await effectArgs.actionService.run('revealCard', {
          cardId: hand[i],
          playerId: effectArgs.playerId,
        });
      }

      console.debug(`[magnate effect] ${treasureCardCount} treasure revealed`);

      await effectArgs.actionService.run('drawCard', { playerId: effectArgs.playerId, count: treasureCardCount });
    },
  },
  'mint': {
    registerLifeCycleMethods: () => ({
      onGained: async ({ actionService, cardLibrary, match, ...args }, { playerId }) => {
        const cardsInPlay = args.findCardService.getCardsInPlay();
        const nonDurationTreasures = cardsInPlay
          .filter((card) =>
            card.type.includes('TREASURE') &&
            !card.type.includes('DURATION') &&
            match.stats.playedCards[card.id].playerId === playerId
          );

        if (nonDurationTreasures.length === 0) {
          console.debug(`[mint onGained] no non-duration treasure cards in play`);
          return;
        }

        console.debug(`[mint onGained] trashing ${nonDurationTreasures.length} non-duration treasure cards`);
        for (let i = nonDurationTreasures.length - 1; i >= 0; i--) {
          await actionService.run('trashCard', {
            playerId,
            cardId: nonDurationTreasures[i].id,
          });
        }
      },
    }),
    registerEffects: () => async (effectArgs) => {
      const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
      const handCards = hand.map(effectArgs.cardLibrary.getCard);
      const treasuresInHand = handCards.filter((card) => card.type.includes('TREASURE'));

      if (treasuresInHand.length === 0) {
        console.debug(`[mint effect] no treasures in hand`);
        return;
      }

      const uniqueTreasureCount = new Set(treasuresInHand.map((card) => card.cardKey)).size;

      let selectedCard: Card | undefined = undefined;

      if (uniqueTreasureCount === 1) {
        selectedCard = treasuresInHand[0];
      } else {
        const selectedCardId = await effectArgs.actionService.run('selectSingleCard', {
          playerId: effectArgs.playerId,
          prompt: `Reveal card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
        }) as CardId | null;

        if (!selectedCardId) {
          console.warn(`[mint effect] no card selected to reveal`);
          return;
        }

        selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
      }

      console.debug(`[mint effect] card to reveal ${selectedCard}`);

      await effectArgs.actionService.run('revealCard', {
        cardId: selectedCard.id,
        playerId: effectArgs.playerId,
      });

      const cardsInSupply = effectArgs.findCardService.findCards([
        { location: selectedCard.isBasic ? 'basicSupply' : 'kingdomSupply' },
        { cardKeys: selectedCard.cardKey },
      ]);

      if (cardsInSupply.length === 0) {
        console.debug(`[mint effect] no copies of ${selectedCard} in supply`);
        return;
      }

      await effectArgs.actionService.run('gainCard', {
        playerId: effectArgs.playerId,
        cardId: cardsInSupply.slice(-1)[0].id,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'monument': {
    registerEffects: () => async ({ playerId, actionService }) => {
      console.debug(`[monument effect] gaining 2 treasure, and 1 victory token`);
      await actionService.run('gainTreasure', { count: 2 });
      await actionService.run('gainVictoryToken', { playerId, count: 1 });
    },
  },
  'peddler': {
    registerEffects: () => async ({ actionService, playerId }) => {
      console.debug(`[peddler effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
      await actionService.run('drawCard', { playerId });
      await actionService.run('gainAction', { count: 1 });
      await actionService.run('gainTreasure', { count: 1 });
    },
  },
  'platinum': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.actionService.run('gainTreasure', { count: 5 });
    },
  },
  'quarry': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[quarry effect] gaining 1 treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const actionCards = cardEffectArgs.findCardService.findCards({ cardType: 'ACTION' });

      const unsubs: (() => void)[] = [];
      for (const actionCard of actionCards) {
        const rule: CardPriceRule = () => ({ restricted: false, cost: { treasure: -2 } });
        const unsub = cardEffectArgs.cardPriceController.registerRule(actionCard, rule);
        unsubs.push(unsub);
      }

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `peddler:${cardEffectArgs.cardId}:endTurn`,
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        listeningFor: 'endTurn',
        condition: () => true,
        triggeredEffectFn: async () => {
          unsubs.forEach((e) => e());
        },
      });
    },
  },
  'rabble': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[rabble effect] drawing 3 cards`);

      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter((playerId) => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        const match = cardEffectArgs.match;
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);

        if (deck.length < 3) {
          console.debug(`[rabble effect] ${targetPlayerId} has less than 3 cards in deck, shuffling`);
          await cardEffectArgs.actionService.run('shuffleDeck', { playerId: targetPlayerId });
        }

        if (deck.length === 0) {
          console.debug(`[rabble effect] ${targetPlayerId} has no cards in deck`);
          continue;
        }

        const numToReveal = Math.min(3, deck.length);

        const cardsToRearrange: Card[] = [];

        for (let i = 0; i < numToReveal; i++) {
          const cardId = deck.slice(-1)[0];
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          await cardEffectArgs.actionService.run('revealCard', {
            cardId,
            playerId: targetPlayerId,
            moveToSetAside: true,
          });

          if (card.type.includes('ACTION') || card.type.includes('TREASURE')) {
            console.debug(`[rabble effect] action or treasure revealed, discarding`);
            await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: targetPlayerId });
          } else {
            cardsToRearrange.push(card);
          }
        }

        if (cardsToRearrange.length === 0) {
          console.debug(`[rabble effect] no cards to rearrange`);
          return;
        }

        if (cardsToRearrange.length === 1) {
          console.debug(`[rabble effect] only 1 card to rearrange, moving to deck`);
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: cardsToRearrange[0].id,
            toPlayerId: targetPlayerId,
            to: { location: 'playerDeck' },
          });
        } else {
          const result = await cardEffectArgs.actionService.run('userPrompt', {
            prompt: 'Rearrange',
            playerId: targetPlayerId,
            actionButtons: [
              { label: 'DONE', action: 1 },
            ],
            content: {
              type: 'rearrange',
              cardIds: cardsToRearrange.map((card) => card.id),
            },
          }) as { action: number; result: number[] };

          for (const cardId of result.result) {
            await cardEffectArgs.actionService.run('moveCard', {
              cardId,
              toPlayerId: targetPlayerId,
              to: { location: 'playerDeck' },
            });
          }
        }
      }
    },
  },
  'tiara': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[tiara effect] gaining 1 buy`);
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `tiara:${cardEffectArgs.cardId}:cardGained`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'cardGained',
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggerEffectArgs) => {
          const card = triggerEffectArgs.cardLibrary.getCard(triggerEffectArgs.trigger.args.cardId);

          console.debug(`[tiara triggered effect] putting ${card} on deck`);

          await triggerEffectArgs.actionService.run('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `tiara:${cardEffectArgs.cardId}:endTurn`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'endTurn',
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: () => true,
        triggeredEffectFn: async (triggerEffectArgs) => {
          cardEffectArgs.reactionManager.unregisterTrigger(`tiara:${cardEffectArgs.cardId}:cardGained`);
          cardEffectArgs.reactionManager.unregisterTrigger(`tiara:${cardEffectArgs.cardId}:endTurn`);
        },
      });

      const handIds = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const handCards = handIds.map(cardEffectArgs.cardLibrary.getCard);
      const treasureCards = handCards.filter((card) => card.type.includes('TREASURE'));
      if (treasureCards.length === 0) {
        console.debug(`[tiara effect] no treasure cards in hand`);
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play treasure`,
        restrict: [
          { location: 'playerHand', playerId: cardEffectArgs.playerId },
          { cardType: 'TREASURE' },
        ],
        count: 1,
        optional: true,
      }) as CardId | null;

      if (!selectedCardId) {
        console.debug(`[tiara effect] no treasure card selected`);
        return;
      }
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

      console.debug(`[tiara effect] playing ${selectedCard} twice`);

      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.actionService.run('playCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
          overrides: {
            actionCost: 0,
          },
        });
      }
    },
  },
  'vault': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[vault effect] drawing 2 cards`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: {
          kind: 'upTo',
          count: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length,
        },
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[vault effect] no cards selected`);
        return;
      }

      console.debug(`[vault effect] discarding ${selectedCardIds.length} cards`);

      for (const cardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }

      console.debug(`[vault effect] gaining ${selectedCardIds.length} treasure`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: selectedCardIds.length });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      });

      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        if (!hand.length) {
          console.debug(`[vault effect] ${targetPlayerId} has no cards in hand`);
          continue;
        }

        const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard${hand.length > 1 ? ' to draw' : ''}?`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: Math.min(2, hand.length),
          optional: true,
        }) as CardId[];

        console.debug(`[vault effect] discarding ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.actionService.run('discardCard', {
            cardId: selectedCardId,
            playerId: targetPlayerId,
          });
        }

        if (selectedCardIds.length !== 2) {
          console.debug(`[vault effect] ${targetPlayerId} did not discard 2 cards, only ${selectedCardIds.length}`);
          return;
        }

        await cardEffectArgs.actionService.run('drawCard', { playerId: targetPlayerId });
      }
    },
  },
  'war-chest': {
    registerEffects: () => {
      const cardsNamedByTurn: Record<number, CardKey[]> = {};

      return async (cardEffectArgs) => {
        const leftPlayer = getPlayerStartingFrom({
          startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
          match: cardEffectArgs.match,
          distance: 1,
        });

        console.debug(`[war-chest effect] prompting ${leftPlayer} to name a card`);

        const namedCardResult = await cardEffectArgs.actionService.run('userPrompt', {
          prompt: 'Name a card',
          playerId: leftPlayer.id,
          content: {
            type: 'name-card',
          },
        }) as { action: number; result: CardKey };

        const cardKey = namedCardResult.result;
        const turnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
        const turnStatsIndex = turnHistoryIndex;

        cardsNamedByTurn[turnStatsIndex] ??= [];
        cardsNamedByTurn[turnStatsIndex].push(cardKey);

        const cardIds = cardEffectArgs.findCardService.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', amount: { treasure: 5 }, playerId: cardEffectArgs.playerId },
        ])
          .filter((card) => !cardsNamedByTurn[turnStatsIndex].includes(card.cardKey))
          .map((card) => card.id);

        if (!cardIds.length) {
          console.debug(`[war-chest effect] no cards found`);
          return;
        }

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain a card`,
          restrict: cardIds,
          count: 1,
        }) as CardId | null;

        if (!selectedCardId) {
          console.warn(`[war-chest effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);

        console.debug(`[war-chest effect] gaining ${selectedCard}`);

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
          to: { location: 'playerDiscard' },
        });
      };
    },
  },
  'watchtower': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`watchtower:${eventArgs.cardId}:cardGained`);
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `watchtower:${eventArgs.cardId}:cardGained`,
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: false,
          listeningFor: 'cardGained',
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggerEffectArgs) => {
            const card = triggerEffectArgs.cardLibrary.getCard(triggerEffectArgs.trigger.args.cardId);
            await triggerEffectArgs.actionService.run('revealCard', {
              cardId: eventArgs.cardId,
              playerId: eventArgs.playerId,
            });

            const result = await triggerEffectArgs.actionService.run('userPrompt', {
              prompt: `Trash or top deck ${card.cardName}?`,
              playerId: eventArgs.playerId,
              actionButtons: [
                { label: 'TRASH', action: 1 },
                { label: 'TOP-DECK', action: 2 },
              ],
            }) as { action: number; result: number[] };

            if (result.action === 1) {
              console.debug(`[watchtower triggered effect] player chose to trash ${card}`);
              await triggerEffectArgs.actionService.run('trashCard', {
                playerId: eventArgs.playerId,
                cardId: card.id,
              });
            } else {
              console.debug(`[watchtower triggered effect] player chose to top-deck ${card}`);
              await triggerEffectArgs.actionService.run('moveCard', {
                cardId: card.id,
                toPlayerId: eventArgs.playerId,
                to: { location: 'playerDeck' },
              });
            }
          },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const numToDraw = 6 - hand.length;

      if (numToDraw < 1) {
        console.debug(`[watchtower effect] already has 6 cards in hand`);
        return;
      }

      console.debug(`[watchtower effect] drawing ${numToDraw} cards`);

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: hand.length - 6,
      });
    },
  },
  'workers-village': {
    registerEffects: () => async ({ actionService, playerId }) => {
      console.debug(`[workers-village effect] drawing 1 card, gaining 2 actions, and gaining 1 buy`);
      await actionService.run('drawCard', { playerId });
      await actionService.run('gainAction', { count: 2 });
      await actionService.run('gainBuy', { count: 1 });
    },
  },
};

export default expansion;
