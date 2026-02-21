import { CardId, CardKey, CardLocation, PlayerId, TokenInstanceId } from 'shared/types/index.ts';
import { CardExpansionModule } from '@server-types/index.ts';
import { baseV2TokenIds } from '@expansions/base-v2/token-ids-base-v2.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { isPlayerImmune } from '../../utils/reaction-immunity.ts';

const AUGURS_PILE_KEY: CardKey = 'augurs';
const FORTS_PILE_KEY: CardKey = 'forts';

// Gains the current top card of a supply pile to discard.
const gainTopSupplyCardToDiscard = async (args: {
  playerId: PlayerId;
  pileKey: CardKey;
  logTag: string;
  supplyGainService: {
    gainTopSupplyCardForPileKey: (gainArgs: {
      playerId: PlayerId;
      pileKey: CardKey;
      to: { location: 'playerDiscard' };
      logTag?: string;
    }) => Promise<CardId | undefined>;
  };
}) => {
  await args.supplyGainService.gainTopSupplyCardForPileKey({
    playerId: args.playerId,
    pileKey: args.pileKey,
    to: { location: 'playerDiscard' },
    logTag: args.logTag,
  });
};

// Gets the count of how many times this card key has been played this turn.
const getPlayInstanceForCardKeyThisTurn = (args: {
  cardKey: CardKey;
  match: {
    stats: {
      turns: unknown[];
      playedCardsByTurn: Record<number, CardId[] | undefined>;
    };
  };
  cardLibrary: {
    getCard: (cardId: CardId) => { cardKey: CardKey };
  };
}): number => {
  const currentTurnHistoryIndex = args.match.stats.turns.length - 1;
  const playedCardIdsThisTurn = args.match.stats.playedCardsByTurn[currentTurnHistoryIndex] ?? [];
  return playedCardIdsThisTurn
    .map((playedCardId) => args.cardLibrary.getCard(playedCardId))
    .filter((playedCard) => playedCard.cardKey === args.cardKey)
    .length;
};

// Returns true when the card currently occupies an in-play zone.
const isCardStillInPlay = (args: {
  cardId: CardId;
  cardSourceController: {
    findCardSource: (cardId: CardId) => { sourceKey: CardLocation };
  };
}): boolean => {
  try {
    const sourceKey = args.cardSourceController.findCardSource(args.cardId).sourceKey;
    return isLocationInPlay(sourceKey);
  } catch {
    return false;
  }
};

// Finds generic coin token instances currently on a specific card.
const getCoinTokenInstanceIdsOnCard = (args: {
  match: {
    tokens?: Record<string, {
      tokenId: string;
      location: { type: string; cardId?: CardId };
    }>;
  };
  cardId: CardId;
}): TokenInstanceId[] => {
  return Object.entries(args.match.tokens ?? {})
    .filter(([_tokenInstanceId, token]) =>
      token.tokenId === baseV2TokenIds.coin &&
      token.location.type === 'card' &&
      token.location.cardId === args.cardId
    )
    .map(([tokenInstanceId]) => tokenInstanceId)
    .sort((left, right) => left.localeCompare(right));
};

const cardEffects: CardExpansionModule = {
  'herb-gatherer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[herb-gatherer effect] gaining 1 buy');
      await cardEffectArgs.actionService.run('gainBuy', { count: 1 });

      // Move the full deck to discard in current top-to-bottom order.
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', playerId);
      if (deck.length > 0) {
        loggerService.debug(`[herb-gatherer effect] moving ${deck.length} card(s) from deck to discard`);
        for (const deckCardId of [...deck]) {
          await cardEffectArgs.actionService.run('moveCard', {
            cardId: deckCardId,
            toPlayerId: playerId,
            to: { location: 'playerDiscard' },
          });
        }
      }

      // Optional Treasure play from discard.
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', playerId);
      const discardTreasureIds = discard.filter((cardId) =>
        cardEffectArgs.cardLibrary.getCard(cardId).type.includes('TREASURE')
      );
      if (discardTreasureIds.length > 0) {
        const selectedTreasureId = await cardEffectArgs.promptService.selectSingleCardFromPrompt({
          playerId,
          prompt: 'You may play a Treasure from your discard',
          content: {
            type: 'select',
            cardIds: discardTreasureIds,
          },
          actionButtons: [
            { label: 'CANCEL', action: 0 },
            { label: 'PLAY TREASURE', action: 1 },
          ],
          validationAction: 1,
        });

        if (selectedTreasureId) {
          loggerService.debug(`[herb-gatherer effect] playing discard treasure ${selectedTreasureId}`);
          await cardEffectArgs.actionService.run('playCard', {
            playerId,
            cardId: selectedTreasureId,
            overrides: { actionCost: 0 },
          });
        } else {
          loggerService.debug('[herb-gatherer effect] no Treasure selected from discard');
        }
      } else {
        loggerService.debug('[herb-gatherer effect] no Treasure cards in discard to play');
      }

      // Optional split-pile rotation for the Augurs pile.
      const rotatePrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Rotate the Augurs?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'ROTATE', action: 2 },
        ],
      }) as { action: number; result: number[] } | null;

      if (rotatePrompt?.action === 2) {
        loggerService.debug('[herb-gatherer effect] rotating Augurs split pile');
        await cardEffectArgs.actionService.run('rotateSplitPile', {
          pileKey: AUGURS_PILE_KEY,
        });
      }
    },
  },
  'acolyte': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      // Optional trash of an Action/Victory card from hand to gain a Gold.
      const trashableActionOrVictory = cardEffectArgs.findCardService.findCards([
        { location: 'playerHand', playerId },
        { cardType: ['ACTION', 'VICTORY'] },
      ]);
      if (trashableActionOrVictory.length > 0) {
        const selectedTrashId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'You may trash an Action or Victory card to gain a Gold',
          restrict: trashableActionOrVictory.map((card) => card.id),
          count: { kind: 'upTo', count: 1 },
          optional: true,
        });

        if (selectedTrashId) {
          loggerService.debug(`[acolyte effect] trashing ${selectedTrashId} to gain Gold`);
          await cardEffectArgs.actionService.run('trashCard', {
            playerId,
            cardId: selectedTrashId,
          });
          await gainTopSupplyCardToDiscard({
            playerId,
            pileKey: 'gold',
            logTag: 'acolyte gain gold',
            supplyGainService: cardEffectArgs.supplyGainService,
          });
        }
      } else {
        loggerService.debug('[acolyte effect] no Action/Victory card in hand to trash for Gold');
      }

      // Optional self-trash to gain the current top Augur.
      const trashSelfPrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Trash this to gain an Augur?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'TRASH THIS', action: 2 },
        ],
      }) as { action: number; result: number[] } | null;

      if (trashSelfPrompt?.action !== 2) {
        return;
      }

      loggerService.debug('[acolyte effect] trashing self to gain top Augur');
      await cardEffectArgs.actionService.run('trashCard', {
        playerId,
        cardId: cardEffectArgs.cardId,
      });
      await gainTopSupplyCardToDiscard({
        playerId,
        pileKey: AUGURS_PILE_KEY,
        logTag: 'acolyte gain augur',
        supplyGainService: cardEffectArgs.supplyGainService,
      });
    },
  },
  'sorceress': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[sorceress effect] gaining 1 action');
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const namedCardPrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Name a card',
        content: { type: 'name-card' },
      }) as { action: number; result: CardKey } | null;
      const namedCardKey = namedCardPrompt?.result;

      loggerService.debug(`[sorceress effect] named card '${namedCardKey ?? '<none>'}'`);

      // Reveal top card of deck (with shuffle fallback) and move it to hand.
      const revealedCardId = await cardEffectArgs.actionService.run('revealCard', {
        playerId,
        source: 'playerDeck',
      });
      if (!revealedCardId) {
        loggerService.debug('[sorceress effect] no card revealed from deck');
        return;
      }

      const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
      await cardEffectArgs.actionService.run('moveCard', {
        cardId: revealedCardId,
        toPlayerId: playerId,
        to: { location: 'playerHand' },
      });

      if (!namedCardKey || revealedCard.cardKey !== namedCardKey) {
        loggerService.debug('[sorceress effect] revealed card did not match named card; no curses gained');
        return;
      }

      // Matching guess: each other non-immune player gains a Curse.
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: playerId,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        await gainTopSupplyCardToDiscard({
          playerId: targetPlayerId,
          pileKey: 'curse',
          logTag: 'sorceress attack',
          supplyGainService: cardEffectArgs.supplyGainService,
        });
      }
    },
  },
  'sibyl': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[sibyl effect] drawing 4 cards and gaining 1 action');
      await cardEffectArgs.actionService.run('drawCard', { playerId, count: 4 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const handAfterDraw = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
      if (handAfterDraw.length < 1) {
        loggerService.debug('[sibyl effect] no cards in hand to place on deck');
        return;
      }

      const topDeckCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Put a card from your hand on top of your deck',
        restrict: handAfterDraw,
        count: 1,
      });
      if (!topDeckCardId) {
        loggerService.warn('[sibyl effect] no card selected for top-deck placement');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: topDeckCardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck' },
      });

      const handAfterTopDeck = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
      if (handAfterTopDeck.length < 1) {
        loggerService.debug('[sibyl effect] no second card available for bottom-deck placement');
        return;
      }

      const bottomDeckCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId,
        prompt: 'Put another card from your hand on the bottom of your deck',
        restrict: handAfterTopDeck,
        count: 1,
      });
      if (!bottomDeckCardId) {
        loggerService.warn('[sibyl effect] no card selected for bottom-deck placement');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId: bottomDeckCardId,
        toPlayerId: playerId,
        to: { location: 'playerDeck', index: 0 },
      });
    },
  },
  'tent': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        if (!isLocationInPlay(eventArgs.previousLocation?.location)) {
          loggerService.debug('[tent onDiscarded effect] not discarded from play, skipping top-deck option');
          return;
        }

        const prompt = await cardEffectArgs.actionService.run('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Put this onto your deck?',
          actionButtons: [
            { label: 'NO', action: 1 },
            { label: 'YES', action: 2 },
          ],
        }) as { action?: number } | null;

        if (prompt?.action !== 2) {
          loggerService.debug('[tent onDiscarded effect] player declined to top-deck Tent');
          return;
        }

        loggerService.debug('[tent onDiscarded effect] moving Tent from discard to deck');
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'playerDeck' },
        });
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;

      loggerService.debug('[tent effect] gaining 2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Tent optionally rotates the Forts split pile.
      const rotatePrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Rotate the Forts?',
        actionButtons: [
          { label: 'NO', action: 1 },
          { label: 'ROTATE', action: 2 },
        ],
      }) as { action?: number } | null;

      if (rotatePrompt?.action !== 2) {
        loggerService.debug('[tent effect] player declined to rotate Forts');
        return;
      }

      loggerService.debug('[tent effect] rotating Forts split pile');
      await cardEffectArgs.actionService.run('rotateSplitPile', {
        pileKey: FORTS_PILE_KEY,
      });
    },
  },
  'garrison': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        const garrisonTokenIds = getCoinTokenInstanceIdsOnCard({
          match: cardEffectArgs.match,
          cardId: eventArgs.cardId,
        });

        if (garrisonTokenIds.length < 1) {
          loggerService.debug('[garrison onLeavePlay effect] no coin tokens on Garrison to remove');
          return;
        }

        loggerService.debug(`[garrison onLeavePlay effect] removing ${garrisonTokenIds.length} coin token(s)`);
        for (const tokenInstanceId of garrisonTokenIds) {
          await cardEffectArgs.actionService.run('removeToken', { tokenInstanceId });
        }
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;
      const garrisonCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const playInstance = getPlayInstanceForCardKeyThisTurn({
        cardKey: garrisonCard.cardKey,
        match: cardEffectArgs.match,
        cardLibrary: cardEffectArgs.cardLibrary,
      });
      let durationRegistered = false;
      let durationTriggerIds: string[] = [];

      loggerService.debug('[garrison effect] gaining 2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      // Track gains for this specific Garrison play instance.
      const cardGainedTriggerId = `garrison:${garrisonCard.id}:cardGained:${playInstance}`;
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: cardGainedTriggerId,
        listeningFor: 'cardGained',
        playerId,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== playerId) {
            return false;
          }

          // Limit tracking to this turn only and only while this card is in play.
          const gainedCardStats = conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId];
          const currentTurnHistoryIndex = conditionArgs.match.stats.turns.length - 1;
          if (gainedCardStats?.turnHistoryIndex !== currentTurnHistoryIndex) {
            return false;
          }

          return isCardStillInPlay({
            cardId: garrisonCard.id,
            cardSourceController: conditionArgs.cardSourceController,
          });
        },
        triggeredEffectFn: async () => {
          await cardEffectArgs.actionService.run('placeToken', {
            tokenId: baseV2TokenIds.coin,
            ownerId: playerId,
            location: { type: 'card', cardId: garrisonCard.id },
            sourceCardId: garrisonCard.id,
          }, {
            loggingContext: { source: garrisonCard.id },
          });
          const garrisonTokenCount = getCoinTokenInstanceIdsOnCard({
            match: cardEffectArgs.match,
            cardId: garrisonCard.id,
          }).length;

          loggerService.debug(
            `[garrison cardGained effect] garrison ${garrisonCard.id} now has ${garrisonTokenCount} token(s)`,
          );
          if (durationRegistered) {
            return;
          }

          durationRegistered = true;
          // Register duration handling only when the first token is gained.
          durationTriggerIds = cardEffectArgs.registerDurationEffect(garrisonCard, {
            id: `garrison:${garrisonCard.id}:startTurn:${playInstance}`,
            listeningFor: 'startTurn',
            playerId,
            once: true,
            compulsory: true,
            system: true,
            allowMultipleInstances: true,
            condition: (conditionArgs) => conditionArgs.trigger.args.playerId === playerId,
            triggeredEffectFn: async (triggeredArgs) => {
              const tokenInstanceIds = getCoinTokenInstanceIdsOnCard({
                match: triggeredArgs.match,
                cardId: garrisonCard.id,
              });
              const drawCount = tokenInstanceIds.length;

              loggerService.debug(
                `[garrison startTurn effect] removing ${drawCount} token(s) for +${drawCount} Card(s)`,
              );
              await triggeredArgs.actionService.run('moveCard', {
                cardId: garrisonCard.id,
                to: { location: 'playArea' },
              });

              for (const tokenInstanceId of tokenInstanceIds) {
                await triggeredArgs.actionService.run('removeToken', { tokenInstanceId }, {
                  loggingContext: { source: garrisonCard.id },
                });
              }

              if (drawCount < 1) {
                return;
              }

              await triggeredArgs.actionService.run('drawCard', {
                playerId,
                count: drawCount,
              });
            },
          });
          loggerService.debug('[garrison cardGained effect] registered deferred duration effect');
        },
      });

      // Always remove this-turn gain tracking at end turn.
      const endTurnTriggerId = cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `garrison:${garrisonCard.id}:endTurn:${playInstance}`,
        listeningFor: 'endTurn',
        playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.reactionManager.unregisterTrigger(cardGainedTriggerId);
          const garrisonTokenCount = getCoinTokenInstanceIdsOnCard({
            match: triggeredArgs.match,
            cardId: garrisonCard.id,
          }).length;

          if (garrisonTokenCount > 0) {
            loggerService.debug(
              `[garrison endTurn effect] preserving duration triggers for ${garrisonTokenCount} token(s)`,
            );
            return;
          }

          // No tokens means there should be no deferred duration effect to keep.
          loggerService.debug('[garrison endTurn effect] no coin tokens on Garrison, clearing deferred duration triggers');
          for (const triggerId of durationTriggerIds) {
            triggeredArgs.reactionManager.unregisterTrigger(triggerId);
          }
        },
      });

      // Tie Garrison's always-on this-turn tracking triggers to leave-play cleanup.
      cardEffectArgs.reactionManager.registerDurationTriggers(garrisonCard.id, [
        cardGainedTriggerId,
        endTurnTriggerId,
      ]);
    },
  },
  'hill-fort': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      // Resolve the gain first, then resolve the choice.
      const gainableCards = cardEffectArgs.findCardService.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId, kind: 'upTo', amount: { treasure: 4 } },
      ]);
      let gainedCardId: CardId | undefined;
      let gainedCardLocation: { sourceKey: CardLocation; playerId?: PlayerId } | undefined;

      if (gainableCards.length > 0) {
        const selectedGainId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId,
          prompt: 'Gain a card costing up to $4',
          restrict: gainableCards.map((card) => card.id),
          count: 1,
        }) as CardId | null;

        if (selectedGainId) {
          loggerService.debug(`[hill-fort effect] gaining ${cardEffectArgs.cardLibrary.getCard(selectedGainId)}`);
          gainedCardId = selectedGainId;
          await cardEffectArgs.actionService.run('gainCard', {
            playerId,
            cardId: selectedGainId,
            to: { location: 'playerDiscard' },
          });

          // Record where the card ended up after all gain reactions resolve.
          try {
            gainedCardLocation = cardEffectArgs.cardSourceController.findCardSource(selectedGainId);
          } catch {
            gainedCardLocation = undefined;
          }
        } else {
          loggerService.warn('[hill-fort effect] no card selected to gain');
        }
      } else {
        loggerService.debug('[hill-fort effect] no gainable cards in supply costing up to 4');
      }

      const choicePrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: 'PUT IT INTO HAND', action: 1 },
          { label: '+1 CARD AND +1 ACTION', action: 2 },
        ],
      }) as { action?: number } | null;

      if (choicePrompt?.action === 1) {
        if (!gainedCardId) {
          loggerService.debug('[hill-fort effect] no gained card available to move to hand');
          return;
        }
        if (!gainedCardLocation) {
          loggerService.debug('[hill-fort effect] gained card location is unknown, cannot move to hand');
          return;
        }

        let gainedCardSource: { sourceKey: CardLocation; playerId?: PlayerId };
        try {
          gainedCardSource = cardEffectArgs.cardSourceController.findCardSource(gainedCardId);
        } catch {
          loggerService.debug('[hill-fort effect] gained card no longer found in any source');
          return;
        }

        if (
          gainedCardSource.sourceKey !== gainedCardLocation.sourceKey ||
          gainedCardSource.playerId !== gainedCardLocation.playerId
        ) {
          loggerService.debug('[hill-fort effect] gained card is no longer where it was gained to, cannot move to hand');
          return;
        }

        loggerService.debug('[hill-fort effect] moving gained card to hand');
        await cardEffectArgs.actionService.run('moveCard', {
          cardId: gainedCardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
        });
        return;
      }

      if (choicePrompt?.action === 2) {
        loggerService.debug('[hill-fort effect] resolving +1 Card and +1 Action branch');
        await cardEffectArgs.actionService.run('drawCard', {
          playerId,
          count: 1,
        });
        await cardEffectArgs.actionService.run('gainAction', { count: 1 });
        return;
      }

      loggerService.warn('[hill-fort effect] no valid branch selected');
    },
  },
  'stronghold': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;
      const strongholdCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const playInstance = getPlayInstanceForCardKeyThisTurn({
        cardKey: strongholdCard.cardKey,
        match: cardEffectArgs.match,
        cardLibrary: cardEffectArgs.cardLibrary,
      });

      const choicePrompt = await cardEffectArgs.actionService.run('userPrompt', {
        playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: '+$3', action: 1 },
          { label: 'NEXT TURN +3 CARDS', action: 2 },
        ],
      }) as { action?: number } | null;

      if (choicePrompt?.action === 1) {
        loggerService.debug('[stronghold effect] resolving +3 treasure branch');
        await cardEffectArgs.actionService.run('gainTreasure', { count: 3 });
        return;
      }

      if (choicePrompt?.action !== 2) {
        loggerService.warn('[stronghold effect] no valid branch selected');
        return;
      }

      loggerService.debug('[stronghold effect] registering next-turn +3 cards duration branch');
      cardEffectArgs.registerDurationEffect(strongholdCard, {
        id: `stronghold:${strongholdCard.id}:startTurn:${playInstance}`,
        playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        system: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: strongholdCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.actionService.run('drawCard', { playerId, count: 3 });
        },
      });
    },
  },
  'battle-plan': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[battle-plan effect] gaining 1 card and 1 action');
      await cardEffectArgs.actionService.run('drawCard', { playerId, count: 1 });
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      // Optional reveal of an Attack card from hand for +1 Card.
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
      const attackCardIds = hand.filter((cardId) => cardEffectArgs.cardLibrary.getCard(cardId).type.includes('ATTACK'));
      if (attackCardIds.length > 0) {
        const revealedAttackCardId = await cardEffectArgs.promptService.selectSingleCardFromPrompt({
          playerId,
          prompt: 'You may reveal an Attack card from your hand for +1 Card',
          content: {
            type: 'select',
            cardIds: attackCardIds,
          },
          actionButtons: [
            { label: 'CANCEL', action: 0 },
            { label: 'REVEAL', action: 1 },
          ],
          validationAction: 1,
        });

        if (revealedAttackCardId) {
          loggerService.debug(`[battle-plan effect] revealing Attack card ${revealedAttackCardId} for +1 Card`);
          await cardEffectArgs.actionService.run('revealCard', {
            playerId,
            cardId: revealedAttackCardId,
          });
          await cardEffectArgs.actionService.run('drawCard', { playerId, count: 1 });
        } else {
          loggerService.debug('[battle-plan effect] no Attack card revealed');
        }
      } else {
        loggerService.debug('[battle-plan effect] no Attack cards in hand to reveal');
      }

      // Optional rotation of any pile currently in Supply.
      const supplyPileKeys = [...new Set(
        cardEffectArgs.findCardService.findCards({ location: ['basicSupply', 'kingdomSupply'] })
          .map((card) => getCardPileKey(card))
          .filter((pileKey) => pileKey.length > 0),
      )].sort((left, right) => left.localeCompare(right));

      if (supplyPileKeys.length < 1) {
        loggerService.debug('[battle-plan effect] no Supply piles available to rotate');
        return;
      }

      const selectedPileKeys = await cardEffectArgs.promptService.request<CardKey[]>({
        playerId,
        prompt: 'You may rotate a Supply pile',
        content: {
          type: 'select-pile',
          pileNames: supplyPileKeys,
          selectCount: { kind: 'upTo', count: 1 },
          optional: true,
        },
      }) ?? [];

      const selectedPileKey = selectedPileKeys[0];
      if (!selectedPileKey) {
        loggerService.debug('[battle-plan effect] no pile selected to rotate');
        return;
      }

      loggerService.debug(`[battle-plan effect] rotating pile ${selectedPileKey}`);
      await cardEffectArgs.actionService.run('rotateSplitPile', {
        pileKey: selectedPileKey,
      });
    },
  },
  'archer': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;

      loggerService.debug('[archer effect] gaining 2 treasure');
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: playerId,
      }).filter((targetPlayerId) => !isPlayerImmune(cardEffectArgs.reactionContext, targetPlayerId));

      for (const targetPlayerId of targetPlayerIds) {
        const targetHand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        if (targetHand.length < 5) {
          loggerService.debug(`[archer effect] player ${targetPlayerId} has fewer than 5 cards, skipping`);
          continue;
        }

        // Target chooses one card to keep secret.
        const keptCardId = await cardEffectArgs.actionService.run('selectSingleCard', {
          playerId: targetPlayerId,
          prompt: 'Choose a card to keep hidden',
          restrict: targetHand,
          count: 1,
        }) ?? targetHand[0];

        // Reveal all remaining cards.
        const revealedCardIds = targetHand.filter((cardId) => cardId !== keptCardId);
        for (const revealedCardId of revealedCardIds) {
          await cardEffectArgs.actionService.run('revealCard', {
            playerId: targetPlayerId,
            cardId: revealedCardId,
          });
        }

        if (revealedCardIds.length < 1) {
          loggerService.debug(`[archer effect] player ${targetPlayerId} revealed no cards to discard`);
          continue;
        }

        // Attacker chooses one revealed card for the target to discard.
        const selectedDiscardId = revealedCardIds.length === 1
          ? revealedCardIds[0]
          : await cardEffectArgs.promptService.selectSingleCardFromPrompt({
            playerId,
            prompt: `Choose a revealed card for player ${targetPlayerId} to discard`,
            content: {
              type: 'select',
              cardIds: revealedCardIds,
            },
          }) ?? revealedCardIds[0];

        loggerService.debug(`[archer effect] player ${targetPlayerId} discarding card ${selectedDiscardId}`);
        await cardEffectArgs.actionService.run('discardCard', {
          playerId: targetPlayerId,
          cardId: selectedDiscardId,
        });
      }
    },
  },
  'warlord': {
    registerEffects: () => async (cardEffectArgs) => {
      const loggerService = cardEffectArgs.loggerService;
      const playerId = cardEffectArgs.playerId;
      const warlordCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      loggerService.debug('[warlord effect] gaining 1 action');
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const unregisterPlayRestriction = cardEffectArgs.playRulesController.registerRule((card, context) => {
        if (context.playerId === playerId) {
          return { canPlay: true };
        }
        if (context.sourceLocation !== 'playerHand' || context.sourcePlayerId !== context.playerId) {
          return { canPlay: true };
        }
        // Warlord only restricts Action cards played from hand.
        if (!card.type.includes('ACTION')) {
          return { canPlay: true };
        }

        let inPlayCardIds: CardId[] = [];
        try {
          inPlayCardIds = [
            ...cardEffectArgs.cardSourceController.getSource('playArea', context.playerId),
            ...cardEffectArgs.cardSourceController.getSource('activeDuration', context.playerId),
          ];
        } catch {
          return { canPlay: true };
        }

        const matchingActionCardsInPlay = inPlayCardIds
          .map((cardId) => cardEffectArgs.cardLibrary.getCard(cardId))
          .filter((inPlayCard) => inPlayCard.cardKey === card.cardKey && inPlayCard.type.includes('ACTION')).length;

        if (matchingActionCardsInPlay < 2) {
          return { canPlay: true };
        }

        return {
          canPlay: false,
          reasons: ['Blocked by Warlord: cannot play an Action card when two matching copies are in play.'],
        };
      });
      loggerService.debug('[warlord effect] registered temporary Action play restriction for other players');

      // At the start of your next turn, draw 2 cards.
      cardEffectArgs.registerDurationEffect(warlordCard, {
        id: `warlord:${cardEffectArgs.cardId}:startTurn`,
        playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        system: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          unregisterPlayRestriction();
          loggerService.debug('[warlord effect] removed temporary Action play restriction');
          await triggeredArgs.actionService.run('moveCard', {
            cardId: warlordCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.actionService.run('drawCard', { playerId, count: 2 });
        },
      });
    },
  },
  'territory': {
    registerScoringFunction: () => (cardEffectArgs) => {
      const victoryCardKeys = new Set(
        cardEffectArgs.findCardService.findCards([
          { owner: cardEffectArgs.ownerId },
          { cardType: ['VICTORY'] },
        ]).map((card) => card.cardKey),
      );
      cardEffectArgs.loggerService.debug(
        `[territory scoring] player ${cardEffectArgs.ownerId} has ${victoryCardKeys.size} differently named Victory cards`,
      );
      return victoryCardKeys.size;
    },
    registerLifeCycleMethods: () => ({
      onGained: async (cardEffectArgs, eventArgs) => {
        const loggerService = cardEffectArgs.loggerService;
        const totalSupplyPiles = cardEffectArgs.match.config.basicSupply.length + cardEffectArgs.match.config.kingdomSupply.length;
        const emptySupplyPileCount = Math.max(0, totalSupplyPiles - cardEffectArgs.findCardService.getRemainingSupplyCount());
        loggerService.debug(
          `[territory onGained effect] ${emptySupplyPileCount} empty Supply pile(s); gaining that many Golds`,
        );

        for (let i = 0; i < emptySupplyPileCount; i++) {
          await gainTopSupplyCardToDiscard({
            playerId: eventArgs.playerId,
            pileKey: 'gold',
            logTag: 'territory onGained gain gold',
            supplyGainService: cardEffectArgs.supplyGainService,
          });
        }
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      cardEffectArgs.loggerService.debug('[territory effect] no on-play effect');
    },
  },
};

export default cardEffects;
