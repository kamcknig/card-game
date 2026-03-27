import { findEventInMatch } from '@shared/find-card-like-in-match.ts';
import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getPlayerSourceSafe } from '../../utils/get-player-source-safe.ts';
import { getTopSupplyCards } from '../../utils/get-top-supply-cards.ts';
import { Card, CardCost, CardId, CardKey, PlayerId } from 'shared/types/index.ts';

// Returns the effective card cost for the resolving player.
const getEffectiveCostForPlayer = (cardEffectArgs: CardEffectFunctionContext, card: Card): CardCost => {
  const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
    playerId: cardEffectArgs.playerId,
  });
  return cost;
};

// Returns true when cost is <= the specified treasure amount with no potion/debt cost.
const isTreasureOnlyCostAtMost = (cost: CardCost, maxTreasure: number): boolean => {
  return cost.treasure <= maxTreasure && (cost.potion ?? 0) === 0 && (cost.debt ?? 0) === 0;
};

// Returns true when cost is exactly the specified treasure amount with no potion/debt cost.
const isTreasureOnlyCostExactly = (cost: CardCost, treasure: number): boolean => {
  return cost.treasure === treasure && (cost.potion ?? 0) === 0 && (cost.debt ?? 0) === 0;
};

// Returns true when cost is <= maxCost on each cost axis.
const isCostAtMost = (cost: CardCost, maxCost: CardCost): boolean => {
  return (
    cost.treasure <= maxCost.treasure &&
    (cost.potion ?? 0) <= (maxCost.potion ?? 0) &&
    (cost.debt ?? 0) <= (maxCost.debt ?? 0)
  );
};

// Returns true when the specified player has gained a Gold at any point this game.
const hasPlayerGainedGoldThisGame = (cardEffectArgs: CardEffectFunctionContext, playerId: PlayerId): boolean => {
  for (const [gainedCardIdKey, gainStats] of Object.entries(cardEffectArgs.match.stats.cardsGained)) {
    if (!gainStats || gainStats.playerId !== playerId) {
      continue;
    }

    const gainedCardId = Number(gainedCardIdKey) as CardId;
    const gainedCard = cardEffectArgs.cardLibrary.getCard(gainedCardId);
    if (gainedCard.cardKey === 'gold') {
      return true;
    }
  }

  return false;
};

// Returns the number of cards the specified player has gained this turn.
const getPlayerGainedCardCountThisTurn = (cardEffectArgs: CardEffectFunctionContext, playerId: PlayerId): number => {
  const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }, { fallbackToZero: false });
  if (turnHistoryIndex === undefined) {
    return 0;
  }

  const gainedCardIds = cardEffectArgs.match.stats.cardsGainedByTurn[turnHistoryIndex] ?? [];
  let gainedCount = 0;

  for (const gainedCardId of gainedCardIds) {
    const gainStats = cardEffectArgs.match.stats.cardsGained[gainedCardId];
    if (!gainStats) {
      continue;
    }
    if (gainStats.playerId !== playerId) {
      continue;
    }
    if (gainStats.turnHistoryIndex !== turnHistoryIndex) {
      continue;
    }
    gainedCount++;
  }

  return gainedCount;
};

const effectMap: CardExpansionModule = {
  amass: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[amass effect] resolving event');

      // Amass only gains if the player has no Action cards in play (including active Durations).
      const actionCardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => card.owner === cardEffectArgs.playerId)
        .filter(card => card.type.includes('ACTION'));

      if (actionCardsInPlay.length > 0) {
        loggerService.debug(
          `[amass effect] player ${cardEffectArgs.playerId} has ${actionCardsInPlay.length} Action card(s) in play`,
        );
        return;
      }

      const gainableActionCards = getTopSupplyCards(cardEffectArgs)
        .filter(card => card.type.includes('ACTION'))
        .filter(card => isTreasureOnlyCostAtMost(getEffectiveCostForPlayer(cardEffectArgs, card), 5));

      if (gainableActionCards.length < 1) {
        loggerService.debug('[amass effect] no Action card costing up to $5 is available to gain');
        return;
      }

      const selectedActionCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain an Action card costing up to $5',
        restrict: gainableActionCards.map(card => card.id),
      });

      if (!selectedActionCardId) {
        loggerService.warn('[amass effect] no Action card selected');
        return;
      }

      loggerService.info(`[amass effect] gaining selected Action card ${selectedActionCardId}`);
      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedActionCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  asceticism: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[asceticism effect] resolving event');

      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      const maxPay = Math.min(cardEffectArgs.match.playerTreasure, hand.length);

      if (maxPay < 1) {
        loggerService.debug(
          `[asceticism effect] cannot pay/trash; maxPay=${maxPay}, hand=${hand.length}, treasure=${cardEffectArgs.match.playerTreasure}`,
        );
        return;
      }

      // Use numeric input so the player chooses an exact spend amount up to their legal maximum.
      const requestedPayAmount = await cardEffectArgs.promptService.requestNumberInput(
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'How much $ to pay for Asceticism?',
          validationAction: 1,
          content: {
            type: 'number-input',
            min: 0,
            max: maxPay,
            value: 0,
            optional: true,
            submitText: 'PAY',
            cancelText: 'PAY 0',
          },
        },
        1,
      );

      const payAmount = Math.min(maxPay, Math.max(0, requestedPayAmount ?? 0));
      if (payAmount < 1) {
        loggerService.debug('[asceticism effect] player paid 0');
        return;
      }

      loggerService.info(`[asceticism effect] player paying ${payAmount} treasure`);
      await cardEffectArgs.actionService.run('spendTreasure', { count: payAmount });

      const handAfterPayment = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      const trashCount = Math.min(payAmount, handAfterPayment.length);
      if (trashCount < 1) {
        loggerService.debug('[asceticism effect] no cards left in hand to trash after payment');
        return;
      }
      if (trashCount !== payAmount) {
        loggerService.warn(
          `[asceticism effect] requested trash count ${payAmount} reduced to ${trashCount} due hand size`,
        );
      }

      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash ${trashCount} card${trashCount === 1 ? '' : 's'} from your hand`,
        restrict: handAfterPayment,
        count: { kind: 'exact', count: trashCount },
      });

      if (selectedCardIds.length < 1) {
        loggerService.warn('[asceticism effect] no cards selected to trash after payment');
        return;
      }
      if (selectedCardIds.length !== trashCount) {
        loggerService.warn(
          `[asceticism effect] expected ${trashCount} trashed card(s) but got ${selectedCardIds.length}`,
        );
      }

      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
      }
    },
  },
  continue: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[continue effect] resolving event');

      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[continue effect] event not found');
        return;
      }

      // Continue is once per turn by temporarily restricting this event for this player.
      const continueRestrictionRule: CardPriceRule = (card, context) => {
        if (card.id !== event.id || context.playerId !== cardEffectArgs.playerId) {
          return { restricted: false, cost: card.cost };
        }
        return { restricted: true, cost: card.cost };
      };
      const removeContinueRestriction = cardEffectArgs.cardPriceController.registerRule(event, continueRestrictionRule);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;

      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async triggeredArgs => {
            triggeredArgs.loggerService.debug(
              `[continue effect] removing once-per-turn buy lock for player ${cardEffectArgs.playerId}`,
            );
            removeContinueRestriction();
          },
        },
        {
          idSuffix: `continue:${cardEffectArgs.playerId}:turn:${turnHistoryIndex}`,
        },
      );

      const gainableCards = getTopSupplyCards(cardEffectArgs)
        .filter(card => card.type.includes('ACTION'))
        .filter(card => !card.type.includes('ATTACK'))
        .filter(card => isTreasureOnlyCostAtMost(getEffectiveCostForPlayer(cardEffectArgs, card), 4));

      let gainedCardId: CardId | null = null;
      if (gainableCards.length < 1) {
        loggerService.debug('[continue effect] no non-Attack Action costing up to $4 is available');
      } else {
        const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain a non-Attack Action card costing up to $4',
          restrict: gainableCards.map(card => card.id),
        });

        if (!selectedGainCardId) {
          loggerService.warn('[continue effect] no card selected to gain');
        } else {
          gainedCardId = selectedGainCardId;
          await cardEffectArgs.actionService.run('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedGainCardId,
            to: { location: 'playerDiscard' },
          });
        }
      }

      // Follow existing return-to-action phase behavior used by other event implementations.
      await cardEffectArgs.actionService.run('setTurnPhase', {
        phase: 'action',
        playerId: cardEffectArgs.playerId,
        endCurrentPhase: true,
        startNewPhase: true,
      });

      if (gainedCardId !== null) {
        let gainedCardStillInDiscard = false;
        try {
          const source = cardEffectArgs.cardSourceController.findCardSource(gainedCardId);
          gainedCardStillInDiscard =
            source.sourceKey === 'playerDiscard' && source.playerId === cardEffectArgs.playerId;
        } catch {
          gainedCardStillInDiscard = false;
        }

        if (!gainedCardStillInDiscard) {
          loggerService.debug('[continue effect] gained card moved before Continue play step');
        } else {
          loggerService.info(`[continue effect] playing gained Action card ${gainedCardId}`);
          await cardEffectArgs.actionService.run('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: gainedCardId,
            overrides: { actionCost: 0 },
          });
        }
      }

      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  credit: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[credit effect] resolving event');

      const gainableCards = getTopSupplyCards(cardEffectArgs)
        .filter(card => card.type.includes('ACTION') || card.type.includes('TREASURE'))
        .filter(card => isTreasureOnlyCostAtMost(getEffectiveCostForPlayer(cardEffectArgs, card), 8));

      if (gainableCards.length < 1) {
        loggerService.debug('[credit effect] no Action or Treasure costing up to $8 is available');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain an Action or Treasure costing up to $8',
        restrict: gainableCards.map(card => card.id),
      });

      if (!selectedCardId) {
        loggerService.warn('[credit effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardId,
        to: { location: 'playerDiscard' },
      });

      // Debt gained is based on the gained card's effective treasure cost at gain time.
      const gainedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      const gainedCardCost = getEffectiveCostForPlayer(cardEffectArgs, gainedCard);
      const debtToGain = Math.max(0, gainedCardCost.treasure);

      if (debtToGain < 1) {
        loggerService.debug('[credit effect] gained card effective treasure cost is 0; no debt gained');
        return;
      }

      loggerService.info(`[credit effect] gaining ${debtToGain} debt from gained card cost`);
      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: debtToGain,
      });
    },
  },
  foresight: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[foresight effect] resolving event');

      const event = findEventInMatch(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        loggerService.warn('[foresight effect] event not found');
        return;
      }

      const revealedCardIds: CardId[] = [];
      let revealedActionCardId: CardId | null = null;

      // Reveal and set aside cards until an Action is found or no cards remain.
      while (revealedActionCardId === null) {
        const revealedCardId = await cardEffectArgs.actionService.run('revealCard', {
          playerId: cardEffectArgs.playerId,
          source: 'playerDeck',
          moveToSetAside: true,
        });
        if (revealedCardId === undefined) {
          break;
        }

        revealedCardIds.push(revealedCardId);
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
        if (revealedCard.type.includes('ACTION')) {
          revealedActionCardId = revealedCardId;
        }
      }

      if (revealedCardIds.length < 1) {
        loggerService.debug('[foresight effect] no cards revealed');
        return;
      }

      const cardsToDiscard = revealedCardIds.filter(cardId => cardId !== revealedActionCardId);
      for (const cardToDiscardId of cardsToDiscard) {
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardToDiscardId,
        });
      }

      if (revealedActionCardId === null) {
        loggerService.debug('[foresight effect] no Action revealed; only discarded revealed cards');
        return;
      }

      // Foresight moves the set-aside Action to hand at end of turn (after draw hand).
      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardSourceController }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }
            return cardSourceController.getSource('set-aside', cardEffectArgs.playerId).includes(revealedActionCardId);
          },
          triggeredEffectFn: async triggeredArgs => {
            const setAside = getPlayerSourceSafe(triggeredArgs, 'set-aside', cardEffectArgs.playerId);
            if (!setAside.includes(revealedActionCardId)) {
              triggeredArgs.loggerService.debug('[foresight effect] set-aside Action moved before end-turn hand move');
              return;
            }

            await triggeredArgs.actionService.run('moveCard', {
              cardId: revealedActionCardId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'playerHand' },
            });
            triggeredArgs.loggerService.info(
              `[foresight effect] moved set-aside Action ${revealedActionCardId} into hand at end of turn`,
            );
          },
        },
        {
          idSuffix: `foresight:${cardEffectArgs.playerId}:${revealedActionCardId}:endTurn`,
        },
      );
    },
  },
  gather: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[gather effect] resolving event');

      // Gather gains in printed order: $3, then $4, then $5.
      const gatherCosts = [3, 4, 5];
      for (const gatherCost of gatherCosts) {
        const gainableCards = getTopSupplyCards(cardEffectArgs).filter(card =>
          isTreasureOnlyCostExactly(getEffectiveCostForPlayer(cardEffectArgs, card), gatherCost),
        );

        if (gainableCards.length < 1) {
          loggerService.debug(`[gather effect] no card costing exactly $${gatherCost} to gain`);
          continue;
        }

        const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain a card costing exactly $${gatherCost}`,
          restrict: gainableCards.map(card => card.id),
        });

        if (!selectedCardId) {
          loggerService.warn(`[gather effect] no card selected for exact cost $${gatherCost}`);
          continue;
        }

        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  kintsugi: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[kintsugi effect] resolving event');

      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (hand.length < 1) {
        loggerService.debug('[kintsugi effect] no cards in hand to trash');
        return;
      }

      const selectedTrashCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
      });

      if (!selectedTrashCardId) {
        loggerService.warn('[kintsugi effect] no card selected to trash');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(selectedTrashCardId);
      const trashedCardCost = getEffectiveCostForPlayer(cardEffectArgs, trashedCard);

      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedTrashCardId,
      });

      if (!hasPlayerGainedGoldThisGame(cardEffectArgs, cardEffectArgs.playerId)) {
        loggerService.debug('[kintsugi effect] player has not gained Gold this game; skipping gain step');
        return;
      }

      const maxGainCost: CardCost = {
        treasure: trashedCardCost.treasure + 2,
        potion: trashedCardCost.potion ?? 0,
        debt: trashedCardCost.debt ?? 0,
      };
      const gainableCards = getTopSupplyCards(cardEffectArgs).filter(card =>
        isCostAtMost(getEffectiveCostForPlayer(cardEffectArgs, card), maxGainCost),
      );

      if (gainableCards.length < 1) {
        loggerService.debug('[kintsugi effect] no card available to gain after trashing');
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $2 more than the trashed card',
        restrict: gainableCards.map(card => card.id),
      });

      if (!selectedGainCardId) {
        loggerService.warn('[kintsugi effect] no card selected for gain step');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  practice: {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[practice effect] resolving event');

      const selectedActionCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may play an Action card from your hand twice',
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION'] },
        optional: true,
        restrict: {
          all: [{ location: 'playerHand', playerId: cardEffectArgs.playerId }, { cardType: ['ACTION'] }],
        },
      });

      if (!selectedActionCardId) {
        loggerService.debug('[practice effect] player declined to play an Action card');
        return;
      }

      loggerService.info(`[practice effect] playing Action card ${selectedActionCardId} twice`);
      for (let playIndex = 0; playIndex < 2; playIndex++) {
        await cardEffectArgs.actionService.run('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedActionCardId,
          overrides: { actionCost: 0 },
        });
      }
    },
  },
  'receive-tribute': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[receive-tribute effect] resolving event');

      const gainedCardCountThisTurn = getPlayerGainedCardCountThisTurn(cardEffectArgs, cardEffectArgs.playerId);
      if (gainedCardCountThisTurn < 3) {
        loggerService.debug(
          `[receive-tribute effect] player gained ${gainedCardCountThisTurn} card(s) this turn; need at least 3`,
        );
        return;
      }

      // Names already in play are not allowed targets.
      const blockedCardKeys = new Set<CardKey>(
        cardEffectArgs.findCardService
          .getCardsInPlay()
          .filter(card => card.owner === cardEffectArgs.playerId)
          .map(card => card.cardKey),
      );

      // Gain up to 3 Actions, each with a different name and not matching in-play names.
      for (let gainStep = 0; gainStep < 3; gainStep++) {
        const gainableCards = getTopSupplyCards(cardEffectArgs)
          .filter(card => card.type.includes('ACTION'))
          .filter(card => !blockedCardKeys.has(card.cardKey));

        if (gainableCards.length < 1) {
          loggerService.debug('[receive-tribute effect] no more eligible Action cards to gain');
          return;
        }

        const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain an eligible Action card (${gainStep + 1} of 3, optional)`,
          optional: true,
          restrict: gainableCards.map(card => card.id),
        });

        if (!selectedGainCardId) {
          loggerService.debug(`[receive-tribute effect] player stopped after ${gainStep} gain step(s)`);
          return;
        }

        const selectedGainCard = cardEffectArgs.cardLibrary.getCard(selectedGainCardId);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedGainCardId,
          to: { location: 'playerDiscard' },
        });

        blockedCardKeys.add(selectedGainCard.cardKey);
      }
    },
  },
  'sea-trade': {
    registerEffects: () => async cardEffectArgs => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[sea-trade effect] resolving event');

      const actionCardsInPlay = cardEffectArgs.findCardService
        .getCardsInPlay()
        .filter(card => card.owner === cardEffectArgs.playerId)
        .filter(card => card.type.includes('ACTION'));
      const drawCount = actionCardsInPlay.length;

      if (drawCount > 0) {
        loggerService.info(`[sea-trade effect] drawing ${drawCount} card(s)`);
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: drawCount,
        });
      } else {
        loggerService.debug('[sea-trade effect] no Action cards in play; no cards drawn');
      }

      const handAfterDraw = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      const maxTrashCount = Math.min(drawCount, handAfterDraw.length);
      if (maxTrashCount < 1) {
        loggerService.debug('[sea-trade effect] no cards can be trashed from hand');
        return;
      }

      const selectedTrashCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash up to ${maxTrashCount} card${maxTrashCount === 1 ? '' : 's'} from your hand`,
        restrict: handAfterDraw,
        count: { kind: 'upTo', count: maxTrashCount },
        optional: true,
      });

      if (selectedTrashCardIds.length < 1) {
        loggerService.debug('[sea-trade effect] player chose not to trash cards');
        return;
      }

      loggerService.info(`[sea-trade effect] trashing ${selectedTrashCardIds.length} card(s) from hand`);
      for (const selectedTrashCardId of selectedTrashCardIds) {
        await cardEffectArgs.actionService.run('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedTrashCardId,
        });
      }
    },
  },
};

export default effectMap;
