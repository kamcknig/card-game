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
  'beggar': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`beggar:${eventArgs.cardId}:cardPlayed`);
      },
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `beggar:${eventArgs.cardId}:cardPlayed`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardPlayed',
          once: false,
          allowMultipleInstances: true,
          compulsory: false,
          condition: conditionArgs => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            const thisCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            
            console.log(`[beggar triggered effect] discarding ${thisCard}`);
            await triggeredArgs.runGameActionDelegate('discardCard', {
              cardId: thisCard.id,
              playerId: triggeredArgs.trigger.args.playerId
            });
            
            const silverCards = triggeredArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'silver' }
            ]);
            
            const numToGain = Math.min(2, silverCards.length);
            
            if (numToGain < 1) {
              console.log(`[beggar triggered effect] not enough silver in supply`);
              return;
            }
            
            console.log(`[beggar triggered effect] number of silvers to gain ${numToGain}, one of them to deck`);
            
            for (let i = 0; i < numToGain; i++) {
              await triggeredArgs.runGameActionDelegate('gainCard', {
                playerId: triggeredArgs.trigger.args.playerId,
                cardId: silverCards.slice(-i - 1)[0],
                to: { location: i === 0 ? 'playerDeck': 'playerDiscard' }
              });
            }
          }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const copperCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'copper' }
      ]);
      
      const numToGain = Math.min(3, copperCards.length);
      
      console.log(`[dark-ages] gaining ${numToGain} coppers`);
      
      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: copperCards.slice(-i - 1)[0],
          to: { location: 'playerHand' }
        });
      }
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