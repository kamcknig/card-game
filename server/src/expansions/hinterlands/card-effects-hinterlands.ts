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
  'border-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        const { cost } = args.cardPriceController.applyRules(
          card,
          { match: args.match, playerId: eventArgs.playerId }
        );
        
        const cardIds = findCards(
          args.match,
          {
            cost: {
              cardCostController: args.cardPriceController,
              spec: { playerId: eventArgs.playerId, kind: 'upTo', amount: { treasure: cost.treasure - 1 } }
            },
          },
          args.cardLibrary
        );
        
        if (!cardIds.length) {
          console.log(`[border-village onGained effect] no cards costing less than ${cost.treasure - 1}`);
          return;
        }
        
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: cardIds,
          count: 1,
        });
        
        if (!selectedCardIds.length) {
          console.warn(`[border-village onGained effect] no card selected`);
          return;
        }
        
        const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[border-village onGained effect] gaining card ${selectedCard}`);
        
        await args.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscards' }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[border-village effect] drawing 1 card and 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    }
  },
}

export default expansion;