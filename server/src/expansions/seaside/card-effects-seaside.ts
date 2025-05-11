import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { Card, CardId } from 'shared/shared-types.ts';
import { getPlayerStartingFrom, getPlayerTurnIndex } from '../../shared/get-player-position-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

const expansion: CardExpansionModule = {
  'astrolabe': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`astrolabe:${eventArgs.cardId}:starTurn`);
      },
      onCardPlayed: async ({ reactionManager }, { playerId, cardId }) => {
        const id = `astrolabe:${cardId}:starTurn`;
        reactionManager.registerReactionTemplate({
          id,
          playerId,
          listeningFor: 'startTurn',
          compulsory: true,
          allowMultipleInstances: true,
          once: true,
          condition: (args) => {
            const { trigger } = args;
            return trigger.args.playerId === playerId;
          },
          triggeredEffectFn: async ({ runGameActionDelegate }) => {
            console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
            await runGameActionDelegate('gainTreasure', { count: 1 }, { loggingContext: { source: cardId } });
            
            console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
            await runGameActionDelegate('gainBuy', { count: 1 }, { loggingContext: { source: cardId } });
          }
        });
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate }) => {
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
      
      console.log(`[SEASON EFFECT] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', { count: 1 });
    }
  },
  'bazaar': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[SEASON EFFECT] drawing 1 card...`);
      await runGameActionDelegate('drawCard', { playerId: playerId });
      
      console.log(`[SEASON EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'blockade': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`blockade:${eventArgs.cardId}:startTurn`);
        args.reactionManager.unregisterTrigger(`blockade:${eventArgs.cardId}:gainCard`);
      }
    }),
    registerEffects: () => async (args) => {
      console.log(`[BLOCKADE EFFECT] prompting user to select card...`);
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
      
      console.log(`[BLOCKADE EFFECT] selected card ${args.cardLibrary.getCard(gainedCardId)}`);
      
      await args.runGameActionDelegate('gainCard', {
        playerId: args.playerId,
        cardId: gainedCardId,
        to: { location: 'set-aside' },
      });
      
      args.reactionManager.registerReactionTemplate({
        playerId: args.playerId,
        id: `blockade:${args.cardId}:startTurn`,
        once: true,
        condition: ({ trigger }) => trigger.args.playerId === args.playerId,
        listeningFor: 'startTurn',
        compulsory: true,
        triggeredEffectFn: async () => {
          console.log(`[BLOCKADE TRIGGERED EFFECT] moving previously selected card to hand...`);
          await args.runGameActionDelegate('moveCard', {
            cardId: gainedCardId,
            toPlayerId: args.playerId,
            to: { location: 'playerHand' }
          });
          
          args.reactionManager.unregisterTrigger(`blockade:${args.cardId}:gainCard`);
        }
      });
      
      const cardGained = args.cardLibrary.getCard(gainedCardId);
      
      args.reactionManager.registerReactionTemplate({
        playerId: args.playerId,
        id: `blockade:${args.cardId}:gainCard`,
        condition: (conditionArgs) => {
          if (getCurrentPlayer(args.match).id !== conditionArgs.trigger.args.playerId) {
            return false;
          }
          
          return conditionArgs.trigger.args.cardId !== undefined && args.cardLibrary.getCard(conditionArgs.trigger.args.cardId).cardKey == cardGained.cardKey;
        },
        compulsory: true,
        listeningFor: 'gainCard',
        triggeredEffectFn: async (args) => {
          const curseCardIds = args.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'curse' }
          ]);
          
          if (!curseCardIds.length) {
            console.log(`[BLOCKADE TRIGGERED EFFECT] no curse cards in supply...`);
            return
          }
          
          console.log(`[BLOCKADE TRIGGERED EFFECT] gaining curse card to player's discard...`);
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
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`caravan:${eventArgs.cardId}:startTurn`);
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
      console.log(`[CARAVAN EFFECT] drawing a card...`);
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[CARAVAN EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      reactionManager.registerReactionTemplate({
        id: `caravan:${cardId}:startTurn`,
        playerId,
        compulsory: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[CARAVAN TRIGGERED EFFECT] drawing a card...`);
          await runGameActionDelegate('drawCard', { playerId }, { loggingContext: { source: cardId } });
        }
      })
    }
  },
  'corsair': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`corsair:${cardId}:starTurn`);
        reactionManager.unregisterTrigger(`corsair:${cardId}:cardPlayed`);
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate, reactionManager, cardId, playerId, reactionContext }) => {
      console.log(`[CORSAIR EFFECT] gaining 2 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 2 });
      
      const startTurnTriggerId = `corsair:${cardId}:startTurn`;
      const cardPlayedTriggerId = `corsair:${cardId}:cardPlayed`;
      reactionManager.registerReactionTemplate({
        id: startTurnTriggerId,
        playerId,
        compulsory: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[CORSAIR TRIGGERED EFFECT] drawing card...`);
          await runGameActionDelegate('drawCard', { playerId }, { loggingContext: { source: cardId } });
          reactionManager.unregisterTrigger(startTurnTriggerId);
          reactionManager.unregisterTrigger(cardPlayedTriggerId);
        }
      });
      
      reactionManager.registerReactionTemplate({
        id: cardPlayedTriggerId,
        playerId,
        listeningFor: 'cardPlayed',
        compulsory: true,
        condition: ({ match, trigger, cardLibrary }) => {
          if (!trigger.args.cardId || trigger.args.playerId === playerId) return false;
          
          if (reactionContext[trigger.args.playerId!]?.result === 'immunity') {
            console.log(`[corsair triggered effect] ${getPlayerById(match, trigger.args.playerId!)} is immune`);
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
          console.log(`[CORSAIR TRIGGERED EFFECT] trashing card...`);
          await runGameActionDelegate(
            'trashCard',
            {
              playerId: trigger.args.playerId!,
              cardId: trigger.args.cardId!,
            },
            {
              loggingContext: {
                source: cardId
              }
            }
          );
        }
      })
    }
  },
  'cutpurse': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, reactionContext, cardLibrary, ...args }) => {
      console.log(`[cutpurse effect] gaining 2 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 2, });
      
      const targetIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      for (const targetId of targetIds) {
        const hand = args.cardSourceController.getSource('playerHand', targetId);
        const copperId = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'copper');
        if (copperId) {
          console.log(`[cutpurse effect] discarding copper...`);
          await runGameActionDelegate('discardCard', {
            cardId: copperId,
            playerId: targetId
          });
          continue;
        }
        
        console.log(`[cutpurse effect] revealing hand...`);
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
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`fishing-village:${eventArgs.cardId}:startTurn`);
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
      console.log(`[fishing village effect] gaining 2 action...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[fishing village effect] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
      
      reactionManager.registerReactionTemplate({
        id: `fishing-village:${cardId}:startTurn`,
        once: true,
        compulsory: true,
        playerId,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[fishing village triggered effect] gaining 1 action...`);
          await runGameActionDelegate('gainAction', { count: 1 }, { loggingContext: { source: cardId } });
          
          console.log(`[fishing village triggered effect] gaining 1 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 1 }, { loggingContext: { source: cardId } });
        }
      })
    }
  },
  'haven': {
    registerEffects: () => async ({
      runGameActionDelegate,
      playerId,
      cardId: playedCardId,
      reactionManager,
      cardLibrary,
      ...effectArgs
    }) => {
      console.log(`[haven effect] drawing card...`);
      await runGameActionDelegate('drawCard', { playerId });
      
      
      console.log(`[haven effect] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card to set aside',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      }) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.warn('[haven effect] no card selected');
        return;
      }
      
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: 'set-aside' },
      });
      
      cardLibrary.getCard(cardId).facing = 'back';
      
      reactionManager.registerReactionTemplate({
        id: `haven:${playedCardId}:startTurn`,
        listeningFor: 'startTurn',
        compulsory: true,
        once: true,
        playerId,
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async (triggerEffectArgs) => {
          console.log(`[haven triggered effect] moving selected card to hand...`);
          
          await runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: { location: 'playerHand' }
          });
          
          const card = triggerEffectArgs.cardLibrary.getCard(cardId);
          card.facing = 'front';
        }
      });
    }
  },
  'island': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId, ...effectArgs }) => {
      console.log(`[ISLAND EFFECT] prompting user to select card...`);
      
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Choose card',
        validPrompt: '',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      })) as number[];
      
      console.log(`[ISLAND EFFECT] moving island to island mat...`);
      
      await runGameActionDelegate('moveCard', {
        cardId,
        to: { location: 'island' },
        toPlayerId: playerId
      });
      
      const selectedCardId = cardIds[0];
      
      console.log(`[ISLAND EFFECT] moving selected card to island mat...`);
      
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
        args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:startTurn`);
        args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:cardPlayed`);
      },
      onCardPlayed: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `lighthouse:${eventArgs.cardId}:cardPlayed`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardPlayed',
          condition: ({ trigger, cardLibrary }) => {
            const playedCard = cardLibrary.getCard(trigger.args.cardId!);
            return trigger.args.cardId !== eventArgs.cardId && trigger.args.playerId !== eventArgs.playerId && playedCard.type.includes('ATTACK');
          },
          once: false,
          allowMultipleInstances: false,
          compulsory: true,
          triggeredEffectFn: async () => {
            return 'immunity';
          }
        });
        
        args.reactionManager.registerReactionTemplate({
          id: `lighthouse:${eventArgs.cardId}:startTurn`,
          playerId: eventArgs.playerId,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.args.playerId === eventArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          triggeredEffectFn: async () => {
            args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:cardPlayed`);
            await args.runGameActionDelegate('gainTreasure', { count: 1 }, { loggingContext: { source: eventArgs.cardId } });
          }
        })
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate }) => {
      console.log(`[lighthouse effect] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      console.log(`[lighthouse effect] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'lookout': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, ...args }) => {
      console.log(`[LOOKOUT EFFECT] gaining 1 action...`);
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
          console.log(`[lookout effect] no card in deck`)
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
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`merchant-ship:${eventArgs.cardId}:startTurn`);
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
      console.log(`[merchant ship effect] gaining 2 treasures...`);
      await runGameActionDelegate('gainTreasure', { count: 2 });
      
      reactionManager.registerReactionTemplate({
        id: `merchant-ship:${cardId}:startTurn`,
        playerId,
        compulsory: true,
        allowMultipleInstances: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[merchant ship triggered effect] gaining 2 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 2 }, { loggingContext: { source: cardId } });
        }
      })
    }
  },
  'monkey': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`monkey:${eventArgs.cardId}:startTurn`);
        args.reactionManager.unregisterTrigger(`monkey:${eventArgs.cardId}:gainCard`)
      }
    }),
    registerEffects: () => async ({ reactionManager, match, playerId, cardId, runGameActionDelegate }) => {
      reactionManager.registerReactionTemplate({
        id: `monkey:${cardId}:startTurn`,
        playerId,
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.args.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[monkey triggered effect] drawing card at start of turn...`);
          await runGameActionDelegate('drawCard', { playerId }, { loggingContext: { source: cardId } });
          
          reactionManager.unregisterTrigger(`monkey:${cardId}:gainCard`);
        }
      });
      
      const thisPlayerTurnIdx = match.players.findIndex(p => p.id === playerId);
      const playerToRightId = getPlayerStartingFrom({
        startFromIdx: thisPlayerTurnIdx,
        match,
        distance: -1
      }).id;
      
      reactionManager.registerReactionTemplate({
        id: `monkey:${cardId}:gainCard`,
        playerId,
        compulsory: true,
        allowMultipleInstances: true,
        listeningFor: 'gainCard',
        once: false,
        triggeredEffectFn: async () => {
          console.log(`[monkey triggered effect] drawing card, because player to the right gained a card...`);
          await runGameActionDelegate('drawCard', { playerId }, { loggingContext: { source: cardId } });
        },
        condition: ({ trigger }) => trigger.args.playerId === playerToRightId
      });
    }
  },
  'pirate': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `pirate:${cardId}:gainCard`,
          playerId,
          compulsory: false,
          allowMultipleInstances: true,
          once: true,
          listeningFor: 'gainCard',
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
        reactionManager.unregisterTrigger(`pirate:${cardId}:gainCard`);
      },
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`pirate:${eventArgs.cardId}:startTurn`);
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
      
      reactionManager.registerReactionTemplate({
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
        triggeredEffectFn: async () => {
          console.log(`[pirate triggered effect] prompting user to select treasure costing up to 6...`);
          const cardIds = (await runGameActionDelegate('selectCard', {
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
          
          const cardId = cardIds[0];
          if (!cardId) {
            console.warn(`[pirate triggered effect] no card selected...`);
            return;
          }
          
          console.log(`[pirate triggered effect] gaining selected card to hand...`);
          await runGameActionDelegate('gainCard', {
            playerId,
            cardId: cardId,
            to: { location: 'playerHand' },
          }, { loggingContext: { source: cardId } });
        }
      });
    }
  },
  'native-village': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, ...args }) => {
      console.log(`[NATIVE VILLAGE EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[NATIVE VILLAGE EFFECT] prompting user to choose...`);
      
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
          console.log(`[NATIVE VILLAGE EFFECT] shuffling deck...`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
        }
        
        const cardId = deck.slice(-1)[0];
        
        if (!cardId) {
          console.log(`[NATIVE VILLAGE EFFECT] no cards in deck...`);
          return;
        }
        
        console.log(`[NATIVE VILLAGE EFFECT] moving card to native village mat...`);
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'native-village' }
        });
        
        return;
      }
      
      const matCardIds = args.findCards({ location: 'native-village'});
      
      console.log(`[NATIVE VILLAGE EFFECT] moving ${matCardIds.length} cards from native village mat to hand...`);
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
        reactionManager.unregisterTrigger(`sailor:${cardId}:gainCard`);
        reactionManager.unregisterTrigger(`sailor:${cardId}:startTurn`);
        reactionManager.unregisterTrigger(`sailor:${cardId}:endTurn`);
      },
      onCardPlayed: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `sailor:${eventArgs.cardId}:endTurn`,
          playerId: eventArgs.playerId,
          listeningFor: 'endTurn',
          compulsory: true,
          allowMultipleInstances: true,
          once: true,
          condition: () => true,
          triggeredEffectFn: async (triggerArgs) => {
            args.reactionManager.unregisterTrigger(`sailor:${eventArgs.cardId}:gainCard`);
            args.reactionManager.unregisterTrigger(`sailor:${eventArgs.cardId}:endTurn`);
          }
        });
        
        args.reactionManager.registerReactionTemplate({
          id: `sailor:${eventArgs.cardId}:gainCard`,
          playerId: eventArgs.playerId,
          listeningFor: 'gainCard',
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            const cardGained = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId!);
            
            if (!cardGained.type.includes('DURATION')) {
              return false;
            }
            
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) {
              return false;
            }
            
            return conditionArgs.match.stats.playedCards[conditionArgs.trigger.args.cardId!] === undefined;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            console.log(`[sailor triggered effect] playing ${triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId!)}`);
            await triggeredArgs.runGameActionDelegate('playCard', {
              playerId: eventArgs.playerId,
              cardId: triggeredArgs.trigger.args.cardId!,
              overrides: { actionCost: 0 }
            }, { loggingContext: { source: eventArgs.cardId } });
          }
        });
        
        args.reactionManager.registerReactionTemplate({
          id: `sailor:${eventArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: eventArgs.playerId,
          compulsory: true,
          once: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) =>
            trigger.args.playerId === eventArgs.playerId && match.stats.playedCards[eventArgs.cardId].turnNumber !== match.turnNumber,
          triggeredEffectFn: async () => {
            console.log(`[sailor triggered effect] gaining 2 treasure...`);
            await args.runGameActionDelegate('gainTreasure', { count: 2 }, { loggingContext: { source: eventArgs.cardId } });
            
            const cardIds = await args.runGameActionDelegate('selectCard', {
              prompt: 'Trash card',
              playerId: eventArgs.playerId,
              restrict: args.cardSourceController.getSource('playerHand', eventArgs.playerId),
              count: 1,
              optional: true,
              cancelPrompt: `Don't trash`
            }) as number[];
            
            const cardId = cardIds[0];
            
            if (!cardId) {
              console.log(`[sailor triggered effect] no card chosen`);
              return;
            }
            
            console.log(`[sailor triggered effect] trashing selected card...`);
            await args.runGameActionDelegate('trashCard', {
              playerId: eventArgs.playerId,
              cardId,
            }, { loggingContext: { source: cardId } });
          }
        });
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate }) => {
      console.log(`[sailor effect] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
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
      console.log(`[salvager effect] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', { count: 1 });
      
      console.log(`[salvager effect] prompting user to select a card from hand...`);
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Trash card',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.log(`[salvager effect] no card selected...`);
        return;
      }
      
      console.log(`[salvager effect] trashing card...`);
      await runGameActionDelegate('trashCard', { cardId, playerId });
      
      const card = cardLibrary.getCard(cardId);
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });
      
      console.log(`[salvager effect] gaining ${cardCost.treasure} buy...`);
      await runGameActionDelegate('gainTreasure', { count: cardCost.treasure });
    }
  },
  'sea-chart': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, cardLibrary, ...args }) => {
      console.log(`[SEA CHART EFFECT] drawing 1 card...`);
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[SEA CHART EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = args.cardSourceController.getSource('playerDeck', playerId);
      
      if (deck.length === 0) {
        console.log(`[SEA CHART EFFECT] shuffling deck...`);
        await runGameActionDelegate('shuffleDeck', { playerId });
        
        if (deck.length === 0) {
          console.log(`[SEA CHART EFFECT] no cards in deck...`);
          return;
        }
      }
      
      const cardId = deck.slice(-1)[0];
      const card = cardLibrary.getCard(cardId);
      
      console.log(`[SEA CHART EFFECT] revealing card...`);
      await runGameActionDelegate('revealCard', {
        cardId,
        playerId,
        moveToSetAside: true
      });
      
      const copyInPlay = args.findCards({ location: 'playArea' })
        .find(playAreaCard => playAreaCard.cardKey === card.cardKey && playAreaCard.owner === playerId);
      
      console.log(`[SEA CHART EFFECT] ${copyInPlay ? 'copy is in play' : 'no copy in play'}...`);
      
      console.log(`[SEA CHART EFFECT] moving card to ${copyInPlay ? 'playerHand' : 'playerDeck'}...`);
      
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: copyInPlay ? 'playerHand' : 'playerDeck' }
      });
    }
  },
  'sea-witch': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`sea-witch:${eventArgs.cardId}:startTurn`);
      },
      onCardPlayed: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `sea-witch:${eventArgs.cardId}:startTurn`,
          playerId: eventArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: (conditionArgs) => {
            return conditionArgs.trigger.args.playerId === eventArgs.playerId
          },
          triggeredEffectFn: async (triggerArgs) => {
            console.log(`[sea-witch triggered effect] drawing 2 cards...`)
            await triggerArgs.runGameActionDelegate('drawCard', {
              playerId: eventArgs.playerId,
              count: 2
            }, { loggingContext: { source: eventArgs.cardId } });
            
            console.log(`[sea-witch triggered effect] selecting discarding cards...`);
            
            const selectedCards = await triggerArgs.runGameActionDelegate('selectCard', {
              prompt: 'Discard cards',
              restrict: args.cardSourceController.getSource('playerHand', eventArgs.playerId),
              count: 2,
              playerId: eventArgs.playerId
            }) as number[];
            
            for (const selectedCardId of selectedCards) {
              await triggerArgs.runGameActionDelegate('discardCard', {
                cardId: selectedCardId,
                playerId: eventArgs.playerId
              }, { loggingContext: { source: eventArgs.cardId } });
            }
          }
        })
      }
    }),
    registerEffects: () => async (args) => {
      console.log(`[sea witch effect] drawing 2 cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId, count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: args.playerId,
        appliesTo: 'ALL_OTHER',
        match: args.match
      }).filter(playerId => args.reactionContext[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const curseCardIds = args.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' }
        ]);
        
        if (curseCardIds.length === 0) {
          console.log(`[sea witch effect] no curses in supply...`);
          break;
        }
        
        console.log(`[sea witch effect] giving curse to ${getPlayerById(args.match, targetPlayerId)}`);
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
      
      console.log(`[smugglers effect] looking at ${previousPlayer} cards gained`);
      
      const cardsGained = cardEffectArgs.match.stats.cardsGained;
      
      const cardIdsGained = Object.keys(cardsGained)
        .map(Number)
        .filter(cardId => {
          return cardsGained[cardId].playerId === previousPlayer.id &&
            cardsGained[cardId].turnNumber === cardEffectArgs.match.turnNumber - 1;
        });
      
      let cards = cardEffectArgs.findCards({ kind: 'upTo', amount: { treasure: 6 }, playerId: cardEffectArgs.playerId })
        .filter(card => cardIdsGained.includes(card.id));
      
      console.log(`[smugglers effect] found ${cards.length} costing up to 6 that were played`);
      
      const inSupply = (card: Card) =>
        cardEffectArgs.findCards({ location: ['kingdomSupply', 'basicSupply'] })
          .find(supplyCard => supplyCard.cardKey === card.cardKey);
      
      const cardsInSupply = cards.map(inSupply).filter(id => id !== undefined);
      
      console.log(`[smugglers effect] found ${cardsInSupply.length} available cards in supply to choose from`);
      
      if (!cardsInSupply.length) {
        return;
      }
      
      console.log(`[smugglers effect] prompting user to select a card...`);
      
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
      
      console.log(`[smugglers effect] gaining card...`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardId,
        to: { location: 'playerDiscard' },
      });
    }
  },
  'tactician': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`tactician:${cardId}:startTurn`);
      }
    }),
    registerEffects: () => async (args) => {
      const hand = args.cardSourceController.getSource('playerHand', args.playerId);
      if (hand.length === 0) {
        console.log(`[tactician effect] no cards in hand...`);
        return;
      }
      
      console.log(`[tactician effect] discarding hand...`);
      for (const cardId of [...hand]) {
        await args.runGameActionDelegate('discardCard', { cardId, playerId: args.playerId });
      }
      
      args.reactionManager.registerReactionTemplate({
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
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`tide-pools:${cardId}:startTurn`);
      }
    }),
    registerEffects: () => async (args) => {
      console.log(`[tide pools effect] drawing 3 cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId, count: 3 });
      
      console.log(`[tide pools effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });
      
      args.reactionManager.registerReactionTemplate({
        id: `tide-pools:${args.cardId}:startTurn`,
        playerId: args.playerId,
        listeningFor: 'startTurn',
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) =>
          conditionArgs.trigger.args.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber,
        triggeredEffectFn: async (triggerArgs) => {
          console.log(`[tide pools triggered effect] selecting two cards to discard`);
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
      console.log(`[treasure map effect] trashing played treasure map...`);
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      const inHand = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'treasure-map');
      
      console.log(`[treasure map effect] ${inHand ? 'another treasure map is in hand' : 'no other treasure map in hand'}...`);
      
      if (!inHand) {
        return;
      }
      
      console.log(`[treasure map effect] trashing treasure map from hand...`);
      
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
      console.log(`[treasury effect] drawing 1 card...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      
      console.log(`[treasury effect] gaining 1 action...`);
      await args.runGameActionDelegate('gainAction', { count: 1 });
      
      console.log(`[treasury effect] gaining 1 treasure...`);
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
      console.log(`[warehouse effect] drawing 3 cards...`);
      await runGameActionDelegate('drawCard', { playerId, count: 3 });
      
      console.log(`[warehouse effect] gaining 1 actions...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Discard cards',
        playerId,
        restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
        count: 3,
      })) as number[];
      
      console.log(`[warehouse effect] discarding cards...`);
      
      for (const cardId of cardIds) {
        await runGameActionDelegate('discardCard', {
          cardId,
          playerId
        });
      }
    }
  },
  'wharf': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`wharf:${cardId}:startTurn`);
      },
      onCardPlayed: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `wharf:${eventArgs.cardId}:startTurn`,
          playerId: eventArgs.playerId,
          listeningFor: 'startTurn',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            return conditionArgs.trigger.args.playerId === eventArgs.playerId &&
              conditionArgs.match.stats.playedCards[eventArgs.cardId].turnNumber < conditionArgs.match.turnNumber
          },
          triggeredEffectFn: async (triggerArgs) => {
            console.log(`[wharf triggered effect] drawing 2 cards`);
            await triggerArgs.runGameActionDelegate('drawCard', {
              playerId: eventArgs.playerId,
              count: 2
            }, { loggingContext: { source: eventArgs.cardId } });
            
            console.log(`[wharf triggered effect] gaining 1 buy`);
            await triggerArgs.runGameActionDelegate('gainBuy', { count: 1 }, { loggingContext: { source: eventArgs.cardId } });
          }
        })
      }
    }),
    registerEffects: () => async (args) => {
      console.log(`[wharf effect] drawing 2 cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId, count: 2 });
      
      console.log(`[wharf effect] gaining 1 buy...`);
      await args.runGameActionDelegate('gainBuy', { count: 1 });
    }
  }
}

export default expansion;