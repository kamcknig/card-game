import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
const expansion = {
  'alchemist': {
    registerEffects: ()=>async (args)=>{
        console.log(`[alchemist effect] gaining 2 cards and 1 action`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: 2
        });
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        args.reactionManager.registerReactionTemplate({
          id: `alchemist:${args.cardId}:endTurn`,
          playerId: args.playerId,
          listeningFor: 'endTurn',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: ()=>true,
          triggeredEffectFn: async ()=>{
            args.reactionManager.unregisterTrigger(`alchemist:${args.cardId}:endTurn`);
            args.reactionManager.unregisterTrigger(`alchemist:${args.cardId}:startCleanUpPhase`);
          }
        });
        args.reactionManager.registerReactionTemplate({
          id: `alchemist:${args.cardId}:startCleanUpPhase`,
          playerId: args.playerId,
          listeningFor: 'startTurnPhase',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') {
              return false;
            }
            if (conditionArgs.match.stats.playedCards[args.cardId]?.turnNumber !== conditionArgs.match.turnNumber) {
              return false;
            }
            const cardsInPlay = getCardsInPlay(args.findCards);
            const ownedCardsInPlay = cardsInPlay.filter((card)=>card.owner === args.playerId);
            const potionCardsInPlay = ownedCardsInPlay.filter((card)=>card.cardKey === 'potion');
            return potionCardsInPlay.length > 0;
          },
          triggeredEffectFn: async (triggerEffectArgs)=>{
            const result = await triggerEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Top-deck Alchemist?',
              playerId: args.playerId,
              actionButtons: [
                {
                  label: `Cancel`,
                  action: 1
                },
                {
                  label: `Top-deck`,
                  action: 2
                }
              ]
            });
            if (result.action === 2) {
              console.log(`[alchemist triggered effect] player chose to top-deck alchemist`);
              await triggerEffectArgs.runGameActionDelegate('moveCard', {
                cardId: args.cardId,
                toPlayerId: args.playerId,
                to: {
                  location: 'playerDeck'
                }
              });
            } else {
              console.log(`[alchemist triggered effect] player chose not to top-deck alchemist`);
            }
          }
        });
      }
  },
  'apothecary': {
    registerEffects: ()=>async (args)=>{
        console.log(`[apothecary effect] gaining 1 card and 1 action`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId
        });
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        const playerDeck = args.cardSourceController.getSource('playerDeck', args.playerId);
        const playerDiscard = args.cardSourceController.getSource('playerDiscard', args.playerId);
        const numToReveal = Math.min(4, playerDeck.length + playerDiscard.length);
        if (playerDeck.length < numToReveal) {
          await args.runGameActionDelegate('shuffleDeck', {
            playerId: args.playerId
          });
        }
        const cardsToReveal = playerDeck.slice(-numToReveal).map(args.cardLibrary.getCard);
        const setAside = [];
        for (const card of cardsToReveal){
          await args.runGameActionDelegate('revealCard', {
            cardId: card.id,
            playerId: args.playerId
          });
          if ([
            'copper',
            'potion'
          ].includes(card.cardKey)) {
            await args.runGameActionDelegate('moveCard', {
              cardId: card.id,
              toPlayerId: args.playerId,
              to: {
                location: 'playerHand'
              }
            });
          } else {
            setAside.push(card);
            await args.runGameActionDelegate('moveCard', {
              cardId: card.id,
              toPlayerId: args.playerId,
              to: {
                location: 'set-aside'
              }
            });
          }
        }
        const result = setAside.length === 1 ? {
          cardIds: setAside.map((card)=>card.id)
        } : await args.runGameActionDelegate('userPrompt', {
          prompt: 'Put on top of deck in any order',
          playerId: args.playerId,
          actionButtons: [
            {
              label: 'DONE',
              action: 1
            }
          ],
          content: {
            type: 'rearrange',
            cardIds: setAside.map((card)=>card.id)
          }
        });
        if (result.cardIds.length > 0) {
          console.log(`[apothecary effect] putting cards back on top of deck ${result.cardIds.map(args.cardLibrary.getCard)}`);
          for (const cardId of result.cardIds){
            await args.runGameActionDelegate('moveCard', {
              cardId: cardId,
              toPlayerId: args.playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        }
      }
  },
  'apprentice': {
    registerEffects: ()=>async (args)=>{
        console.log(`[apprentice effect] gaining 1 action`);
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = args.cardSourceController.getSource('playerHand', args.playerId);
        if (hand.length === 0) {
          console.log(`[apprentice effect] no cards in hand`);
          return;
        }
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: args.playerId,
          prompt: `Trash card`,
          restrict: hand,
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[apprentice effect] no card selected`);
          return;
        }
        const card = args.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[apprentice effect] trashing selected card ${card}`);
        await args.runGameActionDelegate('trashCard', {
          playerId: args.playerId,
          cardId: card.id
        });
        const { cost } = args.cardPriceController.applyRules(card, {
          playerId: args.playerId
        });
        const numCardsToDraw = cost.treasure + (cost.potion !== undefined ? 2 : 0);
        console.log(`[apprentice effect] drawing ${numCardsToDraw} cards`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: numCardsToDraw
        });
      }
  },
  'familiar': {
    registerEffects: ()=>async (args)=>{
        console.log(`[familiar effect] gaining 1 card and 1 action`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId
        });
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        const targets = findOrderedTargets({
          match: args.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: args.playerId
        }).filter((id)=>args.reactionContext?.[id]?.result !== 'immunity');
        for (const targetId of targets){
          const curseCardId = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ])?.slice(-1)?.[0]?.id;
          if (curseCardId === undefined) {
            console.log(`[familiar effect] no curse card in basic supply`);
            break;
          }
          console.log(`[familiar effect] gaining curse card to ${getPlayerById(args.match, targetId)}`);
          await args.runGameActionDelegate('gainCard', {
            cardId: curseCardId,
            playerId: targetId,
            to: {
              location: 'playerDiscard'
            }
          }, {
            loggingContext: {
              source: args.cardId
            }
          });
        }
      }
  },
  'golem': {
    registerEffects: ()=>async (args)=>{
        const deck = args.cardSourceController.getSource('playerDeck', args.playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', args.playerId);
        const actionCardsSetAside = [];
        const cardsToDiscard = [];
        while(deck.length + discard.length > 0 && actionCardsSetAside.length !== 2){
          if (deck.length === 0) {
            await args.runGameActionDelegate('shuffleDeck', {
              playerId: args.playerId
            });
          }
          const cardId = deck.slice(-1)[0];
          const card = args.cardLibrary.getCard(cardId);
          console.log(`[golem effect] revealing card ${card}`);
          await args.runGameActionDelegate('revealCard', {
            cardId: card.id,
            playerId: args.playerId
          });
          console.log(`[golem effect] card is non-golem action, setting aside`);
          await args.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: args.playerId,
            to: {
              location: 'set-aside'
            }
          });
          if (card.type.includes('ACTION') && card.cardKey !== 'golem') {
            actionCardsSetAside.push(card);
          } else {
            console.log(`[golem effect] card is golem, or action, setting aside to discard`);
            cardsToDiscard.push(card);
          }
        }
        console.log(`[golem effect] discarding ${cardsToDiscard.length} cards`);
        for (const card of cardsToDiscard){
          await args.runGameActionDelegate('discardCard', {
            cardId: card.id,
            playerId: args.playerId
          });
        }
        const actions = actionCardsSetAside.map((card, idx)=>({
            label: `Play ${card.cardName}`,
            action: idx + 1
          }));
        console.log(`[golem effect] playing ${actionCardsSetAside.length} cards`);
        const getAction = async ()=>{
          if (actions.length === 1) {
            return actions.shift()?.action;
          }
          const result = await args.runGameActionDelegate('userPrompt', {
            prompt: 'Choose to play',
            playerId: args.playerId,
            actionButtons: actions
          });
          const idx = actions.findIndex((action)=>action.action === result.action);
          actions.splice(idx, 1);
          return result.action;
        };
        while(actions.length > 0){
          const action = await getAction();
          const card = actionCardsSetAside[action - 1];
          await args.runGameActionDelegate('playCard', {
            cardId: card.id,
            playerId: args.playerId,
            overrides: {
              actionCost: 0
            }
          });
        }
      }
  },
  'herbalist': {
    registerEffects: ()=>async (args)=>{
        console.log(`[herbalist effect] gaining 1 buy and 1 treasure`);
        await args.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await args.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        args.reactionManager.registerReactionTemplate({
          id: `herbalist:${args.cardId}:endTurn`,
          playerId: args.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          listeningFor: 'endTurn',
          condition: ()=>true,
          triggeredEffectFn: async ()=>{
            args.reactionManager.unregisterTrigger(`herbalist:${args.cardId}:endTurn`);
            args.reactionManager.unregisterTrigger(`herbalist:${args.cardId}:discardCard`);
          }
        });
        args.reactionManager.registerReactionTemplate({
          id: `herbalist:${args.cardId}:discardCard`,
          listeningFor: 'discardCard',
          once: true,
          allowMultipleInstances: true,
          compulsory: false,
          playerId: args.playerId,
          condition: (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== args.playerId) return false;
            if (!conditionArgs.trigger.args.previousLocation) return false;
            if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation.location)) return false;
            return conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId).type.includes('TREASURE');
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            const card = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            console.log(`[herbalist triggered effect] moving ${card} to top of deck`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: triggeredArgs.trigger.args.cardId,
              toPlayerId: args.playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        });
      }
  },
  'philosophers-stone': {
    registerEffects: ()=>async (args)=>{
        const deck = args.cardSourceController.getSource('playerDeck', args.playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', args.playerId);
        const cardCount = deck.length + discard.length;
        const amountToGain = Math.floor(cardCount / 5);
        console.log(`[philosophers-stone effect] card count ${cardCount}, gaining ${amountToGain} treasure`);
        await args.runGameActionDelegate('gainTreasure', {
          count: amountToGain
        });
      }
  },
  'scrying-pool': {
    registerEffects: ()=>async (args)=>{
        console.log(`[scrying-pool effect] gaining 1 action`);
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        const targetIds = findOrderedTargets({
          match: args.match,
          appliesTo: 'ALL',
          startingPlayerId: args.playerId
        }).filter((playerId)=>args.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetIds){
          const deck = args.cardSourceController.getSource('playerDeck', targetPlayerId);
          if (deck.length === 0) {
            console.log(`[scrying-pool effect] no cards in deck, shuffling`);
            await args.runGameActionDelegate('shuffleDeck', {
              playerId: targetPlayerId
            });
            if (deck.length === 0) {
              console.log(`[scrying-pool effect] still no cards in deck, skipping`);
              continue;
            }
          }
          const cardId = deck.slice(-1)[0];
          const card = args.cardLibrary.getCard(cardId);
          console.log(`[scrying-pool effect] revealing card ${card}`);
          await args.runGameActionDelegate('revealCard', {
            cardId: cardId,
            playerId: targetPlayerId,
            moveToSetAside: true
          });
          const result = await args.runGameActionDelegate('userPrompt', {
            prompt: `Discard or top-deck ${card.cardName}?`,
            playerId: args.playerId,
            actionButtons: [
              {
                label: `Discard`,
                action: 1
              },
              {
                label: `Top-deck`,
                action: 2
              }
            ]
          });
          if (result.action === 1) {
            console.log(`[scrying-pool effect] ${getPlayerById(args.match, args.playerId)} chose discard`);
            await args.runGameActionDelegate('discardCard', {
              cardId: cardId,
              playerId: targetPlayerId
            });
          } else {
            console.log(`[scrying-pool effect] ${getPlayerById(args.match, args.playerId)} chose top-deck`);
            await args.runGameActionDelegate('moveCard', {
              cardId: cardId,
              toPlayerId: targetPlayerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        }
        const deck = args.cardSourceController.getSource('playerDeck', args.playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', args.playerId);
        const cardsRevealed = [];
        while(deck.length + discard.length > 0){
          const cardId = deck.slice(-1)[0];
          if (!cardId) {
            console.log(`[scrying-pool effect] no cards in deck, shuffling`);
            await args.runGameActionDelegate('shuffleDeck', {
              playerId: args.playerId
            });
            if (deck.length === 0) {
              console.log(`[scrying-pool effect] still no cards in deck`);
              return;
            }
          }
          const card = args.cardLibrary.getCard(cardId);
          cardsRevealed.push(card);
          await args.runGameActionDelegate('revealCard', {
            cardId: card.id,
            playerId: args.playerId,
            moveToSetAside: true
          });
          if (!card.type.includes('ACTION')) {
            break;
          }
        }
        console.log(`[scrying-pool effect] putting ${cardsRevealed.length} cards in hand`);
        for (const card of cardsRevealed){
          await args.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: args.playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
      }
  },
  'transmute': {
    registerEffects: ()=>async (args)=>{
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: args.playerId,
          prompt: `Trash card`,
          restrict: args.cardSourceController.getSource('playerHand', args.playerId),
          count: 1
        });
        const selectedCardId = selectedCardIds[0];
        if (!selectedCardId) {
          console.log(`[transmute effect] no card selected`);
          return;
        }
        const selectedCard = args.cardLibrary.getCard(selectedCardId);
        await args.runGameActionDelegate('trashCard', {
          playerId: args.playerId,
          cardId: selectedCardId
        });
        let cards = [];
        if (selectedCard.type.includes('ACTION')) {
          cards = args.findCards([
            {
              location: [
                'basicSupply'
              ]
            },
            {
              cardKeys: 'duchy'
            }
          ]);
          const card = cards.slice(-1)[0];
          if (card) {
            console.log(`[transmute effect] card is action, gaining duchy`);
            await args.runGameActionDelegate('gainCard', {
              playerId: args.playerId,
              cardId: card.id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
        if (selectedCard.type.includes('TREASURE')) {
          cards = args.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              cardKeys: 'transmute'
            }
          ]);
          const card = cards.slice(-1)[0];
          if (card) {
            console.log(`[transmute effect] card is treasure, gaining transmute`);
            await args.runGameActionDelegate('gainCard', {
              playerId: args.playerId,
              cardId: card.id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
        if (selectedCard.type.includes('VICTORY')) {
          cards = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'gold'
            }
          ]);
          const card = cards.slice(-1)[0];
          if (card) {
            console.log(`[transmute effect] card is victory, gaining gold`);
            await args.runGameActionDelegate('gainCard', {
              playerId: args.playerId,
              cardId: card.id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }
  },
  'university': {
    registerEffects: ()=>async (args)=>{
        await args.runGameActionDelegate('gainAction', {
          count: 2
        });
        const selectedCardIds = await args.runGameActionDelegate('selectCard', {
          playerId: args.playerId,
          prompt: `Gain card`,
          restrict: [
            {
              location: 'kingdomSupply'
            },
            {
              cardType: 'ACTION'
            },
            {
              kind: 'upTo',
              amount: {
                treasure: 5
              },
              playerId: args.playerId
            }
          ],
          count: 1,
          optional: true
        });
        const selectedCardId = selectedCardIds[0];
        if (!selectedCardId) {
          console.log(`[university effect] no card selected`);
          return;
        }
        const selectedCard = args.cardLibrary.getCard(selectedCardId);
        console.log(`[university effect] gaining ${selectedCard}`);
        await args.runGameActionDelegate('gainCard', {
          playerId: args.playerId,
          cardId: selectedCardId,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'vineyard': {
    registerScoringFunction: ()=>(args)=>{
        const ownedActionCards = args.cardLibrary.getCardsByOwner(args.ownerId).filter((card)=>card.type.includes('ACTION'));
        const victoryPoints = Math.floor(ownedActionCards.length / 3);
        return victoryPoints;
      }
  },
  'potion': {
    registerEffects: ()=>async (args)=>{
        await args.runGameActionDelegate('gainPotion', {
          count: 1
        });
      }
  }
};
export default expansion;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9hbGNoZW15L2NhcmQtZWZmZWN0cy1hbGNoZW15LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENhcmRFeHBhbnNpb25Nb2R1bGUgfSBmcm9tICcuLi8uLi90eXBlcy50cyc7XG5pbXBvcnQgeyBnZXRUdXJuUGhhc2UgfSBmcm9tICcuLi8uLi91dGlscy9nZXQtdHVybi1waGFzZS50cyc7XG5pbXBvcnQgeyBnZXRDYXJkc0luUGxheSB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1jYXJkcy1pbi1wbGF5LnRzJztcbmltcG9ydCB7IENhcmQsIENhcmRJZCB9IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgZmluZE9yZGVyZWRUYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmluZC1vcmRlcmVkLXRhcmdldHMudHMnO1xuaW1wb3J0IHsgZ2V0UGxheWVyQnlJZCB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1wbGF5ZXItYnktaWQudHMnO1xuaW1wb3J0IHsgaXNMb2NhdGlvbkluUGxheSB9IGZyb20gJy4uLy4uL3V0aWxzL2lzLWluLXBsYXkudHMnO1xuXG5jb25zdCBleHBhbnNpb246IENhcmRFeHBhbnNpb25Nb2R1bGUgPSB7XG4gICdhbGNoZW1pc3QnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoYXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFthbGNoZW1pc3QgZWZmZWN0XSBnYWluaW5nIDIgY2FyZHMgYW5kIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBhcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYGFsY2hlbWlzdDoke2FyZ3MuY2FyZElkfTplbmRUdXJuYCxcbiAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ2VuZFR1cm4nLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246ICgpID0+IHRydWUsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGFsY2hlbWlzdDoke2FyZ3MuY2FyZElkfTplbmRUdXJuYCk7XG4gICAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGFsY2hlbWlzdDoke2FyZ3MuY2FyZElkfTpzdGFydENsZWFuVXBQaGFzZWApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBhbGNoZW1pc3Q6JHthcmdzLmNhcmRJZH06c3RhcnRDbGVhblVwUGhhc2VgLFxuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuUGhhc2UnLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiB7XG4gICAgICAgICAgaWYgKGdldFR1cm5QaGFzZShjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5waGFzZUluZGV4KSAhPT0gJ2NsZWFudXAnKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzW2FyZ3MuY2FyZElkXT8udHVybk51bWJlciAhPT0gY29uZGl0aW9uQXJncy5tYXRjaC50dXJuTnVtYmVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRzSW5QbGF5ID0gZ2V0Q2FyZHNJblBsYXkoYXJncy5maW5kQ2FyZHMpO1xuICAgICAgICAgIGNvbnN0IG93bmVkQ2FyZHNJblBsYXkgPSBjYXJkc0luUGxheS5maWx0ZXIoY2FyZCA9PiBjYXJkLm93bmVyID09PSBhcmdzLnBsYXllcklkKTtcbiAgICAgICAgICBjb25zdCBwb3Rpb25DYXJkc0luUGxheSA9IG93bmVkQ2FyZHNJblBsYXkuZmlsdGVyKGNhcmQgPT4gY2FyZC5jYXJkS2V5ID09PSAncG90aW9uJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHBvdGlvbkNhcmRzSW5QbGF5Lmxlbmd0aCA+IDA7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlckVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmlnZ2VyRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdUb3AtZGVjayBBbGNoZW1pc3Q/JyxcbiAgICAgICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgICB7IGxhYmVsOiBgQ2FuY2VsYCwgYWN0aW9uOiAxIH0sXG4gICAgICAgICAgICAgIHsgbGFiZWw6IGBUb3AtZGVja2AsIGFjdGlvbjogMiB9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIGNhcmRJZHM6IG51bWJlcltdIH07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYWxjaGVtaXN0IHRyaWdnZXJlZCBlZmZlY3RdIHBsYXllciBjaG9zZSB0byB0b3AtZGVjayBhbGNoZW1pc3RgKTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogYXJncy5jYXJkSWQsXG4gICAgICAgICAgICAgIHRvUGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFthbGNoZW1pc3QgdHJpZ2dlcmVkIGVmZmVjdF0gcGxheWVyIGNob3NlIG5vdCB0byB0b3AtZGVjayBhbGNoZW1pc3RgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnYXBvdGhlY2FyeSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2Fwb3RoZWNhcnkgZWZmZWN0XSBnYWluaW5nIDEgY2FyZCBhbmQgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHBsYXllckRlY2sgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgcGxheWVyRGlzY2FyZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgYXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IG51bVRvUmV2ZWFsID0gTWF0aC5taW4oNCwgcGxheWVyRGVjay5sZW5ndGggKyBwbGF5ZXJEaXNjYXJkLmxlbmd0aCk7XG4gICAgICBcbiAgICAgIGlmIChwbGF5ZXJEZWNrLmxlbmd0aCA8IG51bVRvUmV2ZWFsKSB7XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzVG9SZXZlYWwgPSBwbGF5ZXJEZWNrLnNsaWNlKC1udW1Ub1JldmVhbCkubWFwKGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCk7XG4gICAgICBjb25zdCBzZXRBc2lkZTogQ2FyZFtdID0gW107XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvUmV2ZWFsKSB7XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoWydjb3BwZXInLCAncG90aW9uJ10uaW5jbHVkZXMoY2FyZC5jYXJkS2V5KSkge1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHRvUGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBzZXRBc2lkZS5wdXNoKGNhcmQpO1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHRvUGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3NldC1hc2lkZScgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHNldEFzaWRlLmxlbmd0aCA9PT0gMSA/XG4gICAgICAgIHsgY2FyZElkczogc2V0QXNpZGUubWFwKGNhcmQgPT4gY2FyZC5pZCkgfSA6XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ1B1dCBvbiB0b3Agb2YgZGVjayBpbiBhbnkgb3JkZXInLFxuICAgICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFt7IGxhYmVsOiAnRE9ORScsIGFjdGlvbjogMSB9XSxcbiAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICB0eXBlOiAncmVhcnJhbmdlJyxcbiAgICAgICAgICAgIGNhcmRJZHM6IHNldEFzaWRlLm1hcChjYXJkID0+IGNhcmQuaWQpXG4gICAgICAgICAgfSxcbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgY2FyZElkczogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5jYXJkSWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFthcG90aGVjYXJ5IGVmZmVjdF0gcHV0dGluZyBjYXJkcyBiYWNrIG9uIHRvcCBvZiBkZWNrICR7cmVzdWx0LmNhcmRJZHMubWFwKGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCl9YCk7XG4gICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHJlc3VsdC5jYXJkSWRzKSB7XG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdhcHByZW50aWNlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYXBwcmVudGljZSBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgYXJncy5wbGF5ZXJJZCk7XG4gICAgICBpZiAoaGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFthcHByZW50aWNlIGVmZmVjdF0gbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbYXBwcmVudGljZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYXBwcmVudGljZSBlZmZlY3RdIHRyYXNoaW5nIHNlbGVjdGVkIGNhcmQgJHtjYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdCB9ID1cbiAgICAgICAgYXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwgeyBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgbnVtQ2FyZHNUb0RyYXcgPSBjb3N0LnRyZWFzdXJlICsgKGNvc3QucG90aW9uICE9PSB1bmRlZmluZWQgPyAyIDogMCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYXBwcmVudGljZSBlZmZlY3RdIGRyYXdpbmcgJHtudW1DYXJkc1RvRHJhd30gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCwgY291bnQ6IG51bUNhcmRzVG9EcmF3IH0pO1xuICAgIH1cbiAgfSxcbiAgJ2ZhbWlsaWFyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZmFtaWxpYXIgZWZmZWN0XSBnYWluaW5nIDEgY2FyZCBhbmQgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogYXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgICAgfSkuZmlsdGVyKChpZCkgPT4gYXJncy5yZWFjdGlvbkNvbnRleHQ/LltpZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0SWQgb2YgdGFyZ2V0cykge1xuICAgICAgICBjb25zdCBjdXJzZUNhcmRJZCA9XG4gICAgICAgICAgYXJncy5maW5kQ2FyZHMoW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ2N1cnNlJyB9XSk/LnNsaWNlKC0xKT8uWzBdPy5pZDtcbiAgICAgICAgXG4gICAgICAgIGlmIChjdXJzZUNhcmRJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtmYW1pbGlhciBlZmZlY3RdIG5vIGN1cnNlIGNhcmQgaW4gYmFzaWMgc3VwcGx5YCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbZmFtaWxpYXIgZWZmZWN0XSBnYWluaW5nIGN1cnNlIGNhcmQgdG8gJHtnZXRQbGF5ZXJCeUlkKGFyZ3MubWF0Y2gsIHRhcmdldElkKX1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGN1cnNlQ2FyZElkLFxuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSwge1xuICAgICAgICAgIGxvZ2dpbmdDb250ZXh0OiB7XG4gICAgICAgICAgICBzb3VyY2U6IGFyZ3MuY2FyZElkXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdnb2xlbSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICBjb25zdCBkZWNrID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBhcmdzLnBsYXllcklkKTtcbiAgICAgIGNvbnN0IGRpc2NhcmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGlzY2FyZCcsIGFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBhY3Rpb25DYXJkc1NldEFzaWRlOiBDYXJkW10gPSBbXTtcbiAgICAgIGNvbnN0IGNhcmRzVG9EaXNjYXJkOiBDYXJkW10gPSBbXTtcbiAgICAgIFxuICAgICAgd2hpbGUgKGRlY2subGVuZ3RoICsgZGlzY2FyZC5sZW5ndGggPiAwICYmIGFjdGlvbkNhcmRzU2V0QXNpZGUubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2dvbGVtIGVmZmVjdF0gcmV2ZWFsaW5nIGNhcmQgJHtjYXJkfWApO1xuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtnb2xlbSBlZmZlY3RdIGNhcmQgaXMgbm9uLWdvbGVtIGFjdGlvbiwgc2V0dGluZyBhc2lkZWApO1xuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHRvUGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdzZXQtYXNpZGUnIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSAmJiBjYXJkLmNhcmRLZXkgIT09ICdnb2xlbScpIHtcbiAgICAgICAgICBhY3Rpb25DYXJkc1NldEFzaWRlLnB1c2goY2FyZCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtnb2xlbSBlZmZlY3RdIGNhcmQgaXMgZ29sZW0sIG9yIGFjdGlvbiwgc2V0dGluZyBhc2lkZSB0byBkaXNjYXJkYCk7XG4gICAgICAgICAgY2FyZHNUb0Rpc2NhcmQucHVzaChjYXJkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2dvbGVtIGVmZmVjdF0gZGlzY2FyZGluZyAke2NhcmRzVG9EaXNjYXJkLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvRGlzY2FyZCkge1xuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7IGNhcmRJZDogY2FyZC5pZCwgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGFjdGlvbnMgPSBhY3Rpb25DYXJkc1NldEFzaWRlLm1hcCgoY2FyZCwgaWR4KSA9PiAoe1xuICAgICAgICBsYWJlbDogYFBsYXkgJHtjYXJkLmNhcmROYW1lfWAsXG4gICAgICAgIGFjdGlvbjogaWR4ICsgMSxcbiAgICAgIH0pKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbZ29sZW0gZWZmZWN0XSBwbGF5aW5nICR7YWN0aW9uQ2FyZHNTZXRBc2lkZS5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGdldEFjdGlvbiA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgaWYgKGFjdGlvbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbnMuc2hpZnQoKT8uYWN0aW9uO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwcm9tcHQ6ICdDaG9vc2UgdG8gcGxheScsXG4gICAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgYWN0aW9uQnV0dG9uczogYWN0aW9uc1xuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCBjYXJkSWRzOiBudW1iZXJbXSB9O1xuICAgICAgICBjb25zdCBpZHggPSBhY3Rpb25zLmZpbmRJbmRleChhY3Rpb24gPT4gYWN0aW9uLmFjdGlvbiA9PT0gcmVzdWx0LmFjdGlvbik7XG4gICAgICAgIGFjdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIHJldHVybiByZXN1bHQuYWN0aW9uO1xuICAgICAgfVxuICAgICAgXG4gICAgICB3aGlsZSAoYWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGFjdGlvbiA9IGF3YWl0IGdldEFjdGlvbigpO1xuICAgICAgICBjb25zdCBjYXJkID0gYWN0aW9uQ2FyZHNTZXRBc2lkZVthY3Rpb24hIC0gMV07XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICBhY3Rpb25Db3N0OiAwXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdoZXJiYWxpc3QnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoYXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtoZXJiYWxpc3QgZWZmZWN0XSBnYWluaW5nIDEgYnV5IGFuZCAxIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBoZXJiYWxpc3Q6JHthcmdzLmNhcmRJZH06ZW5kVHVybmAsXG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuJyxcbiAgICAgICAgY29uZGl0aW9uOiAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBoZXJiYWxpc3Q6JHthcmdzLmNhcmRJZH06ZW5kVHVybmApO1xuICAgICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBoZXJiYWxpc3Q6JHthcmdzLmNhcmRJZH06ZGlzY2FyZENhcmRgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgaGVyYmFsaXN0OiR7YXJncy5jYXJkSWR9OmRpc2NhcmRDYXJkYCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnZGlzY2FyZENhcmQnLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgIGNvbmRpdGlvbjogKGNvbmRpdGlvbkFyZ3MpID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoIWNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnByZXZpb3VzTG9jYXRpb24pIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoIWlzTG9jYXRpb25JblBsYXkoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucHJldmlvdXNMb2NhdGlvbi5sb2NhdGlvbikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gY29uZGl0aW9uQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCkudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyZWRBcmdzKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IHRyaWdnZXJlZEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyZWRBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaGVyYmFsaXN0IHRyaWdnZXJlZCBlZmZlY3RdIG1vdmluZyAke2NhcmR9IHRvIHRvcCBvZiBkZWNrYCk7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiB0cmlnZ2VyZWRBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAncGhpbG9zb3BoZXJzLXN0b25lJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGRlY2sgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgZGlzY2FyZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgYXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRDb3VudCA9IGRlY2subGVuZ3RoICsgZGlzY2FyZC5sZW5ndGg7XG4gICAgICBjb25zdCBhbW91bnRUb0dhaW4gPSBNYXRoLmZsb29yKGNhcmRDb3VudCAvIDUpO1xuICAgICAgY29uc29sZS5sb2coYFtwaGlsb3NvcGhlcnMtc3RvbmUgZWZmZWN0XSBjYXJkIGNvdW50ICR7Y2FyZENvdW50fSwgZ2FpbmluZyAke2Ftb3VudFRvR2Fpbn0gdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiBhbW91bnRUb0dhaW4gfSk7XG4gICAgfVxuICB9LFxuICAnc2NyeWluZy1wb29sJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2NyeWluZy1wb29sIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogYXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldElkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3NjcnlpbmctcG9vbCBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzY3J5aW5nLXBvb2wgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrLCBza2lwcGluZ2ApO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzY3J5aW5nLXBvb2wgZWZmZWN0XSByZXZlYWxpbmcgY2FyZCAke2NhcmR9YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIG9yIHRvcC1kZWNrICR7Y2FyZC5jYXJkTmFtZX0/YCxcbiAgICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgICB7IGxhYmVsOiBgRGlzY2FyZGAsIGFjdGlvbjogMSB9LFxuICAgICAgICAgICAgeyBsYWJlbDogYFRvcC1kZWNrYCwgYWN0aW9uOiAyIH1cbiAgICAgICAgICBdLFxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCBjYXJkSWRzOiBudW1iZXJbXSB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3NjcnlpbmctcG9vbCBlZmZlY3RdICR7Z2V0UGxheWVyQnlJZChhcmdzLm1hdGNoLCBhcmdzLnBsYXllcklkKX0gY2hvc2UgZGlzY2FyZGApO1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzY3J5aW5nLXBvb2wgZWZmZWN0XSAke2dldFBsYXllckJ5SWQoYXJncy5tYXRjaCwgYXJncy5wbGF5ZXJJZCl9IGNob3NlIHRvcC1kZWNrYCk7XG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgZGlzY2FyZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgYXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzUmV2ZWFsZWQ6IENhcmRbXSA9IFtdO1xuICAgICAgXG4gICAgICB3aGlsZSAoZGVjay5sZW5ndGggKyBkaXNjYXJkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzY3J5aW5nLXBvb2wgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiBhcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzY3J5aW5nLXBvb2wgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIGNhcmRzUmV2ZWFsZWQucHVzaChjYXJkKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc2NyeWluZy1wb29sIGVmZmVjdF0gcHV0dGluZyAke2NhcmRzUmV2ZWFsZWQubGVuZ3RofSBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1JldmVhbGVkKSB7XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndHJhbnNtdXRlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGFyZ3MucGxheWVySWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZCA9IHNlbGVjdGVkQ2FyZElkc1swXTtcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt0cmFuc211dGUgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkKTtcbiAgICAgIFxuICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbGV0IGNhcmRzOiBDYXJkW10gPSBbXTtcbiAgICAgIGlmIChzZWxlY3RlZENhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpIHtcbiAgICAgICAgY2FyZHMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseSddIH0sXG4gICAgICAgICAgeyBjYXJkS2V5czogJ2R1Y2h5JyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgaWYgKGNhcmQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3RyYW5zbXV0ZSBlZmZlY3RdIGNhcmQgaXMgYWN0aW9uLCBnYWluaW5nIGR1Y2h5YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmQudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSkge1xuICAgICAgICBjYXJkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiAna2luZ2RvbVN1cHBseScgfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiAndHJhbnNtdXRlJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgaWYgKGNhcmQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3RyYW5zbXV0ZSBlZmZlY3RdIGNhcmQgaXMgdHJlYXN1cmUsIGdhaW5pbmcgdHJhbnNtdXRlYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmQudHlwZS5pbmNsdWRlcygnVklDVE9SWScpKSB7XG4gICAgICAgIGNhcmRzID0gYXJncy5maW5kQ2FyZHMoXG4gICAgICAgICAgW1xuICAgICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgICAgeyBjYXJkS2V5czogJ2dvbGQnIH1cbiAgICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkcy5zbGljZSgtMSlbMF07XG4gICAgICAgIGlmIChjYXJkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt0cmFuc211dGUgZWZmZWN0XSBjYXJkIGlzIHZpY3RvcnksIGdhaW5pbmcgZ29sZGApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICd1bml2ZXJzaXR5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGFyZ3MpID0+IHtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdraW5nZG9tU3VwcGx5JyB9LFxuICAgICAgICAgIHsgY2FyZFR5cGU6ICdBQ1RJT04nIH0sXG4gICAgICAgICAgeyBraW5kOiAndXBUbycsIGFtb3VudDogeyB0cmVhc3VyZTogNSB9LCBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCB9XG4gICAgICAgIF0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkID0gc2VsZWN0ZWRDYXJkSWRzWzBdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdW5pdmVyc2l0eSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3VuaXZlcnNpdHkgZWZmZWN0XSBnYWluaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3ZpbmV5YXJkJzoge1xuICAgIHJlZ2lzdGVyU2NvcmluZ0Z1bmN0aW9uOiAoKSA9PiAoYXJncykgPT4ge1xuICAgICAgY29uc3Qgb3duZWRBY3Rpb25DYXJkcyA9IGFyZ3MuY2FyZExpYnJhcnlcbiAgICAgICAgLmdldENhcmRzQnlPd25lcihhcmdzLm93bmVySWQpXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKTtcbiAgICAgIFxuICAgICAgY29uc3QgdmljdG9yeVBvaW50cyA9IE1hdGguZmxvb3Iob3duZWRBY3Rpb25DYXJkcy5sZW5ndGggLyAzKTtcbiAgICAgIHJldHVybiB2aWN0b3J5UG9pbnRzO1xuICAgIH1cbiAgfSxcbiAgJ3BvdGlvbic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblBvdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGV4cGFuc2lvbjsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FBUyxZQUFZLFFBQVEsZ0NBQWdDO0FBQzdELFNBQVMsY0FBYyxRQUFRLG1DQUFtQztBQUVsRSxTQUFTLGtCQUFrQixRQUFRLHNDQUFzQztBQUN6RSxTQUFTLGFBQWEsUUFBUSxrQ0FBa0M7QUFDaEUsU0FBUyxnQkFBZ0IsUUFBUSw0QkFBNEI7QUFFN0QsTUFBTSxZQUFpQztFQUNyQyxhQUFhO0lBQ1gsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLCtDQUErQyxDQUFDO1FBQzdELE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxLQUFLLFFBQVE7VUFBRSxPQUFPO1FBQUU7UUFFakYsTUFBTSxLQUFLLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFMUQsS0FBSyxlQUFlLENBQUMsd0JBQXdCLENBQUM7VUFDNUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLE1BQU0sQ0FBQyxRQUFRLENBQUM7VUFDdEMsVUFBVSxLQUFLLFFBQVE7VUFDdkIsY0FBYztVQUNkLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFdBQVcsSUFBTTtVQUNqQixtQkFBbUI7WUFDakIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxVQUFVLEVBQUUsS0FBSyxNQUFNLENBQUMsUUFBUSxDQUFDO1lBQ3pFLEtBQUssZUFBZSxDQUFDLGlCQUFpQixDQUFDLENBQUMsVUFBVSxFQUFFLEtBQUssTUFBTSxDQUFDLGtCQUFrQixDQUFDO1VBQ3JGO1FBQ0Y7UUFFQSxLQUFL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
// denoCacheMetadata=9015064622676907367,6931204020021875532