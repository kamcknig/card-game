import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { CardExpansionModule } from '../../types.ts';
import { Card } from "shared/shared-types.ts";

const expansionModule: CardExpansionModule = {
  'copper': {
    registerEffects: () => async ({ runGameActionDelegate }) => {
      await runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'gold': {
    registerEffects: () => async ({ runGameActionDelegate }) => {
      await runGameActionDelegate('gainTreasure', { count: 3 });
    }
  },
  'silver': {
    registerEffects: () => async ({ runGameActionDelegate }) => {
      await runGameActionDelegate('gainTreasure', { count: 2 });
    }
  },
  'artisan': {
    registerEffects: () => async ({ cardLibrary, runGameActionDelegate, playerId, ...args }) => {
      console.log(`[ARTISAN EFFECT] choosing card to gain...`);
      //Gain a card to your hand costing up to 5 Treasure.
      //Put a card from your hand onto your deck.
      
      let results = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card to gain',
        playerId: playerId,
        restrict: [
          { location: ['kingdomSupply', 'basicSupply'] },
          { playerId, kind: 'upTo', amount: { treasure: 5 } }
        ]
      });
      
      let selectedCardId = results[0];
      
      console.log(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
      
      console.log(`[ARTISAN EFFECT] gaining card to hand...`);
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId: selectedCardId,
        to: {
          location: 'playerHand',
        },
      });
      
      console.log(`[ARTISAN EFFECT] choosing card to put on deck...`);
      
      results = await runGameActionDelegate('selectCard', {
        prompt: 'Choose card to top-deck',
        playerId: playerId,
        restrict: args.cardSourceController.getSource('playerHand', playerId),
      });
      
      selectedCardId = results[0];
      
      console.log(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
      
      console.log(`[ARTISAN EFFECT] moving card to deck...`);
      
      await runGameActionDelegate('moveCard', {
        toPlayerId: playerId,
        cardId: selectedCardId,
        to: {
          location: 'playerDeck',
        },
      });
    }
  },
  'bandit': {
    registerEffects: () => async ({
      match,
      cardLibrary,
      playerId,
      runGameActionDelegate,
      reactionContext,
      ...args
    }) => {
      //Gain a Gold. Each other player reveals the top 2 cards of their deck,
      // trashes a revealed Treasure other than Copper, and discards the rest.
      
      const goldCardId = args.findCards([{ location: 'basicSupply' }, { cardKeys: 'gold' }])
        ?.slice(-1)?.[0].id;
      
      if (goldCardId) {
        console.log(`[BANDIT EFFECT] gaining a gold to discard...`);
        
        const goldCard = cardLibrary.getCard(goldCardId);
        
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: goldCard.id,
          to: {
            location: 'playerDiscard',
          },
        });
      }
      else {
        console.log(`[BANDIT EFFECT] no gold in supply`);
      }
      
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[BANDIT EFFECT] targets ${targetPlayerIds}`);
      
      for (const targetPlayerId of targetPlayerIds) {
        const playerDeck = args.cardSourceController.getSource('playerDeck', targetPlayerId);
        const playerDiscard = args.cardSourceController.getSource('playerDiscard', targetPlayerId);
        
        let numToReveal = 2;
        const totalCards = playerDiscard.length + playerDeck.length;
        
        numToReveal = Math.min(numToReveal, totalCards);
        
        if (numToReveal === 0) {
          console.log(`[BANDIT EFFECT] player has no cards to reveal`);
          continue;
        }
        
        if (playerDeck.length < numToReveal) {
          console.log(`[BANDIT EFFECT] not enough cards in deck, shuffling...`);
          
          await runGameActionDelegate('shuffleDeck', {
            playerId: targetPlayerId,
          });
        }
        
        const cardIdsToReveal = playerDeck.slice(-numToReveal);
        
        for (const cardId of cardIdsToReveal) {
          console.log(`[BANDIT EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
          
          await runGameActionDelegate('revealCard', {
            playerId: targetPlayerId,
            cardId,
            moveToSetAside: true,
          });
        }
        
        const possibleCardIdsToTrash = cardIdsToReveal.filter((cardId) => {
          const card = cardLibrary.getCard(cardId);
          return card.cardKey !== 'copper' && card.type.includes('TREASURE');
        });
        
        let cardIdTrashed: number;
        if (possibleCardIdsToTrash.length > 0) {
          console.log(`[BANDIT EFFECT] cards that can be trashed ${possibleCardIdsToTrash.map(
            (cardId) => cardLibrary.getCard(cardId))}`
          );
          
          // they get a choice if there is more than one to trash, and they are different
          const giveChoice = possibleCardIdsToTrash.length > 1 &&
            (cardLibrary.getCard(possibleCardIdsToTrash[0]).cardKey !== (cardLibrary.getCard(possibleCardIdsToTrash[1]).cardKey));
          
          if (giveChoice) {
            console.log(`[BANDIT EFFECT] prompt user to select card to trash...`);
            
            const results = await runGameActionDelegate('userPrompt', {
              playerId: targetPlayerId,
              prompt: 'Choose a treasure to trash',
              content: {
                type: 'select',
                cardIds: possibleCardIdsToTrash,
                selectCount: 1,
              },
            }) as number[];
            
            cardIdTrashed = results?.[0];
          }
          else {
            cardIdTrashed = possibleCardIdsToTrash[0];
            console.log(`[BANDIT EFFECT] not giving player choice, auto trashing ${cardLibrary.getCard(cardIdTrashed)}`);
          }
          
          console.log(`[BANDIT EFFECT] player chose ${cardLibrary.getCard(cardIdTrashed)}`);
          
          console.log(`[BANDIT EFFECT] trashing card...`);
          
          await runGameActionDelegate('trashCard', {
            playerId: targetPlayerId,
            cardId: cardIdTrashed,
          });
        }
        else {
          console.log(`[BANDIT EFFECT] no possible cards to trash`);
        }
        
        const cardIdsToDiscard =
          cardIdsToReveal.filter(cardId => !possibleCardIdsToTrash.includes(cardId))
            .concat(possibleCardIdsToTrash.filter(id => id !== cardIdTrashed));
        
        
        if (cardIdsToDiscard.length > 0) {
          console.log(`[BANDIT EFFECT] cards that will be discarded ${cardIdsToDiscard.map(
            (cardId) => cardLibrary.getCard(cardId))}`);
          
          for (const cardId of cardIdsToDiscard) {
            console.log(`[BANDIT EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
            
            await runGameActionDelegate('discardCard', {
              playerId: targetPlayerId,
              cardId,
            });
          }
        }
        else {
          console.log(`[BANDIT EFFECT] no cards to discard`);
        }
      }
    }
  },
  'bureaucrat': {
    registerEffects: () => async ({
      reactionContext,
      match,
      cardLibrary,
      runGameActionDelegate,
      playerId,
      ...args
    }) => {
      
      // Gain a Silver onto your deck. Each other player reveals a Victory card
      // from their hand and puts it onto their deck (or reveals a hand with no Victory cards).
      const silverCardId = args.findCards([{ location: 'basicSupply' }, { cardKeys: 'silver' }])
        ?.slice(-1)?.[0].id;
      
      if (!silverCardId) {
        console.log('[BUREAUCRAT EFFECT] no silver in supply');
      }
      else {
        console.log(`[BUREAUCRAT EFFECT] gaining silver to deck...`);
        
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: silverCardId,
          to: { location: 'playerDeck' },
        });
      }
      
      const targetPlayerIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[BUREAUCRAT EFFECT] targeting ${targetPlayerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const targetPlayerId of targetPlayerIds) {
        const hand = args.findCards({ location: 'playerHand', playerId: targetPlayerId });
        
        const victoryCardsInHand = hand.filter((c) => c.type.includes('VICTORY'));
        
        if (victoryCardsInHand.length === 0) {
          console.log(`[BUREAUCRAT EFFECT] ${getPlayerById(match, targetPlayerId)} has no victory cards, revealing all`);
          
          for (const card of hand) {
            console.log(`[BUREAUCRAT EFFECT] revealing ${card}...`);
            
            await runGameActionDelegate('revealCard', {
              playerId: targetPlayerId,
              cardId: card.id,
            });
          }
        }
        else {
          let cardToReveal: Card;
          
          if (hand.length === 1 || (hand[0].cardKey === hand[1].cardKey)) {
            console.log(`[BUREAUCRAT EFFECT] only one card to reveal or cards are the same, auto selecting`);
            cardToReveal = hand[0];
          }
          else {
            console.log(`[BUREAUCRAT EFFECT] prompting user to select card to reveal...`);
            
            const cardIds = await runGameActionDelegate('selectCard', {
              prompt: 'Reveal victory card',
              playerId: targetPlayerId,
              count: 1,
              restrict: [
                {
                  location: 'playerHand',
                  playerId
                },
                { cardType: 'VICTORY' },
              ],
            });
            cardToReveal = cardLibrary.getCard(cardIds[0]);
          }
          
          console.log(`[BUREAUCRAT EFFECT] revealing ${cardToReveal}...`);
          
          await runGameActionDelegate('revealCard', {
            playerId: targetPlayerId,
            cardId: cardToReveal.id,
          });
          
          console.log(`[BUREAUCRAT EFFECT] moving card to deck`);
          
          await runGameActionDelegate('moveCard', {
            toPlayerId: targetPlayerId,
            cardId: cardToReveal.id,
            to: { location: 'playerDeck' },
          });
        }
      }
    }
  },
  'cellar': {
    registerEffects: () => async ({ match, runGameActionDelegate, playerId, cardLibrary, ...args }) => {
      
      console.log(`[CELLAR EFFECT] gaining action...`);
      await runGameActionDelegate('gainAction', {
        count: 1
      });
      
      const hasCards = args.findCards({ location: 'playerHand', playerId }).length > 0;
      
      if (!hasCards) {
        console.log('[CELLAR EFFECT] player has no cards to choose from');
        return;
      }
      
      console.log(`[CELLAR EFFECT] prompting user to select cards to discard...`);
      
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      const cardIds = await runGameActionDelegate('selectCard', {
        optional: true,
        prompt: 'Confirm discard',
        playerId: playerId,
        count: { kind: 'upTo', count: hand.length },
        restrict: hand,
      });
      
      console.log(`[CELLAR EFFECT] user selected ${cardIds.length} cards`);
      
      if (!cardIds.length) {
        return;
      }
      
      for (const cardId of cardIds) {
        console.log(`[CELLAR EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('discardCard', {
          cardId,
          playerId,
        });
      }
      
      await runGameActionDelegate('drawCard', { playerId, count: cardIds.length });
    }
  },
  'chapel': {
    registerEffects: () => async ({ match, runGameActionDelegate, cardLibrary, playerId, ...args }) => {
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      
      if (!hand.length) {
        console.log(`[CHAPEL EFFECT] player has no cards in hand`);
        return;
      }
      
      const cardIds = await runGameActionDelegate('selectCard', {
        optional: true,
        prompt: 'Confirm trash',
        playerId,
        count: { kind: 'upTo', count: 4 },
        restrict: args.cardSourceController.getSource('playerHand', playerId),
      });
      
      if (cardIds?.length === 0) {
        console.log('[CHAPEL EFFECT] no cards selected');
        return;
      }
      
      for (const cardId of cardIds) {
        console.log(`[CELLAR EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId,
        });
      }
    }
  },
  'council-room': {
    registerEffects: () => async ({ runGameActionDelegate, match, playerId }) => {
      console.log(`[COUNCIL ROOM EFFECT] drawing 4 cards...`);
      await runGameActionDelegate('drawCard', { playerId, count: 4 });
      
      console.log(`[COUNCIL ROOM EFFECT] gaining buy...`);
      await runGameActionDelegate('gainBuy', {
        count: 1
      });
      
      const playerIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      });
      
      console.log(`[COUNCIL ROOM EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        console.log(`[COUNCIL EFFECT] ${getPlayerById(match, playerId)} drawing card...`);
        
        await runGameActionDelegate('drawCard', { playerId });
      }
    }
  },
  'festival': {
    registerEffects: () => async ({ runGameActionDelegate }) => {
      console.log(`[FESTIVAL EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', {
        count: 2,
      });
      
      console.log(`[FESTIVAL EFFECT] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', {
        count: 1
      });
      
      console.log(`[FESTIVAL EFFECT] gaining 2 treasure...`);
      await runGameActionDelegate('gainTreasure', {
        count: 2,
      });
    }
  },
  'gardens': {
    registerScoringFunction: () => ({ match, ownerId, ...args }) => {
      const cards = args.findCards({ owner: ownerId });
      return Math.floor(cards.length / 10);
    },
    registerEffects: () => async () => {
      console.log(`[GARDENS EFFECT] garden has no effects`);
    }
  },
  'harbinger': {
    registerEffects: () => async ({ cardLibrary, match, runGameActionDelegate, playerId, ...args }) => {
      console.log(`[HARBINGER EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[HARBINGER EFFECT] drawing 1 action...`);
      await runGameActionDelegate('gainAction', {
        count: 1,
      });
      
      if (args.findCards({ location: 'playerDiscard', playerId }).length === 0) {
        console.log('[HARBINGER EFFECT] player has no cards in discard');
        return;
      }
      
      console.log(`[HARBINGER EFFECT] prompting user to select card from discard...`);
      
      const results = await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Choose card to put on deck?',
        actionButtons: [{ label: 'CANCEL', action: 2 }],
        content: {
          type: 'select',
          cardIds: args.findCards({ location: 'playerDiscard', playerId }).map(card => card.id),
          selectCount: 1
        },
      }) as { action: number, result: number[] };
      
      if (results.action === 2) {
        console.log('[HARBINGER EFFECT] no card selected');
        return;
      }
      
      const selectedId = results?.result?.[0];
      
      if (selectedId) {
        console.log(`[HARBINGER EFFECT] card selected: ${cardLibrary.getCard(selectedId)}`);
        
        console.log(`[HARBINGER EFFECT] moving card to deck...`);
        
        await runGameActionDelegate('moveCard', {
          cardId: selectedId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' }
        });
      }
      else {
        console.log('[HARBINGER EFFECT] no card selected');
      }
    }
  },
  'laboratory': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[LABORATORY EFFECT] drawing 2 cards...`);
      await runGameActionDelegate('drawCard', { playerId, count: 2 });
      
      console.log(`[LABORATORY EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
    }
  },
  'library': {
    registerEffects: () => async ({ match, runGameActionDelegate, cardLibrary, playerId, ...args }) => {
      // Draw until you have 7 cards in hand, skipping any Action cards
      // you choose to; set those aside, discarding them afterward.
      const setAside: number[] = [];
      
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      const deck = args.cardSourceController.getSource('playerDeck', playerId);
      const discard = args.cardSourceController.getSource('playerDiscard', playerId);
      
      console.log(`[LIBRARY EFFECT] hand size is ${hand.length}`);
      
      // total hand size should be 7 when done. because i'm drawing to hand and not really
      // placing them in an 'aside' area, the total hand size should be 7 plus the set aside cards.
      // we also make sure the deck+discard length is great enough to be able to draw a card.
      while (hand.length < 7 && (deck.length + discard.length > 0)) {
        console.log(`[LIBRARY EFFECT] drawing card...`);
        
        const cardId = await runGameActionDelegate('drawCard', { playerId });
        
        if (!cardId) {
          console.warn(`[library effect] no card drawn`);
          break;
        }
        
        const card = cardLibrary.getCard(cardId);
        
        if (card.type.includes('ACTION')) {
          console.log(`[LIBRARY EFFECT] ${card} is an action prompting user to set aside...`);
          
          const setAsideResult = await runGameActionDelegate('userPrompt', {
            playerId,
            prompt: `You drew ${card.cardName}. Set it aside (skip putting it in your hand)?`,
            actionButtons: [{ label: 'KEEP', action: 1 }, { label: 'SET ASIDE', action: 2 }],
          }) as { action: number };
          
          if (setAsideResult.action === 2) {
            console.log(`[LIBRARY EFFECT] setting card aside`);
            await runGameActionDelegate('moveCard', {
              cardId,
              toPlayerId: playerId,
              to: { location: 'set-aside' }
            });
            setAside.push(cardId);
          }
          else {
            console.log('[LIBRARY EFFECT] keeping card in hand');
          }
        }
        else {
          console.log(`[LIBRARY EFFECT] card was not an action, keeping in hand`);
        }
      }
      
      if (setAside.length === 0) {
        console.log(`[LIBRARY EFFECT] no set aside cards, done`);
        return;
      }
      
      for (const cardId of setAside) {
        console.log(`[LIBRARY EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('discardCard', {
          cardId,
          playerId,
        });
      }
    }
  },
  'market': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[MARKET EFFECT] drawing card...`);
      await runGameActionDelegate('drawCard', { playerId, });
      
      console.log(`[MARKET EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1 });
      
      console.log(`[MARKET EFFECT] gaining 1 buy...`);
      await runGameActionDelegate('gainBuy', {
        count: 1
      });
      
      console.log(`[MARKET EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', {
        count: 1
      });
    }
  },
  'merchant': {
    registerLifeCycleMethods: () => ({
      onCardPlayed: async ({ reactionManager }, { cardId, playerId }) => {
        reactionManager.registerReactionTemplate({
          id: `merchant:${cardId}:cardPlayed`,
          playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'cardPlayed',
          condition: ({ cardLibrary, trigger: silverTrigger, match }) => {
            const silverCard = cardLibrary.getCard(silverTrigger.args.cardId!);
            if (silverCard.cardKey !== 'silver') return false;
            
            const playedCardInfo = match.stats.playedCards;
            const playedSilvers = Object.keys(playedCardInfo)
              .filter((cardId) =>
                cardLibrary.getCard(+cardId).cardKey === 'silver'
                && playedCardInfo[+cardId].turnNumber === match.turnNumber
                && playedCardInfo[+cardId].playerId === silverTrigger.args.playerId)
            
            return playedSilvers.length === 1;
          },
          triggeredEffectFn: async ({ runGameActionDelegate }) => {
            await runGameActionDelegate('gainTreasure', {
              count: 1,
            }, { loggingContext: { source: cardId } });
          }
        });
      },
      onLeavePlay: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`merchant:${cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[MERCHANT EFFECT] drawing card...`);
      await runGameActionDelegate('drawCard', { playerId, });
      
      console.log(`[MERCHANT EFFECT] gaining 1 action...`);
      await runGameActionDelegate('gainAction', { count: 1, });
    }
  },
  'militia': {
    registerEffects: () => async ({
      runGameActionDelegate,
      cardLibrary,
      match,
      reactionContext,
      playerId,
      ...args
    }) => {
      console.log(`[MILITIA EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', {
        count: 2
      });
      
      const playerIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.log(`[MILITIA EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const handCount = hand.length;
        
        console.log(`[MILITIA EFFECT] ${getPlayerById(match, playerId)} has ${handCount} cards in hand`);
        if (handCount <= 3) {
          continue;
        }
        
        const selectCount = handCount - 3;
        console.log(`[MILITIA EFFECT] prompting user to select ${selectCount} hands`);
        
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Confirm discard',
          playerId,
          count: selectCount,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
        });
        
        for (const cardId of cardIds) {
          console.log(`[MILITIA EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
          
          await runGameActionDelegate('discardCard', {
            cardId,
            playerId,
          });
        }
      }
    }
  },
  'mine': {
    registerEffects: () => async ({
      runGameActionDelegate,
      match,
      cardLibrary,
      playerId,
      cardPriceController,
      ...args
    }) => {
      // You may trash a Treasure from your hand. Gain a Treasure to
      // your hand costing up to 3 Treasure more than it.
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      
      const hasTreasureCards = hand.some(
        (c) => cardLibrary.getCard(c).type.includes('TREASURE'));
      
      if (!hasTreasureCards) {
        console.log(`[MINE EFFECT] player has no treasure cards in hand`);
        return;
      }
      
      console.log(`[MINE EFFECT] prompting player to trash a treasure`);
      
      let cardIds = await runGameActionDelegate('selectCard', {
        optional: true,
        prompt: 'Confirm trash',
        playerId: playerId,
        count: { kind: 'upTo', count: 1 },
        restrict: [
          {
            location: 'playerHand',
            playerId
          },
          { cardType: ['TREASURE'] },
        ],
      });
      
      let cardId = cardIds?.[0];
      
      if (!cardId) {
        console.log(`[MINE EFFECT] player selected no card`);
        return;
      }
      
      console.log(`[MINE EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
      
      console.log(`[MINE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
      
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      let card = cardLibrary.getCard(cardId);
      
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });
      
      console.log(`[MINE EFFECT] prompting user to select treasure costing up to ${cardCost.treasure + 3}`);
      
      cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Confirm gain card',
        playerId: playerId,
        count: 1,
        restrict: [
          { location: ['kingdomSupply', 'basicSupply'] },
          { cardType: ['TREASURE'] },
          { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 3, potion: cardCost.potion } },
        ],
      });
      
      cardId = cardIds?.[0];
      
      if (!cardId) {
        console.log(`[MINE EFFECT] no card selected`);
        return;
      }
      
      card = cardLibrary.getCard(cardId);
      
      console.log(`[MINE EFFECT] player selected ${card}`);
      
      console.log(`[MINE EFFECT] gaining card to hand`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId,
        to: { location: 'playerHand' },
      });
    }
  },
  'moat': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async ({ reactionManager }, { playerId, cardId }) => {
        reactionManager.registerReactionTemplate({
          id: `moat:${cardId}:cardPlayed`,
          playerId,
          listeningFor: 'cardPlayed',
          allowMultipleInstances: false,
          condition: ({ cardLibrary, trigger }) => {
            return cardLibrary.getCard(trigger.args.cardId!).type.includes(
              'ATTACK',
            ) && trigger.args.playerId !== playerId;
          },
          triggeredEffectFn: async function ({ runGameActionDelegate, reaction }) {
            const sourceId = reaction.getSourceId();
            
            await runGameActionDelegate('revealCard', {
              cardId: sourceId,
              playerId: reaction.playerId,
            });
            
            return 'immunity';
          },
        });
      },
      onLeaveHand: async ({ reactionManager }, { cardId }) => {
        reactionManager.unregisterTrigger(`moat:${cardId}:cardPlayed`);
      },
    }),
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      await runGameActionDelegate('drawCard', { playerId });
      await runGameActionDelegate('drawCard', { playerId });
    }
  },
  'moneylender': {
    registerEffects: () => async ({ runGameActionDelegate, match, cardLibrary, playerId, ...args }) => {
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      
      const hasCopper = hand.some((c) =>
        cardLibrary.getCard(c).cardKey === 'copper');
      
      if (!hasCopper) {
        console.log(`[MONEYLENDER EFFECT] player has no copper in hand`);
        return;
      }
      
      console.log(`[MONEYLENDER EFFECT] prompting user to trash a copper`);
      
      const result = await runGameActionDelegate('userPrompt', {
        playerId,
        actionButtons: [
          { action: 1, label: `DON'T TRASH` }, { action: 2, label: 'TRASH' }
        ],
        prompt: 'Trash a copper?'
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[MONEYLENDER EFFECT] player chose not to trash`);
        return;
      }
      
      const card = hand.map(cardLibrary.getCard).find(c => c.cardKey === 'copper');
      
      if (!card) {
        console.warn(`[MONEYLENDER EFFECT] no copper in hand`);
        return;
      }
      
      console.log(`[MONEYLENDER EFFECT] trashing ${card}...`);
      
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId: card.id
      });
      
      console.log(`[MONEYLENDER EFFECT] gaining 3 treasure...`);
      
      await runGameActionDelegate('gainTreasure', {
        count: 3,
      });
    }
  },
  'poacher': {
    registerEffects: () => async ({ cardLibrary, match, playerId, runGameActionDelegate, ...args }) => {
      console.log(`[POACHER EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[POACHER EFFECT] gaining 1 action...`);
      
      await runGameActionDelegate('gainAction', { count: 1 });
      
      console.log(`[POACHER EFFECT] gaining 1 treasure...`);
      await runGameActionDelegate('gainTreasure', { count: 1 });
      
      const allSupplyCardKeys = match.config.basicCards.concat(
        match.config.kingdomCards,
      );
      
      console.log(`[POACHER EFFECT] original supply card piles ${allSupplyCardKeys}`);
      
      const remainingSupplyCardKeys =
        args.findCards({ location: ['basicSupply', 'kingdomSupply'] })
          .map(card => card.cardKey)
          .reduce((prev, cardKey) => {
            if (prev.includes(cardKey)) {
              return prev;
            }
            return prev.concat(cardKey);
          }, [] as string[]);
      
      console.log(`[POACHER EFFECT] remaining supply card piles ${remainingSupplyCardKeys}`);
      
      const emptyPileCount = allSupplyCardKeys.length - remainingSupplyCardKeys.length;
      
      console.log(`[POACHER EFFECT] number of empty supply piles ${emptyPileCount}`);
      
      if (emptyPileCount === 0) {
        return;
      }
      
      const hand = args.cardSourceController.getSource('playerHand', playerId);
      
      if (hand.length === 0) {
        console.log(`[POACHER EFFECT] no cards in hand to discard`);
        return;
      }
      
      let numToDiscard = Math.min(hand.length, emptyPileCount);
      
      console.log(`[POACHER EFFECT] number of cards to discard ${numToDiscard}`);
      
      if (hand.length < emptyPileCount) {
        numToDiscard = Math.min(hand.length, emptyPileCount);
        console.log(`[POACHER EFFECT] not enough cards in hand changing number to discard to ${numToDiscard}`);
      }
      
      if (numToDiscard === 0) {
        console.log(`[POACHER EFFECT] no cards to discard`);
        return;
      }
      
      console.log(`[POACHER EFFECT] prompting user to discard cards...`);
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Confirm discard',
        playerId: playerId,
        count: numToDiscard,
        restrict: args.cardSourceController.getSource('playerHand', playerId),
      });
      
      for (const cardId of cardIds) {
        console.log(`[POACHER EFFECT] discarding card ${cardLibrary.getCard(cardId)}...`);
        
        await runGameActionDelegate('discardCard', {
          playerId,
          cardId,
        });
      }
    }
  },
  'remodel': {
    registerEffects: () => async ({
      match,
      cardLibrary,
      playerId,
      runGameActionDelegate,
      cardPriceController,
      ...args
    }) => {
      if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
        console.log(`[REMODEL EFFECT] player has no cards in hand`);
        return;
      }
      
      let cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Trash card',
        playerId: playerId,
        count: 1,
        restrict: args.cardSourceController.getSource('playerHand', playerId),
      });
      
      let cardId = cardIds[0];
      const card = cardLibrary.getCard(cardId);
      
      console.log(`[REMODEL EFFECT] trashing card ${card}...`);
      
      await runGameActionDelegate('trashCard', {
        playerId,
        cardId,
      });
      
      const { cost: cardCost } = cardPriceController.applyRules(card, { playerId });
      
      console.log(`[REMODEL EFFECT] prompting user to select card costing up to ${cardCost.treasure}...`);
      
      cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Gain card',
        playerId,
        count: 1,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId, kind: 'upTo', amount: { treasure: cardCost.treasure + 2, potion: card.cost.potion } },
        ],
      });
      
      cardId = cardIds[0];
      
      console.log(`[REMODEL EFFECT] gaining ${cardLibrary.getCard(cardId)} to discard...`);
      
      await runGameActionDelegate('gainCard', {
        playerId,
        cardId,
        to: { location: 'playerDiscard' },
      });
    }
  },
  'sentry': {
    registerEffects: () => async ({ runGameActionDelegate, cardLibrary, match, playerId, ...args }) => {
      // +1 Card
      // +1 Action
      // Look at the top 2 cards of your deck. Trash and/or discard any number of
      // them. Put the rest back on top in any order.
      console.log(`[SENTRY EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
      
      console.log(`[SENTRY EFFECT] gaining 1 action...`);
      
      await runGameActionDelegate('gainAction', {
        count: 1,
      });
      
      const deck = args.cardSourceController.getSource('playerDeck', playerId);
      const discard = args.cardSourceController.getSource('playerDiscard', playerId);
      
      let numToLookAt = 2;
      
      console.log(`[SENTRY EFFECT] number of cards to look at ${numToLookAt}`);
      
      if (deck.length + discard.length < numToLookAt) {
        numToLookAt = Math.min(2, deck.length + discard.length);
        console.log(`[SENTRY EFFECT] not enough cards, number of cards to look at is now ${numToLookAt}`);
      }
      
      if (numToLookAt === 0) {
        console.log(`[SENTRY EFFECT] player does not have enough cards`);
        return;
      }
      
      if (deck.length < 2) {
        console.debug(`[SENTRY EFFECT] player has ${deck.length} cards in deck, shuffling deck`);
        await runGameActionDelegate('shuffleDeck', {
          playerId
        });
      }
      
      const cardsToLookAtIds = deck.slice(-numToLookAt);
      
      console.debug(`[SENTRY EFFECT] looking at cards ${cardsToLookAtIds.map(
        (id) => cardLibrary.getCard(id))}`);
      
      console.log(`[SENTRY EFFECT] prompting user to trash cards...`);
      
      let result = await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Choose card/s to trash?',
        validationAction: 1,
        actionButtons: [{ label: `DON'T TRASH`, action: 2 }, { label: 'TRASH', action: 1 }],
        content: {
          type: 'select',
          cardIds: cardsToLookAtIds,
          selectCount: {
            kind: 'upTo',
            count: cardsToLookAtIds.length,
          },
        },
      }) as { action: number; result: number[] };
      
      const cardIdsToTrash = result?.result ?? [];
      
      if (result.action === 1) {
        console.debug(`[SENTRY EFFECT] player selected ${cardIdsToTrash.map(
          (id) => cardLibrary.getCard(id))} to trash`);
        
        for (const cardId of cardIdsToTrash) {
          console.log(`[SENTRY EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
          
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId: cardId,
          });
        }
      }
      else {
        console.debug(`[SENTRY EFFECT] player chose not to trash anything`);
      }
      
      const possibleCardsToDiscard = cardsToLookAtIds.filter((id) =>
        !cardIdsToTrash.includes(id)
      );
      
      if (possibleCardsToDiscard.length === 0) {
        console.debug(`[SENTRY EFFECT] all cards trashed or not more to discard`);
        return;
      }
      
      result = await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'Choose card/s to discard?',
        validationAction: 1,
        actionButtons: [{ label: `DON'T DISCARD`, action: 2 }, { label: 'DISCARD', action: 1 }],
        content: {
          type: 'select',
          cardIds: possibleCardsToDiscard,
          selectCount: {
            kind: 'upTo',
            count: possibleCardsToDiscard.length,
          },
        },
      }) as { action: number; result: number[] };
      
      let cardsToDiscard: number[] = [];
      if (result.action === 2) {
        console.debug(`[SENTRY EFFECT] player chose not to discard`);
      }
      else {
        cardsToDiscard = result?.result ?? [];
        
        console.debug(`[SENTRY EFFECT] player chose ${cardsToDiscard.map(
          (id) => cardLibrary.getCard(id))} to discard`);
        
        for (const selectedCardId of cardsToDiscard) {
          console.log(`[SENTRY EFFECT] discarding ${cardLibrary.getCard(selectedCardId)}`);
          
          await runGameActionDelegate('discardCard', {
            playerId,
            cardId: selectedCardId,
          });
        }
      }
      
      const remainingCardIds = cardsToLookAtIds
        .filter(id => !cardIdsToTrash.includes(id) && !cardsToDiscard.includes(id));
      
      if (remainingCardIds.length <= 1) {
        console.debug(`[SENTRY EFFECT] not enough cards to rearrange`);
        return;
      }
      
      console.debug(`[SENTRY EFFECT] prompting user to rearrange cards...`);
      
      result = await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: 'rearrange cards',
        actionButtons: [
          { action: 1, label: 'DONE' },
        ],
        content: {
          type: 'rearrange',
          cardIds: remainingCardIds
        }
      }) as { action: number, result: number[] };
      
      const cardIds = result.result;
      
      for (const cardId of cardIds) {
        console.log(`[SENTRY EFFECT] putting ${cardLibrary.getCard(cardId)} on top of deck...`);
        
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: { location: 'playerDeck' }
        });
      }
    }
  },
  'smithy': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[SMITHY EFFECT] drawing 3 cards...`);
      await runGameActionDelegate('drawCard', { playerId, count: 3 });
    }
  },
  'throne-room': {
    registerEffects: () => async ({ playerId, runGameActionDelegate, cardLibrary, ...args }) => {
      console.log(`[THRONE ROOM EFFECT] prompting user to select action card from hand...`);
      
      const cardIds = await runGameActionDelegate('selectCard', {
        optional: true,
        prompt: 'Choose action',
        playerId,
        count: { kind: 'upTo', count: 1 },
        restrict: [
          {
            location: 'playerHand',
            playerId
          },
          { cardType: ['ACTION'] },
        ],
      });
      
      const cardId = cardIds?.[0];
      
      if (!cardId) {
        console.debug(`[THRONE ROOM EFFECT] player chose no cards`);
        return;
      }
      
      console.log(`[THRONE ROOM EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
      
      for (let i = 0; i < 2; i++) {
        console.log(`[THRONE ROOM EFFECT] running generator...`);
        
        await runGameActionDelegate('playCard', {
          playerId,
          cardId,
          overrides: {
            actionCost: 0,
          }
        });
      }
    }
  },
  'vassal': {
    registerEffects: () => async ({ cardLibrary, match, playerId, runGameActionDelegate, ...args }) => {
      console.log(`[VASSAL EFFECT] gain 2 treasure...`);
      
      await runGameActionDelegate('gainTreasure', {
        count: 2,
      });
      
      const playerDeck = args.cardSourceController.getSource('playerDeck', playerId);
      
      if (playerDeck.length === 0) {
        console.debug(`[VASSAL EFFECT] not enough cards in deck, shuffling`);
        await runGameActionDelegate('shuffleDeck', {
          playerId,
        });
      }
      
      const cardToDiscardId = playerDeck.slice(-1)?.[0];
      
      if (!cardToDiscardId) {
        console.debug('[VASSAL EFFECT] no cards to discard...');
        return;
      }
      
      console.log(`[VASSAL EFFECT] discarding ${cardLibrary.getCard(cardToDiscardId)}...`);
      
      await runGameActionDelegate('discardCard', {
        playerId,
        cardId: cardToDiscardId,
      });
      
      const card = cardLibrary.getCard(cardToDiscardId);
      
      if (!card.type.includes('ACTION')) {
        console.debug(`[VASSAL EFFECT] card is not an action, done processing`);
        return;
      }
      
      console.log(`[VASSAL EFFECT] prompting user to play card or not...`);
      
      const confirm = await runGameActionDelegate('userPrompt', {
        playerId,
        prompt: `Play card ${card.cardName}?`,
        actionButtons: [{ label: `DON'T PLAY`, action: 1 }, { label: 'PLAY', action: 2 }],
      }) as { action: number };
      
      if (confirm.action !== 2) {
        console.debug(`[VASSAL EFFECT] player chose not to play card`);
        return;
      }
      
      console.log(`[VASSAL EFFECT] invoking game action generator...`);
      
      await runGameActionDelegate('playCard', {
        playerId,
        cardId: card.id,
        overrides: {
          actionCost: 0,
        }
      });
    }
  },
  'village': {
    registerEffects: () => async ({ playerId, runGameActionDelegate }) => {
      console.log(`[VILLAGE EFFECT] gaining 2 actions...`);
      await runGameActionDelegate('gainAction', { count: 2 });
      
      console.log(`[VILLAGE EFFECT] drawing card...`);
      
      await runGameActionDelegate('drawCard', { playerId });
    }
  },
  'witch': {
    registerEffects: () => async ({
      runGameActionDelegate,
      match,
      playerId,
      cardLibrary,
      reactionContext,
      ...args
    }) => {
      console.log(`[WITCH EFFECT] drawing 2 cards...`);
      
      await runGameActionDelegate('drawCard', { playerId, count: 2 });
      
      const playerIds = findOrderedTargets({
        startingPlayerId: playerId,
        appliesTo: 'ALL_OTHER',
        match,
      }).filter((id) => reactionContext?.[id]?.result !== 'immunity');
      
      console.debug(`[WITCH EFFECT] targets ${playerIds.map((id) => getPlayerById(match, id))}`);
      
      for (const playerId of playerIds) {
        const curseCards = args.findCards([{ location: 'basicSupply' }, { cardKeys: 'curse' }]);
        if (!curseCards.length) {
          console.debug(`[WITCH EFFECT] no curse cards in supply`);
          return;
        }
        
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: curseCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' },
        });
      }
    }
  },
  'workshop': {
    registerEffects: () => async ({ runGameActionDelegate, cardLibrary, playerId, ...args }) => {
      console.log(`[WORKSHOP EFFECT] prompting player to select card to gain...`);
      
      const cardIds = await runGameActionDelegate('selectCard', {
        prompt: 'Gain card',
        playerId: playerId,
        count: 1,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId, kind: 'upTo', amount: { treasure: 4 } },
        ],
      });
      
      const cardId = cardIds[0];
      
      console.log(`[WORKSHOP EFFECT] gaining card ${cardLibrary.getCard(cardId)}`)
      
      await runGameActionDelegate('gainCard', {
        playerId: playerId,
        cardId,
        to: { location: 'playerDiscard' },
      });
    }
  },
};

export default expansionModule;

