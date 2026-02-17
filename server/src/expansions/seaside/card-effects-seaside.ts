import { CardExpansionModule } from '@server-types/index.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { Card, CardId } from 'shared/types/index.ts';
import { getPlayerStartingFrom, getPlayerTurnIndex } from '@shared/get-player-position-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isPlayerImmune, markPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansion: CardExpansionModule = {
  'astrolabe': {
    registerEffects: () => async (args) => {
      console.debug(`[SEASON EFFECT] gaining 1 treasure...`);
      await args.actionService.run('gainTreasure', { count: 1 });

      console.debug(`[SEASON EFFECT] gaining 1 buy...`);
      await args.actionService.run('gainBuy', { count: 1 });

      const id = `astrolabe:${args.cardId}:starTurn`;
      const card = args.cardLibrary.getCard(args.cardId);
      // Ensure the duration card remains in play through cleanup.
      args.registerDurationEffect(card, {
        id,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        compulsory: true,
        allowMultipleInstances: true,
        once: true,
        condition: (conditionArgs) => {
          const { trigger } = conditionArgs;
          return trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async ({ actionService }) => {
          await actionService.run('moveCard', {
            cardId: args.cardId,
            to: { location: 'playArea' },
          });
          console.debug(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
          await actionService.run('gainTreasure', { count: 1 }, { loggingContext: { source: args.cardId } });

          console.debug(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
          await actionService.run('gainBuy', { count: 1 }, { loggingContext: { source: args.cardId } });
        },
      });
    },
  },
  'bazaar': {
    registerEffects: () => async ({ actionService, playerId }) => {
      console.debug(`[SEASON EFFECT] drawing 1 card...`);
      await actionService.run('drawCard', { playerId: playerId });

      console.debug(`[SEASON EFFECT] gaining 2 actions...`);
      await actionService.run('gainAction', { count: 2 });

      console.debug(`[SEASON EFFECT] gaining 1 treasure...`);
      await actionService.run('gainTreasure', { count: 1 });
    },
  },
  'blockade': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`blockade:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (args) => {
      console.debug(`[BLOCKADE EFFECT] prompting user to select card...`);
      const gainedCardId = await args.actionService.run('selectSingleCard', {
        prompt: 'Gain card',
        playerId: args.playerId,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', amount: { treasure: 4 }, playerId: args.playerId },
        ],
        count: 1,
      }) as number | null;
      if (!gainedCardId) {
        console.warn('[BLOCKADE EFFECT] no card selected');
        return;
      }

      console.debug(`[BLOCKADE EFFECT] selected card ${args.cardLibrary.getCard(gainedCardId)}`);

      await args.actionService.run('gainCard', {
        playerId: args.playerId,
        cardId: gainedCardId,
        to: { location: 'set-aside' },
      });

      const blockadeCard = args.cardLibrary.getCard(args.cardId);
      // Keep the duration card in play until its start-turn effect resolves.
      args.registerDurationEffect(blockadeCard, {
        playerId: args.playerId,
        id: `blockade:${args.cardId}:startTurn`,
        once: true,
        condition: ({ trigger }) => trigger.args.playerId === args.playerId,
        listeningFor: 'startTurn',
        compulsory: true,
        triggeredEffectFn: async (triggeredArgs) => {
          console.debug(`[BLOCKADE TRIGGERED EFFECT] moving previously selected card to hand...`);
          await triggeredArgs.actionService.run('moveCard', {
            cardId: blockadeCard.id,
            to: { location: 'playArea' },
          });
          await triggeredArgs.actionService.run('moveCard', {
            cardId: gainedCardId,
            toPlayerId: args.playerId,
            to: { location: 'playerHand' },
          });

          args.reactionManager.unregisterTrigger(`blockade:${args.cardId}:cardGained`);
        },
      });

      const cardGained = args.cardLibrary.getCard(gainedCardId);

      args.reactionManager.registerReactionTemplate({
        playerId: args.playerId,
        id: `blockade:${args.cardId}:cardGained`,
        condition: (conditionArgs) => {
          if (getCurrentPlayer(args.match).id !== conditionArgs.trigger.args.playerId) {
            return false;
          }

          return conditionArgs.trigger.args.cardId !== undefined &&
            args.cardLibrary.getCard(conditionArgs.trigger.args.cardId).cardKey == cardGained.cardKey;
        },
        compulsory: true,
        listeningFor: 'cardGained',
        triggeredEffectFn: async (args) => {
          const curseCardIds = args.findCardService.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'curse' },
          ]);

          if (!curseCardIds.length) {
            console.debug(`[BLOCKADE TRIGGERED EFFECT] no curse cards in supply...`);
            return;
          }

          console.debug(`[BLOCKADE TRIGGERED EFFECT] gaining curse card to player's discard...`);
          await args.actionService.run('gainCard', {
            playerId: args.trigger.args.playerId!,
            cardId: curseCardIds[0].id,
            to: { location: 'playerDiscard' },
          }, { loggingContext: { source: args.trigger.args.cardId } });
        },
      });
    },
  },
  'caravan': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[CARAVAN EFFECT] drawing a card...`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });

      console.debug(`[CARAVAN EFFECT] gaining 1 action...`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const caravanCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      cardEffectArgs.registerDurationEffect(caravanCard, {
        id: `caravan:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        compulsory: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: caravanCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[CARAVAN TRIGGERED EFFECT] drawing a card...`);
          await triggeredArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId }, {
            loggingContext: { source: cardEffectArgs.cardId },
          });
        },
      });
    },
  },
  'corsair': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`corsair:${cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[CORSAIR EFFECT] gaining 2 treasure...`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const cardPlayedTriggerId = `corsair:${cardEffectArgs.cardId}:cardPlayed`;
      const corsairCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      cardEffectArgs.registerDurationEffect(corsairCard, {
        id: `corsair:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        compulsory: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: corsairCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[CORSAIR TRIGGERED EFFECT] drawing card...`);
          await triggeredArgs.actionService.run('drawCard', {
            playerId: cardEffectArgs.playerId,
          }, { loggingContext: { source: cardEffectArgs.cardId } });
          cardEffectArgs.reactionManager.unregisterTrigger(cardPlayedTriggerId);
        },
      });

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: cardPlayedTriggerId,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'cardPlayed',
        compulsory: true,
        condition: ({ match, trigger, cardLibrary }) => {
          if (!trigger.args.cardId || trigger.args.playerId === cardEffectArgs.playerId) return false;

          if (isPlayerImmune(cardEffectArgs.reactionContext, trigger.args.playerId!)) {
            console.debug(`[corsair triggered effect] ${getPlayerById(match, trigger.args.playerId!)} is immune`);
            return false;
          }

          const card = cardLibrary.getCard(trigger.args.cardId);

          if (!['silver', 'gold'].includes(card.cardKey)) return false;

          const playedSilverCards = Object.keys(match.stats.playedCards)
            .filter((cardId) => {
              const currentTurnHistoryIndex = match.stats.turns.length - 1;
              const playedStats = match.stats.playedCards[+cardId];
              return ['silver', 'gold'].includes(cardLibrary.getCard(+cardId).cardKey) &&
                playedStats.turnHistoryIndex === currentTurnHistoryIndex &&
                playedStats.playerId === trigger.args.playerId;
            });

          return playedSilverCards.length === 1;
        },
        triggeredEffectFn: async ({ trigger }) => {
          console.debug(`[CORSAIR TRIGGERED EFFECT] trashing card...`);
          await cardEffectArgs.actionService.run(
            'trashCard',
            {
              playerId: trigger.args.playerId!,
              cardId: trigger.args.cardId!,
            },
            {
              loggingContext: {
                source: cardEffectArgs.cardId,
              },
            },
          );
        },
      });
    },
  },
  'cutpurse': {
    registerEffects:
      () => async ({ actionService, playerId, match, reactionContext, cardLibrary, ...args }) => {
        console.debug(`[cutpurse effect] gaining 2 treasure...`);
        await actionService.run('gainTreasure', { count: 2 });

        const targetIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match,
        }).filter((id) => !isPlayerImmune(reactionContext, id));

        for (const targetId of targetIds) {
          const hand = args.cardSourceController.getSource('playerHand', targetId);
          const copperId = hand.find((cardId) => cardLibrary.getCard(cardId).cardKey === 'copper');
          if (copperId) {
            console.debug(`[cutpurse effect] discarding copper...`);
            await actionService.run('discardCard', {
              cardId: copperId,
              playerId: targetId,
            });
            continue;
          }

          console.debug(`[cutpurse effect] revealing hand...`);
          for (const cardId of hand) {
            await actionService.run('revealCard', {
              cardId,
              playerId: targetId,
            });
          }
        }
      },
  },
  'fishing-village': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[fishing village effect] gaining 2 action...`);
      await cardEffectArgs.actionService.run('gainAction', { count: 2 });

      console.debug(`[fishing village effect] gaining 1 treasure...`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 1 });

      const fishingVillageCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      cardEffectArgs.registerDurationEffect(fishingVillageCard, {
        id: `fishing-village:${cardEffectArgs.cardId}:startTurn`,
        once: true,
        compulsory: true,
        playerId: cardEffectArgs.playerId,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: fishingVillageCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[fishing village triggered effect] gaining 1 action...`);
          await triggeredArgs.actionService.run('gainAction', { count: 1 }, {
            loggingContext: { source: cardEffectArgs.cardId },
          });

          console.debug(`[fishing village triggered effect] gaining 1 treasure...`);
          await triggeredArgs.actionService.run('gainTreasure', { count: 1 }, {
            loggingContext: { source: cardEffectArgs.cardId },
          });
        },
      });
    },
  },
  'haven': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[haven effect] drawing card...`);
      await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId });

      console.debug(`[haven effect] gaining 1 action...`);
      await cardEffectArgs.actionService.run('gainAction', { count: 1 });

      const cardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        prompt: 'Choose card to set aside',
        playerId: cardEffectArgs.playerId,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      }) as number | null;

      if (!cardId) {
        console.warn('[haven effect] no card selected');
        return;
      }

      await cardEffectArgs.actionService.run('moveCard', {
        cardId,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'set-aside' },
        facing: 'back',
      });

      const havenCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      cardEffectArgs.registerDurationEffect(havenCard, {
        id: `haven:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        compulsory: true,
        once: true,
        playerId: cardEffectArgs.playerId,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggerEffectArgs) => {
          console.debug(`[haven triggered effect] moving selected card to hand...`);

          await triggerEffectArgs.actionService.run('moveCard', {
            cardId: havenCard.id,
            to: { location: 'playArea' },
          });
          await triggerEffectArgs.actionService.run('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
            facing: 'front',
          });
        },
      });
    },
  },
  'island': {
    registerEffects: () => async ({ actionService, playerId, cardId, ...effectArgs }) => {
      console.debug(`[ISLAND EFFECT] prompting user to select card...`);

      const selectedCardId = (await actionService.run('selectSingleCard', {
        prompt: 'Choose card',
        validPrompt: '',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      })) as number | null;

      console.debug(`[ISLAND EFFECT] moving island to island mat...`);

      await actionService.run('moveCard', {
        cardId,
        to: { location: 'island' },
        toPlayerId: playerId,
      });

      console.debug(`[ISLAND EFFECT] moving selected card to island mat...`);

      if (selectedCardId) {
        await actionService.run('moveCard', {
          cardId: selectedCardId,
          to: { location: 'island' },
          toPlayerId: playerId,
        });
      }
    },
  },
  'lighthouse': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async (args) => {
      // Register Lighthouse immunity and duration triggers via the shared duration flow.
      args.reactionManager.registerReactionTemplate({
        id: `lighthouse:${args.cardId}:cardPlayed`,
        playerId: args.playerId,
        listeningFor: 'cardPlayed',
        condition: ({ trigger, cardLibrary }) => {
          const playedCard = cardLibrary.getCard(trigger.args.cardId!);
          return trigger.args.cardId !== args.cardId && trigger.args.playerId !== args.playerId &&
            playedCard.type.includes('ATTACK');
        },
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        triggeredEffectFn: async ({ reactionContext }) => {
          // Record immunity so downstream attacks skip this player.
          console.debug(`[LIGHTHOUSE REACTION] granting immunity to player ${args.playerId}`);
          markPlayerImmune(args.playerId, reactionContext);
        },
      });

      const lighthouseCard = args.cardLibrary.getCard(args.cardId);
      // Keep the duration card active through cleanup.
      args.registerDurationEffect(lighthouseCard, {
        id: `lighthouse:${args.cardId}:startTurn`,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === args.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: lighthouseCard.id,
            to: { location: 'playArea' },
          });
          args.reactionManager.unregisterTrigger(`lighthouse:${args.cardId}:cardPlayed`);
          await triggeredArgs.actionService.run('gainTreasure', { count: 1 }, {
            loggingContext: { source: args.cardId },
          });
        },
      });

      console.debug(`[lighthouse effect] gaining 1 action...`);
      await args.actionService.run('gainAction', { count: 1 });

      console.debug(`[lighthouse effect] gaining 1 treasure...`);
      await args.actionService.run('gainTreasure', { count: 1 });
    },
  },
  'lookout': {
    registerEffects: () => async ({ actionService, playerId, match, ...args }) => {
      console.debug(`[LOOKOUT EFFECT] gaining 1 action...`);
      await actionService.run('gainAction', { count: 1 });

      const deck = args.cardSourceController.getSource('playerDeck', playerId);

      const cardIds = [] as CardId[];
      while (cardIds.length < 3) {
        let cardId = deck.slice(-1)[0];

        if (cardId === undefined) {
          await actionService.run('shuffleDeck', { playerId });
        }

        cardId = deck.slice(-1)[0];

        if (cardId === undefined) {
          console.debug(`[lookout effect] no card in deck`);
          break;
        }

        await actionService.run('moveCard', {
          cardId,
          to: { location: 'set-aside' },
        });

        cardIds.push(cardId);
      }

      const prompts = ['Trash one', 'Discard one'];
      const l = cardIds.length;

      for (let i = 0; i < l; i++) {
        let selectedId: number | undefined = undefined;

        if (cardIds.length === 1) {
          selectedId = cardIds[0];
        } else {
          const selectedIds = await actionService.run('userPrompt', {
            playerId,
            prompt: prompts[i],
            content: {
              type: 'select',
              cardIds,
              selectCount: 1,
            },
          }) as { result: number[] };

          selectedId = selectedIds.result[0];
        }

        cardIds.splice(cardIds.findIndex((id) => id === selectedId), 1);

        if (i === 0) {
          await actionService.run('trashCard', {
            playerId,
            cardId: selectedId,
          });
        } else if (i === 1) {
          await actionService.run('discardCard', {
            cardId: selectedId,
            playerId,
          });
        } else {
          await actionService.run('moveCard', {
            cardId: selectedId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' },
          });
        }
      }
    },
  },
  'merchant-ship': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[merchant ship effect] gaining 2 treasures...`);
      await cardEffectArgs.actionService.run('gainTreasure', { count: 2 });

      const merchantShipCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      cardEffectArgs.registerDurationEffect(merchantShipCard, {
        id: `merchant-ship:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        compulsory: true,
        allowMultipleInstances: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: merchantShipCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[merchant ship triggered effect] gaining 2 treasure...`);
          await triggeredArgs.actionService.run('gainTreasure', { count: 2 }, {
            loggingContext: { source: cardEffectArgs.cardId },
          });
        },
      });
    },
  },
  'monkey': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`monkey:${eventArgs.cardId}:cardGained`);
      },
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const monkeyCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      cardEffectArgs.registerDurationEffect(monkeyCard, {
        id: `monkey:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: monkeyCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[monkey triggered effect] drawing card at start of turn...`);
          await triggeredArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId }, {
            loggingContext: { source: cardEffectArgs.cardId },
          });

          cardEffectArgs.reactionManager.unregisterTrigger(`monkey:${cardEffectArgs.cardId}:cardGained`);
        },
      });

      const thisPlayerTurnIdx = cardEffectArgs.match.players.findIndex((p) => p.id === cardEffectArgs.playerId);
      const playerToRightId = getPlayerStartingFrom({
        startFromIdx: thisPlayerTurnIdx,
        match: cardEffectArgs.match,
        distance: -1,
      }).id;

      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `monkey:${cardEffectArgs.cardId}:cardGained`,
        playerId: cardEffectArgs.playerId,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'cardGained',
        once: false,
        triggeredEffectFn: async () => {
          console.debug(`[monkey triggered effect] drawing card, because player to the right gained a card...`);
          await cardEffectArgs.actionService.run('drawCard', { playerId: cardEffectArgs.playerId }, {
            loggingContext: { source: cardEffectArgs.cardId },
          });
        },
        condition: ({ trigger }) => trigger.args.playerId === playerToRightId,
      });
    },
  },
  'outpost': {
    registerEffects: () => async (cardEffectArgs) => {
      const outpostCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);

      // Limit the next hand draw to 3 cards, regardless of whether the extra turn is eventually taken.
      cardEffectArgs.reactionManager.registerSystemTemplate(
        outpostCard,
        'drawHand',
        {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggeredArgs) => {
            const previousCount = triggeredArgs.trigger.args.count;
            triggeredArgs.trigger.args.count = Math.min(previousCount, 3);
            console.info(
              `[outpost drawHand trigger] limiting next hand draw for player ${cardEffectArgs.playerId} from ${previousCount} to ${triggeredArgs.trigger.args.count}`,
            );
          },
        },
        { idSuffix: 'next-hand-limit' },
      );

      // Queue the extra turn; turn scheduling decides if this can be taken.
      await cardEffectArgs.actionService.run('queueExtraTurn', {
        turn: {
          playerId: cardEffectArgs.playerId,
          sourceId: cardEffectArgs.cardId,
        },
      });

      // Keep Outpost in duration state until the owner's next start-of-turn.
      cardEffectArgs.registerDurationEffect(outpostCard, {
        id: `outpost:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: outpostCard.id,
            to: { location: 'playArea' },
          });
        },
      });
    },
  },
  'pirate': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `pirate:${cardId}:cardGained`,
          playerId,
          compulsory: false,
          allowMultipleInstances: true,
          once: true,
          listeningFor: 'cardGained',
          condition: ({ cardLibrary, trigger }) => cardLibrary.getCard(trigger.args.cardId!).type.includes('TREASURE'),
          triggeredEffectFn: async ({ actionService }) => {
            await actionService.run('playCard', {
              playerId,
              cardId,
              overrides: {
                actionCost: 0,
              },
            }, { loggingContext: { source: cardId } });
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`pirate:${cardId}:cardGained`);
      },
      onLeavePlay: async (args, eventArgs) => {
      },
    }),
    registerEffects: () =>
    async ({
      reactionManager,
      playerId,
      match,
      cardId,
      actionService,
      ...effectArgs
    }) => {
      const id = `pirate:${cardId}:startTurn`;
      const pirateCard = effectArgs.cardLibrary.getCard(cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      effectArgs.registerDurationEffect(pirateCard, {
        id,
        playerId,
        listeningFor: 'startTurn',
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: ({
          trigger,
          reaction,
        }) => trigger.args.playerId === playerId && reaction.id === id,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: pirateCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[pirate triggered effect] prompting user to select treasure costing up to 6...`);
          const cardIds = (await triggeredArgs.actionService.run('selectCard', {
            prompt: 'Gain card',
            validPrompt: '',
            playerId,
            restrict: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { cardType: 'TREASURE' },
              { kind: 'upTo', amount: { treasure: 6 }, playerId },
            ],
            count: 1,
          })) as number[];

          const selectedCardId = cardIds[0];
          if (!selectedCardId) {
            console.warn(`[pirate triggered effect] no card selected...`);
            return;
          }

          console.debug(`[pirate triggered effect] gaining selected card to hand...`);
          await triggeredArgs.actionService.run('gainCard', {
            playerId,
            cardId: selectedCardId,
            to: { location: 'playerHand' },
          }, { loggingContext: { source: cardId } });
        },
      });
    },
  },
  'native-village': {
    registerEffects: () => async ({ actionService, playerId, match, ...args }) => {
      console.debug(`[NATIVE VILLAGE EFFECT] gaining 2 actions...`);
      await actionService.run('gainAction', { count: 2 });

      console.debug(`[NATIVE VILLAGE EFFECT] prompting user to choose...`);

      const result = (await actionService.run('userPrompt', {
        playerId,
        actionButtons: [
          { label: 'Put top card on mat', action: 1 },
          { label: 'Take cards from mat', action: 2 },
        ],
      })) as { action: number };

      if (result.action === 1) {
        const deck = args.cardSourceController.getSource('playerDeck', playerId);

        if (deck.length === 0) {
          console.debug(`[NATIVE VILLAGE EFFECT] shuffling deck...`);
          await actionService.run('shuffleDeck', {
            playerId,
          });
        }

        const cardId = deck.slice(-1)[0];

        if (!cardId) {
          console.debug(`[NATIVE VILLAGE EFFECT] no cards in deck...`);
          return;
        }

        console.debug(`[NATIVE VILLAGE EFFECT] moving card to native village mat...`);
        await actionService.run('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'native-village' },
        });

        return;
      }

      const matCardIds = args.findCardService.findCards({ location: 'native-village' });

      console.debug(`[NATIVE VILLAGE EFFECT] moving ${matCardIds.length} cards from native village mat to hand...`);
      for (const cardId of matCardIds) {
        await actionService.run('moveCard', {
          cardId: cardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' },
        });
      }
    },
  },
  'sailor': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`sailor:${cardId}:cardGained`);
        reactionManager.unregisterTrigger(`sailor:${cardId}:endTurn`);
      },
    }),
    registerEffects: () => async (args) => {
      // Register Sailor duration and helper triggers via the shared duration flow.
      args.reactionManager.registerReactionTemplate({
        id: `sailor:${args.cardId}:endTurn`,
        playerId: args.playerId,
        listeningFor: 'endTurn',
        compulsory: true,
        allowMultipleInstances: true,
        once: true,
        condition: () => true,
        triggeredEffectFn: async (triggerArgs) => {
          args.reactionManager.unregisterTrigger(`sailor:${args.cardId}:cardGained`);
          args.reactionManager.unregisterTrigger(`sailor:${args.cardId}:endTurn`);
        },
      });

      args.reactionManager.registerReactionTemplate({
        id: `sailor:${args.cardId}:cardGained`,
        playerId: args.playerId,
        listeningFor: 'cardGained',
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          const cardGained = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId!);

          if (!cardGained.type.includes('DURATION')) {
            return false;
          }

          if (conditionArgs.trigger.args.playerId !== args.playerId) {
            return false;
          }

          return conditionArgs.match.stats.playedCards[conditionArgs.trigger.args.cardId!] === undefined;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          console.debug(
            `[sailor triggered effect] playing ${
              triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId!)
            }`,
          );
          await triggeredArgs.actionService.run('playCard', {
            playerId: args.playerId,
            cardId: triggeredArgs.trigger.args.cardId!,
            overrides: { actionCost: 0 },
          }, { loggingContext: { source: args.cardId } });
        },
      });

      const sailorCard = args.cardLibrary.getCard(args.cardId);
      // Keep the duration card in play until its start-turn effect resolves.
      args.registerDurationEffect(sailorCard, {
        id: `sailor:${args.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: args.playerId,
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.args.playerId === args.playerId,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.actionService.run('moveCard', {
            cardId: sailorCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[sailor triggered effect] gaining 2 treasure...`);
          await triggeredArgs.actionService.run('gainTreasure', { count: 2 }, {
            loggingContext: { source: args.cardId },
          });

          const cardId = await triggeredArgs.actionService.run('selectSingleCard', {
            prompt: 'Trash card',
            playerId: args.playerId,
            restrict: args.cardSourceController.getSource('playerHand', args.playerId),
            count: 1,
            optional: true,
            cancelPrompt: `Don't trash`,
          }) as number | null;

          if (!cardId) {
            console.debug(`[sailor triggered effect] no card chosen`);
            return;
          }

          console.debug(`[sailor triggered effect] trashing selected card...`);
          await triggeredArgs.actionService.run('trashCard', {
            playerId: args.playerId,
            cardId,
          }, { loggingContext: { source: cardId } });
        },
      });

      console.debug(`[sailor effect] gaining 1 action...`);
      await args.actionService.run('gainAction', { count: 1 });
    },
  },
  'salvager': {
    registerEffects: () =>
    async ({
      cardPriceController,
      actionService,
      playerId,
      cardLibrary,
      ...effectArgs
    }) => {
      console.debug(`[salvager effect] gaining 1 buy...`);
      await actionService.run('gainBuy', { count: 1 });

      console.debug(`[salvager effect] prompting user to select a card from hand...`);
      const cardIds = (await actionService.run('selectCard', {
        prompt: 'Trash card',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      })) as number[];

      const cardId = cardIds[0];

      if (!cardId) {
        console.debug(`[salvager effect] no card selected...`);
        return;
      }

      console.debug(`[salvager effect] trashing card...`);
      await actionService.run('trashCard', { cardId, playerId });

      const card = cardLibrary.getCard(cardId);
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

      console.debug(`[salvager effect] gaining ${cardCost.treasure} buy...`);
      await actionService.run('gainTreasure', { count: cardCost.treasure });
    },
  },
  'sea-chart': {
    registerEffects: () => async ({ actionService, playerId, match, cardLibrary, ...args }) => {
      console.debug(`[SEA CHART EFFECT] drawing 1 card...`);
      await actionService.run('drawCard', { playerId });

      console.debug(`[SEA CHART EFFECT] gaining 1 action...`);
      await actionService.run('gainAction', { count: 1 });

      const deck = args.cardSourceController.getSource('playerDeck', playerId);

      if (deck.length === 0) {
        console.debug(`[SEA CHART EFFECT] shuffling deck...`);
        await actionService.run('shuffleDeck', { playerId });

        if (deck.length === 0) {
          console.debug(`[SEA CHART EFFECT] no cards in deck...`);
          return;
        }
      }

      const cardId = deck.slice(-1)[0];
      const card = cardLibrary.getCard(cardId);

      console.debug(`[SEA CHART EFFECT] revealing card...`);
      await actionService.run('revealCard', {
        cardId,
        playerId,
        moveToSetAside: true,
      });

      const copyInPlay = args.findCardService.findCards({ location: 'playArea' })
        .find((playAreaCard) => playAreaCard.cardKey === card.cardKey && playAreaCard.owner === playerId);

      console.debug(`[SEA CHART EFFECT] ${copyInPlay ? 'copy is in play' : 'no copy in play'}...`);

      console.debug(`[SEA CHART EFFECT] moving card to ${copyInPlay ? 'playerHand' : 'playerDeck'}...`);

      await actionService.run('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: copyInPlay ? 'playerHand' : 'playerDeck' },
      });
    },
  },
  'sea-witch': {
    registerEffects: () => async (args) => {
      const seaWitchCard = args.cardLibrary.getCard(args.cardId);
      // Keep the duration card active through cleanup.
      args.registerDurationEffect(seaWitchCard, {
        id: `sea-witch:${args.cardId}:startTurn`,
        playerId: args.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: (conditionArgs) => {
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.actionService.run('moveCard', {
            cardId: seaWitchCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[sea-witch triggered effect] drawing 2 cards...`);
          await triggerArgs.actionService.run('drawCard', {
            playerId: args.playerId,
            count: 2,
          }, { loggingContext: { source: args.cardId } });

          console.debug(`[sea-witch triggered effect] selecting discarding cards...`);

          const selectedCards = await triggerArgs.actionService.run('selectCard', {
            prompt: 'Discard cards',
            restrict: args.cardSourceController.getSource('playerHand', args.playerId),
            count: 2,
            playerId: args.playerId,
          }) as number[];

          for (const selectedCardId of selectedCards) {
            await triggerArgs.actionService.run('discardCard', {
              cardId: selectedCardId,
              playerId: args.playerId,
            }, { loggingContext: { source: args.cardId } });
          }
        },
      });

      console.debug(`[sea witch effect] drawing 2 cards...`);
      await args.actionService.run('drawCard', { playerId: args.playerId, count: 2 });

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: args.playerId,
        appliesTo: 'ALL_OTHER',
        match: args.match,
      }).filter((playerId) => !isPlayerImmune(args.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        const curseCardIds = args.findCardService.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' },
        ]);

        if (curseCardIds.length === 0) {
          console.debug(`[sea witch effect] no curses in supply...`);
          break;
        }

        console.debug(`[sea witch effect] giving curse to ${getPlayerById(args.match, targetPlayerId)}`);
        await args.actionService.run('gainCard', {
          cardId: curseCardIds[0].id,
          playerId: targetPlayerId,
          to: { location: 'playerDiscard' },
        });
      }
    },
  },
  'smugglers': {
    registerEffects: () => async (cardEffectArgs) => {
      const previousPlayer = getPlayerStartingFrom({
        startFromIdx: getPlayerTurnIndex({ match: cardEffectArgs.match, playerId: cardEffectArgs.playerId }),
        match: cardEffectArgs.match,
        distance: -1,
      });

      console.debug(`[smugglers effect] looking at ${previousPlayer} cards gained`);

      const cardsGained = cardEffectArgs.match.stats.cardsGained;
      const currentTurnHistoryIndex = cardEffectArgs.match.stats.turns.length - 1;
      const previousPlayerLastTurnHistoryIndex = (() => {
        for (let index = currentTurnHistoryIndex - 1; index >= 0; index--) {
          if (cardEffectArgs.match.stats.turns[index]?.playerId === previousPlayer.id) {
            return index;
          }
        }
        return undefined;
      })();

      const cardIdsGained = Object.keys(cardsGained)
        .map(Number)
        .filter((cardId) => {
          const gainStats = cardsGained[cardId];
          if (gainStats.playerId !== previousPlayer.id || previousPlayerLastTurnHistoryIndex === undefined) {
            return false;
          }
          return gainStats.turnHistoryIndex === previousPlayerLastTurnHistoryIndex;
        });

      let cards = cardEffectArgs.findCardService.findCards({ kind: 'upTo', amount: { treasure: 6 }, playerId: cardEffectArgs.playerId })
        .filter((card) => cardIdsGained.includes(card.id));

      console.debug(`[smugglers effect] found ${cards.length} costing up to 6 that were played`);

      const inSupply = (card: Card) =>
        cardEffectArgs.findCardService.findCards({ location: ['kingdomSupply', 'basicSupply'] })
          .find((supplyCard) => supplyCard.cardKey === card.cardKey);

      const cardsInSupply = cards.map(inSupply).filter((id) => id !== undefined);

      console.debug(`[smugglers effect] found ${cardsInSupply.length} available cards in supply to choose from`);

      if (!cardsInSupply.length) {
        return;
      }

      console.debug(`[smugglers effect] prompting user to select a card...`);

      const cardId = await cardEffectArgs.actionService.run('selectSingleCard', {
        playerId: cardEffectArgs.playerId,
        restrict: cardsInSupply.map((card) => card.id),
        prompt: `Gain a card`,
      }) as number | null;

      if (!cardId) {
        console.warn(`[smugglers effect] no card selected`);
        return;
      }

      console.debug(`[smugglers effect] gaining card...`);

      await cardEffectArgs.actionService.run('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardId,
        to: { location: 'playerDiscard' },
      });
    },
  },
  'tactician': {
    registerEffects: () => async (args) => {
      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      if (hand.length === 0) {
        console.debug(`[tactician effect] no cards in hand...`);
        return;
      }

      console.debug(`[tactician effect] discarding hand...`);
      for (const cardId of [...hand]) {
        await args.actionService.run('discardCard', { cardId, playerId: args.playerId });
      }

      const tacticianCard = args.cardLibrary.getCard(args.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      args.registerDurationEffect(tacticianCard, {
        id: `tactician:${args.cardId}:startTurn`,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.actionService.run('moveCard', {
            cardId: tacticianCard.id,
            to: { location: 'playArea' },
          });
          console.warn(`[tactician triggered effect] drawing 5 cards`);
          await triggerArgs.actionService.run('drawCard', {
            count: 5,
            playerId: args.playerId,
          }, { loggingContext: { source: args.cardId } });

          console.warn(`[tactician triggered effect] gaining 1 action`);
          await triggerArgs.actionService.run('gainAction', { count: 1 });

          console.warn(`[tactician triggered effect] gaining 1 buy`);
          await triggerArgs.actionService.run('gainBuy', { count: 1 });
        },
      });
    },
  },
  'tide-pools': {
    registerEffects: () => async (args) => {
      console.debug(`[tide pools effect] drawing 3 cards...`);
      await args.actionService.run('drawCard', { playerId: args.playerId, count: 3 });

      console.debug(`[tide pools effect] gaining 1 action...`);
      await args.actionService.run('gainAction', { count: 1 });

      const tidePoolsCard = args.cardLibrary.getCard(args.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      args.registerDurationEffect(tidePoolsCard, {
        id: `tide-pools:${args.cardId}:startTurn`,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === args.playerId,
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.actionService.run('moveCard', {
            cardId: tidePoolsCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[tide pools triggered effect] selecting two cards to discard`);
          const selectedCardIds = await triggerArgs.actionService.run('selectCard', {
            playerId: args.playerId,
            prompt: `Discard cards`,
            restrict: args.cardSourceController.getSource('playerHand', args.playerId),
            count: 2,
          });

          if (!selectedCardIds.length) {
            return;
          }

          for (const cardId of selectedCardIds) {
            await triggerArgs.actionService.run('discardCard', {
              cardId,
              playerId: args.playerId,
            }, { loggingContext: { source: cardId } });
          }
        },
      });
    },
  },
  'treasure-map': {
    registerEffects: () => async ({ actionService, playerId, cardId, match, cardLibrary, ...args }) => {
      console.debug(`[treasure map effect] trashing played treasure map...`);
      await actionService.run('trashCard', {
        playerId,
        cardId,
      });

      const hand = args.cardSourceController.getSource('playerHand', playerId);
      const inHand = hand.find((cardId) => cardLibrary.getCard(cardId).cardKey === 'treasure-map');

      console.debug(
        `[treasure map effect] ${inHand ? 'another treasure map is in hand' : 'no other treasure map in hand'}...`,
      );

      if (!inHand) {
        return;
      }

      console.debug(`[treasure map effect] trashing treasure map from hand...`);

      await actionService.run('trashCard', {
        playerId,
        cardId: inHand,
      });

      const goldCardIds = args.findCardService.findCards([{ location: 'basicSupply' }, { cardKeys: 'gold' }]);

      for (let i = 0; i < Math.min(goldCardIds.length, 4); i++) {
        await actionService.run('gainCard', {
          playerId,
          cardId: goldCardIds.slice(-i - 1)[0].id,
          to: { location: 'playerDeck' },
        });
      }
    },
  },
  'treasury': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`treasury:${cardId}:endTurnPhase`);
      },
    }),
    registerEffects: () => async (args) => {
      console.debug(`[treasury effect] drawing 1 card...`);
      await args.actionService.run('drawCard', { playerId: args.playerId });

      console.debug(`[treasury effect] gaining 1 action...`);
      await args.actionService.run('gainAction', { count: 1 });

      console.debug(`[treasury effect] gaining 1 treasure...`);
      await args.actionService.run('gainTreasure', { count: 1 });

      args.reactionManager.registerReactionTemplate({
        id: `treasury:${args.cardId}:endTurnPhase`,
        playerId: args.playerId,
        listeningFor: 'endTurnPhase',
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;

          const victoryCardsGained = Object.entries(conditionArgs.match.stats.cardsGained)
            .filter(([id, stats]) => {
              const currentTurnHistoryIndex = conditionArgs.match.stats.turns.length - 1;
              const gainedThisTurn = stats.turnHistoryIndex === currentTurnHistoryIndex;
              return gainedThisTurn &&
                conditionArgs.cardLibrary.getCard(+id).type.includes('VICTORY');
            }).map((results) => Number(results[0]));

          if (victoryCardsGained.length > 0) {
            return false;
          }

          return getCurrentPlayer(args.match).id === args.playerId;
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.actionService.run('moveCard', {
            cardId: args.cardId,
            toPlayerId: args.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });
    },
  },
  'warehouse': {
    registerEffects: () => async ({ actionService, playerId, ...effectArgs }) => {
      console.debug(`[warehouse effect] drawing 3 cards...`);
      await actionService.run('drawCard', { playerId, count: 3 });

      console.debug(`[warehouse effect] gaining 1 actions...`);
      await actionService.run('gainAction', { count: 1 });

      const cardIds = (await actionService.run('selectCard', {
        prompt: 'Discard cards',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 3,
      })) as number[];

      console.debug(`[warehouse effect] discarding cards...`);

      for (const cardId of cardIds) {
        await actionService.run('discardCard', {
          cardId,
          playerId,
        });
      }
    },
  },
  'wharf': {
    registerEffects: () => async (args) => {
      const wharfCard = args.cardLibrary.getCard(args.cardId);
      // Keep the duration card active through cleanup.
      args.registerDurationEffect(wharfCard, {
        id: `wharf:${args.cardId}:startTurn`,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          return conditionArgs.trigger.args.playerId === args.playerId;
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.actionService.run('moveCard', {
            cardId: wharfCard.id,
            to: { location: 'playArea' },
          });
          console.debug(`[wharf triggered effect] drawing 2 cards`);
          await triggerArgs.actionService.run('drawCard', {
            playerId: args.playerId,
            count: 2,
          }, { loggingContext: { source: args.cardId } });

          console.debug(`[wharf triggered effect] gaining 1 buy`);
          await triggerArgs.actionService.run('gainBuy', { count: 1 }, { loggingContext: { source: args.cardId } });
        },
      });

      console.debug(`[wharf effect] drawing 2 cards...`);
      await args.actionService.run('drawCard', { playerId: args.playerId, count: 2 });

      console.debug(`[wharf effect] gaining 1 buy...`);
      await args.actionService.run('gainBuy', { count: 1 });
    },
  },
};

export default expansion;
