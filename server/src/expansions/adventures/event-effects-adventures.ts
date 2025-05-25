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
        console.warn(`[expedition effect] event not found`);
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
          
          console.log(`[expedition endTurnPhase effect] drawing 2 cards`);
          await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
        }
      })
    }
  },
  'quest': {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const handCards = hand.map(cardEffectArgs.cardLibrary.getCard);
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one',
        actionButtons: [
          { label: 'DISCARD ATTACK', action: 1 },
          { label: 'DISCARD 2 COPPER', action: 2 },
          { label: 'DISCARD 6 CARDS', action: 3 }
        ],
      }) as { action: number, result: number[] };
      
      let selectedCardIds: CardId[] = [];
      let gainGold = false;
      
      if (result.action === 1) {
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard attack`,
          restrict: handCards.filter(card => card.type.includes('ATTACK')).map(card => card.id),
          count: { kind: 'upTo', count: hand.length },
        }) as CardId[];
        gainGold = true;
      }
      else if (result.action === 2) {
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard 2 copper`,
          restrict: handCards.filter(card => card.type.includes('ATTACK')).map(card => card.id),
          count: { kind: 'upTo', count: hand.length },
        }) as CardId[];
        gainGold = selectedCardIds.length === 2;
      }
      else {
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard 6 cards`,
          restrict: hand,
          count: 6,
        }) as CardId[];
        gainGold = selectedCardIds.length === 6;
      }
      
      if (!selectedCardIds.length) {
        console.log(`[quest effect] no card selected`);
        return;
      }
      
      if (gainGold) {
        const goldCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'gold' }
        ]);
        
        if (!goldCards.length) {
          console.log(`[quest effect] no gold cards in supply`);
          return;
        }
        
        console.log(`[quest effect] gaining ${goldCards.slice(-1)[0]}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCards.slice(-1)[0],
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
}

export default effectMap;