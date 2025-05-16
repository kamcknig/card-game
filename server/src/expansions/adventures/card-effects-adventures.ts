import { CardId } from 'shared/shared-types.ts';
import { CardExpansionModule } from '../../types.ts';

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
}

export default expansion;