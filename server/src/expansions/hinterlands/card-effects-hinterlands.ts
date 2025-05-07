import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';

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
  'cartographer': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[cartographer effect] drawing 1 card and 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = cardEffectArgs.match.playerDecks[cardEffectArgs.playerId];
      const discard = cardEffectArgs.match.playerDiscards[cardEffectArgs.playerId];
      
      const numToLookAt = Math.min(4, deck.length + discard.length);
      
      console.log(`[cartographer effect] looking at ${numToLookAt} cards`);
      
      if (deck.length < numToLookAt) {
        console.log(`[cartographer effect] no cards in deck, shuffling`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
      }
      
      const cardsToLookAt = deck.slice(-numToLookAt);
      
      let result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: `May discard up to ${cardsToLookAt.length}`,
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DONE', action: 1 }
        ],
        content: {
          type: 'select',
          cardIds: cardsToLookAt,
          selectCount: {
            kind: 'upTo',
            count: cardsToLookAt.length
          }
        }
      }) as { action: number, result: CardId[] };
      
      if (!result.result.length) {
        console.warn(`[cartographer effect] no card selected`);
      }
      else {
        console.log(`[cartographer effect] discarding ${result.result.length} cards`);
        
        for (const cardId of result.result) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: cardId,
            playerId: cardEffectArgs.playerId
          });
        }
      }
      
      const cardsToRearrange = cardsToLookAt.filter(id => !result.result.includes(id));
      
      if (!cardsToRearrange.length) {
        console.log(`[cartographer effect] no cards to rearrange`);
        return;
      }
      
      console.log(`[cartographer effect] rearranging ${cardsToRearrange.length} cards`);
      result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Put back on top of deck in any order',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DONE', action: 1 }
        ],
        content: {
          type: 'rearrange',
          cardIds: cardsToRearrange,
        }
      }) as { action: number, result: CardId[] };
      
      for (const cardId of result.result) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: cardId,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDecks' }
        });
      }
    }
  },
  'cauldron': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`cauldron:${eventArgs.cardId}:gainCard`);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[cauldron effect] gaining 1 treasure, and 1 buy`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      let actionGainCount = 0;
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `cauldron:${cardEffectArgs.cardId}:gainCard`,
        listeningFor: 'gainCard',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (card.type.includes('ACTION')) {
            actionGainCount++;
            console.log(`[cauldron triggered condition] incrementing action gains for cauldron card ${cardEffectArgs.cardId} to ${actionGainCount}`);
          }
          return actionGainCount === 3;
        },
        triggeredEffectFn: async () => {
          cardEffectArgs.reactionManager.unregisterTrigger(`cauldron:${cardEffectArgs.cardId}:gainCard`)
          const targetPlayerIds = findOrderedTargets({
            match: cardEffectArgs.match,
            appliesTo: 'ALL_OTHER',
            startingPlayerId: cardEffectArgs.playerId
          }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
          
          for (const targetPlayerId of targetPlayerIds) {
            const curseIds = findCards(
              cardEffectArgs.match,
              {
                location: 'supply',
                cards: { cardKeys: 'curse' }
              },
              cardEffectArgs.cardLibrary
            );
            
            if (!curseIds.length) {
              console.log(`[cauldron triggered effect] no curse cards in supply`);
              break;
            }
            
            const card = cardEffectArgs.cardLibrary.getCard(curseIds.slice(-1)[0]);
            console.log(`[cauldron triggered effect] player ${targetPlayerId} gaining ${card}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: curseIds.slice(-1)[0],
              to: { location: 'playerDiscards' }
            });
          }
        }
      })
    }
  },
  'crossroads': {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.match.playerHands[cardEffectArgs.playerId];
      
      console.log(`[crossroads effect] revealing ${hand.length} cards`);
      
      for (const cardId of hand) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
      
      const victoryCardInHandCount = hand.map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('VICTORY'))
        .length;
      
      console.log(`[crossroads effect] drawing ${victoryCardInHandCount} cards`);
      
      for (let i = 0; i < victoryCardInHandCount; i++) {
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      }
      
      const crossroadsPlayedThisTurnCount = cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.turnNumber]
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.owner === cardEffectArgs.playerId && card.cardKey === 'crossroads')
        .length;
      
      if (crossroadsPlayedThisTurnCount === 1) {
        console.log(`[crossroads effect] crossroads played this turn ${crossroadsPlayedThisTurnCount}, gaining 3 actions`);
        await cardEffectArgs.runGameActionDelegate('gainAction', { count: 3 });
      }
      else {
        console.log(`[crossroads effect] crossroads played this turn ${crossroadsPlayedThisTurnCount}, not gaining actions`);
      }
    }
  },
}

export default expansion;