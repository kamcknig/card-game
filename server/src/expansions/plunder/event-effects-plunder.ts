import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { getPileDefinitionCard } from '../../utils/get-pile-definition-card.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isCardStillAtGainedLocation } from '../../utils/is-card-still-at-gained-location.ts';
import { getCurrentTurnHistoryIndex } from '../../utils/get-current-turn-history-index.ts';
import { getPlayerSourceSafe } from '../../utils/get-player-source-safe.ts';
import { CardEffectFunctionContext, CardExpansionModule } from '@server-types/index.ts';
import { BaseCardMetadata, CardId, CardKey, PlayerId } from 'shared/types/index.ts';
import { findEventInMatch } from '@shared/find-card-like-in-match.ts';

type PlunderEventMetadata = {
  plunder?: {
    // Tracks one-time listener registration per player for persistent event state handlers.
    listenersByPlayerId?: Partial<
      Record<
        PlayerId,
        {
          avoid?: boolean;
          deliver?: boolean;
          mirror?: boolean;
          rush?: boolean;
          cleanup?: boolean;
        }
      >
    >;
    // Tracks pending Avoid card count to keep in discard on the next shuffle this turn.
    avoidPendingByPlayerId?: Partial<Record<PlayerId, number>>;
    // Tracks Deliver activation turn index for each player.
    deliverActiveTurnIndexByPlayerId?: Partial<Record<PlayerId, number>>;
    // Tracks Deliver set-aside gained cards to return to hand at end of turn.
    deliverSetAsideByPlayerId?: Partial<Record<PlayerId, CardId[]>>;
    // Tracks pending Mirror copy count for the next gained Action this turn.
    mirrorPendingByPlayerId?: Partial<Record<PlayerId, number>>;
    // Tracks whether Rush is armed for the next gained Action this turn.
    rushPendingByPlayerId?: Partial<Record<PlayerId, boolean>>;
  };
};

// Ensures Plunder event metadata containers exist and returns them.
const getPlunderMetadata = (args: { event: ReturnType<typeof findEventInMatch<PlunderEventMetadata>> }) => {
  const event = args.event;
  if (!event) {
    return null;
  }

  event.metadata.plunder ??= {};
  event.metadata.plunder.listenersByPlayerId ??= {};
  event.metadata.plunder.avoidPendingByPlayerId ??= {};
  event.metadata.plunder.deliverActiveTurnIndexByPlayerId ??= {};
  event.metadata.plunder.deliverSetAsideByPlayerId ??= {};
  event.metadata.plunder.mirrorPendingByPlayerId ??= {};
  event.metadata.plunder.rushPendingByPlayerId ??= {};

  return event.metadata.plunder;
};

// Registers a shared end-turn cleanup handler for transient this-turn event state.
const registerPlunderEndTurnCleanup = (
  cardEffectArgs: CardEffectFunctionContext,
  event: NonNullable<ReturnType<typeof findEventInMatch<PlunderEventMetadata>>>,
): void => {
  const metadata = getPlunderMetadata({ event });
  if (!metadata) {
    return;
  }

  const playerId = cardEffectArgs.playerId;
  const listeners = (metadata.listenersByPlayerId ??= {});
  listeners[playerId] ??= {};
  if (listeners[playerId]!.cleanup) {
    return;
  }

  listeners[playerId]!.cleanup = true;
  cardEffectArgs.reactionManager.registerSystemTemplate(
    event,
    'endTurn',
    {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: false,
      condition: ({ trigger }) => trigger.args.playerId === playerId,
      triggeredEffectFn: async triggeredArgs => {
        const currentMetadata = getPlunderMetadata({ event });
        if (!currentMetadata) {
          return;
        }

        currentMetadata.avoidPendingByPlayerId![playerId] = 0;
        currentMetadata.deliverActiveTurnIndexByPlayerId![playerId] = undefined;
        currentMetadata.deliverSetAsideByPlayerId![playerId] = [];
        currentMetadata.mirrorPendingByPlayerId![playerId] = 0;
        currentMetadata.rushPendingByPlayerId![playerId] = false;
        triggeredArgs.loggerService.debug(`[plunder event cleanup] cleared transient state for player ${playerId}`);
      },
    },
    {
      idSuffix: `plunder-transient-cleanup:${playerId}`,
    },
  );
};

// Registers the shared Avoid shuffle listener for one player.
const registerAvoidListener = (
  cardEffectArgs: CardEffectFunctionContext,
  event: NonNullable<ReturnType<typeof findEventInMatch<PlunderEventMetadata>>>,
): void => {
  const metadata = getPlunderMetadata({ event });
  if (!metadata) {
    return;
  }

  const playerId = cardEffectArgs.playerId;
  metadata.listenersByPlayerId![playerId] ??= {};
  if (metadata.listenersByPlayerId![playerId]!.avoid) {
    return;
  }

  metadata.listenersByPlayerId![playerId]!.avoid = true;
  cardEffectArgs.reactionManager.registerSystemTemplate(
    event,
    'shuffle',
    {
      playerId,
      once: false,
      compulsory: false,
      allowMultipleInstances: false,
      condition: ({ trigger }) => {
        if (trigger.args.playerId !== playerId) {
          return false;
        }
        const pendingCount = getPlunderMetadata({ event })?.avoidPendingByPlayerId?.[playerId] ?? 0;
        if (pendingCount < 1) {
          return false;
        }
        return (trigger.args.cardIds ?? []).length > 0;
      },
      triggeredEffectFn: async triggeredArgs => {
        const currentMetadata = getPlunderMetadata({ event });
        if (!currentMetadata) {
          return;
        }

        const pendingCount = currentMetadata.avoidPendingByPlayerId![playerId] ?? 0;
        const shuffledCardIds = [...(triggeredArgs.trigger.args.cardIds ?? [])];
        const selectableCount = Math.min(pendingCount, shuffledCardIds.length);

        currentMetadata.avoidPendingByPlayerId![playerId] = 0;
        if (selectableCount < 1) {
          return;
        }

        const selectedCardIds = await triggeredArgs.actionService.run('selectCard', {
          playerId,
          prompt: `Choose up to ${selectableCount} shuffled card(s) to keep in discard (Avoid)`,
          restrict: shuffledCardIds,
          count: { kind: 'upTo', count: selectableCount },
          optional: true,
        });

        if (!selectedCardIds.length) {
          triggeredArgs.loggerService.debug('[avoid effect] player selected no cards to keep in discard');
          return;
        }

        const filteredShuffledCardIds = [...shuffledCardIds];
        for (const selectedCardId of selectedCardIds) {
          const selectedCardIndex = filteredShuffledCardIds.indexOf(selectedCardId);
          if (selectedCardIndex >= 0) {
            filteredShuffledCardIds.splice(selectedCardIndex, 1);
          }

          let sourceInfo: { sourceKey: string; playerId?: PlayerId } | null = null;
          try {
            sourceInfo = triggeredArgs.cardSourceController.findCardSource(selectedCardId);
          } catch {
            sourceInfo = null;
          }

          const alreadyInPlayerDiscard = sourceInfo?.sourceKey === 'playerDiscard' && sourceInfo.playerId === playerId;
          if (!alreadyInPlayerDiscard) {
            await triggeredArgs.actionService.run('moveCard', {
              cardId: selectedCardId,
              toPlayerId: playerId,
              to: { location: 'playerDiscard' },
            });
          }
        }
        triggeredArgs.trigger.args.cardIds = filteredShuffledCardIds;
        triggeredArgs.loggerService.debug(`[avoid effect] removed ${selectedCardIds.length} card(s) from shuffled set`);
      },
    },
    {
      idSuffix: `avoid:${playerId}:shuffle`,
    },
  );
};

// Registers the shared Deliver gained-card redirect listener for one player.
const registerDeliverListener = (
  cardEffectArgs: CardEffectFunctionContext,
  event: NonNullable<ReturnType<typeof findEventInMatch<PlunderEventMetadata>>>,
): void => {
  const metadata = getPlunderMetadata({ event });
  if (!metadata) {
    return;
  }

  const playerId = cardEffectArgs.playerId;
  metadata.listenersByPlayerId![playerId] ??= {};
  if (metadata.listenersByPlayerId![playerId]!.deliver) {
    return;
  }

  metadata.listenersByPlayerId![playerId]!.deliver = true;
  cardEffectArgs.reactionManager.registerSystemTemplate(
    event,
    'cardGained',
    {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: false,
      condition: ({ trigger, match }) => {
        if (trigger.args.playerId !== playerId) {
          return false;
        }
        const activeTurnIndex = getPlunderMetadata({ event })?.deliverActiveTurnIndexByPlayerId?.[playerId];
        if (activeTurnIndex === undefined) {
          return false;
        }
        return getCurrentTurnHistoryIndex({ match }) === activeTurnIndex;
      },
      triggeredEffectFn: async triggeredArgs => {
        const currentMetadata = getPlunderMetadata({ event });
        if (!currentMetadata) {
          return;
        }

        const gainedCardId = triggeredArgs.trigger.args.cardId;
        if (
          !isCardStillAtGainedLocation(
            triggeredArgs.cardSourceController,
            gainedCardId,
            triggeredArgs.trigger.args.gainedLocation,
          )
        ) {
          triggeredArgs.loggerService.debug('[deliver effect] gained card moved before set-aside redirect');
          return;
        }

        await triggeredArgs.actionService.run('moveCard', {
          cardId: gainedCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          setAsideSource: {
            ownerPlayerId: playerId,
            sourceCardLikeId: event.id,
            sourceCardKey: event.cardKey,
          },
        });

        currentMetadata.deliverSetAsideByPlayerId![playerId] ??= [];
        currentMetadata.deliverSetAsideByPlayerId![playerId]!.push(gainedCardId);
        triggeredArgs.loggerService.debug(`[deliver effect] set aside gained card ${gainedCardId}`);
      },
    },
    {
      idSuffix: `deliver:${playerId}:cardGained`,
    },
  );

  cardEffectArgs.reactionManager.registerSystemTemplate(
    event,
    'endTurn',
    {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: false,
      condition: ({ trigger }) => trigger.args.playerId === playerId,
      triggeredEffectFn: async triggeredArgs => {
        const currentMetadata = getPlunderMetadata({ event });
        if (!currentMetadata) {
          return;
        }

        const setAsideCardIds = [...(currentMetadata.deliverSetAsideByPlayerId![playerId] ?? [])];
        if (!setAsideCardIds.length) {
          return;
        }

        for (const setAsideCardId of setAsideCardIds) {
          const setAsideSource = getPlayerSourceSafe(triggeredArgs, 'set-aside', playerId);
          if (!setAsideSource.includes(setAsideCardId)) {
            continue;
          }
          await triggeredArgs.actionService.run('moveCard', {
            cardId: setAsideCardId,
            toPlayerId: playerId,
            to: { location: 'playerHand' },
          });
        }

        currentMetadata.deliverSetAsideByPlayerId![playerId] = [];
        triggeredArgs.loggerService.debug(
          `[deliver effect] returned ${setAsideCardIds.length} set-aside card(s) to hand`,
        );
      },
    },
    {
      idSuffix: `deliver:${playerId}:endTurn`,
    },
  );
};

// Registers the shared Mirror listener that resolves the next gained Action this turn.
const registerMirrorListener = (
  cardEffectArgs: CardEffectFunctionContext,
  event: NonNullable<ReturnType<typeof findEventInMatch<PlunderEventMetadata>>>,
): void => {
  const metadata = getPlunderMetadata({ event });
  if (!metadata) {
    return;
  }

  const playerId = cardEffectArgs.playerId;
  metadata.listenersByPlayerId![playerId] ??= {};
  if (metadata.listenersByPlayerId![playerId]!.mirror) {
    return;
  }

  metadata.listenersByPlayerId![playerId]!.mirror = true;
  cardEffectArgs.reactionManager.registerSystemTemplate(
    event,
    'cardGained',
    {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: false,
      condition: ({ trigger }) => {
        if (trigger.args.playerId !== playerId) {
          return false;
        }
        const pendingCount = getPlunderMetadata({ event })?.mirrorPendingByPlayerId?.[playerId] ?? 0;
        if (pendingCount < 1) {
          return false;
        }
        const gainedCard = cardEffectArgs.cardLibrary.getCard(trigger.args.cardId);
        return gainedCard.type.includes('ACTION');
      },
      triggeredEffectFn: async triggeredArgs => {
        const currentMetadata = getPlunderMetadata({ event });
        if (!currentMetadata) {
          return;
        }

        const mirrorCount = currentMetadata.mirrorPendingByPlayerId![playerId] ?? 0;
        currentMetadata.mirrorPendingByPlayerId![playerId] = 0;
        if (mirrorCount < 1) {
          return;
        }

        const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
        const gainedPileKey = getCardPileKey(gainedCard) as CardKey;
        for (let gainIndex = 0; gainIndex < mirrorCount; gainIndex += 1) {
          const gainedCopyId = await triggeredArgs.supplyGainService.gainTopSupplyCardForPileKey({
            playerId,
            pileKey: gainedPileKey,
            to: { location: 'playerDiscard' },
            logTag: 'mirror effect',
          });

          if (gainedCopyId === undefined) {
            break;
          }
        }

        triggeredArgs.loggerService.debug(`[mirror effect] resolved ${mirrorCount} pending copy gain(s)`);
      },
    },
    {
      idSuffix: `mirror:${playerId}:cardGained`,
    },
  );
};

// Registers the shared Rush listener that plays the next gained Action this turn.
const registerRushListener = (
  cardEffectArgs: CardEffectFunctionContext,
  event: NonNullable<ReturnType<typeof findEventInMatch<PlunderEventMetadata>>>,
): void => {
  const metadata = getPlunderMetadata({ event });
  if (!metadata) {
    return;
  }

  const playerId = cardEffectArgs.playerId;
  metadata.listenersByPlayerId![playerId] ??= {};
  if (metadata.listenersByPlayerId![playerId]!.rush) {
    return;
  }

  metadata.listenersByPlayerId![playerId]!.rush = true;
  cardEffectArgs.reactionManager.registerSystemTemplate(
    event,
    'cardGained',
    {
      playerId,
      once: false,
      compulsory: true,
      allowMultipleInstances: false,
      condition: ({ trigger }) => {
        if (trigger.args.playerId !== playerId) {
          return false;
        }
        const isArmed = getPlunderMetadata({ event })?.rushPendingByPlayerId?.[playerId] === true;
        if (!isArmed) {
          return false;
        }
        const gainedCard = cardEffectArgs.cardLibrary.getCard(trigger.args.cardId);
        return gainedCard.type.includes('ACTION');
      },
      triggeredEffectFn: async triggeredArgs => {
        const currentMetadata = getPlunderMetadata({ event });
        if (!currentMetadata) {
          return;
        }

        currentMetadata.rushPendingByPlayerId![playerId] = false;
        const gainedCardId = triggeredArgs.trigger.args.cardId;
        if (
          !isCardStillAtGainedLocation(
            triggeredArgs.cardSourceController,
            gainedCardId,
            triggeredArgs.trigger.args.gainedLocation,
          )
        ) {
          triggeredArgs.loggerService.debug('[rush effect] gained Action moved before play resolution');
          return;
        }

        await triggeredArgs.actionService.run('playCard', {
          playerId,
          cardId: gainedCardId,
          overrides: { actionCost: 0 },
        });
        triggeredArgs.loggerService.debug(`[rush effect] played gained Action ${gainedCardId}`);
      },
    },
    {
      idSuffix: `rush:${playerId}:cardGained`,
    },
  );
};

const effectMap: CardExpansionModule = {
  avoid: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[avoid effect] event not found');
        return;
      }

      const metadata = getPlunderMetadata({ event });
      if (!metadata) {
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      registerPlunderEndTurnCleanup(cardEffectArgs, event);
      registerAvoidListener(cardEffectArgs, event);

      const playerId = cardEffectArgs.playerId;
      const pendingCount = metadata.avoidPendingByPlayerId![playerId] ?? 0;
      metadata.avoidPendingByPlayerId![playerId] = pendingCount + 3;
      cardEffectArgs.loggerService.debug(
        `[avoid effect] player ${playerId} pending retain count set to ${metadata.avoidPendingByPlayerId![playerId]}`,
      );
    },
  },
  bury: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      const discard = getPlayerSourceSafe(cardEffectArgs, 'playerDiscard', cardEffectArgs.playerId);
      if (!discard.length) {
        cardEffectArgs.loggerService.debug('[bury effect] no cards in discard to move');
        return;
      }

      const selectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put a card from your discard on the bottom of your deck',
        restrict: discard,
        count: 1,
      });
      if (!selectedCardId) {
        cardEffectArgs.loggerService.warn('[bury effect] no discard card selected');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: selectedCardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDeck', index: 0 },
      });
    },
  },
  deliver: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[deliver effect] event not found');
        return;
      }

      const metadata = getPlunderMetadata({ event });
      if (!metadata) {
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      registerPlunderEndTurnCleanup(cardEffectArgs, event);
      registerDeliverListener(cardEffectArgs, event);

      const playerId = cardEffectArgs.playerId;
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      metadata.deliverActiveTurnIndexByPlayerId![playerId] = turnHistoryIndex;
      metadata.deliverSetAsideByPlayerId![playerId] ??= [];
      cardEffectArgs.loggerService.debug(
        `[deliver effect] enabled for player ${playerId} on turn history index ${turnHistoryIndex}`,
      );
    },
  },
  foray: {
    registerEffects: () => async cardEffectArgs => {
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', cardEffectArgs.playerId);
      if (!hand.length) {
        cardEffectArgs.loggerService.debug('[foray effect] no cards in hand to discard');
        return;
      }

      const discardCount = Math.min(3, hand.length);
      const selectedCardIds = await cardEffectArgs.actionService.run('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard ${discardCount} card${discardCount === 1 ? '' : 's'}, revealing them`,
        restrict: hand,
        count: { kind: 'exact', count: discardCount },
      });

      if (!selectedCardIds.length) {
        cardEffectArgs.loggerService.warn('[foray effect] no cards selected to discard');
        return;
      }

      const revealedCardKeys = new Set<CardKey>();
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.actionService.run('revealCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
        });
        revealedCardKeys.add(cardEffectArgs.cardLibrary.getCard(selectedCardId).cardKey);
      }

      if (selectedCardIds.length === 3 && revealedCardKeys.size === 3) {
        await cardEffectArgs.actionService.run('gainLoot', { playerId: cardEffectArgs.playerId });
      }
    },
  },
  invasion: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;

      // Invasion first optionally plays an Attack from hand.
      const selectedAttackCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'You may play an Attack from your hand',
        // Canonical filter keeps play eligibility serializable for Shadow-aware selection handling.
        restrict: {
          all: [{ location: 'playerHand', playerId }, { cardType: ['ATTACK'] }],
        },
        selectionIntent: { kind: 'play-card', cardTypes: ['ACTION', 'NIGHT', 'TREASURE'] },
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });

      if (selectedAttackCardId) {
        await cardEffectArgs.actionService.run('playCard', {
          playerId,
          cardId: selectedAttackCardId,
          overrides: { actionCost: 0 },
        });
      }

      // Invasion then gains a Duchy.
      await cardEffectArgs.supplyGainService.gainTopSupplyCardForPileKey({
        playerId,
        pileKey: 'duchy',
        from: 'basicSupply',
        to: { location: 'playerDiscard' },
        logTag: 'invasion effect',
      });

      // Invasion then gains an Action card onto deck.
      const actionCardsInSupply = cardEffectArgs.findCardService.findCards({
        all: [{ location: ['basicSupply', 'kingdomSupply'] }, { cardType: ['ACTION'] }],
      });
      if (actionCardsInSupply.length) {
        const selectedActionCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Gain an Action onto your deck',
          restrict: actionCardsInSupply.map(card => card.id),
          count: 1,
        });

        if (selectedActionCardId) {
          await cardEffectArgs.actionService.run('gainCard', {
            playerId,
            cardId: selectedActionCardId,
            to: { location: 'playerDeck' },
          });
        }
      } else {
        cardEffectArgs.loggerService.debug('[invasion effect] no Action cards available to gain onto deck');
      }

      // Invasion then gains a Loot and plays it if still at the gained location.
      const gainedLootCardId = await cardEffectArgs.actionService.run('gainLoot', { playerId });
      if (!gainedLootCardId) {
        return;
      }

      let lootStillInDiscard = false;
      try {
        const source = cardEffectArgs.cardSourceController.findCardSource(gainedLootCardId);
        lootStillInDiscard = source.sourceKey === 'playerDiscard' && source.playerId === playerId;
      } catch {
        lootStillInDiscard = false;
      }

      if (!lootStillInDiscard) {
        cardEffectArgs.loggerService.debug('[invasion effect] gained Loot moved before play resolution');
        return;
      }

      await cardEffectArgs.actionService.run('playCard', {
        playerId,
        cardId: gainedLootCardId,
        overrides: { actionCost: 0 },
      });
    },
  },
  journey: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[journey effect] event not found');
        return;
      }

      const playerId = cardEffectArgs.playerId;
      const turnHistoryIndex = getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0;
      await cardEffectArgs.actionService.run('queueExtraTurn', {
        turn: {
          playerId,
          sourceId: event.id,
        },
      });

      // Journey suppresses discard-from-play in the current cleanup for the current player's cards.
      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        'startTurnPhase',
        {
          playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          autoResolve: true,
          condition: ({ trigger, match }) => {
            if (getTurnPhase(trigger.args.phaseIndex) !== 'cleanup') {
              return false;
            }

            return getCurrentTurnHistoryIndex({ match }) === turnHistoryIndex;
          },
          triggeredEffectFn: async triggeredArgs => {
            const cardsInPlay = triggeredArgs.findCardService
              .getCardsInPlay()
              .filter(
                card =>
                  card.owner === playerId && triggeredArgs.cardSourceController.getSource('playArea').includes(card.id),
              );

            if (!cardsInPlay.length) {
              return;
            }

            for (const cardInPlay of cardsInPlay) {
              const journeyProtectedCard = triggeredArgs.cardLibrary.getCard<BaseCardMetadata>(cardInPlay.id);
              journeyProtectedCard.metadata.base ??= {};
              journeyProtectedCard.metadata.base.skipDiscardFromPlayAtCleanupTurnHistoryIndex = turnHistoryIndex;
            }
            triggeredArgs.loggerService.debug(
              `[journey effect] marked ${cardsInPlay.length} card(s) to stay in play for this cleanup`,
            );
          },
        },
        {
          idSuffix: `journey:${playerId}:turn:${turnHistoryIndex}`,
        },
      );
    },
  },
  launch: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[launch effect] event not found');
        return;
      }

      // Launch is once per turn by adding a temporary buy restriction that clears at end of turn.
      const playerId = cardEffectArgs.playerId;
      const launchRestrictionRule: CardPriceRule = (card, context) => {
        if (card.id !== event.id || context.playerId !== playerId) {
          return { restricted: false, cost: card.cost };
        }
        return { restricted: true, cost: card.cost };
      };
      const launchRestrictionUnsub = cardEffectArgs.cardPriceController.registerRule(event, launchRestrictionRule);

      cardEffectArgs.reactionManager.registerSystemTemplate(
        event,
        'endTurn',
        {
          playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === playerId,
          triggeredEffectFn: async () => {
            launchRestrictionUnsub();
          },
        },
        {
          idSuffix: `launch:${playerId}:turn:${getCurrentTurnHistoryIndex({ match: cardEffectArgs.match }) ?? 0}`,
        },
      );

      await cardEffectArgs.actionService.run('setTurnPhase', {
        phase: 'action',
        playerId,
        endCurrentPhase: true,
        startNewPhase: true,
      });
      await cardEffectArgs.actionService.run('drawCard', { playerId, count: 1 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
    },
  },
  looting: {
    registerEffects: () => async cardEffectArgs => {
      await cardEffectArgs.actionService.run('gainLoot', { playerId: cardEffectArgs.playerId });
    },
  },
  maelstrom: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId);
      if (!hand.length) {
        cardEffectArgs.loggerService.debug('[maelstrom effect] no cards in hand to trash');
      } else {
        const trashCount = Math.min(3, hand.length);
        const selectedTrashCardIds = await cardEffectArgs.actionService.run('selectCard', {
          playerId,
          prompt: `Trash ${trashCount} card${trashCount === 1 ? '' : 's'} from your hand`,
          restrict: hand,
          count: { kind: 'exact', count: trashCount },
        });

        for (const selectedTrashCardId of selectedTrashCardIds) {
          await cardEffectArgs.actionService.run('trashCard', {
            playerId,
            cardId: selectedTrashCardId,
          });
        }
      }

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: playerId,
      });

      for (const targetPlayerId of targetPlayerIds) {
        const targetHand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', targetPlayerId);
        if (targetHand.length < 5) {
          continue;
        }

        const targetSelectedCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: targetPlayerId,
          prompt: 'Trash a card from your hand (Maelstrom)',
          restrict: targetHand,
          count: 1,
        });

        if (!targetSelectedCardId) {
          cardEffectArgs.loggerService.warn(`[maelstrom effect] player ${targetPlayerId} selected no card to trash`);
          continue;
        }

        await cardEffectArgs.actionService.run('trashCard', {
          playerId: targetPlayerId,
          cardId: targetSelectedCardId,
        });
      }
    },
  },
  mirror: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[mirror effect] event not found');
        return;
      }

      const metadata = getPlunderMetadata({ event });
      if (!metadata) {
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      registerPlunderEndTurnCleanup(cardEffectArgs, event);
      registerMirrorListener(cardEffectArgs, event);

      const playerId = cardEffectArgs.playerId;
      const pendingCount = metadata.mirrorPendingByPlayerId![playerId] ?? 0;
      metadata.mirrorPendingByPlayerId![playerId] = pendingCount + 1;
      cardEffectArgs.loggerService.debug(
        `[mirror effect] player ${playerId} pending copy count is now ${metadata.mirrorPendingByPlayerId![playerId]}`,
      );
    },
  },
  peril: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId);
      const actionCardIdsInHand = hand.filter(cardId => {
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        return card.type.includes('ACTION');
      });

      if (!actionCardIdsInHand.length) {
        cardEffectArgs.loggerService.debug('[peril effect] no Action cards in hand to trash');
        return;
      }

      const selectedActionCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'You may trash an Action from your hand to gain a Loot',
        restrict: actionCardIdsInHand,
        count: { kind: 'upTo', count: 1 },
        optional: true,
      });

      if (!selectedActionCardId) {
        return;
      }

      await cardEffectArgs.actionService.run('trashCard', {
        playerId,
        cardId: selectedActionCardId,
      });
      await cardEffectArgs.actionService.run('gainLoot', { playerId });
    },
  },
  prepare: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[prepare effect] event not found');
        return;
      }

      const playerId = cardEffectArgs.playerId;
      const hand = [...getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId)];
      if (!hand.length) {
        cardEffectArgs.loggerService.debug('[prepare effect] no cards in hand to set aside');
        return;
      }

      for (const handCardId of hand) {
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: handCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          setAsideSource: {
            ownerPlayerId: playerId,
            sourceCardLikeId: event.id,
            sourceCardKey: event.cardKey,
          },
        });
      }

      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'startTurn', {
        playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async triggeredArgs => {
          const stillSetAsideCardIds = hand.filter(cardId =>
            getPlayerSourceSafe(triggeredArgs, 'set-aside', playerId).includes(cardId),
          );
          if (!stillSetAsideCardIds.length) {
            return;
          }

          const actionOrTreasureCardIds = stillSetAsideCardIds.filter(cardId => {
            const card = triggeredArgs.cardLibrary.getCard(cardId);
            return card.type.includes('ACTION') || card.type.includes('TREASURE');
          });

          let orderedPlayableCardIds = [...actionOrTreasureCardIds];
          if (actionOrTreasureCardIds.length > 1) {
            const promptResult = await triggeredArgs.promptService.requestActionResult<CardId[]>({
              playerId,
              prompt: 'Order set-aside Actions and Treasures to play (Prepare)',
              actionButtons: [{ label: 'DONE', action: 1 }],
              content: {
                type: 'rearrange',
                cardIds: actionOrTreasureCardIds,
              },
            });

            if (promptResult?.result?.length === actionOrTreasureCardIds.length) {
              orderedPlayableCardIds = promptResult.result;
            }
          }

          for (const playableCardId of orderedPlayableCardIds) {
            const setAsideSource = getPlayerSourceSafe(triggeredArgs, 'set-aside', playerId);
            if (!setAsideSource.includes(playableCardId)) {
              continue;
            }

            await triggeredArgs.actionService.run('playCard', {
              playerId,
              cardId: playableCardId,
              overrides: { actionCost: 0 },
            });
          }

          for (const setAsideCardId of stillSetAsideCardIds) {
            const setAsideSource = getPlayerSourceSafe(triggeredArgs, 'set-aside', playerId);
            if (!setAsideSource.includes(setAsideCardId)) {
              continue;
            }
            await triggeredArgs.actionService.run('discardCard', {
              playerId,
              cardId: setAsideCardId,
            });
          }
        },
      });
    },
  },
  prosper: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      await cardEffectArgs.actionService.run('gainLoot', { playerId });

      const gainedTreasureCardKeys = new Set<CardKey>();
      while (true) {
        // Recompute from current top cards each loop so split-pile reveals are reflected.
        const supplyDefinitions = [
          ...cardEffectArgs.match.config.basicSupply,
          ...cardEffectArgs.match.config.kingdomSupply,
        ];
        const gainableTreasureCards = supplyDefinitions
          .map(supply => {
            const pileDefinitionCard = getPileDefinitionCard(supply.cards, supply.name);
            if (!pileDefinitionCard) {
              return undefined;
            }
            const pileKey = getCardPileKey(pileDefinitionCard) as CardKey;
            return cardEffectArgs.findCardService.findTopSupplyCardForPileKey({ pileKey });
          })
          .filter((card): card is NonNullable<typeof card> => !!card)
          .filter(card => card.type.includes('TREASURE') && !gainedTreasureCardKeys.has(card.cardKey));

        if (!gainableTreasureCards.length) {
          break;
        }

        const selectedTreasureCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'You may gain a differently named Treasure (Prosper)',
          restrict: gainableTreasureCards.map(card => card.id),
          count: { kind: 'upTo', count: 1 },
          optional: true,
        });

        if (!selectedTreasureCardId) {
          break;
        }

        const selectedTreasureCard = cardEffectArgs.cardLibrary.getCard(selectedTreasureCardId);
        await cardEffectArgs.actionService.run('gainCard', {
          playerId,
          cardId: selectedTreasureCardId,
          to: { location: 'playerDiscard' },
        });
        gainedTreasureCardKeys.add(selectedTreasureCard.cardKey);
      }
    },
  },
  rush: {
    registerEffects: () => async cardEffectArgs => {
      const event = findEventInMatch<PlunderEventMetadata>(cardEffectArgs.match, cardEffectArgs.cardId);
      if (!event) {
        cardEffectArgs.loggerService.warn('[rush effect] event not found');
        return;
      }

      const metadata = getPlunderMetadata({ event });
      if (!metadata) {
        return;
      }

      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });
      registerPlunderEndTurnCleanup(cardEffectArgs, event);
      registerRushListener(cardEffectArgs, event);

      metadata.rushPendingByPlayerId![cardEffectArgs.playerId] = true;
      cardEffectArgs.loggerService.debug(`[rush effect] armed for player ${cardEffectArgs.playerId}`);
    },
  },
  scrounge: {
    registerEffects: () => async cardEffectArgs => {
      const playerId = cardEffectArgs.playerId;
      const choseTrash = await cardEffectArgs.promptService.confirm(
        {
          playerId,
          prompt: 'Choose one',
          actionButtons: [
            { label: 'TRASH A CARD', action: 1 },
            { label: 'GAIN ESTATE FROM TRASH', action: 2 },
          ],
        },
        1,
      );

      if (choseTrash) {
        const hand = getPlayerSourceSafe(cardEffectArgs, 'playerHand', playerId);
        if (!hand.length) {
          return;
        }

        const selectedTrashCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Trash a card from your hand',
          restrict: hand,
          count: 1,
        });

        if (!selectedTrashCardId) {
          cardEffectArgs.loggerService.warn('[scrounge effect] trash branch selected but no card was trashed');
          return;
        }

        await cardEffectArgs.actionService.run('trashCard', {
          playerId,
          cardId: selectedTrashCardId,
        });
        return;
      }

      const estateCardsInTrash = cardEffectArgs.findCardService.findCards({
        all: [{ location: 'trash' }, { cardKeys: 'estate' }],
      });

      const estateCardFromTrash = estateCardsInTrash.slice(-1)[0];
      if (!estateCardFromTrash) {
        cardEffectArgs.loggerService.debug('[scrounge effect] no Estate in trash to gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId,
        cardId: estateCardFromTrash.id,
        to: { location: 'playerDiscard' },
      });

      const gainableCards = cardEffectArgs.findCardService.findCards({
        all: [{ location: ['basicSupply', 'kingdomSupply'] }, { kind: 'upTo', playerId, amount: { treasure: 5 } }],
      });

      if (!gainableCards.length) {
        return;
      }

      const selectedGainCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Gain a card costing up to $5',
        restrict: gainableCards.map(card => card.id),
        count: 1,
      });

      if (!selectedGainCardId) {
        cardEffectArgs.loggerService.warn('[scrounge effect] no card selected to gain after Estate gain');
        return;
      }

      await cardEffectArgs.actionService.run('gainCard', {
        playerId,
        cardId: selectedGainCardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
};

export default effectMap;
