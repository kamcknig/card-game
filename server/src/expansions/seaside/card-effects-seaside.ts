import { CardExpansionModuleNew } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { Card, CardId } from 'shared/shared-types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getPlayerStartingFrom, getPlayerTurnIndex } from '../../shared/get-player-position-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

const expansion: CardExpansionModuleNew = {
  'astrolabe': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: (args) => {
        args.reactionManager.unregisterTrigger(`astrolabe:${args.cardId}:starTurn`);
      },
      onCardPlayed: ({ reactionManager, playerId, cardId }) => {
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
            return trigger.playerId === playerId;
          },
          triggeredEffectFn: async ({ runGameActionDelegate }) => {
            console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
            await runGameActionDelegate('gainTreasure', { count: 1 });
            
            console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
            await runGameActionDelegate('gainBuy', { count: 1 });
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
      await runGameActionDelegate('drawCard', {
        playerId: playerId,
      });
      
      console.log(`[SEASON EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'blockade': {
    registerEffects: () => async ({ match, reactionManager, runGameActionDelegate, cardLibrary, playerId }) => {
      console.log(`[BLOCKADE EFFECT] prompting user to select card...`);
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Gain card',
        playerId,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { kind: 'upTo', amount: 4 },
        },
        count: 1,
      }) as number[];
      
      const cardId = cardIds[0];
      
      console.log(`[BLOCKADE EFFECT] selected card ${cardLibrary.getCard(cardId)}`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId,
        to: { location: 'set-aside' },
      });
      
      reactionManager.registerReactionTemplate({
        playerId,
        id: `blockade:${cardId}:startTurn`,
        once: true,
        condition: ({ trigger }) => trigger.playerId === playerId,
        listeningFor: 'startTurn',
        compulsory: true,
        triggeredEffectFn: async () => {
          console.log(`[BLOCKADE TRIGGERED EFFECT] moving previously selected card to hand...`);
          await runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: playerId,
            to: { location: 'playerHands' }
          });
          
          reactionManager.unregisterTrigger(`blockade:${cardId}:gainCard`);
        }
      });
      
      const cardGained = cardLibrary.getCard(cardId);
      
      reactionManager.registerReactionTemplate({
        playerId,
        id: `blockade:${cardId}:gainCard`,
        condition: (args) => {
          if (getCurrentPlayer(match).id !== args.trigger.playerId) {
            return false;
          }
          
          return args.trigger.cardId !== undefined && cardLibrary.getCard(args.trigger.cardId).cardKey == cardGained.cardKey;
        },
        compulsory: true,
        listeningFor: 'gainCard',
        triggeredEffectFn: async (args) => {
          const curseCardIds = findCards(
            match,
            {
              from: { location: 'supply' },
              card: { cardKeys: 'curse' }
            },
            cardLibrary
          );
          
          if (!curseCardIds.length) {
            console.log(`[BLOCKADE TRIGGERED EFFECT] no curse cards in supply...`);
            return
          }
          
          console.log(`[BLOCKADE TRIGGERED EFFECT] gaining curse card to player's discard...`);
          await runGameActionDelegate('gainCard', {
            playerId: args.trigger.playerId!,
            cardId: curseCardIds[0],
            to: { location: 'playerDiscards' },
          });
        }
      })
    }
  },
  'caravan': {
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
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[CARAVAN TRIGGERED EFFECT] drawing a card...`);
          await runGameActionDelegate('drawCard', { playerId });
        }
      })
    }
  },
  'corsair': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: ({ reactionManager, cardId }) => {
        reactionManager.unregisterTrigger(`corsair:${cardId}:starTurn`);
      }
    }),
    registerEffects: () => async ({ runGameActionDelegate, reactionManager, cardId, playerId, reactionContext }) => {
      console.log(`[CORSAIR EFFECT] gaining 2 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 2 });
      
      reactionManager.registerReactionTemplate({
        id: `corsair:${cardId}:startTurn`,
        playerId,
        compulsory: true,
        once: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[CORSAIR TRIGGERED EFFECT] drawing card...`);
          await runGameActionDelegate('drawCard', { playerId });
          reactionManager.unregisterTrigger(`corsair:${cardId}:startTurn`);
          reactionManager.unregisterTrigger(`corsair:${cardId}:cardPlayed`);
        }
      });
      
      reactionManager.registerReactionTemplate({
        id: `corsair:${cardId}:cardPlayed`,
        playerId,
        listeningFor: 'cardPlayed',
        compulsory: true,
        condition: ({ match, trigger, cardLibrary }) => {
          if (!trigger.cardId || trigger.playerId === playerId) return false;
          
          if (reactionContext[trigger.playerId!]?.result === 'immunity') {
            console.log(`[corsair triggered effect] ${getPlayerById(match, trigger.playerId!)} is immune`);
            return false;
          }
          
          const card = cardLibrary.getCard(trigger.cardId);
          
          if (!['silver', 'gold'].includes(card.cardKey)) return false;
          
          const playedSilverCards = Object.keys(match.stats.playedCards)
            .filter(cardId => {
              return ['silver', 'gold'].includes(cardLibrary.getCard(+cardId).cardKey) &&
                match.stats.playedCards[+cardId].turnNumber === match.turnNumber &&
                match.stats.playedCards[+cardId].playerId === trigger.playerId
            });
          
          return playedSilverCards.length === 1;
        },
        triggeredEffectFn: async ({ trigger }) => {
          console.log(`[CORSAIR TRIGGERED EFFECT] trashing card...`);
          await runGameActionDelegate('trashCard', {
            playerId: trigger.playerId!,
            cardId: trigger.cardId!,
          });
        }
      })
    }
  },
  'cutpurse': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, reactionContext, cardLibrary }) => {
      console.log(`[cutpurse effect] gaining 2 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 2, });
      
      const targetIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      for (const targetId of targetIds) {
        const hand = match.playerHands[targetId];
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
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[fishing village triggered effect] gaining 1 action...`);
          await runGameActionDelegate('gainAction', { count: 1 });
          
          console.log(`[fishing village triggered effect] gaining 1 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 1 });
        }
      })
    }
  },
  'haven': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId: playedCardId, reactionManager }) => {
      console.log(`[haven effect] drawing card...`);
      await runGameActionDelegate('drawCard', { playerId });
      
      
      console.log(`[haven effect] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card to set aside',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      }) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.warn('[haven effect] no card selected');
        
        reactionManager.registerReactionTemplate({
          id: `haven:${playedCardId}:endTurn`,
          playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          listeningFor: 'endTurn',
          condition: () => true,
          triggeredEffectFn: async () => {
            await runGameActionDelegate('discardCard', { cardId: playedCardId, playerId })
          }
        })
        return;
      }
      
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: 'set-aside' }
      });
      
      const setAsideCleanup = await runGameActionDelegate('setAside', {
        cardId,
        playerId,
        sourceCardId: playedCardId
      });
      
      reactionManager.registerReactionTemplate({
        id: `haven:${playedCardId}:startTurn`,
        listeningFor: 'startTurn',
        compulsory: true,
        once: true,
        playerId,
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[haven triggered effect] moving selected card to hand...`);
          setAsideCleanup();
          await runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: playerId,
            to: { location: 'playerHands' }
          });
        }
      });
    }
  },
  'island': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId }) => {
      console.log(`[ISLAND EFFECT] prompting user to select card...`);
      
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Choose card',
        validPrompt: '',
        playerId,
        restrict: { from: { location: 'playerHands' } },
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
      onLeavePlay: (args) => {
        args.reactionManager.unregisterTrigger(`lighthouse:${args.cardId}:startTurn`);
        args.reactionManager.unregisterTrigger(`lighthouse:${args.cardId}:cardPlayed`);
      },
      onCardPlayed: args => {
        args.reactionManager.registerReactionTemplate({
          id: `lighthouse:${args.cardId}:cardPlayed`,
          playerId: args.playerId,
          listeningFor: 'cardPlayed',
          condition: ({ trigger, cardLibrary }) => {
            const playedCard = cardLibrary.getCard(trigger.cardId!);
            return trigger.cardId !== args.cardId && trigger.playerId !== args.playerId && playedCard.type.includes('ATTACK');
          },
          once: false,
          allowMultipleInstances: false,
          compulsory: true,
          triggeredEffectFn: async () => {
            return 'immunity';
          }
        });
        
        args.reactionManager.registerReactionTemplate({
          id: `lighthouse:${args.cardId}:startTurn`,
          playerId: args.playerId,
          listeningFor: 'startTurn',
          condition: ({ trigger }) => trigger.playerId === args.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          triggeredEffectFn: async () => {
            args.reactionManager.unregisterTrigger(`lighthouse:${args.cardId}:cardPlayed`);
            await args.runGameActionDelegate('gainTreasure', { count: 1 });
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
    registerEffects: () => async ({ runGameActionDelegate, playerId, match }) => {
      console.log(`[LOOKOUT EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = match.playerDecks[playerId];
      
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
          to: { location: 'look-at' }
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
            to: { location: 'playerDecks' }
          });
        }
      }
    }
  },
  'merchant-ship': {
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
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[merchant ship triggered effect] gaining 2 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 2 });
        }
      })
    }
  },
  'monkey': {
    registerEffects: () => async ({ reactionManager, match, playerId, cardId, runGameActionDelegate }) => {
      reactionManager.registerReactionTemplate({
        id: `monkey:${cardId}:startTurn`,
        playerId,
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[monkey triggered effect] drawing card at start of turn...`);
          await runGameActionDelegate('drawCard', { playerId });
          
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
          await runGameActionDelegate('drawCard', { playerId });
        },
        condition: ({ trigger }) => trigger.playerId === playerToRightId
      });
    }
  },
  'pirate': {
    registerLifeCycleMethods: () => ({
      onEnterHand: ({ reactionManager, playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `pirate:${cardId}:gainCard`,
          playerId,
          compulsory: false,
          allowMultipleInstances: true,
          once: true,
          listeningFor: 'gainCard',
          condition: ({ cardLibrary, trigger }) => cardLibrary.getCard(trigger.cardId!).type.includes('TREASURE'),
          triggeredEffectFn: async ({ runGameActionDelegate }) => {
            await runGameActionDelegate('playCard', {
              playerId,
              cardId,
              overrides: {
                actionCost: 0,
              }
            });
          }
        });
      },
      onLeaveHand: ({ reactionManager, cardId }) => {
        reactionManager.unregisterTrigger(`pirate:${cardId}:gainCard`);
      }
    }),
    registerEffects: () => async ({ reactionManager, playerId, match, cardId, runGameActionDelegate }) => {
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
        }) => trigger.playerId === playerId && reaction.id === id && match.turnNumber !== turnPlayed,
        triggeredEffectFn: async () => {
          console.log(`[pirate triggered effect] prompting user to select treasure costing up to 6...`);
          const cardIds = (await runGameActionDelegate('selectCard', {
            prompt: 'Gain card',
            validPrompt: '',
            playerId,
            restrict: {
              from: { location: ['supply', 'kingdom'] },
              card: { type: 'TREASURE' },
              cost: { kind: 'upTo', amount: 6 }
            },
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
            to: { location: 'playerHands' },
          });
        }
      });
    }
  },
  'native-village': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match }) => {
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
        const deck = match.playerDecks[playerId];
        
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
      
      const matCardIds = match.mats[playerId]['native-village'].concat();
      
      console.log(`[NATIVE VILLAGE EFFECT] moving ${matCardIds.length} cards from native village mat to hand...`);
      for (const cardId of matCardIds) {
        await runGameActionDelegate('moveCard', {
          cardId: cardId,
          toPlayerId: playerId,
          to: { location: 'playerHands' }
        });
      }
    }
  },
  'sailor': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: ({ reactionManager, cardId }) => {
        reactionManager.unregisterTrigger(`sailor:${cardId}:gainCard`);
        reactionManager.unregisterTrigger(`sailor:${cardId}:startTurn`);
      },
      onCardPlayed: (args) => {
        args.reactionManager.registerReactionTemplate({
          id: `sailor:${args.cardId}:gainCard`,
          playerId: args.playerId,
          listeningFor: 'gainCard',
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            const cardGained = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.cardId!);
            
            if (!cardGained.type.includes('DURATION')) {
              return false;
            }
            
            if (conditionArgs.trigger.playerId !== args.playerId) {
              return false;
            }
            
            return conditionArgs.match.stats.playedCards[conditionArgs.trigger.cardId!] === undefined;
          },
          triggeredEffectFn: async (triggeredArgs) => {
            console.log(`[sailor triggered effect] playing ${triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.cardId!)}`);
            await triggeredArgs.runGameActionDelegate('playCard', {
              playerId: args.playerId,
              cardId: triggeredArgs.trigger.cardId!,
              overrides: { actionCost: 0 }
            });
          }
        });
        
        args.reactionManager.registerReactionTemplate({
          id: `sailor:${args.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: args.playerId,
          compulsory: true,
          once: true,
          allowMultipleInstances: true,
          condition: ({ trigger, match }) =>
            trigger.playerId === args.playerId && match.stats.playedCards[args.cardId].turnNumber !== match.turnNumber,
          triggeredEffectFn: async () => {
            console.log(`[sailor triggered effect] gaining 2 treasure...`);
            await args.runGameActionDelegate('gainTreasure', { count: 2 });
            
            const cardIds = await args.runGameActionDelegate('selectCard', {
              prompt: 'Trash card',
              playerId: args.playerId,
              restrict: { from: { location: 'playerHands' } },
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
              playerId: args.playerId,
              cardId,
            });
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
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, cardLibrary }) => {
      console.log(`[salvager effect] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', { count: 1 });
      
      console.log(`[salvager effect] prompting user to select a card from hand...`);
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Trash card',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.log(`[salvager effect] no card selected...`);
        return;
      }
      
      console.log(`[salvager effect] trashing card...`);
      await runGameActionDelegate('trashCard', { cardId, playerId });
      
      const effectiveCost = getEffectiveCardCost(playerId, cardId, match, cardLibrary);
      
      console.log(`[salvager effect] gaining ${effectiveCost} buy...`);
      await runGameActionDelegate('gainTreasure', { count: effectiveCost });
    }
  },
  'sea-chart': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, match, cardLibrary }) => {
      console.log(`[SEA CHART EFFECT] drawing 1 card...`);
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[SEA CHART EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = match.playerDecks[playerId];
      
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
        moveToRevealed: true
      });
      
      const copyInPlay = match.playArea.map(cardLibrary.getCard)
        .find(playAreaCard => playAreaCard.cardKey === card.cardKey && playAreaCard.owner === playerId);
      
      console.log(`[SEA CHART EFFECT] ${copyInPlay ? 'copy is in play' : 'no copy in play'}...`);
      
      console.log(`[SEA CHART EFFECT] moving card to ${copyInPlay ? 'playerHands' : 'playerDecks'}...`);
      
      await runGameActionDelegate('moveCard', {
        cardId,
        toPlayerId: playerId,
        to: { location: copyInPlay ? 'playerHands' : 'playerDecks' }
      });
    }
  },
  'sea-witch': {
    registerLifeCycleMethods: () => ({
      onCardPlayed: (args) => {
        args.reactionManager.registerReactionTemplate({
          id: `sea-witch:${args.cardId}:startTurn`,
          playerId: args.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: (conditionArgs) => {
            return conditionArgs.trigger.playerId === args.playerId
          },
          triggeredEffectFn: async (triggerArgs) => {
            console.log(`[sea-witch triggered effect] drawing cards...`)
            await triggerArgs.runGameActionDelegate('drawCard', { playerId: args.playerId });
            await triggerArgs.runGameActionDelegate('drawCard', { playerId: args.playerId });
            
            console.log(`[sea-witch triggered effect] selecting discarding cards...`);
            
            const selectedCards = await triggerArgs.runGameActionDelegate('selectCard', {
              prompt: 'Discard cards',
              restrict: { from: { location: 'playerHands' } },
              count: 2,
              playerId: args.playerId
            }) as number[];
            
            for (const selectedCardId of selectedCards) {
              await triggerArgs.runGameActionDelegate('discardCard', {
                cardId: selectedCardId,
                playerId: args.playerId
              });
            }
          }
        })
      }
    }),
    registerEffects: () => async (args) => {
      console.log(`[sea witch effect] drawing cards...`);
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: args.playerId,
        appliesTo: 'ALL_OTHER',
        match: args.match
      }).filter(playerId => args.reactionContext[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const curseCardIds = findCards(args.match, {
          from: { location: 'supply' },
          card: { cardKeys: 'curse' }
        }, args.cardLibrary);
        if (curseCardIds.length === 0) {
          console.log(`[sea witch effect] no curses in supply...`);
          break;
        }
        
        console.log(`[sea witch effect] giving curse to ${getPlayerById(args.match, targetPlayerId)}`);
        await args.runGameActionDelegate('gainCard', {
          cardId: curseCardIds[0],
          playerId: targetPlayerId,
          to: { location: 'playerDiscards' }
        });
      }
    }
  },
  'smugglers': {
    registerEffects: () => async ({ match, cardLibrary, playerId, runGameActionDelegate }) => {
      const previousPlayer = getPlayerStartingFrom({
        startFromIdx: getPlayerTurnIndex({ match, playerId }),
        match,
        distance: -1
      });
      
      console.log(`[smugglers effect] looking at ${previousPlayer} cards gained`);
      
      const cardsGained = match.stats.cardsGained;
      
      let cardIds = Object.keys(cardsGained)
        .map(Number)
        .filter(cardId => {
          return cardsGained[cardId].playerId === previousPlayer.id &&
            cardsGained[cardId].turnNumber === match.turnNumber - 1;
        })
        .filter(cardId => {
          const cost = getEffectiveCardCost(
            playerId,
            +cardId,
            match,
            cardLibrary
          );
          
          return cost <= 6;
        });
      
      console.log(`[smugglers effect] found ${cardIds.length} costing up to 6 that were played`);
      
      const inSupply = (card: Card) =>
        match.supply.concat(match.kingdom).find(id => cardLibrary.getCard(id).cardKey === card.cardKey);
      
      cardIds = cardIds.map(cardLibrary.getCard).map(inSupply).filter(id => id !== undefined);
      
      console.log(`[smugglers effect] found ${cardIds.length} available cards in supply to choose from`);
      
      if (!cardIds.length) {
        return;
      }
      
      console.log(`[smugglers effect] prompting user to select a card...`);
      
      const results = await runGameActionDelegate('selectCard', {
        playerId: playerId,
        restrict: cardIds,
        prompt: `Gain a card`,
      }) as number[];
      
      const cardId = results[0];
      
      if (!cardId) {
        console.warn(`[smugglers effect] no card selected`);
        return;
      }
      
      console.log(`[smugglers effect] gaining card...`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId: cardId,
        to: { location: 'playerDiscards' },
      });
    }
  },
  'tactician': {
    registerEffects: () => async (args) => {
      const hand = args.match.playerHands[args.playerId];
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
          return conditionArgs.trigger.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber
        },
        triggeredEffectFn: async (triggerArgs) => {
          console.warn(`[tactician triggered effect] drawing 5 cards`);
          for (let i = 0; i < 4; i++) {
            const card = await triggerArgs.runGameActionDelegate('drawCard', { playerId: args.playerId }) as CardId;
            if (!card) {
              console.warn(`[tactician triggered effect] no card drawn`);
              break;
            }
          }
          
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
      console.log(`[tide pools effect] drawing 3 cards...`);
      for (let i = 0; i < 3; i++) {
        await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      }
      
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
          conditionArgs.trigger.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber,
        triggeredEffectFn: async (triggerArgs) => {
          console.log(`[tide pools triggered effect] selecting two cards to discard`);
          const selectedCardIds = await triggerArgs.runGameActionDelegate('selectCard', {
            playerId: args.playerId,
            prompt: `Discard cards`,
            restrict: { from: { location: 'playerHands' } },
            count: 2
          }) as CardId[];
          
          if (!selectedCardIds.length) {
            return;
          }
          
          for (const cardId of selectedCardIds) {
            await triggerArgs.runGameActionDelegate('discardCard', { cardId, playerId: args.playerId });
          }
        }
      })
    }
  },
  'treasure-map': {
    registerEffects: () => async ({ runGameActionDelegate, playerId, cardId, match, cardLibrary }) => {
      console.log(`[treasure map effect] trashing played treasure map...`);
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      const hand = match.playerHands[playerId];
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
      
      const goldCardIds = match.supply.filter(cardId => cardLibrary.getCard(cardId).cardKey === 'gold');
      for (let i = 0; i < Math.min(goldCardIds.length, 4); i++) {
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: goldCardIds[i],
          to: { location: 'playerDecks' },
        });
      }
    }
  },
  'treasury': {
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
          if (getTurnPhase(args.match.turnPhaseIndex) !== 'buy') return false;
          
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
            to: { location: 'playerDecks' }
          });
        }
      })
    }
  },
  'warehouse': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[warehouse effect] drawing 3 cards...`);
      for (let i = 0; i < 3; i++) {
        await runGameActionDelegate('drawCard', { playerId });
      }
      
      console.log(`[warehouse effect] gaining 1 actions...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Discard cards',
        playerId,
        restrict: { from: { location: 'playerHands' } },
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
      onCardPlayed: (args) => {
        args.reactionManager.registerReactionTemplate({
          id: `wharf:${args.cardId}:startTurn`,
          playerId: args.playerId,
          listeningFor: 'startTurn',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            return conditionArgs.trigger.playerId === args.playerId &&
              conditionArgs.match.stats.playedCards[args.cardId].turnNumber < conditionArgs.match.turnNumber
          },
          triggeredEffectFn: async (triggerArgs) => {
            console.log(`[wharf triggered effect] drawing 2 cards`);
            for (let i = 0; i < 2; i++) {
              await triggerArgs.runGameActionDelegate('drawCard', { playerId: args.playerId });
            }
            
            console.log(`[wharf triggered effect] gaining 1 buy`);
            await triggerArgs.runGameActionDelegate('gainBuy', { count: 1 });
          }
        })
      }
    }),
    registerEffects: () => async (args) => {
      console.log(`[wharf effect] drawing 2 cards...`);
      for (let i = 0; i < 2; i++) {
        await args.runGameActionDelegate('drawCard', { playerId: args.playerId });
      }
      
      console.log(`[wharf effect] gaining 1 buy...`);
      await args.runGameActionDelegate('gainBuy', { count: 1 });
    }
  }
}

export default expansion;