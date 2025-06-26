import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
const effectMap = {
  'alms': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const event = cardEffectArgs.match.events.find((e)=>e.id === cardEffectArgs.cardId);
        if (!event) return;
        const priceRule = (card, context)=>{
          if (context.playerId === cardEffectArgs.playerId) return {
            restricted: true,
            cost: card.cost
          };
          return {
            restricted: false,
            cost: card.cost
          };
        };
        const ruleUnsub = cardEffectArgs.cardPriceController.registerRule(event, priceRule);
        cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async ()=>true,
          triggeredEffectFn: async ()=>{
            ruleUnsub();
          }
        });
        const treasuresInPlay = getCardsInPlay(cardEffectArgs.findCards).filter((card)=>card.type.includes('TREASURE')).filter((card)=>card.owner === cardEffectArgs.playerId);
        if (treasuresInPlay.length > 0) {
          console.log(`[alms effect] ${treasuresInPlay.length} treasures in play, not gaining card`);
          return;
        }
        const cards = cardEffectArgs.findCards([
          {
            location: [
              'basicSupply',
              'kingdomSupply'
            ]
          },
          {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: {
              treasure: 4
            }
          }
        ]);
        if (!cards.length) {
          console.log(`[alms effect] no cards to gain`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[alms effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[alms effect] gaining card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'bonfire': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const coppersInPlay = getCardsInPlay(cardEffectArgs.findCards).filter((card)=>card.cardKey === 'copper' && card.owner === cardEffectArgs.playerId);
        if (!coppersInPlay.length) {
          console.log(`[bonfire effect] no coppers in play`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash coppers`,
          restrict: coppersInPlay.map((card)=>card.id),
          count: {
            kind: 'upTo',
            count: 2
          }
        });
        if (!selectedCardIds.length) {
          console.warn(`[bonfire effect] no card selected`);
          return;
        }
        console.log(`[bonfire effect] trashing ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId
          });
        }
      }
  },
  'expedition': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const event = cardEffectArgs.match.events.find((e)=>e.id === cardEffectArgs.cardId);
        if (!event) {
          console.warn(`[expedition effect] event not found`);
          return;
        }
        cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurnPhase', {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (getTurnPhase(conditionArgs.match.turnPhaseIndex) !== 'cleanup') return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.warn(`[expedition effect] i have programmed this to use the reaction system, but technically the effect should modify the amount of cards drawn, and not take place at the end of cleanup`);
            console.log(`[expedition endTurnPhase effect] drawing 2 cards`);
            await cardEffectArgs.runGameActionDelegate('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 2
            });
          }
        });
      }
  },
  'quest': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const handCards = hand.map(cardEffectArgs.cardLibrary.getCard);
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one',
          actionButtons: [
            {
              label: 'DISCARD ATTACK',
              action: 1
            },
            {
              label: 'DISCARD 2 COPPER',
              action: 2
            },
            {
              label: 'DISCARD 6 CARDS',
              action: 3
            }
          ]
        });
        let selectedCardIds = [];
        let gainGold = false;
        if (result.action === 1) {
          selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard attack`,
            restrict: handCards.filter((card)=>card.type.includes('ATTACK')).map((card)=>card.id),
            count: {
              kind: 'upTo',
              count: hand.length
            }
          });
          gainGold = true;
        } else if (result.action === 2) {
          selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard 2 copper`,
            restrict: handCards.filter((card)=>card.type.includes('ATTACK')).map((card)=>card.id),
            count: {
              kind: 'upTo',
              count: hand.length
            }
          });
          gainGold = selectedCardIds.length === 2;
        } else {
          selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard 6 cards`,
            restrict: hand,
            count: 6
          });
          gainGold = selectedCardIds.length === 6;
        }
        if (!selectedCardIds.length) {
          console.log(`[quest effect] no card selected`);
          return;
        }
        if (gainGold) {
          const goldCards = cardEffectArgs.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'gold'
            }
          ]);
          if (!goldCards.length) {
            console.log(`[quest effect] no gold cards in supply`);
            return;
          }
          console.log(`[quest effect] gaining ${goldCards.slice(-1)[0]}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: goldCards.slice(-1)[0],
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'save': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const event = cardEffectArgs.match.events.find((e)=>e.id === cardEffectArgs.cardId);
        if (!event) {
          console.warn(`[save effect] event not found`);
          return;
        }
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Set aside card`,
          restrict: hand,
          count: 1
        });
        if (!selectedCardIds.length) {
          console.log(`[save effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[save effect] setting aside card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'set-aside'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(event, 'endTurn', {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async ()=>true,
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[save endTurn effect] moving ${selectedCard} to player ${cardEffectArgs.playerId} hand`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId: selectedCard.id,
              to: {
                location: 'playerHand'
              }
            });
          }
        });
        const priceUnsub = cardEffectArgs.cardPriceController.registerRule(event, (card, context)=>{
          if (context.playerId === cardEffectArgs.playerId) return {
            restricted: true,
            cost: card.cost
          };
          return {
            restricted: false,
            cost: card.cost
          };
        });
        cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async ()=>true,
          triggeredEffectFn: async (triggeredArgs)=>{
            priceUnsub();
          }
        });
      }
  },
  'scouting-party': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const event = cardEffectArgs.match.events.find((e)=>e.id === cardEffectArgs.cardId);
        if (!event) {
          console.warn(`[scouting-party effect] event not found`);
          return;
        }
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const cardIdsSetAside = [];
        for(let i = 0; i < 5; i++){
          if (!deck.length) {
            console.log(`[scouting-party effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
            if (!deck.length) {
              console.log(`[scouting-party effect] no cards in deck still`);
              break;
            }
          }
          cardIdsSetAside.push(deck.slice(-1)[0]);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId: deck.slice(-1)[0],
            to: {
              location: 'set-aside'
            }
          });
        }
        if (!cardIdsSetAside.length) {
          console.log(`[scouting-party effect] no cards set aside`);
          return;
        }
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Discard 3 cards',
          content: {
            type: 'select',
            cardIds: cardIdsSetAside,
            selectCount: Math.min(3, cardIdsSetAside.length)
          }
        });
        if (!result.result.length) {
          console.warn(`[scouting-party effect] no card selected`);
          return;
        }
        console.log(`[scouting-party effect] discarding ${result.result.length} cards`);
        for (const cardId of result.result){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId
          });
        }
        const cardIdsToRearrange = cardIdsSetAside.filter((id)=>!result.result.includes(id));
        if (!cardIdsToRearrange.length) {
          console.log(`[scouting-party effect] no cards to rearrange`);
          return;
        }
        if (cardIdsToRearrange.length === 1) {
          console.log(`[scouting-party effect] one card left, moving to deck`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId: cardIdsToRearrange[0],
            to: {
              location: 'playerDeck'
            }
          });
        } else {
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Put back in any order',
            actionButtons: [
              {
                label: 'DONE',
                action: 1
              }
            ],
            content: {
              type: 'rearrange',
              cardIds: cardIdsToRearrange
            }
          });
          if (!result.result.length) {
            console.warn(`[scouting-party effect] no card selected`);
            return;
          }
          console.log(`[scouting-party effect] putting cards ${result.result} back on deck`);
          for (const cardId of result.result){
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        }
      }
  },
  'trade': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const event = cardEffectArgs.match.events.find((e)=>e.id === cardEffectArgs.cardId);
        if (!event) {
          console.warn(`[trade effect] event not found`);
          return;
        }
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash cards`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: 2
          }
        });
        if (!selectedCardIds.length) {
          console.log(`[trade effect] no card selected`);
          return;
        }
        const silverCards = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'silver'
          }
        ]);
        if (!silverCards.length) {
          console.log(`[trade effect] no silver cards in supply`);
          return;
        }
        console.log(`[trade effect] gaining ${selectedCardIds.length} silver cards`);
        for(let i = 0; i < selectedCardIds.length; i++){
          const silverCard = silverCards.slice(-i - 1)[0];
          if (!silverCard) {
            console.log(`[trade effect] no silver cards in supply`);
            break;
          }
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCard,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'travelling-fair': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const event = cardEffectArgs.match.events.find((e)=>e.id === cardEffectArgs.cardId);
        if (!event) {
          console.warn(`[travelling-fair effect] event not found`);
          return;
        }
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 2
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(event, 'cardGained', {
          playerId: cardEffectArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            const card = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            console.log(`[travelling-fair cardGained effect] putting ${card} on deck`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId: card.id,
              to: {
                location: 'playerDeck'
              }
            });
          }
        });
        cardEffectArgs.reactionManager.registerSystemTemplate(event, 'endTurn', {
          playerId: cardEffectArgs.playerId,
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: async ()=>true,
          triggeredEffectFn: async (triggeredArgs)=>{
            triggeredArgs.reactionManager.unregisterTrigger(`travelling-fair:${cardEffectArgs.cardId}:cardGained`);
          }
        });
      }
  }
};
export default effectMap;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9hZHZlbnR1cmVzL2V2ZW50LWVmZmVjdHMtYWR2ZW50dXJlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDYXJkRXhwYW5zaW9uTW9kdWxlIH0gZnJvbSAnLi4vLi4vdHlwZXMudHMnO1xuaW1wb3J0IHsgQ2FyZFByaWNlUnVsZSB9IGZyb20gJy4uLy4uL2NvcmUvY2FyZC1wcmljZS1ydWxlcy1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IGdldENhcmRzSW5QbGF5IH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LWNhcmRzLWluLXBsYXkudHMnO1xuaW1wb3J0IHsgQ2FyZElkIH0gZnJvbSAnc2hhcmVkL3NoYXJlZC10eXBlcy50cyc7XG5pbXBvcnQgeyBnZXRUdXJuUGhhc2UgfSBmcm9tICcuLi8uLi91dGlscy9nZXQtdHVybi1waGFzZS50cyc7XG5cbmNvbnN0IGVmZmVjdE1hcDogQ2FyZEV4cGFuc2lvbk1vZHVsZSA9IHtcbiAgJ2FsbXMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50ID0gY2FyZEVmZmVjdEFyZ3MubWF0Y2guZXZlbnRzLmZpbmQoZSA9PiBlLmlkID09PSBjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgaWYgKCFldmVudCkgcmV0dXJuO1xuICAgICAgXG4gICAgICBjb25zdCBwcmljZVJ1bGU6IENhcmRQcmljZVJ1bGUgPSAoY2FyZCwgY29udGV4dCkgPT4ge1xuICAgICAgICBpZiAoY29udGV4dC5wbGF5ZXJJZCA9PT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpIHJldHVybiB7IHJlc3RyaWN0ZWQ6IHRydWUsIGNvc3Q6IGNhcmQuY29zdCB9O1xuICAgICAgICByZXR1cm4geyByZXN0cmljdGVkOiBmYWxzZSwgY29zdDogY2FyZC5jb3N0IH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJ1bGVVbnN1YiA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIucmVnaXN0ZXJSdWxlKGV2ZW50LCBwcmljZVJ1bGUpO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJTeXN0ZW1UZW1wbGF0ZShldmVudCwgJ2VuZFR1cm4nLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHJ1bGVVbnN1YigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdHJlYXN1cmVzSW5QbGF5ID0gZ2V0Q2FyZHNJblBsYXkoY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC5vd25lciA9PT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAodHJlYXN1cmVzSW5QbGF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFthbG1zIGVmZmVjdF0gJHt0cmVhc3VyZXNJblBsYXkubGVuZ3RofSB0cmVhc3VyZXMgaW4gcGxheSwgbm90IGdhaW5pbmcgY2FyZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgeyBraW5kOiAndXBUbycsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgYW1vdW50OiB7IHRyZWFzdXJlOiA0IH0gfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghY2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYWxtcyBlZmZlY3RdIG5vIGNhcmRzIHRvIGdhaW5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbYWxtcyBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYWxtcyBlZmZlY3RdIGdhaW5pbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdib25maXJlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBjb3BwZXJzSW5QbGF5ID0gZ2V0Q2FyZHNJblBsYXkoY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC5jYXJkS2V5ID09PSAnY29wcGVyJyAmJiBjYXJkLm93bmVyID09PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmICghY29wcGVyc0luUGxheS5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtib25maXJlIGVmZmVjdF0gbm8gY29wcGVycyBpbiBwbGF5YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGNvcHBlcnNgLFxuICAgICAgICByZXN0cmljdDogY29wcGVyc0luUGxheS5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgY291bnQ6IHsga2luZDogJ3VwVG8nLCBjb3VudDogMiB9LFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtib25maXJlIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYm9uZmlyZSBlZmZlY3RdIHRyYXNoaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBzZWxlY3RlZENhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZXhwZWRpdGlvbic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZXZlbnQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC5ldmVudHMuZmluZChlID0+IGUuaWQgPT09IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2V4cGVkaXRpb24gZWZmZWN0XSBldmVudCBub3QgZm91bmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJTeXN0ZW1UZW1wbGF0ZShldmVudCwgJ2VuZFR1cm5QaGFzZScsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoZ2V0VHVyblBoYXNlKGNvbmRpdGlvbkFyZ3MubWF0Y2gudHVyblBoYXNlSW5kZXgpICE9PSAnY2xlYW51cCcpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jIHRyaWdnZXJlZEFyZ3MgPT4ge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW2V4cGVkaXRpb24gZWZmZWN0XSBpIGhhdmUgcHJvZ3JhbW1lZCB0aGlzIHRvIHVzZSB0aGUgcmVhY3Rpb24gc3lzdGVtLCBidXQgdGVjaG5pY2FsbHkgdGhlIGVmZmVjdCBzaG91bGQgbW9kaWZ5IHRoZSBhbW91bnQgb2YgY2FyZHMgZHJhd24sIGFuZCBub3QgdGFrZSBwbGFjZSBhdCB0aGUgZW5kIG9mIGNsZWFudXBgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2V4cGVkaXRpb24gZW5kVHVyblBoYXNlIGVmZmVjdF0gZHJhd2luZyAyIGNhcmRzYCk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdxdWVzdCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIGNvbnN0IGhhbmRDYXJkcyA9IGhhbmQubWFwKGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQpO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9uZScsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnRElTQ0FSRCBBVFRBQ0snLCBhY3Rpb246IDEgfSxcbiAgICAgICAgICB7IGxhYmVsOiAnRElTQ0FSRCAyIENPUFBFUicsIGFjdGlvbjogMiB9LFxuICAgICAgICAgIHsgbGFiZWw6ICdESVNDQVJEIDYgQ0FSRFMnLCBhY3Rpb246IDMgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRDYXJkSWRzOiBDYXJkSWRbXSA9IFtdO1xuICAgICAgbGV0IGdhaW5Hb2xkID0gZmFsc2U7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBhdHRhY2tgLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kQ2FyZHMuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdBVFRBQ0snKSkubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgY291bnQ6IHsga2luZDogJ3VwVG8nLCBjb3VudDogaGFuZC5sZW5ndGggfSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIGdhaW5Hb2xkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDIpIHtcbiAgICAgICAgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIDIgY29wcGVyYCxcbiAgICAgICAgICByZXN0cmljdDogaGFuZENhcmRzLmZpbHRlcihjYXJkID0+IGNhcmQudHlwZS5pbmNsdWRlcygnQVRUQUNLJykpLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgIGNvdW50OiB7IGtpbmQ6ICd1cFRvJywgY291bnQ6IGhhbmQubGVuZ3RoIH0sXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBnYWluR29sZCA9IHNlbGVjdGVkQ2FyZElkcy5sZW5ndGggPT09IDI7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIDYgY2FyZHNgLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgIGNvdW50OiA2LFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgZ2FpbkdvbGQgPSBzZWxlY3RlZENhcmRJZHMubGVuZ3RoID09PSA2O1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtxdWVzdCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoZ2FpbkdvbGQpIHtcbiAgICAgICAgY29uc3QgZ29sZENhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgeyBjYXJkS2V5czogJ2dvbGQnIH1cbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWdvbGRDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3F1ZXN0IGVmZmVjdF0gbm8gZ29sZCBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbcXVlc3QgZWZmZWN0XSBnYWluaW5nICR7Z29sZENhcmRzLnNsaWNlKC0xKVswXX1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogZ29sZENhcmRzLnNsaWNlKC0xKVswXSxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnc2F2ZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZXZlbnQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC5ldmVudHMuZmluZChlID0+IGUuaWQgPT09IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbc2F2ZSBlZmZlY3RdIGV2ZW50IG5vdCBmb3VuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBTZXQgYXNpZGUgY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzYXZlIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzYXZlIGVmZmVjdF0gc2V0dGluZyBhc2lkZSBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAnc2V0LWFzaWRlJyB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZShldmVudCwgJ2VuZFR1cm4nLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzYXZlIGVuZFR1cm4gZWZmZWN0XSBtb3ZpbmcgJHtzZWxlY3RlZENhcmR9IHRvIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSBoYW5kYClcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBwcmljZVVuc3ViID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5yZWdpc3RlclJ1bGUoXG4gICAgICAgIGV2ZW50LFxuICAgICAgICAoY2FyZCwgY29udGV4dCkgPT4ge1xuICAgICAgICAgIGlmIChjb250ZXh0LnBsYXllcklkID09PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIHsgcmVzdHJpY3RlZDogdHJ1ZSwgY29zdDogY2FyZC5jb3N0IH07XG4gICAgICAgICAgcmV0dXJuIHsgcmVzdHJpY3RlZDogZmFsc2UsIGNvc3Q6IGNhcmQuY29zdCB9O1xuICAgICAgICB9XG4gICAgICApO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJTeXN0ZW1UZW1wbGF0ZShldmVudCwgJ2VuZFR1cm4nLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgcHJpY2VVbnN1YigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdzY291dGluZy1wYXJ0eSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZXZlbnQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC5ldmVudHMuZmluZChlID0+IGUuaWQgPT09IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbc2NvdXRpbmctcGFydHkgZWZmZWN0XSBldmVudCBub3QgZm91bmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzU2V0QXNpZGU6IENhcmRJZFtdID0gW107XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICAgIGlmICghZGVjay5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Njb3V0aW5nLXBhcnR5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghZGVjay5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2NvdXRpbmctcGFydHkgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrIHN0aWxsYCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNhcmRJZHNTZXRBc2lkZS5wdXNoKGRlY2suc2xpY2UoLTEpWzBdKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBkZWNrLnNsaWNlKC0xKVswXSxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3NldC1hc2lkZScgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKCFjYXJkSWRzU2V0QXNpZGUubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2NvdXRpbmctcGFydHkgZWZmZWN0XSBubyBjYXJkcyBzZXQgYXNpZGVgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiAnRGlzY2FyZCAzIGNhcmRzJyxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIGNhcmRJZHM6IGNhcmRJZHNTZXRBc2lkZSxcbiAgICAgICAgICBzZWxlY3RDb3VudDogTWF0aC5taW4oMywgY2FyZElkc1NldEFzaWRlLmxlbmd0aClcbiAgICAgICAgfVxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkSWRbXSB9O1xuICAgICAgXG4gICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW3Njb3V0aW5nLXBhcnR5IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc2NvdXRpbmctcGFydHkgZWZmZWN0XSBkaXNjYXJkaW5nICR7cmVzdWx0LnJlc3VsdC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjYXJkSWQgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHNUb1JlYXJyYW5nZSA9IGNhcmRJZHNTZXRBc2lkZS5maWx0ZXIoaWQgPT4gIXJlc3VsdC5yZXN1bHQuaW5jbHVkZXMoaWQpKTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkSWRzVG9SZWFycmFuZ2UubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2NvdXRpbmctcGFydHkgZWZmZWN0XSBubyBjYXJkcyB0byByZWFycmFuZ2VgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoY2FyZElkc1RvUmVhcnJhbmdlLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3Njb3V0aW5nLXBhcnR5IGVmZmVjdF0gb25lIGNhcmQgbGVmdCwgbW92aW5nIHRvIGRlY2tgKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkSWRzVG9SZWFycmFuZ2VbMF0sXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiAnUHV0IGJhY2sgaW4gYW55IG9yZGVyJyxcbiAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogJ0RPTkUnLCBhY3Rpb246IDEgfV0sXG4gICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgdHlwZTogJ3JlYXJyYW5nZScsXG4gICAgICAgICAgICBjYXJkSWRzOiBjYXJkSWRzVG9SZWFycmFuZ2VcbiAgICAgICAgICB9XG4gICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgXG4gICAgICAgIGlmICghcmVzdWx0LnJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtzY291dGluZy1wYXJ0eSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2NvdXRpbmctcGFydHkgZWZmZWN0XSBwdXR0aW5nIGNhcmRzICR7cmVzdWx0LnJlc3VsdH0gYmFjayBvbiBkZWNrYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiByZXN1bHQucmVzdWx0KSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICd0cmFkZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZXZlbnQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC5ldmVudHMuZmluZChlID0+IGUuaWQgPT09IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbdHJhZGUgZWZmZWN0XSBldmVudCBub3QgZm91bmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZHNgLFxuICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgY291bnQ6IDJcbiAgICAgICAgfSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt0cmFkZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzaWx2ZXJDYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgeyBjYXJkS2V5czogJ3NpbHZlcicgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghc2lsdmVyQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdHJhZGUgZWZmZWN0XSBubyBzaWx2ZXIgY2FyZHMgaW4gc3VwcGx5YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt0cmFkZSBlZmZlY3RdIGdhaW5pbmcgJHtzZWxlY3RlZENhcmRJZHMubGVuZ3RofSBzaWx2ZXIgY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZENhcmRJZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgc2lsdmVyQ2FyZCA9IHNpbHZlckNhcmRzLnNsaWNlKC1pIC0gMSlbMF07XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNpbHZlckNhcmQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3RyYWRlIGVmZmVjdF0gbm8gc2lsdmVyIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNpbHZlckNhcmQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3RyYXZlbGxpbmctZmFpcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZXZlbnQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC5ldmVudHMuZmluZChlID0+IGUuaWQgPT09IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbdHJhdmVsbGluZy1mYWlyIGVmZmVjdF0gZXZlbnQgbm90IGZvdW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZShldmVudCwgJ2NhcmRHYWluZWQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IGZhbHNlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICBjb25zdCBjYXJkID0gdHJpZ2dlcmVkQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHRyaWdnZXJlZEFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFt0cmF2ZWxsaW5nLWZhaXIgY2FyZEdhaW5lZCBlZmZlY3RdIHB1dHRpbmcgJHtjYXJkfSBvbiBkZWNrYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclN5c3RlbVRlbXBsYXRlKGV2ZW50LCAnZW5kVHVybicsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogZmFsc2UsXG4gICAgICAgIGNvbXB1bHNvcnk6IGZhbHNlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jICgpID0+IHRydWUsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICB0cmlnZ2VyZWRBcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgdHJhdmVsbGluZy1mYWlyOiR7Y2FyZEVmZmVjdEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBlZmZlY3RNYXA7Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLFNBQVMsY0FBYyxRQUFRLG1DQUFtQztBQUVsRSxTQUFTLFlBQVksUUFBUSxnQ0FBZ0M7QUFFN0QsTUFBTSxZQUFpQztFQUNyQyxRQUFRO0lBQ04saUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFFBQVEsZUFBZSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBLElBQUssRUFBRSxFQUFFLEtBQUssZUFBZSxNQUFNO1FBQ2xGLElBQUksQ0FBQyxPQUFPO1FBRVosTUFBTSxZQUEyQixDQUFDLE1BQU07VUFDdEMsSUFBSSxRQUFRLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQUUsWUFBWTtZQUFN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
// denoCacheMetadata=14063601864431589707,6006523058222308491