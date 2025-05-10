import { Card, CardId, CardKey } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { CardPriceRule } from '../../core/card-price-rules-controller.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';

const expansion: CardExpansionModule = {
  'anvil': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const selectedCardToDiscardIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Discard treasure`,
        restrict: [
          { location: 'playerHand', playerId: effectArgs.playerId },
          { cardType: 'TREASURE' }
        ],
        count: 1,
        optional: true,
      }) as CardId[];
      
      const selectedCardToDiscardId = selectedCardToDiscardIds[0];
      if (!selectedCardToDiscardId) {
        console.log(`[anvil effect] no card selected`);
        return;
      }
      
      const selectedCardToTrash = effectArgs.cardLibrary.getCard(selectedCardToDiscardId);
      console.log(`[anvil effect] selected ${selectedCardToTrash}`);
      
      await effectArgs.runGameActionDelegate('discardCard', {
        cardId: selectedCardToDiscardId,
        playerId: effectArgs.playerId
      });
      
      const selectedCardToGainIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { playerId: effectArgs.playerId, kind: 'upTo', amount: { treasure: 4 } }
        ],
        count: 1,
      }) as CardId[];
      
      const selectedCardToGainId = selectedCardToGainIds[0];
      
      if (!selectedCardToGainId) {
        console.log(`[anvil effect] no card selected`);
        return;
      }
      
      const selectedCardToGain = effectArgs.cardLibrary.getCard(selectedCardToGainId);
      
      console.log(`[anvil effect] selected ${selectedCardToGain}`);
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedCardToGainId,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'bank': {
    registerEffects: () => async (effectArgs) => {
      const playedCardIds = effectArgs.match.stats.playedCardsByTurn[effectArgs.match.turnNumber];
      const playedTreasureCards = playedCardIds.map(effectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));
      
      console.log(`[bank effect] played ${playedTreasureCards.length} treasure cards, gaining ${playedTreasureCards.length} treasure`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: playedTreasureCards.length });
    }
  },
  'bishop': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[bishop effect] gaining 1 treasure and 1 victory token`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      await effectArgs.runGameActionDelegate('gainVictoryToken', { playerId: effectArgs.playerId, count: 1 });
      
      const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
      if (hand.length === 0) {
        console.log(`[bishop effect] no cards in hand`);
      }
      else {
        console.log(`[bishop effect] prompting player to select card to trash`);
        
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
        }) as CardId[];
        
        const selectedCardId = selectedCardIds[0];
        
        if (!selectedCardId) {
          console.warn(`[bishop effect] no card selected`);
        }
        else {
          const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
          
          console.log(`[bishop effect] selected ${selectedCard} to trash`);
          
          await effectArgs.runGameActionDelegate('trashCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardId,
          });
          
          const { cost: selectedCardCost } = effectArgs.cardPriceController.applyRules(selectedCard, {
            playerId: effectArgs.playerId
          })
          
          const tokensToGain = Math.floor(selectedCardCost.treasure / 2);
          
          console.log(`[bishop effect] gaining ${tokensToGain} victory tokens`);
          
          await effectArgs.runGameActionDelegate('gainVictoryToken', {
            playerId: effectArgs.playerId,
            count: tokensToGain
          });
        }
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId
      });
      
      for (const targetPlayerId of targetPlayerIds) {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: targetPlayerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1,
          optional: true,
        }) as CardId[];
        
        const selectedCardId = selectedCardIds[0];
        
        if (!selectedCardId) {
          console.log(`[bishop effect] target player ${targetPlayerId} selected no card`);
          continue;
        }
        
        await effectArgs.runGameActionDelegate('trashCard', {
          playerId: targetPlayerId,
          cardId: selectedCardId,
        });
      }
    }
  },
  'charlatan': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[charlatan effect] gaining 3 treasure and 1 action`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 3 });
      
      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId
      }).filter(playerId => effectArgs.reactionContext?.[playerId].result !== 'immunity');
      
      console.log(`[charlatan effect] targets ${targetPlayerIds} gaining a curse`);
      
      for (const targetPlayerId of targetPlayerIds) {
        const curseCards = effectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'curse' }
        ]);
        
        if (!curseCards.length) {
          console.log(`[charlatan effect] no curse cards in supply`);
          break;
        }
        
        await effectArgs.runGameActionDelegate('gainCard', {
          playerId: targetPlayerId,
          cardId: curseCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'city': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[city effect] drawing 1 card and gaining 1 action`);
      await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      await effectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
      const emptySupplyCount = getStartingSupplyCount(effectArgs.match) - getRemainingSupplyCount(effectArgs.findCards);
      
      if (emptySupplyCount > 0) {
        console.log(`[city effect] empty supply count is greater than 0; drawing 1 card`);
        await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      }
      
      if (emptySupplyCount > 1) {
        console.log(`[city effect] empty supply count is greater than 1; gaining 1 buy and 1 treasure`);
        await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
        await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      }
    }
  },
  'clerk': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `clerk:${eventArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: eventArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: false,
          condition: (conditionArgs) => conditionArgs.trigger.args.playerId === eventArgs.playerId,
          triggeredEffectFn: async (triggerEffectArgs) => {
            await triggerEffectArgs.runGameActionDelegate('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId,
              overrides: {
                actionCost: 0
              }
            });
          }
        })
      },
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`clerk:${eventArgs.cardId}:startTurn`)
      }
    }),
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: effectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: effectArgs.playerId
      }).filter(playerId => {
        return effectArgs.reactionContext?.[playerId]?.result !== 'immunity' &&
          effectArgs.cardSourceController.getSource('playerHand', playerId).length >= 5;
      });
      
      for (const targetPlayerId of targetPlayerIds) {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: targetPlayerId,
          prompt: `Top-deck card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1
        }) as CardId[];
        
        if (!selectedCardIds) {
          console.log(`[clerk effect] target player ${targetPlayerId} selected no card`);
          continue;
        }
        
        await effectArgs.runGameActionDelegate('moveCard', {
          cardId: selectedCardIds[0],
          toPlayerId: targetPlayerId,
          to: { location: 'playerDeck' }
        });
      }
    }
  },
  'collection': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`collection:${eventArgs.cardId}:gainCard`);
      }
    }),
    registerEffects: () => async (effectArgs) => {
      console.log(`[collection effect] gaining 2 treasure and 1 buy`);
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      effectArgs.reactionManager.registerReactionTemplate({
        id: `collection:${effectArgs.cardId}:gainCard`,
        playerId: effectArgs.playerId,
        listeningFor: 'gainCard',
        compulsory: true,
        once: true,
        allowMultipleInstances: true,
        condition: (conditionArgs) => {
          const currentTurnNumber = conditionArgs.match.turnNumber;
          if (currentTurnNumber !== conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId].turnNumber) return false;
          const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!card.type.includes('ACTION')) return false;
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          console.log(`[collection triggered effect] gaining 1 victory token`);
          await triggeredEffectArgs.runGameActionDelegate('gainVictoryToken', {
            playerId: effectArgs.playerId,
            count: 1
          });
        }
      })
    }
  },
  'crystal-ball': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      const deck = effectArgs.cardSourceController.getSource('playerDeck', effectArgs.playerId);
      const discard = effectArgs.cardSourceController.getSource('playerDiscard', effectArgs.playerId);
      
      if (deck.length + discard.length === 0) {
        console.log(`[crystal-ball effect] no cards to look at`);
        return;
      }
      
      if (deck.length === 0) {
        await effectArgs.runGameActionDelegate('shuffleDeck', { playerId: effectArgs.playerId });
      }
      
      const cardId = deck.slice(-1)[0];
      const card = effectArgs.cardLibrary.getCard(cardId);
      
      const actions = [
        { label: 'Trash', action: 1 },
        { label: 'Discard', action: 2 }
      ];
      
      const isAction = card.type.includes('ACTION')
      const isTreasure = card.type.includes('TREASURE')
      
      if (isAction || isTreasure) {
        actions.push({ label: 'Play', action: 3 });
      }
      
      const result = await effectArgs.runGameActionDelegate('userPrompt', {
        prompt: `You drew ${card.cardName}`,
        playerId: effectArgs.playerId,
        actionButtons: actions,
      }) as { action: number, cardIds: number[] };
      
      switch (result.action) {
        case 1:
          await effectArgs.runGameActionDelegate('trashCard', { playerId: effectArgs.playerId, cardId });
          break;
        case 2:
          await effectArgs.runGameActionDelegate('discardCard', { cardId, playerId: effectArgs.playerId });
          break;
        case 3:
          await effectArgs.runGameActionDelegate('playCard', {
            playerId: effectArgs.playerId,
            cardId,
            overrides: { actionCost: 0 }
          });
          break;
      }
    }
  },
  'expand': {
    registerEffects: () => async (effectArgs) => {
      console.log('[expand effect] prompting to select card to trash')
      const selectedToTrashIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Trash card`,
        restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
        count: 1
      }) as CardId[];
      
      if (!selectedToTrashIds.length) {
        console.log(`[expand effect] no card selected`);
        return;
      }
      
      const selectedToTrashId = selectedToTrashIds[0];
      let card = effectArgs.cardLibrary.getCard(selectedToTrashId);
      console.log(`[expand effect] selected ${card} to trash`)
      
      const { cost: effectCost } = effectArgs.cardPriceController.applyRules(card, {
        playerId: effectArgs.playerId
      });
      
      const selectedToGainIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'upTo',
            playerId: effectArgs.playerId,
            amount: { treasure: effectCost.treasure + 3, potion: effectCost.potion }
          }
        ],
        count: 1,
      }) as CardId[];
      
      if (!selectedToGainIds.length) {
        console.log(`[expand effect] no card selected`);
        return;
      }
      
      card = effectArgs.cardLibrary.getCard(selectedToGainIds[0]);
      
      console.log(`[expand effect] selected ${card} to gain`)
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedToGainIds[0],
        to: { location: 'playerDiscard' }
      });
    }
  },
  'forge': {
    registerEffects: () => async (effectArgs) => {
      const selectedCardIdsToTrash = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Trash cards`,
        restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
        count: {
          kind: 'upTo',
          count: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId).length
        },
        optional: true,
      }) as CardId[];
      
      let cost = { treasure: 0, potion: 0 };
      if (!selectedCardIdsToTrash.length) {
        cost = { treasure: 0, potion: 0 };
      }
      else {
        for (const cardId of selectedCardIdsToTrash) {
          const card = effectArgs.cardLibrary.getCard(cardId);
          const { cost: cardCost } = effectArgs.cardPriceController.applyRules(card, {
            playerId: effectArgs.playerId
          });
          cost = {
            treasure: cost.treasure + cardCost.treasure,
            potion: cost.potion + (cardCost.potion ?? 0)
          };
          
          await effectArgs.runGameActionDelegate('trashCard', { playerId: effectArgs.playerId, cardId });
        }
      }
      
      const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          {
            kind: 'exact',
            amount: { treasure: cost.treasure, potion: 0 },
            playerId: effectArgs.playerId
          }
        ],
        count: 1,
      }) as CardId[];
      
      if (selectedCardIds.length === 0) {
        console.log(`[forge effect] no card selected`);
        return;
      }
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: selectedCardIds[0],
        to: { location: 'playerDiscard' }
      });
    }
  },
  'grand-market': {
    registerActionConditions: () => ({
      canBuy: ({ match, cardLibrary, playerId }) =>
        !match.stats.playedCardsByTurn[match.turnNumber]?.find((cardId) => {
          return cardLibrary.getCard(cardId).cardKey === 'copper' &&
            match.stats.playedCards[cardId].playerId === playerId
        })
    }),
    registerEffects: () => async (effectArgs) => {
      console.log(`[grand market effect] drawing 1 card, gaining 1 action, gaining 1 buy, and gaining 2 treasure`);
      await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId });
      await effectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await effectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
    }
  },
  'hoard': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`hoard:${eventArgs.cardId}:gainCard`);
      }
    }),
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      effectArgs.reactionManager.registerReactionTemplate({
        id: `hoard:${effectArgs.cardId}:gainCard`,
        listeningFor: 'gainCard',
        compulsory: true,
        allowMultipleInstances: true,
        once: false,
        condition: (conditionArgs) => {
          if (conditionArgs.match.turnNumber !==
            conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId]?.turnNumber) return false;
          
          if (!conditionArgs.trigger.args.bought) return false;
          
          if (conditionArgs.trigger.args.playerId !== effectArgs.playerId) return false;
          
          return true;
        },
        triggeredEffectFn: async (triggeredEffectArgs) => {
          const goldCardIds = effectArgs.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'gold' }
          ]);
          
          if (!goldCardIds.length) {
            console.log(`[hoard triggered effect] no gold in supply`);
            return;
          }
          
          await triggeredEffectArgs.runGameActionDelegate('gainCard', {
            playerId: effectArgs.playerId,
            cardId: goldCardIds.slice(-1)[0].id,
            to: { location: 'playerDiscard' }
          });
        },
        playerId: effectArgs.playerId
      })
    }
  },
  'investment': {
    registerEffects: () => async (effectArgs) => {
      if (effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId).length === 0) {
        console.log(`[investment effect] no cards in hand`);
      }
      else {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1
        }) as CardId[];
        
        if (!selectedCardIds[0]) {
          console.warn(`[investment effect] no card selected to trash`);
        }
        else {
          await effectArgs.runGameActionDelegate('trashCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardIds[0],
          });
        }
      }
      
      const result = await effectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: effectArgs.playerId,
        actionButtons: [
          { label: '+1 Treasure', action: 1 },
          { label: 'Trash and reveal', action: 2 }
        ],
      }) as { action: number, cardIds: number[] };
      
      if (result.action === 1) {
        await effectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      }
      else {
        const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
        let uniqueTreasureCount: CardKey[] = [];
        const l = hand.length - 1;
        for (let i = l; i >= 0; i--) {
          await effectArgs.runGameActionDelegate('revealCard', {
            cardId: hand[i],
            playerId: effectArgs.playerId,
          });
          const card = effectArgs.cardLibrary.getCard(hand[i]);
          uniqueTreasureCount.push(card.cardKey);
        }
        uniqueTreasureCount = Array.from(new Set(uniqueTreasureCount));
        await effectArgs.runGameActionDelegate('gainVictoryToken', {
          playerId: effectArgs.playerId,
          count: uniqueTreasureCount.length
        });
      }
    }
  },
  'kings-court': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[kings court effect] prompting user to select card`);
      
      const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
        playerId: effectArgs.playerId,
        prompt: `Choose action`,
        restrict: [
          { location: 'playerHand', playerId: effectArgs.playerId },
          { cardType: 'ACTION' }
        ],
        count: 1,
        optional: true
      }) as CardId[];
      
      const selectedCardId = selectedCardIds[0];
      
      if (!selectedCardId) {
        console.log(`[kings court effect] no selected card`);
        return;
      }
      
      const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
      
      console.log(`[kings court effect] selected ${selectedCard}`);
      
      for (let i = 0; i < 3; i++) {
        await effectArgs.runGameActionDelegate('playCard', {
          playerId: effectArgs.playerId,
          cardId: selectedCardId,
          overrides: {
            actionCost: 0
          }
        })
      }
    }
  },
  'magnate': {
    registerEffects: () => async (effectArgs) => {
      console.log(`[magnate effect] revealing hand`);
      const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
      let treasureCardCount = 0;
      for (let i = hand.length - 1; i >= 0; i--) {
        const card = effectArgs.cardLibrary.getCard(hand[i]);
        treasureCardCount += card.type.includes('TREASURE') ? 1 : 0;
        await effectArgs.runGameActionDelegate('revealCard', {
          cardId: hand[i],
          playerId: effectArgs.playerId,
        });
      }
      
      console.log(`[magnate effect] ${treasureCardCount} treasure revealed`);
      
      await effectArgs.runGameActionDelegate('drawCard', { playerId: effectArgs.playerId, count: treasureCardCount });
    }
  },
  'mint': {
    registerLifeCycleMethods: () => ({
      onGained: async ({ runGameActionDelegate, cardLibrary, match, ...args }, { playerId }) => {
        const cardsInPlay = getCardsInPlay(args.findCards);
        const nonDurationTreasures = cardsInPlay
          .filter(card => card.type.includes('TREASURE') &&
            !card.type.includes('DURATION') &&
            match.stats.playedCards[card.id].playerId === playerId
          );
        
        if (nonDurationTreasures.length === 0) {
          console.log(`[mint onGained] no non-duration treasure cards in play`);
          return;
        }
        
        console.log(`[mint onGained] trashing ${nonDurationTreasures.length} non-duration treasure cards`);
        for (let i = nonDurationTreasures.length - 1; i >= 0; i--) {
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId: nonDurationTreasures[i].id,
          });
        }
      }
    }),
    registerEffects: () => async (effectArgs) => {
      const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
      const handCards = hand.map(effectArgs.cardLibrary.getCard);
      const treasuresInHand = handCards.filter(card => card.type.includes('TREASURE'));
      
      if (treasuresInHand.length === 0) {
        console.log(`[mint effect] no treasures in hand`);
        return;
      }
      
      const uniqueTreasureCount = new Set(treasuresInHand.map(card => card.cardKey)).size;
      
      let selectedCard: Card | undefined = undefined;
      
      if (uniqueTreasureCount === 1) {
        selectedCard = treasuresInHand[0];
      }
      else {
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Reveal card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1
        }) as CardId[];
        
        if (!selectedCardIds[0]) {
          console.warn(`[mint effect] no card selected to reveal`);
          return;
        }
        
        selectedCard = effectArgs.cardLibrary.getCard(selectedCardIds[0]);
      }
      
      console.log(`[mint effect] card to reveal ${selectedCard}`);
      
      await effectArgs.runGameActionDelegate('revealCard', {
        cardId: selectedCard.id,
        playerId: effectArgs.playerId,
      });
      
      const cardsInSupply = effectArgs.findCards([
        { location: selectedCard.isBasic ? 'basicSupply' : 'kingdomSupply' },
        { cardKeys: selectedCard.cardKey }
      ]);
      
      if (cardsInSupply.length === 0) {
        console.log(`[mint effect] no copies of ${selectedCard} in supply`);
        return;
      }
      
      await effectArgs.runGameActionDelegate('gainCard', {
        playerId: effectArgs.playerId,
        cardId: cardsInSupply.slice(-1)[0].id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'monument': {
    registerEffects: () => async ({ playerId, runGameActionDelegate }) => {
      console.log(`[monument effect] gaining 2 treasure, and 1 victory token`);
      await runGameActionDelegate('gainTreasure', { count: 2 });
      await runGameActionDelegate('gainVictoryToken', { playerId, count: 1 });
    }
  },
  'peddler': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[peddler effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
      await runGameActionDelegate('drawCard', { playerId });
      await runGameActionDelegate('gainAction', { count: 1 });
      await runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'platinum': {
    registerEffects: () => async (effectArgs) => {
      await effectArgs.runGameActionDelegate('gainTreasure', { count: 5 });
    }
  },
  'quarry': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[quarry effect] gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const actionCards = cardEffectArgs.findCards({ cardType: 'ACTION' });
      
      const unsubs: (() => void)[] = [];
      for (const actionCard of actionCards) {
        const rule: CardPriceRule = () => ({ restricted: false, cost: { treasure: -2 } });
        const unsub = cardEffectArgs.cardPriceController.registerRule(actionCard, rule);
        unsubs.push(unsub);
      }
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `peddler:${cardEffectArgs.cardId}:endTurn`,
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        listeningFor: 'endTurn',
        condition: () => true,
        triggeredEffectFn: async () => {
          unsubs.forEach(e => e());
        }
      })
    }
  },
  'rabble': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[rabble effect] drawing 3 cards`);
      
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const match = cardEffectArgs.match;
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
        
        if (deck.length < 3) {
          console.log(`[rabble effect] ${targetPlayerId} has less than 3 cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: targetPlayerId });
        }
        
        if (deck.length === 0) {
          console.log(`[rabble effect] ${targetPlayerId} has no cards in deck`);
          continue;
        }
        
        const numToReveal = Math.min(3, deck.length);
        
        const cardsToRearrange: Card[] = [];
        
        for (let i = 0; i < numToReveal; i++) {
          const cardId = deck.slice(-1)[0];
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId,
            playerId: targetPlayerId,
            moveToSetAside: true
          });
          
          if (card.type.includes('ACTION') || card.type.includes('TREASURE')) {
            console.log(`[rabble effect] action or treasure revealed, discarding`);
            await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: targetPlayerId });
          }
          else {
            cardsToRearrange.push(card);
          }
        }
        
        if (cardsToRearrange.length === 0) {
          console.log(`[rabble effect] no cards to rearrange`);
          return;
        }
        
        if (cardsToRearrange.length === 1) {
          console.log(`[rabble effect] only 1 card to rearrange, moving to deck`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: cardsToRearrange[0].id,
            toPlayerId: targetPlayerId,
            to: { location: 'playerDeck' }
          });
        }
        else {
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Rearrange',
            playerId: targetPlayerId,
            actionButtons: [
              { label: 'DONE', action: 1 }
            ],
            content: {
              type: 'rearrange',
              cardIds: cardsToRearrange.map(card => card.id)
            }
          }) as { action: number, result: number[] };
          
          for (const cardId of result.result) {
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId,
              toPlayerId: targetPlayerId,
              to: { location: 'playerDeck' }
            });
          }
        }
      }
    }
  },
  'tiara': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[tiara effect] gaining 1 buy`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `tiara:${cardEffectArgs.cardId}:gainCard`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'gainCard',
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async (triggerEffectArgs) => {
          const card = triggerEffectArgs.cardLibrary.getCard(triggerEffectArgs.trigger.args.cardId);
          
          console.log(`[tiara triggered effect] putting ${card} on deck`);
          
          await triggerEffectArgs.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' }
          })
        }
      });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `tiara:${cardEffectArgs.cardId}:endTurn`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'endTurn',
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: () => true,
        triggeredEffectFn: async (triggerEffectArgs) => {
          cardEffectArgs.reactionManager.unregisterTrigger(`tiara:${cardEffectArgs.cardId}:gainCard`);
          cardEffectArgs.reactionManager.unregisterTrigger(`tiara:${cardEffectArgs.cardId}:endTurn`);
        }
      });
      
      const handIds = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const handCards = handIds.map(cardEffectArgs.cardLibrary.getCard);
      const treasureCards = handCards.filter(card => card.type.includes('TREASURE'));
      if (treasureCards.length === 0) {
        console.log(`[tiara effect] no treasure cards in hand`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play treasure`,
        restrict: [
          { location: 'playerHand', playerId: cardEffectArgs.playerId },
          { cardType: 'TREASURE' }
        ],
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds[0]) {
        console.log(`[tiara effect] no treasure card selected`);
        return;
      }
      
      const selectedCardId = selectedCardIds[0];
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      
      console.log(`[tiara effect] playing ${selectedCard} twice`);
      
      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.runGameActionDelegate('playCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId,
          overrides: {
            actionCost: 0
          }
        })
      }
    }
  },
  'vault': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[vault effect] drawing 2 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: {
          kind: 'upTo',
          count: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length
        }
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[vault effect] no cards selected`);
        return;
      }
      
      console.log(`[vault effect] discarding ${selectedCardIds.length} cards`);
      
      for (const cardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate('discardCard', { cardId, playerId: cardEffectArgs.playerId });
      }
      
      console.log(`[vault effect] gaining ${selectedCardIds.length} treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: selectedCardIds.length });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      });
      
      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        if (!hand.length) {
          console.log(`[vault effect] ${targetPlayerId} has no cards in hand`);
          continue;
        }
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard${hand.length > 1 ? ' to draw' : ''}?`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: Math.min(2, hand.length),
          optional: true,
        }) as CardId[];
        
        console.log(`[vault effect] discarding ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: selectedCardId,
            playerId: targetPlayerId
          });
        }
        
        if (selectedCardIds.length !== 2) {
          console.log(`[vault effect] ${targetPlayerId} did not discard 2 cards, only ${selectedCardIds.length}`);
          return;
        }
        
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: targetPlayerId });
      }
    }
  },
  'war-chest': {
    registerEffects: () => {
      const cardsNamedByTurn: Record<number, CardKey[]> = {};
      
      return async (cardEffectArgs) => {
        const leftPlayer = getPlayerStartingFrom({
          startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
          match: cardEffectArgs.match,
          distance: 1,
        });
        
        console.log(`[war-chest effect] prompting ${leftPlayer} to name a card`);
        
        const namedCardResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Name a card',
          playerId: leftPlayer.id,
          content: {
            type: 'name-card'
          }
        }) as { action: number, result: CardKey };
        
        const cardKey = namedCardResult.result;
        
        cardsNamedByTurn[cardEffectArgs.match.turnNumber] ??= [];
        cardsNamedByTurn[cardEffectArgs.match.turnNumber].push(cardKey);
        
        const cardIds = cardEffectArgs.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', amount: { treasure: 5 }, playerId: cardEffectArgs.playerId }
        ])
          .filter(card => !cardsNamedByTurn[cardEffectArgs.match.turnNumber].includes(card.cardKey))
          .map(card => card.id);
        
        if (!cardIds.length) {
          console.log(`[war-chest effect] no cards found`);
          return;
        }
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain a card`,
          restrict: cardIds,
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[war-chest effect] no card selected`);
          return;
        }
        
        const selectedCardId = selectedCardIds[0];
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        
        console.log(`[war-chest effect] gaining ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'watchtower': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`watchtower:${eventArgs.cardId}:gainCard`);
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `watchtower:${eventArgs.cardId}:gainCard`,
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: false,
          listeningFor: 'gainCard',
          condition: (conditionArgs) => {
            if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggerEffectArgs) => {
            const card = triggerEffectArgs.cardLibrary.getCard(triggerEffectArgs.trigger.args.cardId);
            await triggerEffectArgs.runGameActionDelegate('revealCard', {
              cardId: eventArgs.cardId,
              playerId: eventArgs.playerId,
            });
            
            const result = await triggerEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: `Trash or top deck ${card.cardName}?`,
              playerId: eventArgs.playerId,
              actionButtons: [
                { label: 'TRASH', action: 1 },
                { label: 'TOP-DECK', action: 2 }
              ],
            }) as { action: number, result: number[] };
            
            if (result.action === 1) {
              console.log(`[watchtower triggered effect] player chose to trash ${card}`);
              await triggerEffectArgs.runGameActionDelegate('trashCard', {
                playerId: eventArgs.playerId,
                cardId: card.id,
              });
            }
            else {
              console.log(`[watchtower triggered effect] player chose to top-deck ${card}`);
              await triggerEffectArgs.runGameActionDelegate('moveCard', {
                cardId: card.id,
                toPlayerId: eventArgs.playerId,
                to: { location: 'playerDeck' }
              });
            }
          }
        })
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const numToDraw = 6 - hand.length;
      
      if (numToDraw < 1) {
        console.log(`[watchtower effect] already has 6 cards in hand`);
        return;
      }
      
      console.log(`[watchtower effect] drawing ${numToDraw} cards`);
      
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: hand.length - 6
      });
    }
  },
  'workers-village': {
    registerEffects: () => async ({ runGameActionDelegate, playerId }) => {
      console.log(`[workers-village effect] drawing 1 card, gaining 2 actions, and gaining 1 buy`);
      await runGameActionDelegate('drawCard', { playerId });
      await runGameActionDelegate('gainAction', { count: 2 });
      await runGameActionDelegate('gainBuy', { count: 1 });
    }
  }
}

export default expansion;