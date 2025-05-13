import { Card, CardId, CardKey } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';

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
  'graverobber': {
    registerEffects: () => async (cardEffectArgs) => {
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'GAIN CARD', action: 1 },
          { label: 'TRASH CARD', action: 1 },
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        const trashCards = cardEffectArgs.findCards([
          { location: 'trash' },
        ])
          .filter(card => {
            const cost = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId });
            return cost.cost.treasure >= 3 && cost.cost.treasure <= 6;
          });
        
        if (!trashCards.length) {
          console.log(`[graverobber effect] no cards in trash`);
          return;
        }
        
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Gain one',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: trashCards.map(card => card.id),
            selectCount: 1
          }
        }) as { action: number, cardIds: number[] };
        
        if (!result.cardIds) {
          console.warn(`[graverobber effect] no card selected`);
          return;
        }
        
        const card = cardEffectArgs.cardLibrary.getCard(result.cardIds[0]);
        
        console.log(`[graverobber effect] gaining card ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: card.id,
          to: { location: 'playerDeck' }
        });
      }
      else {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const actionsInHand = hand.map(cardEffectArgs.cardLibrary.getCard)
          .filter(card => card.type.includes('ACTION'));
        
        if (!actionsInHand.length) {
          console.log(`[graverobber effect] no actions in hand`);
          return;
        }
        
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash action`,
          restrict: actionsInHand.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[graverobber effect] no card selected`);
          return;
        }
        
        let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[graverobber effect] trashing card ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });
        
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, { playerId: cardEffectArgs.playerId });
        
        const cards = cardEffectArgs.findCards([
          { location: ['kingdomSupply', 'basicSupply'] },
          { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: cost }
        ]);
        
        if (!cards.length) {
          console.log(`[graverobber effect] no cards in supply that cost <= ${cost.treasure}`);
          return;
        }
        
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[graverobber effect] no card selected`);
          return;
        }
        
        selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[graverobber effect] gaining ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'hermit': {
    registerEffects: () => async (cardEffectArgs) => {
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Trash from discard?',
        playerId: cardEffectArgs.playerId,
        content: {
          type: 'select',
          cardIds: discard,
          selectCount: {
            kind: 'upTo',
            count: 1
          }
        },
        actionButtons: [{ label: 'HAND', action: 1 }]
      }) as { action: number, result: number[] };
      
      let selectedCard: Card | undefined = undefined;
      if (result.action === 1) {
        console.log(`[hermit effect] not trashing from discard, selecting card from hand`);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 1,
          optional: true,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.log(`[hermit effect] not trashing from hand`);
        }
        else {
          selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        }
      }
      else {
        const selectedCardId = result.result[0];
        selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
      }
      
      if (!selectedCard) {
        console.log(`[hermit effect] no card selected`);
        return;
      }
      else {
        console.log(`[hermit effect] trashing card ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });
      }
      
      const cards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: 3 } }
      ]);
      
      if (!cards.length) {
        console.log(`[hermit effect] no cards in supply that cost <= 3`);
      }
      else {
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[hermit effect] no card selected`);
        }
        else {
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[hermit effect] gaining ${selectedCard}`);
          
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: { location: 'playerDiscard' }
          });
        }
      }
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `hermit:${cardEffectArgs.cardId}:endTurnPhase`,
        listeningFor: 'endTurnPhase',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: conditionArgs => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
          if (getCurrentPlayer(conditionArgs.match).id !== cardEffectArgs.playerId) return false;
          
          const cardIdsGained = conditionArgs.match.stats.cardsGainedByTurn[conditionArgs.match.turnNumber];
          
          const cardIdsGainedDuringBuyPhase = cardIdsGained.filter(cardId => {
            const stats = conditionArgs.match.stats.cardsGained[cardId];
            return stats.playerId === cardEffectArgs.playerId && stats.turnPhase === 'buy'
          });
          
          if (cardIdsGainedDuringBuyPhase.length > 0) return false;
          
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          const madmanCards = triggeredArgs.findCards([
            { location: 'nonSupplyCards' },
            { kingdom: 'madman' }
          ]);
          
          if (!madmanCards.length) {
            console.log(`[hermit endTurnPhase effect] no madman in supply`);
            return;
          }
          
          const hermitCard = triggeredArgs.cardLibrary.getCard(cardEffectArgs.cardId);
          
          console.log(`[hermit endTurnPhase effect] moving ${hermitCard} to supply`);
          
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: hermitCard.id,
            to: { location: 'kingdomSupply' }
          });
          const card = madmanCards.slice(-1)[0];
          
          console.log(`[hermit endTurnPhase effect] gaining ${card}`);
          
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: card.id,
            to: { location: 'playerDiscard' }
          });
        }
      })
    }
  },
  'hunting-grounds': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Choose to gain',
          playerId: eventArgs.playerId,
          actionButtons: [
            { label: '1 Duchy', action: 1 },
            { label: '3 Estates', action: 2 }
          ],
        }) as { action: number, result: number[] };
        
        let cards: Card[] = [];
        let numToGain = 0;
        if (result.action === 1) {
          cards = args.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'duchy' }
          ]);
          numToGain = Math.min(1, cards.length);
        }
        else {
          cards = args.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'estate' }
          ]);
          numToGain = Math.min(3, cards.length);
        }
        
        if (!numToGain) {
          console.log(`[hunting-grounds onTrashed effect] no cards to gain`);
        }
        
        console.log(`[hunting-grounds onTrashed effect] gaining ${numToGain} ${result.action === 1 ? 'duchy' : 'estate'}`);
        
        for (const card of cards) {
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: card.id,
            to: { location: 'playerDiscard' }
          });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[hunting-grounds effect] drawing 4 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 4 });
    }
  },
  'ironmonger': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[ironmonger effect] drawing 1 card, and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (deck.length === 0) {
        console.log(`[ironmonger effect] no cards in deck, shuffling`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        
        if (deck.length === 0) {
          console.log(`[ironmonger effect] still no cards in deck`);
          return;
        }
      }
      
      const card = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
      
      console.log(`[ironmonger effect] revealing ${card}`);
      
      await cardEffectArgs.runGameActionDelegate('revealCard', {
        cardId: card.id,
        playerId: cardEffectArgs.playerId,
        moveToSetAside: true
      });
      
      if (card.type.includes('ACTION')) {
        console.log(`[ironmonger effect] card is action type, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      }
      
      if (card.type.includes('TREASURE')) {
        console.log(`[ironmonger effect] card is treasure type, gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      }
      
      if (card.type.includes('VICTORY')) {
        console.log(`[ironmonger effect] card is a victory card, gaining 1 victory point`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      }
      
      console.log(`[ironmonger effect] moving revealed ${card} back to deck`);
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        cardId: card.id,
        toPlayerId: cardEffectArgs.playerId,
        to: { location: 'playerDeck' }
      });
    }
  },
  'junk-dealer': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[junk-dealer effect] drawing 1 card, and gaining 1 action and 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[junk-dealer effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[junk-dealer effect] trashing card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
    }
  },
  'marauder': {
    registerEffects: () => async (cardEffectArgs) => {
      const spoilCards = cardEffectArgs.findCards([
        { location: 'nonSupplyCards' },
        { kingdom: 'spoils' }
      ]);
      
      if (!spoilCards.length) {
        console.log(`[marauder effect] no spoils in supply`);
      }
      
      const ruinCards = cardEffectArgs.findCards([
        { location: 'kingdomSupply' },
        { kingdom: 'ruins' }
      ]);
      
      if (!ruinCards.length) {
        console.log(`[marauder effect] no ruins in supply`);
        return;
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      if (targetPlayerIds.length > ruinCards.length) {
        targetPlayerIds.length = ruinCards.length;
      }
      
      console.log(`[marauder effect] targeting ${targetPlayerIds.length} players to gain ruins`);
      
      for (const targetPlayerId of targetPlayerIds) {
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: targetPlayerId,
          cardId: ruinCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'market-square': {
    registerLifeCycleMethods: () => ({
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`market-square:${eventArgs.cardId}:cardTrashed`)
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `market-square:${eventArgs.cardId}:cardTrashed`,
          listeningFor: 'cardTrashed',
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: conditionArgs => {
            const trashedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (trashedCard.owner !== eventArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            const marketSquareCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);
            console.log(`[market-square cardTrashed effect] discarding ${marketSquareCard}`);
            await triggeredArgs.runGameActionDelegate('discardCard', {
              cardId: marketSquareCard.id,
              playerId: eventArgs.playerId
            });
            
            const goldCards = triggeredArgs.findCards([
              { location: 'basicSupply' },
              { cardKeys: 'gold' }
            ]);
            
            if (!goldCards.length) {
              console.log(`[market-square cardTrashed effect] no gold cards in supply`);
              return;
            }
            
            console.log(`[market-square cardTrashed effect] gaining ${goldCards.slice(-1)[0]}`);
            
            await triggeredArgs.runGameActionDelegate('gainCard', {
              playerId: eventArgs.playerId,
              cardId: goldCards.slice(-1)[0].id,
              to: { location: 'playerDiscard' }
            });
          }
        })
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[market-square effect] drawing 1 card, gaining 1 action, and 1 buy`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
    }
  },
  'mystic': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[mystic effect] gaining 1 action, and 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' }
      }) as { action: number, result: CardKey };
      
      const namedCardKey = result.result;
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (!deck.length) {
        console.log(`[mystic effect] no cards in deck, shuffling`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        
        if (!deck.length) {
          console.log(`[mystic effect] still no cards in deck`);
          return;
        }
      }
      
      const revealedCard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
      
      console.log(`[mystic effect] revealing ${revealedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('revealCard', {
        cardId: revealedCard.id,
        playerId: cardEffectArgs.playerId,
      });
      
      if (revealedCard.cardKey === namedCardKey) {
        console.log(`[mystic effect] moving revealed card to hand`);
        
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: revealedCard.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerHand' }
        });
      }
      else {
        console.log(`[mystic effect] not moving card to hand`);
      }
    }
  },
  'pillage': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[pillage effect] trashing pillage`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardEffectArgs.cardId,
      });
      
      const spoilsCards = cardEffectArgs.findCards({ kingdom: 'spoils' });
      
      if (!spoilsCards.length) {
        console.log(`[pillage effect] no spoils in supply`);
        return;
      }
      
      const numToGain = Math.min(2, spoilsCards.length);
      
      console.log(`[pillage effect] gaining ${numToGain} spoils`);
      
      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: spoilsCards.slice(-i - 1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId =>
        cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity' &&
        cardEffectArgs.cardSourceController.getSource('playerHand', playerId).length >= 5
      );
      
      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        
        console.log(`[pillage effect] revealing player ${targetPlayerId} hand`);
        for (const cardId of [...hand]) {
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId,
            playerId: targetPlayerId,
          });
        }
        
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Discard card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: hand,
            selectCount: 1
          }
        }) as { action: number, result: number[] };
        
        if (!result.result.length) {
          console.warn(`[pillage effect] no card selected`);
          continue;
        }
        
        const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
        
        console.log(`[pillage effect] player ${targetPlayerId} discarding ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCard.id,
          playerId: targetPlayerId
        });
      }
    }
  },
  'poor-house': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[poor-house effect] gaining 4 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 4 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      console.log(`[poor-house effect] revealing player ${cardEffectArgs.playerId} hand`);
      
      for (const cardId of [...hand]) {
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId,
        });
      }
      
      const treasureCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));
      
      console.log(`[poor-house effect] losing ${treasureCardsInHand.length} treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: -treasureCardsInHand.length });
    }
  },
  'procession': {
    registerEffects: () => async (cardEffectArgs) => {
      const nonDurationActionCardsInHand = cardEffectArgs.findCards([
        { location: 'playerHand', playerId: cardEffectArgs.playerId },
      ])
        .filter(card => !card.type.includes('DURATION') && card.type.includes('ACTION'));
      
      if (!nonDurationActionCardsInHand.length) {
        console.log(`[procession effect] no non-duration action cards in hand`);
        return;
      }
      
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play card`,
        restrict: nonDurationActionCardsInHand.map(card => card.id),
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[procession effect] no card selected`);
        return;
      }
      
      let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[procession effect] playing card ${selectedCard} twice`);
      
      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.runGameActionDelegate('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
        });
      }
      
      console.log(`[procession effect] trashing ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
      
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, { playerId: cardEffectArgs.playerId });
      
      const cards = cardEffectArgs.findCards([
        { location: 'kingdomSupply' },
        {
          kind: 'exact',
          playerId: cardEffectArgs.playerId,
          amount: { treasure: cost.treasure + 1, potion: cost.potion }
        }
      ]);
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cards.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[procession effect] no card selected`);
        return;
      }
      
      selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[procession effect] gaining card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'rats': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const trashedCard = args.cardLibrary.getCard(eventArgs.cardId);
        if (args.match.stats.trashedCards[eventArgs.cardId].playerId !== trashedCard.owner) {
          return;
        }
        
        console.log(`[rats onTrashed effect] drawing 1 card`);
        await args.runGameActionDelegate('drawCard', { playerId: eventArgs.playerId });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[rats effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const ratCards = cardEffectArgs.findCards([
        { location: 'kingdomSupply' },
        { cardKeys: 'rats' }
      ]);
      
      if (!ratCards.length) {
        console.log(`[rats effect] no rats in supply to gain`);
      }
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      const nonRatCardsInHand = hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.cardKey !== 'rats');
      
      if (!nonRatCardsInHand.length) {
        console.log(`[rats effect] no non-rat cards in hand to trash, revealing`);
        
        for (const cardId of [...hand]) {
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId,
            playerId: cardEffectArgs.playerId,
          });
        }
        
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Trash card',
        restrict: nonRatCardsInHand.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[rats effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[rats effect] trashing card ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id,
      });
    }
  },
  'rebuild': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[rebuild effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Name a card',
        playerId: cardEffectArgs.playerId,
        content: { type: 'name-card' }
      }) as { action: number, result: CardKey };
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      let cardFound: Card | undefined = undefined;
      const cardsToDiscard: Card[] = [];
      
      while (!cardFound) {
        let cardId = deck.slice(-1)[0];
        
        if (!cardId) {
          console.log(`[rebuild effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
          
          cardId = deck.slice(-1)[0];
          
          if (!cardId) {
            console.log(`[rebuild effect] still no cards in deck`);
            break;
          }
        }
        
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        
        console.log(`[rebuild effect] revealing ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
        });
        
        if (card.type.includes('VICTORY') && card.cardKey !== result.result) {
          cardFound = card;
          break;
        }
        else {
          cardsToDiscard.push(card);
        }
      }
      
      console.log(`[rebuild effect] discarding ${cardsToDiscard.length} cards`);
      
      for (const card of cardsToDiscard) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
      }
      
      if (cardFound) {
        console.log(`[rebuild effect] trashing ${cardFound}`);
        
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardFound.id,
        });
        
        const { cost } = cardEffectArgs.cardPriceController.applyRules(cardFound, { playerId: cardEffectArgs.playerId });
        
        const cards = cardEffectArgs.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { cardType: 'VICTORY' },
          {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: { treasure: cost.treasure + 3, potion: cost.potion }
          }
        ]);
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[rebuild effect] no card selected`);
          return;
        }
        
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[rebuild effect] gaining card ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'rogue': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[rogue effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const cards = cardEffectArgs.findCards({ location: 'trash' })
        .filter(card => {
          const { cost } = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId });
          return cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion
        });
      
      if (cards.length) {
        console.log(`[rogue effect] there are cards in trash costing 3 to 6`);
        
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Gain card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: cards.map(card => card.id),
            selectCount: 1
          }
        }) as { action: number, result: number[] };
        
        if (!result.result.length) {
          console.warn(`[rogue effect] no card selected`);
          return;
        }
        
        const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
        
        console.log(`[rogue effect] gaining card ${selectedCard}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' }
        });
      }
      else {
        console.log(`[rogue effect] no cards in trash costing 3 to 6`);
        
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        
        for (const targetPlayerId of targetPlayerIds) {
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
          
          if (deck.length < 2) {
            console.log(`[rogue effect] player ${targetPlayerId} has less than 2 cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: targetPlayerId });
          }
          
          const numToReveal = Math.min(2, deck.length);
          
          console.log(`[rogue effect] revealing ${numToReveal} cards from player ${targetPlayerId} deck`);
          
          const cardsToTrash: Card[] = [];
          const cardsToDiscard: Card[] = [];
          
          for (let i = 0; i < numToReveal; i++) {
            const cardId = deck.slice(-i - 1)[0];
            
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, { playerId: targetPlayerId });
            
            if (cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion) {
              cardsToTrash.push(card);
            }
            else {
              cardsToDiscard.push(card);
            }
            
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
          }
          
          let cardToTrash: Card | undefined = undefined;
          if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map(card => card.id),
                selectCount: 1
              }
            }) as { action: number, result: number[] };
            
            if (!result.result.length) {
              console.warn(`[rogue effect] no card selected`);
            }
            else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
            }
          }
          else if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          }
          
          if (cardToTrash) {
            console.log(`[rogue effect] trashing card ${cardToTrash}`);
            
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id,
            });
          }
          
          console.log(`[rogue effect] discarding ${cardsToDiscard.length} cards`);
          
          for (const card of cardsToDiscard) {
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: cardEffectArgs.playerId
            });
          }
        }
      }
    }
  },
  'sage': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[sage effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      const cardsToDiscard: Card[] = [];
      
      while (deck.length > 0) {
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        
        console.log(`[sage effect] revealing ${card}`);
        
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId,
          moveToSetAside: true
        });
        
        const { cost } = cardEffectArgs.cardPriceController.applyRules(card, { playerId: cardEffectArgs.playerId });
        if (cost.treasure >= 3) {
          console.log(`[sage effect] ${card} costs at least 3 treasure, putting in hand`);
          
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerHand' }
          });
          
          break;
        }
        else {
          cardsToDiscard.push(card);
        }
      }
      
      console.log(`[sage effect] discarding ${cardsToDiscard.length} cards`);
      
      for (const card of cardsToDiscard) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
      }
    }
  },
  'scavenger': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[scavenger effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      let result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Put deck onto discard?',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'CONFIRM', action: 2 }
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 2) {
        console.log(`[scavenger effect] putting deck onto discard`);
        
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        
        for (const cardId of [...deck]) {
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDiscard' }
          });
        }
      }
      
      const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
      
      if (discard.length) {
        result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Put card on top of deck',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'select',
            cardIds: discard,
            selectCount: 1
          }
        }) as { action: number, result: number[] };
        
        if (!result.result.length) {
          console.warn(`[scavenger effect] no card selected`);
          return;
        }
        
        const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
        
        console.log(`[scavenger effect] putting ${selectedCard} on top of deck`);
        
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: selectedCard.id,
          toPlayerId: cardEffectArgs.playerId,
          to: { location: 'playerDeck' }
        });
      }
      else {
        console.log(`[scavenger effect] no cards in discard`);
      }
    }
  },
  'squire': {
    registerLifeCycleMethods: () => ({
      onTrashed: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        if (eventArgs.playerId != card.owner) {
          return;
        }
        
        const attackCards = args.findCards([
          { location: 'kingdomSupply' },
          { cardType: 'ACTION' }
        ]);
        
        if (!attackCards.length) {
          console.log(`[squire onTrashed effect] no attack cards in supply`);
          return;
        }
        
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: attackCards.map(card => card.id),
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[squire onTrashed effect] no card selected`);
          return;
        }
        
        const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[squire onTrashed effect] gaining ${selectedCard}`);
        
        await args.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: selectedCard.id,
          to: { location: 'playerDiscard' }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[squire effect] gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        prompt: 'Choose one',
        playerId: cardEffectArgs.playerId,
        actionButtons: [
          { label: '+2 ACTIONS', action: 1 },
          { label: '+2 BUYS', action: 2 },
          { label: 'GAIN 1 SILVER', action: 3 }
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[squire effect] gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
      }
      else if (result.action === 2) {
        console.log(`[squire effect] gaining 2 buys`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 2 });
      }
      else {
        console.log(`[squire effect] gaining 1 silver`);
        const silverCards = cardEffectArgs.findCards([
          { location: 'basicSupply' },
          { cardKeys: 'silver' }
        ]);
        
        if (!silverCards.length) {
          console.log(`[squire effect] no silver cards in supply`);
          return;
        }
        
        console.log(`[squire effect] gaining ${silverCards.slice(-1)[0]}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCards.slice(-1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
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