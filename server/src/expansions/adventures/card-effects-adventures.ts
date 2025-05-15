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
            
          }
        }
        else {
        
        }
      }
    }
  },
}

export default expansion;