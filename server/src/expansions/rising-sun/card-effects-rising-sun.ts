import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { BaseCardMetadata, Card, CardCost, CardId, CardKey, PlayerId } from 'shared/types/index.ts';
import { discardDownTo } from '../../utils/discard-down-to.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getTopSupplyCards } from '../../utils/get-top-supply-cards.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';
import { resolveChooseAbilities } from '../../utils/resolve-choose-abilities.ts';
import { returnCardToConfiguredPileTop } from '../../utils/return-card-to-configured-pile-top.ts';

const CURSE_PILE_KEY: CardKey = 'curse';
const SILVER_PILE_KEY: CardKey = 'silver';
const GOLD_PILE_KEY: CardKey = 'gold';

type RiverboatMetadata = {
  setAsideCardKey?: CardKey;
  runtimeSetAsidePileKey?: string;
};

type RisingSunCardMetadata = BaseCardMetadata & {
  risingSun?: {
    riverboat?: RiverboatMetadata;
  };
};

// Reads duration-trigger registrations for a card from the reaction manager internals.
const hasRegisteredDurationTriggers = (
  reactionManager: CardEffectFunctionContext['reactionManager'],
  cardId: CardId,
): boolean => {
  const durationMap = (
    reactionManager as unknown as { _durationTriggerIdsByCardId?: Map<CardId, Set<string>> }
  )._durationTriggerIdsByCardId;
  if (!durationMap) {
    return false;
  }
  const triggerIds = durationMap.get(cardId);
  return !!triggerIds && triggerIds.size > 0;
};

// Returns the current effective cost of a card for this player after all price rules apply.
const getEffectiveCostForPlayer = (
  cardPriceController: CardEffectFunctionContext['cardPriceController'],
  playerId: PlayerId,
  card: Card,
): CardCost => {
  const { cost } = cardPriceController.applyRules(card, {
    playerId,
  });
  return cost;
};

// Returns true when a card has only treasure cost and that cost is at most the requested amount.
const isTreasureOnlyCostAtMost = (cost: CardCost, maxTreasure: number): boolean => {
  return cost.treasure <= maxTreasure &&
    (cost.potion ?? 0) === 0 &&
    (cost.debt ?? 0) === 0;
};

// Returns how many times a specific card id has been played this turn.
const getCurrentPlayInstanceForCardIdThisTurn = (
  cardEffectArgs: Pick<CardEffectFunctionContext, 'match'>,
  cardId: CardId,
): number => {
  const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
  const playedCardIdsThisTurn = cardEffectArgs.match.stats.playedCardsByTurn[turnHistoryIndex] ?? [];
  return playedCardIdsThisTurn.filter((playedCardId) => playedCardId === cardId).length;
};

// Returns true when the player gained any card during Buy phase in the specified turn-history index.
const hasPlayerGainedCardInBuyPhaseThisTurn = (
  cardEffectArgs: Pick<CardEffectFunctionContext, 'match'>,
  playerId: PlayerId,
  turnHistoryIndex: number,
): boolean => {
  const gainedCardIds = cardEffectArgs.match.stats.cardsGainedByTurn[turnHistoryIndex] ?? [];
  for (const gainedCardId of gainedCardIds) {
    const gainStats = cardEffectArgs.match.stats.cardsGained[gainedCardId];
    if (!gainStats || gainStats.playerId !== playerId) {
      continue;
    }
    if (gainStats.turnHistoryIndex !== turnHistoryIndex) {
      continue;
    }
    if (gainStats.turnPhase !== 'buy') {
      continue;
    }
    return true;
  }
  return false;
};

// Builds ordered attack targets for "each other player" while respecting immunity.
const getOrderedOtherAttackTargets = (
  cardEffectArgs: Pick<CardEffectFunctionContext, 'match' | 'playerId' | 'reactionContext'>,
): PlayerId[] => {
  const currentTurnPlayerId = getCurrentPlayer(cardEffectArgs.match).id;
  return findOrderedTargets({
    startingPlayerId: currentTurnPlayerId,
    appliesTo: 'ALL',
    match: cardEffectArgs.match,
  }).filter((targetPlayerId) => {
    if (targetPlayerId === cardEffectArgs.playerId) {
      return false;
    }
    return !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId);
  });
};

// Applies a standard "each other player gains a Curse" attack.
const gainCurseForOtherPlayers = async (
  cardEffectArgs: CardEffectFunctionContext,
  logTag: string,
): Promise<void> => {
  const targetPlayerIds = getOrderedOtherAttackTargets(cardEffectArgs);
  cardEffectArgs.loggerService.debug(`[${logTag}] curse targets ${targetPlayerIds.join(', ')}`);

  for (const targetPlayerId of targetPlayerIds) {
    const gainedCurseId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
      playerId: targetPlayerId,
      pileKey: CURSE_PILE_KEY,
      from: 'basicSupply',
      to: { location: 'playerDiscard' },
      logTag,
    });
    if (!gainedCurseId) {
      cardEffectArgs.loggerService.debug(`[${logTag}] no Curse remained to gain`);
      return;
    }
  }
};

// Reads Riverboat setup metadata attached to the runtime Riverboat card instance.
const getRiverboatMetadata = (card: Card): RiverboatMetadata | undefined => {
  const metadata = card.metadata as RisingSunCardMetadata | undefined;
  return metadata?.risingSun?.riverboat;
};

// Resolves the set-aside card id selected for Riverboat setup.
const getRiverboatSetAsideCardId = (
  cardEffectArgs: Pick<CardEffectFunctionContext, 'cardSourceController' | 'cardLibrary' | 'loggerService'>,
  riverboatCard: Card,
): CardId | undefined => {
  const riverboatMetadata = getRiverboatMetadata(riverboatCard);
  const runtimeSetAsidePileKey = riverboatMetadata?.runtimeSetAsidePileKey;
  if (!runtimeSetAsidePileKey) {
    cardEffectArgs.loggerService.warn('[riverboat effect] missing runtime set-aside pile metadata on Riverboat');
    return undefined;
  }

  const sharedSetAside = cardEffectArgs.cardSourceController.getSource('set-aside');
  const setAsideCardId = sharedSetAside.find((candidateId) => {
    const candidateCard = cardEffectArgs.cardLibrary.getCard(candidateId);
    return candidateCard.kingdom === runtimeSetAsidePileKey;
  });

  if (setAsideCardId === undefined) {
    cardEffectArgs.loggerService.warn(
      `[riverboat effect] no set-aside card found in runtime pile ${runtimeSetAsidePileKey}`,
    );
    return undefined;
  }

  const setAsideCard = cardEffectArgs.cardLibrary.getCard(setAsideCardId);
  if (riverboatMetadata?.setAsideCardKey && setAsideCard.cardKey !== riverboatMetadata.setAsideCardKey) {
    cardEffectArgs.loggerService.warn(
      `[riverboat effect] expected set-aside card ${riverboatMetadata.setAsideCardKey} but found ${setAsideCard.cardKey}`,
    );
  }

  return setAsideCardId;
};

const cards: CardExpansionModule = {
  'aristocrat': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[aristocrat effect] resolving card');

      const aristocratsInPlayCount = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.owner === cardEffectArgs.playerId)
        .filter((card) => card.cardKey === 'aristocrat')
        .length;

      loggerService.debug(`[aristocrat effect] player has ${aristocratsInPlayCount} Aristocrat card(s) in play`);

      if (aristocratsInPlayCount === 1 || aristocratsInPlayCount === 5) {
        await cardEffectArgs.actionService.run('gainAction', { count: 3 });
        return;
      }

      if (aristocratsInPlayCount === 2 || aristocratsInPlayCount === 6) {
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3,
        });
        return;
      }

      if (aristocratsInPlayCount === 3 || aristocratsInPlayCount === 7) {
        await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });
        return;
      }

      if (aristocratsInPlayCount === 4 || aristocratsInPlayCount === 8) {
        await cardEffectArgs.actionService.run('gainBuy', { count: 3 });
        return;
      }

      loggerService.debug('[aristocrat effect] no matching Aristocrat count bonus to resolve');
    },
  },
  'artist': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[artist effect] resolving card');

      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const cardsInPlayForPlayer = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.owner === cardEffectArgs.playerId);

      const copyCountByCardKey: Record<string, number> = {};
      for (const card of cardsInPlayForPlayer) {
        copyCountByCardKey[card.cardKey] = (copyCountByCardKey[card.cardKey] ?? 0) + 1;
      }

      const uniqueInPlayCount = Object.values(copyCountByCardKey)
        .filter((copyCount) => copyCount === 1)
        .length;

      loggerService.debug(`[artist effect] unique in-play card count ${uniqueInPlayCount}`);
      if (uniqueInPlayCount < 1) {
        return;
      }

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: uniqueInPlayCount,
      });
    },
  },
  'change': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[change effect] resolving card');

      const playerDebt = cardEffectArgs.match.debt[cardEffectArgs.playerId] ?? 0;
      if (playerDebt > 0) {
        loggerService.debug(`[change effect] player has debt (${playerDebt}), resolving +$3 branch`);
        await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });
        return;
      }

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length < 1) {
        loggerService.debug('[change effect] no card in hand to trash');
        return;
      }

      const selectedTrashCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      }) as CardId | null;

      if (!selectedTrashCardId) {
        loggerService.warn('[change effect] no card selected to trash');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(selectedTrashCardId);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedTrashCardId,
      });

      const trashedCardCostForGainSelection = getEffectiveCostForPlayer(
        cardEffectArgs.cardPriceController,
        cardEffectArgs.playerId,
        trashedCard,
      );
      const gainableCards = getTopSupplyCards(cardEffectArgs)
        .filter((candidateCard) => {
          const candidateCost = getEffectiveCostForPlayer(
            cardEffectArgs.cardPriceController,
            cardEffectArgs.playerId,
            candidateCard,
          );
          return candidateCost.treasure > trashedCardCostForGainSelection.treasure;
        });

      if (gainableCards.length < 1) {
        loggerService.debug('[change effect] no top-of-pile card costs more $ than trashed card');
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing more $ than the trashed card',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      }) as CardId | null;

      if (!selectedGainCardId) {
        loggerService.warn('[change effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });

      const gainedCard = cardEffectArgs.cardLibrary.getCard(selectedGainCardId);
      if (gainedCard.owner !== cardEffectArgs.playerId) {
        loggerService.debug(
          `[change effect] gained card ${selectedGainCardId} is no longer owned by player ${cardEffectArgs.playerId}, skipping debt gain`,
        );
        return;
      }

      // Debt amount is based on current $ costs at this point in resolution.
      const currentTrashedCost = getEffectiveCostForPlayer(
        cardEffectArgs.cardPriceController,
        cardEffectArgs.playerId,
        trashedCard,
      );
      const currentGainedCost = getEffectiveCostForPlayer(
        cardEffectArgs.cardPriceController,
        cardEffectArgs.playerId,
        gainedCard,
      );
      const debtToGain = Math.abs(currentGainedCost.treasure - currentTrashedCost.treasure);

      if (debtToGain < 1) {
        loggerService.debug('[change effect] $ cost difference is 0, no debt gained');
        return;
      }

      loggerService.info(`[change effect] gaining ${debtToGain} debt`);
      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: debtToGain,
      });
    },
  },
  'craftsman': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[craftsman effect] resolving card');

      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });

      const gainableCards = getTopSupplyCards(cardEffectArgs)
        .filter((candidateCard) =>
          isTreasureOnlyCostAtMost(
            getEffectiveCostForPlayer(cardEffectArgs.cardPriceController, cardEffectArgs.playerId, candidateCard),
            5,
          )
        );

      if (gainableCards.length < 1) {
        loggerService.debug('[craftsman effect] no top-of-pile card costing up to $5 available');
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Gain a card costing up to $5',
        restrict: gainableCards.map((card) => card.id),
        count: 1,
      }) as CardId | null;

      if (!selectedGainCardId) {
        loggerService.warn('[craftsman effect] no card selected to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'daimyo': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[daimyo effect] resolving card');

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const daimyoCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const daimyoPlayInstance = getCurrentPlayInstanceForCardIdThisTurn(cardEffectArgs, cardEffectArgs.cardId);
      const playedOnTurnPlayerId = getCurrentPlayer(cardEffectArgs.match).id;

      let replayTriggerId = '';
      replayTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate(
        daimyoCard,
        'afterCardPlayed',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, cardLibrary, match }) => {
            if (trigger.args.playerId !== cardEffectArgs.playerId) {
              return false;
            }

            const currentTurnHistoryIndex = getCurrentTurnHistoryIndex(
              { match },
              { fallbackToZero: false },
            );
            if (currentTurnHistoryIndex !== turnHistoryIndex) {
              return false;
            }

            const playedCard = cardLibrary.getCard(trigger.args.cardId);
            if (!playedCard.type.includes('ACTION')) {
              return false;
            }

            return !playedCard.type.includes('COMMAND');
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const replayedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            loggerService.info(`[daimyo effect] replaying ${replayedCard}`);
            await triggeredArgs.actionService.run('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: replayedCard.id,
              wayId: triggeredArgs.trigger.args.wayId ?? null,
              overrides: {
                actionCost: 0,
                moveCard: false,
              },
            });
          },
        },
        { idSuffix: `next-action:${turnHistoryIndex}:play:${daimyoPlayInstance}` },
      );

      // Remove the pending this-turn replay trigger if no eligible Action was played.
      cardEffectArgs.reactionManager.registerSystemTemplate(
        daimyoCard,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) => {
            if (trigger.args.playerId !== playedOnTurnPlayerId) {
              return false;
            }
            const currentTurnHistoryIndex = getCurrentTurnHistoryIndex(
              { match },
              { fallbackToZero: false },
            );
            return currentTurnHistoryIndex === turnHistoryIndex;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[daimyo endTurn effect] cleaning up unused replay trigger');
            triggeredArgs.reactionManager.unregisterTrigger(replayTriggerId);
          },
        },
        { idSuffix: `next-action-cleanup:${turnHistoryIndex}:play:${daimyoPlayInstance}` },
      );
    },
  },
  'gold-mine': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[gold-mine effect] resolving card');

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const topGold = cardEffectArgs.findCardService.findTopSupplyCardForPileKey({
        pileKey: GOLD_PILE_KEY,
        from: 'basicSupply',
      });
      if (!topGold) {
        loggerService.debug('[gold-mine effect] no Gold remained in supply');
        return;
      }

      const shouldGainGold = await cardEffectArgs.promptService.confirm(
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Gain a Gold and take +4 Debt?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
          content: {
            type: 'display-cards',
            cardIds: [topGold.id],
          },
        },
        2,
      );

      if (!shouldGainGold) {
        loggerService.debug('[gold-mine effect] player declined Gold gain');
        return;
      }

      const gainedGoldId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId: cardEffectArgs.playerId,
        pileKey: GOLD_PILE_KEY,
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'gold-mine effect',
      });
      if (!gainedGoldId) {
        loggerService.debug('[gold-mine effect] Gold was unavailable when trying to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: 4,
      });
    },
  },
  'imperial-envoy': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 5,
      });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'kitsune': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[kitsune effect] resolving card');

      await cardEffectArgs.actionService.run('removeSunToken');

      await resolveChooseAbilities({
        context: cardEffectArgs,
        logTag: 'kitsune effect',
        prompt: 'Choose two options',
        baseChoiceCount: 2,
        options: [
          {
            action: 1,
            label: '+2 Actions',
            resolve: async () => {
              await cardEffectArgs.actionService.run('gainAction', { count: 2 });
            },
          },
          {
            action: 2,
            label: '+$2',
            resolve: async () => {
              await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
            },
          },
          {
            action: 3,
            label: 'Each other player gains a Curse',
            resolve: async () => {
              await gainCurseForOtherPlayers(cardEffectArgs, 'kitsune effect');
            },
          },
          {
            action: 4,
            label: 'Gain a Silver',
            resolve: async () => {
              const gainedSilverId = await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
                playerId: cardEffectArgs.playerId,
                pileKey: SILVER_PILE_KEY,
                from: 'basicSupply',
                to: { location: 'playerDiscard' },
                logTag: 'kitsune effect',
              });
              if (!gainedSilverId) {
                loggerService.debug('[kitsune effect] no Silver remained to gain');
              }
            },
          },
        ],
      });
    },
  },
  'litter': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });
      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
    },
  },
  'mountain-shrine': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[mountain-shrine effect] resolving card');

      await cardEffectArgs.actionService.run('removeSunToken');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length > 0) {
        const selectedTrashCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'You may trash a card from your hand',
          restrict: hand,
          count: 1,
          optional: true,
        }) as CardId | null;

        if (selectedTrashCardId) {
          await cardEffectArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedTrashCardId,
          });
        }
      }

      const hasActionCardInTrash = cardEffectArgs.cardSourceController.getSource('trash')
        .some((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).type.includes('ACTION'));

      if (!hasActionCardInTrash) {
        loggerService.debug('[mountain-shrine effect] no Action card in trash, skipping +2 Cards');
        return;
      }

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 2,
      });
    },
  },
  'poet': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[poet effect] resolving card');

      await cardEffectArgs.actionService.run('removeSunToken');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const revealedCardId = await cardEffectArgs.actionService.run('revealCard', {
        playerId: cardEffectArgs.playerId,
        source: 'playerDeck',
      }) as CardId | undefined;
      if (revealedCardId === undefined) {
        loggerService.debug('[poet effect] no card to reveal');
        return;
      }

      const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
      const revealedCardCost = getEffectiveCostForPlayer(
        cardEffectArgs.cardPriceController,
        cardEffectArgs.playerId,
        revealedCard,
      );
      if (!isTreasureOnlyCostAtMost(revealedCardCost, 3)) {
        loggerService.debug(`[poet effect] revealed card ${revealedCard} does not cost $3 or less`);
        return;
      }

      loggerService.debug(`[poet effect] moving revealed card ${revealedCard} to hand`);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: revealedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerHand' },
      });
    },
  },
  'rice-broker': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[rice-broker effect] resolving card');

      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length < 1) {
        loggerService.debug('[rice-broker effect] no card in hand to trash');
        return;
      }

      const selectedTrashCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash a card from your hand',
        restrict: hand,
        count: 1,
      }) as CardId | null;

      if (!selectedTrashCardId) {
        loggerService.warn('[rice-broker effect] no card selected to trash');
        return;
      }

      const trashedCard = cardEffectArgs.cardLibrary.getCard(selectedTrashCardId);
      await cardEffectArgs.actionService.run('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedTrashCardId,
      });

      if (trashedCard.type.includes('TREASURE')) {
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2,
        });
      }

      if (trashedCard.type.includes('ACTION')) {
        await cardEffectArgs.actionService.run('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 5,
        });
      }
    },
  },
  'rice': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[rice effect] resolving card');

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const inPlayCardsForPlayer = cardEffectArgs.findCardService.getCardsInPlay()
        .filter((card) => card.owner === cardEffectArgs.playerId);

      const uniqueTypes = new Set<string>();
      for (const inPlayCard of inPlayCardsForPlayer) {
        for (const cardType of inPlayCard.type) {
          uniqueTypes.add(cardType);
        }
      }

      const treasureGain = uniqueTypes.size;
      loggerService.debug(`[rice effect] gaining +$${treasureGain} from ${treasureGain} unique type(s)`);

      if (treasureGain < 1) {
        return;
      }

      await cardEffectArgs.actionService.run('gainTreasure', { count: treasureGain });
    },
  },
  'river-shrine': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[river-shrine effect] resolving card');

      await cardEffectArgs.actionService.run('removeSunToken');

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length > 0) {
        const selectedTrashCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Trash up to 2 cards from your hand',
          restrict: hand,
          count: { kind: 'upTo', count: 2 },
        });

        for (const selectedTrashCardId of selectedTrashCardIds) {
          await cardEffectArgs.actionService.run('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedTrashCardId,
          });
        }
      }

      const riverShrineCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const playedOnTurnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const riverShrinePlayInstance = getCurrentPlayInstanceForCardIdThisTurn(cardEffectArgs, cardEffectArgs.cardId);
      const playedOnTurnPlayerId = getCurrentPlayer(cardEffectArgs.match).id;

      let cleanupTriggerId = '';
      cleanupTriggerId = cardEffectArgs.reactionManager.registerSystemTemplate(
        riverShrineCard,
        'startTurnPhase',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) => {
            if (getCurrentPlayer(match).id !== cardEffectArgs.playerId) {
              return false;
            }
            if (getCurrentTurnHistoryIndex({ match }, { fallbackToZero: false }) !== playedOnTurnHistoryIndex) {
              return false;
            }
            return getTurnPhase(trigger.args.phaseIndex) === 'cleanup';
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const didGainInBuyPhase = hasPlayerGainedCardInBuyPhaseThisTurn(
              triggeredArgs,
              cardEffectArgs.playerId,
              playedOnTurnHistoryIndex,
            );
            if (didGainInBuyPhase) {
              loggerService.debug('[river-shrine cleanup effect] player gained in Buy phase, skipping gain');
              return;
            }

            const gainableCards = getTopSupplyCards(triggeredArgs)
              .filter((candidateCard) =>
                isTreasureOnlyCostAtMost(
                  getEffectiveCostForPlayer(
                    triggeredArgs.cardPriceController,
                    cardEffectArgs.playerId,
                    candidateCard,
                  ),
                  4,
                )
              );

            if (gainableCards.length < 1) {
              loggerService.debug('[river-shrine cleanup effect] no top-of-pile card costing up to $4 available');
              return;
            }

            const selectedGainCardId = await triggeredArgs.actionService.run('selectSingleCard', {
              playerId: cardEffectArgs.playerId,
              prompt: 'Gain a card costing up to $4',
              restrict: gainableCards.map((card) => card.id),
              count: 1,
            }) as CardId | null;

            if (!selectedGainCardId) {
              loggerService.warn('[river-shrine cleanup effect] no card selected to gain');
              return;
            }

            await triggeredArgs.actionService.run('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedGainCardId,
              to: { location: 'playerDiscard' },
            });
          },
        },
        { idSuffix: `cleanup-gain:${playedOnTurnHistoryIndex}:play:${riverShrinePlayInstance}` },
      );

      // Remove unused cleanup trigger at end of the turn this River Shrine was played.
      cardEffectArgs.reactionManager.registerSystemTemplate(
        riverShrineCard,
        'endTurn',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) => {
            if (trigger.args.playerId !== playedOnTurnPlayerId) {
              return false;
            }
            const currentTurnHistoryIndex = getCurrentTurnHistoryIndex(
              { match },
              { fallbackToZero: false },
            );
            return currentTurnHistoryIndex === playedOnTurnHistoryIndex;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[river-shrine endTurn effect] cleaning up deferred cleanup trigger');
            triggeredArgs.reactionManager.unregisterTrigger(cleanupTriggerId);
          },
        },
        { idSuffix: `cleanup-gain-cleanup:${playedOnTurnHistoryIndex}:play:${riverShrinePlayInstance}` },
      );
    },
  },
  'riverboat': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const riverboatCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const riverboatPlayInstance = getCurrentPlayInstanceForCardIdThisTurn(cardEffectArgs, cardEffectArgs.cardId);

      loggerService.log('[riverboat effect] resolving card');

      let pendingStartTurnReplay = true;
      let replayedDurationCardId: CardId | null = null;

      cardEffectArgs.registerDurationEffect(
        riverboatCard,
        {
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            pendingStartTurnReplay = false;

            const setAsideCardId = getRiverboatSetAsideCardId(triggeredArgs, riverboatCard);
            if (setAsideCardId === undefined) {
              return;
            }

            // Route through selectCard play-selection so players can choose normal play vs Way.
            const selectedPlayCardIds = await triggeredArgs.actionService.run('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: 'Play the Riverboat set-aside card',
              restrict: [setAsideCardId],
              count: { kind: 'exact', count: 1 },
              playCard: true,
            });
            const resolvedSetAsideCardId = selectedPlayCardIds[0] ?? setAsideCardId;
            if (selectedPlayCardIds.length !== 1) {
              loggerService.debug(
                '[riverboat startTurn effect] set-aside play selection did not return exactly one card; using default card',
              );
            }

            const setAsideCard = triggeredArgs.cardLibrary.getCard(resolvedSetAsideCardId);
            loggerService.info(`[riverboat startTurn effect] playing set-aside card ${setAsideCard}`);
            await triggeredArgs.actionService.run('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: resolvedSetAsideCardId,
              overrides: {
                actionCost: 0,
                moveCard: false,
              },
            });

            // Keep Riverboat if the set-aside card registered any duration follow-up work.
            if (!hasRegisteredDurationTriggers(triggeredArgs.reactionManager, resolvedSetAsideCardId)) {
              loggerService.debug(
                '[riverboat startTurn effect] set-aside card has no active duration follow-up; no extended hold needed',
              );
              return;
            }

            replayedDurationCardId = resolvedSetAsideCardId;
            loggerService.debug(
              '[riverboat startTurn effect] set-aside card registered duration follow-up; keeping Riverboat active',
            );
          },
        },
        {
          hasActiveEffects: async (durationContext) => {
            if (pendingStartTurnReplay) {
              return true;
            }

            if (replayedDurationCardId === null) {
              return false;
            }

            return hasRegisteredDurationTriggers(durationContext.reactionManager, replayedDurationCardId);
          },
          autoRemoveTriggersOnExhaust: true,
          idSuffix: `riverboat:${turnHistoryIndex}:play:${riverboatPlayInstance}`,
        },
      );
    },
  },
  'root-cellar': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainDebt', {
        playerId: cardEffectArgs.playerId,
        count: 3,
      });
    },
  },
  'rustic-village': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[rustic-village effect] resolving card');

      await cardEffectArgs.actionService.run('removeSunToken');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length < 2) {
        loggerService.debug('[rustic-village effect] fewer than 2 cards in hand, skipping optional discard');
        return;
      }

      const selectedDiscardCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'You may discard exactly 2 cards for +1 Card',
        cancelPrompt: 'Skip',
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: { kind: 'exact', count: 2 },
        optional: true,
      });

      if (selectedDiscardCardIds.length === 0) {
        loggerService.debug('[rustic-village effect] player declined optional discard');
        return;
      }

      if (selectedDiscardCardIds.length !== 2) {
        loggerService.warn(
          `[rustic-village effect] expected 0 or 2 selected cards but got ${selectedDiscardCardIds.length}`,
        );
        return;
      }

      await cardEffectArgs.actionService.run('discardCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedDiscardCardIds,
      });

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
    },
  },
  'samurai': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[samurai effect] resolving card');

      const targetPlayerIds = getOrderedOtherAttackTargets(cardEffectArgs);
      for (const targetPlayerId of targetPlayerIds) {
        await discardDownTo(cardEffectArgs, {
          playerId: targetPlayerId,
          targetHandSize: 3,
          prompt: 'Discard down to 3 cards in hand',
          logTag: 'samurai effect',
        });
      }

      const samuraiCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      const samuraiPlayInstance = getCurrentPlayInstanceForCardIdThisTurn(cardEffectArgs, cardEffectArgs.cardId);

      cardEffectArgs.registerDurationEffect(
        samuraiCard,
        {
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            loggerService.debug('[samurai duration effect] gaining +$1 at start of turn');
            await triggeredArgs.actionService.run('gainTreasure', { count: 1 });
          },
        },
        {
          hasActiveEffects: async () => true,
          autoRemoveTriggersOnExhaust: true,
          idSuffix: `samurai:${turnHistoryIndex}:play:${samuraiPlayInstance}`,
        },
      );
    },
  },
  'snake-witch': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      loggerService.log('[snake-witch effect] resolving card');

      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const seenCardKeys = new Set<CardKey>();
      let hasDuplicateCardKey = false;
      for (const handCardId of hand) {
        const handCard = cardEffectArgs.cardLibrary.getCard(handCardId);
        if (seenCardKeys.has(handCard.cardKey)) {
          hasDuplicateCardKey = true;
          break;
        }
        seenCardKeys.add(handCard.cardKey);
      }

      if (hasDuplicateCardKey) {
        loggerService.debug('[snake-witch effect] hand has duplicate card names; optional attack is unavailable');
        return;
      }

      const shouldRevealAndAttack = await cardEffectArgs.promptService.confirm(
        {
          playerId: cardEffectArgs.playerId,
          prompt: 'Reveal your hand and return Snake Witch to its pile to give each other player a Curse?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        },
        2,
      );
      if (!shouldRevealAndAttack) {
        loggerService.debug('[snake-witch effect] player declined optional reveal-and-attack');
        return;
      }

      for (const handCardId of hand) {
        await cardEffectArgs.actionService.run('revealCard', {
          playerId: cardEffectArgs.playerId,
          cardId: handCardId,
        });
      }

      const snakeWitchCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const returnedToPile = await returnCardToConfiguredPileTop({
        actionService: cardEffectArgs.actionService,
        loggerService,
        match: cardEffectArgs.match,
        card: snakeWitchCard,
        logTag: 'snake-witch effect',
      });

      if (!returnedToPile) {
        loggerService.debug('[snake-witch effect] could not return Snake Witch to pile; skipping Curse attack');
        return;
      }

      await gainCurseForOtherPlayers(cardEffectArgs, 'snake-witch effect');
    },
  },
  'tea-house': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.actionService.run('removeSunToken');
      await cardEffectArgs.actionService.run('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: 1,
      });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });
    },
  },
};

export default cards;
