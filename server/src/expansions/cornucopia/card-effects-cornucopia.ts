import { Card, CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { findCards } from '../../utils/find-cards.ts';
import { find } from 'npm:rxjs@7.8.2';

const expansion: CardExpansionModule = {
  'fairgrounds': {
    registerScoringFunction: () => (args) => {
      const cards = args.cardLibrary.getAllCardsAsArray().filter(card => card.owner === args.ownerId);
      const uniqueNameCardCount = new Set(cards.map(card => card.cardName)).size;
      const score = Math.floor(uniqueNameCardCount / 5);
      return score;
    }
  },
  'farming-village': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[farming village effect] gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
      let cardFound = false;
      const deck = cardEffectArgs.match.playerDecks[cardEffectArgs.playerId];
      const discard = cardEffectArgs.match.playerDiscards[cardEffectArgs.playerId];
      const revealedCards: Card[] = [];
      
      while (!cardFound && deck.length + discard.length > 1) {
        let cardId = deck.slice(-1)[0];
        
        if (!cardId) {
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          cardId = deck.slice(-1)[0];
          
          if (!cardId) {
            console.log(`[farming village effect] no cards in deck`);
            return;
          }
        }
        
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        
        console.log(`[farming village effect] revealing card ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true,
        });
        
        if (card.type.includes('ACTION') || card.type.includes('TREASURE')) {
          console.log(`[farming village effect] card is action or treasure, moving to hand`);
          cardFound = true;
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHands' }
          })
        }
        else {
          console.log(`[farming village effect] card is not action or treasure, discarding`);
          revealedCards.push(card);
        }
      }
      
      for (const card of revealedCards) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
      }
    }
  },
  'fortune-teller': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[fortune teller effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const deck = cardEffectArgs.match.playerDecks[targetPlayerId];
        const discard = cardEffectArgs.match.playerDiscards[targetPlayerId];
        let cardFound = false;
        const cardsRevealed: Card[] = [];
        
        console.log(`[fortune teller effect] revealing cards for player ${targetPlayerId}`);
        
        while (deck.length + discard.length > 0 && !cardFound) {
          let cardId = deck.slice(-1)[0];
          
          if (!cardId) {
            console.log(`[fortune teller effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: targetPlayerId });
            cardId = deck.slice(-1)[0];
            
            if (!cardId) {
              console.log(`[fortune teller effect] no cards in deck after shuffling`);
              continue;
            }
          }
          
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: cardId,
            playerId: targetPlayerId,
            moveToSetAside: true
          });
          
          if (card.type.includes('VICTORY') || card.type.includes('TREASURE')) {
            console.log(`[fortune teller effect] card is victory or treasure, moving to deck`);
            cardFound = true;
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId: cardId,
              toPlayerId: targetPlayerId,
              to: { location: 'playerDecks' }
            });
          }
          else {
            cardsRevealed.push(card);
          }
        }
        
        console.log(`[fortune teller effect] discarding ${cardsRevealed.length} cards for player ${targetPlayerId}`);
        
        for (const card of cardsRevealed) {
          await cardEffectArgs.runGameActionDelegate('discardCard', { cardId: card.id, playerId: targetPlayerId });
        }
      }
    }
  },
  'young-witch': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[young witch effect] drawing 2 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const count = Math.min(2, cardEffectArgs.match.playerHands[cardEffectArgs.playerId].length);
      
      console.log(`[young witch effect] selecting ${count} cards`);
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: { from: { location: 'playerHands' } },
        count,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[young witch effect] no cards selected`);
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const handIds = cardEffectArgs.match.playerHands[targetPlayerId];
        const handCards = handIds.map(cardId => cardEffectArgs.cardLibrary.getCard(cardId));
        const baneCards = handCards.filter(card => card.tags.includes('bane'));
        
        const curseCardIds = findCards(
          cardEffectArgs.match,
          { location: 'supply', cards: { cardKeys: 'curse' } },
          cardEffectArgs.cardLibrary
        );
        
        if (!curseCardIds.length) {
          console.log(`[young witch effect] no curse cards in supply`);
          return;
        }
        
        let reveal = false;
        
        if (baneCards.length > 0) {
          console.log(`[young witch effect] player ${targetPlayerId} has a bane, asking to reveal`);
          const baneCard = baneCards[0];
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `Reveal ${baneCard.cardName}`,
            playerId: targetPlayerId,
            actionButtons: [
              { label: 'Cancel', action: 1 },
              { label: 'Reveal', action: 2 }
            ],
          }) as { action: number, result: number[] };
          
          reveal = result.action === 2;
          
          if (result.action === 2) {
            console.log(`[young witch effect] player ${targetPlayerId} revealed a bane`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: baneCard.id,
              playerId: targetPlayerId,
            });
          }
        }
        else {
          reveal = false;
        }
        
        if (!reveal) {
          console.log(`[young witch effect] player ${targetPlayerId} did not reveal a bane`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCardIds[0],
            to: { location: 'playerDiscards' }
          });
        }
      }
    }
  },
}

export default expansion;
