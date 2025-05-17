import { Card, CardId, CardKey } from 'shared/shared-types.ts';
import {
  CardEffectFunctionContext,
  CardExpansionModule,
  CardLifecycleCallbackContext,
  CardLifecycleEventArgMap
} from '../../types.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { context } from 'npm:esbuild@0.25.1';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { shuffle } from 'es-toolkit/compat';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';

const addTravellerEffect = async (card: Card, travelTo: CardKey, context: CardLifecycleCallbackContext, eventArgs: CardLifecycleEventArgMap['onDiscarded']) => {
  if (!isLocationInPlay(eventArgs.previousLocation?.location)) {
    return;
  }
  
  const newCards = context.findCards([
    { location: ['basicSupply', 'kingdomSupply'] },
    { cardKeys: travelTo }
  ]);
  
  if (!newCards.length) {
    console.log(`[${card.cardKey} onDiscarded effect] no ${travelTo} cards in supply`);
    return;
  }
  
  const newCard = newCards.slice(-1)[0];
  
  const result = await context.runGameActionDelegate('userPrompt', {
    playerId: eventArgs.playerId,
    prompt: `Exchange ${card.cardName} for ${newCard.cardName}?`,
    actionButtons: [
      { label: 'CANCEL', action: 1 },
      { label: 'EXCHANGE', action: 2 }
    ],
  }) as { action: number, result: number[] };
  
  if (result.action === 1) {
    console.log(`[${card.cardKey} onDiscarded effect] user chose not to exchange`);
    return;
  }
  
  console.log(`[${card.cardKey} onDiscarded effect] moving ${card} back to supply`);
  
  await context.runGameActionDelegate('moveCard', {
    cardId: card.id,
    to: { location: 'kingdomSupply' }
  });
  
  console.log(`[${card.cardKey} onDiscarded effect] moving ${newCard} to discard pile`);
  
  await context.runGameActionDelegate('moveCard', {
    toPlayerId: eventArgs.playerId,
    cardId: newCard.id,
    to: { location: 'playerDiscard' }
  });
}

export const addDurationEffect = (card: Card, context:CardEffectFunctionContext) => {
  
}

const expansion: CardExpansionModule = {
  'amulet': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`amulet:${eventArgs.cardId}:startTurn`)
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const actions = [
        { label: '+1 TREASURE', action: 1 },
        { label: 'TRASH A CARD', action: 2 },
        { label: 'GAIN A SILVER', action: 3 }
      ];
      
      const decision = async () => {
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one',
          actionButtons: actions,
        }) as { action: number, result: number[] };
        
        if (result.action === 1) {
          console.log(`[amulet effect] gaining 1 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
        }
        else if (result.action === 2) {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: hand,
            count: 1,
          }) as CardId[];
          
          if (!selectedCardIds.length) {
            console.log(`[amulet effect] no card selected`);
          }
          else {
            const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
            
            console.log(`[amulet effect] selected ${cardToTrash} to trash`);
            
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToTrash.id
            });
          }
        }
        else {
          const silverCards = cardEffectArgs.findCards([
            { location: 'basicSupply' },
            { cardKeys: 'silver' }
          ]);
          
          if (!silverCards.length) {
            console.log(`[amulet effect] no silver cards in supply`);
          }
          else {
            const silverCardToGain = silverCards.slice(-1)[0];
            
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: silverCardToGain.id,
              to: { location: 'playerDiscard' }
            });
          }
        }
      }
      
      await decision();
      
      const turnPlayed = cardEffectArgs.match.turnNumber;
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `amulet:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.log(`[amulet startTurn effect] re-running decision fn`);
          await decision();
        }
      })
    }
  },
  'artificer': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[artificer effect] drawing 1 card, gaining 1 action and 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard cards?`,
        restrict: hand,
        count: { kind: 'upTo', count: hand.length },
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[artificer effect] no cards selected`);
        return;
      }
      
      console.log(`[artificer effect] selected ${selectedCardIds.length} cards to discard`);
      
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardId
        });
      }
      
      const cardsToSelect = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { kind: 'upTo', playerId: cardEffectArgs.playerId, amount: { treasure: (selectedCardIds.length ?? 0) } }
      ]);
      
      if (!cardsToSelect.length) {
        console.log(`[artificer effect] no cards in supply costing ${selectedCardIds.length ?? 0} treasure`);
        return;
      }
      
      selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain card`,
        restrict: cardsToSelect.map(card => card.id),
        count: 1,
        optional: true
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[artificer effect] no card selected`);
        return;
      }
      
      const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[artificer effect] selected ${cardToGain} to gain`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToGain.id,
        to: { location: 'playerDeck' }
      });
    }
  },
  'caravan-guard': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`caravan-guard:${eventArgs.cardId}:startTurn`);
      },
      onLeaveHand: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`caravan-guard:${eventArgs.cardId}:cardPlayed`);
      },
      onEnterHand: async (args, eventArgs) => {
        args.reactionManager.registerReactionTemplate({
          id: `caravan-guard:${eventArgs.cardId}:cardPlayed`,
          listeningFor: 'cardPlayed',
          playerId: eventArgs.playerId,
          once: false,
          compulsory: false,
          allowMultipleInstances: true,
          condition: async conditionArgs => {
            if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
            const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!cardPlayed.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async triggeredArgs => {
            console.log(`[caravan-guard cardPlayed effect] playing Caravan Guard`);
            
            await triggeredArgs.runGameActionDelegate('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId
            })
          }
        });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[caravan-guard effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const turnPlayed = cardEffectArgs.match.turnNumber;
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `caravan-guard:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.log(`[caravan-guard startTurn effect] gaining 1 treasure`);
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: 1 });
        }
      });
    }
  },
  'disciple': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'teacher', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      const actionCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('ACTION'));
      
      if (!actionCardsInHand.length) {
        console.log(`[disciple effect] no action cards in hand`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Play action card`,
        restrict: actionCardsInHand.map(card => card.id),
        count: 1,
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[disciple effect] no card selected`);
        return;
      }
      
      const selectedCardToPlay = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[disciple effect] playing ${selectedCardToPlay} twice`);
      
      for (let i = 0; i < 2; i++) {
        await cardEffectArgs.runGameActionDelegate('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardToPlay.id,
          overrides: {
            actionCost: 0,
          }
        });
      }
      
      const copies = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardKeys: selectedCardToPlay.cardKey }
      ]);
      
      if (!copies.length) {
        console.log(`[disciple effect] no copies of ${selectedCardToPlay} in supply`);
        return;
      }
      
      console.log(`[disciple effect] gaining ${selectedCardToPlay}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: copies.slice(-1)[0],
        to: { location: 'playerDiscard' }
      });
    }
  },
  'dungeon': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`dungeon:${eventArgs.cardId}:startTurn`);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[dungeon effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const effects = async () => {
        console.log(`[dungeon effect] and drawing 2 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 2,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.log(`[dungeon effect] no cards selected`);
          return;
        }
        
        console.log(`[dungeon effect] discarding ${selectedCardIds.length} cards`);
        
        for (const selectedCardId of selectedCardIds) {
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId
          });
        }
      }
      
      const turnPlayed = cardEffectArgs.match.turnNumber;
      
      await effects();
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `dungeon:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.log(`[dungeon startTurn effect] running`);
          await effects();
        }
      })
    }
  },
  'fugitive': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'disciple', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[fugitive effect] drawing 2 cards and gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Discard card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[fugitive effect] no card selected`);
        return;
      }
      
      const cardToDiscard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[fugitive effect] discarding ${cardToDiscard}`);
      
      await cardEffectArgs.runGameActionDelegate('discardCard', {
        playerId: cardEffectArgs.playerId,
        cardId: cardToDiscard.id
      });
    }
  },
  'gear': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`gear:${eventArgs.cardId}:startTurn`);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Set aside cards`,
        restrict: hand,
        count: {
          kind: 'upTo',
          count: Math.min(2, hand.length)
        },
        optional: true,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.log(`[gear effect] no cards selected`);
        return;
      }
      
      console.log(`[gear effect] set aside ${selectedCardIds.length} cards`);
      
      for (const selectedCardId of selectedCardIds) {
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: selectedCardId,
          to: { location: 'set-aside' }
        });
      }
      
      const turnPlayed = cardEffectArgs.match.turnNumber;
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `gear:${cardEffectArgs.cardId}:startTurn`,
        playerId: cardEffectArgs.playerId,
        listeningFor: 'startTurn',
        once: true,
        allowMultipleInstances: true,
        compulsory: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.log(`[gear startTurn effect] moving ${selectedCardIds.length} to hand`);
          
          for (const selectedCardId of selectedCardIds) {
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId: selectedCardId,
              to: { location: 'playerHand' }
            });
          }
        }
      })
    }
  },
  'haunted-woods': {
    registerLifeCycleMethods: () => ({
      onLeavePlay: async (args, eventArgs) => {
        args.reactionManager.unregisterTrigger(`haunted-woods:${eventArgs.cardId}:startTurn`);
        args.reactionManager.unregisterTrigger(`haunted-woods:${eventArgs.cardId}:cardGained`);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      const turnPlayed = cardEffectArgs.match.turnNumber;
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `haunted-woods:${cardEffectArgs.cardId}:cardGained`,
        listeningFor: 'cardGained',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) return false;
          if (!conditionArgs.trigger.args.bought) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          const triggeringPlayerId = triggeredArgs.trigger.args.playerId;
          console.log(`[haunted-woods cardGained effect] player ${triggeringPlayerId} rearranging hand and top-decking`);
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', triggeringPlayerId);
          const result = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: triggeringPlayerId,
            prompt: 'Rearrange hand to put on deck',
            actionButtons: [{ label: 'DONE', action: 1 }],
            content: {
              type: 'rearrange',
              cardIds: hand,
            }
          }) as { action: number, result: number[] };
          
          if (!result.result.length) {
            console.warn(`[haunted-woods cardGained effect] no cards rearranged`);
            return;
          }
          
          console.warn(`[haunted-woods cardGained effect] moving ${result.result.length} cards to deck`);
          
          for (const cardId of result.result) {
            await triggeredArgs.runGameActionDelegate('moveCard', {
              toPlayerId: triggeringPlayerId,
              cardId,
              to: { location: 'playerDeck' }
            });
          }
        }
      });
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `haunted-woods:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: true,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          triggeredArgs.reactionManager.unregisterTrigger(`haunted-woods:${cardEffectArgs.cardId}:cardGained`);
          await triggeredArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
        }
      })
    }
  },
  'hero': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'champion', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[hero effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const treasureCards = cardEffectArgs.findCards([
        { location: ['basicSupply', 'kingdomSupply'] },
        { cardType: 'TREASURE' }
      ]);
      
      if (!treasureCards.length) {
        console.log(`[hero effect] no treasure cards in supply`);
        return;
      }
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Gain treasure`,
        restrict: treasureCards.map(card => card.id),
        count: 1,
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[hero effect] no card selected`);
        return;
      }
      
      const selectedCardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[hero effect] gaining ${selectedCardToGain}`);
      
      await cardEffectArgs.runGameActionDelegate('gainCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCardToGain.id,
        to: { location: 'playerDiscard' }
      });
    }
  },
  'hireling': {
    registerEffects: () => async (cardEffectArgs) => {
      const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
      // await addDurationEffect(thisCard, cardEffectArgs);
      
      
      // todo: how to do duration cards that last different amounts of time.
      // 1: set up "compulsory system events" that hook into normal reaction system, and these events
      // are compulsory but the player is not asked about them, they just happen. then the cards themselves
      // can control when they move around.
      
      // 2: set up a system for reaction type cards to register when they are removed and let the system remove them
      
      cardEffectArgs.reactionManager.registerReactionTemplate({
        id: `hireling:${cardEffectArgs.cardId}:startTurn`,
        listeningFor: 'startTurn',
        playerId: cardEffectArgs.playerId,
        once: false,
        compulsory: true,
        allowMultipleInstances: true,
        condition: async conditionArgs => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
          if (conditionArgs.trigger.args.turnNumber === conditionArgs.match.turnNumber) return false;
          return true;
        },
        triggeredEffectFn: async triggeredArgs => {
          console.log(`[hireling startTurn effect] drawing 1 card`);
          await triggeredArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
        }
      })
    }
  },
  'lost-city': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const targetPlayerIds = findOrderedTargets({
          match: args.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: eventArgs.playerId
        });
        
        for (const targetPlayerId of targetPlayerIds) {
          console.log(`[lost-city onGained effect] ${targetPlayerId} drawing 1 card`);
          await args.runGameActionDelegate('drawCard', { playerId: targetPlayerId });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    }
  },
  'magpie': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[magpie effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (deck.length) {
        console.log(`[magpie effect] no cards in deck, shuffling deck`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        
        if (!deck.length) {
          console.log(`[magpie effect] still no cards in deck, no cards to reveal`);
          return;
        }
      }
      
      const revealedCard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
      
      console.log(`[magpie effect] revealing ${revealedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('revealCard', {
        playerId: cardEffectArgs.playerId,
        cardId: revealedCard,
        moveToSetAside: true
      });
      
      if (revealedCard.type.includes('TREASURE')) {
        console.log(`[magpie effect] treasure revealed, moving revealed card to hand`);
        
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: revealedCard.id,
          to: { location: 'playerHand' }
        });
      }
      else if (revealedCard.type.some(t => ['ACTION', 'VICTORY'].includes(t))) {
        console.log(`[magpie effect] action or victory revealed, gaining magpie`);
        
        const magpieCards = cardEffectArgs.findCards([
          { location: 'kingdomSupply' },
          { cardKeys: 'magpie' }
        ]);
        
        if (!magpieCards.length) {
          console.log(`[magpie effect] no magpie cards in supply`);
          return;
        }
        
        const magPieToGain = magpieCards.slice(-1)[0];
        
        console.log(`[magpie effect] gaining ${magPieToGain}`);
        
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: magPieToGain.id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'messenger': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const stats = args.match.stats;
        if (stats.cardsGained?.[eventArgs.cardId]?.turnPhase !== 'buy') {
          return;
        }
        
        const cardsGainedThisTurnBuyPhase =
          stats.cardsGainedByTurn?.[args.match.turnNumber]
            ?.filter(cardId => stats.cardsGained[cardId].playerId === eventArgs.playerId && stats.cardsGained[cardId].turnPhase === 'buy')
            ?.length ?? 0;
        
        if (cardsGainedThisTurnBuyPhase !== 1) {
          console.log(`[messenger onGained effect] player ${eventArgs.playerId} gained more than 1 card in buy phase`);
          return;
        }
        
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: eventArgs.playerId,
          prompt: `Gain card`,
          restrict: [{ location: ['basicSupply', 'kingdomSupply'] }, {
            kind: 'upTo',
            playerId: eventArgs.playerId,
            amount: { treasure: 4 }
          }],
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[messenger onGained effect] no card selected`);
          return;
        }
        
        const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[messenger onGained effect] selected ${selectedCard}`);
        
        const copies = args.findCards([
          { location: ['basicSupply', 'kingdomSupply'] },
          { cardKeys: selectedCard.cardKey }
        ]);
        
        const targetPlayerIds = findOrderedTargets({
          match: args.match,
          appliesTo: 'ALL',
          startingPlayerId: eventArgs.playerId
        });
        
        targetPlayerIds.length = Math.min(targetPlayerIds.length, copies.length);
        
        for (let i = 0; i < targetPlayerIds.length; i++) {
          console.log(`[messenger onGained effect] gaining ${copies.slice(-i - 1)[0]} to ${targetPlayerIds[i]}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: targetPlayerIds[i],
            cardId: copies.slice(-i - 1)[0].id,
            to: { location: 'playerDiscard' }
          });
        }
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[messenger effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Put deck into your discard?',
        actionButtons: [
          { label: 'CANCEL', action: 1 },
          { label: 'PUT IN DISCARD', action: 2 }
        ],
      }) as { action: number, result: number[] };
      
      if (result.action === 1) {
        console.log(`[messenger effect] user cancelled`);
        return;
      }
      else {
        console.log(`[messenger effect] putting deck into discard`);
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        
        for (const cardId of [...deck]) {
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId,
            to: { location: 'playerDiscard' }
          });
        }
      }
    }
  },
  'page': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'treasure-hunter', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[page effect] drawing 1 card, gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
    }
  },
  'peasant': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'soldier', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[peasant effect] gaining 1 buy, and 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainBuy', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
    }
  },
  'port': {
    registerLifeCycleMethods: () => ({
      onGained: async (args, eventArgs) => {
        const portCards = args.findCards([
          { location: 'kingdomSupply' },
          { cardKeys: 'port' }
        ]);
        
        if (!portCards.length) {
          console.log(`[port onGained effect] no port cards in supply`);
          return;
        }
        
        const portToGain = portCards.slice(-1)[0];
        
        console.log(`[port onGained effect] gaining ${portToGain}`);
        
        await args.runGameActionDelegate('gainCard', {
          playerId: eventArgs.playerId,
          cardId: portToGain.id,
          to: { location: 'playerDiscard' }
        }, { suppressLifeCycle: { events: ['onGained'] } });
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[port effect] drawing 1 card, gaining 2 action`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 2 });
    }
  },
  'raze': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[raze effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
        playerId: cardEffectArgs.playerId,
        prompt: `Trash a card`,
        restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
          .concat(cardEffectArgs.cardId),
        count: 1
      }) as CardId[];
      
      if (!selectedCardIds.length) {
        console.warn(`[raze effect] no card selected`);
        return;
      }
      
      const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
      
      console.log(`[raze effect] trashing ${selectedCard}`);
      
      await cardEffectArgs.runGameActionDelegate('trashCard', {
        playerId: cardEffectArgs.playerId,
        cardId: selectedCard.id
      });
      
      const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, { playerId: cardEffectArgs.playerId });
      
      const numToLookAt = cost.treasure;
      
      if (numToLookAt === 0) {
        console.log(`[raze effect] cost is 0, not looking at deck`);
        return;
      }
      
      const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
      
      if (deck.length === 0) {
        console.log(`[raze effect] deck is empty, shuffling deck`);
        await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
        
        if (deck.length === 0) {
          console.log(`[raze effect] still empty, no cards to look at`);
          return;
        }
      }
      
      const lookingAtCards: Card[] = [];
      
      for (let i = 0; i < numToLookAt; i++) {
        const cardToLookAt = cardEffectArgs.cardLibrary.getCard(deck.slice(-i - 1)[0]);
        
        console.log(`[raze effect] looking at ${cardToLookAt}`);
        
        lookingAtCards.push(cardToLookAt);
        
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardToLookAt.id,
          to: { location: 'set-aside' }
        });
      }
      
      const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
        playerId: cardEffectArgs.playerId,
        prompt: 'Choose one to put in hand',
        actionButtons: [
          { label: 'DONE', action: 1 }
        ],
        content: {
          type: 'select',
          cardIds: lookingAtCards.map(card => card.id),
          selectCount: 1
        }
      }) as { action: number, result: number[] };
      
      if (!result.result.length) {
        console.warn(`[raze effect] no card selected`);
        return;
      }
      
      const selectedCardToPutInHand = cardEffectArgs.cardLibrary.getCard(result.result[0]);
      
      console.log(`[raze effect] putting ${selectedCardToPutInHand} in hand`);
      
      await cardEffectArgs.runGameActionDelegate('moveCard', {
        toPlayerId: cardEffectArgs.playerId,
        cardId: selectedCardToPutInHand.id,
        to: { location: 'playerHand' }
      });
      
      console.log(`[raze effect] discarding ${lookingAtCards.length - 1} cards`);
      
      for (const lookingAtCard of lookingAtCards) {
        if (lookingAtCard.id === selectedCardToPutInHand.id) continue;
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: lookingAtCard.id
        });
      }
    }
  },
  'soldier': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'fugitive', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[soldier effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const attacksInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.owner === cardEffectArgs.playerId && card.type.includes('ATTACK'));
      
      if (attacksInPlay.length > 0) {
        console.log(`[soldier effect] ${attacksInPlay.length} attacks in play, gaining that much treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: attacksInPlay.length });
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
        return cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity' && hand.length >= 4;
      });
      
      for (const targetPlayerId of targetPlayerIds) {
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: targetPlayerId,
          prompt: `Discard card`,
          restrict: hand,
          count: 1,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.warn(`[soldier effect] no card selected`);
          continue;
        }
        
        const cardToDiscard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[soldier effect] player ${targetPlayerId} discarding ${cardToDiscard}`);
        
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: targetPlayerId,
          cardId: cardToDiscard.id
        });
      }
    }
  },
  'storyteller': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[storyteller effect] gaining 1 action`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      
      const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
      let treasuresInHand = hand
        .map(cardEffectArgs.cardLibrary.getCard)
        .filter(card => card.type.includes('TREASURE'));
      
      const numCanPlay = Math.min(3, treasuresInHand.length);
      
      for (let i = 0; i < numCanPlay; i++) {
        treasuresInHand = hand
          .map(cardEffectArgs.cardLibrary.getCard)
          .filter(card => card.type.includes('TREASURE'));
        
        if (!treasuresInHand.length) {
          console.log(`[storyteller effect] no treasures in hand`);
          break;
        }
        
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play treasure ${i + 1} of ${numCanPlay}?`,
          restrict: treasuresInHand.map(card => card.id),
          count: 1,
          optional: true,
        }) as CardId[];
        
        if (!selectedCardIds.length) {
          console.log(`[storyteller effect] no treasure selected`);
          break;
        }
        
        const selectedToPlay = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        
        console.log(`[storyteller effect] playing ${selectedToPlay}`);
        
        await cardEffectArgs.runGameActionDelegate('playCard', {
          cardId: selectedCardIds[0],
          playerId: cardEffectArgs.playerId
        })
      }
      
      console.log(`[storyteller effect] drawing 1 card`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId });
      
      const playerTreasure = cardEffectArgs.match.playerTreasure;
      
      if (playerTreasure === 0) {
        console.log(`[storyteller effect] no player treasure, not drawing more cards`);
        return;
      }
      
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: -playerTreasure }, { loggingContext: { suppress: true } });
      
      console.log(`[storyteller effect] drawing ${playerTreasure} cards`);
      
      await cardEffectArgs.runGameActionDelegate('drawCard', {
        playerId: cardEffectArgs.playerId,
        count: playerTreasure
      });
    }
  },
  'treasure-hunter': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'warrior', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[treasure-hunter effect] gaining 1 action, gaining 1 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainAction', { count: 1 });
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 1 });
      
      const silverCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: 'silver' }
      ]);
      
      if (!silverCards.length) {
        console.log(`[treasure-hunter effect] no silver cards in supply`);
        return;
      }
      
      const rightPlayer = getPlayerStartingFrom({
        startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
        match: cardEffectArgs.match,
        distance: -1
      });
      
      const cardsGained = cardEffectArgs.match.stats.cardsGainedByTurn?.[cardEffectArgs.match.turnNumber]
        ?.map(cardEffectArgs.cardLibrary.getCard)
        ?.filter(card => card.owner === rightPlayer.id) ?? [];
      
      const numToGain = Math.min(silverCards.length, cardsGained.length);
      
      for (let i = 0; i < numToGain; i++) {
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: silverCards.slice(-i - 1)[0].id,
          to: { location: 'playerDiscard' }
        });
      }
    }
  },
  'treasure-trove': {
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[treasure-trove effect] gaining 2 treasure`);
      await cardEffectArgs.runGameActionDelegate('gainTreasure', { count: 2 });
      
      const goldAndCopperCards = cardEffectArgs.findCards([
        { location: 'basicSupply' },
        { cardKeys: ['gold', 'copper'] }
      ]);
      
      const [goldCards, copperCards] = goldAndCopperCards.reduce((acc, nextCard) => {
        if (nextCard.cardKey === 'gold') {
          acc[0].push(nextCard);
        }
        else {
          acc[1].push(nextCard);
        }
        return acc;
      }, [[], []] as Card[][]);
      
      if (!goldCards.length) {
        console.log(`[treasure-trove effect] no gold cards in supply`);
      }
      else {
        const goldCardToGain = goldCards.slice(-1)[0];
        console.log(`[treasure-trove effect] gaining ${goldCardToGain}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCardToGain.id,
          to: { location: 'playerDiscard' }
        });
      }
      
      if (!copperCards.length) {
        console.log(`[treasure-trove effect] no copper cards in supply`);
      }
      else {
        const copperCardToGain = copperCards.slice(-1)[0];
        console.log(`[treasure-trove effect] gaining ${copperCardToGain}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: copperCardToGain.id,
          to: { location: 'playerDiscard' }
        });
      }
      
    }
  },
  'warrior': {
    registerLifeCycleMethods: () => ({
      onDiscarded: async (args, eventArgs) => {
        const card = args.cardLibrary.getCard(eventArgs.cardId);
        await addTravellerEffect(card, 'hero', args, eventArgs);
      }
    }),
    registerEffects: () => async (cardEffectArgs) => {
      console.log(`[warrior effect] drawing 2 cards`);
      await cardEffectArgs.runGameActionDelegate('drawCard', { playerId: cardEffectArgs.playerId, count: 2 });
      
      const travellersInPlay = getCardsInPlay(cardEffectArgs.findCards)
        .filter(card => card.owner === cardEffectArgs.playerId && card.type.includes('TRAVELLER'));
      
      if (!travellersInPlay.length) {
        console.log(`[warrior effect] no travellers in play`);
        return;
      }
      
      const targetPlayerIds = findOrderedTargets({
        match: cardEffectArgs.match,
        appliesTo: 'ALL_OTHER',
        startingPlayerId: cardEffectArgs.playerId
      }).filter(playerId => cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
      
      for (const targetPlayerId of targetPlayerIds) {
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
        
        for (let i = 0; i < travellersInPlay.length; i++) {
          if (deck.length === 0) {
            console.log(`[warrior effect] no cards in deck, shuffling`);
            
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
            
            if (deck.length === 0) {
              console.log(`[warrior effect] still empty, no cards to look at`);
              break;
            }
          }
          
          const cardToDiscard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
          
          console.log(`[warrior effect] discarding ${cardToDiscard}`);
          
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: targetPlayerId,
            cardId: cardToDiscard.id
          });
          
          const { cost } = cardEffectArgs.cardPriceController.applyRules(cardToDiscard, { playerId: cardEffectArgs.playerId });
          
          if (cost.treasure === 3 || cost.treasure === 4) {
            console.log(`[warrior effect] card costs 3 or 3, trashing ${cardToDiscard}`);
            
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToDiscard.id
            });
          }
        }
      }
    }
  },
}

export default expansion;