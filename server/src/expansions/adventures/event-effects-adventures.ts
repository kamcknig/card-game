import { CardExpansionModule } from '../../types.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { CardId } from 'shared/shared-types.ts';

const effectMap: CardExpansionModule = {
  'alms': {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find(e => e.id === cardEffectArgs.cardId);
      if (!event) return;
      
      const priceRule: CardPriceRule = (card, context) => {
        if (context.playerId === cardEffectArgs.playerId) return { restricted: true, cost: card.cost };
        return { restricted: false, cost: card.cost };
      }
      
      const ruleUnsub = cardEffectArgs.cardPriceController.registerRule(event, priceRule);
      
      cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async context => true,
        triggeredEffectFn: async triggeredArgs => {
          ruleUnsub();
        }
      });
      
      const treasuresInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.type.includes('TREASURE'))
        .filter(card => card.owner === cardEffectArgs.playerId);
      
      if (treasuresInPlay.length > 0) {
        console.log(`[alms effect] ${treasuresInPlay.length} treasures in play, not gaining card`);
        return;
      }
      
      const cards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } }
      ]);
      
      if (!cards.length) {
        console.log(`[alms effect] no cards to gain`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cards.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[alms effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[alms effect] gaining card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
}

export default effectMap;