import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findCards } from '../../utils/find-cards.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';

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
  'develop': {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.match.playerHands[cardEffectArgs.playerId];
      
      if (hand.length === 0) {
        console.log(`[develop effect] no cards in hand`);
        return;
      }
      
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { from: { location: 'playerHands' } },
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[develop effect] no card selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[develop effect] trashing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: card.id,
      });
      
      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        card,
        { match: cardEffectArgs.match, playerId: cardEffectArgs.playerId }
      );
      
      const oneLessCards = findCards(
        cardEffectArgs.match,
        {
          location: ['supply', 'kingdom'],
          cost: {
            cardCostController: cardEffectArgs.cardPriceController,
            spec: { playerId: cardEffectArgs.playerId, kind: 'exact', amount: { treasure: cost.treasure - 1 } }
          }
        },
        cardEffectArgs.cardLibrary
      );
      
      const oneMoreCards = findCards(
        cardEffectArgs.match,
        {
          location: ['supply', 'kingdom'],
          cost: {
            cardCostController: cardEffectArgs.cardPriceController,
            spec: { playerId: cardEffectArgs.playerId, kind: 'exact', amount: { treasure: cost.treasure + 1 } }
          }
        },
        cardEffectArgs.cardLibrary
      );
      
      let combined = oneLessCards.concat(oneMoreCards);
      
      if (!combined.length) {
        console.log(`[develop effect] no cards costing 1 less or 1 more in supply`);
        return;
      }
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card costing 1 less, or 1 more`,
        restrict: combined,
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[develop effect] no card selected`);
        return;
      }
      
      combined = [];
      
      let nextPrompt = '';
      if (oneLessCards.findIndex(id => id === selectedCardIds[0])) {
        console.log(`[develop effect] card gained was one less`);
        nextPrompt = `Gain card costing 1 more`;
        combined = oneMoreCards;
      }
      else if (oneMoreCards.findIndex(id => id === selectedCardIds[0])) {
        console.log(`[develop effect] card gained was one more`);
        nextPrompt = `Gain card costing 1 less`;
        combined = oneLessCards
      }
      
      if (!combined.length) {
        console.log(`[develop effect] no remaining cards to gain`);
        return;
      }
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: nextPrompt,
        restrict: combined,
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[develop effect] no card selected`);
        return;
      }
    }
  },
  'farmland': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, rest) => {
        const hand = args.match.playerHands[rest.playerId];
        if (hand.length === 0) {
          console.log(`[farmland onGained effect] no cards in hand`);
          return;
        }
        
        let selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: rest.playerId,
          prompt: `Trash a card`,
          restrict: { from: { location: 'playerHands' } },
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[farmland onGained effect] no card selected`);
          return;
        }
        
        let selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        const { cost } = args.cardPriceController.applyRules(selectedCard, {
          match: args.match,
          playerId: rest.playerId
        });
        
        const nonFarmlandCards = findCards(
          args.match,
          {
            location: ['supply', 'kingdom'],
            cost: {
              cardCostController: args.cardPriceController,
              spec: { playerId: rest.playerId, kind: 'exact', amount: { treasure: cost.treasure + 2 } }
            }
          },
          args.cardLibrary
        )
          .map(args.cardLibrary.getCard)
          .filter(card => card.cardKey !== 'farmland');
        
        if (!nonFarmlandCards.length) {
          console.log(`[farmland onGained effect] no non-farmland cards costing exactly 2 more than ${selectedCard} in supply`);
          return;
        }
        
        selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: rest.playerId,
          prompt: `Gain card`,
          restrict: nonFarmlandCards.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[farmland onGained effect] no card selected`);
          return;
        }
        
        selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[farmland onGained effect] gaining card ${selectedCard}`);
        
        await args.runGameActionDelegate('gainCard', {
          playerId: rest.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscards' }
        });
      }
    })
  },
  'fools-gold': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`fools-gold:${eventArgs.cardId}:gainCard`);
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `fools-gold:${eventArgs.cardId}:gainCard`,
          playerId: eventArgs.playerId,
          listeningFor: 'gainCard',
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (card.cardKey !== 'province') return false;
            return true;
          },
          triggeredEffectFn: async (triggeredEffectArgs) => {
            console.log(`[fools-gold triggered effect] trashing fools gold`)
            await triggeredEffectArgs.runGameActionDelegate('trashCard', {
              playerId: triggeredEffectArgs.trigger.args.playerId,
              cardId: eventArgs.cardId,
            });
            
            const goldCardIds = findCards(
              triggeredEffectArgs.match,
              {
                location: 'supply',
                cards: { cardKeys: 'gold' }
              },
              triggeredEffectArgs.cardLibrary
            );
            
            if (!goldCardIds.length) {
              console.log(`[fools-gold triggered effect] no gold cards in supply`);
              return;
            }
            
            const card = triggeredEffectArgs.cardLibrary.getCard(goldCardIds.slice(-1)[0]);
            
            console.log(`[fools-gold triggered effect] gaining ${card}`);
            
            await triggeredEffectArgs.runGameActionDelegate('gainCard', {
              playerId: eventArgs.playerId,
              cardId: card.id,
              to: { location: 'playerDecks' }
            });
          }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const foolsGoldPlayedThisTurnCount = cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.turnNumber]
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.owner === cardEffectArgs.playerId && card.cardKey === 'fools-gold')
        .length;
      
      console.log(`[fools-gold effect] fools-gold played this turn ${foolsGoldPlayedThisTurnCount}`);
      
      if (foolsGoldPlayedThisTurnCount === 1) {
        console.log(`[fools-gold effect] gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      }
      else {
        console.log(`[fools-gold effect] gaining 4 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 4 });
      }
    }
  },
  'guard-dog': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`guard-dog:${eventArgs.cardId}:cardPlayed`);
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `guard-dog:${eventArgs.cardId}:cardPlayed`,
          listeningFor: 'cardPlayed',
          once: false,
          playerId: eventArgs.playerId,
          allowMultipleInstances: true,
          compulsory: false,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async () => {
            console.log(`[guard-dog triggered effect] playing guard-dog ${eventArgs.cardId}`);
            
            await args.runGameActionDelegate('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId
            })
          }
        })
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[guard-dog effect] drawing 2 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const hand = cardEffectArgs.match.playerHands[cardEffectArgs.playerId];
      
      if (hand.length <= 5) {
        console.log(`[guard-dog effect] hand size is ${hand.length}, drawing 2 more cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      }
    }
  },
  'haggler': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[haggler effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `haggler:${cardEffectArgs.cardLibrary}:gainCard`,
        listeningFor: 'gainCard',
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        playerId: cardEffectArgs.playerId,
        condition: conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (!conditionArgs.trigger.args.bought) return false;
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const card = triggeredEffectArgs.cardLibrary.getCard(triggeredEffectArgs.trigger.args.cardId);
          
          const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
            match: triggeredEffectArgs.match,
            playerId: cardEffectArgs.playerId
          });
          
          const cards = findCards(
            triggeredEffectArgs.match,
            {
              location: ['supply', 'kingdom'],
              cost: {
                cardCostController: cardEffectArgs.cardPriceController,
                spec: {
                  playerId: cardEffectArgs.playerId,
                  kind: 'upTo',
                  amount: { treasure: cost.treasure - 1, potion: cost.potion }
                }
              }
            },
            triggeredEffectArgs.cardLibrary
          )
            .map(triggeredEffectArgs.cardLibrary.getCard)
            .filter(card => !card.type.includes('VICTORY'));
          
          if (cards.length === 0) {
            console.log(`[haggler triggered effect] no cards non-victory cards costing 2 less than ${cost.treasure}`);
            return;
          }
          
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain non-Victory card`,
            restrict: cards.map(card => card.id),
            count: 1,
          }) as CardId[];
          
          if (!selectedCardIds.length) {
            console.log(`[haggler triggered effect] no card selected`);
            return;
          }
          
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          
          console.log(`[haggler triggered effect] gaining ${selectedCard}`);
          
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: { location: 'playerDiscards' }
          });
        }
      })
    }
  },
  'highway': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[highway effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const cards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
      
      const unsubs: (() => void)[] = [];
      
      const rule: CardPriceRule = (card, context) => {
        return { restricted: false, cost: { treasure: -1, potion: 0 } };
      }
      
      for (const card of cards) {
        unsubs.push(cardEffectArgs.cardPriceController.registerRule(card, rule));
      }
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `highway:${cardEffectArgs.cardId}:endTurn`,
        listeningFor: 'endTurn',
        condition: () => true,
        once: true,
        compulsory: true,
        playerId: cardEffectArgs.playerId,
        allowMultipleInstances: true,
        triggeredEffectFn: async () => {
          unsubs.forEach(c => c());
        }
      })
    }
  },
  'inn': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const actionsInDiscard = args.match.playerDiscards[eventArgs.playerId]
          .map(args.cardLibrary.getCard)
          .filter(card => card.type.includes('ACTION'));
        
        if (!actionsInDiscard.length) {
          console.log(`[inn onGained effect] no actions in discard`);
          return;
        }
        
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Reveal actions to shuffle into deck?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'DONE', action: 1 }
          ],
          content: {
            type: 'select',
            cardIds: actionsInDiscard.map(card => card.id),
            selectCount: {
              kind: 'upTo',
              count: actionsInDiscard.length
            }
          }
        }) as { action: number, result: CardId[] };
        
        if (!result.result.length) {
          console.log(`[inn onGained effect] no cards selected`);
          return;
        }
        
        console.log(`[inn onGained effect] revealing ${result.result.length} cards and moving to deck`);
        
        for (const cardId of result.result) {
          await args.runGameActionDelegate('revealCard', {
            cardId: cardId,
            playerId: eventArgs.playerId,
          });
          
          await args.runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: eventArgs.playerId,
            to: { location: 'playerDecks' }
          });
        }
        
        console.log(`[inn onGained effect] shuffling player deck`);
        
        fisherYatesShuffle(args.match.playerDecks[eventArgs.playerId]);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[inn effect] drawing 2 cards, and gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: { from: { location: 'playerHands' } },
        count: Math.min(2, cardEffectArgs.match.playerHands[cardEffectArgs.playerId].length),
      }) as CardId[];
      
      if (!selectedCardIds) {
        console.warn(`[inn effect] no card selected`);
        return;
      }
      
      console.log(`[inn effect] discarding ${selectedCardIds.length} cards`);
      
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId
        });
      }
    }
  },
}

export default expansion;