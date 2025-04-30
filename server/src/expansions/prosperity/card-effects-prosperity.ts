import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModuleNew } from '../../types.ts';

const expansion: CardExpansionModuleNew = {
  'anvil': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const selectedCardToTrashIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: { from: { location: 'playerHands' }, card: { type: 'TREASURE' } },
        count: 1,
        optional: true,
      }) as CardId[];
      
      const selectedCardToTrashId = selectedCardToTrashIds[0];
      if (!selectedCardToTrashId) {
        console.log(`[anvil effect] no card selected`);
        return;
      }
      
      const selectedCardToTrash = effectArgs.cardLibrary.getCard(selectedCardToTrashId);
      console.log(`[anvil effect] selected ${selectedCardToTrash}`);
      
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
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'platinum': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 5 });
    }
  }
}

export default expansion;