import './types.ts';
import { Card, CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';

const expansion: CardExpansionModule = {
  'advisor': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[advisor effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      const deck = cardEffectArgs.match.playerDecks[cardEffectArgs.playerId];
      const cardsRevealed: Card[] = [];
      
      console.log(`[advisor effect] revealing 3 cards`);
      
      for (let i = 0; i < 3; i++) {
        if (deck.length === 0) {
          console.log(`[advisor effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length === 0) {
            console.log(`[advisor effect] no cards in deck after shuffling`);
            break;
          }
        }
        
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        cardsRevealed.push(card);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true
        });
      }
      
      const leftPlayer = getPlayerStartingFrom({
        startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
        match: cardEffectArgs.match,
        distance: 1
      });
      
      console.log(`[advisor effect] player ${leftPlayer} choosing card to discard`);
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: `Choose one for ${getPlayerById(cardEffectArgs.match, cardEffectArgs.playerId)?.name} to discard`,
        playerId: leftPlayer.id,
        content: {
          type: 'select',
          cardIds: cardsRevealed.map(card => card.id),
          selectCount: 1
        }
      }) as { action: number, result: number[] };
      
      const cardId = result.result[0];
      
      if (!cardId) {
        console.warn(`[advisor effect] no card selected`);
      }
      else {
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        console.log(`[advisor effect] player ${cardEffectArgs.playerId} discarding ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }
      
      const toMoveToHand = cardsRevealed.filter(card => card.id !== cardId);
      
      console.log(`[advisor effect] moving ${toMoveToHand.length} cards to hand`);
      
      for (const card of toMoveToHand) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHands' }
        });
      }
    }
  },
  'baker': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId });
    }
  },
  'candlestick-maker': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[candlestick maker effect] gaining 1 action, 1 buy, and 1 coffer`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainCoffer', { playerId: cardEffectArgs.playerId, count: 1 });
    }
  },
  'carnival': {
    registerEffects: () => async (cardEffectArgs) => {
      const deck = cardEffectArgs.match.playerDecks[cardEffectArgs.playerId];
      const cardsToKeep: Card[] = [];
      const cardsToDiscard: Card[] = [];
      
      for (let i = 0; i < 4; i++) {
        if (deck.length === 0) {
          console.log(`[carnival effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length === 0) {
            console.log(`[carnival effect] no cards in deck after shuffling`);
            break;
          }
        }
        
        const revealedCardId = deck.slice(-1)[0];
        const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
        
        console.log(`[carnival effect] revealing ${revealedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: revealedCardId,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true
        });
        
        if (!cardsToKeep.find(card => card.cardKey === revealedCard.cardKey)) {
          console.log(`[carnival effect] adding ${revealedCard} to keep`);
          cardsToKeep.push(revealedCard);
        }
        else {
          console.log(`[carnival effect] adding ${revealedCard} to discard`);
          cardsToDiscard.push(revealedCard);
        }
      }
      
      console.log(`[carnival effect] discarding ${cardsToDiscard.length} cards`);
      
      for (const card of cardsToDiscard) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
      }
      
      console.log(`[carnival effect] moving ${cardsToKeep.length} cards to hand`);
      
      for (const card of cardsToKeep) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: card.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHands' }
        });
      }
    }
  },
  'fairgrounds': {
    registerScoringFunction: () => (args) => {
      const cards = args.cardLibrary.getAllCardsAsArray().filter(card => card.owner === args.ownerId);
      const uniqueNameCardCount = new Set(cards.map(card => card.cardName)).size;
      const score = Math.floor(uniqueNameCardCount / 5);
      return score;
    }
  },
  'hamlet': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[hamlet effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const hand = cardEffectArgs.match.playerHands[cardEffectArgs.playerId];
      
      if (hand.length > 0) {
        const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
          prompt: 'Discard to gain action?',
          playerId: cardEffectArgs.playerId,
          optional: true,
          count: 1,
          restrict: { from: { location: 'playerHands' } },
        }) as CardId[];
        
        if (result.length) {
          console.log(`[hamlet effect] player chose to discard to gain +1 action`);
          const cardId = result[0];
          await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
          await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
        }
        else {
          console.log(`[hamlet effect] player chose not to discard to gain +1 action`);
        }
      }
      else {
        console.log(`[hamlet effect] no cards in hand, not prompting to discard for action`);
      }
      
      if (hand.length > 0) {
        const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
          prompt: 'Discard to gain buy?',
          playerId: cardEffectArgs.playerId,
          optional: true,
          count: 1,
          restrict: { from: { location: 'playerHands' } },
        }) as CardId[];
        
        if (result.length) {
          const cardId = result[0];
          await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
          await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
        }
        else {
          console.log(`[hamlet effect] player chose not to discard to gain +1 buy`);
        }
      }
      else {
        console.log(`[hamlet effect] no cards in hand, not prompting to discard for buy`);
      }
    }
  },
  'horn-of-plenty': {
    registerEffects: () => async (cardEffectArgs) => {
      const uniquelyNamesCardsInPlay = new Set(getCardsInPlay(cardEffectArgs.match)
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.owner === cardEffectArgs.playerId)
        .map(card => card.cardName)
      ).size;
      
      console.log(`[horn of plenty effect] gaining ${uniquelyNamesCardsInPlay} treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: uniquelyNamesCardsInPlay });
    }
  },
  'hunting-party': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[hunting party effect] drawing 1 card and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const hand = cardEffectArgs.match.playerHands[cardEffectArgs.playerId];
      if (hand.length === 0) {
        console.warn(`[hunting party effect] no cards in hand`);
        return;
      }
      for (const cardId of hand) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
      const uniqueHandCardNames = new Set(hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .map(card => card.cardName)
      );
      
      const deck = cardEffectArgs.match.playerDecks[cardEffectArgs.playerId];
      const discard = cardEffectArgs.match.playerDiscards[cardEffectArgs.playerId];
      let cardFound = false;
      const cardsToDiscard: CardId[] = [];
      while (deck.length + discard.length > 0 && !cardFound) {
        let cardId = deck.slice(-1)[0];
        
        if (!cardId) {
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          if (deck.length < 0) {
            console.warn(`[hunting party effect] no cards in deck after shuffling`);
            return;
          }
        }
        
        cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        if (uniqueHandCardNames.has(card.cardName)) {
          console.log(`[hunting party effect] adding ${card.cardName} to discards`);
          cardsToDiscard.push(cardId);
        }
        else {
          console.log(`[hunting party effect] moving ${card.cardName} to hand`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHands' }
          });
          cardFound = true;
        }
      }
      
      console.log(`[hunting party effect] discarding ${cardsToDiscard.length} cards`);
      for (const cardId of cardsToDiscard) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId
        });
      }
    }
  },
  'jester': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[jester effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId].result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const deck = cardEffectArgs.match.playerDecks[targetPlayerId];
        
        if (deck.length === 0) {
          console.log(`[jester effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: targetPlayerId });
          
          if (deck.length === 0) {
            console.log(`[jester effect] no cards in deck after shuffling`);
            continue
          }
        }
        
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        
        console.log(`[jester effect] player ${targetPlayerId} discarding ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', { cardId: cardId, playerId: targetPlayerId });
        
        if (card.type.includes('VICTORY')) {
          console.log(`[jester effect] card is a victory card, gaining curse`);
          const curseCardIds = findCards(
            cardEffectArgs.match,
            { location: 'supply', cards: { cardKeys: 'curse' } },
            cardEffectArgs.cardLibrary
          );
          
          if (!curseCardIds.length) {
            console.log(`[jester effect] no curse cards in supply`);
            continue;
          }
          
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCardIds.slice(-1)[0],
            to: { location: 'supply' }
          });
        }
        else {
          const copyIds = findCards(
            cardEffectArgs.match,
            { location: ['supply', 'kingdom'], cards: { cardKeys: card.cardKey } },
            cardEffectArgs.cardLibrary
          );
          
          if (!copyIds.length) {
            console.log(`[jester effect] no copies of ${card.cardName} in supply`);
            continue;
          }
          
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `You or they gain a ${card.cardName}`,
            playerId: cardEffectArgs.playerId,
            actionButtons: [
              { label: 'THEY GAIN', action: 1 },
              { label: 'YOU GAIN', action: 2 },
            ],
          }) as { action: number, result: number[] };
          
          const copyId = copyIds.slice(-1)[0];
          
          if (result.action === 1) {
            console.log(`[jester effect] player ${targetPlayerId} gaining ${card.cardName}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: copyId,
              to: { location: 'playerDiscards' }
            });
          }
          else {
            console.log(`[jester effect] player ${cardEffectArgs.playerId} gaining ${card.cardName}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: copyId,
              to: { location: 'playerDiscards' }
            });
          }
        }
      }
    }
  },
  'remake': {
    registerEffects: () => async (cardEffectArgs) => {
      const count = Math.min(2, cardEffectArgs.match.playerHands[cardEffectArgs.playerId].length);
      console.log(`[remake effect] selecting ${count} cards`);
      
      for (let i = 0; i < count; i++) {
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: { from: { location: 'playerHands' } },
          count,
        }) as CardId[];
        
        const selectedId = selectedCardIds[0];
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedId);
        
        console.log(`[remake effect] player ${cardEffectArgs.playerId} trashing ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedId,
        });
        
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          match: cardEffectArgs.match,
          playerId: cardEffectArgs.playerId
        });
        
        const availableCardIds = findCards(
          cardEffectArgs.match,
          {
            location: ['supply', 'kingdom'],
            cost: {
              cardCostController: cardEffectArgs.cardPriceController,
              spec: {
                kind: 'exact',
                playerId: cardEffectArgs.playerId,
                amount: { ...cost, treasure: cost.treasure + 1 }
              }
            }
          },
          cardEffectArgs.cardLibrary
        );
        
        if (!availableCardIds.length) {
          console.log(`[remake effect] no cards in supply with cost ${cost}`);
          continue;
        }
        
        const card = cardEffectArgs.cardLibrary.getCard(availableCardIds.slice(-1)[0]);
        
        console.log(`[remake effect] player ${cardEffectArgs.playerId} gaining ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: availableCardIds.slice(-1)[0],
          to: { location: 'playerDiscards' }
        });
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
