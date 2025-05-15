import { CardId } from "shared/shared-types.ts";
import { CardExpansionModule } from '../../types.ts';

const expansion: CardExpansionModule = {
  'amulet': {
    registerEffects: () => async (cardEffectArgs) => {
      const actions = [
        { label: '+1 TREASURE', action: 1 },
        { label: 'TRASH A CARD', action: 2 },
        { label: 'GAIN A SILVER', action: 3 }
      ];
      
      const decision = async () => {
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one',
          actionButtons: actions,
        }) as { action: number, result: number[] };
        
        if (result.action === 1) {
          console.log(`[amulet effect] gaining 1 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
        }
        else if (result.action === 2) {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: hand,
            count: 1,
          }) as CardId[];
          
          if (!selectedCardIds.length) {
            console.log(`[amulet effect] no card selected`);
          }
          else {
            const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
            
            console.log(`[amulet effect] selected ${cardToTrash} to trash`);
            
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToTrash.id
            });
          }
        }
        else {
          const silverCards = cardEffectArgs.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'silver' }
          ]);
          
          if (!silverCards.length) {
            console.log(`[amulet effect] no silver cards in supply`);
          }
          else {
            const silverCardToGain = silverCards.slice(-1)[0];
            
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: silverCardToGain.id,
              to: { location: 'playerDiscard' }
            });
          }
        }
      }
      
      await decision();
      
      const turnPlayed = cardEffectArgs.match.turnNumber;
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `amulet:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.log(`[amulet startTurn effect] re-running decision fn`);
          await decision();
        }
      })
    }
  },
}

export default expansion;