import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { Card, CardId } from 'shared/shared-types.ts';
import { getPlayerStartingFrom, getPlayerTurnIndex } from 'shared/get-player-position-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { isPlayerImmune, markPlayerImmune } from '../../utils/reaction-immunity.ts';

const expansion: CardExpansionModule = {
  'astrolabe': {
    registerEffects: () => async (args) => {
      console.debug(`[SEASON EFFECT] gaining 1 treasure...`);
      await args.runGameActionDelegate('gainTreasure', { count: 1 });

      console.debug(`[SEASON EFFECT] gaining 1 buy...`);
      await args.runGameActionDelegate('gainBuy', { count: 1 });

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
        triggeredEffectFn: async ({ runGameActionDelegate }) => {
          await runGameActionDelegate('moveCard', {
            cardId: args.cardId,
            to: { location: 'playArea' }
          });
          console.debug(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 1 }, { loggingContext: { source: args.cardId } });

          console.debug(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
          await runGameActionDelegate('gainBuy', { count: 1 }, { loggingContext: { source: args.cardId } });
        }
      });
    }
  },
  'bazaar': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.debug(`[SEASON EFFECT] drawing 1 card...`);
      await runGameActionDelegate('drawCard', { playerId: playerId });

      console.debug(`[SEASON EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });

      console.debug(`[SEASON EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'blockade': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`blockade:${eventArgs.cardId}:cardGained`);
      }
    }),
    registerEffects: () => async (args) => {
      console.debug(`[BLOCKADE EFFECT] prompting user to select card...`);
      const cardIds = await args.runGameActionDelegate('selectCard', {
        prompt: 'Gain card',
        playerId: args.playerId,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', amount: { treasure: 4 }, playerId: args.playerId },
        ],
        count: 1,
      }) as number[];

      const gainedCardId = cardIds[0];

      console.debug(`[BLOCKADE EFFECT] selected card ${args.cardLibrary.getCard(gainedCardId)}`);

      await args.runGameActionDelegate('gainCard', {
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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: blockadeCard.id,
            to: { location: 'playArea' }
          });
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: gainedCardId,
            toPlayerId: args.playerId,
            to: { location: 'playerHand' }
          });

          args.reactionManager.unregisterTrigger(`blockade:${args.cardId}:cardGained`);
        }
      });

      const cardGained = args.cardLibrary.getCard(gainedCardId);

      args.reactionManager.registerReactionTemplate({
        playerId: args.playerId,
        id: `blockade:${args.cardId}:cardGained`,
        condition: (conditionArgs) => {
          if (getCurrentPlayer(args.match).id !== conditionArgs.trigger.args.playerId) {
            return false;
          }

          return conditionArgs.trigger.args.cardId !== undefined && args.cardLibrary.getCard(conditionArgs.trigger.args.cardId).cardKey == cardGained.cardKey;
        },
        compulsory: true,
        listeningFor: 'cardGained',
        triggeredEffectFn: async (args) => {
          const curseCardIds = args.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'curse' }
          ]);

          if (!curseCardIds.length) {
            console.debug(`[BLOCKADE TRIGGERED EFFECT] no curse cards in supply...`);
            return
          }

          console.debug(`[BLOCKADE TRIGGERED EFFECT] gaining curse card to player's discard...`);
          await args.runGameActionDelegate('gainCard', {
            playerId: args.trigger.args.playerId!,
            cardId: curseCardIds[0].id,
            to: { location: 'playerDiscard' },
          }, { loggingContext: { source: args.trigger.args.cardId } });
        }
      })
    }
  },
  'caravan': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[CARAVAN EFFECT] drawing a card...`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });

      console.debug(`[CARAVAN EFFECT] gaining 1 action...`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: caravanCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[CARAVAN TRIGGERED EFFECT] drawing a card...`);
          await triggeredArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId }, {
            loggingContext: { source: cardEffectArgs.cardId }
          });
        }
      })
    }
  },
  'corsair': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`corsair:${cardId}:cardPlayed`);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[CORSAIR EFFECT] gaining 2 treasure...`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: corsairCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[CORSAIR TRIGGERED EFFECT] drawing card...`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId
          }, { loggingContext: { source: cardEffectArgs.cardId } });
          cardEffectArgs.reactionManager.unregisterTrigger(cardPlayedTriggerId);
        }
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
            .filter(cardId => {
              return ['silver', 'gold'].includes(cardLibrary.getCard(+cardId).cardKey) &&
                match.stats.playedCards[+cardId].turnNumber === match.turnNumber &&
                match.stats.playedCards[+cardId].playerId === trigger.args.playerId
            });

          return playedSilverCards.length === 1;
        },
        triggeredEffectFn: async ({ trigger }) => {
          console.debug(`[CORSAIR TRIGGERED EFFECT] trashing card...`);
          await cardEffectArgs.runGameActionDelegate(
            'trashCard',
            {
              playerId: trigger.args.playerId!,
              cardId: trigger.args.cardId!,
            },
            {
              loggingContext: {
                source: cardEffectArgs.cardId
              }
            }
          );
        }
      })
    }
  },
  'cutpurse': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, reactionContext, cardLibrary, ...args }) => {
      console.debug(`[cutpurse effect] gaining 2 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 2, });

      const targetIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match
      }).filter((id) => !isPlayerImmune(reactionContext, id));

      for (const targetId of targetIds) {
        const hand = args.cardSourceController.getSource('playerHand', targetId);
        const copperId = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'copper');
        if (copperId) {
          console.debug(`[cutpurse effect] discarding copper...`);
          await runGameActionDelegate('discardCard', {
            cardId: copperId,
            playerId: targetId
          });
          continue;
        }

        console.debug(`[cutpurse effect] revealing hand...`);
        for (const cardId of hand) {
          await runGameActionDelegate('revealCard', {
            cardId,
            playerId: targetId,
          });
        }
      }
    }
  },
  'fishing-village': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[fishing village effect] gaining 2 action...`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });

      console.debug(`[fishing village effect] gaining 1 treasure...`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });

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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: fishingVillageCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[fishing village triggered effect] gaining 1 action...`);
          await triggeredArgs.runGameActionDelegate('gainAction', { count: 1 }, {
            loggingContext: { source: cardEffectArgs.cardId }
          });

          console.debug(`[fishing village triggered effect] gaining 1 treasure...`);
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: 1 }, {
            loggingContext: { source: cardEffectArgs.cardId }
          });
        }
      })
    }
  },
  'haven': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[haven effect] drawing card...`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });


      console.debug(`[haven effect] gaining 1 action...`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });

      const cardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        prompt: 'Choose card to set aside',
        playerId: cardEffectArgs.playerId,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      }) as number[];

      const cardId = cardIds[0];

      if (!cardId) {
        console.warn('[haven effect] no card selected');
        return;
      }

      await cardEffectArgs.runGameActionDelegate('moveCard', {
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

          await triggerEffectArgs.runGameActionDelegate('moveCard', {
            cardId: havenCard.id,
            to: { location: 'playArea' }
          });
          await triggerEffectArgs.runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' },
            facing: 'front',
          });
        }
      });
    }
  },
  'island': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId, ...effectArgs }) => {
      console.debug(`[ISLAND EFFECT] prompting user to select card...`);

      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Choose card',
        validPrompt: '',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      })) as number[];

      console.debug(`[ISLAND EFFECT] moving island to island mat...`);

      await runGameActionDelegate('moveCard', {
        cardId,
        to: { location: 'island' },
        toPlayerId: playerId
      });

      const selectedCardId = cardIds[0];

      console.debug(`[ISLAND EFFECT] moving selected card to island mat...`);

      if (selectedCardId) {
        await runGameActionDelegate('moveCard', {
          cardId: selectedCardId,
          to: { location: 'island' },
          toPlayerId: playerId
        })
      }
    }
  },
  'lighthouse': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:cardPlayed`);
      }
    }),
    registerEffects: () => async (args) => {
      // Register Lighthouse immunity and duration triggers via the shared duration flow.
      args.reactionManager.registerReactionTemplate({
        id: `lighthouse:${args.cardId}:cardPlayed`,
        playerId: args.playerId,
        listeningFor: 'cardPlayed',
        condition: ({ trigger, cardLibrary }) => {
          const playedCard = cardLibrary.getCard(trigger.args.cardId!);
          return trigger.args.cardId !== args.cardId && trigger.args.playerId !== args.playerId && playedCard.type.includes('ATTACK');
        },
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        triggeredEffectFn: async ({ reactionContext }) => {
          // Record immunity so downstream attacks skip this player.
          console.debug(`[LIGHTHOUSE REACTION] granting immunity to player ${args.playerId}`);
          markPlayerImmune(args.playerId, reactionContext);
        }
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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: lighthouseCard.id,
            to: { location: 'playArea' }
          });
          args.reactionManager.unregisterTrigger(`lighthouse:${args.cardId}:cardPlayed`);
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: 1 }, {
            loggingContext: { source: args.cardId }
          });
        }
      })

      console.debug(`[lighthouse effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });

      console.debug(`[lighthouse effect] gaining 1 treasure...`);
      await args.runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'lookout': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, ...args }) => {
      console.debug(`[LOOKOUT EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });

      const deck = args.cardSourceController.getSource('playerDeck', playerId);

      const cardIds = [] as CardId[];
      while (cardIds.length < 3) {
        let cardId = deck.slice(-1)[0];

        if (cardId === undefined) {
          await runGameActionDelegate('shuffleDeck', { playerId });
        }

        cardId = deck.slice(-1)[0];

        if (cardId === undefined) {
          console.debug(`[lookout effect] no card in deck`)
          break;
        }

        await runGameActionDelegate('moveCard', {
          cardId,
          to: { location: 'set-aside' }
        });

        cardIds.push(cardId);
      }

      const prompts = ['Trash one', 'Discard one'];
      const l = cardIds.length;

      for (let i = 0; i < l; i++) {
        let selectedId: number | undefined = undefined;

        if (cardIds.length === 1) {
          selectedId = cardIds[0];
        }
        else {
          const selectedIds = await runGameActionDelegate('userPrompt', {
            playerId,
            prompt: prompts[i],
            content: {
              type: 'select',
              cardIds,
              selectCount: 1
            }
          }) as { result: number[] }

          selectedId = selectedIds.result[0];
        }

        cardIds.splice(cardIds.findIndex(id => id === selectedId), 1);

        if (i === 0) {
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId: selectedId,
          });
        }
        else if (i === 1) {
          await runGameActionDelegate('discardCard', {
            cardId: selectedId,
            playerId
          });
        }
        else {
          await runGameActionDelegate('moveCard', {
            cardId: selectedId,
            toPlayerId: playerId,
            to: { location: 'playerDeck' }
          });
        }
      }
    }
  },
  'merchant-ship': {
    registerEffects: () => async (cardEffectArgs) => {
      console.debug(`[merchant ship effect] gaining 2 treasures...`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });

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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: merchantShipCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[merchant ship triggered effect] gaining 2 treasure...`);
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: 2 }, {
            loggingContext: { source: cardEffectArgs.cardId }
          });
        }
      })
    }
  },
  'monkey': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`monkey:${eventArgs.cardId}:cardGained`)
      }
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
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: monkeyCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[monkey triggered effect] drawing card at start of turn...`);
          await triggeredArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId }, {
            loggingContext: { source: cardEffectArgs.cardId }
          });

          cardEffectArgs.reactionManager.unregisterTrigger(`monkey:${cardEffectArgs.cardId}:cardGained`);
        }
      });

      const thisPlayerTurnIdx = cardEffectArgs.match.players.findIndex(p => p.id === cardEffectArgs.playerId);
      const playerToRightId = getPlayerStartingFrom({
        startFromIdx: thisPlayerTurnIdx,
        match: cardEffectArgs.match,
        distance: -1
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
          await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId }, {
            loggingContext: { source: cardEffectArgs.cardId }
          });
        },
        condition: ({ trigger }) => trigger.args.playerId === playerToRightId
      });
    }
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
          triggeredEffectFn: async ({ runGameActionDelegate }) => {
            await runGameActionDelegate('playCard', {
              playerId,
              cardId,
              overrides: {
                actionCost: 0,
              }
            }, { loggingContext: { source: cardId } });
          }
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`pirate:${cardId}:cardGained`);
      },
      onLeavePlay: async (args, eventArgs) => {
      }
    }),
    registerEffects: () => async ({
      reactionManager,
      playerId,
      match,
      cardId,
      runGameActionDelegate,
      ...effectArgs
    }) => {
      const id = `pirate:${cardId}:startTurn`;
      const turnPlayed = match.stats.playedCards[cardId].turnNumber;
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
          reaction
        }) => trigger.args.playerId === playerId && reaction.id === id && match.turnNumber !== turnPlayed,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: pirateCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[pirate triggered effect] prompting user to select treasure costing up to 6...`);
          const cardIds = (await triggeredArgs.runGameActionDelegate('selectCard', {
            prompt: 'Gain card',
            validPrompt: '',
            playerId,
            restrict: [
              { location: ['basicSupply', 'kingdomSupply'] },
              { cardType: 'TREASURE' },
              { kind: 'upTo', amount: { treasure: 6 }, playerId }
            ],
            count: 1,
          })) as number[];

          const selectedCardId = cardIds[0];
          if (!selectedCardId) {
            console.warn(`[pirate triggered effect] no card selected...`);
            return;
          }

          console.debug(`[pirate triggered effect] gaining selected card to hand...`);
          await triggeredArgs.runGameActionDelegate('gainCard', {
            playerId,
            cardId: selectedCardId,
            to: { location: 'playerHand' },
          }, { loggingContext: { source: cardId } });
        }
      });
    }
  },
  'native-village': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, ...args }) => {
      console.debug(`[NATIVE VILLAGE EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });

      console.debug(`[NATIVE VILLAGE EFFECT] prompting user to choose...`);

      const result = (await runGameActionDelegate('userPrompt', {
        playerId,
        actionButtons: [
          { label: 'Put top card on mat', action: 1 },
          { label: 'Take cards from mat', action: 2 }
        ]
      })) as { action: number };

      if (result.action === 1) {
        const deck = args.cardSourceController.getSource('playerDeck', playerId);

        if (deck.length === 0) {
          console.debug(`[NATIVE VILLAGE EFFECT] shuffling deck...`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
        }

        const cardId = deck.slice(-1)[0];

        if (!cardId) {
          console.debug(`[NATIVE VILLAGE EFFECT] no cards in deck...`);
          return;
        }

        console.debug(`[NATIVE VILLAGE EFFECT] moving card to native village mat...`);
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'native-village' }
        });

        return;
      }

      const matCardIds = args.findCards({ location: 'native-village'});

      console.debug(`[NATIVE VILLAGE EFFECT] moving ${matCardIds.length} cards from native village mat to hand...`);
      for (const cardId of matCardIds) {
        await runGameActionDelegate('moveCard', {
          cardId: cardId,
          toPlayerId: playerId,
          to: { location: 'playerHand' }
        });
      }
    }
  },
  'sailor': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`sailor:${cardId}:cardGained`);
        reactionManager.unregisterTrigger(`sailor:${cardId}:endTurn`);
      }
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
        }
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
          console.debug(`[sailor triggered effect] playing ${triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId!)}`);
          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: args.playerId,
            cardId: triggeredArgs.trigger.args.cardId!,
            overrides: { actionCost: 0 }
          }, { loggingContext: { source: args.cardId } });
        }
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
        condition: ({ trigger, match }) =>
          trigger.args.playerId === args.playerId && match.stats.playedCards[args.cardId].turnNumber !== match.turnNumber,
        triggeredEffectFn: async (triggeredArgs) => {
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: sailorCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[sailor triggered effect] gaining 2 treasure...`);
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: 2 }, {
            loggingContext: { source: args.cardId }
          });

          const cardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            prompt: 'Trash card',
            playerId: args.playerId,
            restrict: args.cardSourceController.getSource('playerHand', args.playerId),
            count: 1,
            optional: true,
            cancelPrompt: `Don't trash`
          }) as number[];

          const cardId = cardIds[0];

          if (!cardId) {
            console.debug(`[sailor triggered effect] no card chosen`);
            return;
          }

          console.debug(`[sailor triggered effect] trashing selected card...`);
          await triggeredArgs.runGameActionDelegate('trashCard', {
            playerId: args.playerId,
            cardId,
          }, { loggingContext: { source: cardId } });
        }
      });

      console.debug(`[sailor effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });
    }
  },
  'salvager': {
    registerEffects: () => async ({
      cardPriceController,
      runGameActionDelegate,
      playerId,
      cardLibrary,
      ...effectArgs
    }) => {
      console.debug(`[salvager effect] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', { count: 1 });

      console.debug(`[salvager effect] prompting user to select a card from hand...`);
      const cardIds = (await runGameActionDelegate('selectCard', {
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
      await runGameActionDelegate('trashCard', { cardId, playerId });

      const card = cardLibrary.getCard(cardId);
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });

      console.debug(`[salvager effect] gaining ${cardCost.treasure} buy...`);
      await runGameActionDelegate('gainTreasure', { count: cardCost.treasure });
    }
  },
  'sea-chart': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, cardLibrary, ...args }) => {
      console.debug(`[SEA CHART EFFECT] drawing 1 card...`);
      await runGameActionDelegate('drawCard', { playerId });

      console.debug(`[SEA CHART EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });

      const deck = args.cardSourceController.getSource('playerDeck', playerId);

      if (deck.length === 0) {
        console.debug(`[SEA CHART EFFECT] shuffling deck...`);
        await runGameActionDelegate('shuffleDeck', { playerId });

        if (deck.length === 0) {
          console.debug(`[SEA CHART EFFECT] no cards in deck...`);
          return;
        }
      }

      const cardId = deck.slice(-1)[0];
      const card = cardLibrary.getCard(cardId);

      console.debug(`[SEA CHART EFFECT] revealing card...`);
      await runGameActionDelegate('revealCard', {
        cardId,
        playerId,
        moveToSetAside: true
      });

      const copyInPlay = args.findCards({ location: 'playArea' })
        .find(playAreaCard => playAreaCard.cardKey === card.cardKey && playAreaCard.owner === playerId);

      console.debug(`[SEA CHART EFFECT] ${copyInPlay ? 'copy is in play' : 'no copy in play'}...`);

      console.debug(`[SEA CHART EFFECT] moving card to ${copyInPlay ? 'playerHand' : 'playerDeck'}...`);

      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: copyInPlay ? 'playerHand' : 'playerDeck' }
      });
    }
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
          return conditionArgs.trigger.args.playerId === args.playerId
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.runGameActionDelegate('moveCard', {
            cardId: seaWitchCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[sea-witch triggered effect] drawing 2 cards...`)
          await triggerArgs.runGameActionDelegate('drawCard', {
            playerId: args.playerId,
            count: 2
          }, { loggingContext: { source: args.cardId } });

          console.debug(`[sea-witch triggered effect] selecting discarding cards...`);

          const selectedCards = await triggerArgs.runGameActionDelegate('selectCard', {
            prompt: 'Discard cards',
            restrict: args.cardSourceController.getSource('playerHand', args.playerId),
            count: 2,
            playerId: args.playerId
          }) as number[];

          for (const selectedCardId of selectedCards) {
            await triggerArgs.runGameActionDelegate('discardCard', {
              cardId: selectedCardId,
              playerId: args.playerId
            }, { loggingContext: { source: args.cardId } });
          }
        }
      })

      console.debug(`[sea witch effect] drawing 2 cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId, count: 2 });

      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: args.playerId,
        appliesTo: 'ALL_OTHER',
        match: args.match
      }).filter(playerId => !isPlayerImmune(args.reactionContext, playerId));

      for (const targetPlayerId of targetPlayerIds) {
        const curseCardIds = args.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' }
        ]);

        if (curseCardIds.length === 0) {
          console.debug(`[sea witch effect] no curses in supply...`);
          break;
        }

        console.debug(`[sea witch effect] giving curse to ${getPlayerById(args.match, targetPlayerId)}`);
        await args.runGameActionDelegate('gainCard', {
          cardId: curseCardIds[0].id,
          playerId: targetPlayerId,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'smugglers': {
    registerEffects: () => async (cardEffectArgs) => {
      const previousPlayer = getPlayerStartingFrom({
        startFromIdx: getPlayerTurnIndex({ match: cardEffectArgs.match, playerId: cardEffectArgs.playerId }),
        match: cardEffectArgs.match,
        distance: -1
      });

      console.debug(`[smugglers effect] looking at ${previousPlayer} cards gained`);

      const cardsGained = cardEffectArgs.match.stats.cardsGained;

      const cardIdsGained = Object.keys(cardsGained)
        .map(Number)
        .filter(cardId => {
          return cardsGained[cardId].playerId === previousPlayer.id &&
            cardsGained[cardId].turnNumber === cardEffectArgs.match.turnNumber - 1;
        });

      let cards = cardEffectArgs.findCards({ kind: 'upTo', amount: { treasure: 6 }, playerId: cardEffectArgs.playerId })
        .filter(card => cardIdsGained.includes(card.id));

      console.debug(`[smugglers effect] found ${cards.length} costing up to 6 that were played`);

      const inSupply = (card: Card) =>
        cardEffectArgs.findCards({ location: ['kingdomSupply', 'basicSupply'] })
          .find(supplyCard => supplyCard.cardKey === card.cardKey);

      const cardsInSupply = cards.map(inSupply).filter(id => id !== undefined);

      console.debug(`[smugglers effect] found ${cardsInSupply.length} available cards in supply to choose from`);

      if (!cardsInSupply.length) {
        return;
      }

      console.debug(`[smugglers effect] prompting user to select a card...`);

      const results = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        restrict: cardsInSupply.map(card => card.id),
        prompt: `Gain a card`,
      }) as number[];

      const cardId = results[0];

      if (!cardId) {
        console.warn(`[smugglers effect] no card selected`);
        return;
      }

      console.debug(`[smugglers effect] gaining card...`);

      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardId,
        to: { location: 'playerDiscard' },
      });
    }
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
        await args.runGameActionDelegate('discardCard', { cardId, playerId: args.playerId });
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
          return conditionArgs.trigger.args.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.runGameActionDelegate('moveCard', {
            cardId: tacticianCard.id,
            to: { location: 'playArea' }
          });
          console.warn(`[tactician triggered effect] drawing 5 cards`);
          await triggerArgs.runGameActionDelegate('drawCard', {
            count: 5,
            playerId: args.playerId
          }, { loggingContext: { source: args.cardId } });

          console.warn(`[tactician triggered effect] gaining 1 action`);
          await triggerArgs.runGameActionDelegate('gainAction', { count: 1 });

          console.warn(`[tactician triggered effect] gaining 1 buy`);
          await triggerArgs.runGameActionDelegate('gainBuy', { count: 1 });
        }
      })
    }
  },
  'tide-pools': {
    registerEffects: () => async (args) => {
      console.debug(`[tide pools effect] drawing 3 cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId, count: 3 });

      console.debug(`[tide pools effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });

      const tidePoolsCard = args.cardLibrary.getCard(args.cardId);
      // Use the shared duration flow to keep the card active through cleanup.
      args.registerDurationEffect(tidePoolsCard, {
        id: `tide-pools:${args.cardId}:startTurn`,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) =>
          conditionArgs.trigger.args.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber,
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.runGameActionDelegate('moveCard', {
            cardId: tidePoolsCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[tide pools triggered effect] selecting two cards to discard`);
          const selectedCardIds = await triggerArgs.runGameActionDelegate('selectCard', {
            playerId: args.playerId,
            prompt: `Discard cards`,
            restrict: args.cardSourceController.getSource('playerHand', args.playerId),
            count: 2
          }) as CardId[];

          if (!selectedCardIds.length) {
            return;
          }

          for (const cardId of selectedCardIds) {
            await triggerArgs.runGameActionDelegate('discardCard', {
              cardId,
              playerId: args.playerId
            }, { loggingContext: { source: cardId } });
          }
        }
      })
    }
  },
  'treasure-map': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId, match, cardLibrary, ...args }) => {
      console.debug(`[treasure map effect] trashing played treasure map...`);
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });

      const hand = args.cardSourceController.getSource('playerHand', playerId);
      const inHand = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'treasure-map');

      console.debug(`[treasure map effect] ${inHand ? 'another treasure map is in hand' : 'no other treasure map in hand'}...`);

      if (!inHand) {
        return;
      }

      console.debug(`[treasure map effect] trashing treasure map from hand...`);

      await runGameActionDelegate('trashCard', {
        playerId,
        cardId: inHand,
      });

      const goldCardIds = args.findCards([{ location: 'basicSupply' }, { cardKeys: 'gold' }]);

      for (let i = 0; i < Math.min(goldCardIds.length, 4); i++) {
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: goldCardIds.slice(-i - 1)[0].id,
          to: { location: 'playerDeck' },
        });
      }
    }
  },
  'treasury': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`treasury:${cardId}:endTurnPhase`);
      }
    }),
    registerEffects: () => async (args) => {
      console.debug(`[treasury effect] drawing 1 card...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });

      console.debug(`[treasury effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });

      console.debug(`[treasury effect] gaining 1 treasure...`);
      await args.runGameActionDelegate('gainTreasure', { count: 1 });

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
              return stats.turnNumber === conditionArgs.match.turnNumber &&
                conditionArgs.cardLibrary.getCard(+id).type.includes('VICTORY');
            }).map(results => Number(results[0]));

          if (victoryCardsGained.length > 0) {
            return false;
          }

          return getCurrentPlayer(args.match).id === args.playerId
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.runGameActionDelegate('moveCard', {
            cardId: args.cardId,
            toPlayerId: args.playerId,
            to: { location: 'playerDeck' }
          });
        }
      })
    }
  },
  'warehouse': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, ...effectArgs }) => {
      console.debug(`[warehouse effect] drawing 3 cards...`);
      await runGameActionDelegate('drawCard', { playerId, count: 3 });

      console.debug(`[warehouse effect] gaining 1 actions...`);
      await runGameActionDelegate('gainAction', { count: 1 });

      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Discard cards',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 3,
      })) as number[];

      console.debug(`[warehouse effect] discarding cards...`);

      for (const cardId of cardIds) {
        await runGameActionDelegate('discardCard', {
          cardId,
          playerId
        });
      }
    }
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
          return conditionArgs.trigger.args.playerId === args.playerId &&
            conditionArgs.match.stats.playedCards[args.cardId].turnNumber < conditionArgs.match.turnNumber
        },
        triggeredEffectFn: async (triggerArgs) => {
          await triggerArgs.runGameActionDelegate('moveCard', {
            cardId: wharfCard.id,
            to: { location: 'playArea' }
          });
          console.debug(`[wharf triggered effect] drawing 2 cards`);
          await triggerArgs.runGameActionDelegate('drawCard', {
            playerId: args.playerId,
            count: 2
          }, { loggingContext: { source: args.cardId } });

          console.debug(`[wharf triggered effect] gaining 1 buy`);
          await triggerArgs.runGameActionDelegate('gainBuy', { count: 1 }, { loggingContext: { source: args.cardId } });
        }
      })

      console.debug(`[wharf effect] drawing 2 cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId, count: 2 });

      console.debug(`[wharf effect] gaining 1 buy...`);
      await args.runGameActionDelegate('gainBuy', { count: 1 });
    }
  }
}

export default expansion;
