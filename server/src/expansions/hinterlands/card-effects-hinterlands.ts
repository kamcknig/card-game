import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';

const expansion: CardExpansionModule = {
  'berserker': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const actionCardsInPlay = getCardsInPlay(args.match)
          .map(args.cardLibrary.getCard)
          .some(card => card.type.includes('ACTION') && card.owner === eventArgs.playerId)
        
        if (!actionCardsInPlay) {
          console.log(`[berserker onGained effect] no action cards in play`);
          return;
        }
        
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        
        console.log(`[berserker onGained effect] playing ${card}`);
        
        await args.runGameActionDelegate('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId
        })
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        card,
        { match: cardEffectArgs.match, playerId: cardEffectArgs.playerId }
      );
      
      const cardIds = findCards(
        cardEffectArgs.match,
        {
          location: ['supply', 'kingdom'],
          cost: {
            cardCostController: cardEffectArgs.cardPriceController,
            spec: { playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: cost.treasure - 1 } }
          }
        },
        cardEffectArgs.cardLibrary
      );
      
      if (cardIds.length > 0) {
        console.log(`[berserker effect] no cards costing less than ${cost.treasure - 1}`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cardIds,
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[berserker effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[berserker effect] gaining card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardIds[0],
        to: { location: 'playerDiscards' }
      });
    }
  },
}

export default expansion;