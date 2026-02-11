import {CardEffectFunctionContext, CardExpansionModule} from '../../types.ts';
import {CardId, CardKey, CardLocation, PlayerId,} from 'shared/shared-types';
import {compareCardCosts} from 'shared/compare-card-cost.ts';
import {findOrderedTargets} from '../../utils/find-ordered-targets.ts';
import {discardDownTo} from '../../utils/discard-down-to.ts';
import {getCardsInPlay} from '../../utils/get-cards-in-play.ts';
import {getCurrentPlayer} from '../../utils/get-current-player.ts';
import {getTurnPhase} from '../../utils/get-turn-phase.ts';
import {isPlayerImmune} from '../../utils/reaction-immunity.ts';
import {getPileDefinitionCard} from '../../utils/get-pile-definition-card.ts';
import {prosperityTokenIds} from '../prosperity/token-prosperity-ids.ts';
import {FortuneMetadata} from '../prosperity/types.ts';
import {getPlayerStartingFrom} from 'shared/get-player-position-utils.ts';

type ArchiveEffectContext = Pick<
  CardEffectFunctionContext,
  'runGameActionDelegate' | 'cardLibrary' | 'cardSourceController'
>;

type GainTopSupplyContext = Pick<
  CardEffectFunctionContext,
  'findCards' | 'runGameActionDelegate'
>;

// Count the number of Castle cards owned by a player for variable scoring.
const countOwnedCastles = (
  args: {
    cardLibrary: CardEffectFunctionContext['cardLibrary'];
    ownerId: PlayerId;
  },
) => {
  const ownedCards = args.cardLibrary.getCardsByOwner(args.ownerId);
  return ownedCards.filter((card) => card.type.includes('CASTLE')).length;
};

// Resolve the top Castle card ID from the Castle split pile in the kingdom supply.
const getTopCastleCardId = (
  findCards: CardEffectFunctionContext['findCards'],
) => {
  const castleCards = findCards([{location: 'kingdomSupply'}, {
    cardType: ['CASTLE'],
  }]);
  return castleCards.slice(-1)[0]?.id;
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
  const supplyCards = context.findCards([{location: args.location}, {
    cardKeys: [args.cardKey],
  }]);
  const topCardId = supplyCards.slice(-1)[0]?.id;
  if (!topCardId) {
    console.debug(
      `[${args.logTag}] no ${args.cardKey} remaining in ${args.location}`,
    );
    return;
  }
  console.debug(
    `[${args.logTag}] gaining ${args.cardKey} to ${args.to.location}`,
  );
  await context.runGameActionDelegate('gainCard', {
    playerId: args.playerId,
    cardId: topCardId,
    to: args.to,
  });
};

// Gain the current top Castle card to the player's discard pile.
const gainTopCastleCard = async (
  context: GainTopSupplyContext,
  playerId: PlayerId,
) => {
  const topCastleCardId = getTopCastleCardId(context.findCards);
  if (!topCastleCardId) {
    console.debug(`[castle pile] no castles left to gain`);
    return;
  }
  console.debug(
    `[castle pile] gaining top castle ${topCastleCardId} to discard`,
  );
  await context.runGameActionDelegate('gainCard', {
    playerId,
    cardId: topCastleCardId,
    to: {location: 'playerDiscard'},
  });
};

// Apply the shared Crumbling Castle bonus (+1 VP and gain a Silver).
const resolveCrumblingCastleBonus = async (
  context: GainTopSupplyContext,
  playerId: PlayerId,
) => {
  console.debug(`[crumbling castle bonus] gaining 1 VP token`);
  await context.runGameActionDelegate('gainVictoryToken', {
    playerId,
    count: 1,
  });
  await gainTopSupplyCard(context, {
    playerId,
    cardKey: 'silver',
    location: 'basicSupply',
    to: {location: 'playerDiscard'},
    logTag: 'crumbling castle bonus',
  });
};

// Resolve the Rocks on-gain/on-trash Silver bonus with buy-phase routing.
const resolveRocksSilverGain = async (
  context: Pick<
    CardEffectFunctionContext,
    'match' | 'findCards' | 'runGameActionDelegate'
  >,
  args: { playerId: PlayerId; source: 'gained' | 'trashed' },
) => {
  // Determine whether the gain happens during the player's buy phase.
  const currentPlayerId = getCurrentPlayer(context.match).id;
  const isBuyPhase = currentPlayerId === args.playerId &&
    getTurnPhase(context.match.turnPhaseIndex) === 'buy';
  const toLocation = isBuyPhase
    ? {location: 'playerDeck' as const}
    : {location: 'playerHand' as const};

  console.debug(
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
  'archive': {
    registerEffects: () => async (args) => {
      const {playerId, cardId} = args;

      console.debug(`[archive effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', {count: 1});

      const setAsideCardIds: CardId[] = [];
      console.info(
        `[archive effect] preparing to set aside up to 3 cards for player ${playerId}`,
      );

      // Set aside up to 3 cards from the top of the deck, shuffling as needed.
      for (let i = 0; i < 3; i += 1) {
        const deck = args.cardSourceController.getSource(
          'playerDeck',
          playerId,
        );
        if (deck.length < 1) {
          await args.runGameActionDelegate('shuffleDeck', {playerId});
        }

        if (deck.length < 1) {
          console.debug(`[archive effect] no cards left to set aside`);
          break;
        }

        const topCardId = deck.slice(-1)[0];
        await args.runGameActionDelegate('moveCard', {
          cardId: topCardId,
          toPlayerId: playerId,
          to: {location: 'set-aside'},
          facing: 'back',
        });
        console.debug(`[archive effect] set aside card ${topCardId}`);
        setAsideCardIds.push(topCardId);
      }

      console.info(
        `[archive effect] set aside cards: ${
          setAsideCardIds.join(', ') || 'none'
        }`,
      );

      const moveSetAsideCardToHand = async (
        effectArgs: ArchiveEffectContext,
      ) => {
        if (!setAsideCardIds.length) return;

        let chosenCardId: CardId | undefined = setAsideCardIds[0];
        if (setAsideCardIds.length > 1) {
          console.debug(
            `[archive effect] prompting selection from set-aside cards`,
          );
          const selectionResult = await effectArgs.runGameActionDelegate(
            'userPrompt',
            {
              playerId,
              prompt: 'Choose a set aside card',
              content: {
                type: 'select',
                cardIds: setAsideCardIds,
                selectableCardIds: setAsideCardIds,
                selectCount: 1,
              },
            },
          ) as { result?: CardId[] };
          chosenCardId = selectionResult?.result?.[0] ?? chosenCardId;
        }

        if (!chosenCardId) return;

        console.info(
          `[archive effect] moving chosen set-aside card ${chosenCardId} to hand`,
        );
        await effectArgs.runGameActionDelegate('moveCard', {
          cardId: chosenCardId,
          toPlayerId: playerId,
          to: {location: 'playerHand'},
          facing: 'front',
        });

        const idx = setAsideCardIds.indexOf(chosenCardId);
        if (idx >= 0) {
          setAsideCardIds.splice(idx, 1);
        }
        console.info(
          `[archive effect] remaining set-aside cards: ${
            setAsideCardIds.join(', ') || 'none'
          }`,
        );
      };

      // Gain one of the set-aside cards immediately.
      await moveSetAsideCardToHand(args);

      if (!setAsideCardIds.length) {
        return;
      }

      const archiveCard = args.cardLibrary.getCard(cardId);

      // Keep Archive active for each remaining set-aside card.
      args.registerDurationEffect(archiveCard, {
        id: `archive:${cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({trigger}) =>
          trigger.args.playerId === playerId && setAsideCardIds.length > 0,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(
            `[archive trigger] startTurn for player ${playerId}, remaining: ${setAsideCardIds.length}`,
          );
          console.debug(
            `[archive triggered effect] moving Archive back to play area...`,
          );
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId,
            to: {location: 'playArea'},
          });

          await moveSetAsideCardToHand(triggeredArgs);

          // When the last card is taken, remove lingering duration triggers.
          if (setAsideCardIds.length <= 0) {
            console.info(
              `[archive trigger] set-aside cards exhausted; cleaning up duration triggers`,
            );
            triggeredArgs.reactionManager.cleanupDurationTriggers(cardId);
          }
        },
      }, {
        // Keep Archive in play through the next cleanup even after the last card is taken.
        cleanupCount: setAsideCardIds.length + 1,
      });
    },
  },
  'capital': {
    registerEffects: () => async (args) => {
      // Capital grants treasure and buys immediately on play.
      console.debug(`[capital effect] gaining +6 treasure and +1 buy`);
      // Gain the $ from Capital.
      await args.runGameActionDelegate('gainTreasure', {count: 6});
      // Gain the extra buy from Capital.
      await args.runGameActionDelegate('gainBuy', {count: 1});
    },
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        // Only apply debt when Capital is discarded from play.
        const previousLocation = eventArgs.previousLocation?.location;
        if (previousLocation !== 'playArea') {
          console.debug(
            `[capital onDiscarded] not discarded from play, skipping`,
          );
          return;
        }
        // Apply the debt penalty when Capital leaves play.
        console.debug(
          `[capital onDiscarded] gaining +6 debt for player ${eventArgs.playerId}`,
        );
        await args.runGameActionDelegate('gainDebt', {
          playerId: eventArgs.playerId,
          count: 6,
        });
      },
    }),
  },
  'charm': {
    registerEffects: () => async (args) => {
      // Charm offers a choice between immediate +Buy/+Treasure or a delayed gain trigger.
      console.debug(
        `[charm effect] prompting player ${args.playerId} to choose an option`,
      );
      const choice = await args.runGameActionDelegate('userPrompt', {
        playerId: args.playerId,
        prompt: 'Choose one',
        actionButtons: [
          {action: 1, label: '+1 Buy and +2 Treasure'},
          {
            action: 2,
            label: 'Next gain: different extra card with same cost',
          },
        ],
      }) as { action: number };

      if (choice.action === 1) {
        console.debug(`[charm effect] granting +1 buy and +2 treasure`);
        await args.runGameActionDelegate('gainBuy', {count: 1});
        await args.runGameActionDelegate('gainTreasure', {count: 2});
        return;
      }

      // Register a one-time reaction for the next gained card this turn.
      console.info(
        `[charm effect] registering next-gain reaction for player ${args.playerId}`,
      );
      const charmCard = args.cardLibrary.getCard(args.cardId);
      const reactionId = `charm:${args.cardId}:cardGained`;

      args.reactionManager.registerReactionTemplate({
        id: reactionId,
        listeningFor: 'cardGained',
        playerId: args.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          // Only trigger off the current player's gains.
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(
            triggeredArgs.trigger.args.cardId,
          );
          // Apply price rules to the gained card to determine the comparison cost.
          const {cost: gainedCost} = triggeredArgs.cardPriceController
            .applyRules(
              gainedCard,
              {playerId: args.playerId},
            );

          console.debug(
            `[charm cardGained] gained ${gainedCard}, matching cost ${
              JSON.stringify(gainedCost)
            }`,
          );

          // Find supply cards with the exact same cost but a different name.
          const matchingCards = triggeredArgs.findCards([
            {location: ['basicSupply', 'kingdomSupply']},
            {playerId: args.playerId, kind: 'exact', amount: gainedCost},
          ]).filter((card) => card.cardKey !== gainedCard.cardKey);

          if (!matchingCards.length) {
            console.debug(
              `[charm cardGained] no differently named cards with same cost`,
            );
            return;
          }

          console.debug(
            `[charm cardGained] prompting to gain one of ${matchingCards.length} cards`,
          );
          const selectedIds = await triggeredArgs.runGameActionDelegate(
            'selectCard',
            {
              playerId: args.playerId,
              prompt: 'Gain a differently named card with the same cost',
              restrict: matchingCards.map((card) => card.id),
              count: 1,
              optional: true,
            },
          ) as CardId[];

          if (!selectedIds.length) {
            console.debug(`[charm cardGained] player chose not to gain a card`);
            return;
          }

          const selectedCard = triggeredArgs.cardLibrary.getCard(
            selectedIds[0],
          );
          console.debug(
            `[charm cardGained] gaining ${selectedCard} to discard`,
          );
          await triggeredArgs.runGameActionDelegate('gainCard', {
            playerId: args.playerId,
            cardId: selectedCard.id,
            to: {location: 'playerDiscard'},
          }, {loggingContext: {source: args.cardId}});
        },
      });

      // Clean up the pending reaction at end of turn if it never triggers.
      args.reactionManager.registerSystemTemplate(charmCard, 'endTurn', {
        playerId: args.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        autoResolve: true,
        condition: (conditionArgs) =>
          conditionArgs.trigger.args.playerId === args.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          console.debug(`[charm endTurn] clearing pending next-gain reaction`);
          triggeredArgs.reactionManager.unregisterTrigger(reactionId);
        },
      });
    },
  },
  'catapult': {
    registerEffects: () => async (args) => {
      const {playerId, match, reactionContext, cardLibrary} = args;

      // Catapult always grants +$1 on play.
      console.debug(`[catapult effect] gaining 1 treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: 1});

      // Catapult requires trashing a card from hand if possible.
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      if (hand.length < 1) {
        console.debug(`[catapult effect] no cards in hand to trash`);
        return;
      }

      console.debug(
        `[catapult effect] prompting player ${playerId} to trash a card`,
      );
      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId,
        prompt: 'Trash a card',
        restrict: {location: 'playerHand', playerId},
        count: 1,
      }) as CardId[];

      if (!selectedCardIds?.length) {
        console.warn(`[catapult effect] no card selected to trash`);
        return;
      }

      const trashedCard = cardLibrary.getCard(selectedCardIds[0]);
      console.debug(`[catapult effect] trashing ${trashedCard}`);
      await args.runGameActionDelegate('trashCard', {
        playerId,
        cardId: trashedCard.id,
      });

      // Determine which attack effects apply based on the trashed card.
      const {cost} = args.cardPriceController.applyRules(trashedCard, {
        playerId,
      });
      const triggersCurse = (cost.treasure ?? 0) >= 3;
      const triggersDiscard = trashedCard.type.includes('TREASURE');

      console.debug(
        `[catapult effect] trashed card cost=${
          cost.treasure ?? 0
        }, treasure=${triggersDiscard}`,
      );

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => !isPlayerImmune(reactionContext, id));

      console.debug(
        `[catapult effect] targets ${targetPlayerIds.join(', ') || 'none'}`,
      );

      // Apply curse gains in turn order when the trashed card costs $3+.
      if (triggersCurse) {
        for (const targetPlayerId of targetPlayerIds) {
          const curseCards = args.findCards([{location: 'basicSupply'}, {
            cardKeys: 'curse',
          }]);
          if (!curseCards.length) {
            console.debug(`[catapult effect] no curse cards left in supply`);
            break;
          }

          console.debug(`[catapult effect] ${targetPlayerId} gaining Curse`);
          await args.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCards.slice(-1)[0].id,
            to: {location: 'playerDiscard'},
          });
        }
      }

      // Apply discard-down-to-3 in turn order after curses when the trashed card is a Treasure.
      if (triggersDiscard) {
        for (const targetPlayerId of targetPlayerIds) {
          await discardDownTo({
            cardSourceController: args.cardSourceController,
            runGameActionDelegate: args.runGameActionDelegate,
            cardLibrary: args.cardLibrary,
          }, {
            playerId: targetPlayerId,
            targetHandSize: 3,
            prompt: 'Confirm discard',
            logTag: 'catapult effect',
          });
        }
      }
    },
  },
  'chariot-race': {
    registerEffects: () => async (args) => {
      // Pull commonly used effect context fields.
      const {playerId, match, cardLibrary} = args;

      // Chariot Race grants +1 Action.
      console.debug(`[chariot race effect] gaining 1 action`);
      await args.runGameActionDelegate('gainAction', {count: 1});

      // Draw one card, then reveal it.
      console.debug(`[chariot race effect] drawing 1 card to reveal`);
      const drawnCardIds = await args.runGameActionDelegate('drawCard', {
        playerId,
      }) as CardId[] | null;
      const drawnCardId = drawnCardIds?.[0];
      if (drawnCardId) {
        console.debug(
          `[chariot race effect] revealing drawn card ${drawnCardId}`,
        );
        await args.runGameActionDelegate('revealCard', {
          playerId,
          cardId: drawnCardId,
        });
      } else {
        console.debug(`[chariot race effect] no card drawn to reveal`);
      }

      // Identify the player to the left (next in turn order).
      const leftPlayerId = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      })[0];

      if (!leftPlayerId) {
        console.debug(
          `[chariot race effect] no left player found, skipping comparison`,
        );
        return;
      }

      // Helper to reveal the top card of a player's deck, shuffling if needed.
      const revealTopCard = async (targetPlayerId: PlayerId) => {
        const deck = args.cardSourceController.getSource(
          'playerDeck',
          targetPlayerId,
        );
        if (deck.length < 1) {
          console.debug(
            `[chariot race effect] player ${targetPlayerId} deck empty, shuffling discard`,
          );
          await args.runGameActionDelegate('shuffleDeck', {
            playerId: targetPlayerId,
          });
        }

        if (deck.length < 1) {
          console.debug(
            `[chariot race effect] player ${targetPlayerId} still has no cards to reveal`,
          );
          return null;
        }

        const topCardId = deck.slice(-1)[0];
        console.debug(
          `[chariot race effect] revealing top card ${topCardId} for player ${targetPlayerId}`,
        );
        await args.runGameActionDelegate('revealCard', {
          playerId: targetPlayerId,
          cardId: topCardId,
        });
        return topCardId;
      };

      // Reveal the left player's top card.
      const leftCardId = await revealTopCard(leftPlayerId);

      if (!drawnCardId || !leftCardId) {
        console.debug(
          `[chariot race effect] missing revealed cards, skipping rewards`,
        );
        return;
      }

      // Compare effective costs (including price rules) for each player.
      const drawnCard = cardLibrary.getCard(drawnCardId);
      const leftCard = cardLibrary.getCard(leftCardId);
      const {cost: drawnCost} = args.cardPriceController.applyRules(
        drawnCard,
        {playerId},
      );
      const {cost: leftCost} = args.cardPriceController.applyRules(leftCard, {
        playerId: leftPlayerId,
      });

      // Compare costs using shared multi-axis rules.
      const costsMore = compareCardCosts(drawnCost, leftCost) > 0;
      console.debug(
        `[chariot race effect] costsMore=${costsMore} (drawn=${
          JSON.stringify(drawnCost)
        } left=${JSON.stringify(leftCost)})`,
      );

      if (!costsMore) {
        return;
      }

      // Award the +$1 and +1 VP token when the revealed card costs more.
      console.debug(
        `[chariot race effect] gaining 1 treasure and 1 victory token`,
      );
      await args.runGameActionDelegate('gainTreasure', {count: 1});
      await args.runGameActionDelegate('gainVictoryToken', {
        playerId,
        count: 1,
      });
    },
  },
  'city-quarter': {
    registerEffects: () => async (args) => {
      const {playerId} = args;

      // City Quarter grants +2 Actions.
      console.debug(`[city quarter effect] gaining 2 actions`);
      await args.runGameActionDelegate('gainAction', {count: 2});

      // Reveal the player's hand.
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      console.debug(`[city quarter effect] revealing ${hand.length} cards`);
      for (const cardId of hand) {
        await args.runGameActionDelegate('revealCard', {
          cardId,
          playerId,
        });
      }

      // Count revealed Action cards and draw that many cards.
      const actionCardCount = hand
        .map((cardId) => args.cardLibrary.getCard(cardId))
        .filter((card) => card.type.includes('ACTION'))
        .length;

      console.debug(`[city quarter effect] drawing ${actionCardCount} card(s)`);
      if (actionCardCount > 0) {
        await args.runGameActionDelegate('drawCard', {
          playerId,
          count: actionCardCount,
        });
      }
    },
  },
  'crown': {
    registerEffects: () => async (args) => {
      const currentPlayerId = getCurrentPlayer(args.match).id;
      if (args.playerId !== currentPlayerId) {
        console.debug(`[crown effect] not current player's turn, skipping`);
        return;
      }

      const isActionPhase =
        getTurnPhase(args.match.turnPhaseIndex) === 'action';
      const isBuyPhase = getTurnPhase(args.match.turnPhaseIndex) === 'buy';

      if (isActionPhase) {
        console.debug(
          `[crown effect] player ${args.playerId} is in action phase`,
        );

        const actionCardsInHand = args.cardSourceController.getSource(
          'playerHand',
          args.playerId,
        )
          .filter((card) =>
            args.cardLibrary.getCard(card)?.type.includes('ACTION')
          );

        if (actionCardsInHand.length) {
          const selectedCardIds = await args.runGameActionDelegate(
            'selectCard',
            {
              playerId: args.playerId,
              prompt: `Choose an action card`,
              restrict: actionCardsInHand,
              count: 1,
              optional: true,
              cancelPrompt: 'Cancel',
            },
          ) as CardId[];

          if (!selectedCardIds.length) {
            console.debug(
              `[crown effect] player chose not to use an action card`,
            );
          } else {
            for (let i = 0; i < 2; i++) {
              await args.runGameActionDelegate('playCard', {
                cardId: selectedCardIds[0],
                playerId: args.playerId,
                overrides: {
                  actionCost: 0,
                },
              });
            }
          }
        } else {
          console.debug(
            `[crown effect] player ${args.playerId} has no action cards, skipping`,
          );
        }
      }

      if (isBuyPhase) {
        console.debug(`[crown effect] player ${args.playerId} is in buy phase`);

        // Restrict Crown's buy-phase effect to Treasure cards.
        const treasureInHand = args.cardSourceController.getSource(
          'playerHand',
          args.playerId,
        ).filter((card) =>
          args.cardLibrary.getCard(card)?.type.includes('TREASURE')
        );

        if (treasureInHand.length) {
          const selectedCardIds = await args.runGameActionDelegate(
            'selectCard',
            {
              playerId: args.playerId,
              prompt: `Choose a treasure card`,
              restrict: treasureInHand,
              count: 1,
              optional: true,
              cancelPrompt: 'Cancel',
            },
          ) as CardId[];

          if (!selectedCardIds.length) {
            console.debug(
              `[crown effect] player chose not to use a treasure card`,
            );
          } else {
            for (let i = 0; i < 2; i++) {
              await args.runGameActionDelegate('playCard', {
                cardId: selectedCardIds[0],
                playerId: args.playerId,
                overrides: {
                  actionCost: 0,
                },
              });
            }
          }
        } else {
          console.debug(
            `[crown effect] player ${args.playerId} has no treasure cards, skipping`,
          );
        }
      }
    },
  },
  'crumbling-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Apply the Crumbling Castle bonus when gained.
        console.debug(
          `[crumbling castle onGained] player ${eventArgs.playerId} gained Crumbling Castle`,
        );
        await resolveCrumblingCastleBonus(args, eventArgs.playerId);
      },
      onTrashed: async (args, eventArgs) => {
        // Apply the Crumbling Castle bonus when trashed.
        console.debug(
          `[crumbling castle onTrashed] player ${eventArgs.playerId} trashed Crumbling Castle`,
        );
        await resolveCrumblingCastleBonus(args, eventArgs.playerId);
      },
    }),
  },
  'encampment': {
    registerEffects: () => async (args) => {
      console.debug(`[encampment effect] drawing 2 cards`);
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 2,
      });

      console.debug(`[encampment effect] gaining 2 actions`);
      await args.runGameActionDelegate('gainAction', {count: 2});

      const validCards = args.findCards([
        {location: 'playerHand', playerId: args.playerId},
        {cardKeys: ['gold', 'plunder']},
      ]);

      const doSetAside = async () => {
        const thisCard = args.cardLibrary.getCard(args.cardId);
        const thisId = thisCard.id;
        await args.runGameActionDelegate('moveCard', {
          toPlayerId: args.playerId,
          cardId: thisId,
          to: {location: 'set-aside'},
        });

        args.reactionManager.registerReactionTemplate(
          thisCard,
          'startTurnPhase',
          {
            playerId: args.playerId,
            once: true,
            allowMultipleInstances: false,
            compulsory: true,
            condition: async (conditionArgs) => {
              return getTurnPhase(conditionArgs.trigger.args.phaseIndex) ===
                'cleanup';
            },
            triggeredEffectFn: async () => {
              console.debug(
                `[encampment startTurnPhase effect] moving back to pile`,
              );

              const pile = getPileDefinitionCard(
                [thisCard],
                'encampment/plunder',
              );

              if (!pile) {
                console.debug(
                  `[encampment startTurnPhase effect] pile not in kingdom`,
                );
                return;
              }

              await args.runGameActionDelegate('moveCard', {
                cardId: thisId,
                to: {location: 'kingdomSupply'},
              });
            },
          },
        );
      };

      if (!validCards.length) {
        console.debug(`[encampment effect] no valid cards in hand`);
        await doSetAside();
        return;
      }

      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: `Select Gold or Plunder to reveal?`,
        restrict: validCards.map((c) => c.id),
        count: 1,
        optional: true,
        cancelPrompt: 'NO',
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[encampment effect] no card selected`);
        await doSetAside();
        return;
      }
    },
  },
  'enchantress': {
    registerEffects: () => async (args) => {
    },
  },
  'engineer': {
    registerEffects: () => async (args) => {
      const gainCard = async () => {
        const validCards = args.findCards([
          {location: ['basicSupply', 'kingdomSupply']},
          {amount: {treasure: 4}, playerId: args.playerId, kind: 'upTo'},
        ]);

        if (!validCards.length) {
          console.debug(`[engineer effect] no valid cards in supply`);
        } else {
          const selectedCardIds = await args.runGameActionDelegate(
            'selectCard',
            {
              playerId: args.playerId,
              prompt: `Select card up to $4`,
              restrict: validCards.map((c) => c.id),
              count: 1,
              optional: false,
            },
          ) as CardId[];

          if (!selectedCardIds.length) {
            console.debug(`[engineer effect] no card selected`);
          } else {
            console.debug(`[engineer effect] gaining ${selectedCardIds[0]}`);
            await args.runGameActionDelegate('gainCard', {
              playerId: args.playerId,
              cardId: selectedCardIds[0],
              to: {location: 'playerDiscard'},
            });
          }
        }
      };

      await gainCard();

      const result = await args.runGameActionDelegate('userPrompt', {
        playerId: args.playerId,
        prompt: 'Trash Engineer?',
        actionButtons: [
          {label: 'TRASH', action: 1},
          {label: 'NO', action: 2},
        ],
      }) as { action: number; result: number[] };

      if (result.action !== 1) {
        console.debug(`[engineer effect] user chose not to trash Engineer`);
        return;
      }

      await args.runGameActionDelegate('trashCard', {
        playerId: args.playerId,
        cardId: args.cardId,
      });

      await gainCard();
    },
  },
  'farmers-market': {
    registerEffects: () => async (args) => {
      console.debug(`[farmers market effect] gaining 1 buy`);
      await args.runGameActionDelegate('gainBuy', {count: 1});

      const tokensOnPile = Object.values(args.match.tokens).filter((t) =>
        t.tokenId === prosperityTokenIds.victory &&
        t.location.type === 'supplyPile' &&
        t.location.cardKey === 'farmers-market'
      );

      if (tokensOnPile.length >= 4) {
        console.debug(`[farmers market effect] 4 or more tokens on pile`);

        // Move pile victory tokens into the player's victory token pool.
        for (const token of tokensOnPile) {
          await args.runGameActionDelegate('moveToken', {
            tokenInstanceId: token.id,
            location: {type: 'player', playerId: args.playerId},
            ownerId: args.playerId,
          });
        }

        console.debug(`[farmers market effect] trashing farmer's market`);

        await args.runGameActionDelegate('trashCard', {
          playerId: args.playerId,
          cardId: args.cardId,
        });
      } else {
        console.debug(`[farmers market effect] less than 4 tokens on pile`);

        await args.runGameActionDelegate('placeToken', {
          tokenId: prosperityTokenIds.victory,
          location: {type: 'supplyPile', cardKey: 'farmers-market'},
        });

        await args.runGameActionDelegate('gainTreasure', {
          count: tokensOnPile.length + 1,
        });
      }
    },
  },
  'fortune': {
    registerLifeCycleMethods: () => ({
      onGained: async (args) => {
        console.debug(`[fortune onGained] running`);

        const gladiatorsInPlay = getCardsInPlay(args.findCards).filter((card) =>
          card.cardKey === 'gladiator'
        );

        if (!gladiatorsInPlay.length) {
          console.debug(`[fortune onGained] no gladiators in play`);
          return;
        }

        console.debug(
          `[fortune onGained] gaining ${gladiatorsInPlay.length} treasure`,
        );
        await args.runGameActionDelegate('gainTreasure', {
          count: gladiatorsInPlay.length,
        });
      },
    }),
    registerEffects: () => async (args) => {
      console.debug(`[fortune effect] gaining 1 buy`);
      await args.runGameActionDelegate('gainBuy', {count: 1});

      const thisCard = args.cardLibrary.getCard<FortuneMetadata>(args.cardId);
      if (!thisCard.metadata.doubled[args.playerId]) {
        console.debug(`[fortune effect] doubling treasure`);
        await args.runGameActionDelegate('gainTreasure', {
          count: args.match.playerTreasure,
        });
        thisCard.metadata.doubled[args.playerId] = true;
      }

      args.reactionManager.registerReactionTemplate(thisCard, 'endTurn', {
        playerId: args.playerId,
        once: true,
        compulsory: true,
        autoResolve: true,
        allowMultipleInstances: false,
        condition: async (conditionArgs) => {
          const fortuneCards = getCardsInPlay(conditionArgs.findCards).filter(
            (c) => c.cardKey === 'fortune',
          );
          if (fortuneCards.length > 0) return false;
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async () => {
          console.debug(`[fortune endTurn trigger] running`);
          thisCard.metadata.doubled[args.playerId] = false;
        },
      });
    },
  },
  'forum': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        console.debug(
          `[forum onGained] player ${eventArgs.playerId} gained Forum`,
        );
        await args.runGameActionDelegate('gainBuy', {count: 1});
      },
    }),
    registerEffects: () => async (args) => {
      console.debug(`[forum effect] gaining 3 cards`);
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 3,
      });

      console.debug(`[forum effect] gaining 1 action`);
      await args.runGameActionDelegate('gainAction', {count: 1});

      // Forum requires discarding 2 cards after drawing.
      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      if (!hand.length) {
        console.debug(`[forum effect] no cards to discard`);
        return;
      }
      const discardCount = Math.min(2, hand.length);
      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: `Select ${discardCount} card${discardCount === 1 ? '' : 's'} to discard`,
        restrict: hand,
        count: discardCount,
        optional: false,
      }) as CardId[];
      for (const cardId of selectedCardIds) {
        await args.runGameActionDelegate('discardCard', {
          playerId: args.playerId,
          cardId,
        });
      }
    },
  },
  'groundskeeper': {
    registerEffects: () => async (args) => {
      console.debug(`[groundskeeper effect] drawing 1 card and gaining 1 action`);
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.runGameActionDelegate('gainAction', {count: 1});

      const thisCard = args.cardLibrary.getCard(args.cardId);

      const cardGainedReactionId = args.reactionManager.registerReactionTemplate(
        thisCard,
        'cardGained',
        {
          playerId: args.playerId,
          once: false,
          allowMultipleInstances: true,
          compulsory: true,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== args.playerId) {
              return false;
            }
            const gainedCard = conditionArgs.cardLibrary.getCard(
              conditionArgs.trigger.args.cardId,
            );
            return gainedCard.type.includes('VICTORY');
          },
          triggeredEffectFn: async (triggeredArgs) => {
            const gainedCard = triggeredArgs.cardLibrary.getCard(
              triggeredArgs.trigger.args.cardId,
            );
            console.debug(
              `[groundskeeper cardGained effect] awarding token for ${gainedCard}`,
            );
            await triggeredArgs.runGameActionDelegate('gainVictoryToken', {
              playerId: args.playerId,
              count: 1,
            });
          },
        },
      );

      const endTurnReactionId = args.reactionManager.registerReactionTemplate(
        thisCard,
        'endTurn',
        {
          playerId: args.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: (conditionArgs) =>
            conditionArgs.trigger.args.playerId === args.playerId,
          triggeredEffectFn: async () => {
            console.debug(`[groundskeeper endTurn effect] cleaning up reactions`);
            args.reactionManager.unregisterTrigger(cardGainedReactionId);
            args.reactionManager.unregisterTrigger(endTurnReactionId);
          },
        },
      );
    },
  },
  'gladiator': {
    registerEffects: () => async (args) => {
      console.debug(`[gladiator effect] gaining 2 treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: 2});

      const hand = args.cardSourceController.getSource(
        'playerHand',
        args.playerId,
      );

      const trashCard = async () => {
        await args.runGameActionDelegate('gainTreasure', {count: 1});
        const gladiators = args.findCards([
          {location: 'kingdomSupply'},
          {cardKeys: 'gladiator'},
        ]);

        if (!gladiators.length) {
          console.debug(`[gladiator effect] no gladiators in supply`);
          return;
        }

        console.debug(`[gladiator effect] gaining gladiator`);

        await args.runGameActionDelegate('gainCard', {
          playerId: args.playerId,
          cardId: gladiators[0].id,
          to: {location: 'playerDiscard'},
        });
      };

      if (!hand.length) {
        console.debug(
          `[gladiator effect] player ${args.playerId} has no cards in hand`,
        );
        await trashCard();
        return;
      }

      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: `Select card to reveal`,
        restrict: hand,
        count: 1,
        optional: false,
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[gladiator effect] no card selected`);
        await trashCard();
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);

      await args.runGameActionDelegate('revealCard', {
        playerId: args.playerId,
        cardId: selectedCard.id,
      });

      const leftPlayer = getPlayerStartingFrom({
        startFromIdx: args.match.currentPlayerTurnIndex,
        match: args.match,
        distance: 1,
      });

      const leftPlayerHand = args.cardSourceController.getSource(
        'playerHand',
        leftPlayer.id,
      ).map((id) => args.cardLibrary.getCard(id)).filter((c) =>
        c.cardKey === selectedCard.cardKey
      ).map((c) => c.id);

      if (!leftPlayerHand.length) {
        console.debug(`[gladiator effect] no cards in left player's hand`);
        await trashCard();
        return;
      }

      const result = await args.runGameActionDelegate('userPrompt', {
        playerId: leftPlayer.id,
        prompt: `Reveal ${selectedCard.cardName}?`,
        actionButtons: [
          {label: 'YES', action: 1},
          {label: 'NO', action: 2},
        ],
      }) as { action: number; result: number[] };

      if (result.action === 1) {
        console.debug(`[gladiator effect] user chose to reveal card`);
        await args.runGameActionDelegate('revealCard', {
          playerId: leftPlayer.id,
          cardId: leftPlayerHand[0],
        });
        return;
      }

      console.debug(`[gladiator effect] user chose not to reveal card`);
      await trashCard();
    },
  },
  'legionary': {
    registerEffects: () => async (args) => {
      console.debug(`[legionary effect] gaining 3 treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: 3});

      const hand = args.cardSourceController.getSource(
        'playerHand',
        args.playerId,
      );
      const goldInHand = hand.filter((cardId) =>
        args.cardLibrary.getCard(cardId).cardKey === 'gold'
      );

      if (!goldInHand.length) {
        console.debug(`[legionary effect] no Gold available to reveal`);
        return;
      }

      const selectedGold = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: 'Reveal a Gold to hit each other player?',
        restrict: goldInHand,
        count: 1,
        optional: true,
      }) as CardId[] | null;

      if (!selectedGold?.length) {
        console.debug(`[legionary effect] player declined to reveal Gold`);
        return;
      }

      const goldCardId = selectedGold[0];
      console.debug(
        `[legionary effect] revealing Gold ${goldCardId} for player ${args.playerId}`,
      );
      await args.runGameActionDelegate('revealCard', {
        playerId: args.playerId,
        cardId: goldCardId,
      });

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: args.playerId,
        appliesTo: 'ALL_OTHER',
        match: args.match,
      }).filter((targetPlayerId) =>
        !isPlayerImmune(args.reactionContext, targetPlayerId)
      );

      if (!targetPlayerIds.length) {
        console.debug(`[legionary effect] no valid targets`);
        return;
      }

      for (const targetPlayerId of targetPlayerIds) {
        await discardDownTo({
          cardLibrary: args.cardLibrary,
          cardSourceController: args.cardSourceController,
          runGameActionDelegate: args.runGameActionDelegate,
        }, {
          playerId: targetPlayerId,
          targetHandSize: 2,
          prompt: 'Discard down to 2 cards',
          logTag: 'legionary effect',
        });

        console.debug(
          `[legionary effect] ${targetPlayerId} drawing a card after discard`,
        );
        await args.runGameActionDelegate('drawCard', {
          playerId: targetPlayerId,
          count: 1,
        });
      }
    },
  },
  'overlord': {
    registerEffects: () => async (args) => {
      // Overlord plays one eligible supply Action at no extra action cost while leaving that pile in place.
      console.debug(`[overlord effect] evaluating supply options for player ${args.playerId}`);

      const supplyLocations: CardLocation[] = ['kingdomSupply', 'basicSupply'];
      const supplyCards = args.findCards([{location: supplyLocations}]);
      const topCardByPile = new Map<string, typeof supplyCards[number]>();
      for (const card of supplyCards) {
        topCardByPile.set(card.kingdom, card);
      }

      const maxCost = {treasure: 5};
      const eligibleCards = Array.from(topCardByPile.values()).filter((card) => {
        if (!card.type.includes('ACTION')) return false;
        if (card.type.includes('COMMAND') || card.type.includes('DURATION')) return false;
        return compareCardCosts(card.cost, maxCost) <= 0;
      });

      if (!eligibleCards.length) {
        console.debug(`[overlord effect] no eligible supply actions remain`);
        return;
      }

      console.debug(
        `[overlord effect] player ${args.playerId} can play: ${
          eligibleCards.map((card) => card.cardKey).join(', ')
        }`,
      );

      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: 'Select a supply action costing up to $5 to play',
        restrict: eligibleCards.map((card) => card.id),
        count: 1,
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[overlord effect] player declined to play a supply action`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
      console.info(`[overlord effect] playing ${selectedCard.cardKey} from supply`);

      await args.runGameActionDelegate('playCard', {
        playerId: args.playerId,
        cardId: selectedCardIds[0],
        overrides: {
          actionCost: 0,
          moveCard: false,
        },
      });
    },
  },
  'rocks': {
    registerEffects: () => async ({runGameActionDelegate}) => {
      // Rocks provides +$1 when played.
      console.debug(`[rocks effect] gaining 1 treasure`);
      await runGameActionDelegate('gainTreasure', {count: 1});
    },
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Apply the Rocks Silver gain when gained.
        console.debug(
          `[rocks onGained] player ${eventArgs.playerId} gained Rocks`,
        );
        await resolveRocksSilverGain(args, {
          playerId: eventArgs.playerId,
          source: 'gained',
        });
      },
      onTrashed: async (args, eventArgs) => {
        // Apply the Rocks Silver gain when trashed.
        console.debug(
          `[rocks onTrashed] player ${eventArgs.playerId} trashed Rocks`,
        );
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
        // Haunted Castle only triggers when gained on the current player's turn.
        const currentPlayerId = getCurrentPlayer(args.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          console.debug(
            `[haunted castle onGained] not current player's turn, skipping`,
          );
          return;
        }

        console.debug(
          `[haunted castle onGained] player ${eventArgs.playerId} gained Haunted Castle`,
        );
        await gainTopSupplyCard(args, {
          playerId: eventArgs.playerId,
          cardKey: 'gold',
          location: 'basicSupply',
          to: {location: 'playerDiscard'},
          logTag: 'haunted castle onGained',
        });

        const targetPlayerIds = findOrderedTargets({
          startingPlayerId: eventArgs.playerId,
          appliesTo: 'ALL_OTHER',
          match: args.match,
        });

        for (const targetPlayerId of targetPlayerIds) {
          const targetHand = args.findCards({
            location: 'playerHand',
            playerId: targetPlayerId,
          });
          if (targetHand.length < 5) {
            console.debug(
              `[haunted castle onGained] player ${targetPlayerId} has fewer than 5 cards, skipping`,
            );
            continue;
          }

          console.debug(
            `[haunted castle onGained] prompting player ${targetPlayerId} to put 2 cards on deck`,
          );
          const selectedIds = await args.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: 'Put 2 cards from your hand onto your deck',
            restrict: {location: 'playerHand', playerId: targetPlayerId},
            count: 2,
          }) as CardId[];

          for (const selectedId of selectedIds) {
            console.debug(
              `[haunted castle onGained] moving ${selectedId} to deck for player ${targetPlayerId}`,
            );
            await args.runGameActionDelegate('moveCard', {
              cardId: selectedId,
              toPlayerId: targetPlayerId,
              to: {location: 'playerDeck'},
            });
          }
        }
      },
    }),
  },
  'humble-castle': {
    registerScoringFunction: () => (args) => {
      // Humble Castle is worth 1 VP per Castle you have.
      const castleCount = countOwnedCastles({
        cardLibrary: args.cardLibrary,
        ownerId: args.ownerId,
      });
      console.debug(
        `[humble castle scoring] owner ${args.ownerId} castles ${castleCount}`,
      );
      return castleCount;
    },
    registerEffects: () => async (args) => {
      // Humble Castle is a Treasure that produces $1.
      console.debug(`[humble castle effect] gaining 1 treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: 1});
    },
  },
  'grand-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Grand Castle grants VP tokens based on Victory cards in hand and in play.
        const victoryInHand = args.findCards({
          location: 'playerHand',
          playerId: eventArgs.playerId,
        })
          .filter((card) => card.type.includes('VICTORY'));
        const victoryInPlay = getCardsInPlay(args.findCards)
          .filter((card) => card.type.includes('VICTORY'));
        // Reveal the gaining player's hand before awarding VP tokens.
        const handCardIds = args.cardSourceController.getSource(
          'playerHand',
          eventArgs.playerId,
        );
        console.info(
          `[grand castle onGained] revealing ${handCardIds.length} card(s) in hand for player ${eventArgs.playerId}`,
        );
        for (const handCardId of handCardIds) {
          // Use revealCard to keep reveal effects consistent with other cards.
          await args.runGameActionDelegate('revealCard', {
            playerId: eventArgs.playerId,
            cardId: handCardId,
          });
        }
        const totalVictoryCards = victoryInHand.length + victoryInPlay.length;
        console.debug(
          `[grand castle onGained] granting ${totalVictoryCards} VP tokens`,
        );
        await args.runGameActionDelegate('gainVictoryToken', {
          playerId: eventArgs.playerId,
          count: totalVictoryCards,
        });
      },
    }),
  },
  'kings-castle': {
    registerScoringFunction: () => (args) => {
      // King's Castle is worth 2 VP per Castle you have.
      const castleCount = countOwnedCastles({
        cardLibrary: args.cardLibrary,
        ownerId: args.ownerId,
      });
      const score = castleCount * 2;
      console.debug(
        `[king's castle scoring] owner ${args.ownerId} castles ${castleCount} score ${score}`,
      );
      return score;
    },
  },
  'opulent-castle': {
    registerEffects: () => async (args) => {
      // Opulent Castle discards Victory cards for +$2 each.
      const {playerId} = args;
      const victoryCardsInHand = args.findCards([{
        location: 'playerHand',
        playerId,
      }, {cardType: ['VICTORY']}]);
      if (victoryCardsInHand.length === 0) {
        console.debug(
          `[opulent castle effect] no Victory cards in hand to discard`,
        );
        return;
      }

      console.debug(
        `[opulent castle effect] prompting to discard Victory cards`,
      );
      const selectedIds = await args.runGameActionDelegate('selectCard', {
        playerId,
        prompt: 'Discard any number of Victory cards',
        restrict: victoryCardsInHand.map((card) => card.id),
        count: {kind: 'upTo', count: victoryCardsInHand.length},
        optional: true,
      }) as CardId[];

      if (selectedIds.length === 0) {
        console.debug(`[opulent castle effect] no cards discarded`);
        return;
      }

      for (const selectedId of selectedIds) {
        console.debug(
          `[opulent castle effect] discarding Victory card ${selectedId}`,
        );
        await args.runGameActionDelegate('discardCard', {
          playerId,
          cardId: selectedId,
        });
      }

      const treasureGain = selectedIds.length * 2;
      console.debug(`[opulent castle effect] gaining ${treasureGain} treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: treasureGain});
    },
  },
  'plunder': {
    registerEffects: () => async (args) => {
      console.debug(`[plunder effect] gaining 2 treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: 2});

      console.debug(`[plunder effect] gaining 1 victory token`);
      await args.runGameActionDelegate('gainVictoryToken', {
        playerId: args.playerId,
        count: 1,
      });
    },
  },
  'patrician': {
    registerEffects: () => async (args) => {
      console.debug(
        `[patrician effect] drawing 1 card, gaining 1 action, and revealing top deck card`,
      );
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
      });
      await args.runGameActionDelegate('gainAction', {count: 1});

      const revealTopDeckCard = async () => {
        let deck = args.cardSourceController.getSource(
          'playerDeck',
          args.playerId,
        );
        if (!deck.length) {
          console.debug(
            `[patrician effect] player ${args.playerId} deck empty, shuffling discard`,
          );
          await args.runGameActionDelegate('shuffleDeck', {
            playerId: args.playerId,
          });
          deck = args.cardSourceController.getSource(
            'playerDeck',
            args.playerId,
          );
        }

        if (!deck.length) {
          console.debug(
            `[patrician effect] still no cards to reveal after shuffling`,
          );
          return null;
        }

        const topCardId = deck.slice(-1)[0];
        console.debug(
          `[patrician effect] revealing top card ${topCardId} of deck`,
        );
        await args.runGameActionDelegate('revealCard', {
          playerId: args.playerId,
          cardId: topCardId,
        });
        return topCardId;
      };

      const revealedCardId = await revealTopDeckCard();
      if (!revealedCardId) {
        console.debug(`[patrician effect] no card revealed`);
        return;
      }

      const revealedCard = args.cardLibrary.getCard(revealedCardId);
      const {cost: revealedCost} = args.cardPriceController.applyRules(
        revealedCard,
        {playerId: args.playerId},
      );

      const qualifiesForDraw = compareCardCosts(revealedCost, {treasure: 5}) >= 0;
      if (!qualifiesForDraw) {
        console.debug(
          `[patrician effect] revealed ${revealedCard.cardKey} costs less than $5`,
        );
        return;
      }

      console.info(
        `[patrician effect] revealed ${revealedCard.cardKey} costs $5 or more, moving to hand`,
      );
      await args.runGameActionDelegate('moveCard', {
        cardId: revealedCardId,
        toPlayerId: args.playerId,
        to: {location: 'playerHand'},
      });
    },
  },
  'emporium': {
    registerEffects: () => async (args) => {
      console.debug(
        `[emporium effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`,
      );
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.runGameActionDelegate('gainAction', {count: 1});
      await args.runGameActionDelegate('gainTreasure', {count: 1});
    },
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const actionCardsInPlay = getCardsInPlay(args.findCards).filter(
          (card) =>
            card.type.includes('ACTION') && card.owner === eventArgs.playerId,
        );

        console.debug(
          `[emporium onGained] player ${eventArgs.playerId} has ${
            actionCardsInPlay.length
          } action cards in play`,
        );

        if (actionCardsInPlay.length < 5) {
          console.debug(`[emporium onGained] insufficient actions for bonus`);
          return;
        }

        console.info(
          `[emporium onGained] awarding 2 victory tokens to player ${eventArgs.playerId}`,
        );
        await args.runGameActionDelegate('gainVictoryToken', {
          playerId: eventArgs.playerId,
          count: 2,
        });
      },
    }),
  },
  'settlers': {
    registerEffects: () => async (args) => {
      // Settlers draws a card, gains an action, then optionally retrieves a Copper from discard.
      console.debug(
        `[settlers effect] drawing 1 card and gaining 1 action`,
      );
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.runGameActionDelegate('gainAction', {count: 1});

      const copperInDiscard = args.findCards([{
        location: 'playerDiscard',
        playerId: args.playerId,
      }, {cardKeys: 'copper'}]);

      if (!copperInDiscard.length) {
        console.debug(`[settlers effect] no Copper in discard to reveal`);
        return;
      }

      console.debug(
        `[settlers effect] prompting player ${args.playerId} to reveal Copper from discard`,
      );
      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: 'Reveal a Copper to put into your hand',
        restrict: copperInDiscard.map((card) => card.id),
        count: 1,
        optional: true,
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[settlers effect] player chose not to reveal Copper`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
      console.info(
        `[settlers effect] revealing ${selectedCard} from discard to hand`,
      );
      await args.runGameActionDelegate('revealCard', {
        playerId: args.playerId,
        cardId: selectedCard.id,
      });
      await args.runGameActionDelegate('moveCard', {
        cardId: selectedCard.id,
        toPlayerId: args.playerId,
        to: {location: 'playerHand'},
      });
    },
  },
  'bustling-village': {
    registerEffects: () => async (args) => {
      // Bustling Village draws a card, gains 3 actions, then optionally retrieves a Settlers from discard.
      console.debug(
        `[bustling village effect] drawing 1 card and gaining 3 actions`,
      );
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 1,
      });
      await args.runGameActionDelegate('gainAction', {count: 3});

      const settlersInDiscard = args.findCards([{
        location: 'playerDiscard',
        playerId: args.playerId,
      }, {cardKeys: 'settlers'}]);

      if (!settlersInDiscard.length) {
        console.debug(`[bustling village effect] no Settlers in discard to reveal`);
        return;
      }

      console.debug(
        `[bustling village effect] prompting player ${args.playerId} to reveal Settlers from discard`,
      );
      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: 'Reveal a Settlers to put into your hand',
        restrict: settlersInDiscard.map((card) => card.id),
        count: 1,
        optional: true,
      }) as CardId[];

      if (!selectedCardIds.length) {
        console.debug(`[bustling village effect] player chose not to reveal Settlers`);
        return;
      }

      const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
      console.info(
        `[bustling village effect] revealing ${selectedCard} from discard to hand`,
      );
      await args.runGameActionDelegate('revealCard', {
        playerId: args.playerId,
        cardId: selectedCard.id,
      });
      await args.runGameActionDelegate('moveCard', {
        cardId: selectedCard.id,
        toPlayerId: args.playerId,
        to: {location: 'playerHand'},
      });
    },
  },
  'temple': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Temple gathers VP tokens on its pile; gaining it transfers them to the player.
        const tokensOnPile = Object.values(args.match.tokens).filter((token) =>
          token.tokenId === prosperityTokenIds.victory &&
          token.location.type === 'supplyPile' &&
          token.location.cardKey === 'temple'
        );

        if (!tokensOnPile.length) {
          console.debug(`[temple onGained] no victory tokens on Temple pile`);
          return;
        }

        console.info(
          `[temple onGained] moving ${tokensOnPile.length} victory token(s) to player ${eventArgs.playerId}`,
        );

        for (const token of tokensOnPile) {
          await args.runGameActionDelegate('moveToken', {
            tokenInstanceId: token.id,
            location: {type: 'player', playerId: eventArgs.playerId},
            ownerId: eventArgs.playerId,
          });
        }
      },
    }),
    registerEffects: () => async (args) => {
      // Temple grants 1 VP, trashes 1-3 differently named cards, then adds a VP token to the pile.
      console.debug(`[temple effect] gaining 1 victory token`);
      await args.runGameActionDelegate('gainVictoryToken', {
        playerId: args.playerId,
        count: 1,
      });

      // Build a list of unique-name cards in hand for the trash selection.
      const handCardIds = [
        ...args.cardSourceController.getSource('playerHand', args.playerId),
      ];
      const uniqueCandidates: { id: CardId; name: string }[] = [];
      const seenNames = new Set<string>();
      for (const cardId of handCardIds) {
        const card = args.cardLibrary.getCard(cardId);
        const cardName = card.cardName ?? card.cardKey;
        if (seenNames.has(cardName)) continue;
        seenNames.add(cardName);
        uniqueCandidates.push({id: cardId, name: cardName});
      }

      if (!uniqueCandidates.length) {
        console.debug(`[temple effect] no cards in hand to trash`);
      } else {
        const maxSelectable = Math.min(3, uniqueCandidates.length);
        console.debug(
          `[temple effect] prompting player ${args.playerId} to trash 1 to ${maxSelectable} card(s)`,
        );
        // Use a range count so the player can choose 1-3 cards in a single prompt.
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: args.playerId,
          prompt: `Trash 1 to ${maxSelectable} differently named cards`,
          restrict: uniqueCandidates.map((candidate) => candidate.id),
          count: {kind: 'range', min: 1, max: maxSelectable},
          optional: false,
        }) as CardId[];

        if (!selectedCardIds.length) {
          console.warn(`[temple effect] no card selected to trash`);
        } else {
          console.info(
            `[temple effect] trashing ${selectedCardIds.length} card(s)`,
          );
          for (const cardId of selectedCardIds) {
            await args.runGameActionDelegate('trashCard', {
              playerId: args.playerId,
              cardId,
            });
          }
        }
      }

      // Always add a victory token to the Temple pile after resolving trashing.
      console.debug(`[temple effect] placing 1 victory token on Temple pile`);
      await args.runGameActionDelegate('placeToken', {
        tokenId: prosperityTokenIds.victory,
        location: {type: 'supplyPile', cardKey: 'temple'},
      });
    },
  },
  'wild-hunt': {
    registerEffects: () => async (args) => {
      // Wild Hunt lets the player choose between drawing and gathering VP, or gaining an Estate to claim VP.
      const tokensOnPileCount = Object.values(args.match.tokens).filter((token) =>
        token.tokenId === prosperityTokenIds.victory &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'wild-hunt'
      ).length;

      console.debug(
        `[wild hunt effect] prompting player ${args.playerId} to choose an option (pile VP: ${tokensOnPileCount})`,
      );
      const choice = await args.runGameActionDelegate('userPrompt', {
        playerId: args.playerId,
        prompt: 'Choose one',
        actionButtons: [
          {action: 1, label: '+3 Cards and add 1VP to the pile'},
          {
            action: 2,
            label:
              `Gain an Estate and take the ${tokensOnPileCount}VP from the pile`,
          },
        ],
      }) as { action: number };

      if (choice.action === 1) {
        // Option 1: draw 3 cards, then gather a VP token on the Wild Hunt pile.
        console.debug(`[wild hunt effect] drawing 3 cards`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: 3,
        });

        console.debug(
          `[wild hunt effect] placing 1 victory token on Wild Hunt pile`,
        );
        await args.runGameActionDelegate('placeToken', {
          tokenId: prosperityTokenIds.victory,
          location: {type: 'supplyPile', cardKey: 'wild-hunt'},
        });
        return;
      }

      // Option 2: gain an Estate; only if gained do we take VP tokens from the pile.
      const estateCards = args.findCards([{location: 'basicSupply'}, {
        cardKeys: 'estate',
      }]);
      const estateCardId = estateCards.slice(-1)[0]?.id;
      if (!estateCardId) {
        console.debug(
          `[wild hunt effect] no Estates left to gain, skipping VP tokens`,
        );
        return;
      }

      console.info(`[wild hunt effect] gaining an Estate`);
      await args.runGameActionDelegate('gainCard', {
        playerId: args.playerId,
        cardId: estateCardId,
        to: {location: 'playerDiscard'},
      });

      // Move any gathered VP tokens from the Wild Hunt pile to the player.
      const tokensOnPile = Object.values(args.match.tokens).filter((token) =>
        token.tokenId === prosperityTokenIds.victory &&
        token.location.type === 'supplyPile' &&
        token.location.cardKey === 'wild-hunt'
      );

      if (!tokensOnPile.length) {
        console.debug(`[wild hunt effect] no victory tokens on pile`);
        return;
      }

      console.info(
        `[wild hunt effect] moving ${tokensOnPile.length} victory token(s) to player ${args.playerId}`,
      );
      for (const token of tokensOnPile) {
        await args.runGameActionDelegate('moveToken', {
          tokenInstanceId: token.id,
          location: {type: 'player', playerId: args.playerId},
          ownerId: args.playerId,
        });
      }
    },
  },
  'villa': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Villa moves to hand, grants +1 Action, and can return you to the action phase.
        console.debug(
          `[villa onGained] player ${eventArgs.playerId} gained Villa`,
        );

        const villaCard = args.cardLibrary.getCard(eventArgs.cardId);

        console.info(
          `[villa onGained] moving ${villaCard} to hand for player ${eventArgs.playerId}`,
        );
        await args.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: {location: 'playerHand'},
        });

        const currentPlayerId = getCurrentPlayer(args.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          console.info(
            `[villa onGained] gained off-turn, skipping action gain and phase change`,
          );
          return;
        }

        console.debug(`[villa onGained] gaining 1 action`);
        await args.runGameActionDelegate('gainAction', {count: 1});

        const isBuyPhase = getTurnPhase(args.match.turnPhaseIndex) === 'buy';
        if (!isBuyPhase) {
          console.debug(`[villa onGained] not in buy phase, no phase change`);
          return;
        }

        await args.runGameActionDelegate('setTurnPhase', {
          phase: 'action',
          playerId: eventArgs.playerId,
          endCurrentPhase: true,
          startNewPhase: true,
        });
      },
    }),
    registerEffects: () => async (args) => {
      // Villa grants actions, a buy, and treasure when played.
      console.debug(`[villa effect] gaining 2 actions`);
      await args.runGameActionDelegate('gainAction', {count: 2});
      console.debug(`[villa effect] gaining 1 buy`);
      await args.runGameActionDelegate('gainBuy', {count: 1});
      console.debug(`[villa effect] gaining 1 treasure`);
      await args.runGameActionDelegate('gainTreasure', {count: 1});
    },
  },
  'sacrifice': {
    registerEffects: () => async (args) => {
      // Sacrifice trashes a card from hand and grants bonuses based on its types.
      const hand = args.cardSourceController.getSource(
        'playerHand',
        args.playerId,
      );
      if (!hand.length) {
        console.debug(`[sacrifice effect] no cards in hand to trash`);
        return;
      }

      console.debug(
        `[sacrifice effect] prompting player ${args.playerId} to trash a card`,
      );
      const selectedCardIds = await args.runGameActionDelegate('selectCard', {
        playerId: args.playerId,
        prompt: 'Trash a card',
        restrict: {location: 'playerHand', playerId: args.playerId},
        count: 1,
      }) as CardId[];

      if (!selectedCardIds?.length) {
        console.warn(`[sacrifice effect] no card selected to trash`);
        return;
      }

      const trashedCard = args.cardLibrary.getCard(selectedCardIds[0]);
      console.debug(`[sacrifice effect] trashing ${trashedCard}`);
      await args.runGameActionDelegate('trashCard', {
        playerId: args.playerId,
        cardId: trashedCard.id,
      });

      // Apply all bonuses that match the trashed card's types.
      const isAction = trashedCard.type.includes('ACTION');
      const isTreasure = trashedCard.type.includes('TREASURE');
      const isVictory = trashedCard.type.includes('VICTORY');

      console.debug(
        `[sacrifice effect] trashed types action=${isAction} treasure=${isTreasure} victory=${isVictory}`,
      );

      if (isAction) {
        console.debug(`[sacrifice effect] gaining 2 cards and 2 actions`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: 2,
        });
        await args.runGameActionDelegate('gainAction', {count: 2});
      }

      if (isTreasure) {
        console.debug(`[sacrifice effect] gaining 2 treasure`);
        await args.runGameActionDelegate('gainTreasure', {count: 2});
      }

      if (isVictory) {
        console.debug(`[sacrifice effect] gaining 2 victory tokens`);
        await args.runGameActionDelegate('gainVictoryToken', {
          playerId: args.playerId,
          count: 2,
        });
      }
    },
  },
  'royal-blacksmith': {
    registerEffects: () => async (args) => {
      // Royal Blacksmith draws 5 cards, reveals hand, then discards all Coppers from hand.
      console.debug(`[royal blacksmith effect] drawing 5 cards`);
      await args.runGameActionDelegate('drawCard', {
        playerId: args.playerId,
        count: 5,
      });

      const handCardIds = [
        ...args.cardSourceController.getSource('playerHand', args.playerId),
      ];
      console.debug(
        `[royal blacksmith effect] revealing ${handCardIds.length} cards in hand`,
      );
      for (const cardId of handCardIds) {
        await args.runGameActionDelegate('revealCard', {
          cardId,
          playerId: args.playerId,
        });
      }

      // Discard all Copper cards from the revealed hand.
      const copperCardIds = handCardIds
        .map((cardId) => args.cardLibrary.getCard(cardId))
        .filter((card) => card.cardKey === 'copper')
        .map((card) => card.id);

      if (!copperCardIds.length) {
        console.debug(`[royal blacksmith effect] no Coppers to discard`);
        return;
      }

      console.info(
        `[royal blacksmith effect] discarding ${copperCardIds.length} Copper(s)`,
      );
      for (const cardId of copperCardIds) {
        await args.runGameActionDelegate('discardCard', {
          playerId: args.playerId,
          cardId,
        });
      }
    },
  },
  'small-castle': {
    registerEffects: () => async (args) => {
      // Small Castle allows trashing itself or a Castle from hand to gain a Castle.
      const {playerId, cardId} = args;
      const castlesInHand = args.findCards([{
        location: 'playerHand',
        playerId,
      }, {cardType: ['CASTLE']}]);
      console.debug(
        `[small castle effect] castles in hand ${castlesInHand.length}`,
      );

      // Build a single list of trashable Castle ids (Small Castle in play plus any Castles in hand).
      const trashableCastleIds = [
        cardId,
        ...castlesInHand.map((card) => card.id),
      ]
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      // Track whether a trash action actually occurred for follow-up gain logic.
      let trashed = false;

      if (trashableCastleIds.length === 0) {
        console.debug(`[small castle effect] no castles available to trash`);
      } else if (trashableCastleIds.length === 1) {
        // Only one possible target, trash it immediately.
        const onlyId = trashableCastleIds[0];
        console.debug(
          `[small castle effect] only one castle to trash, trashing ${onlyId}`,
        );
        await args.runGameActionDelegate('trashCard', {
          playerId,
          cardId: onlyId,
        });
        trashed = true;
      } else {
        // Prompt with card ids when multiple Castles are available.
        console.debug(
          `[small castle effect] prompting to trash one of ${trashableCastleIds.length} castles`,
        );
        const selectedIds = await args.runGameActionDelegate('selectCard', {
          playerId,
          prompt: 'Trash a Castle',
          restrict: trashableCastleIds,
          count: 1,
        }) as CardId[];
        const selectedId = selectedIds[0];
        if (selectedId) {
          console.debug(`[small castle effect] trashing Castle ${selectedId}`);
          await args.runGameActionDelegate('trashCard', {
            playerId,
            cardId: selectedId,
          });
          trashed = true;
        }
      }

      if (!trashed) {
        console.debug(
          `[small castle effect] no Castle was trashed, skipping gain`,
        );
        return;
      }

      // Gain the current top Castle if a Castle was trashed.
      await gainTopCastleCard(args, playerId);
    },
  },
  'sprawling-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Sprawling Castle lets the gainer choose Duchy or 3 Estates.
        console.debug(
          `[sprawling castle onGained] player ${eventArgs.playerId} gained Sprawling Castle`,
        );
        const result = await args.runGameActionDelegate('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Gain a Duchy or 3 Estates?',
          actionButtons: [
            {action: 1, label: 'GAIN DUCHY'},
            {action: 2, label: 'GAIN 3 ESTATES'},
          ],
        }) as { action: number };

        if (result.action === 1) {
          await gainTopSupplyCard(args, {
            playerId: eventArgs.playerId,
            cardKey: 'duchy',
            location: 'basicSupply',
            to: {location: 'playerDiscard'},
            logTag: 'sprawling castle onGained',
          });
          return;
        }

        const estateCards = args.findCards([{location: 'basicSupply'}, {
          cardKeys: 'estate',
        }]);
        const estatesToGain = Math.min(3, estateCards.length);
        console.debug(
          `[sprawling castle onGained] gaining ${estatesToGain} estate(s)`,
        );
        for (let i = 0; i < estatesToGain; i += 1) {
          const estateId = estateCards.slice(-(i + 1))[0]?.id;
          if (!estateId) {
            break;
          }
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: estateId,
            to: {location: 'playerDiscard'},
          });
        }
      },
    }),
  },
};

export default expansion;
