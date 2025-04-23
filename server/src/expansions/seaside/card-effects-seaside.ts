import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { Card, CardId } from 'shared/shared-types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';

const expansion: CardExpansionModule = {
  registerCardLifeCycles: () => ({
    'astrolabe': {
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
    },
    'corsair': {
      onLeavePlay: ({ reactionManager, cardId }) => {
        reactionManager.unregisterTrigger(`corsair:${cardId}:starTurn`);
      }
    },
    'pirate': {
      onEnterHand: ({ reactionManager, playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `pirate:${cardId}:onEnterHand`,
          playerId,
          compulsory: false,
          allowMultipleInstances: true,
          once: true,
          listeningFor: 'gainCard',
          condition: ({ cardLibrary, trigger }) =>
            cardLibrary.getCard(trigger.cardId!).type.includes('TREASURE'),
          triggeredEffectFn: async ({ runGameActionDelegate, trigger }) => {
            await runGameActionDelegate('playCard', {
              playerId: trigger.playerId,
              cardId: trigger.cardId!,
              overrides: {
                actionCost: 0,
              }
            });
          }
        });
      },
      onLeaveHand: ({ reactionManager, cardId }) => {
        reactionManager.unregisterTrigger(`pirate:${cardId}:onEnterHand`);
      }
    }
  }),
  registerScoringFunctions: () => ({}),
  registerEffects: {
    'astrolabe': () => async ({ runGameActionDelegate }) => {
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
      
      console.log(`[SEASON EFFECT] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', { count: 1 });
    },
    'bazaar': () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[SEASON EFFECT] drawing 1 card...`);
      await runGameActionDelegate('drawCard', {
        playerId: playerId,
      });
      
      console.log(`[SEASON EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[SEASON EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
    },
    'blockade': () => async ({ match, reactionManager, runGameActionDelegate, cardLibrary, playerId }) => {
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
            playerId: args.trigger.playerId,
            cardId: curseCardIds[0],
            to: { location: 'playerDiscards' },
          });
        }
      })
    },
    'caravan': () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
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
    },
    'corsair': () => async ({ runGameActionDelegate, reactionManager, cardId, playerId, reactionContext }) => {
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
        }
      });
      
      reactionManager.registerReactionTemplate({
        id: `corsair:${cardId}:cardPlayed`,
        playerId,
        listeningFor: 'cardPlayed',
        compulsory: true,
        condition: ({ match, trigger, cardLibrary }) => {
          if (!trigger.cardId) return false;
          
          if (reactionContext[trigger.playerId]?.result === 'immunity') {
            console.log(`[corsair triggered effect] ${getPlayerById(match, trigger.playerId)} is immune`);
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
            playerId: trigger.playerId,
            cardId: trigger.cardId!,
          });
        }
      })
    },
    'cutpurse': () => async ({ runGameActionDelegate, playerId, match, reactionContext, cardLibrary }) => {
      console.log(`[CUTPURSE EFFECT] gaining 2 treasure...`);
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
          console.log(`[CUTPURSE EFFECT] discarding copper...`);
          await runGameActionDelegate('discardCard', {
            cardId: copperId,
            playerId: targetId
          });
          continue;
        }
        
        console.log(`[CUTPURSE EFFECT] revealing hand...`);
        for (const cardId of hand) {
          await runGameActionDelegate('revealCard', {
            cardId,
            playerId: targetId,
          });
        }
      }
    },
    'fishing-village': () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
      console.log(`[FISHING VILLAGE EFFECT] gaining 2 action...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[FISHING VILLAGE EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
      
      reactionManager.registerReactionTemplate({
        id: `fishing-village:${cardId}:startTurn`,
        once: true,
        compulsory: true,
        playerId,
        allowMultipleInstances: true,
        listeningFor: 'startTurn',
        condition: () => true,
        triggeredEffectFn: async () => {
          console.log(`[FISHING VILLAGE TRIGGERED EFFECT] gaining 1 action...`);
          await runGameActionDelegate('gainAction', { count: 1 });
          
          console.log(`[FISHING VILLAGE TRIGGERED EFFECT] gaining 1 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 1 });
        }
      })
    },
    'haven': () => async ({ runGameActionDelegate, playerId, cardId: playedCardId, reactionManager }) => {
      console.log(`[haven effect] drawing card...`);
      await runGameActionDelegate('drawCard', { playerId });
      
      
      console.log(`[haven effect] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card to set aside',
        validPrompt: '',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      }) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.warn('[haven effect] no card selected');
        return;
      }
      
      await runGameActionDelegate('moveCard', {
        cardId: cardId,
        toPlayerId: playerId,
        to: { location: 'set-aside' }
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
          await runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: playerId,
            to: { location: 'playerHands' }
          });
        }
      });
    },
    'island': () => async ({ runGameActionDelegate, playerId, cardId }) => {
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
    },
    'lookout': () => async ({ runGameActionDelegate, playerId, match }) => {
      console.log(`[LOOKOUT EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = match.playerDecks[playerId];
      
      if (deck.length < 3) {
        console.log(`[LOOKOUT EFFECT] deck has less than 3 cards, shuffling...`);
        await runGameActionDelegate('shuffleDeck', { playerId });
        
        if (deck.length === 0) {
          console.log(`[LOOKOUT EFFECT] no cards in deck...`);
          return;
        }
      }
      
      const cardIdsToLookAt = deck.slice(Math.max(-3, -deck.length));
      
      console.log(`[LOOKOUT EFFECT] moving cards to look at zone...`);
      for (const cardId of cardIdsToLookAt) {
        await runGameActionDelegate('moveCard', {
          cardId: cardId,
          to: { location: 'look-at' }
        })
      }
      
      console.log(`[LOOKOUT EFFECT] prompting user to select one to trash..`);
      let result = (await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Choose one to trash',
        content: {
          type: 'select',
          cardIds: cardIdsToLookAt,
          selectCount: 1
        }
      })) as { action: number, result: number[] };
      
      let cardId = result.result[0];
      
      console.log(`[LOOKOUT EFFECT] trashing selected card..`);
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      cardIdsToLookAt.splice(cardIdsToLookAt.indexOf(cardId), 1);
      
      if (cardIdsToLookAt.length === 0) {
        console.log(`[LOOKOUT EFFECT] not enough cards to continue..`);
        return;
      }
      
      console.log(`[LOOKOUT EFFECT] prompting user to select one to discard..`);
      result = (await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Choose one to discard',
        content: {
          type: 'select',
          cardIds: cardIdsToLookAt,
          selectCount: 1
        }
      })) as { action: number, result: number[] };
      
      cardId = result.result[0];
      
      console.log(`[LOOKOUT EFFECT] discarding selected card...`);
      await runGameActionDelegate('discardCard', {
        cardId,
        playerId
      });
      
      cardIdsToLookAt.splice(cardIdsToLookAt.indexOf(cardId), 1);
      
      if (cardIdsToLookAt.length === 0) {
        console.log(`[LOOKOUT EFFECT] not enough cards to continue...`);
        return;
      }
      
      cardId = cardIdsToLookAt[0];
      
      console.log(`[LOOKOUT EFFECT] putting last card back on deck...`);
      await runGameActionDelegate('moveCard', {
        cardId: cardId,
        to: { location: 'playerDecks' },
        toPlayerId: playerId
      })
    },
    'merchant-ship': () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
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
    },
    'monkey': () => async ({ reactionManager, match, playerId, cardId, runGameActionDelegate }) => {
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
    },
    'pirate': () => async ({ reactionManager, playerId, cardId, runGameActionDelegate }) => {
      reactionManager.registerReactionTemplate({
        id: `pirate:${cardId}:startTurn`,
        playerId,
        listeningFor: 'startTurn',
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: ({ trigger }) => trigger.playerId === playerId,
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
    },
    'native-village': () => async ({ runGameActionDelegate, playerId, match }) => {
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
    },
    'sailor': () => async ({ runGameActionDelegate, playerId, reactionManager, cardId }) => {
      console.log(`[sailor effect] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      reactionManager.registerReactionTemplate({
        id: `sailor:${cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId,
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        condition: ({ trigger }) => trigger.playerId === playerId,
        triggeredEffectFn: async () => {
          console.log(`[sailor triggered effect] gaining 2 treasure...`);
          await runGameActionDelegate('gainTreasure', { count: 2 });
          
          const cardIds = (await runGameActionDelegate('selectCard', {
            prompt: 'Trash card',
            playerId,
            restrict: { from: { location: 'playerHands' } },
            count: 1,
            optional: true,
            cancelPrompt: `Don't trash`
          })) as number[];
          
          const cardId = cardIds[0];
          
          if (!cardId) {
            console.log(`[sailor triggered effect] no card chosen`);
            return;
          }
          
          console.log(`[sailor triggered effect] trashing selected card...`);
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId,
          });
        }
      });
      
      reactionManager.registerReactionTemplate({
        id: `sailor:${cardId}:gainCard`,
        playerId,
        compulsory: false,
        allowMultipleInstances: true,
        once: true,
        condition: ({ match, cardLibrary, trigger }) => {
          if (!trigger.cardId) {
            console.warn(`[sailor triggered effect] no trigger.cardId`);
            return false;
          }
          
          return !match.stats.playedCards[trigger.cardId]
            && trigger.playerId === playerId
            && cardLibrary.getCard(trigger.cardId).type.includes('DURATION');
        },
        triggeredEffectFn: async ({ runGameActionDelegate, trigger }) => {
          await runGameActionDelegate('playCard', {
            cardId: trigger.cardId!,
            playerId: trigger.playerId,
            overrides: {
              actionCost: 0,
            }
          });
        },
        listeningFor: 'gainCard'
      })
    },
    'salvager': () => async ({ runGameActionDelegate, playerId, match, cardLibrary }) => {
      console.log(`[SALVAGER EFFECT] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', { count: 1 });
      
      console.log(`[SALVAGER EFFECT] prompting user to select a card from hand...`);
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Trash card',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      })) as number[];
      
      const cardId = cardIds[0];
      
      if (!cardId) {
        console.log(`[SALVAGER EFFECT] no card selected...`);
        return;
      }
      
      const effectiveCost = getEffectiveCardCost(playerId, cardId, match, cardLibrary);
      
      console.log(`[SALVAGER EFFECT] gaining ${effectiveCost} buy...`);
      await runGameActionDelegate('gainTreasure', { count: effectiveCost });
    },
    'sea-chart': () => async ({ runGameActionDelegate, playerId, match, cardLibrary }) => {
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
    },
    'smugglers': () => async ({ match, cardLibrary, playerId, runGameActionDelegate }) => {
      const previousPlayer = getPlayerStartingFrom({
        startFromIdx: match.currentPlayerTurnIndex,
        match,
        distance: -1
      });
      
      console.log(`[SMUGGLERS EFFECT] looking at ${previousPlayer} cards played`);
      
      const cardsGained = match.stats.cardsGained;
      
      let cardIds = Object.keys(cardsGained)
        .map(Number)
        .filter(cardId => {
          const cost = getEffectiveCardCost(
            playerId,
            +cardId,
            match,
            cardLibrary
          );
          
          return cost <= 6 &&
            cardsGained[cardId].playerId === previousPlayer.id &&
            cardsGained[cardId].turnNumber <= match.turnNumber;
        });
      
      console.log(`[SMUGGLERS EFFECT] found ${cardIds.length} costing up to 6 that were played`);
      
      const inSupply = (card: Card) =>
        match.supply.concat(match.kingdom).find(id => cardLibrary.getCard(id).cardKey === card.cardKey);
      
      cardIds = cardIds.map(cardLibrary.getCard).map(inSupply).filter(id => id !== undefined);
      
      console.log(`[SMUGGLERS EFFECT] found ${cardIds.length} available cards in supply to choose from`);
      
      if (!cardIds.length) {
        return;
      }
      
      console.log(`[SMUGGLERS EFFECT] prompting user to select a card...`);
      
      const result = (await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Choose a card to gain',
        content: {
          type: 'select',
          selectCount: 1,
          cardIds
        },
      })) as { action: number, result: CardId[] };
      
      const cardId = result.result[0];
      
      if (!cardId) {
        console.warn(`[SMUGGLERS EFFECT] no card selected`);
        return;
      }
      
      console.log(`[SMUGGLERS EFFECT] gaining card...`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId: cardId,
        to: { location: 'playerDiscards' },
      });
    },
    'treasure-map': () => async ({ runGameActionDelegate, playerId, cardId, match, cardLibrary }) => {
      console.log(`[TREASURE MAP EFFECT] trashing played treasure map...`);
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      const hand = match.playerHands[playerId];
      const inHand = hand.find(cardId => cardLibrary.getCard(cardId).cardKey === 'treasure-map');
      
      console.log(`[TREASURE MAP EFFECT] ${inHand ? 'another treasure map is in hand' : 'no other treasure map in hand'}...`);
      
      if (!inHand) {
        return;
      }
      
      console.log(`[TREASURE MAP EFFECT] trashing treasure map from hand...`);
      
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId: inHand,
      });
      
      const trashedCards = match.stats.trashedCards;
      const trashedThisTurn = Object.keys(trashedCards)
        .map(Number)
        .filter(cardId => trashedCards[cardId].playerId === playerId && trashedCards[cardId].turnNumber === match.turnNumber);
      
      if (trashedThisTurn.length > 2) {
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
    'warehouse': () => async ({ runGameActionDelegate, playerId, match }) => {
      console.log(`[WAREHOUSE EFFECT] drawing 3 cards...`);
      for (let i = 0; i < 3; i++) {
        await runGameActionDelegate('drawCard', { playerId });
      }
      
      console.log(`[WAREHOUSE EFFECT] gaining 1 actions...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      const count = Math.min(3, match.playerHands[playerId].length);
      
      console.log(`[WAREHOUSE EFFECT] prompting user to select ${count} cards...`);
      
      const cardIds = (await runGameActionDelegate('selectCard', {
        prompt: 'Discard cards',
        playerId,
        restrict: { from: { location: 'playerHands' } },
        count,
      })) as number[];
      
      console.log(`[WAREHOUSE EFFECT] discarding cards...`);
      
      for (const cardId of cardIds) {
        await runGameActionDelegate('discardCard', {
          cardId,
          playerId
        });
      }
    }
  }
}

export default expansion;