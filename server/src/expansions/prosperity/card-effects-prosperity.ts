import './types.ts';
import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModuleNew } from '../../types.ts';
import { getEffectiveCardCost } from '../../utils/get-effective-card-cost.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';

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
          
          const selectedCardCost = getEffectiveCardCost(
            effectArgs.playerId,
            selectedCardId,
            effectArgs.match,
            effectArgs.cardLibrary
          );
          
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
  'platinum': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 5 });
    }
  }
}

export default expansion;