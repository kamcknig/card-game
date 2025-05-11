import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';

const cardEffects: CardExpansionModule = {
  'altar': {
    registerEffects: () => async (cardEffectArgs) => {
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[dark-ages] no card selected`);
        return;
      }
      
      const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToTrash.id,
      });
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', amount: { treasure: 5 }, playerId: cardEffectArgs.playerId }
        ],
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds) {
        console.log(`[dark-ages] no card selected`);
        return;
      }
      
      const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[dark-ages] gaining card ${cardToGain}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToGain.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'armory': {
    registerEffects: () => async (cardEffectArgs) => {
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] }, {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: { treasure: 4 }
          }
        ],
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[dark-ages] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[dark-ages] gaining card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'band-of-misfits': {
    registerEffects: () => async (cardEffectArgs) => {
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: thisCost } = cardEffectArgs.cardPriceController.applyRules(thisCard, { playerId: cardEffectArgs.playerId });
      
      const cardIds = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: thisCost.treasure - 1 } },
      ])
        .filter(card => card.type.includes('ACTION') && !card.type.some(t => ['DURATION', 'COMMAND'].includes(t)));
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card`,
        restrict: cardIds.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[dark-ages] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[dark-ages] playing card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        overrides: {
          actionCost: 0,
          moveCard: false
        }
      })
    }
  },
  'bandit-camp': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[dark-ages] drawing 1 card and gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    }
  },
  'spoils': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[dark-ages] gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 3 });
      
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      
      console.log(`[dark-ages] moving ${thisCard} back to supply`);
      
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' }
      });
    }
  },
}

export default cardEffects;