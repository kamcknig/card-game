import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';

const cardEffects: CardExpansionModule = {
  'abandoned-mine': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[abandoned mine effect] gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'altar': {
    registerEffects: () => async (cardEffectArgs) => {
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[altar effect] no card selected`);
        return;
      }
      
      const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToTrash.id,
      });
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', amount: { treasure: 5 }, playerId: cardEffectArgs.playerId }
        ],
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds) {
        console.log(`[altar effect] no card selected`);
        return;
      }
      
      const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[altar effect] gaining card ${cardToGain}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToGain.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'armory': {
    registerEffects: () => async (cardEffectArgs) => {
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: [
          { location: ['basicSupply', 'kingdomSupply'] }, {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: { treasure: 4 }
          }
        ],
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[armory effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[armory effect] gaining card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'band-of-misfits': {
    registerEffects: () => async (cardEffectArgs) => {
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      const { cost: thisCost } = cardEffectArgs.cardPriceController.applyRules(thisCard, { playerId: cardEffectArgs.playerId });
      
      const cardIds = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: thisCost.treasure - 1 } },
      ])
        .filter(card => card.type.includes('ACTION') && !card.type.some(t => ['DURATION', 'COMMAND'].includes(t)));
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card`,
        restrict: cardIds.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[band of misfits effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[band of misfits effect] playing card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        overrides: {
          actionCost: 0,
          moveCard: false
        }
      })
    }
  },
  'bandit-camp': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[bandit camp effect] drawing 1 card and gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    }
  },
  'beggar': {
    registerLifeCycleMethods: () => ({
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`beggar:${eventArgs.cardId}:cardPlayed`);
      },
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `beggar:${eventArgs.cardId}:cardPlayed`,
          playerId: eventArgs.playerId,
          listeningFor: 'cardPlayed',
          once: false,
          allowMultipleInstances: true,
          compulsory: false,
          condition: conditionArgs => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            const thisCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            
            console.log(`[beggar triggered effect] discarding ${thisCard}`);
            await triggeredArgs.runGameActionDelegate('discardCard', {
              cardId: thisCard.id,
              playerId: triggeredArgs.trigger.args.playerId
            });
            
            const silverCards = triggeredArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'silver' }
            ]);
            
            const numToGain = Math.min(2, silverCards.length);
            
            if (numToGain < 1) {
              console.log(`[beggar triggered effect] not enough silver in supply`);
              return;
            }
            
            console.log(`[beggar triggered effect] number of silvers to gain ${numToGain}, one of them to deck`);
            
            for (let i = 0; i < numToGain; i++) {
              await triggeredArgs.runGameActionDelegate('gainCard', {
                playerId: triggeredArgs.trigger.args.playerId,
                cardId: silverCards.slice(-i - 1)[0],
                to: { location: i === 0 ? 'playerDeck' : 'playerDiscard' }
              });
            }
          }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const copperCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'copper' }
      ]);
      
      const numToGain = Math.min(3, copperCards.length);
      
      console.log(`[beggar effect] gaining ${numToGain} coppers`);
      
      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: copperCards.slice(-i - 1)[0],
          to: { location: 'playerHand' }
        });
      }
    }
  },
  'catacombs': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        const { cost } = args.cardPriceController.applyRules(card, { playerId: eventArgs.playerId });
        const cheaperCards = args.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { kind: 'upTo', playerId: eventArgs.playerId, amount: { treasure: cost.treasure - 1 } },
        ]);
        
        if (!cheaperCards.length) {
          console.log(`[catacombs onTrashed effect] no cards costing less than ${cost.treasure - 1}`);
          return;
        }
        
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: cheaperCards.map(card => card.id),
          count: 1,
        });
        
        if (!selectedCardIds.length) {
          console.warn(`[catacombs onTrashed effect] no card selected`);
          return;
        }
        
        const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[catacombs onTrashed effect] gaining card ${selectedCard}`);
        
        await args.runGameActionDelegate('gainCard', {
          cardId: selectedCard.id,
          playerId: eventArgs.playerId,
          to: { location: 'playerDiscard' }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      let numToLookAt = 3;
      
      if (deck.length < 3) {
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        
        numToLookAt = Math.min(3, deck.length);
      }
      
      if (numToLookAt < 1) {
        console.log(`[catacombs effect] no cards in deck`);
        return;
      }
      
      const cardsToLookAt = deck.slice(-numToLookAt);
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'PUT IN HAND', action: 1 },
          { label: 'DISCARD AND DRAW', action: 2 }
        ],
        content: {
          type: 'display-cards',
          cardIds: cardsToLookAt
        }
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[catacombs effect] moving ${cardsToLookAt.length} cards to hand`);
        for (let i = 0; i < cardsToLookAt.length; i++) {
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: cardsToLookAt[i],
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' }
          });
        }
      }
      else {
        console.log(`[catacombs effect] discarding ${cardsToLookAt.length} cards`);
        for (let i = 0; i < cardsToLookAt.length; i++) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: cardsToLookAt[i],
            playerId: cardEffectArgs.playerId
          });
        }
        
        console.log(`[catacombs effect] drawing 3 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 3 });
      }
    }
  },
  'count': {
    registerEffects: () => async (cardEffectArgs) => {
      let result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DISCARD 2 CARDS', action: 1 },
          { label: 'TOP-DECK CARD', action: 2 },
          { label: 'GAIN 1 COPPER', action: 3 }
        ],
      }) as { action: number, result: number[] };
      
      switch (result.action) {
        case 1: {
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
          for (let i = 0; i < 2; i++) {
            const id = deck.slice(-1)[0];
            if (!id) {
              console.log(`[count effect] no cards in deck`);
              break;
            }
            
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: id,
              playerId: cardEffectArgs.playerId
            });
          }
          break;
        }
        case 2: {
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Top-deck card`,
            restrict: { location: 'playerHand', playerId: cardEffectArgs.playerId },
            count: 1,
          }) as CardId[];
          
          if (!selectedCardIds.length) {
            console.warn(`[count effect] no card selected`);
            break;
          }
          
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          
          console.log(`[count effect] moving ${selectedCard} to deck`);
          
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: selectedCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' }
          });
          break;
        }
        case 3: {
          const copperCards = cardEffectArgs.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'copper' }
          ]);
          if (!copperCards.length) {
            console.log(`[count effect] no coppers in supply`);
            break;
          }
          console.log(`[count effect] gaining 1 copper`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: copperCards.slice(-1)[0].id,
            to: { location: 'playerDiscard' }
          });
          break;
        }
      }
      
      result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: '+3 TREASURE', action: 1 },
          { label: 'TRASH HAND', action: 2 },
          { label: 'GAIN DUCHY', action: 3 }
        ],
      }) as { action: number, result: number[] };
      
      switch (result.action) {
        case 1: {
          console.log(`[count effect] gaining 3 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 3 });
          break;
        }
        case 2: {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          
          console.log(`[count effect] trashing ${hand.length} cards`);
          
          for (const cardId of [...hand]) {
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId
            });
          }
          break;
        }
        case 3: {
          const duchyCards = cardEffectArgs.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'duchy' }
          ]);
          if (!duchyCards.length) {
            console.log(`[count effect] no duchies in supply`);
            break;
          }
          console.log(`[count effect] gaining 1 duchy`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: duchyCards.slice(-1)[0],
            to: { location: 'playerDiscard' }
          });
          break;
        }
      }
    }
  },
  'counterfeit': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[counterfeit effect] gaining 1 treasure, and 1 buy`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      const nonDurationTreasureCards = cardEffectArgs.findCards([
        { location: 'playerHand', playerId: cardEffectArgs.playerId },
        { cardType: 'TREASURE' }
      ])
        .filter(card => !card.type.includes('DURATION'));
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play treasure`,
        restrict: nonDurationTreasureCards.map(card => card.id),
        count: 1,
        optional: true
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[counterfeit effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[counterfeit effect] playing card ${selectedCard} twice`);
      
      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.runGameActionDelegate('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          overrides: {
            actionCost: 0,
          }
        });
      }
    }
  },
  'cultist': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        console.log(`[cultist onTrashed effect] drawing 3 cards`);
        await args.runGameActionDelegate('drawCard', { playerId: eventArgs.playerId, count: 3 });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[cultist effect] drawing 2 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId,
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
      
      }
      
      const cultistsInHand = cardEffectArgs.findCards([
        { location: 'playerHand', playerId: cardEffectArgs.playerId },
        { cardKeys: 'cultist' }
      ]);
      
      if (!cultistsInHand.length) {
        console.log(`[cultist effect] no cultists in hand`);
        return;
      }
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Play Cultist?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 }, { label: 'PLAY', action: 2 }
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[cultist effect] cancelling play of cultist`);
        return;
      }
      
      console.log(`[cultist effect] playing cultist`);
      
      await cardEffectArgs.runGameActionDelegate('playCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cultistsInHand.slice(-1)[0].id,
        overrides: {
          actionCost: 0,
        }
      });
    }
  },
  'death-cart': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const ruinCards = args.findCards([
          { location: 'kingdomSupply' },
          { kingdom: 'ruins' }
        ]);
        
        const numToGain = Math.min(2, ruinCards.length);
        
        console.log(`[death cart onTrashed effect] gaining ${numToGain} ruins`);
        
        for (let i = 0; i < numToGain; i++) {
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: ruinCards.slice(-i - 1)[0],
            to: { location: 'playerDiscard' }
          });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card?`,
        restrict: [...hand, cardEffectArgs.cardId],
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[death cart effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[death cart effect] trashing card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
      
      console.log(`[death cart effect] gaining 5 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 5 });
    }
  },
  'feodum': {
    registerScoringFunction: () => (args) => {
      const ownedSilvers = args.findCards([
        { owner: args.ownerId },
        { cardKeys: 'silver' }
      ]);
      
      const amount = Math.floor(ownedSilvers.length / 3);
      return amount;
    },
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArg) => {
        const silverCards = args.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'silver' }
        ]);
        
        const numToGain = Math.min(3, silverCards.length);
        
        console.log(`[feodum onTrashed effect] gaining ${numToGain} silvers`);
        
        for (let i = 0; i < numToGain; i++) {
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArg.playerId,
            cardId: silverCards.slice(-i - 1)[0],
            to: { location: 'playerDiscard' }
          });
        }
      }
    })
  },
  'forager': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[forager effect] gaining 1 action, and 1 buy`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: hand,
        count: 1,
      }) as CardId[];
      
      if (selectedCardIds.length === 0) {
        console.log(`[forager effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[forager effect] trashing card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
      
      const uniqueTreasuresInTrash = new Set(
        hand.map(cardEffectArgs.cardLibrary.getCard)
          .filter(card => card.type.includes('TREASURE'))
          .map(card => card.cardKey)
      ).size;
      
      console.log(`[forager effect] gaining ${uniqueTreasuresInTrash} treasure`);
      
      if (uniqueTreasuresInTrash > 0) {
        await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: uniqueTreasuresInTrash });
      }
    }
  },
  'fortress': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        console.log(`[fortress onTrashed effect] putting fortress back in hand`);
        
        await args.runGameActionDelegate('moveCard', {
          cardId: eventArgs.cardId,
          toPlayerId: eventArgs.playerId,
          to: { location: 'playerHand' }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[fortress effect] drawing 1 card, and gaining 2 actions`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      
    }
  },
  'ruined-library': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[ruined library effect] drawing 1 card`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
    }
  },
  'ruined-market': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[ruined market effect] gaining 1 buy`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
    }
  },
  'ruined-village': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[ruined village effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: cardEffectArgs.playerId });
    }
  },
  'spoils': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[spoils effect] gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 3 });
      
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      
      console.log(`[spoils effect] moving ${thisCard} back to supply`);
      
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: cardEffectArgs.cardId,
        to: { location: 'nonSupplyCards' }
      });
    }
  },
  'survivors': {
    registerEffects: () => async (cardEffectArgs) => {
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (deck.length < 2) {
        console.log(`[survivors effect] deck is empty, shuffling`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
      }
      
      const numToLookAt = Math.min(2, deck.length);
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Discard or put back on deck?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'DISCARD', action: 1 },
          { label: 'PUT BACK', action: 2 }
        ],
        content: {
          type: 'display-cards',
          cardIds: deck.slice(-numToLookAt)
        }
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[survivors effect] discarding ${numToLookAt} cards`);
        for (let i = 0; i < numToLookAt; i++) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: deck.slice(-i - 1)[0],
            playerId: cardEffectArgs.playerId
          });
        }
      }
      else {
        console.log(`[survivors effect] putting back ${numToLookAt} cards`);
        
        if (numToLookAt > 1) {
          console.log(`[survivors effect] rearranging cards`);
          
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Rearrange',
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'rearrange',
              cardIds: deck.slice(-numToLookAt)
            }
          }) as { action: number, result: number[] };
          
          for (const cardId of result.result) {
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId: cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: { location: 'playerDeck' }
            });
          }
        }
        else {
          console.log(`[survivors effect] only one card to look at, it's already on top of deck`);
        }
      }
    }
  },
}

export default cardEffects;