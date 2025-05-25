import { CardExpansionModule } from '../../types.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { CardId } from 'shared/shared-types.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

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
        condition: async () => true,
        triggeredEffectFn: async () => {
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
  'bonfire': {
    registerEffects: () => async (cardEffectArgs) => {
      const coppersInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.cardKey === 'copper' && card.owner === cardEffectArgs.playerId);
      
      if (!coppersInPlay.length) {
        console.log(`[bonfire effect] no coppers in play`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash coppers`,
        restrict: coppersInPlay.map(card => card.id),
        count: { kind: 'upTo', count: 2 },
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[bonfire effect] no card selected`);
        return;
      }
      
      console.log(`[bonfire effect] trashing ${selectedCardIds.length} cards`);
      
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId
        });
      }
    }
  },
  'expedition': {
    registerEffects: () => async (cardEffectArgs) => {
      const event = cardEffectArgs.match.events.find(e => e.id === cardEffectArgs.cardId);
      if (!event) {
        return;
      }
      
      cardEffectArgs.reactionManager.registerReactionTemplate(event, 'endTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (getTurnPhase(conditionArgs.match.turnPhaseIndex) !== 'cleanup') return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.warn(`[expedition effect] i have programmed this to use the reaction system, but technically the effect should modify the amount of cards drawn, and not take place at the end of cleanup`);
          
          await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
        }
      })
    }
  },
}

export default effectMap;