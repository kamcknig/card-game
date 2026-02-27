import { CardEffectFunctionContext, CardExpansionModule, ReactionTrigger } from '@server-types/index.ts';
import { CardId, CardKey } from 'shared/types/index.ts';
import { compareCardCosts } from '@shared/compare-card-cost.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { isPlayerImmune, markPlayerImmune } from '../../utils/reaction-immunity.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getPlayerSourceSafe } from '../../utils/get-player-source-safe.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';

// Shared helper for cards that grant coin and buys in one resolution.
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

// Resolves "trash from hand, then gain up to +N" behavior used by remodel-style cards.
const trashAndGainUpToMore = async (cardEffectArgs: CardEffectFunctionContext, playerId: number, maxMore: number) => {
  const loggerService = cardEffectArgs.loggerService;
  const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId);
  loggerService.debug(
    `[plunder helper] starting trash-and-gain flow for player ${playerId} with hand=${hand.length} and maxMore=${maxMore}`,
  );
  if (!hand.length) {
    loggerService.debug('[plunder helper] no card in hand to trash for remodel effect');
    return;
  }

  const selectedTrashCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
    playerId,
    prompt: 'Trash a card from your hand',
    restrict: hand,
    count: 1,
  });
  if (!selectedTrashCardId) {
    loggerService.debug('[plunder helper] no card selected to trash');
    return;
  }

  const trashedCard = cardEffectArgs.cardLibrary.getCard(selectedTrashCardId);
  const trashedCost = cardEffectArgs.cardPriceController.applyRules(trashedCard, { playerId }).cost;
  loggerService.info(`[plunder helper] trashed ${trashedCard.cardName}; computing gain options up to +${maxMore} cost`);

  await cardEffectArgs.actionService.run('trashCard', {
    playerId,
    cardId: selectedTrashCardId,
  });

  const gainableCards = cardEffectArgs.findCardService
    .findCards({ all: [{ location: ['basicSupply', 'kingdomSupply'] }] })
    .filter(card => {
      const gainedCost = cardEffectArgs.cardPriceController.applyRules(card, { playerId }).cost;
      return (
        compareCardCosts(gainedCost, {
          treasure: (trashedCost.treasure ?? 0) + maxMore,
          debt: trashedCost.debt,
          potion: trashedCost.potion,
        }) <= 0
      );
    });

  if (!gainableCards.length) {
    loggerService.debug('[plunder helper] no gainable cards after trash');
    return;
  }

  const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
    playerId,
    prompt: `Gain a card costing up to $${(trashedCost.treasure ?? 0) + maxMore}`,
    restrict: gainableCards.map(card => card.id),
    count: 1,
  });
  if (!selectedGainCardId) {
    loggerService.debug('[plunder helper] no card selected to gain');
    return;
  }

  const gainedCard = cardEffectArgs.cardLibrary.getCard(selectedGainCardId);

  await cardEffectArgs.actionService.run('gainCard', {
    playerId,
    cardId: selectedGainCardId,
    to: { location: 'playerDiscard' },
  });
  loggerService.info(`[plunder helper] gained ${gainedCard.cardName} to discard`);
};

const registerThisTurnTopdeckOnGain = (cardEffectArgs: CardEffectFunctionContext) => {
  const loggerService = cardEffectArgs.loggerService;
  const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
  const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
  const triggerId = cardEffectArgs.reactionManager.registerReactionTemplate(sourceCard, 'cardGained', {
    playerId: cardEffectArgs.playerId,
    once: false,
    allowMultipleInstances: true,
    compulsory: false,
    condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
    triggeredEffectFn: async triggeredArgs => {
      const gainedCardId = triggeredArgs.trigger.args.cardId as CardId;
      const gainedCard = triggeredArgs.cardLibrary.getCard(gainedCardId);
      const decision = (await triggeredArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: `Put ${gainedCard.cardName} onto your deck?`,
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'YES', action: 2 },
        ],
      })) as { action: number };

      if (decision.action !== 2) {
        loggerService.debug('[insignia effect] player declined topdecking gained card');
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
      loggerService.info(`[insignia effect] moved gained card ${gainedCard.cardName} to deck`);
    },
  });
  loggerService.debug(
    `[insignia effect] registered topdeck-on-gain trigger ${triggerId} for turnHistoryIndex=${turnHistoryIndex}`,
  );

  cardEffectArgs.reactionManager.registerSystemTemplate(
    sourceCard,
    'endTurn',
    {
      playerId: cardEffectArgs.playerId,
      once: true,
      allowMultipleInstances: true,
      compulsory: true,
      condition: ({ trigger, match }) =>
        trigger.args.playerId === cardEffectArgs.playerId && getCurrentTurnHistoryIndex({ match }) === turnHistoryIndex,
      triggeredEffectFn: async triggeredArgs => {
        triggeredArgs.reactionManager.unregisterTrigger(triggerId);
        loggerService.debug(`[insignia effect] unregistered topdeck-on-gain trigger ${triggerId} at endTurn`);
      },
    },
    {
      idSuffix: `insignia:${cardEffectArgs.cardId}:turn:${turnHistoryIndex}`,
    },
  );
};

const cardEffects: CardExpansionModule = {
  abundance: {
    registerEffects: () => async cardEffectArgs => {
      const abundanceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(abundanceCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'cardGained',
        condition: ({ trigger }) => {
          if (trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const gainedCard = cardEffectArgs.cardLibrary.getCard(trigger.args.cardId);
          return gainedCard.type.includes('ACTION');
        },
        triggeredEffectFn: async triggeredArgs => {
          await gainTreasureAndBuy({ actionService: triggeredArgs.actionService, treasure: 3, buy: 1 });
        },
      });
    },
  },
  'buried-treasure': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        await cardEffectArgs.actionService.run('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
          overrides: { actionCost: 0 },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const buriedTreasure = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(buriedTreasure, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await gainTreasureAndBuy({ actionService: triggeredArgs.actionService, treasure: 3, buy: 1 });
        },
      });
    },
  },
  'cabin-boy': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 1 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const cabinBoyCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(cabinBoyCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          const decision = (await triggeredArgs.actionService.run('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Choose one',
            actionButtons: [
              { label: '+$2', action: 1 },
              { label: 'TRASH TO GAIN DURATION', action: 2 },
            ],
          })) as { action: number };

          if (decision.action === 1) {
            await triggeredArgs.actionService.run('gainTreasure', { count: 2 });
            return;
          }

          await triggeredArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cabinBoyCard.id,
          });

          const durationCards = triggeredArgs.findCardService
            .findCards({ all: [{ location: ['basicSupply', 'kingdomSupply'] }] })
            .filter(card => card.type.includes('DURATION'));

          if (!durationCards.length) {
            return;
          }

          const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Gain a Duration card',
            restrict: durationCards.map(card => card.id),
            count: 1,
          });
          if (!selectedCardId) {
            return;
          }

          await triggeredArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            to: { location: 'playerDiscard' },
          });
        },
      });
    },
  },
  cage: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      const cageCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId);

      const selectedCardIds = hand.length
        ? await cardEffectArgs.actionService.run('selectCard', {
            playerId,
            prompt: 'Set aside up to 4 cards from your hand',
            restrict: hand,
            count: { kind: 'upTo', count: Math.min(4, hand.length) },
            optional: true,
          })
        : [];

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: selectedCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          facing: 'back',
          setAsideSource: {
            ownerPlayerId: playerId,
            sourceKind: 'card',
            sourceCardId: cageCard.id,
            sourceCardKey: cageCard.cardKey,
          },
        });
      }

      cardEffectArgs.registerDurationEffect(cageCard, {
        playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'cardGained',
        condition: ({ trigger, cardLibrary }) =>
          trigger.args.playerId === playerId && cardLibrary.getCard(trigger.args.cardId).type.includes('VICTORY'),
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('trashCard', {
            playerId,
            cardId: cageCard.id,
          });

          triggeredArgs.reactionManager.registerSystemTemplate(cageCard, 'endTurn', {
            playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            condition: ({ trigger }) => trigger.args.playerId === playerId,
            triggeredEffectFn: async endTurnArgs => {
              const setAside = getPlayerSourceSafe(endTurnArgs, 'set-aside', playerId);
              const cardsToReturn = setAside.filter(cardId => {
                const source = endTurnArgs.match.setAsideSourceById?.[cardId];
                return source?.ownerPlayerId === playerId && source.sourceCardId === cageCard.id;
              });

              for (const cardId of cardsToReturn) {
                await endTurnArgs.actionService.run('moveCard', {
                  cardId,
                  toPlayerId: playerId,
                  to: { location: 'playerHand' },
                });
              }
            },
          });
        },
      });
    },
  },
  crew: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });

      const crewCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(crewCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: crewCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });
    },
  },
  crucible: {
    registerEffects: () => async cardEffectArgs => {
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      });
      if (!selectedCardId) {
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const selectedCost = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      await cardEffectArgs.actionService.run('gainTreasure', { count: selectedCost.treasure ?? 0 });
    },
  },
  cutthroat: {
    registerEffects: () => async cardEffectArgs => {
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter(playerId => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        await discardDownTo(cardEffectArgs, {
          playerId: targetPlayerId,
          targetHandSize: 3,
          prompt: 'Discard down to 3 cards in hand',
          logTag: 'cutthroat effect',
        });
      }

      const cutthroatCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(cutthroatCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'cardGained',
        condition: ({ trigger, cardLibrary, cardPriceController }) => {
          const gainedCard = cardLibrary.getCard(trigger.args.cardId);
          if (!gainedCard.type.includes('TREASURE')) {
            return false;
          }
          const gainedCost = cardPriceController.applyRules(gainedCard, { playerId: trigger.args.playerId }).cost;
          return (gainedCost.treasure ?? 0) >= 5;
        },
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('gainLoot', {
            playerId: cardEffectArgs.playerId,
          });
        },
      });
    },
  },
  enlarge: {
    registerEffects: () => async cardEffectArgs => {
      await trashAndGainUpToMore(cardEffectArgs, cardEffectArgs.playerId, 2);

      const enlargeCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(enlargeCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await trashAndGainUpToMore(triggeredArgs as unknown as CardEffectFunctionContext, cardEffectArgs.playerId, 2);
        },
      });
    },
  },
  figurine: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });

      const actionCardsInHand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId)
        .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('ACTION'));

      if (!actionCardsInHand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may discard an Action for +$1 and +1 Buy',
        restrict: actionCardsInHand.map(card => card.id),
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });
      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('discardCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 1, buy: 1 });
    },
  },
  'first-mate': {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      const drawUpToSix = async () => {
        while (getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId).length < 6) {
          const drawn = await cardEffectArgs.actionService.run('drawCard', { playerId, count: 1 });
          if (!drawn) {
            return;
          }
        }
      };

      const actionCardsInHand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId)
        .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('ACTION'));
      // Also treat Shadow Actions in deck as legal candidates for this Action-play opportunity.
      const shadowActionsInDeck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', playerId)
        .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('ACTION') && card.type.includes('SHADOW'));

      if (!actionCardsInHand.length && !shadowActionsInDeck.length) {
        await drawUpToSix();
        return;
      }

      const firstPick = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Choose the first Action to play',
        actionButtons: [
          { label: 'DONE', action: 1 },
          { label: 'PLAY', action: 2 },
        ],
        content: {
          type: 'select',
          cardIds: actionCardsInHand.map(card => card.id),
          // Preserve the exact server-side play restriction used for Shadow injection from deck.
          cardFilter: {
            all: [{ location: 'playerHand', playerId }, { cardType: ['ACTION'] }],
          },
          selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
          selectCount: 1,
        },
      })) as { action?: number; result?: CardId[] } | null;

      const firstSelectedCardId = firstPick?.result?.[0];
      if (firstPick?.action !== 2 || !firstSelectedCardId) {
        await drawUpToSix();
        return;
      }

      const selectedCardKey: CardKey = cardEffectArgs.cardLibrary.getCard(firstSelectedCardId).cardKey;
      await cardEffectArgs.actionService.run('playCard', {
        playerId,
        cardId: firstSelectedCardId,
        overrides: { actionCost: 0 },
      });

      while (selectedCardKey) {
        const matchingInHand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId).filter(
          cardId => cardEffectArgs.cardLibrary.getCard(cardId).cardKey === selectedCardKey,
        );
        if (!matchingInHand.length) {
          break;
        }

        const nextPick = (await cardEffectArgs.actionService.run('userPrompt', {
          playerId,
          prompt: `You may play another ${selectedCardKey}`,
          actionButtons: [
            { label: 'DONE', action: 1 },
            { label: 'PLAY', action: 2 },
          ],
        })) as { action?: number } | null;

        if (nextPick?.action !== 2) {
          break;
        }

        const selectedToPlay = matchingInHand[0];
        await cardEffectArgs.actionService.run('playCard', {
          playerId,
          cardId: selectedToPlay,
          overrides: { actionCost: 0 },
        });
      }

      await drawUpToSix();
    },
  },
  flagship: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const flagshipCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(flagshipCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'afterCardPlayed',
        condition: ({ trigger, cardLibrary }) => {
          if (trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const playedCard = cardLibrary.getCard(trigger.args.cardId);
          return playedCard.type.includes('ACTION') && !playedCard.type.includes('COMMAND');
        },
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: triggeredArgs.trigger.args.cardId,
            overrides: {
              actionCost: 0,
              moveCard: false,
            },
          });
        },
      });
    },
  },
  'fortune-hunter': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const playerId = cardEffectArgs.playerId;
      const discard = getPlayerSourceSafe(cardEffectArgs, 'playerDiscard', playerId);
      let deck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', playerId);
      const cardsToLookAtCount = Math.min(3, deck.length + discard.length);

      if (!cardsToLookAtCount) {
        return;
      }

      if (deck.length < cardsToLookAtCount) {
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId });
        deck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', playerId);
      }

      const cardsToLookAt = deck.slice(-cardsToLookAtCount);
      const treasureIds = cardsToLookAt.filter(cardId =>
        cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE'),
      );

      if (treasureIds.length) {
        const selectPrompt = (await cardEffectArgs.actionService.run('userPrompt', {
          playerId,
          prompt: 'You may play a Treasure from these cards',
          actionButtons: [
            { label: 'DONE', action: 1 },
            { label: 'PLAY', action: 2 },
          ],
          content: {
            type: 'select',
            cardIds: treasureIds,
            selectionIntent: { kind: 'play-card', cardTypes: ['TREASURE'] },
            selectCount: 1,
          },
        })) as { action?: number; result?: CardId[] } | null;

        const selectedTreasureId = selectPrompt?.result?.[0];
        if (selectPrompt?.action === 2 && selectedTreasureId) {
          await cardEffectArgs.actionService.run('playCard', {
            playerId,
            cardId: selectedTreasureId,
            overrides: { actionCost: 0 },
          });
        }
      }

      const remainingCards = cardsToLookAt.filter(cardId => {
        try {
          const source = cardEffectArgs.cardSourceController.findCardSource(cardId);
          return source.sourceKey === 'playerDeck' && source.playerId === playerId;
        } catch {
          return false;
        }
      });

      if (remainingCards.length > 1) {
        const promptResult = await cardEffectArgs.promptService.requestActionResult<CardId[]>({
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
      }
    },
  },
  frigate: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });

      const frigateCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const affectedTargetPlayerIds = new Set(
        findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId,
        }).filter(targetPlayerId => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId)),
      );

      if (affectedTargetPlayerIds.size < 1) {
        cardEffectArgs.loggerService.debug('[frigate effect] no affected targets; Frigate will discard this turn');
        return;
      }

      let attackWindowOpen = true;
      const onActionTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        frigateCard,
        'afterCardPlayed',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary }) => {
            if (!affectedTargetPlayerIds.has(trigger.args.playerId)) {
              return false;
            }
            const playedCard = cardLibrary.getCard(trigger.args.cardId);
            return playedCard.type.includes('ACTION');
          },
          triggeredEffectFn: async triggeredArgs => {
            await discardDownTo(triggeredArgs, {
              playerId: triggeredArgs.trigger.args.playerId,
              targetHandSize: 4,
              prompt: 'Discard down to 4 cards in hand (Frigate)',
              logTag: 'frigate effect',
            });
          },
        },
      );

      cardEffectArgs.registerDurationEffect(
        frigateCard,
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async triggeredArgs => {
            attackWindowOpen = false;
            triggeredArgs.reactionManager.unregisterTrigger(onActionTriggerId);
          },
        },
        {
          hasActiveEffects: () => attackWindowOpen,
        },
      );
    },
  },
  gondola: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const playerId = eventArgs.playerId;
        const actionsInHand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId)
          .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
          .filter(card => card.type.includes('ACTION'));
        // Gondola can still offer this prompt when only Shadow Actions are in deck.
        const shadowActionsInDeck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', playerId)
          .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
          .filter(card => card.type.includes('ACTION') && card.type.includes('SHADOW'));

        if (!actionsInHand.length && !shadowActionsInDeck.length) {
          return;
        }

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'You may play an Action card from your hand',
          restrict: {
            all: [{ location: 'playerHand', playerId }, { cardType: ['ACTION'] }],
          },
          selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
          count: { kind: 'upTo', count: 1 },
          optional: true,
        });

        if (!selectedCardId) {
          return;
        }

        await cardEffectArgs.actionService.run('playCard', {
          playerId,
          cardId: selectedCardId,
          overrides: { actionCost: 0 },
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const decision = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain +$2 now or at the start of your next turn?',
        actionButtons: [
          { label: 'NOW', action: 1 },
          { label: 'NEXT TURN', action: 2 },
        ],
      })) as { action: number };

      if (decision.action === 1) {
        await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
        return;
      }

      const gondolaCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(gondolaCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('gainTreasure', { count: 2 });
        },
      });
    },
  },
  grotto: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId,
        prompt: 'Set aside up to 4 cards from your hand',
        restrict: hand,
        count: { kind: 'upTo', count: Math.min(4, hand.length) },
        optional: true,
      });

      if (!selectedCardIds.length) {
        return;
      }

      const grottoCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: selectedCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          facing: 'back',
          setAsideSource: {
            ownerPlayerId: playerId,
            sourceKind: 'card',
            sourceCardId: grottoCard.id,
            sourceCardKey: grottoCard.cardKey,
          },
        });
      }

      cardEffectArgs.registerDurationEffect(grottoCard, {
        playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async triggeredArgs => {
          const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', playerId);
          const cardsToResolve = setAside.filter(cardId => {
            const source = triggeredArgs.match.setAsideSourceById?.[cardId];
            return source?.ownerPlayerId === playerId && source.sourceCardId === grottoCard.id;
          });

          for (const cardId of cardsToResolve) {
            await triggeredArgs.actionService.run('discardCard', { playerId, cardId });
          }

          if (cardsToResolve.length > 0) {
            await triggeredArgs.actionService.run('drawCard', {
              playerId,
              count: cardsToResolve.length,
            });
          }
        },
      });
    },
  },
  'harbor-village': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 1 });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const harborVillage = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const playedCountAtRegistration = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex]?.length ?? 0;
      let nextActionCardId: CardId | undefined;
      const trackedTreasureGainTriggers: ReactionTrigger<'treasureGain'>[] = [];

      const beforeId = cardEffectArgs.reactionManager.registerReactionTemplate(
        harborVillage,
        'beforePlayedCardEffect',
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary, match }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }
            if ((getCurrentTurnHistoryIndex({ match }) ?? -1) !== turnHistoryIndex) {
              return false;
            }
            const playedCount = match.stats.playedCardsByTurn[turnHistoryIndex]?.length ?? 0;
            if (playedCount <= playedCountAtRegistration) {
              return false;
            }
            const playedCard = cardLibrary.getCard(trigger.args.cardId);
            return playedCard.type.includes('ACTION');
          },
          triggeredEffectFn: async triggeredArgs => {
            nextActionCardId = triggeredArgs.trigger.args.cardId;
          },
        },
      );

      const treasureGainId = cardEffectArgs.reactionManager.registerReactionTemplate(harborVillage, 'treasureGain', {
        playerId: cardEffectArgs.playerId,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger, match }) =>
          trigger.args.playerId === cardEffectArgs.playerId &&
          (getCurrentTurnHistoryIndex({ match }) ?? -1) === turnHistoryIndex &&
          nextActionCardId !== undefined &&
          trigger.args.source === nextActionCardId,
        triggeredEffectFn: async triggeredArgs => {
          trackedTreasureGainTriggers.push(triggeredArgs.trigger);
        },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate(harborVillage, 'afterCardPlayed', {
        playerId: cardEffectArgs.playerId,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger, match }) =>
          trigger.args.playerId === cardEffectArgs.playerId &&
          (getCurrentTurnHistoryIndex({ match }) ?? -1) === turnHistoryIndex &&
          nextActionCardId === trigger.args.cardId,
        triggeredEffectFn: async triggeredArgs => {
          triggeredArgs.reactionManager.unregisterTrigger(beforeId);
          triggeredArgs.reactionManager.unregisterTrigger(treasureGainId);
          const gainedTreasureFromPlayedAction = trackedTreasureGainTriggers.reduce(
            (sum, trigger) => sum + Math.max(0, trigger.args.count),
            0,
          );
          if (gainedTreasureFromPlayedAction > 0) {
            await triggeredArgs.actionService.run('gainTreasure', { count: 1 }, { source: harborVillage.id });
          }
        },
      });
    },
  },
  'jewelled-egg': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (cardEffectArgs, eventArgs) => {
        await cardEffectArgs.actionService.run('gainLoot', {
          playerId: eventArgs.playerId,
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  'kings-cache': {
    registerEffects: () => async cardEffectArgs => {
      const treasuresInHand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId)
        .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('TREASURE'));

      if (!treasuresInHand.length) {
        return;
      }

      const selectedTreasureId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may play a Treasure from your hand 3 times',
        restrict: treasuresInHand.map(card => card.id),
        selectionIntent: { kind: 'play-card', cardTypes: ['TREASURE'] },
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });

      if (!selectedTreasureId) {
        return;
      }

      for (let i = 0; i < 3; i += 1) {
        await cardEffectArgs.actionService.run('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedTreasureId,
          overrides: {
            actionCost: 0,
            moveCard: i === 0,
          },
        });
      }
    },
  },
  'landing-party': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const landingPartyCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      let hasPendingTopdeckEffect = true;
      cardEffectArgs.registerDurationEffect(
        landingPartyCard,
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'afterCardPlayed',
          condition: ({ trigger, match, cardLibrary }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }
            const card = cardLibrary.getCard(trigger.args.cardId);
            if (!card.type.includes('TREASURE')) {
              return false;
            }
            const turnHistoryIndex = getCurrentTurnHistoryIndex({ match }) ?? -1;
            const playedIds = match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
            return playedIds.length === 1;
          },
          triggeredEffectFn: async triggeredArgs => {
            hasPendingTopdeckEffect = false;
            await triggeredArgs.actionService.run('moveCard', {
              cardId: landingPartyCard.id,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'playerDeck' },
            });
          },
        },
        {
          hasActiveEffects: () => hasPendingTopdeckEffect,
        },
      );
    },
  },
  longship: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const longshipCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(longshipCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
        },
      });
    },
  },
  mapmaker: {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (cardEffectArgs, eventArgs) => {
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `mapmaker:${eventArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ cardSourceController, cardLibrary, trigger }) => {
            const gained = cardLibrary.getCard(trigger.args.cardId);
            if (!gained.type.includes('VICTORY')) {
              return false;
            }
            try {
              const source = cardSourceController.findCardSource(eventArgs.cardId);
              return source.sourceKey === 'playerHand' && source.playerId === eventArgs.playerId;
            } catch {
              return false;
            }
          },
          triggeredEffectFn: async triggeredArgs => {
            const decision = (await triggeredArgs.actionService.run('userPrompt', {
              playerId: eventArgs.playerId,
              prompt: 'Play Mapmaker from your hand?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            })) as { action?: number } | null;

            if (decision?.action !== 2) {
              return;
            }

            await triggeredArgs.actionService.run('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId,
              overrides: { actionCost: 0 },
            });
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`mapmaker:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      let deck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', playerId);
      if (deck.length < 4) {
        await cardEffectArgs.actionService.run('shuffleDeck', { playerId });
        deck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', playerId);
      }

      const lookedAt = deck.slice(-Math.min(4, deck.length));
      if (!lookedAt.length) {
        return;
      }

      const selectedToHand = await cardEffectArgs.actionService.run('selectCard', {
        playerId,
        prompt: `Put ${Math.min(2, lookedAt.length)} of these cards into your hand`,
        restrict: lookedAt,
        count: { kind: 'exact', count: Math.min(2, lookedAt.length) },
      });

      for (const cardId of selectedToHand) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
        });
      }

      for (const cardId of lookedAt.filter(id => !selectedToHand.includes(id))) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId,
          cardId,
        });
      }
    },
  },
  maroon: {
    registerEffects: () => async cardEffectArgs => {
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      });
      if (!selectedCardId) {
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const typeCount = new Set(selectedCard.type).size;

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: typeCount * 2,
      });
    },
  },
  'mining-road': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const miningRoadCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;

      cardEffectArgs.reactionManager.registerReactionTemplate(miningRoadCard, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: ({ trigger, cardLibrary, match }) => {
          if (trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          if ((getCurrentTurnHistoryIndex({ match }) ?? -1) !== turnHistoryIndex) {
            return false;
          }
          const gainedCard = cardLibrary.getCard(trigger.args.cardId);
          return gainedCard.type.includes('TREASURE');
        },
        triggeredEffectFn: async triggeredArgs => {
          const gainedCardId = triggeredArgs.trigger.args.cardId;
          const decision = (await triggeredArgs.actionService.run('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Play the gained Treasure?',
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
          })) as { action: number };

          if (decision.action !== 2) {
            return;
          }

          await triggeredArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: gainedCardId,
            overrides: { actionCost: 0 },
          });
        },
      });
    },
  },
  pendant: {
    registerEffects: () => async cardEffectArgs => {
      const treasuresInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => card.owner === cardEffectArgs.playerId && card.type.includes('TREASURE'));
      const uniqueNames = new Set(treasuresInPlay.map(card => card.cardKey));
      await cardEffectArgs.actionService.run('gainTreasure', { count: uniqueNames.size });
    },
  },
  pickaxe: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      });
      if (!selectedCardId) {
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const selectedCost = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
      });

      if ((selectedCost.treasure ?? 0) < 3) {
        return;
      }

      await cardEffectArgs.actionService.run('gainLoot', {
        playerId: cardEffectArgs.playerId,
        to: { location: 'playerHand' },
      });
    },
  },
  pilgrim: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 4 });

      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put a card from your hand onto your deck',
        restrict: hand,
        count: 1,
      });
      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: selectedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDeck' },
      });
    },
  },
  quartermaster: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.info(`[quartermaster effect] registering recurring duration for player ${cardEffectArgs.playerId}`);
      const quartermaster = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(
        quartermaster,
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async triggeredArgs => {
            const playerId = cardEffectArgs.playerId;
            const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', playerId).filter(cardId => {
              const source = triggeredArgs.match.setAsideSourceById?.[cardId];
              return source?.ownerPlayerId === playerId && source.sourceCardId === quartermaster.id;
            });
            loggerService.debug(
              `[quartermaster duration] startTurn for player ${playerId}; setAside count=${setAside.length}`,
            );

            const choice = (await triggeredArgs.actionService.run('userPrompt', {
              playerId,
              prompt: 'Choose one',
              actionButtons: [
                { label: 'GAIN UP TO $4', action: 1 },
                { label: 'TAKE FROM QUARTERMASTER', action: 2 },
              ],
            })) as { action: number };
            loggerService.debug(`[quartermaster duration] player ${playerId} selected action=${choice.action}`);

            if (choice.action === 2 && setAside.length) {
              const selectedSetAsideId =
                setAside.length === 1
                  ? setAside[0]
                  : await triggeredArgs.promptService.selectSingleCardFromPrompt({
                      playerId,
                      prompt: 'Put a card from this Quartermaster into your hand',
                      content: {
                        type: 'select',
                        cardIds: setAside,
                        selectCount: 1,
                      },
                    });

              if (selectedSetAsideId) {
                const selectedSetAsideCard = triggeredArgs.cardLibrary.getCard(selectedSetAsideId);
                await triggeredArgs.actionService.run('moveCard', {
                  cardId: selectedSetAsideId,
                  toPlayerId: playerId,
                  to: { location: 'playerHand' },
                });
                loggerService.info(
                  `[quartermaster duration] moved set-aside card ${selectedSetAsideCard.cardName} to hand`,
                );
                return;
              }
              loggerService.debug('[quartermaster duration] no set-aside card selected to move to hand');
            }

            const gainableCardIds = triggeredArgs.findCardService
              .findCards({
                all: [
                  { location: ['basicSupply', 'kingdomSupply'] },
                  { kind: 'upTo', playerId, amount: { treasure: 4 } },
                ],
              })
              .map(card => card.id);

            if (!gainableCardIds.length) {
              loggerService.debug('[quartermaster duration] no gainable cards costing up to $4');
              return;
            }

            const selectedGainCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId,
              prompt: 'Gain a card costing up to $4 (set it aside on this)',
              restrict: gainableCardIds,
              count: 1,
            });
            if (!selectedGainCardId) {
              loggerService.debug('[quartermaster duration] no card selected to gain');
              return;
            }

            const selectedGainCard = triggeredArgs.cardLibrary.getCard(selectedGainCardId);

            await triggeredArgs.actionService.run('gainCard', {
              playerId,
              cardId: selectedGainCardId,
              to: { location: 'playerDiscard' },
            });

            const gainedStillInDiscard = getPlayerSourceSafe(triggeredArgs, 'playerDiscard', playerId).includes(
              selectedGainCardId,
            );
            if (!gainedStillInDiscard) {
              loggerService.debug(
                `[quartermaster duration] gained card ${selectedGainCard.cardName} moved before set-aside step`,
              );
              return;
            }

            await triggeredArgs.actionService.run('moveCard', {
              cardId: selectedGainCardId,
              toPlayerId: playerId,
              to: { location: 'set-aside' },
              setAsideSource: {
                ownerPlayerId: playerId,
                sourceKind: 'card',
                sourceCardId: quartermaster.id,
                sourceCardKey: quartermaster.cardKey,
              },
            });
            loggerService.info(`[quartermaster duration] set aside gained card ${selectedGainCard.cardName}`);
          },
        },
        {
          // Quartermaster persists as an always-active duration while in play.
          hasActiveEffects: () => true,
        },
      );
    },
  },
  rope: {
    registerEffects: () => async cardEffectArgs => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 1, buy: 1 });

      const ropeCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(ropeCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 1 });

          const hand = getPlayerSourceSafe(triggeredArgs, 'playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            return;
          }

          const selectedCardId = await triggeredArgs.actionService.run('selectSingleCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'You may trash a card from your hand',
            restrict: hand,
            count: { kind: 'upTo', count: 1 },
            optional: true,
          });
          if (!selectedCardId) {
            return;
          }

          await triggeredArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
          });
        },
      });
    },
  },
  'sack-of-loot': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainLoot', { playerId: cardEffectArgs.playerId });
    },
  },
  search: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.info(`[search effect] registering delayed Loot trigger for player ${cardEffectArgs.playerId}`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const searchCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      let hasPendingSupplyEmptyTrigger = true;

      const resolveOnSupplyPileEmptied = async (triggeredArgs: {
        trigger: { args: { emptiedSupplyPileKey?: CardKey } };
        actionService: CardEffectFunctionContext['actionService'];
      }) => {
        if (!triggeredArgs.trigger.args.emptiedSupplyPileKey) {
          return;
        }

        hasPendingSupplyEmptyTrigger = false;
        loggerService.info(
          `[search duration] supply pile emptied (${triggeredArgs.trigger.args.emptiedSupplyPileKey}); resolving Loot gain`,
        );
        await triggeredArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: searchCard.id,
        });
        await triggeredArgs.actionService.run('gainLoot', { playerId: cardEffectArgs.playerId });
        loggerService.debug('[search duration] trashed Search and granted Loot');
      };

      cardEffectArgs.registerDurationEffect(
        searchCard,
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'cardGained',
          condition: () => true,
          triggeredEffectFn: resolveOnSupplyPileEmptied,
        },
        {
          hasActiveEffects: () => hasPendingSupplyEmptyTrigger,
        },
      );

      cardEffectArgs.registerDurationEffect(
        searchCard,
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'cardTrashed',
          condition: () => true,
          triggeredEffectFn: resolveOnSupplyPileEmptied,
        },
        {
          // Share Search duration liveness with the paired cardGained trigger.
          hasActiveEffects: () => hasPendingSupplyEmptyTrigger,
        },
      );
    },
  },
  'secluded-shrine': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const secludedShrine = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(secludedShrine, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'cardGained',
        condition: ({ trigger, cardLibrary }) => {
          if (trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const gainedCard = cardLibrary.getCard(trigger.args.cardId);
          return gainedCard.type.includes('TREASURE');
        },
        triggeredEffectFn: async triggeredArgs => {
          const hand = getPlayerSourceSafe(triggeredArgs, 'playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            return;
          }

          const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Trash up to 2 cards from your hand',
            restrict: hand,
            count: { kind: 'upTo', count: Math.min(2, hand.length) },
            optional: true,
          });

          for (const cardId of selectedCardIds) {
            await triggeredArgs.actionService.run('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId,
            });
          }
        },
      });
    },
  },
  shaman: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.promptService.selectSingleCardFromPrompt({
        playerId: cardEffectArgs.playerId,
        prompt: 'You may trash a card from your hand',
        content: {
          type: 'select',
          cardIds: hand,
          selectCount: 1,
        },
        actionButtons: [
          { label: 'SKIP', action: 1 },
          { label: 'TRASH', action: 2 },
        ],
        validationAction: 2,
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
  'silver-mine': {
    registerEffects: () => async cardEffectArgs => {
      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const sourceCost = cardEffectArgs.cardPriceController.applyRules(sourceCard, {
        playerId: cardEffectArgs.playerId,
      }).cost;
      const gainableTreasures = cardEffectArgs.findCardService
        .findCards({ all: [{ location: ['basicSupply', 'kingdomSupply'] }] })
        .filter(card => {
          if (!card.type.includes('TREASURE')) {
            return false;
          }
          const cost = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId }).cost;
          return compareCardCosts(cost, sourceCost) === -1;
        });

      if (!gainableTreasures.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a Treasure costing less than this to your hand',
        restrict: gainableTreasures.map(card => card.id),
        count: 1,
      });
      if (!selectedCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerHand' },
      });
    },
  },
  siren: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const playerId = eventArgs.playerId;
        const handActions = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId)
          .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
          .filter(card => card.type.includes('ACTION'));

        let shouldTrashSiren = true;
        if (handActions.length) {
          const selectedActionId = await cardEffectArgs.actionService.run('selectSingleCard', {
            playerId,
            prompt: 'Trash an Action from your hand to keep Siren',
            restrict: handActions.map(card => card.id),
            count: { kind: 'upTo', count: 1 },
            optional: true,
          });

          if (selectedActionId) {
            await cardEffectArgs.actionService.run('trashCard', {
              playerId,
              cardId: selectedActionId,
            });
            shouldTrashSiren = false;
          }
        }

        if (!shouldTrashSiren) {
          return;
        }

        let sourceInfo: { sourceKey: string; playerId?: number } | null = null;
        try {
          sourceInfo = cardEffectArgs.cardSourceController.findCardSource(eventArgs.cardId);
        } catch {
          sourceInfo = null;
        }

        if (!sourceInfo || sourceInfo.sourceKey !== 'playerDiscard' || sourceInfo.playerId !== playerId) {
          return;
        }

        await cardEffectArgs.actionService.run('trashCard', {
          playerId,
          cardId: eventArgs.cardId,
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter(playerId => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'siren effect',
        });
      }

      const sirenCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(sirenCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          while (getPlayerSourceSafe(triggeredArgs, 'playerHand', cardEffectArgs.playerId).length < 8) {
            const drawn = await triggeredArgs.actionService.run('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 1,
            });
            if (!drawn) {
              break;
            }
          }
        },
      });
    },
  },
  stowaway: {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (cardEffectArgs, eventArgs) => {
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `stowaway:${eventArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: ({ cardSourceController, cardLibrary, trigger }) => {
            const gainedCard = cardLibrary.getCard(trigger.args.cardId);
            if (!gainedCard.type.includes('DURATION')) {
              return false;
            }
            try {
              const source = cardSourceController.findCardSource(eventArgs.cardId);
              return source.sourceKey === 'playerHand' && source.playerId === eventArgs.playerId;
            } catch {
              return false;
            }
          },
          triggeredEffectFn: async triggeredArgs => {
            const decision = (await triggeredArgs.actionService.run('userPrompt', {
              playerId: eventArgs.playerId,
              prompt: 'Play Stowaway from your hand?',
              actionButtons: [
                { label: 'NO', action: 1 },
                { label: 'YES', action: 2 },
              ],
            })) as { action?: number } | null;

            if (decision?.action !== 2) {
              return;
            }

            await triggeredArgs.actionService.run('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId,
              overrides: { actionCost: 0 },
            });
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`stowaway:${cardId}:cardGained`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      const stowaway = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(stowaway, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
        },
      });
    },
  },
  'swamp-shacks': {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
      const cardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => card.owner === cardEffectArgs.playerId);
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: Math.floor(cardsInPlay.length / 3),
      });
    },
  },
  taskmaster: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const taskmaster = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      let hasPendingStartTurnEffect = false;

      const armTaskmasterForTurn = (args: {
        match: typeof cardEffectArgs.match;
        reactionManager: typeof cardEffectArgs.reactionManager;
      }) => {
        const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: args.match }) ?? 0;
        let gainedCostFiveThisTurn = false;

        const gainedListenerId = args.reactionManager.registerReactionTemplate(taskmaster, 'cardGained', {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) =>
            trigger.args.playerId === cardEffectArgs.playerId &&
            (getCurrentTurnHistoryIndex({ match }) ?? -1) === turnHistoryIndex,
          triggeredEffectFn: async triggeredArgs => {
            const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            const gainedCost = triggeredArgs.cardPriceController.applyRules(gainedCard, {
              playerId: cardEffectArgs.playerId,
            }).cost;
            if ((gainedCost.treasure ?? 0) !== 5 || !!gainedCost.debt || !!gainedCost.potion) {
              return;
            }

            gainedCostFiveThisTurn = true;
            // Mark duration liveness immediately so cleanup retention sees it,
            // even though this engine resolves endTurn after cleanup starts.
            hasPendingStartTurnEffect = true;
          },
        });

        args.reactionManager.registerSystemTemplate(
          taskmaster,
          'endTurn',
          {
            playerId: cardEffectArgs.playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
            triggeredEffectFn: async triggeredArgs => {
              triggeredArgs.reactionManager.unregisterTrigger(gainedListenerId);
              if (gainedCostFiveThisTurn) {
                return;
              }

              hasPendingStartTurnEffect = false;
            },
          },
          {
            idSuffix: `taskmaster:${taskmaster.id}:${turnHistoryIndex}`,
          },
        );
      };

      armTaskmasterForTurn({ match: cardEffectArgs.match, reactionManager: cardEffectArgs.reactionManager });

      cardEffectArgs.registerDurationEffect(
        taskmaster,
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async triggeredArgs => {
            if (!hasPendingStartTurnEffect) {
              return;
            }

            hasPendingStartTurnEffect = false;
            await triggeredArgs.actionService.run('gainAction', { count: 1 });
            await triggeredArgs.actionService.run('gainTreasure', { count: 1 });
            armTaskmasterForTurn({ match: triggeredArgs.match, reactionManager: triggeredArgs.reactionManager });
          },
        },
        {
          hasActiveEffects: () => hasPendingStartTurnEffect,
        },
      );
    },
  },
  tools: {
    registerEffects: () => async cardEffectArgs => {
      const cardsInPlay = cardEffectArgs.findCardService.getCardsInPlay();
      if (!cardsInPlay.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a copy of a card in play',
        restrict: cardsInPlay.map(card => card.id),
        count: 1,
      });
      if (!selectedCardId) {
        return;
      }

      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const pileKey = getCardPileKey(selectedCard) as CardKey;
      await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey,
        to: { location: 'playerDiscard' },
        logTag: 'tools effect',
      });
    },
  },
  trickster: {
    registerEffects: () => async cardEffectArgs => {
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter(playerId => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
          playerId: targetPlayerId,
          pileKey: 'curse',
          from: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'trickster effect',
        });
      }

      const trickster = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const setAsideCardIds: CardId[] = [];

      cardEffectArgs.reactionManager.registerReactionTemplate(trickster, 'discardCard', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: ({ trigger, cardLibrary, match }) => {
          if ((getCurrentTurnHistoryIndex({ match }) ?? -1) !== turnHistoryIndex) {
            return false;
          }
          if (trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          if (trigger.args.previousLocation.location !== 'playArea') {
            return false;
          }
          const discardedCard = cardLibrary.getCard(trigger.args.cardId);
          return discardedCard.type.includes('TREASURE');
        },
        triggeredEffectFn: async triggeredArgs => {
          const decision = (await triggeredArgs.actionService.run('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Set this discarded Treasure aside?',
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
          })) as { action: number };

          if (decision.action !== 2) {
            return;
          }

          await triggeredArgs.actionService.run('moveCard', {
            cardId: triggeredArgs.trigger.args.cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'set-aside' },
            setAsideSource: {
              ownerPlayerId: cardEffectArgs.playerId,
              sourceKind: 'card',
              sourceCardId: trickster.id,
              sourceCardKey: trickster.cardKey,
            },
          });
          setAsideCardIds.push(triggeredArgs.trigger.args.cardId);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(
        trickster,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async triggeredArgs => {
            for (const setAsideCardId of setAsideCardIds) {
              const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', cardEffectArgs.playerId);
              if (!setAside.includes(setAsideCardId)) {
                continue;
              }
              await triggeredArgs.actionService.run('moveCard', {
                cardId: setAsideCardId,
                toPlayerId: cardEffectArgs.playerId,
                to: { location: 'playerHand' },
              });
            }
          },
        },
        {
          idSuffix: `trickster:${trickster.id}:${turnHistoryIndex}`,
        },
      );
    },
  },
  'wealthy-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const inPlayTreasures = cardEffectArgs.findCardService
          .getCardsInPlay()
          .filter(card => card.owner === eventArgs.playerId && card.type.includes('TREASURE'));
        const uniqueTreasureNames = new Set(inPlayTreasures.map(card => card.cardKey));
        if (uniqueTreasureNames.size < 3) {
          return;
        }
        await cardEffectArgs.actionService.run('gainLoot', {
          playerId: eventArgs.playerId,
        });
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId, count: 1 });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
    },
  },
  amphora: {
    registerEffects: () => async cardEffectArgs => {
      const decision = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain +$3 and +1 Buy now or at the start of your next turn?',
        actionButtons: [
          { label: 'NOW', action: 1 },
          { label: 'NEXT TURN', action: 2 },
        ],
      })) as { action: number };

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
        triggeredEffectFn: async triggeredArgs => {
          await gainTreasureAndBuy({ actionService: triggeredArgs.actionService, treasure: 3, buy: 1 });
        },
      });
    },
  },
  doubloons: {
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const goldCards = cardEffectArgs.findCardService.findCards({
          all: [{ location: 'basicSupply' }, { cardKeys: 'gold' }],
        });
        const goldCard = goldCards.slice(-1)[0];
        if (!goldCard) {
          return;
        }
        await cardEffectArgs.actionService.run(
          'gainCard',
          {
            playerId: eventArgs.playerId,
            cardId: goldCard.id,
            to: { location: 'playerDiscard' },
          },
          {
            loggingContext: { source: eventArgs.cardId },
          },
        );
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { source: cardEffectArgs.cardId });
    },
  },
  'endless-chalice': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.info(
        `[endless-chalice effect] registering permanent startTurn duration for player ${cardEffectArgs.playerId}`,
      );
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 1, buy: 1 });

      const chaliceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(
        chaliceCard,
        {
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async triggeredArgs => {
            loggerService.debug(
              `[endless-chalice duration] granting +$1 and +1 Buy to player ${cardEffectArgs.playerId}`,
            );
            await gainTreasureAndBuy({ actionService: triggeredArgs.actionService, treasure: 1, buy: 1 });
          },
        },
        {
          // Endless Chalice repeats for the rest of the game.
          hasActiveEffects: () => true,
        },
      );
    },
  },
  figurehead: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { source: cardEffectArgs.cardId });

      const figureheadCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(figureheadCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run(
            'drawCard',
            {
              playerId: cardEffectArgs.playerId,
              count: 2,
            },
            {
              loggingContext: { source: figureheadCard.id },
            },
          );
        },
      });
    },
  },
  hammer: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { source: cardEffectArgs.cardId });

      const gainableCardIds = cardEffectArgs.findCardService
        .findCards({
          all: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } },
          ],
        })
        .map(card => card.id);

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
  insignia: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainTreasure', { count: 3 }, { source: cardEffectArgs.cardId });
      registerThisTurnTopdeckOnGain(cardEffectArgs);
    },
  },
  jewels: {
    registerEffects: () => async cardEffectArgs => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const jewelsCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      cardEffectArgs.registerDurationEffect(jewelsCard, {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async triggeredArgs => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: jewelsCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck', index: 0 },
          });
        },
      });
    },
  },
  orb: {
    registerEffects: () => async cardEffectArgs => {
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      const discardPlayable = cardEffectArgs.cardSourceController
        .getSource('playerDiscard', cardEffectArgs.playerId)
        .filter(cardId => {
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          return card.type.includes('ACTION') || card.type.includes('TREASURE');
        });

      const decision = (await cardEffectArgs.actionService.run('userPrompt', {
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
      })) as { action: number };

      if (decision.action === 2) {
        await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });
        return;
      }

      if (!discardPlayable.length) {
        cardEffectArgs.loggerService.debug('[orb effect] no Action/Treasure in discard to play');
        return;
      }

      const selectPrompt = (await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Play an Action or Treasure from your discard',
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'PLAY', action: 2 },
        ],
        content: {
          type: 'select',
          cardIds: discardPlayable,
          selectionIntent: { kind: 'play-card', cardTypes: ['ACTION', 'TREASURE'] },
          selectCount: 1,
        },
      })) as { action?: number; result?: CardId[] } | null;

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
    registerEffects: () => async cardEffectArgs => {
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
    registerEffects: () => async cardEffectArgs => {
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
        triggeredEffectFn: async triggeredArgs => {
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
  sextant: {
    registerEffects: () => async cardEffectArgs => {
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

      const remainingCards = cardsToLookAt.filter(cardId => !(promptResult?.result ?? []).includes(cardId));
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
  shield: {
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
              playerId: reaction?.playerId!,
            });
            markPlayerImmune(reaction?.playerId!, reactionContext);
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`shield:${cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async cardEffectArgs => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });
    },
  },
  'spell-scroll': {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      const sourceCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: sourceCost } = cardEffectArgs.cardPriceController.applyRules(sourceCard, { playerId });

      await cardEffectArgs.actionService.run('trashCard', {
        playerId,
        cardId: cardEffectArgs.cardId,
      });

      const gainableCards = cardEffectArgs.findCardService
        .findCards({ all: [{ location: ['basicSupply', 'kingdomSupply'] }] })
        .filter(
          card =>
            compareCardCosts(cardEffectArgs.cardPriceController.applyRules(card, { playerId }).cost, sourceCost) === -1,
        );

      if (!gainableCards.length) {
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Gain a cheaper card',
        restrict: gainableCards.map(card => card.id),
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

      const shouldPlay = await cardEffectArgs.promptService.confirm(
        {
          playerId,
          prompt: `Play ${gainedCard.cardName}?`,
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        },
        2,
      );

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
  staff: {
    registerEffects: () => async cardEffectArgs => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const actionCardsInHand = cardEffectArgs.cardSourceController
        .getSource('playerHand', cardEffectArgs.playerId)
        .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('ACTION'));
      // Keep the optional Staff replay prompt available when only Shadow Actions remain in deck.
      const shadowActionsInDeck = getPlayerSourceSafe(cardEffectArgs, 'playerDeck', cardEffectArgs.playerId)
        .map(cardId => cardEffectArgs.cardLibrary.getCard(cardId))
        .filter(card => card.type.includes('ACTION') && card.type.includes('SHADOW'));

      if (!actionCardsInHand.length && !shadowActionsInDeck.length) {
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may play an Action from your hand',
        restrict: {
          all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: ['ACTION'] }],
        },
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
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
  sword: {
    registerEffects: () => async cardEffectArgs => {
      await gainTreasureAndBuy({ actionService: cardEffectArgs.actionService, treasure: 3, buy: 1 });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter(playerId => !isPlayerImmune(cardEffectArgs.reactionContext, playerId));

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
