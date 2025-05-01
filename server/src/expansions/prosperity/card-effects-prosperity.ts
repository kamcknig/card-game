import './types.ts';
import { CardId, CardKey } from 'shared/shared-types.ts';
import { CardExpansionModuleNew } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';

const expansion: CardExpansionModuleNew = {
  'anvil': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const selectedCardToDiscardIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: { from: { location: 'playerHands' }, card: { type: 'TREASURE' } },
        count: 1,
        optional: true,
      }) as CardId[];
      
      const selectedCardToDiscardId = selectedCardToDiscardIds[0];
      if (!selectedCardToDiscardId) {
        console.log(`[anvil effect] no card selected`);
        return;
      }
      
      const selectedCardToTrash = effectArgs.cardLibrary.getCard(selectedCardToDiscardId);
      console.log(`[anvil effect] selected ${selectedCardToTrash}`);
      
      await effectArgs.runGameActionDelegate('discardCard', {
        cardId: selectedCardToDiscardId,
        playerId: effectArgs.playerId
      });
      
      const selectedCardToGainIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: { playerId: effectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } }
        },
        count: 1,
      }) as CardId[];
      
      const selectedCardToGainId = selectedCardToGainIds[0];
      
      if (!selectedCardToGainId) {
        console.log(`[anvil effect] no card selected`);
        return;
      }
      
      const selectedCardToGain = effectArgs.cardLibrary.getCard(selectedCardToGainId);
      
      console.log(`[anvil effect] selected ${selectedCardToGain}`);
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedCardToGainId,
        to: { location: 'playerDiscards' }
      });
    }
  },
  'bank': {
    registerEffects: () => async (effectArgs) => {
      const playedCardIds = effectArgs.match.stats.playedCardsByTurn[effectArgs.match.turnNumber];
      const playedTreasureCards = playedCardIds.map(effectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));
      
      console.log(`[bank effect] played ${playedTreasureCards.length} treasure cards, gaining ${playedTreasureCards.length} treasure`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: playedTreasureCards.length });
    }
  },
  'bishop': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[bishop effect] gaining 1 treasure and 1 victory token`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      await effectArgs.runGameActionDelegate('gainVictoryToken', { playerId: effectArgs.playerId, count: 1 });
      
      const hand = effectArgs.match.playerHands[effectArgs.playerId];
      if (hand.length === 0) {
        console.log(`[bishop effect] no cards in hand`);
      }
      else {
        console.log(`[bishop effect] prompting player to select card to trash`);
        
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: { from: { location: 'playerHands' } },
          count: 1,
        }) as CardId[];
        
        const selectedCardId = selectedCardIds[0];
        
        if (!selectedCardId) {
          console.warn(`[bishop effect] no card selected`);
        }
        else {
          const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
          
          console.log(`[bishop effect] selected ${selectedCard} to trash`);
          
          await effectArgs.runGameActionDelegate('trashCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardId,
          });
          
          const { cost: selectedCardCost } = effectArgs.cardPriceController.applyRules(selectedCard, {
            match: effectArgs.match,
            playerId: effectArgs.playerId
          })
          
          const tokensToGain = Math.floor(selectedCardCost.treasure / 2);
          
          console.log(`[bishop effect] gaining ${tokensToGain} victory tokens`);
          
          await effectArgs.runGameActionDelegate('gainVictoryToken', {
            playerId: effectArgs.playerId,
            count: tokensToGain
          });
        }
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId
      });
      
      for (const targetPlayerId of targetPlayerIds) {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: targetPlayerId,
          prompt: `Trash card`,
          restrict: { from: { location: 'playerHands' } },
          count: 1,
          optional: true,
        }) as CardId[];
        
        const selectedCardId = selectedCardIds[0];
        
        if (!selectedCardId) {
          console.log(`[bishop effect] target player ${targetPlayerId} selected no card`);
          continue;
        }
        
        await effectArgs.runGameActionDelegate('trashCard', {
          playerId: targetPlayerId,
          cardId: selectedCardId,
        });
      }
    }
  },
  'charlatan': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[charlatan effect] gaining 3 treasure and 1 action`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 3 });
      
      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId
      }).filter(playerId => effectArgs.reactionContext?.[playerId].result !== 'immunity');
      
      console.log(`[charlatan effect] targets ${targetPlayerIds} gaining a curse`);
      
      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = findCards(
          effectArgs.match,
          {
            location: 'supply',
            cards: { cardKeys: 'curse' }
          },
          effectArgs.cardLibrary
        );
        if (!curseCards.length) {
          console.log(`[charlatan effect] no curse cards in supply`);
          break;
        }
        
        await effectArgs.runGameActionDelegate('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCards.slice(-1)[0],
          to: { location: 'playerDiscards' }
        });
      }
    }
  },
  'city': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[city effect] drawing 1 card and gaining 1 action`);
      await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      await effectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
      const emptySupplyCount = getStartingSupplyCount(effectArgs.match) - getRemainingSupplyCount(effectArgs.match, effectArgs.cardLibrary);
      
      if (emptySupplyCount > 0) {
        console.log(`[city effect] empty supply count is greater than 0; drawing 1 card`);
        await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      }
      
      if (emptySupplyCount > 1) {
        console.log(`[city effect] empty supply count is greater than 1; gaining 1 buy and 1 treasure`);
        await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
        await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      }
    }
  },
  'clerk': {
    registerLifeCycleMethods: () => ({
      onEnterHand: args => {
        args.reactionManager.registerReactionTemplate({
          id: `clerk:${args.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: args.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: false,
          condition: (conditionArgs) => conditionArgs.trigger.args.playerId === args.playerId,
          triggeredEffectFn: async (triggerEffectArgs) => {
            await triggerEffectArgs.runGameActionDelegate('playCard', {
              playerId: args.playerId,
              cardId: args.cardId,
              overrides: {
                actionCost: 0
              }
            });
          }
        })
      },
      onLeaveHand: args => {
        args.reactionManager.unregisterTrigger(`clerk:${args.cardId}:startTurn`)
      }
    }),
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId
      }).filter(playerId => {
        return effectArgs.reactionContext?.[playerId]?.result !== 'immunity' &&
          effectArgs.match.playerHands[playerId].length >= 5;
      });
      
      for (const targetPlayerId of targetPlayerIds) {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: targetPlayerId,
          prompt: `Top-deck card`,
          restrict: { from: { location: 'playerHands' } },
          count: 1
        }) as CardId[];
        
        if (!selectedCardIds) {
          console.log(`[clerk effect] target player ${targetPlayerId} selected no card`);
          continue;
        }
        
        await effectArgs.runGameActionDelegate('moveCard', {
          cardId: selectedCardIds[0],
          toPlayerId: targetPlayerId,
          to: { location: 'playerDecks' }
        });
      }
    }
  },
  'collection': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: args => {
        args.reactionManager.unregisterTrigger(`collection:${args.cardId}:gainCard`);
      }
    }),
    registerEffects: () => async (effectArgs) => {
      console.log(`[collection effect] gaining 2 treasure and 1 buy`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      effectArgs.reactionManager.registerReactionTemplate({
        id: `collection:${effectArgs.cardId}:gainCard`,
        playerId: effectArgs.playerId,
        listeningFor: 'gainCard',
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          const currentTurnNumber = conditionArgs.match.turnNumber;
          if (currentTurnNumber !== conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId].turnNumber) return false;
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!card.type.includes('ACTION')) return false;
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          console.log(`[collection triggered effect] gaining 1 victory token`);
          await triggeredEffectArgs.runGameActionDelegate('gainVictoryToken', {
            playerId: effectArgs.playerId,
            count: 1
          });
        }
      })
    }
  },
  'crystal-ball': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      const deck = effectArgs.match.playerDecks[effectArgs.playerId];
      const discard = effectArgs.match.playerDiscards[effectArgs.playerId];
      
      if (deck.length + discard.length === 0) {
        console.log(`[crystal-ball effect] no cards to look at`);
        return;
      }
      
      if (deck.length === 0) {
        await effectArgs.runGameActionDelegate('shuffleDeck', { playerId: effectArgs.playerId });
      }
      
      const cardId = deck.slice(-1)[0];
      const card = effectArgs.cardLibrary.getCard(cardId);
      
      const actions = [
        { label: 'Trash', action: 1 },
        { label: 'Discard', action: 2 }
      ];
      
      const isAction = card.type.includes('ACTION')
      const isTreasure = card.type.includes('TREASURE')
      
      if (isAction || isTreasure) {
        actions.push({ label: 'Play', action: 3 });
      }
      
      const result = await effectArgs.runGameActionDelegate('userPrompt', {
        prompt: `You drew ${card.cardName}`,
        playerId: effectArgs.playerId,
        actionButtons: actions,
      }) as { action: number, cardIds: number[] };
      
      switch (result.action) {
        case 1:
          await effectArgs.runGameActionDelegate('trashCard', { playerId: effectArgs.playerId, cardId });
          break;
        case 2:
          await effectArgs.runGameActionDelegate('discardCard', { cardId, playerId: effectArgs.playerId });
          break;
        case 3:
          await effectArgs.runGameActionDelegate('playCard', {
            playerId: effectArgs.playerId,
            cardId,
            overrides: { actionCost: 0 }
          });
          break;
      }
    }
  },
  'expand': {
    registerEffects: () => async (effectArgs) => {
      console.log('[expand effect] prompting to select card to trash')
      const selectedToTrashIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Trash card`,
        restrict: { from: { location: 'playerHands' } },
        count: 1
      }) as CardId[];
      
      if (!selectedToTrashIds.length) {
        console.log(`[expand effect] no card selected`);
        return;
      }
      
      const selectedToTrashId = selectedToTrashIds[0];
      let card = effectArgs.cardLibrary.getCard(selectedToTrashId);
      console.log(`[expand effect] selected ${card} to trash`)
      
      const { cost: effectCost } = effectArgs.cardPriceController.applyRules(card, {
        match: effectArgs.match,
        playerId: effectArgs.playerId
      });
      
      const selectedToGainIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: {
          from: { location: ['kingdom', 'supply'] },
          cost: {
            kind: 'upTo',
            playerId: effectArgs.playerId,
            amount: { treasure: effectCost.treasure + 3, potion: effectCost.potion }
          }
        },
        count: 1,
      }) as CardId[];
      
      if (!selectedToGainIds.length) {
        console.log(`[expand effect] no card selected`);
        return;
      }
      
      card = effectArgs.cardLibrary.getCard(selectedToGainIds[0]);
      
      console.log(`[expand effect] selected ${card} to gain`)
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedToGainIds[0],
        to: { location: 'playerDiscards' }
      });
    }
  },
  'forge': {
    registerEffects: () => async (effectArgs) => {
      const selectedCardIdsToTrash = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Trash cards`,
        restrict: { from: { location: 'playerHands' } },
        count: {
          kind: 'upTo',
          count: effectArgs.match.playerHands[effectArgs.playerId].length
        },
        optional: true,
      }) as CardId[];
      
      let cost = { treasure: 0, potion: 0 };
      if (!selectedCardIdsToTrash.length) {
        cost = { treasure: 0, potion: 0 };
      }
      else {
        for (const cardId of selectedCardIdsToTrash) {
          const card = effectArgs.cardLibrary.getCard(cardId);
          const { cost: cardCost } = effectArgs.cardPriceController.applyRules(card, {
            match: effectArgs.match,
            playerId: effectArgs.playerId
          });
          cost = {
            treasure: cost.treasure + cardCost.treasure,
            potion: cost.potion + (cardCost.potion ?? 0)
          };
          
          await effectArgs.runGameActionDelegate('trashCard', { playerId: effectArgs.playerId, cardId });
        }
      }
      
      const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: {
          from: { location: ['supply', 'kingdom'] },
          cost: {
            kind: 'exact',
            amount: { treasure: cost.treasure, potion: 0 },
            playerId: effectArgs.playerId
          }
        },
        count: 1,
      }) as CardId[];
      
      if (selectedCardIds.length === 0) {
        console.log(`[forge effect] no card selected`);
        return;
      }
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedCardIds[0],
        to: { location: 'playerDiscards' }
      });
    }
  },
  'grand-market': {
    registerActionConditions: () => ({
      canBuy: ({ match, cardLibrary, playerId }) =>
        !match.stats.playedCardsByTurn[match.turnNumber]?.find((cardId) => {
          return cardLibrary.getCard(cardId).cardKey === 'copper' &&
            match.stats.playedCards[cardId].playerId === playerId
        })
    }),
    registerEffects: () => async (effectArgs) => {
      console.log(`[grand market effect] drawing 1 card, gaining 1 action, gaining 1 buy, and gaining 2 treasure`);
      await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      await effectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
    }
  },
  'hoard': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: args => {
        args.reactionManager.unregisterTrigger(`hoard:${args.cardId}:gainCard`);
      }
    }),
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      effectArgs.reactionManager.registerReactionTemplate({
        id: `hoard:${effectArgs.cardId}:gainCard`,
        listeningFor: 'gainCard',
        compulsory: true,
        allowMultipleInstances: true,
        once: false,
        condition: (conditionArgs) => {
          if (conditionArgs.match.turnNumber !==
            conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId]?.turnNumber) return false;
          
          if (!conditionArgs.trigger.args.bought) return false;
          
          if (conditionArgs.trigger.args.playerId !== effectArgs.playerId) return false;
          
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const goldCardIds = findCards(
            triggeredEffectArgs.match,
            {
              location: 'supply',
              cards: { cardKeys: 'gold' }
            },
            triggeredEffectArgs.cardLibrary,
          );
          
          if (!goldCardIds.length) {
            console.log(`[hoard triggered effect] no gold in supply`);
            return;
          }
          
          await triggeredEffectArgs.runGameActionDelegate('gainCard', {
            playerId: effectArgs.playerId,
            cardId: goldCardIds.slice(-1)[0],
            to: { location: 'playerDiscards' }
          });
        },
        playerId: effectArgs.playerId
      })
    }
  },
  'investment': {
    registerEffects: () => async (effectArgs) => {
      if (effectArgs.match.playerHands[effectArgs.playerId].length === 0) {
        console.log(`[investment effect] no cards in hand`);
      }
      else {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: { from: { location: 'playerHands' } },
          count: 1
        }) as CardId[];
        
        if (!selectedCardIds[0]) {
          console.warn(`[investment effect] no card selected to trash`);
        }
        else {
          await effectArgs.runGameActionDelegate('trashCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardIds[0],
          });
        }
      }
      
      const result = await effectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: effectArgs.playerId,
        actionButtons: [
          { label: '+1 Treasure', action: 1 },
          { label: 'Trash and reveal', action: 2 }
        ],
      }) as { action: number, cardIds: number[] };
      
      if (result.action === 1) {
        await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      }
      else {
        const hand = effectArgs.match.playerHands[effectArgs.playerId];
        let uniqueTreasureCount: CardKey[] = [];
        const l = hand.length - 1;
        for (let i = l; i >= 0; i--) {
          await effectArgs.runGameActionDelegate('revealCard', {
            cardId: hand[i],
            playerId: effectArgs.playerId,
          });
          const card = effectArgs.cardLibrary.getCard(hand[i]);
          uniqueTreasureCount.push(card.cardKey);
        }
        uniqueTreasureCount = Array.from(new Set(uniqueTreasureCount));
        await effectArgs.runGameActionDelegate('gainVictoryToken', {
          playerId: effectArgs.playerId,
          count: uniqueTreasureCount.length
        });
      }
    }
  },
  'kings-court': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[kings court effect] prompting user to select card`);
      
      const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Choose action`,
        restrict: {
          from: { location: 'playerHands' },
          card: { type: 'ACTION' }
        },
        count: 1,
        optional: true
      }) as CardId[];
      
      const selectedCardId = selectedCardIds[0];
      
      if (!selectedCardId) {
        console.log(`[kings court effect] no selected card`);
        return;
      }
      
      const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
      
      console.log(`[kings court effect] selected ${selectedCard}`);
      
      for (let i = 0; i < 3; i++) {
        await effectArgs.runGameActionDelegate('playCard', {
          playerId: effectArgs.playerId,
          cardId: selectedCardId,
          overrides: {
            actionCost: 0
          }
        })
      }
    }
  },
  'magnate': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[magnate effect] revealing hand`);
      const hand = effectArgs.match.playerHands[effectArgs.playerId];
      let treasureCardCount = 0;
      for (let i = hand.length - 1; i >= 0; i--) {
        const card = effectArgs.cardLibrary.getCard(hand[i]);
        treasureCardCount += card.type.includes('TREASURE') ? 1 : 0;
        await effectArgs.runGameActionDelegate('revealCard', {
          cardId: hand[i],
          playerId: effectArgs.playerId,
        });
      }
      
      console.log(`[magnate effect] ${treasureCardCount} treasure revealed`);
      
      for (let i = 0; i < treasureCardCount; i++) {
        await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      }
    }
  },
  'platinum': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 5 });
    }
  }
}

export default expansion;