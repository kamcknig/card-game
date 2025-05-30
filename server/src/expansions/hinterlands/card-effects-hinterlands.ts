import { CardId, PlayerId } from 'shared/shared-types.ts';
import { CardExpansionModule, CardLifecycleCallbackContext } from '../../types.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';

const expansion: CardExpansionModule = {
  'berserker': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const actionCardsInPlay = getCardsInPlay(args.findCards)
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
        { playerId: cardEffectArgs.playerId }
      );
      
      const cardIds = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        {
          playerId: cardEffectArgs.playerId, kind: 'upTo', amount: { treasure: cost.treasure - 1 }
        }
      ]);
      
      if (cardIds.length > 0) {
        console.log(`[berserker effect] no cards costing less than ${cost.treasure - 1}`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cardIds.map(card => card.id),
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
        to: { location: 'playerDiscard' }
      });
    }
  },
  'border-village': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        const { cost } = args.cardPriceController.applyRules(
          card,
          { playerId: eventArgs.playerId }
        );
        
        const cardIds = args.findCards([
          {
            playerId: eventArgs.playerId, kind: 'upTo', amount: { treasure: cost.treasure - 1 }
          },
        ]);
        
        if (!cardIds.length) {
          console.log(`[border-village onGained effect] no cards costing less than ${cost.treasure - 1}`);
          return;
        }
        
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: cardIds.map(card => card.id),
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
          to: { location: 'playerDiscard' }
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
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      
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
          to: { location: 'playerDeck' }
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
            const curseIds = cardEffectArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'curse' }
            ]);
            
            if (!curseIds.length) {
              console.log(`[cauldron triggered effect] no curse cards in supply`);
              break;
            }
            
            console.log(`[cauldron triggered effect] player ${targetPlayerId} gaining ${curseIds.slice(-1)[0]}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: curseIds.slice(-1)[0].id,
              to: { location: 'playerDiscard' }
            });
          }
        }
      })
    }
  },
  'crossroads': {
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
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
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      if (hand.length === 0) {
        console.log(`[develop effect] no cards in hand`);
        return;
      }
      
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand' },
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
        { playerId: cardEffectArgs.playerId }
      );
      
      const oneLessCards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'exact', amount: { treasure: cost.treasure - 1 } }
      ]);
      
      const oneMoreCards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { playerId: cardEffectArgs.playerId, kind: 'exact', amount: { treasure: cost.treasure + 1 } }
      ]);
      
      let combined = oneLessCards.concat(oneMoreCards);
      
      if (!combined.length) {
        console.log(`[develop effect] no cards costing 1 less or 1 more in supply`);
        return;
      }
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card costing 1 less, or 1 more`,
        restrict: combined.map(card => card.id),
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[develop effect] no card selected`);
        return;
      }
      
      combined = [];
      
      let nextPrompt = '';
      if (oneLessCards.findIndex(card => card.id === selectedCardIds[0])) {
        console.log(`[develop effect] card gained was one less`);
        nextPrompt = `Gain card costing 1 more`;
        combined = oneMoreCards;
      }
      else if (oneMoreCards.findIndex(card => card.id === selectedCardIds[0])) {
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
        restrict: combined.map(card => card.id),
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[develop effect] no card selected`);
        return;
      }
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardIds[0],
        to: { location: 'playerDiscard' }
      });
    }
  },
  'farmland': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, rest) => {
        const hand = args.cardSourceController.getSource('playerHand', rest.playerId);
        if (hand.length === 0) {
          console.log(`[farmland onGained effect] no cards in hand`);
          return;
        }
        
        let selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: rest.playerId,
          prompt: `Trash a card`,
          restrict: { location: 'playerHand' },
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[farmland onGained effect] no card selected`);
          return;
        }
        
        let selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        const { cost } = args.cardPriceController.applyRules(selectedCard, {
          playerId: rest.playerId
        });
        
        const nonFarmlandCards = args.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: rest.playerId, kind: 'exact', amount: { treasure: cost.treasure + 2 } }
        ])
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
          to: { location: 'playerDiscard' }
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
            
            const goldCardIds = triggeredEffectArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'gold' }
            ]);
            
            if (!goldCardIds.length) {
              console.log(`[fools-gold triggered effect] no gold cards in supply`);
              return;
            }
            
            const card = goldCardIds.slice(-1)[0];
            
            console.log(`[fools-gold triggered effect] gaining ${card}`);
            
            await triggeredEffectArgs.runGameActionDelegate('gainCard', {
              playerId: eventArgs.playerId,
              cardId: card.id,
              to: { location: 'playerDeck' }
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
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
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
            playerId: cardEffectArgs.playerId
          });
          
          const cards = cardEffectArgs.findCards([
            { location: ['basicSupply', 'kingdomSupply'] },
            {
              playerId: cardEffectArgs.playerId,
              kind: 'upTo',
              amount: { treasure: cost.treasure - 1, potion: cost.potion }
            }
          ])
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
            to: { location: 'playerDiscard' }
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
        const actionsInDiscard = args.findCards({ location: 'playerDiscard', playerId: eventArgs.playerId })
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
            to: { location: 'playerDeck' }
          });
        }
        
        console.log(`[inn onGained effect] shuffling player deck`);
        
        fisherYatesShuffle(args.cardSourceController.getSource('playerDeck', eventArgs.playerId), true);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[inn effect] drawing 2 cards, and gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: { location: 'playerHand' },
        count: Math.min(2, cardEffectArgs.findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId
        }).length),
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
  'jack-of-all-trades': {
    registerEffects: () => async (cardEffectArgs) => {
      const silverCardIds = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'silver' }
      ]);
      
      if (!silverCardIds.length) {
        console.log(`[jack-of-all-trades effect] no silver cards in supply`);
      }
      else {
        console.log(`[jack-of-all-trades effect] gaining a silver`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCardIds.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (deck.length === 0) {
        console.log(`[jack-of-all-trades effect] no cards in deck, shuffling`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
      }
      
      if (deck.length === 0) {
        console.log(`[jack-of-all-trades effect] no cards in deck after shuffling`);
      }
      else {
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: `Discard ${card.cardName}`,
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 }, { label: 'DISCARD', action: 2 }
          ],
        }) as { action: number, result: number[] };
        
        if (result.action === 2) {
          console.log(`[jack-of-all-trades effect] discarding ${card}`);
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId,
            playerId: cardEffectArgs.playerId
          });
        }
      }
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      while (deck.length > 0 && hand.length < 5) {
        console.log(`[jack-of-all-trades effect] drawing card`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      }
      
      const nonTreasureCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => !card.type.includes('TREASURE'));
      
      if (nonTreasureCardsInHand.length === 0) {
        console.log(`[jack-of-all-trades effect] no non-treasure cards in hand`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash a card`,
        restrict: { location: 'playerHand' },
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (selectedCardIds.length === 0) {
        console.log(`[jack-of-all-trades effect] no card selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[jack-of-all-trades effect] trashing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardIds[0],
      });
    }
  },
  'margrave': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[margrave effect] drawing 3 cards, and gaining 1 buy`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        startingPlayerId: cardEffectArgs.playerId,
        appliesTo: 'ALL_OTHER'
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: targetPlayerId });
        
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        const numToDiscard = hand.length > 3 ? hand.length - 3 : 0;
        
        if (numToDiscard === 0) {
          console.log(`[margrave effect] player ${targetPlayerId} already at 3 or less cards`);
          continue;
        }
        
        console.log(`[margrave effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);
        
        for (let i = 0; i < numToDiscard; i++) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: hand[i],
            playerId: targetPlayerId
          });
        }
      }
    }
  },
  'nomads': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        if (eventArgs.playerId !== getCurrentPlayer(args.match).id) {
          return;
        }
        
        console.log(`[nomads onTrashed effect] gaining 2 treasure`);
        await args.runGameActionDelegate('gainTreasure', { count: 2 });
      },
      onGained: async (args, eventArgs) => {
        if (eventArgs.playerId !== getCurrentPlayer(args.match).id) {
          return;
        }
        
        console.log(`[nomads onGained effect] gaining 2 treasure`);
        await args.runGameActionDelegate('gainTreasure', { count: 2 });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[nomads effect] gaining 1 buy, and 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
    }
  },
  'oasis': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[oasis effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: { location: 'playerHand' },
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[oasis effect] no card selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[oasis effect] discarding ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('discardCard', { cardId: card.id, playerId: cardEffectArgs.playerId });
    }
  },
  'scheme': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[scheme effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `scheme:${cardEffectArgs.cardId}:discardCard`,
        listeningFor: 'discardCard',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: false,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          if (!conditionArgs.trigger.args.previousLocation) return false;
          if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation)) return false;
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (card.owner !== cardEffectArgs.playerId) return false;
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const card = triggeredEffectArgs.cardLibrary.getCard(triggeredEffectArgs.trigger.args.cardId);
          
          console.log(`[scheme triggered effect] moving ${card} to deck`);
          
          await triggeredEffectArgs.runGameActionDelegate('moveCard', {
            cardId: triggeredEffectArgs.trigger.args.cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' }
          });
        }
      })
    }
  },
  'souk': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const numToTrash = Math.min(2, args.cardSourceController.getSource('playerHand', eventArgs.playerId).length);
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Trash card/s`,
          restrict: { location: 'playerHand' },
          count: {
            kind: 'upTo',
            count: numToTrash
          },
          optional: true,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.log(`[souk onGained effect] no card selected`);
          return;
        }
        
        console.log(`[souk onGained effect] trashing ${selectedCardIds.length} cards`);
        
        for (const cardId of selectedCardIds) {
          await args.runGameActionDelegate('trashCard', {
            playerId: eventArgs.playerId,
            cardId: cardId,
          });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[souk effect] gaining 1 buy, and gaining 7 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 7 });
      
      
      const handSize = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length;
      const numToLose = Math.min(cardEffectArgs.match.playerTreasure, handSize)
      console.log(`[souk effect] losing ${numToLose} treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: handSize });
    }
  },
  'spice-merchant': {
    registerEffects: () => async (cardEffectArgs) => {
      const treasuresInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));
      
      if (!treasuresInHand.length) {
        console.log(`[spice-merchant effect] no treasure cards in hand`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand' },
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[spice-merchant effect] no card selected`);
        return;
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[spice-merchant effect] trashing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: card.id,
      });
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: '+2 Cards, + 1 Action', action: 1 }, { label: '+1 Buy, +2 Treasure', action: 2 }
        ],
      }) as { action: number, result: number[] };
      
      switch (result.action) {
        case 1:
          console.log(`[spice-merchant effect] drawing 2 cards and gaining 1 action`);
          await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
          await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
          break;
        case 2:
          console.log(`[spice-merchant effect] gaining 1 buy, and 2 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
          await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
          break;
      }
    }
  },
  'stables': {
    registerEffects: () => async (cardEffectArgs) => {
      const treasuresInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));
      
      if (!treasuresInHand.length) {
        console.log(`[stables effect] no treasure cards in hand`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: { location: 'playerHand' },
        count: 1,
        optional: true
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[stables effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[stables effect] discarding ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('discardCard', {
        cardId: selectedCard.id,
        playerId: cardEffectArgs.playerId
      });
      
      console.log(`[stables effect] drawing 3 cards, and gaining 1 action `);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
    }
  },
  'trader': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`trader:${eventArgs.cardId}:gainCard`);
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `trader:${eventArgs.cardId}:gainCard`,
          listeningFor: 'gainCard',
          playerId: eventArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggerArgs) => {
            const traderCard = triggerArgs.cardLibrary.getCard(eventArgs.cardId);
            
            console.log(`[trader onEnterHand event] revealing trader`);
            
            await triggerArgs.runGameActionDelegate('revealCard', {
              cardId: traderCard.id,
              playerId: eventArgs.playerId,
            });
            
            const gainedCard = triggerArgs.cardLibrary.getCard(triggerArgs.trigger.args.cardId);
            
            if (triggerArgs.trigger.args.previousLocation) {
              console.log(`[trader onEnterHand event] putting ${gainedCard} back in previous location`);
              await triggerArgs.runGameActionDelegate('moveCard', {
                cardId: gainedCard.id,
                toPlayerId: triggerArgs.trigger.args.playerId,
                to: { location: triggerArgs.trigger.args.previousLocation }
              });
            }
            else {
              console.warn(`[trader onEnterHand event] gained ${gainedCard} has no previous location`);
            }
            
            const silverCardIds = triggerArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'silver' }
            ]);
            
            if (!silverCardIds.length) {
              console.log(`[trader onEnterHand event] no silvers in supply`);
              return;
            }
            
            const silverCard = silverCardIds[0];
            
            console.log(`[trader onEnterHand event] gaining ${silverCard} instead`);
            await triggerArgs.runGameActionDelegate('moveCard', {
              cardId: silverCard.id,
              toPlayerId: eventArgs.playerId,
              to: { location: 'playerDiscard' }
            });
          }
        })
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      if (hand.length === 0) {
        console.log(`[trader effect] no cards in hand`);
        return;
      }
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand' },
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[trader effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[trader effect] trashing ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
      
      const { cost } = cardEffectArgs.cardPriceController.applyRules(
        selectedCard,
        { playerId: cardEffectArgs.playerId }
      );
      
      const silverCardIds = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'silver' }
      ]);
      
      if (!silverCardIds.length) {
        console.log(`[trader effect] no silver cards in supply`);
        return;
      }
      
      const numToGain = Math.min(silverCardIds.length, cost.treasure);
      
      console.log(`[trader effect] gaining ${numToGain} silver cards`);
      
      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCardIds.slice(-i - 1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'trail': {
    registerLifeCycleMethods: () => {
      async function doTrail(args: CardLifecycleCallbackContext, eventArgs: { playerId: PlayerId; cardId: CardId; }) {
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          console.log(`[trail onGained/Trashed/Discarded event] happening during clean-up, skipping`);
          return;
        }
        
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Play Trail?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 }, { label: 'PLAY', action: 2 }
          ],
        }) as { action: number, result: number[] };
        
        if (result.action === 1) {
          console.log(`[trail onGained/Trashed/Discarded event] not playing trail`);
          return;
        }
        
        console.log(`[trail onGained/Trashed/Discarded event] playing trail`);
        
        await args.runGameActionDelegate('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
          overrides: {
            actionCost: 0
          }
        });
      }
      
      return {
        onGained: async (args, eventArgs) => {
          await doTrail(args, eventArgs);
        },
        onTrashed: async (args, eventArgs) => {
          await doTrail(args, eventArgs);
        },
        onDiscarded: async (args, eventArgs) => {
          await doTrail(args, eventArgs);
        }
      }
    },
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[trail effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
    }
  },
  'tunnel': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          console.log(`[tunnel onDiscarded event] happening during clean-up, skipping`);
          return;
        }
        
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Reveal tunnel?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 }, { label: 'REVEAL', action: 2 }
          ],
        }) as { action: number, result: number[] };
        
        if (result.action === 1) {
          console.log(`[tunnel onDiscarded event] not revealing tunnel`);
          return;
        }
        
        console.log(`[tunnel onDiscarded event] revealing tunnel`);
        
        await args.runGameActionDelegate('revealCard', {
          cardId: eventArgs.cardId,
          playerId: eventArgs.playerId,
        });
        
        const goldCardIds = args.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'gold' }
        ]);
        
        if (!goldCardIds.length) {
          console.log(`[tunnel onDiscarded event] no gold cards in supply`);
          return;
        }
        
        const goldCard = goldCardIds.slice(-1)[0];
        
        console.log(`[tunnel onDiscarded event] gaining ${goldCard}`);
        
        await args.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: goldCard.id,
          to: { location: 'playerDiscard' }
        });
      }
    }),
  },
  'weaver': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          console.log(`[weaver onDiscarded event] happening during clean-up, skipping`);
          return;
        }
        
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Play Weaver?',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: 'CANCEL', action: 1 }, { label: 'PLAY', action: 2 }
          ]
        });
        
        if (result.action === 1) {
          console.log(`[weaver onDiscarded event] not playing weaver`);
          return;
        }
        
        console.log(`[weaver onDiscarded event] playing weaver`);
        
        await args.runGameActionDelegate('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose two silvers, or gain a card costing up to $4',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'SILVERS', action: 1 }, { label: 'GAIN CARD', action: 2 }
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[weaver effect] choosing silvers`);
        
        const silverCardIds = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'silver' }
        ]);
        
        if (!silverCardIds.length) {
          console.log(`[weaver effect] no silver cards in supply`);
          return;
        }
        
        const numToGain = Math.min(silverCardIds.length, 2);
        
        console.log(`[weaver effect] gaining ${numToGain} silver cards`);
        
        for (let i = 0; i < numToGain; i++) {
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCardIds.slice(-i - 1)[0].id,
            to: { location: 'playerDiscard' }
          });
        }
      }
      else {
        console.log(`[weaver effect] choosing card costing up to $4`);
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: [
            { location: ['basicSupply', 'kingdomSupply'] },
            { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 4 } }
          ],
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[weaver effect] no card selected`);
          return;
        }
      }
    }
  },
  'wheelwright': {
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: cardEffectArgs.playerId });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      if (hand.length === 0) {
        console.log(`[wheelwright effect] no cards in hand`);
        return;
      }
      
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: { location: 'playerHand' },
        count: 1,
        optional: true
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[wheelwright effect] no card selected`);
        return;
      }
      
      let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      await cardEffectArgs.runGameActionDelegate('discardCard', {
        cardId: selectedCard.id,
        playerId: cardEffectArgs.playerId
      });
      
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
        playerId: cardEffectArgs.playerId
      });
      
      const actionCardIds = cardEffectArgs.findCards([
        { location: ['kingdomSupply'] },
        { cardType: 'ACTION' },
        {
          kind: 'upTo',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: cost.treasure, potion: cost.potion }
        }
      ]);
      
      if (!actionCardIds.length) {
        console.log(`[wheelwright effect] no action cards in kingdom`);
        return;
      }
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: actionCardIds.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[wheelwright effect] no card selected`);
        return;
      }
      
      selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[wheelwright effect] gaining ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'witchs-hut': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[witchs-hut effect] drawing 4 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 4 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: { location: 'playerHand' },
        count: Math.min(2, cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length),
      }) as CardId[];
      
      console.log(`[witchs-hut effect] revealing and discarding ${selectedCardIds.length} cards`);
      
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
        });
        
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId
        });
      }
      
      if (selectedCardIds.length === 2) {
        if (selectedCardIds.map(cardEffectArgs.cardLibrary.getCard).every(card => card.type.includes('ACTION'))) {
          console.log(`[witchs-hut effect] every card discarded is an action, others gaining a curse`);
          
          const targetPlayerIds = findOrderedTargets({
            match: cardEffectArgs.match,
            startingPlayerId: cardEffectArgs.playerId,
            appliesTo: 'ALL_OTHER'
          }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
          
          for (const targetPlayerId of targetPlayerIds) {
            const curseCardIds = cardEffectArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'curse' }
            ]);
            
            if (!curseCardIds.length) {
              console.log(`[witchs-hut effect] no curse cards in supply`);
              return;
            }
            
            const curseCard = curseCardIds.slice(-1)[0];
            
            console.log(`[witchs-hut effect] gaining ${curseCard} to ${targetPlayerId}`);
            
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: curseCard.id,
              to: { location: 'playerDiscard' }
            });
          }
        }
        else {
          console.log(`[witchs-hut effect] not every card discarded is an action`);
        }
      }
    }
  },
}

export default expansion;