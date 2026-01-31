import { CardExpansionModule, CardEffectFunctionContext } from '../../types.ts';
import { CardId, CardKey, PlayerId } from 'shared/shared-types';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';

type ArchiveEffectContext = Pick<CardEffectFunctionContext, 'runGameActionDelegate' | 'cardLibrary' | 'cardSourceController'>;

type GainTopSupplyContext = Pick<CardEffectFunctionContext, 'findCards' | 'runGameActionDelegate'>;

// Count the number of Castle cards owned by a player for variable scoring.
const countOwnedCastles = (args: { cardLibrary: CardEffectFunctionContext['cardLibrary']; ownerId: PlayerId; }) => {
  const ownedCards = args.cardLibrary.getCardsByOwner(args.ownerId);
  return ownedCards.filter(card => card.type.includes('CASTLE')).length;
};

// Resolve the top Castle card ID from the Castle split pile in the kingdom supply.
const getTopCastleCardId = (findCards: CardEffectFunctionContext['findCards']) => {
  const castleCards = findCards([{ location: 'kingdomSupply' }, { cardType: ['CASTLE'] }]);
  return castleCards.slice(-1)[0]?.id;
};

// Gain the top copy of a specific card from a supply location into a destination.
const gainTopSupplyCard = async (
  context: GainTopSupplyContext,
  args: { playerId: PlayerId; cardKey: CardKey; location: 'basicSupply' | 'kingdomSupply'; to: { location: 'playerDiscard' | 'playerDeck' }; logTag: string; }
) => {
  const supplyCards = context.findCards([{ location: args.location }, { cardKeys: [args.cardKey] }]);
  const topCardId = supplyCards.slice(-1)[0]?.id;
  if (!topCardId) {
    console.debug(`[${args.logTag}] no ${args.cardKey} remaining in ${args.location}`);
    return;
  }
  console.debug(`[${args.logTag}] gaining ${args.cardKey} to ${args.to.location}`);
  await context.runGameActionDelegate('gainCard', {
    playerId: args.playerId,
    cardId: topCardId,
    to: args.to,
  });
};

// Gain the current top Castle card to the player's discard pile.
const gainTopCastleCard = async (context: GainTopSupplyContext, playerId: PlayerId) => {
  const topCastleCardId = getTopCastleCardId(context.findCards);
  if (!topCastleCardId) {
    console.debug(`[castle pile] no castles left to gain`);
    return;
  }
  console.debug(`[castle pile] gaining top castle ${topCastleCardId} to discard`);
  await context.runGameActionDelegate('gainCard', {
    playerId,
    cardId: topCastleCardId,
    to: { location: 'playerDiscard' },
  });
};

// Apply the shared Crumbling Castle bonus (+1 VP and gain a Silver).
const resolveCrumblingCastleBonus = async (context: GainTopSupplyContext, playerId: PlayerId) => {
  console.debug(`[crumbling castle bonus] gaining 1 VP token`);
  await context.runGameActionDelegate('gainVictoryToken', { playerId, count: 1 });
  await gainTopSupplyCard(context, {
    playerId,
    cardKey: 'silver',
    location: 'basicSupply',
    to: { location: 'playerDiscard' },
    logTag: 'crumbling castle bonus',
  });
};

const expansion: CardExpansionModule = {
  'archive': {
    registerEffects: () => async (args) => {
      const { playerId, cardId } = args;

      console.debug(`[archive effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });

      const setAsideCardIds: CardId[] = [];
      console.info(`[archive effect] preparing to set aside up to 3 cards for player ${playerId}`);

      // Set aside up to 3 cards from the top of the deck, shuffling as needed.
      for (let i = 0; i < 3; i += 1) {
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        if (deck.length < 1) {
          await args.runGameActionDelegate('shuffleDeck', { playerId });
        }

        if (deck.length < 1) {
          console.debug(`[archive effect] no cards left to set aside`);
          break;
        }

        const topCardId = deck.slice(-1)[0];
        await args.runGameActionDelegate('moveCard', {
          cardId: topCardId,
          toPlayerId: playerId,
          to: { location: 'set-aside' },
          facing: 'back',
        });
        console.debug(`[archive effect] set aside card ${topCardId}`);
        setAsideCardIds.push(topCardId);
      }

      console.info(`[archive effect] set aside cards: ${setAsideCardIds.join(', ') || 'none'}`);

      const moveSetAsideCardToHand = async (effectArgs: ArchiveEffectContext) => {
        if (!setAsideCardIds.length) return;

        let chosenCardId: CardId | undefined = setAsideCardIds[0];
        if (setAsideCardIds.length > 1) {
          console.debug(`[archive effect] prompting selection from set-aside cards`);
          const selectionResult = await effectArgs.runGameActionDelegate('userPrompt', {
            playerId,
            prompt: 'Choose a set aside card',
            content: {
              type: 'select',
              cardIds: setAsideCardIds,
              selectableCardIds: setAsideCardIds,
              selectCount: 1,
            }
          }) as { result?: CardId[] };
          chosenCardId = selectionResult?.result?.[0] ?? chosenCardId;
        }

        if (!chosenCardId) return;

        console.info(`[archive effect] moving chosen set-aside card ${chosenCardId} to hand`);
        await effectArgs.runGameActionDelegate('moveCard', {
          cardId: chosenCardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
          facing: 'front',
        });

        const idx = setAsideCardIds.indexOf(chosenCardId);
        if (idx >= 0) {
          setAsideCardIds.splice(idx, 1);
        }
        console.info(`[archive effect] remaining set-aside cards: ${setAsideCardIds.join(', ') || 'none'}`);
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
        condition: ({ trigger }) => trigger.args.playerId === playerId && setAsideCardIds.length > 0,
        triggeredEffectFn: async (triggeredArgs) => {
          console.info(`[archive trigger] startTurn for player ${playerId}, remaining: ${setAsideCardIds.length}`);
          console.debug(`[archive triggered effect] moving Archive back to play area...`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId,
            to: { location: 'playArea' },
          });

          await moveSetAsideCardToHand(triggeredArgs);

          // When the last card is taken, remove lingering duration triggers.
          if (setAsideCardIds.length <= 0) {
            console.info(`[archive trigger] set-aside cards exhausted; cleaning up duration triggers`);
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
      await args.runGameActionDelegate('gainTreasure', { count: 6 });
      // Gain the extra buy from Capital.
      await args.runGameActionDelegate('gainBuy', { count: 1 });
    },
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        // Only apply debt when Capital is discarded from play.
        const previousLocation = eventArgs.previousLocation?.location;
        if (previousLocation !== 'playArea') {
          console.debug(`[capital onDiscarded] not discarded from play, skipping`);
          return;
        }
        // Apply the debt penalty when Capital leaves play.
        console.debug(`[capital onDiscarded] gaining +6 debt for player ${eventArgs.playerId}`);
        await args.runGameActionDelegate('gainDebt', { playerId: eventArgs.playerId, count: 6 });
      },
    }),
  },
  'crumbling-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Apply the Crumbling Castle bonus when gained.
        console.debug(`[crumbling castle onGained] player ${eventArgs.playerId} gained Crumbling Castle`);
        await resolveCrumblingCastleBonus(args, eventArgs.playerId);
      },
      onTrashed: async (args, eventArgs) => {
        // Apply the Crumbling Castle bonus when trashed.
        console.debug(`[crumbling castle onTrashed] player ${eventArgs.playerId} trashed Crumbling Castle`);
        await resolveCrumblingCastleBonus(args, eventArgs.playerId);
      },
    }),
  },
  'haunted-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Haunted Castle only triggers when gained on the current player's turn.
        const currentPlayerId = getCurrentPlayer(args.match).id;
        if (currentPlayerId !== eventArgs.playerId) {
          console.debug(`[haunted castle onGained] not current player's turn, skipping`);
          return;
        }

        console.debug(`[haunted castle onGained] player ${eventArgs.playerId} gained Haunted Castle`);
        await gainTopSupplyCard(args, {
          playerId: eventArgs.playerId,
          cardKey: 'gold',
          location: 'basicSupply',
          to: { location: 'playerDiscard' },
          logTag: 'haunted castle onGained',
        });

        const targetPlayerIds = findOrderedTargets({
          startingPlayerId: eventArgs.playerId,
          appliesTo: 'ALL_OTHER',
          match: args.match,
        });

        for (const targetPlayerId of targetPlayerIds) {
          const targetHand = args.findCards({ location: 'playerHand', playerId: targetPlayerId });
          if (targetHand.length < 5) {
            console.debug(`[haunted castle onGained] player ${targetPlayerId} has fewer than 5 cards, skipping`);
            continue;
          }

          console.debug(`[haunted castle onGained] prompting player ${targetPlayerId} to put 2 cards on deck`);
          const selectedIds = await args.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: 'Put 2 cards from your hand onto your deck',
            restrict: { location: 'playerHand', playerId: targetPlayerId },
            count: 2,
          }) as CardId[];

          for (const selectedId of selectedIds) {
            console.debug(`[haunted castle onGained] moving ${selectedId} to deck for player ${targetPlayerId}`);
            await args.runGameActionDelegate('moveCard', {
              cardId: selectedId,
              toPlayerId: targetPlayerId,
              to: { location: 'playerDeck' },
            });
          }
        }
      },
    }),
  },
  'humble-castle': {
    registerScoringFunction: () => (args) => {
      // Humble Castle is worth 1 VP per Castle you have.
      const castleCount = countOwnedCastles({ cardLibrary: args.cardLibrary, ownerId: args.ownerId });
      console.debug(`[humble castle scoring] owner ${args.ownerId} castles ${castleCount}`);
      return castleCount;
    },
    registerEffects: () => async (args) => {
      // Humble Castle is a Treasure that produces $1.
      console.debug(`[humble castle effect] gaining 1 treasure`);
      await args.runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'grand-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Grand Castle grants VP tokens based on Victory cards in hand and in play.
        const victoryInHand = args.findCards({ location: 'playerHand', playerId: eventArgs.playerId })
          .filter(card => card.type.includes('VICTORY'));
        const victoryInPlay = getCardsInPlay(args.findCards)
          .filter(card => card.type.includes('VICTORY'));
        const totalVictoryCards = victoryInHand.length + victoryInPlay.length;
        console.debug(`[grand castle onGained] granting ${totalVictoryCards} VP tokens`);
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
      const castleCount = countOwnedCastles({ cardLibrary: args.cardLibrary, ownerId: args.ownerId });
      const score = castleCount * 2;
      console.debug(`[king's castle scoring] owner ${args.ownerId} castles ${castleCount} score ${score}`);
      return score;
    },
  },
  'opulent-castle': {
    registerEffects: () => async (args) => {
      // Opulent Castle discards Victory cards for +$2 each.
      const { playerId } = args;
      const victoryCardsInHand = args.findCards([{ location: 'playerHand', playerId }, { cardType: ['VICTORY'] }]);
      if (victoryCardsInHand.length === 0) {
        console.debug(`[opulent castle effect] no Victory cards in hand to discard`);
        return;
      }

      console.debug(`[opulent castle effect] prompting to discard Victory cards`);
      const selectedIds = await args.runGameActionDelegate('selectCard', {
        playerId,
        prompt: 'Discard any number of Victory cards',
        restrict: victoryCardsInHand.map(card => card.id),
        count: { kind: 'upTo', count: victoryCardsInHand.length },
        optional: true,
      }) as CardId[];

      if (selectedIds.length === 0) {
        console.debug(`[opulent castle effect] no cards discarded`);
        return;
      }

      for (const selectedId of selectedIds) {
        console.debug(`[opulent castle effect] discarding Victory card ${selectedId}`);
        await args.runGameActionDelegate('discardCard', { playerId, cardId: selectedId });
      }

      const treasureGain = selectedIds.length * 2;
      console.debug(`[opulent castle effect] gaining ${treasureGain} treasure`);
      await args.runGameActionDelegate('gainTreasure', { count: treasureGain });
    }
  },
  'small-castle': {
    registerEffects: () => async (args) => {
      // Small Castle allows trashing itself or a Castle from hand to gain a Castle.
      const { playerId, cardId } = args;
      const castlesInHand = args.findCards([{ location: 'playerHand', playerId }, { cardType: ['CASTLE'] }]);
      console.debug(`[small castle effect] castles in hand ${castlesInHand.length}`);

      // Build a single list of trashable Castle ids (Small Castle in play plus any Castles in hand).
      const trashableCastleIds = [cardId, ...castlesInHand.map(card => card.id)]
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      // Track whether a trash action actually occurred for follow-up gain logic.
      let trashed = false;

      if (trashableCastleIds.length === 0) {
        console.debug(`[small castle effect] no castles available to trash`);
      } else if (trashableCastleIds.length === 1) {
        // Only one possible target, trash it immediately.
        const onlyId = trashableCastleIds[0];
        console.debug(`[small castle effect] only one castle to trash, trashing ${onlyId}`);
        await args.runGameActionDelegate('trashCard', { playerId, cardId: onlyId });
        trashed = true;
      } else {
        // Prompt with card ids when multiple Castles are available.
        console.debug(`[small castle effect] prompting to trash one of ${trashableCastleIds.length} castles`);
        const selectedIds = await args.runGameActionDelegate('selectCard', {
          playerId,
          prompt: 'Trash a Castle',
          restrict: trashableCastleIds,
          count: 1,
        }) as CardId[];
        const selectedId = selectedIds[0];
        if (selectedId) {
          console.debug(`[small castle effect] trashing Castle ${selectedId}`);
          await args.runGameActionDelegate('trashCard', { playerId, cardId: selectedId });
          trashed = true;
        }
      }

      if (!trashed) {
        console.debug(`[small castle effect] no Castle was trashed, skipping gain`);
        return;
      }

      // Gain the current top Castle if a Castle was trashed.
      await gainTopCastleCard(args, playerId);
    }
  },
  'sprawling-castle': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        // Sprawling Castle lets the gainer choose Duchy or 3 Estates.
        console.debug(`[sprawling castle onGained] player ${eventArgs.playerId} gained Sprawling Castle`);
        const result = await args.runGameActionDelegate('userPrompt', {
          playerId: eventArgs.playerId,
          prompt: 'Gain a Duchy or 3 Estates?',
          actionButtons: [
            { action: 1, label: 'GAIN DUCHY' },
            { action: 2, label: 'GAIN 3 ESTATES' },
          ],
        }) as { action: number };

        if (result.action === 1) {
          await gainTopSupplyCard(args, {
            playerId: eventArgs.playerId,
            cardKey: 'duchy',
            location: 'basicSupply',
            to: { location: 'playerDiscard' },
            logTag: 'sprawling castle onGained',
          });
          return;
        }

        const estateCards = args.findCards([{ location: 'basicSupply' }, { cardKeys: 'estate' }]);
        const estatesToGain = Math.min(3, estateCards.length);
        console.debug(`[sprawling castle onGained] gaining ${estatesToGain} estate(s)`);
        for (let i = 0; i < estatesToGain; i += 1) {
          const estateId = estateCards.slice(-(i + 1))[0]?.id;
          if (!estateId) {
            break;
          }
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: estateId,
            to: { location: 'playerDiscard' },
          });
        }
      },
    }),
  },
};

export default expansion;
