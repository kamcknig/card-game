import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
const cardEffects = {
  'abandoned-mine': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[abandoned mine effect] gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'altar': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[altar effect] no card selected`);
          return;
        }
        const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardToTrash.id
        });
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: [
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              kind: 'upTo',
              amount: {
                treasure: 5
              },
              playerId: cardEffectArgs.playerId
            }
          ],
          count: 1
        });
        if (!selectedCardIds) {
          console.log(`[altar effect] no card selected`);
          return;
        }
        const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[altar effect] gaining card ${cardToGain}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardToGain.id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'armory': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: [
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
          ],
          count: 1
        });
        if (!selectedCardIds.length) {
          console.log(`[armory effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[armory effect] gaining card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'playerDeck'
          }
        });
      }
  },
  'band-of-misfits': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        const { cost: thisCost } = cardEffectArgs.cardPriceController.applyRules(thisCard, {
          playerId: cardEffectArgs.playerId
        });
        const cardIds = cardEffectArgs.findCards([
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
              treasure: thisCost.treasure - 1
            }
          }
        ]).filter((card)=>card.type.includes('ACTION') && !card.type.some((t)=>[
              'DURATION',
              'COMMAND'
            ].includes(t)));
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play card`,
          restrict: cardIds.map((card)=>card.id),
          count: 1
        });
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
        });
      }
  },
  'bandit-camp': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[bandit camp effect] drawing 1 card and gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const spoilsCards = cardEffectArgs.findCards([
          {
            location: 'nonSupplyCards'
          },
          {
            kingdom: 'spoils'
          }
        ]);
        if (!spoilsCards.length) {
          console.log(`[bandit camp effect] no spoils cards in non-supply`);
          return;
        }
        console.log(`[bandit camp effect] gaining ${spoilsCards.slice(-1)[0]}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: spoilsCards.slice(-1)[0].id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'beggar': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`beggar:${eventArgs.cardId}:cardPlayed`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `beggar:${eventArgs.cardId}:cardPlayed`,
            playerId: eventArgs.playerId,
            listeningFor: 'cardPlayed',
            once: false,
            allowMultipleInstances: true,
            compulsory: false,
            condition: (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
              const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!card.type.includes('ATTACK')) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              const thisCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);
              console.log(`[beggar triggered effect] discarding ${thisCard}`);
              await triggeredArgs.runGameActionDelegate('discardCard', {
                cardId: thisCard.id,
                playerId: eventArgs.playerId
              });
              const silverCards = triggeredArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'silver'
                }
              ]);
              const numToGain = Math.min(2, silverCards.length);
              if (numToGain < 1) {
                console.log(`[beggar triggered effect] not enough silver in supply`);
                return;
              }
              console.log(`[beggar triggered effect] number of silvers to gain ${numToGain}, one of them to deck`);
              for(let i = 0; i < numToGain; i++){
                await triggeredArgs.runGameActionDelegate('gainCard', {
                  playerId: eventArgs.playerId,
                  cardId: silverCards.slice(-i - 1)[0],
                  to: {
                    location: i === 0 ? 'playerDeck' : 'playerDiscard'
                  }
                });
              }
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const copperCards = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'copper'
          }
        ]);
        const numToGain = Math.min(3, copperCards.length);
        console.log(`[beggar effect] gaining ${numToGain} coppers`);
        for(let i = 0; i < numToGain; i++){
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: copperCards.slice(-i - 1)[0],
            to: {
              location: 'playerHand'
            }
          });
        }
      }
  },
  'catacombs': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          const { cost } = args.cardPriceController.applyRules(card, {
            playerId: eventArgs.playerId
          });
          const cheaperCards = args.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              kind: 'upTo',
              playerId: eventArgs.playerId,
              amount: {
                treasure: cost.treasure - 1
              }
            }
          ]);
          if (!cheaperCards.length) {
            console.log(`[catacombs onTrashed effect] no cards costing less than ${cost.treasure - 1}`);
            return;
          }
          const selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: eventArgs.playerId,
            prompt: `Gain card`,
            restrict: cheaperCards.map((card)=>card.id),
            count: 1
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
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        let numToLookAt = 3;
        if (deck.length < 3) {
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
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
            {
              label: 'PUT IN HAND',
              action: 1
            },
            {
              label: 'DISCARD AND DRAW',
              action: 2
            }
          ],
          content: {
            type: 'display-cards',
            cardIds: cardsToLookAt
          }
        });
        if (result.action === 1) {
          console.log(`[catacombs effect] moving ${cardsToLookAt.length} cards to hand`);
          for(let i = 0; i < cardsToLookAt.length; i++){
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId: cardsToLookAt[i],
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerHand'
              }
            });
          }
        } else {
          console.log(`[catacombs effect] discarding ${cardsToLookAt.length} cards`);
          for(let i = 0; i < cardsToLookAt.length; i++){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: cardsToLookAt[i],
              playerId: cardEffectArgs.playerId
            });
          }
          console.log(`[catacombs effect] drawing 3 cards`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 3
          });
        }
      }
  },
  'count': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        let result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'DISCARD 2 CARDS',
              action: 1
            },
            {
              label: 'TOP-DECK CARD',
              action: 2
            },
            {
              label: 'GAIN 1 COPPER',
              action: 3
            }
          ]
        });
        switch(result.action){
          case 1:
            {
              const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
              const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
                playerId: cardEffectArgs.playerId,
                prompt: `Discard Cards`,
                restrict: hand,
                count: Math.min(2, hand.length)
              });
              if (!selectedCardIds.length) {
                console.warn(`[count effect] no card selected`);
                break;
              }
              for(let i = 0; i < selectedCardIds.length; i++){
                const id = selectedCardIds[i];
                await cardEffectArgs.runGameActionDelegate('discardCard', {
                  cardId: id,
                  playerId: cardEffectArgs.playerId
                });
              }
              break;
            }
          case 2:
            {
              const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
                playerId: cardEffectArgs.playerId,
                prompt: `Top-deck card`,
                restrict: {
                  location: 'playerHand',
                  playerId: cardEffectArgs.playerId
                },
                count: 1
              });
              if (!selectedCardIds.length) {
                console.warn(`[count effect] no card selected`);
                break;
              }
              const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
              console.log(`[count effect] moving ${selectedCard} to deck`);
              await cardEffectArgs.runGameActionDelegate('moveCard', {
                cardId: selectedCard.id,
                toPlayerId: cardEffectArgs.playerId,
                to: {
                  location: 'playerDeck'
                }
              });
              break;
            }
          case 3:
            {
              const copperCards = cardEffectArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'copper'
                }
              ]);
              if (!copperCards.length) {
                console.log(`[count effect] no coppers in supply`);
                break;
              }
              console.log(`[count effect] gaining 1 copper`);
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: copperCards.slice(-1)[0].id,
                to: {
                  location: 'playerDiscard'
                }
              });
              break;
            }
        }
        result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: '+3 TREASURE',
              action: 1
            },
            {
              label: 'TRASH HAND',
              action: 2
            },
            {
              label: 'GAIN DUCHY',
              action: 3
            }
          ]
        });
        switch(result.action){
          case 1:
            {
              console.log(`[count effect] gaining 3 treasure`);
              await cardEffectArgs.runGameActionDelegate('gainTreasure', {
                count: 3
              });
              break;
            }
          case 2:
            {
              const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
              console.log(`[count effect] trashing ${hand.length} cards`);
              for (const cardId of [
                ...hand
              ]){
                await cardEffectArgs.runGameActionDelegate('trashCard', {
                  playerId: cardEffectArgs.playerId,
                  cardId
                });
              }
              break;
            }
          case 3:
            {
              const duchyCards = cardEffectArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'duchy'
                }
              ]);
              if (!duchyCards.length) {
                console.log(`[count effect] no duchies in supply`);
                break;
              }
              console.log(`[count effect] gaining 1 duchy`);
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: duchyCards.slice(-1)[0],
                to: {
                  location: 'playerDiscard'
                }
              });
              break;
            }
        }
      }
  },
  'counterfeit': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[counterfeit effect] gaining 1 treasure, and 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const nonDurationTreasureCards = cardEffectArgs.findCards([
          {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          {
            cardType: 'TREASURE'
          }
        ]).filter((card)=>!card.type.includes('DURATION'));
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play treasure`,
          restrict: nonDurationTreasureCards.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[counterfeit effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[counterfeit effect] playing card ${selectedCard} twice`);
        for(let i = 0; i < 2; i++){
          await cardEffectArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            overrides: {
              actionCost: 0
            }
          });
        }
        console.log(`[counterfeit effect] trashing ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
      }
  },
  'cultist': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          console.log(`[cultist onTrashed effect] drawing 3 cards`);
          await args.runGameActionDelegate('drawCard', {
            playerId: eventArgs.playerId,
            count: 3
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[cultist effect] drawing 2 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const ruinsCards = cardEffectArgs.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              kingdom: 'ruins'
            }
          ]);
          if (!ruinsCards.length) {
            console.log(`[cultist effect] no ruins cards in non-supply`);
            break;
          }
          console.log(`[cultist effect] player ${targetPlayerId} gaining ${ruinsCards.slice(-1)[0]}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: ruinsCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
        const cultistsInHand = cardEffectArgs.findCards([
          {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          {
            cardKeys: 'cultist'
          }
        ]);
        if (!cultistsInHand.length) {
          console.log(`[cultist effect] no cultists in hand`);
          return;
        }
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Play Cultist?',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'CANCEL',
              action: 1
            },
            {
              label: 'PLAY',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[cultist effect] cancelling play of cultist`);
          return;
        }
        console.log(`[cultist effect] playing cultist`);
        await cardEffectArgs.runGameActionDelegate('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cultistsInHand.slice(-1)[0].id,
          overrides: {
            actionCost: 0
          }
        });
      }
  },
  'dame-anna': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash cards`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: 2
          },
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[dame-anna effect] no card selected`);
        }
        console.log(`[dame-anna effect] trashing ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId
          });
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[dame-anna effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[dame-anna effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[dame-anna effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[dame-anna effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
            }
          }
          if (cardToTrash) {
            console.log(`[dame-anna effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[dame-anna effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: cardEffectArgs.playerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[dame-anna effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'dame-josephine': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[dame-baily effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[dame-baily effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[dame-baily effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[dame-baily effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[dame-baily effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[dame-baily effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[dame-baily effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'dame-molly': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[dame-molly effect] gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[dame-baily effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[dame-baily effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[dame-baily effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[dame-baily effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[dame-baily effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[dame-baily effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[dame-baily effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'dame-natalie': {
    registerEffects: ()=>async (cardEffectArgs)=>{
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
              treasure: 3
            }
          }
        ]);
        if (!cards.length) {
          console.log(`[dame-natalie effect] no cards in supply`);
        } else {
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: cards.map((card)=>card.id),
            count: 1,
            optional: true
          });
          if (!selectedCardIds.length) {
            console.log(`[dame-natalie effect] no card selected`);
          } else {
            const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
            console.log(`[dame-natalie effect] gaining ${selectedCard}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCard.id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[dame-baily effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[dame-baily effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[dame-baily effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[dame-baily effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[dame-baily effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[dame-baily effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[dame-baily effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'dame-sylvia': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[dame-sylvia effect] gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[dame-baily effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[dame-baily effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[dame-baily effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[dame-baily effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[dame-baily effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[dame-baily effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[dame-baily effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'death-cart': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const ruinCards = args.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              kingdom: 'ruins'
            }
          ]);
          const numToGain = Math.min(2, ruinCards.length);
          console.log(`[death cart onGained effect] gaining ${numToGain} ruins`);
          for(let i = 0; i < numToGain; i++){
            await args.runGameActionDelegate('gainCard', {
              playerId: eventArgs.playerId,
              cardId: ruinCards.slice(-i - 1)[0],
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const actionCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('ACTION'));
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card?`,
          restrict: [
            ...actionCardsInHand.map((card)=>card.id),
            cardEffectArgs.cardId
          ],
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[death cart effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[death cart effect] trashing card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
        console.log(`[death cart effect] gaining 5 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 5
        });
      }
  },
  'feodum': {
    registerScoringFunction: ()=>(args)=>{
        const ownedSilvers = args.findCards([
          {
            owner: args.ownerId
          },
          {
            cardKeys: 'silver'
          }
        ]);
        const amount = Math.floor(ownedSilvers.length / 3);
        return amount;
      },
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArg)=>{
          const silverCards = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'silver'
            }
          ]);
          const numToGain = Math.min(3, silverCards.length);
          console.log(`[feodum onTrashed effect] gaining ${numToGain} silvers`);
          for(let i = 0; i < numToGain; i++){
            await args.runGameActionDelegate('gainCard', {
              playerId: eventArg.playerId,
              cardId: silverCards.slice(-i - 1)[0],
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      })
  },
  'forager': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[forager effect] gaining 1 action, and 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: hand,
          count: 1
        });
        if (selectedCardIds.length === 0) {
          console.log(`[forager effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[forager effect] trashing card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
        const trash = cardEffectArgs.cardSourceController.getSource('trash');
        const uniqueTreasuresInTrash = new Set(trash.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE')).map((card)=>card.cardKey)).size;
        console.log(`[forager effect] gaining ${uniqueTreasuresInTrash} treasure`);
        if (uniqueTreasuresInTrash > 0) {
          await cardEffectArgs.runGameActionDelegate('gainTreasure', {
            count: uniqueTreasuresInTrash
          });
        }
      }
  },
  'fortress': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          console.log(`[fortress onTrashed effect] putting fortress back in hand`);
          await args.runGameActionDelegate('moveCard', {
            cardId: eventArgs.cardId,
            toPlayerId: eventArgs.playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[fortress effect] drawing 1 card, and gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
      }
  },
  'graverobber': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'GAIN CARD',
              action: 1
            },
            {
              label: 'TRASH CARD',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          const trashCards = cardEffectArgs.findCards([
            {
              location: 'trash'
            }
          ]).filter((card)=>{
            const cost = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: cardEffectArgs.playerId
            });
            return cost.cost.treasure >= 3 && cost.cost.treasure <= 6;
          });
          if (!trashCards.length) {
            console.log(`[graverobber effect] no cards in trash`);
            return;
          }
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Gain card',
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'select',
              cardIds: trashCards.map((card)=>card.id),
              selectCount: 1
            }
          });
          if (!result.cardIds) {
            console.warn(`[graverobber effect] no card selected`);
            return;
          }
          const card = cardEffectArgs.cardLibrary.getCard(result.cardIds[0]);
          console.log(`[graverobber effect] gaining card ${card}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: card.id,
            to: {
              location: 'playerDeck'
            }
          });
        } else {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          const actionsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('ACTION'));
          if (!actionsInHand.length) {
            console.log(`[graverobber effect] no actions in hand`);
            return;
          }
          let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash action`,
            restrict: actionsInHand.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[graverobber effect] no card selected`);
            return;
          }
          let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[graverobber effect] trashing card ${selectedCard}`);
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id
          });
          const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
            playerId: cardEffectArgs.playerId
          });
          const cards = cardEffectArgs.findCards([
            {
              location: [
                'kingdomSupply',
                'basicSupply'
              ]
            },
            {
              kind: 'upTo',
              playerId: cardEffectArgs.playerId,
              amount: {
                treasure: cost.treasure + 3,
                potion: cost.potion
              }
            }
          ]);
          if (!cards.length) {
            console.log(`[graverobber effect] no cards in supply that cost <= ${cost.treasure + 3}`);
            return;
          }
          selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: cards.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[graverobber effect] no card selected`);
            return;
          }
          selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[graverobber effect] gaining ${selectedCard}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'hermit': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
        let nonTreasureCards = discard.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>!card.type.includes('TREASURE'));
        let selectedCard = undefined;
        if (discard.length > 0) {
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Trash from discard?',
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'select',
              cardIds: discard,
              selectableCardIds: nonTreasureCards.map((card)=>card.id),
              selectCount: 1
            },
            actionButtons: [
              {
                label: 'GO TO HAND',
                action: 1
              }
            ]
          });
          if (result.action === 1) {
            console.warn(`[hermit effect] no card selected from discard`);
          } else if (result.result.length > 0) {
            selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
            console.log(`[hermit effect] selected ${selectedCard} from discard`);
          }
        } else {
          console.log(`[hermit effect] no cards in discard`);
        }
        if (!selectedCard) {
          console.log(`[hermit effect] selecting card from hand`);
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          nonTreasureCards = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>!card.type.includes('TREASURE'));
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: nonTreasureCards.map((card)=>card.id),
            count: 1,
            optional: true
          });
          if (!selectedCardIds.length) {
            console.log(`[hermit effect] not trashing from hand`);
          } else {
            selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          }
        }
        if (!selectedCard) {
          console.log(`[hermit effect] no card selected to trash`);
        } else {
          console.log(`[hermit effect] trashing card ${selectedCard}`);
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id
          });
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
              treasure: 3
            }
          }
        ]);
        if (!cards.length) {
          console.log(`[hermit effect] no cards in supply that cost <= 3`);
        } else {
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: cards.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[hermit effect] no card selected`);
          } else {
            const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
            console.log(`[hermit effect] gaining ${selectedCard}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCard.id,
              to: {
                location: 'playerDiscard'
              }
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
          condition: (conditionArgs)=>{
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
            if (getCurrentPlayer(conditionArgs.match).id !== cardEffectArgs.playerId) return false;
            const cardIdsGained = conditionArgs.match.stats.cardsGainedByTurn[conditionArgs.match.turnNumber] ?? [];
            const cardIdsGainedDuringBuyPhase = cardIdsGained.filter((cardId)=>{
              const stats = conditionArgs.match.stats.cardsGained[cardId];
              return stats.playerId === cardEffectArgs.playerId && stats.turnPhase === 'buy';
            });
            if (cardIdsGainedDuringBuyPhase.length > 0) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            const madmanCards = triggeredArgs.findCards([
              {
                location: 'nonSupplyCards'
              },
              {
                kingdom: 'madman'
              }
            ]);
            if (!madmanCards.length) {
              console.log(`[hermit endTurnPhase effect] no madman in supply`);
              return;
            }
            const hermitCard = triggeredArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[hermit endTurnPhase effect] moving ${hermitCard} to supply`);
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId: hermitCard.id,
              to: {
                location: 'kingdomSupply'
              }
            });
            const card = madmanCards.slice(-1)[0];
            console.log(`[hermit endTurnPhase effect] gaining ${card}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        });
      }
  },
  'hovel': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`hovel:${eventArgs.cardId}:cardGained`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `hovel:${eventArgs.cardId}:cardGained`,
            playerId: eventArgs.playerId,
            listeningFor: 'cardGained',
            once: true,
            compulsory: false,
            allowMultipleInstances: true,
            condition: (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
              const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!card.type.includes('VICTORY')) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              const hovelCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);
              console.log(`[hovel gainCard effect] trashing ${hovelCard}`);
              await triggeredArgs.runGameActionDelegate('trashCard', {
                playerId: eventArgs.playerId,
                cardId: hovelCard.id
              });
            }
          });
        }
      })
  },
  'hunting-grounds': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          const result = await args.runGameActionDelegate('userPrompt', {
            prompt: 'Choose to gain',
            playerId: eventArgs.playerId,
            actionButtons: [
              {
                label: '1 Duchy',
                action: 1
              },
              {
                label: '3 Estates',
                action: 2
              }
            ]
          });
          let cards;
          let numToGain;
          if (result.action === 1) {
            cards = args.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'duchy'
              }
            ]);
            numToGain = Math.min(1, cards.length);
          } else {
            cards = args.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'estate'
              }
            ]);
            numToGain = Math.min(3, cards.length);
          }
          if (!numToGain) {
            console.log(`[hunting-grounds onTrashed effect] no cards to gain`);
          }
          console.log(`[hunting-grounds onTrashed effect] gaining ${numToGain} ${result.action === 1 ? 'duchy' : 'estate'}`);
          for(let i = 0; i < numToGain; i++){
            await args.runGameActionDelegate('gainCard', {
              playerId: eventArgs.playerId,
              cardId: cards.slice(-1)[0].id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[hunting-grounds effect] drawing 4 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 4
        });
      }
  },
  'ironmonger': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[ironmonger effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (deck.length === 0) {
          console.log(`[ironmonger effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
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
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: `Discard ${card.cardName}?`,
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'CANCEL',
              action: 1
            },
            {
              label: 'DISCARD',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[ironmonger effect] not discarding, moving ${card} back to deck`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: {
              location: 'playerDeck'
            }
          });
        } else {
          console.log(`[ironmonger effect] discarding ${card}`);
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId
          });
        }
        if (card.type.includes('ACTION')) {
          console.log(`[ironmonger effect] card is action type, gaining 1 action`);
          await cardEffectArgs.runGameActionDelegate('gainAction', {
            count: 1
          });
        }
        if (card.type.includes('TREASURE')) {
          console.log(`[ironmonger effect] card is treasure type, gaining 1 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', {
            count: 1
          });
        }
        if (card.type.includes('VICTORY')) {
          console.log(`[ironmonger effect] card is a victory card, gaining 1 victory point`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'junk-dealer': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[junk-dealer effect] drawing 1 card, and gaining 1 action and 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.log(`[junk-dealer effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[junk-dealer effect] trashing card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
      }
  },
  'madman': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[madman effect] moving ${thisCard} back to non supply`);
        const result = await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: thisCard.id,
          to: {
            location: 'nonSupplyCards'
          }
        });
        if (result) {
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          console.log(`[madman effect] drawing ${hand.length} cards`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: hand.length
          });
        }
      }
  },
  'marauder': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const spoilCards = cardEffectArgs.findCards([
          {
            location: 'nonSupplyCards'
          },
          {
            kingdom: 'spoils'
          }
        ]);
        if (!spoilCards.length) {
          console.log(`[marauder effect] no spoils in supply`);
        } else {
          console.log(`[marauder effect] gaining ${spoilCards.slice(-1)[0]}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: spoilCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
        const ruinCards = cardEffectArgs.findCards([
          {
            location: 'kingdomSupply'
          },
          {
            kingdom: 'ruins'
          }
        ]);
        if (!ruinCards.length) {
          console.log(`[marauder effect] no ruins in supply`);
          return;
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        if (targetPlayerIds.length > ruinCards.length) {
          targetPlayerIds.length = ruinCards.length;
        }
        console.log(`[marauder effect] targeting ${targetPlayerIds.length} players to gain ruins`);
        for (const targetPlayerId of targetPlayerIds){
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: ruinCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'market-square': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`market-square:${eventArgs.cardId}:cardTrashed`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `market-square:${eventArgs.cardId}:cardTrashed`,
            listeningFor: 'cardTrashed',
            playerId: eventArgs.playerId,
            once: false,
            compulsory: false,
            allowMultipleInstances: true,
            condition: (conditionArgs)=>{
              const trashedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (trashedCard.owner !== eventArgs.playerId) return false;
              if (conditionArgs.trigger.args.previousLocation.location !== 'playerHand') return false;
              if (conditionArgs.trigger.args.previousLocation.playerId !== eventArgs.playerId) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              const marketSquareCard = triggeredArgs.cardLibrary.getCard(eventArgs.cardId);
              console.log(`[market-square cardTrashed effect] discarding ${marketSquareCard}`);
              await triggeredArgs.runGameActionDelegate('discardCard', {
                cardId: marketSquareCard.id,
                playerId: eventArgs.playerId
              });
              const goldCards = triggeredArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'gold'
                }
              ]);
              if (!goldCards.length) {
                console.log(`[market-square cardTrashed effect] no gold cards in supply`);
                return;
              }
              console.log(`[market-square cardTrashed effect] gaining ${goldCards.slice(-1)[0]}`);
              await triggeredArgs.runGameActionDelegate('gainCard', {
                playerId: eventArgs.playerId,
                cardId: goldCards.slice(-1)[0].id,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[market-square effect] drawing 1 card, gaining 1 action, and 1 buy`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
      }
  },
  'mercenary': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash cards?`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: Math.min(2, hand.length)
          },
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[mercenary effect] no cards selected`);
          return;
        }
        console.log(`[mercenary effect] trashing ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId
          });
        }
        if (selectedCardIds.length === 1) {
          console.log(`[mercenary effect] only one card trashed`);
          return;
        }
        console.log(`[mercenary effect] drawing 2 cards, and gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          if (hand.length <= 3) {
            console.log(`[mercenary effect] ${targetPlayerId} has 3 or fewer cards in hand, skipping`);
            continue;
          }
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Discard to 3`,
            restrict: hand,
            count: hand.length - 3
          });
          if (selectedCardIds.length === 0) {
            console.warn(`[mercenary effect] no cards selected`);
            continue;
          }
          console.log(`[mercenary effect] player ${targetPlayerId} discarding ${selectedCardIds.length} cards`);
          for (const selectedCardId of selectedCardIds){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              playerId: targetPlayerId,
              cardId: selectedCardId
            });
          }
        }
      }
  },
  'mystic': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[mystic effect] gaining 1 action, and 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Name a card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'name-card'
          }
        });
        const namedCardKey = result.result;
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (!deck.length) {
          console.log(`[mystic effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
          if (!deck.length) {
            console.log(`[mystic effect] still no cards in deck`);
            return;
          }
        }
        const revealedCard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
        console.log(`[mystic effect] revealing ${revealedCard}`);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: revealedCard.id,
          playerId: cardEffectArgs.playerId
        });
        if (revealedCard.cardKey === namedCardKey) {
          console.log(`[mystic effect] moving revealed card to hand`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: revealedCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: {
              location: 'playerHand'
            }
          });
        } else {
          console.log(`[mystic effect] not moving card to hand`);
        }
      }
  },
  'necropolis': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[necropolis effect] gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
      }
  },
  'overgrown-estate': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          if (card.owner !== eventArgs.playerId) return;
          console.log(`[overgrown-estate onTrashed effect] drawing 1 card`);
          await args.runGameActionDelegate('drawCard', {
            playerId: eventArgs.playerId
          });
        }
      })
  },
  'pillage': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[pillage effect] trashing pillage`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId
        });
        const spoilsCards = cardEffectArgs.findCards([
          {
            location: 'nonSupplyCards'
          },
          {
            kingdom: 'spoils'
          }
        ]);
        if (!spoilsCards.length) {
          console.log(`[pillage effect] no spoils in supply`);
          return;
        }
        const numToGain = Math.min(2, spoilsCards.length);
        console.log(`[pillage effect] gaining ${numToGain} spoils`);
        for(let i = 0; i < numToGain; i++){
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: spoilsCards.slice(-i - 1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity' && cardEffectArgs.cardSourceController.getSource('playerHand', playerId).length >= 5);
        for (const targetPlayerId of targetPlayerIds){
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          console.log(`[pillage effect] revealing player ${targetPlayerId} hand`);
          for (const cardId of [
            ...hand
          ]){
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId,
              playerId: targetPlayerId
            });
          }
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `Discard card for ${getPlayerById(cardEffectArgs.match, targetPlayerId)?.name}`,
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'select',
              cardIds: hand,
              selectCount: 1
            }
          });
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
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[poor-house effect] gaining 4 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 4
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        console.log(`[poor-house effect] revealing player ${cardEffectArgs.playerId} hand`);
        for (const cardId of [
          ...hand
        ]){
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId,
            playerId: cardEffectArgs.playerId
          });
        }
        const treasureCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE'));
        console.log(`[poor-house effect] losing ${treasureCardsInHand.length} treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: -treasureCardsInHand.length
        });
      }
  },
  'procession': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const nonDurationActionCardsInHand = cardEffectArgs.findCards([
          {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          }
        ]).filter((card)=>!card.type.includes('DURATION') && card.type.includes('ACTION'));
        if (!nonDurationActionCardsInHand.length) {
          console.log(`[procession effect] no non-duration action cards in hand`);
          return;
        }
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play card`,
          restrict: nonDurationActionCardsInHand.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[procession effect] no card selected`);
          return;
        }
        let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[procession effect] playing card ${selectedCard} twice`);
        for(let i = 0; i < 2; i++){
          await cardEffectArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id
          });
        }
        console.log(`[procession effect] trashing ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId
        });
        const cards = cardEffectArgs.findCards([
          {
            location: 'kingdomSupply'
          },
          {
            kind: 'exact',
            playerId: cardEffectArgs.playerId,
            amount: {
              treasure: cost.treasure + 1,
              potion: cost.potion
            }
          }
        ]);
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[procession effect] no card selected`);
          return;
        }
        selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[procession effect] gaining card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'rats': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          const trashedCard = args.cardLibrary.getCard(eventArgs.cardId);
          if (args.match.stats.trashedCards[eventArgs.cardId].playerId !== trashedCard.owner) {
            return;
          }
          console.log(`[rats onTrashed effect] drawing 1 card`);
          await args.runGameActionDelegate('drawCard', {
            playerId: eventArgs.playerId
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[rats effect] drawing 1 card, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const ratCards = cardEffectArgs.findCards([
          {
            location: 'kingdomSupply'
          },
          {
            cardKeys: 'rats'
          }
        ]);
        if (!ratCards.length) {
          console.log(`[rats effect] no rats in supply to gain`);
        }
        const ratCard = ratCards.slice(-1)[0];
        console.log(`[rats effect] gaining card ${ratCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: ratCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const nonRatCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.cardKey !== 'rats');
        if (!nonRatCardsInHand.length) {
          console.log(`[rats effect] no non-rat cards in hand to trash, revealing`);
          for (const cardId of [
            ...hand
          ]){
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId,
              playerId: cardEffectArgs.playerId
            });
          }
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Trash card',
          restrict: nonRatCardsInHand.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[rats effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[rats effect] trashing card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
      }
  },
  'rebuild': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[rebuild effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Name a card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'name-card'
          }
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        let cardFound = undefined;
        const cardsToDiscard = [];
        while(true){
          let cardId = deck.slice(-1)[0];
          if (!cardId) {
            console.log(`[rebuild effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
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
            moveToSetAside: true
          });
          if (card.type.includes('VICTORY') && card.cardKey !== result.result) {
            cardFound = card;
            break;
          } else {
            cardsToDiscard.push(card);
          }
        }
        console.log(`[rebuild effect] discarding ${cardsToDiscard.length} cards`);
        for (const card of cardsToDiscard){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId
          });
        }
        if (cardFound) {
          console.log(`[rebuild effect] trashing ${cardFound}`);
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardFound.id
          });
          const { cost } = cardEffectArgs.cardPriceController.applyRules(cardFound, {
            playerId: cardEffectArgs.playerId
          });
          const cards = cardEffectArgs.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              cardType: 'VICTORY'
            },
            {
              kind: 'upTo',
              playerId: cardEffectArgs.playerId,
              amount: {
                treasure: cost.treasure + 3,
                potion: cost.potion
              }
            }
          ]);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: cards.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[rebuild effect] no card selected`);
            return;
          }
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[rebuild effect] gaining card ${selectedCard}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'rogue': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[rogue effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const cards = cardEffectArgs.findCards({
          location: 'trash'
        }).filter((card)=>{
          const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
            playerId: cardEffectArgs.playerId
          });
          return cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion;
        });
        if (cards.length) {
          console.log(`[rogue effect] there are cards in trash costing 3 to 6`);
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Gain card',
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'select',
              cardIds: cards.map((card)=>card.id),
              selectCount: 1
            }
          });
          if (!result.result.length) {
            console.warn(`[rogue effect] no card selected`);
            return;
          }
          const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
          console.log(`[rogue effect] gaining card ${selectedCard}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        } else {
          console.log(`[rogue effect] no cards in trash costing 3 to 6`);
          const targetPlayerIds = findOrderedTargets({
            match: cardEffectArgs.match,
            appliesTo: 'ALL_OTHER',
            startingPlayerId: cardEffectArgs.playerId
          }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
          for (const targetPlayerId of targetPlayerIds){
            const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
            if (deck.length < 2) {
              console.log(`[rogue effect] player ${targetPlayerId} has less than 2 cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
            }
            const numToReveal = Math.min(2, deck.length);
            console.log(`[rogue effect] revealing ${numToReveal} cards from player ${targetPlayerId} deck`);
            const cardsToTrash = [];
            const cardsToDiscard = [];
            for(let i = 0; i < numToReveal; i++){
              const cardId = deck.slice(-i - 1)[0];
              const card = cardEffectArgs.cardLibrary.getCard(cardId);
              const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
                playerId: targetPlayerId
              });
              if (cost.treasure >= 3 && cost.treasure <= 6 && !cost.potion) {
                cardsToTrash.push(card);
              } else {
                cardsToDiscard.push(card);
              }
              await cardEffectArgs.runGameActionDelegate('revealCard', {
                cardId,
                playerId: targetPlayerId,
                moveToSetAside: true
              });
            }
            let cardToTrash = undefined;
            if (cardsToTrash.length > 1) {
              const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
                prompt: 'Trash card',
                playerId: targetPlayerId,
                content: {
                  type: 'select',
                  cardIds: cardsToTrash.map((card)=>card.id),
                  selectCount: 1
                }
              });
              if (!result.result.length) {
                console.warn(`[rogue effect] no card selected`);
              } else {
                cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              }
            } else if (cardsToTrash.length === 1) {
              cardToTrash = cardsToTrash[0];
            }
            if (cardToTrash) {
              console.log(`[rogue effect] trashing card ${cardToTrash}`);
              await cardEffectArgs.runGameActionDelegate('trashCard', {
                playerId: targetPlayerId,
                cardId: cardToTrash.id
              });
            }
            console.log(`[rogue effect] discarding ${cardsToDiscard.length} cards`);
            for (const card of cardsToDiscard.concat(cardsToTrash)){
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
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[sage effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const cardsToDiscard = [];
        while(deck.length > 0){
          const cardId = deck.slice(-1)[0];
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          console.log(`[sage effect] revealing ${card}`);
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId,
            moveToSetAside: true
          });
          const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
            playerId: cardEffectArgs.playerId
          });
          if (cost.treasure >= 3) {
            console.log(`[sage effect] ${card} costs at least 3 treasure, putting in hand`);
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId: card.id,
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerHand'
              }
            });
            break;
          } else {
            cardsToDiscard.push(card);
          }
        }
        console.log(`[sage effect] discarding ${cardsToDiscard.length} cards`);
        for (const card of cardsToDiscard){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'scavenger': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[scavenger effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        let result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Put deck onto discard?',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'CANCEL',
              action: 1
            },
            {
              label: 'CONFIRM',
              action: 2
            }
          ]
        });
        if (result.action === 2) {
          console.log(`[scavenger effect] putting deck onto discard`);
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
          for (const cardId of [
            ...deck
          ]){
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerDiscard'
              }
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
          });
          if (!result.result.length) {
            console.warn(`[scavenger effect] no card selected`);
            return;
          }
          const selectedCard = cardEffectArgs.cardLibrary.getCard(result.result[0]);
          console.log(`[scavenger effect] putting ${selectedCard} on top of deck`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: selectedCard.id,
            toPlayerId: cardEffectArgs.playerId,
            to: {
              location: 'playerDeck'
            }
          });
        } else {
          console.log(`[scavenger effect] no cards in discard`);
        }
      }
  },
  'sir-bailey': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.cardId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[sir-bailey effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[sir-bailey effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[sir-bailey effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[sir-bailey effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[sir-bailey effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[sir-bailey effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[sir-bailey effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'sir-destry': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[sir-destry effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[sir-destry effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[sir-destry effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[sir-destry effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[sir-destry effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[sir-destry effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[sir-destry effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'sir-martin': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[sir-martin effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[sir-martin effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[sir-martin effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[sir-martin effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[sir-martin effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[sir-martin effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[sir-martin effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'sir-michael': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          let numToDiscard = 0;
          if (hand.length > 3) {
            numToDiscard = hand.length - 3;
          }
          console.log(`[sir-michael effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Discard to 3`,
            restrict: hand,
            count: numToDiscard
          });
          if (!selectedCardIds.length) {
            console.warn(`[sir-michael effect] no cards selected`);
            continue;
          }
          console.log(`[sir-michael effect] player ${targetPlayerId} discarding ${selectedCardIds.length} cards`);
          for (const selectedCardId of selectedCardIds){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              playerId: targetPlayerId,
              cardId: selectedCardId
            });
          }
        }
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[sir-vander effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[sir-vander effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[sir-vander effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[sir-vander effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[sir-vander effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[sir-vander effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: cardEffectArgs.playerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[sir-vander effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'sir-vander': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          if (card.owner !== eventArgs.playerId) {
            return;
          }
          const goldCards = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'gold'
            }
          ]);
          if (!goldCards.length) {
            console.log(`[sir-vander onTrashed effect] no gold cards in supply to gain`);
            return;
          }
          console.log(`[sir-vander onTrashed effect] gaining ${goldCards.slice(-1)[0]}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: goldCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const cardsToDiscard = [];
          const cardsToTrash = [];
          for(let i = 0; i < 2; i++){
            let cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[sir-vander effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: targetPlayerId
              });
              cardId = deck.slice(-1)[0];
              if (!cardId) {
                console.log(`[sir-vander effect] no cards in deck, skipping`);
                continue;
              }
            }
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            console.log(`[sir-vander effect] revealing ${card}`);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
              playerId: targetPlayerId
            });
            if (cost.treasure >= 3 && cost.treasure <= 6) {
              cardsToTrash.push(card);
            } else {
              cardsToDiscard.push(card);
            }
          }
          let cardToTrash = undefined;
          if (cardsToTrash.length === 1) {
            cardToTrash = cardsToTrash[0];
          } else if (cardsToTrash.length > 1) {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Trash card',
              playerId: targetPlayerId,
              content: {
                type: 'select',
                cardIds: cardsToTrash.map((card)=>card.id),
                selectCount: 1
              }
            });
            if (!result.result.length) {
              console.warn(`[sir-vander effect] no card selected`);
            } else {
              cardToTrash = cardEffectArgs.cardLibrary.getCard(result.result[0]);
              cardsToDiscard.concat(cardsToTrash.filter((card)=>card.id !== cardToTrash.id));
            }
          }
          if (cardToTrash) {
            console.log(`[sir-vander effect] trashing ${cardToTrash}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardToTrash.id
            });
          }
          console.log(`[sir-vander effect] discarding ${cardsToDiscard.length} cards`);
          for (const card of cardsToDiscard){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: card.id,
              playerId: targetPlayerId
            });
          }
          if (cardToTrash && cardToTrash.type.includes('KNIGHT')) {
            const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[sir-vander effect] trashing ${card}`);
            await cardEffectArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: card.id
            });
          }
        }
      }
  },
  'squire': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          if (eventArgs.playerId != card.owner) {
            return;
          }
          const attackCards = args.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              cardType: 'ACTION'
            }
          ]);
          if (!attackCards.length) {
            console.log(`[squire onTrashed effect] no attack cards in supply`);
            return;
          }
          const selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: eventArgs.playerId,
            prompt: `Gain card`,
            restrict: attackCards.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[squire onTrashed effect] no card selected`);
            return;
          }
          const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[squire onTrashed effect] gaining ${selectedCard}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: selectedCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[squire effect] gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: '+2 ACTIONS',
              action: 1
            },
            {
              label: '+2 BUYS',
              action: 2
            },
            {
              label: 'GAIN 1 SILVER',
              action: 3
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[squire effect] gaining 2 actions`);
          await cardEffectArgs.runGameActionDelegate('gainAction', {
            count: 2
          });
        } else if (result.action === 2) {
          console.log(`[squire effect] gaining 2 buys`);
          await cardEffectArgs.runGameActionDelegate('gainBuy', {
            count: 2
          });
        } else {
          console.log(`[squire effect] gaining 1 silver`);
          const silverCards = cardEffectArgs.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'silver'
            }
          ]);
          if (!silverCards.length) {
            console.log(`[squire effect] no silver cards in supply`);
            return;
          }
          console.log(`[squire effect] gaining ${silverCards.slice(-1)[0]}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'storeroom': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[storeroom effect] gaining 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (!hand.length) {
          console.log(`[storeroom effect] no cards in hand`);
          return;
        }
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard card/s`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: hand.length
          }
        });
        if (!selectedCardIds.length) {
          console.log(`[storeroom effect] no card/s selected`);
          return;
        }
        console.log(`[storeroom effect] discarding ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: selectedCardId,
            playerId: cardEffectArgs.playerId
          });
        }
        console.log(`[storeroom effect] drawing ${selectedCardIds.length} cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: selectedCardIds.length
        });
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard card/s`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: hand.length
          },
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[storeroom effect] no card/s selected`);
          return;
        }
        console.log(`[storeroom effect] gaining ${selectedCardIds.length} treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: selectedCardIds.length
        });
      }
  },
  'urchin': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`urchin:${eventArgs.cardId}:cardPlayed`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[urchin effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>{
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
          return cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity' && hand.length > 4;
        });
        for (const targetPlayerId of targetPlayerIds){
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Discard card/s`,
            restrict: hand,
            count: hand.length - 4
          });
          if (!selectedCardIds.length) {
            console.warn(`[urchin effect] no card/s selected for player ${targetPlayerId}`);
            continue;
          }
          console.log(`[urchin effect] discarding ${selectedCardIds.length} cards for player ${targetPlayerId}`);
          for (const selectedCardId of selectedCardIds){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: selectedCardId,
              playerId: targetPlayerId
            });
          }
        }
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `urchin:${cardEffectArgs.cardId}:cardPlayed`,
          listeningFor: 'cardPlayed',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.trigger.args.cardId === cardEffectArgs.cardId) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ATTACK')) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            const urchinCard = triggeredArgs.cardLibrary.getCard(cardEffectArgs.cardId);
            console.log(`[urchin cardGained effect] trashing urchin ${urchinCard}`);
            await triggeredArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: urchinCard.id
            });
            const mercenaryCards = triggeredArgs.findCards([
              {
                location: 'nonSupplyCards'
              },
              {
                kingdom: 'mercenary'
              }
            ]);
            if (!mercenaryCards.length) {
              console.log(`[urchin cardGained effect] no mercenary cards in supply`);
              return;
            }
            console.log(`[urchin cardGained effect] gaining ${mercenaryCards.slice(-1)[0]}`);
            await triggeredArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: mercenaryCards.slice(-1)[0].id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        });
      }
  },
  'vagrant': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[vagrant effect] drawing 1 card and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (!deck.length) {
          console.log(`[vagrant effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
          if (!deck.length) {
            console.log(`[vagrant effect] still no cards in deck`);
            return;
          }
        }
        const card = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
        console.log(`[vagrant effect] revealing ${card}`);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
        if ([
          'CURSE',
          'RUINS',
          'SHELTER',
          'VICTORY'
        ].some((t)=>card.type.includes(t))) {
          console.log(`[vagrant effect] ${card} is a curse, ruins, shelter, or victory; moving to hand`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: cardEffectArgs.playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
      }
  },
  'wandering-minstrel': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const cardsToDiscard = [];
        const actionCards = [];
        for(let i = 0; i < 3; i++){
          let cardId = deck.slice(-1)[0];
          if (!cardId) {
            console.log(`[wandering-minstrel effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
            cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.log(`[wandering-minstrel effect] still no cards in deck`);
              break;
            }
          }
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId,
            moveToSetAside: true
          });
          if (card.type.includes('ACTION')) {
            actionCards.push(card);
          } else {
            cardsToDiscard.push(card);
          }
        }
        let sorted = [];
        if (actionCards.length > 1) {
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Put in any order',
            playerId: cardEffectArgs.playerId,
            content: {
              type: 'rearrange',
              cardIds: actionCards.map((card)=>card.id)
            },
            actionButtons: [
              {
                label: 'DONE',
                action: 1
              }
            ]
          });
          sorted = [
            ...result.result ?? []
          ];
        } else {
          sorted = [
            ...actionCards.map((card)=>card.id)
          ];
        }
        console.log(`[wandering-minstrel effect] putting cards ${cardsToDiscard} on deck`);
        for (const cardId of sorted){
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: cardEffectArgs.playerId,
            to: {
              location: 'playerDeck'
            }
          });
        }
        console.log(`[wandering-minstrel effect] discarding ${cardsToDiscard.length} cards`);
        for (const card of cardsToDiscard){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'ruined-library': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[ruined library effect] drawing 1 card`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
      }
  },
  'ruined-market': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[ruined market effect] gaining 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
      }
  },
  'ruined-village': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[ruined village effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: cardEffectArgs.playerId
        });
      }
  },
  'spoils': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[spoils effect] gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 3
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[spoils effect] moving ${thisCard} back to supply`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'nonSupplyCards'
          }
        });
      }
  },
  'survivors': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (deck.length < 2) {
          console.log(`[survivors effect] deck is empty, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
        }
        const numToLookAt = Math.min(2, deck.length);
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Discard or put back on deck?',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'DISCARD',
              action: 1
            },
            {
              label: 'PUT BACK',
              action: 2
            }
          ],
          content: {
            type: 'display-cards',
            cardIds: deck.slice(-numToLookAt)
          }
        });
        if (result.action === 1) {
          console.log(`[survivors effect] discarding ${numToLookAt} cards`);
          for(let i = 0; i < numToLookAt; i++){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: deck.slice(-i - 1)[0],
              playerId: cardEffectArgs.playerId
            });
          }
        } else {
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
            });
            for (const cardId of result.result){
              await cardEffectArgs.runGameActionDelegate('moveCard', {
                cardId: cardId,
                toPlayerId: cardEffectArgs.playerId,
                to: {
                  location: 'playerDeck'
                }
              });
            }
          } else {
            console.log(`[survivors effect] only one card to look at, it's already on top of deck`);
          }
        }
      }
  }
};
export default cardEffects;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9kYXJrLWFnZXMvY2FyZC1lZmZlY3RzLWRhcmstYWdlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDYXJkLCBDYXJkSWQsIENhcmRLZXksIENhcmRUeXBlIH0gZnJvbSAnc2hhcmVkL3NoYXJlZC10eXBlcy50cyc7XG5pbXBvcnQgeyBDYXJkRXhwYW5zaW9uTW9kdWxlIH0gZnJvbSAnLi4vLi4vdHlwZXMudHMnO1xuaW1wb3J0IHsgZmluZE9yZGVyZWRUYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmluZC1vcmRlcmVkLXRhcmdldHMudHMnO1xuaW1wb3J0IHsgZ2V0VHVyblBoYXNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LXR1cm4tcGhhc2UudHMnO1xuaW1wb3J0IHsgZ2V0Q3VycmVudFBsYXllciB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1jdXJyZW50LXBsYXllci50cyc7XG5pbXBvcnQgeyBnZXRQbGF5ZXJCeUlkIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LXBsYXllci1ieS1pZC50cyc7XG5cbmNvbnN0IGNhcmRFZmZlY3RzOiBDYXJkRXhwYW5zaW9uTW9kdWxlID0ge1xuICAnYWJhbmRvbmVkLW1pbmUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYWJhbmRvbmVkIG1pbmUgZWZmZWN0XSBnYWluaW5nIDEgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICB9XG4gIH0sXG4gICdhbHRhcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgbGV0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFthbHRhciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkVG9UcmFzaCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkVG9UcmFzaC5pZCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsga2luZDogJ3VwVG8nLCBhbW91bnQ6IHsgdHJlYXN1cmU6IDUgfSwgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH1cbiAgICAgICAgXSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFthbHRhciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkVG9HYWluID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2FsdGFyIGVmZmVjdF0gZ2FpbmluZyBjYXJkICR7Y2FyZFRvR2Fpbn1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGNhcmRUb0dhaW4uaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnYXJtb3J5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LCB7XG4gICAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBhbW91bnQ6IHsgdHJlYXN1cmU6IDQgfVxuICAgICAgICAgIH1cbiAgICAgICAgXSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYXJtb3J5IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFthcm1vcnkgZWZmZWN0XSBnYWluaW5nIGNhcmQgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnYmFuZC1vZi1taXNmaXRzJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCB0aGlzQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgIGNvbnN0IHsgY29zdDogdGhpc0Nvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyh0aGlzQ2FyZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICB7IGtpbmQ6ICd1cFRvJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBhbW91bnQ6IHsgdHJlYXN1cmU6IHRoaXNDb3N0LnRyZWFzdXJlIC0gMSB9IH0sXG4gICAgICBdKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSAmJiAhY2FyZC50eXBlLnNvbWUodCA9PiBbJ0RVUkFUSU9OJywgJ0NPTU1BTkQnXS5pbmNsdWRlcyh0KSkpO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgUGxheSBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRJZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2JhbmQgb2YgbWlzZml0cyBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYmFuZCBvZiBtaXNmaXRzIGVmZmVjdF0gcGxheWluZyBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3BsYXlDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICBvdmVycmlkZXM6IHtcbiAgICAgICAgICBhY3Rpb25Db3N0OiAwLFxuICAgICAgICAgIG1vdmVDYXJkOiBmYWxzZVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ2JhbmRpdC1jYW1wJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2JhbmRpdCBjYW1wIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQgYW5kIGdhaW5pbmcgMiBhY3Rpb25zYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzcG9pbHNDYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdub25TdXBwbHlDYXJkcycgfSxcbiAgICAgICAgeyBraW5nZG9tOiAnc3BvaWxzJyB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKCFzcG9pbHNDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtiYW5kaXQgY2FtcCBlZmZlY3RdIG5vIHNwb2lscyBjYXJkcyBpbiBub24tc3VwcGx5YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtiYW5kaXQgY2FtcCBlZmZlY3RdIGdhaW5pbmcgJHtzcG9pbHNDYXJkcy5zbGljZSgtMSlbMF19YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzcG9pbHNDYXJkcy5zbGljZSgtMSlbMF0uaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnYmVnZ2FyJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBiZWdnYXI6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkUGxheWVkYCk7XG4gICAgICB9LFxuICAgICAgb25FbnRlckhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYGJlZ2dhcjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWRgLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZFBsYXllZCcsXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgICBjb25kaXRpb246IGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBldmVudEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBjb25kaXRpb25BcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkKTtcbiAgICAgICAgICAgIGlmICghY2FyZC50eXBlLmluY2x1ZGVzKCdBVFRBQ0snKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgICBjb25zdCB0aGlzQ2FyZCA9IHRyaWdnZXJlZEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChldmVudEFyZ3MuY2FyZElkKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtiZWdnYXIgdHJpZ2dlcmVkIGVmZmVjdF0gZGlzY2FyZGluZyAke3RoaXNDYXJkfWApO1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3Qgc2lsdmVyQ2FyZHMgPSB0cmlnZ2VyZWRBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICAgICAgeyBjYXJkS2V5czogJ3NpbHZlcicgfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IG51bVRvR2FpbiA9IE1hdGgubWluKDIsIHNpbHZlckNhcmRzLmxlbmd0aCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChudW1Ub0dhaW4gPCAxKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYmVnZ2FyIHRyaWdnZXJlZCBlZmZlY3RdIG5vdCBlbm91Z2ggc2lsdmVyIGluIHN1cHBseWApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYmVnZ2FyIHRyaWdnZXJlZCBlZmZlY3RdIG51bWJlciBvZiBzaWx2ZXJzIHRvIGdhaW4gJHtudW1Ub0dhaW59LCBvbmUgb2YgdGhlbSB0byBkZWNrYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVG9HYWluOyBpKyspIHtcbiAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgICAgY2FyZElkOiBzaWx2ZXJDYXJkcy5zbGljZSgtaSAtIDEpWzBdLFxuICAgICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiBpID09PSAwID8gJ3BsYXllckRlY2snIDogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgY29wcGVyQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgIHsgY2FyZEtleXM6ICdjb3BwZXInIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBjb25zdCBudW1Ub0dhaW4gPSBNYXRoLm1pbigzLCBjb3BwZXJDYXJkcy5sZW5ndGgpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2JlZ2dhciBlZmZlY3RdIGdhaW5pbmcgJHtudW1Ub0dhaW59IGNvcHBlcnNgKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0dhaW47IGkrKykge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGNvcHBlckNhcmRzLnNsaWNlKC1pIC0gMSlbMF0sXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2NhdGFjb21icyc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvblRyYXNoZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChldmVudEFyZ3MuY2FyZElkKTtcbiAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBhcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIGNvbnN0IGNoZWFwZXJDYXJkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsga2luZDogJ3VwVG8nLCBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLCBhbW91bnQ6IHsgdHJlYXN1cmU6IGNvc3QudHJlYXN1cmUgLSAxIH0gfSxcbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWNoZWFwZXJDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NhdGFjb21icyBvblRyYXNoZWQgZWZmZWN0XSBubyBjYXJkcyBjb3N0aW5nIGxlc3MgdGhhbiAke2Nvc3QudHJlYXN1cmUgLSAxfWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBjaGVhcGVyQ2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbY2F0YWNvbWJzIG9uVHJhc2hlZCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtjYXRhY29tYnMgb25UcmFzaGVkIGVmZmVjdF0gZ2FpbmluZyBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBsZXQgbnVtVG9Mb29rQXQgPSAzO1xuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGggPCAzKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIG51bVRvTG9va0F0ID0gTWF0aC5taW4oMywgZGVjay5sZW5ndGgpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAobnVtVG9Mb29rQXQgPCAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbY2F0YWNvbWJzIGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVja2ApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzVG9Mb29rQXQgPSBkZWNrLnNsaWNlKC1udW1Ub0xvb2tBdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9uZScsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdQVVQgSU4gSEFORCcsIGFjdGlvbjogMSB9LFxuICAgICAgICAgIHsgbGFiZWw6ICdESVNDQVJEIEFORCBEUkFXJywgYWN0aW9uOiAyIH1cbiAgICAgICAgXSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdkaXNwbGF5LWNhcmRzJyxcbiAgICAgICAgICBjYXJkSWRzOiBjYXJkc1RvTG9va0F0XG4gICAgICAgIH1cbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtjYXRhY29tYnMgZWZmZWN0XSBtb3ZpbmcgJHtjYXJkc1RvTG9va0F0Lmxlbmd0aH0gY2FyZHMgdG8gaGFuZGApO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcmRzVG9Mb29rQXQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkc1RvTG9va0F0W2ldLFxuICAgICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbY2F0YWNvbWJzIGVmZmVjdF0gZGlzY2FyZGluZyAke2NhcmRzVG9Mb29rQXQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcmRzVG9Mb29rQXQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkc1RvTG9va0F0W2ldLFxuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbY2F0YWNvbWJzIGVmZmVjdF0gZHJhd2luZyAzIGNhcmRzYCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDMgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnY291bnQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnRElTQ0FSRCAyIENBUkRTJywgYWN0aW9uOiAxIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ1RPUC1ERUNLIENBUkQnLCBhY3Rpb246IDIgfSxcbiAgICAgICAgICB7IGxhYmVsOiAnR0FJTiAxIENPUFBFUicsIGFjdGlvbjogMyB9XG4gICAgICAgIF0sXG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICBcbiAgICAgIHN3aXRjaCAocmVzdWx0LmFjdGlvbikge1xuICAgICAgICBjYXNlIDE6IHtcbiAgICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIHByb21wdDogYERpc2NhcmQgQ2FyZHNgLFxuICAgICAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgICAgICBjb3VudDogTWF0aC5taW4oMiwgaGFuZC5sZW5ndGgpLFxuICAgICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbY291bnQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZENhcmRJZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gc2VsZWN0ZWRDYXJkSWRzW2ldO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgICBjYXJkSWQ6IGlkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIDI6IHtcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBwcm9tcHQ6IGBUb3AtZGVjayBjYXJkYCxcbiAgICAgICAgICAgIHJlc3RyaWN0OiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9LFxuICAgICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtjb3VudCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtjb3VudCBlZmZlY3RdIG1vdmluZyAke3NlbGVjdGVkQ2FyZH0gdG8gZGVja2ApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSAzOiB7XG4gICAgICAgICAgY29uc3QgY29wcGVyQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgICAgeyBjYXJkS2V5czogJ2NvcHBlcicgfVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGlmICghY29wcGVyQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvdW50IGVmZmVjdF0gbm8gY29wcGVycyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvdW50IGVmZmVjdF0gZ2FpbmluZyAxIGNvcHBlcmApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNvcHBlckNhcmRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9uZScsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICcrMyBUUkVBU1VSRScsIGFjdGlvbjogMSB9LFxuICAgICAgICAgIHsgbGFiZWw6ICdUUkFTSCBIQU5EJywgYWN0aW9uOiAyIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ0dBSU4gRFVDSFknLCBhY3Rpb246IDMgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBzd2l0Y2ggKHJlc3VsdC5hY3Rpb24pIHtcbiAgICAgICAgY2FzZSAxOiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtjb3VudCBlZmZlY3RdIGdhaW5pbmcgMyB0cmVhc3VyZWApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMyB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIDI6IHtcbiAgICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbY291bnQgZWZmZWN0XSB0cmFzaGluZyAke2hhbmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIFsuLi5oYW5kXSkge1xuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSAzOiB7XG4gICAgICAgICAgY29uc3QgZHVjaHlDYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgICB7IGNhcmRLZXlzOiAnZHVjaHknIH1cbiAgICAgICAgICBdKTtcbiAgICAgICAgICBpZiAoIWR1Y2h5Q2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvdW50IGVmZmVjdF0gbm8gZHVjaGllcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvdW50IGVmZmVjdF0gZ2FpbmluZyAxIGR1Y2h5YCk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogZHVjaHlDYXJkcy5zbGljZSgtMSlbMF0sXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2NvdW50ZXJmZWl0Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2NvdW50ZXJmZWl0IGVmZmVjdF0gZ2FpbmluZyAxIHRyZWFzdXJlLCBhbmQgMSBidXlgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IG5vbkR1cmF0aW9uVHJlYXN1cmVDYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgIHsgY2FyZFR5cGU6ICdUUkVBU1VSRScgfVxuICAgICAgXSlcbiAgICAgICAgLmZpbHRlcihjYXJkID0+ICFjYXJkLnR5cGUuaW5jbHVkZXMoJ0RVUkFUSU9OJykpO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgUGxheSB0cmVhc3VyZWAsXG4gICAgICAgIHJlc3RyaWN0OiBub25EdXJhdGlvblRyZWFzdXJlQ2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2NvdW50ZXJmZWl0IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtjb3VudGVyZmVpdCBlZmZlY3RdIHBsYXlpbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH0gdHdpY2VgKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgICAgb3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICBhY3Rpb25Db3N0OiAwLFxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbY291bnRlcmZlaXQgZWZmZWN0XSB0cmFzaGluZyAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdjdWx0aXN0Jzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uVHJhc2hlZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2N1bHRpc3Qgb25UcmFzaGVkIGVmZmVjdF0gZHJhd2luZyAzIGNhcmRzYCk7XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCwgY291bnQ6IDMgfSk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbY3VsdGlzdCBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkc2ApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IHJ1aW5zQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdraW5nZG9tU3VwcGx5JyB9LFxuICAgICAgICAgIHsga2luZ2RvbTogJ3J1aW5zJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFydWluc0NhcmRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbY3VsdGlzdCBlZmZlY3RdIG5vIHJ1aW5zIGNhcmRzIGluIG5vbi1zdXBwbHlgKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtjdWx0aXN0IGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGdhaW5pbmcgJHtydWluc0NhcmRzLnNsaWNlKC0xKVswXX1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogcnVpbnNDYXJkcy5zbGljZSgtMSlbMF0uaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjdWx0aXN0c0luSGFuZCA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgIHsgY2FyZEtleXM6ICdjdWx0aXN0JyB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKCFjdWx0aXN0c0luSGFuZC5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtjdWx0aXN0IGVmZmVjdF0gbm8gY3VsdGlzdHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnUGxheSBDdWx0aXN0PycsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdDQU5DRUwnLCBhY3Rpb246IDEgfSwgeyBsYWJlbDogJ1BMQVknLCBhY3Rpb246IDIgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2N1bHRpc3QgZWZmZWN0XSBjYW5jZWxsaW5nIHBsYXkgb2YgY3VsdGlzdGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbY3VsdGlzdCBlZmZlY3RdIHBsYXlpbmcgY3VsdGlzdGApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3BsYXlDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY3VsdGlzdHNJbkhhbmQuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICBvdmVycmlkZXM6IHtcbiAgICAgICAgICBhY3Rpb25Db3N0OiAwLFxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdkYW1lLWFubmEnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkc2AsXG4gICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICBjb3VudDogeyBraW5kOiAndXBUbycsIGNvdW50OiAyIH0sXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2RhbWUtYW5uYSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtkYW1lLWFubmEgZWZmZWN0XSB0cmFzaGluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkc1RvRGlzY2FyZDogQ2FyZFtdID0gW107XG4gICAgICAgIGNvbnN0IGNhcmRzVG9UcmFzaDogQ2FyZFtdID0gW107XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkrKykge1xuICAgICAgICAgIGxldCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWFubmEgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1hbm5hIGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWFubmEgZWZmZWN0XSByZXZlYWxpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY29zdC50cmVhc3VyZSA+PSAzICYmIGNvc3QudHJlYXN1cmUgPD0gNikge1xuICAgICAgICAgICAgY2FyZHNUb1RyYXNoLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZHNUb0Rpc2NhcmQucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBjYXJkVG9UcmFzaDogQ2FyZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRzVG9UcmFzaFswXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgIHByb21wdDogJ1RyYXNoIGNhcmQnLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgICAgY2FyZElkczogY2FyZHNUb1RyYXNoLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgICBzZWxlY3RDb3VudDogMVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtkYW1lLWFubmEgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5yZXN1bHRbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWFubmEgZWZmZWN0XSB0cmFzaGluZyAke2NhcmRUb1RyYXNofWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9UcmFzaC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWFubmEgZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZHNUb0Rpc2NhcmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZFRvVHJhc2ggJiYgY2FyZFRvVHJhc2gudHlwZS5pbmNsdWRlcygnS05JR0hUJykpIHtcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1hbm5hIGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZGFtZS1qb3NlcGhpbmUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZHNUb0Rpc2NhcmQ6IENhcmRbXSA9IFtdO1xuICAgICAgICBjb25zdCBjYXJkc1RvVHJhc2g6IENhcmRbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgICBsZXQgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPj0gMyAmJiBjb3N0LnRyZWFzdXJlIDw9IDYpIHtcbiAgICAgICAgICAgIGNhcmRzVG9UcmFzaC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgY2FyZFRvVHJhc2g6IENhcmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkc1RvVHJhc2hbMF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgIGNhcmRJZHM6IGNhcmRzVG9UcmFzaC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFyZXN1bHQucmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5jb25jYXQoY2FyZHNUb1RyYXNoLmZpbHRlcihjYXJkID0+IGNhcmQuaWQgIT09IGNhcmRUb1RyYXNoIS5pZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkVG9UcmFzaH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvVHJhc2guaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHNUb0Rpc2NhcmQpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCAmJiBjYXJkVG9UcmFzaC50eXBlLmluY2x1ZGVzKCdLTklHSFQnKSkge1xuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZGFtZS1tb2xseSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtkYW1lLW1vbGx5IGVmZmVjdF0gZ2FpbmluZyAyIGFjdGlvbnNgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZHNUb0Rpc2NhcmQ6IENhcmRbXSA9IFtdO1xuICAgICAgICBjb25zdCBjYXJkc1RvVHJhc2g6IENhcmRbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgICBsZXQgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPj0gMyAmJiBjb3N0LnRyZWFzdXJlIDw9IDYpIHtcbiAgICAgICAgICAgIGNhcmRzVG9UcmFzaC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgY2FyZFRvVHJhc2g6IENhcmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkc1RvVHJhc2hbMF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgIGNhcmRJZHM6IGNhcmRzVG9UcmFzaC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFyZXN1bHQucmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5jb25jYXQoY2FyZHNUb1RyYXNoLmZpbHRlcihjYXJkID0+IGNhcmQuaWQgIT09IGNhcmRUb1RyYXNoIS5pZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkVG9UcmFzaH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvVHJhc2guaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHNUb0Rpc2NhcmQpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCAmJiBjYXJkVG9UcmFzaC50eXBlLmluY2x1ZGVzKCdLTklHSFQnKSkge1xuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZGFtZS1uYXRhbGllJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBjYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgIHsga2luZDogJ3VwVG8nLCBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGFtb3VudDogeyB0cmVhc3VyZTogMyB9IH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2RhbWUtbmF0YWxpZSBlZmZlY3RdIG5vIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgb3B0aW9uYWw6IHRydWVcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2RhbWUtbmF0YWxpZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLW5hdGFsaWUgZWZmZWN0XSBnYWluaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZHNUb0Rpc2NhcmQ6IENhcmRbXSA9IFtdO1xuICAgICAgICBjb25zdCBjYXJkc1RvVHJhc2g6IENhcmRbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgICBsZXQgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPj0gMyAmJiBjb3N0LnRyZWFzdXJlIDw9IDYpIHtcbiAgICAgICAgICAgIGNhcmRzVG9UcmFzaC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgY2FyZFRvVHJhc2g6IENhcmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkc1RvVHJhc2hbMF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgIGNhcmRJZHM6IGNhcmRzVG9UcmFzaC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFyZXN1bHQucmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5jb25jYXQoY2FyZHNUb1RyYXNoLmZpbHRlcihjYXJkID0+IGNhcmQuaWQgIT09IGNhcmRUb1RyYXNoIS5pZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkVG9UcmFzaH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvVHJhc2guaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHNUb0Rpc2NhcmQpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCAmJiBjYXJkVG9UcmFzaC50eXBlLmluY2x1ZGVzKCdLTklHSFQnKSkge1xuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtkYW1lLWJhaWx5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZGFtZS1zeWx2aWEnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1zeWx2aWEgZWZmZWN0XSBnYWluaW5nIDIgYWN0aW9uc2ApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRzVG9EaXNjYXJkOiBDYXJkW10gPSBbXTtcbiAgICAgICAgY29uc3QgY2FyZHNUb1RyYXNoOiBDYXJkW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgICAgbGV0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2RhbWUtYmFpbHkgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNraXBwaW5nYCk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIHJldmVhbGluZyAke2NhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjb3N0LnRyZWFzdXJlID49IDMgJiYgY29zdC50cmVhc3VyZSA8PSA2KSB7XG4gICAgICAgICAgICBjYXJkc1RvVHJhc2gucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IGNhcmRUb1RyYXNoOiBDYXJkIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGNhcmRUb1RyYXNoID0gY2FyZHNUb1RyYXNoWzBdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgcHJvbXB0OiAnVHJhc2ggY2FyZCcsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgICBjYXJkSWRzOiBjYXJkc1RvVHJhc2gubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghcmVzdWx0LnJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW2RhbWUtYmFpbHkgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5yZXN1bHRbMF0pO1xuICAgICAgICAgICAgY2FyZHNUb0Rpc2NhcmQuY29uY2F0KGNhcmRzVG9UcmFzaC5maWx0ZXIoY2FyZCA9PiBjYXJkLmlkICE9PSBjYXJkVG9UcmFzaCEuaWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZFRvVHJhc2h9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRUb1RyYXNoLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2RhbWUtYmFpbHkgZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZHNUb0Rpc2NhcmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZFRvVHJhc2ggJiYgY2FyZFRvVHJhc2gudHlwZS5pbmNsdWRlcygnS05JR0hUJykpIHtcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZGFtZS1iYWlseSBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2RlYXRoLWNhcnQnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcnVpbkNhcmRzID0gYXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdraW5nZG9tU3VwcGx5JyB9LFxuICAgICAgICAgIHsga2luZ2RvbTogJ3J1aW5zJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgbnVtVG9HYWluID0gTWF0aC5taW4oMiwgcnVpbkNhcmRzLmxlbmd0aCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2RlYXRoIGNhcnQgb25HYWluZWQgZWZmZWN0XSBnYWluaW5nICR7bnVtVG9HYWlufSBydWluc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0dhaW47IGkrKykge1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IHJ1aW5DYXJkcy5zbGljZSgtaSAtIDEpWzBdLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIGNvbnN0IGFjdGlvbkNhcmRzSW5IYW5kID0gaGFuZFxuICAgICAgICAubWFwKGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQpXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGNhcmQ/YCxcbiAgICAgICAgcmVzdHJpY3Q6IFsuLi5hY3Rpb25DYXJkc0luSGFuZC5tYXAoY2FyZCA9PiBjYXJkLmlkKSwgY2FyZEVmZmVjdEFyZ3MuY2FyZElkXSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2RlYXRoIGNhcnQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2RlYXRoIGNhcnQgZWZmZWN0XSB0cmFzaGluZyBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2RlYXRoIGNhcnQgZWZmZWN0XSBnYWluaW5nIDUgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogNSB9KTtcbiAgICB9XG4gIH0sXG4gICdmZW9kdW0nOiB7XG4gICAgcmVnaXN0ZXJTY29yaW5nRnVuY3Rpb246ICgpID0+IChhcmdzKSA9PiB7XG4gICAgICBjb25zdCBvd25lZFNpbHZlcnMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgb3duZXI6IGFyZ3Mub3duZXJJZCB9LFxuICAgICAgICB7IGNhcmRLZXlzOiAnc2lsdmVyJyB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgY29uc3QgYW1vdW50ID0gTWF0aC5mbG9vcihvd25lZFNpbHZlcnMubGVuZ3RoIC8gMyk7XG4gICAgICByZXR1cm4gYW1vdW50O1xuICAgIH0sXG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25UcmFzaGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmcpID0+IHtcbiAgICAgICAgY29uc3Qgc2lsdmVyQ2FyZHMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1cbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBudW1Ub0dhaW4gPSBNYXRoLm1pbigzLCBzaWx2ZXJDYXJkcy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtmZW9kdW0gb25UcmFzaGVkIGVmZmVjdF0gZ2FpbmluZyAke251bVRvR2Fpbn0gc2lsdmVyc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0dhaW47IGkrKykge1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2lsdmVyQ2FyZHMuc2xpY2UoLWkgLSAxKVswXSxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSlcbiAgfSxcbiAgJ2ZvcmFnZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZm9yYWdlciBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb24sIGFuZCAxIGJ1eWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmRJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZm9yYWdlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbZm9yYWdlciBlZmZlY3RdIHRyYXNoaW5nIGNhcmQgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRyYXNoID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCd0cmFzaCcpO1xuICAgICAgY29uc3QgdW5pcXVlVHJlYXN1cmVzSW5UcmFzaCA9IG5ldyBTZXQoXG4gICAgICAgIHRyYXNoLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpXG4gICAgICAgICAgLm1hcChjYXJkID0+IGNhcmQuY2FyZEtleSlcbiAgICAgICkuc2l6ZTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtmb3JhZ2VyIGVmZmVjdF0gZ2FpbmluZyAke3VuaXF1ZVRyZWFzdXJlc0luVHJhc2h9IHRyZWFzdXJlYCk7XG4gICAgICBcbiAgICAgIGlmICh1bmlxdWVUcmVhc3VyZXNJblRyYXNoID4gMCkge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IHVuaXF1ZVRyZWFzdXJlc0luVHJhc2ggfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZm9ydHJlc3MnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25UcmFzaGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZm9ydHJlc3Mgb25UcmFzaGVkIGVmZmVjdF0gcHV0dGluZyBmb3J0cmVzcyBiYWNrIGluIGhhbmRgKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGV2ZW50QXJncy5jYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtmb3J0cmVzcyBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAyIGFjdGlvbnNgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICB9XG4gIH0sXG4gICdncmF2ZXJvYmJlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwcm9tcHQ6ICdDaG9vc2Ugb25lJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgeyBsYWJlbDogJ0dBSU4gQ0FSRCcsIGFjdGlvbjogMSB9LFxuICAgICAgICAgIHsgbGFiZWw6ICdUUkFTSCBDQVJEJywgYWN0aW9uOiAyIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIGNvbnN0IHRyYXNoQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICd0cmFzaCcgfSxcbiAgICAgICAgXSlcbiAgICAgICAgICAuZmlsdGVyKGNhcmQgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29zdCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIHJldHVybiBjb3N0LmNvc3QudHJlYXN1cmUgPj0gMyAmJiBjb3N0LmNvc3QudHJlYXN1cmUgPD0gNjtcbiAgICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmICghdHJhc2hDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2dyYXZlcm9iYmVyIGVmZmVjdF0gbm8gY2FyZHMgaW4gdHJhc2hgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwcm9tcHQ6ICdHYWluIGNhcmQnLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgIGNhcmRJZHM6IHRyYXNoQ2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgICBzZWxlY3RDb3VudDogMVxuICAgICAgICAgIH1cbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgY2FyZElkczogbnVtYmVyW10gfTtcbiAgICAgICAgXG4gICAgICAgIGlmICghcmVzdWx0LmNhcmRJZHMpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtncmF2ZXJvYmJlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5jYXJkSWRzWzBdKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbZ3JhdmVyb2JiZXIgZWZmZWN0XSBnYWluaW5nIGNhcmQgJHtjYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgICBjb25zdCBhY3Rpb25zSW5IYW5kID0gaGFuZC5tYXAoY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZClcbiAgICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWFjdGlvbnNJbkhhbmQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtncmF2ZXJvYmJlciBlZmZlY3RdIG5vIGFjdGlvbnMgaW4gaGFuZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgVHJhc2ggYWN0aW9uYCxcbiAgICAgICAgICByZXN0cmljdDogYWN0aW9uc0luSGFuZC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtncmF2ZXJvYmJlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2dyYXZlcm9iYmVyIGVmZmVjdF0gdHJhc2hpbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhzZWxlY3RlZENhcmQsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246IFsna2luZ2RvbVN1cHBseScsICdiYXNpY1N1cHBseSddIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgYW1vdW50OiB7IHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlICsgMywgcG90aW9uOiBjb3N0LnBvdGlvbiB9XG4gICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtncmF2ZXJvYmJlciBlZmZlY3RdIG5vIGNhcmRzIGluIHN1cHBseSB0aGF0IGNvc3QgPD0gJHtjb3N0LnRyZWFzdXJlICsgM31gKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbZ3JhdmVyb2JiZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2dyYXZlcm9iYmVyIGVmZmVjdF0gZ2FpbmluZyAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdoZXJtaXQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGRpc2NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRpc2NhcmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBsZXQgbm9uVHJlYXN1cmVDYXJkcyA9IGRpc2NhcmRcbiAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gIWNhcmQudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSk7XG4gICAgICBcbiAgICAgIGxldCBzZWxlY3RlZENhcmQ6IENhcmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICBcbiAgICAgIGlmIChkaXNjYXJkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ1RyYXNoIGZyb20gZGlzY2FyZD8nLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgIGNhcmRJZHM6IGRpc2NhcmQsXG4gICAgICAgICAgICBzZWxlY3RhYmxlQ2FyZElkczogbm9uVHJlYXN1cmVDYXJkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogJ0dPIFRPIEhBTkQnLCBhY3Rpb246IDEgfV1cbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtoZXJtaXQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkIGZyb20gZGlzY2FyZGApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHJlc3VsdC5yZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtoZXJtaXQgZWZmZWN0XSBzZWxlY3RlZCAke3NlbGVjdGVkQ2FyZH0gZnJvbSBkaXNjYXJkYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2hlcm1pdCBlZmZlY3RdIG5vIGNhcmRzIGluIGRpc2NhcmRgKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtoZXJtaXQgZWZmZWN0XSBzZWxlY3RpbmcgY2FyZCBmcm9tIGhhbmRgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICAgIG5vblRyZWFzdXJlQ2FyZHMgPSBoYW5kXG4gICAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAgIC5maWx0ZXIoY2FyZCA9PiAhY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IG5vblRyZWFzdXJlQ2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtoZXJtaXQgZWZmZWN0XSBub3QgdHJhc2hpbmcgZnJvbSBoYW5kYCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaGVybWl0IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZCB0byB0cmFzaGApO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaGVybWl0IGVmZmVjdF0gdHJhc2hpbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgeyBraW5kOiAndXBUbycsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgYW1vdW50OiB7IHRyZWFzdXJlOiAzIH0gfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghY2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaGVybWl0IGVmZmVjdF0gbm8gY2FyZHMgaW4gc3VwcGx5IHRoYXQgY29zdCA8PSAzYCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBjYXJkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtoZXJtaXQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaGVybWl0IGVmZmVjdF0gZ2FpbmluZyAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBoZXJtaXQ6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmVuZFR1cm5QaGFzZWAsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ2VuZFR1cm5QaGFzZScsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoZ2V0VHVyblBoYXNlKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBoYXNlSW5kZXgpICE9PSAnYnV5JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIGlmIChnZXRDdXJyZW50UGxheWVyKGNvbmRpdGlvbkFyZ3MubWF0Y2gpLmlkICE9PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRJZHNHYWluZWQgPSBjb25kaXRpb25BcmdzLm1hdGNoLnN0YXRzLmNhcmRzR2FpbmVkQnlUdXJuW2NvbmRpdGlvbkFyZ3MubWF0Y2gudHVybk51bWJlcl0gPz8gW107XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZElkc0dhaW5lZER1cmluZ0J1eVBoYXNlID0gY2FyZElkc0dhaW5lZC5maWx0ZXIoY2FyZElkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gY29uZGl0aW9uQXJncy5tYXRjaC5zdGF0cy5jYXJkc0dhaW5lZFtjYXJkSWRdO1xuICAgICAgICAgICAgcmV0dXJuIHN0YXRzLnBsYXllcklkID09PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCAmJiBzdGF0cy50dXJuUGhhc2UgPT09ICdidXknXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNhcmRJZHNHYWluZWREdXJpbmdCdXlQaGFzZS5sZW5ndGggPiAwKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICBjb25zdCBtYWRtYW5DYXJkcyA9IHRyaWdnZXJlZEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdub25TdXBwbHlDYXJkcycgfSxcbiAgICAgICAgICAgIHsga2luZ2RvbTogJ21hZG1hbicgfVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghbWFkbWFuQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2hlcm1pdCBlbmRUdXJuUGhhc2UgZWZmZWN0XSBubyBtYWRtYW4gaW4gc3VwcGx5YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGhlcm1pdENhcmQgPSB0cmlnZ2VyZWRBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2hlcm1pdCBlbmRUdXJuUGhhc2UgZWZmZWN0XSBtb3ZpbmcgJHtoZXJtaXRDYXJkfSB0byBzdXBwbHlgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBoZXJtaXRDYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdraW5nZG9tU3VwcGx5JyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IG1hZG1hbkNhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2hlcm1pdCBlbmRUdXJuUGhhc2UgZWZmZWN0XSBnYWluaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnaG92ZWwnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25MZWF2ZUhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGhvdmVsOiR7ZXZlbnRBcmdzLmNhcmRJZH06Y2FyZEdhaW5lZGApO1xuICAgICAgfSxcbiAgICAgIG9uRW50ZXJIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBob3ZlbDoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZEdhaW5lZCcsXG4gICAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICAgIGNvbmRpdGlvbjogY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGV2ZW50QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgY2FyZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgICAgaWYgKCFjYXJkLnR5cGUuaW5jbHVkZXMoJ1ZJQ1RPUlknKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgICBjb25zdCBob3ZlbENhcmQgPSB0cmlnZ2VyZWRBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbaG92ZWwgZ2FpbkNhcmQgZWZmZWN0XSB0cmFzaGluZyAke2hvdmVsQ2FyZH1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBob3ZlbENhcmQuaWQsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSlcbiAgfSxcbiAgJ2h1bnRpbmctZ3JvdW5kcyc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvblRyYXNoZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIHRvIGdhaW4nLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgeyBsYWJlbDogJzEgRHVjaHknLCBhY3Rpb246IDEgfSxcbiAgICAgICAgICAgIHsgbGFiZWw6ICczIEVzdGF0ZXMnLCBhY3Rpb246IDIgfVxuICAgICAgICAgIF0sXG4gICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgXG4gICAgICAgIGxldCBjYXJkczogQ2FyZFtdO1xuICAgICAgICBsZXQgbnVtVG9HYWluOiBudW1iZXI7XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICAgIGNhcmRzID0gYXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgICAgeyBjYXJkS2V5czogJ2R1Y2h5JyB9XG4gICAgICAgICAgXSk7XG4gICAgICAgICAgbnVtVG9HYWluID0gTWF0aC5taW4oMSwgY2FyZHMubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjYXJkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICAgIHsgY2FyZEtleXM6ICdlc3RhdGUnIH1cbiAgICAgICAgICBdKTtcbiAgICAgICAgICBudW1Ub0dhaW4gPSBNYXRoLm1pbigzLCBjYXJkcy5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIW51bVRvR2Fpbikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaHVudGluZy1ncm91bmRzIG9uVHJhc2hlZCBlZmZlY3RdIG5vIGNhcmRzIHRvIGdhaW5gKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtodW50aW5nLWdyb3VuZHMgb25UcmFzaGVkIGVmZmVjdF0gZ2FpbmluZyAke251bVRvR2Fpbn0gJHtyZXN1bHQuYWN0aW9uID09PSAxID8gJ2R1Y2h5JyA6ICdlc3RhdGUnfWApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0dhaW47IGkrKykge1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbaHVudGluZy1ncm91bmRzIGVmZmVjdF0gZHJhd2luZyA0IGNhcmRzYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiA0IH0pO1xuICAgIH1cbiAgfSxcbiAgJ2lyb25tb25nZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbaXJvbm1vbmdlciBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaXJvbm1vbmdlciBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2lyb25tb25nZXIgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGRlY2suc2xpY2UoLTEpWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtpcm9ubW9uZ2VyIGVmZmVjdF0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogYERpc2NhcmQgJHtjYXJkLmNhcmROYW1lfT9gLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnQ0FOQ0VMJywgYWN0aW9uOiAxIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ0RJU0NBUkQnLCBhY3Rpb246IDIgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2lyb25tb25nZXIgZWZmZWN0XSBub3QgZGlzY2FyZGluZywgbW92aW5nICR7Y2FyZH0gYmFjayB0byBkZWNrYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtpcm9ubW9uZ2VyIGVmZmVjdF0gZGlzY2FyZGluZyAke2NhcmR9YCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtpcm9ubW9uZ2VyIGVmZmVjdF0gY2FyZCBpcyBhY3Rpb24gdHlwZSwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaXJvbm1vbmdlciBlZmZlY3RdIGNhcmQgaXMgdHJlYXN1cmUgdHlwZSwgZ2FpbmluZyAxIHRyZWFzdXJlYCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGNhcmQudHlwZS5pbmNsdWRlcygnVklDVE9SWScpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaXJvbm1vbmdlciBlZmZlY3RdIGNhcmQgaXMgYSB2aWN0b3J5IGNhcmQsIGdhaW5pbmcgMSB2aWN0b3J5IHBvaW50YCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdqdW5rLWRlYWxlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtqdW5rLWRlYWxlciBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIGFjdGlvbiBhbmQgMSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtqdW5rLWRlYWxlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbanVuay1kZWFsZXIgZWZmZWN0XSB0cmFzaGluZyBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ21hZG1hbic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGhpc0NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbWFkbWFuIGVmZmVjdF0gbW92aW5nICR7dGhpc0NhcmR9IGJhY2sgdG8gbm9uIHN1cHBseWApO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ25vblN1cHBseUNhcmRzJyB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW21hZG1hbiBlZmZlY3RdIGRyYXdpbmcgJHtoYW5kLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY291bnQ6IGhhbmQubGVuZ3RoXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21hcmF1ZGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBzcG9pbENhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogJ25vblN1cHBseUNhcmRzJyB9LFxuICAgICAgICB7IGtpbmdkb206ICdzcG9pbHMnIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIXNwb2lsQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWFyYXVkZXIgZWZmZWN0XSBubyBzcG9pbHMgaW4gc3VwcGx5YCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttYXJhdWRlciBlZmZlY3RdIGdhaW5pbmcgJHtzcG9pbENhcmRzLnNsaWNlKC0xKVswXX1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc3BvaWxDYXJkcy5zbGljZSgtMSlbMF0uaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBydWluQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiAna2luZ2RvbVN1cHBseScgfSxcbiAgICAgICAgeyBraW5nZG9tOiAncnVpbnMnIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIXJ1aW5DYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttYXJhdWRlciBlZmZlY3RdIG5vIHJ1aW5zIGluIHN1cHBseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGlmICh0YXJnZXRQbGF5ZXJJZHMubGVuZ3RoID4gcnVpbkNhcmRzLmxlbmd0aCkge1xuICAgICAgICB0YXJnZXRQbGF5ZXJJZHMubGVuZ3RoID0gcnVpbkNhcmRzLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFttYXJhdWRlciBlZmZlY3RdIHRhcmdldGluZyAke3RhcmdldFBsYXllcklkcy5sZW5ndGh9IHBsYXllcnMgdG8gZ2FpbiBydWluc2ApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHJ1aW5DYXJkcy5zbGljZSgtMSlbMF0uaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21hcmtldC1zcXVhcmUnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25MZWF2ZUhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYG1hcmtldC1zcXVhcmU6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkVHJhc2hlZGApXG4gICAgICB9LFxuICAgICAgb25FbnRlckhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYG1hcmtldC1zcXVhcmU6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkVHJhc2hlZGAsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZFRyYXNoZWQnLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgY29tcHVsc29yeTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb25kaXRpb246IGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHJhc2hlZENhcmQgPSBjb25kaXRpb25BcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkKTtcbiAgICAgICAgICAgIGlmICh0cmFzaGVkQ2FyZC5vd25lciAhPT0gZXZlbnRBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucHJldmlvdXNMb2NhdGlvbi5sb2NhdGlvbiAhPT0gJ3BsYXllckhhbmQnKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucHJldmlvdXNMb2NhdGlvbi5wbGF5ZXJJZCAhPT0gZXZlbnRBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1hcmtldFNxdWFyZUNhcmQgPSB0cmlnZ2VyZWRBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW21hcmtldC1zcXVhcmUgY2FyZFRyYXNoZWQgZWZmZWN0XSBkaXNjYXJkaW5nICR7bWFya2V0U3F1YXJlQ2FyZH1gKTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgICAgY2FyZElkOiBtYXJrZXRTcXVhcmVDYXJkLmlkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgZ29sZENhcmRzID0gdHJpZ2dlcmVkQXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgICAgIHsgY2FyZEtleXM6ICdnb2xkJyB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFnb2xkQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWFya2V0LXNxdWFyZSBjYXJkVHJhc2hlZCBlZmZlY3RdIG5vIGdvbGQgY2FyZHMgaW4gc3VwcGx5YCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFttYXJrZXQtc3F1YXJlIGNhcmRUcmFzaGVkIGVmZmVjdF0gZ2FpbmluZyAke2dvbGRDYXJkcy5zbGljZSgtMSlbMF19YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBnb2xkQ2FyZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFttYXJrZXQtc3F1YXJlIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGdhaW5pbmcgMSBhY3Rpb24sIGFuZCAxIGJ1eWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgfVxuICB9LFxuICAnbWVyY2VuYXJ5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZHM/YCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgIGNvdW50OiBNYXRoLm1pbigyLCBoYW5kLmxlbmd0aClcbiAgICAgICAgfSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWVyY2VuYXJ5IGVmZmVjdF0gbm8gY2FyZHMgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW21lcmNlbmFyeSBlZmZlY3RdIHRyYXNoaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBzZWxlY3RlZENhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmRJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWVyY2VuYXJ5IGVmZmVjdF0gb25seSBvbmUgY2FyZCB0cmFzaGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFttZXJjZW5hcnkgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHMsIGFuZCBnYWluaW5nIDIgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaGFuZC5sZW5ndGggPD0gMykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWVyY2VuYXJ5IGVmZmVjdF0gJHt0YXJnZXRQbGF5ZXJJZH0gaGFzIDMgb3IgZmV3ZXIgY2FyZHMgaW4gaGFuZCwgc2tpcHBpbmdgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIHRvIDNgLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgIGNvdW50OiBoYW5kLmxlbmd0aCAtIDMsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKHNlbGVjdGVkQ2FyZElkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFttZXJjZW5hcnkgZWZmZWN0XSBubyBjYXJkcyBzZWxlY3RlZGApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW21lcmNlbmFyeSBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkaXNjYXJkaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ215c3RpYyc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtteXN0aWMgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uLCBhbmQgMSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwcm9tcHQ6ICdOYW1lIGEgY2FyZCcsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY29udGVudDogeyB0eXBlOiAnbmFtZS1jYXJkJyB9XG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IENhcmRLZXkgfTtcbiAgICAgIFxuICAgICAgY29uc3QgbmFtZWRDYXJkS2V5ID0gcmVzdWx0LnJlc3VsdDtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKCFkZWNrLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW215c3RpYyBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWRlY2subGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtteXN0aWMgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJldmVhbGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZGVjay5zbGljZSgtMSlbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW215c3RpYyBlZmZlY3RdIHJldmVhbGluZyAke3JldmVhbGVkQ2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IHJldmVhbGVkQ2FyZC5pZCxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChyZXZlYWxlZENhcmQuY2FyZEtleSA9PT0gbmFtZWRDYXJkS2V5KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbXlzdGljIGVmZmVjdF0gbW92aW5nIHJldmVhbGVkIGNhcmQgdG8gaGFuZGApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHJldmVhbGVkQ2FyZC5pZCxcbiAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtteXN0aWMgZWZmZWN0XSBub3QgbW92aW5nIGNhcmQgdG8gaGFuZGApO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ25lY3JvcG9saXMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbmVjcm9wb2xpcyBlZmZlY3RdIGdhaW5pbmcgMiBhY3Rpb25zYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgIH1cbiAgfSxcbiAgJ292ZXJncm93bi1lc3RhdGUnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25UcmFzaGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgIGlmIChjYXJkLm93bmVyICE9PSBldmVudEFyZ3MucGxheWVySWQpIHJldHVybjtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbb3Zlcmdyb3duLWVzdGF0ZSBvblRyYXNoZWQgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZGApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkIH0pO1xuICAgICAgfVxuICAgIH0pXG4gIH0sXG4gICdwaWxsYWdlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3BpbGxhZ2UgZWZmZWN0XSB0cmFzaGluZyBwaWxsYWdlYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZEVmZmVjdEFyZ3MuY2FyZElkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNwb2lsc0NhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogJ25vblN1cHBseUNhcmRzJyB9LFxuICAgICAgICB7IGtpbmdkb206ICdzcG9pbHMnIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIXNwb2lsc0NhcmRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3BpbGxhZ2UgZWZmZWN0XSBubyBzcG9pbHMgaW4gc3VwcGx5YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgbnVtVG9HYWluID0gTWF0aC5taW4oMiwgc3BvaWxzQ2FyZHMubGVuZ3RoKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtwaWxsYWdlIGVmZmVjdF0gZ2FpbmluZyAke251bVRvR2Fpbn0gc3BvaWxzYCk7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVG9HYWluOyBpKyspIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzcG9pbHNDYXJkcy5zbGljZSgtaSAtIDEpWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+XG4gICAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknICYmXG4gICAgICAgIGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKS5sZW5ndGggPj0gNVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbcGlsbGFnZSBlZmZlY3RdIHJldmVhbGluZyBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gaGFuZGApO1xuICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBbLi4uaGFuZF0pIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIGNhcmQgZm9yICR7Z2V0UGxheWVyQnlJZChjYXJkRWZmZWN0QXJncy5tYXRjaCwgdGFyZ2V0UGxheWVySWQpPy5uYW1lfWAsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgY2FyZElkczogaGFuZCxcbiAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgfVxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgIFxuICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbcGlsbGFnZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChyZXN1bHQucmVzdWx0WzBdKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbcGlsbGFnZSBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkaXNjYXJkaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAncG9vci1ob3VzZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtwb29yLWhvdXNlIGVmZmVjdF0gZ2FpbmluZyA0IHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDQgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbcG9vci1ob3VzZSBlZmZlY3RdIHJldmVhbGluZyBwbGF5ZXIgJHtjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZH0gaGFuZGApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBbLi4uaGFuZF0pIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0cmVhc3VyZUNhcmRzSW5IYW5kID0gaGFuZC5tYXAoY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZClcbiAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbcG9vci1ob3VzZSBlZmZlY3RdIGxvc2luZyAke3RyZWFzdXJlQ2FyZHNJbkhhbmQubGVuZ3RofSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAtdHJlYXN1cmVDYXJkc0luSGFuZC5sZW5ndGggfSk7XG4gICAgfVxuICB9LFxuICAncHJvY2Vzc2lvbic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3Qgbm9uRHVyYXRpb25BY3Rpb25DYXJkc0luSGFuZCA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICBdKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gIWNhcmQudHlwZS5pbmNsdWRlcygnRFVSQVRJT04nKSAmJiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKTtcbiAgICAgIFxuICAgICAgaWYgKCFub25EdXJhdGlvbkFjdGlvbkNhcmRzSW5IYW5kLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3Byb2Nlc3Npb24gZWZmZWN0XSBubyBub24tZHVyYXRpb24gYWN0aW9uIGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFBsYXkgY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBub25EdXJhdGlvbkFjdGlvbkNhcmRzSW5IYW5kLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbcHJvY2Vzc2lvbiBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3Byb2Nlc3Npb24gZWZmZWN0XSBwbGF5aW5nIGNhcmQgJHtzZWxlY3RlZENhcmR9IHR3aWNlYCk7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtwcm9jZXNzaW9uIGVmZmVjdF0gdHJhc2hpbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKHNlbGVjdGVkQ2FyZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogJ2tpbmdkb21TdXBwbHknIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBraW5kOiAnZXhhY3QnLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBhbW91bnQ6IHsgdHJlYXN1cmU6IGNvc3QudHJlYXN1cmUgKyAxLCBwb3Rpb246IGNvc3QucG90aW9uIH1cbiAgICAgICAgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtwcm9jZXNzaW9uIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtwcm9jZXNzaW9uIGVmZmVjdF0gZ2FpbmluZyBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3JhdHMnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25UcmFzaGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHRyYXNoZWRDYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGV2ZW50QXJncy5jYXJkSWQpO1xuICAgICAgICBpZiAoYXJncy5tYXRjaC5zdGF0cy50cmFzaGVkQ2FyZHNbZXZlbnRBcmdzLmNhcmRJZF0ucGxheWVySWQgIT09IHRyYXNoZWRDYXJkLm93bmVyKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3JhdHMgb25UcmFzaGVkIGVmZmVjdF0gZHJhd2luZyAxIGNhcmRgKTtcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkIH0pO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3JhdHMgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcmF0Q2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiAna2luZ2RvbVN1cHBseScgfSxcbiAgICAgICAgeyBjYXJkS2V5czogJ3JhdHMnIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIXJhdENhcmRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3JhdHMgZWZmZWN0XSBubyByYXRzIGluIHN1cHBseSB0byBnYWluYCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJhdENhcmQgPSByYXRDYXJkcy5zbGljZSgtMSlbMF07XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbcmF0cyBlZmZlY3RdIGdhaW5pbmcgY2FyZCAke3JhdENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiByYXRDYXJkLmlkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBub25SYXRDYXJkc0luSGFuZCA9IGhhbmRcbiAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC5jYXJkS2V5ICE9PSAncmF0cycpO1xuICAgICAgXG4gICAgICBpZiAoIW5vblJhdENhcmRzSW5IYW5kLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3JhdHMgZWZmZWN0XSBubyBub24tcmF0IGNhcmRzIGluIGhhbmQgdG8gdHJhc2gsIHJldmVhbGluZ2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgWy4uLmhhbmRdKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgcmVzdHJpY3Q6IG5vblJhdENhcmRzSW5IYW5kLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbcmF0cyBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbcmF0cyBlZmZlY3RdIHRyYXNoaW5nIGNhcmQgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAncmVidWlsZCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtyZWJ1aWxkIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwcm9tcHQ6ICdOYW1lIGEgY2FyZCcsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY29udGVudDogeyB0eXBlOiAnbmFtZS1jYXJkJyB9XG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IENhcmRLZXkgfTtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIGxldCBjYXJkRm91bmQ6IENhcmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBjYXJkc1RvRGlzY2FyZDogQ2FyZFtdID0gW107XG4gICAgICBcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGxldCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtyZWJ1aWxkIGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3JlYnVpbGQgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrYCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3JlYnVpbGQgZWZmZWN0XSByZXZlYWxpbmcgJHtjYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZC50eXBlLmluY2x1ZGVzKCdWSUNUT1JZJykgJiYgY2FyZC5jYXJkS2V5ICE9PSByZXN1bHQucmVzdWx0KSB7XG4gICAgICAgICAgY2FyZEZvdW5kID0gY2FyZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5wdXNoKGNhcmQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbcmVidWlsZCBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvRGlzY2FyZCkge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjYXJkRm91bmQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtyZWJ1aWxkIGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkRm91bmR9YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkRm91bmQuaWQsXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZEZvdW5kLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsgY2FyZFR5cGU6ICdWSUNUT1JZJyB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGtpbmQ6ICd1cFRvJyxcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGFtb3VudDogeyB0cmVhc3VyZTogY29zdC50cmVhc3VyZSArIDMsIHBvdGlvbjogY29zdC5wb3Rpb24gfVxuICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYEdhaW4gY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IGNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW3JlYnVpbGQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3JlYnVpbGQgZWZmZWN0XSBnYWluaW5nIGNhcmQgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAncm9ndWUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcm9ndWUgZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3RyYXNoJyB9KVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIHJldHVybiBjb3N0LnRyZWFzdXJlID49IDMgJiYgY29zdC50cmVhc3VyZSA8PSA2ICYmICFjb3N0LnBvdGlvblxuICAgICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKGNhcmRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3JvZ3VlIGVmZmVjdF0gdGhlcmUgYXJlIGNhcmRzIGluIHRyYXNoIGNvc3RpbmcgMyB0byA2YCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcHJvbXB0OiAnR2FpbiBjYXJkJyxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICBjYXJkSWRzOiBjYXJkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgfVxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgIFxuICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbcm9ndWUgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5yZXN1bHRbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtyb2d1ZSBlZmZlY3RdIGdhaW5pbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3JvZ3VlIGVmZmVjdF0gbm8gY2FyZHMgaW4gdHJhc2ggY29zdGluZyAzIHRvIDZgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZGVjay5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3JvZ3VlIGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGhhcyBsZXNzIHRoYW4gMiBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgbnVtVG9SZXZlYWwgPSBNYXRoLm1pbigyLCBkZWNrLmxlbmd0aCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtyb2d1ZSBlZmZlY3RdIHJldmVhbGluZyAke251bVRvUmV2ZWFsfSBjYXJkcyBmcm9tIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkZWNrYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZHNUb1RyYXNoOiBDYXJkW10gPSBbXTtcbiAgICAgICAgICBjb25zdCBjYXJkc1RvRGlzY2FyZDogQ2FyZFtdID0gW107XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub1JldmVhbDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjYXJkSWQgPSBkZWNrLnNsaWNlKC1pIC0gMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPj0gMyAmJiBjb3N0LnRyZWFzdXJlIDw9IDYgJiYgIWNvc3QucG90aW9uKSB7XG4gICAgICAgICAgICAgIGNhcmRzVG9UcmFzaC5wdXNoKGNhcmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgbGV0IGNhcmRUb1RyYXNoOiBDYXJkIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgICAgY2FyZElkczogY2FyZHNUb1RyYXNoLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFyZXN1bHQucmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFtyb2d1ZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGNhcmRUb1RyYXNoID0gY2FyZHNUb1RyYXNoWzBdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY2FyZFRvVHJhc2gpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbcm9ndWUgZWZmZWN0XSB0cmFzaGluZyBjYXJkICR7Y2FyZFRvVHJhc2h9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvVHJhc2guaWQsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtyb2d1ZSBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGNhcmRzVG9EaXNjYXJkLmNvbmNhdChjYXJkc1RvVHJhc2gpKSB7XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnc2FnZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtzYWdlIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZHNUb0Rpc2NhcmQ6IENhcmRbXSA9IFtdO1xuICAgICAgXG4gICAgICB3aGlsZSAoZGVjay5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzYWdlIGVmZmVjdF0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIGlmIChjb3N0LnRyZWFzdXJlID49IDMpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3NhZ2UgZWZmZWN0XSAke2NhcmR9IGNvc3RzIGF0IGxlYXN0IDMgdHJlYXN1cmUsIHB1dHRpbmcgaW4gaGFuZGApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzYWdlIGVmZmVjdF0gZGlzY2FyZGluZyAke2NhcmRzVG9EaXNjYXJkLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdzY2F2ZW5nZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2NhdmVuZ2VyIGVmZmVjdF0gZ2FpbmluZyAyIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGxldCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogJ1B1dCBkZWNrIG9udG8gZGlzY2FyZD8nLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnQ0FOQ0VMJywgYWN0aW9uOiAxIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ0NPTkZJUk0nLCBhY3Rpb246IDIgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMikge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3NjYXZlbmdlciBlZmZlY3RdIHB1dHRpbmcgZGVjayBvbnRvIGRpc2NhcmRgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBbLi4uZGVja10pIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBkaXNjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoZGlzY2FyZC5sZW5ndGgpIHtcbiAgICAgICAgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ1B1dCBjYXJkIG9uIHRvcCBvZiBkZWNrJyxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICBjYXJkSWRzOiBkaXNjYXJkLFxuICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgICB9XG4gICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgXG4gICAgICAgIGlmICghcmVzdWx0LnJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtzY2F2ZW5nZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5yZXN1bHRbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzY2F2ZW5nZXIgZWZmZWN0XSBwdXR0aW5nICR7c2VsZWN0ZWRDYXJkfSBvbiB0b3Agb2YgZGVja2ApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzY2F2ZW5nZXIgZWZmZWN0XSBubyBjYXJkcyBpbiBkaXNjYXJkYCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnc2lyLWJhaWxleSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZHNUb0Rpc2NhcmQ6IENhcmRbXSA9IFtdO1xuICAgICAgICBjb25zdCBjYXJkc1RvVHJhc2g6IENhcmRbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgICBsZXQgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLWJhaWxleSBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtzaXItYmFpbGV5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtzaXItYmFpbGV5IGVmZmVjdF0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPj0gMyAmJiBjb3N0LnRyZWFzdXJlIDw9IDYpIHtcbiAgICAgICAgICAgIGNhcmRzVG9UcmFzaC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgY2FyZFRvVHJhc2g6IENhcmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkc1RvVHJhc2hbMF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgIGNhcmRJZHM6IGNhcmRzVG9UcmFzaC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFyZXN1bHQucmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbc2lyLWJhaWxleSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5jb25jYXQoY2FyZHNUb1RyYXNoLmZpbHRlcihjYXJkID0+IGNhcmQuaWQgIT09IGNhcmRUb1RyYXNoIS5pZCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzaXItYmFpbGV5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkVG9UcmFzaH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvVHJhc2guaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLWJhaWxleSBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHNUb0Rpc2NhcmQpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCAmJiBjYXJkVG9UcmFzaC50eXBlLmluY2x1ZGVzKCdLTklHSFQnKSkge1xuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtzaXItYmFpbGV5IGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnc2lyLWRlc3RyeSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkc1RvRGlzY2FyZDogQ2FyZFtdID0gW107XG4gICAgICAgIGNvbnN0IGNhcmRzVG9UcmFzaDogQ2FyZFtdID0gW107XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkrKykge1xuICAgICAgICAgIGxldCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzaXItZGVzdHJ5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1kZXN0cnkgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBza2lwcGluZ2ApO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1kZXN0cnkgZWZmZWN0XSByZXZlYWxpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY29zdC50cmVhc3VyZSA+PSAzICYmIGNvc3QudHJlYXN1cmUgPD0gNikge1xuICAgICAgICAgICAgY2FyZHNUb1RyYXNoLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZHNUb0Rpc2NhcmQucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBjYXJkVG9UcmFzaDogQ2FyZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRzVG9UcmFzaFswXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgIHByb21wdDogJ1RyYXNoIGNhcmQnLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgICAgY2FyZElkczogY2FyZHNUb1RyYXNoLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgICBzZWxlY3RDb3VudDogMVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtzaXItZGVzdHJ5IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRUb1RyYXNoID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChyZXN1bHQucmVzdWx0WzBdKTtcbiAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLmNvbmNhdChjYXJkc1RvVHJhc2guZmlsdGVyKGNhcmQgPT4gY2FyZC5pZCAhPT0gY2FyZFRvVHJhc2ghLmlkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZFRvVHJhc2gpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1kZXN0cnkgZWZmZWN0XSB0cmFzaGluZyAke2NhcmRUb1RyYXNofWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9UcmFzaC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzaXItZGVzdHJ5IGVmZmVjdF0gZGlzY2FyZGluZyAke2NhcmRzVG9EaXNjYXJkLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvRGlzY2FyZCkge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoICYmIGNhcmRUb1RyYXNoLnR5cGUuaW5jbHVkZXMoJ0tOSUdIVCcpKSB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1kZXN0cnkgZWZmZWN0XSB0cmFzaGluZyAke2NhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdzaXItbWFydGluJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRzVG9EaXNjYXJkOiBDYXJkW10gPSBbXTtcbiAgICAgICAgY29uc3QgY2FyZHNUb1RyYXNoOiBDYXJkW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgICAgbGV0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1tYXJ0aW4gZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLW1hcnRpbiBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNraXBwaW5nYCk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLW1hcnRpbiBlZmZlY3RdIHJldmVhbGluZyAke2NhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjb3N0LnRyZWFzdXJlID49IDMgJiYgY29zdC50cmVhc3VyZSA8PSA2KSB7XG4gICAgICAgICAgICBjYXJkc1RvVHJhc2gucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IGNhcmRUb1RyYXNoOiBDYXJkIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGNhcmRUb1RyYXNoID0gY2FyZHNUb1RyYXNoWzBdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgcHJvbXB0OiAnVHJhc2ggY2FyZCcsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgICBjYXJkSWRzOiBjYXJkc1RvVHJhc2gubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghcmVzdWx0LnJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3Npci1tYXJ0aW4gZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5yZXN1bHRbMF0pO1xuICAgICAgICAgICAgY2FyZHNUb0Rpc2NhcmQuY29uY2F0KGNhcmRzVG9UcmFzaC5maWx0ZXIoY2FyZCA9PiBjYXJkLmlkICE9PSBjYXJkVG9UcmFzaCEuaWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLW1hcnRpbiBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZFRvVHJhc2h9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRUb1RyYXNoLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1tYXJ0aW4gZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZHNUb0Rpc2NhcmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZFRvVHJhc2ggJiYgY2FyZFRvVHJhc2gudHlwZS5pbmNsdWRlcygnS05JR0hUJykpIHtcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLW1hcnRpbiBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3Npci1taWNoYWVsJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBudW1Ub0Rpc2NhcmQgPSAwO1xuICAgICAgICBcbiAgICAgICAgaWYgKGhhbmQubGVuZ3RoID4gMykge1xuICAgICAgICAgIG51bVRvRGlzY2FyZCA9IGhhbmQubGVuZ3RoIC0gMztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzaXItbWljaGFlbCBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkaXNjYXJkaW5nICR7bnVtVG9EaXNjYXJkfSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIHRvIDNgLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgIGNvdW50OiBudW1Ub0Rpc2NhcmQsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbc2lyLW1pY2hhZWwgZWZmZWN0XSBubyBjYXJkcyBzZWxlY3RlZGApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3Npci1taWNoYWVsIGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGRpc2NhcmRpbmcgJHtzZWxlY3RlZENhcmRJZHMubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBzZWxlY3RlZENhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRzVG9EaXNjYXJkOiBDYXJkW10gPSBbXTtcbiAgICAgICAgY29uc3QgY2FyZHNUb1RyYXNoOiBDYXJkW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgICAgbGV0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLXZhbmRlciBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNraXBwaW5nYCk7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLXZhbmRlciBlZmZlY3RdIHJldmVhbGluZyAke2NhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjb3N0LnRyZWFzdXJlID49IDMgJiYgY29zdC50cmVhc3VyZSA8PSA2KSB7XG4gICAgICAgICAgICBjYXJkc1RvVHJhc2gucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IGNhcmRUb1RyYXNoOiBDYXJkIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAoY2FyZHNUb1RyYXNoLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGNhcmRUb1RyYXNoID0gY2FyZHNUb1RyYXNoWzBdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgcHJvbXB0OiAnVHJhc2ggY2FyZCcsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgICBjYXJkSWRzOiBjYXJkc1RvVHJhc2gubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghcmVzdWx0LnJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3Npci12YW5kZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZFRvVHJhc2ggPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHJlc3VsdC5yZXN1bHRbMF0pO1xuICAgICAgICAgICAgY2FyZHNUb0Rpc2NhcmQuY29uY2F0KGNhcmRzVG9UcmFzaC5maWx0ZXIoY2FyZCA9PiBjYXJkLmlkICE9PSBjYXJkVG9UcmFzaCEuaWQpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkVG9UcmFzaCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLXZhbmRlciBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZFRvVHJhc2h9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRUb1RyYXNoLmlkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZHNUb0Rpc2NhcmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZFRvVHJhc2ggJiYgY2FyZFRvVHJhc2gudHlwZS5pbmNsdWRlcygnS05JR0hUJykpIHtcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2lyLXZhbmRlciBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3Npci12YW5kZXInOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25UcmFzaGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgIGlmIChjYXJkLm93bmVyICE9PSBldmVudEFyZ3MucGxheWVySWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGdvbGRDYXJkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgeyBjYXJkS2V5czogJ2dvbGQnIH1cbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWdvbGRDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgb25UcmFzaGVkIGVmZmVjdF0gbm8gZ29sZCBjYXJkcyBpbiBzdXBwbHkgdG8gZ2FpbmApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzaXItdmFuZGVyIG9uVHJhc2hlZCBlZmZlY3RdIGdhaW5pbmcgJHtnb2xkQ2FyZHMuc2xpY2UoLTEpWzBdfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBnb2xkQ2FyZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkc1RvRGlzY2FyZDogQ2FyZFtdID0gW107XG4gICAgICAgIGNvbnN0IGNhcmRzVG9UcmFzaDogQ2FyZFtdID0gW107XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkrKykge1xuICAgICAgICAgIGxldCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzaXItdmFuZGVyIGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBza2lwcGluZ2ApO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgZWZmZWN0XSByZXZlYWxpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoY29zdC50cmVhc3VyZSA+PSAzICYmIGNvc3QudHJlYXN1cmUgPD0gNikge1xuICAgICAgICAgICAgY2FyZHNUb1RyYXNoLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2FyZHNUb0Rpc2NhcmQucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBjYXJkVG9UcmFzaDogQ2FyZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKGNhcmRzVG9UcmFzaC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBjYXJkVG9UcmFzaCA9IGNhcmRzVG9UcmFzaFswXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYXJkc1RvVHJhc2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgIHByb21wdDogJ1RyYXNoIGNhcmQnLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgICAgY2FyZElkczogY2FyZHNUb1RyYXNoLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgICBzZWxlY3RDb3VudDogMVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtzaXItdmFuZGVyIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRUb1RyYXNoID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChyZXN1bHQucmVzdWx0WzBdKTtcbiAgICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLmNvbmNhdChjYXJkc1RvVHJhc2guZmlsdGVyKGNhcmQgPT4gY2FyZC5pZCAhPT0gY2FyZFRvVHJhc2ghLmlkKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZFRvVHJhc2gpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgZWZmZWN0XSB0cmFzaGluZyAke2NhcmRUb1RyYXNofWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9UcmFzaC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzaXItdmFuZGVyIGVmZmVjdF0gZGlzY2FyZGluZyAke2NhcmRzVG9EaXNjYXJkLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvRGlzY2FyZCkge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRUb1RyYXNoICYmIGNhcmRUb1RyYXNoLnR5cGUuaW5jbHVkZXMoJ0tOSUdIVCcpKSB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Npci12YW5kZXIgZWZmZWN0XSB0cmFzaGluZyAke2NhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdzcXVpcmUnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25UcmFzaGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgIGlmIChldmVudEFyZ3MucGxheWVySWQgIT0gY2FyZC5vd25lcikge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgYXR0YWNrQ2FyZHMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogJ2tpbmdkb21TdXBwbHknIH0sXG4gICAgICAgICAgeyBjYXJkVHlwZTogJ0FDVElPTicgfVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghYXR0YWNrQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzcXVpcmUgb25UcmFzaGVkIGVmZmVjdF0gbm8gYXR0YWNrIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBhdHRhY2tDYXJkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtzcXVpcmUgb25UcmFzaGVkIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3NxdWlyZSBvblRyYXNoZWQgZWZmZWN0XSBnYWluaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3NxdWlyZSBlZmZlY3RdIGdhaW5pbmcgMSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnKzIgQUNUSU9OUycsIGFjdGlvbjogMSB9LFxuICAgICAgICAgIHsgbGFiZWw6ICcrMiBCVVlTJywgYWN0aW9uOiAyIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ0dBSU4gMSBTSUxWRVInLCBhY3Rpb246IDMgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3NxdWlyZSBlZmZlY3RdIGdhaW5pbmcgMiBhY3Rpb25zYCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChyZXN1bHQuYWN0aW9uID09PSAyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3F1aXJlIGVmZmVjdF0gZ2FpbmluZyAyIGJ1eXNgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMiB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3NxdWlyZSBlZmZlY3RdIGdhaW5pbmcgMSBzaWx2ZXJgKTtcbiAgICAgICAgY29uc3Qgc2lsdmVyQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiAnc2lsdmVyJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzaWx2ZXJDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3NxdWlyZSBlZmZlY3RdIG5vIHNpbHZlciBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3F1aXJlIGVmZmVjdF0gZ2FpbmluZyAke3NpbHZlckNhcmRzLnNsaWNlKC0xKVswXX1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2lsdmVyQ2FyZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdzdG9yZXJvb20nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc3RvcmVyb29tIGVmZmVjdF0gZ2FpbmluZyAxIGJ1eWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKCFoYW5kLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3N0b3Jlcm9vbSBlZmZlY3RdIG5vIGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZC9zYCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgIGNvdW50OiBoYW5kLmxlbmd0aFxuICAgICAgICB9LFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3N0b3Jlcm9vbSBlZmZlY3RdIG5vIGNhcmQvcyBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc3RvcmVyb29tIGVmZmVjdF0gZGlzY2FyZGluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc3RvcmVyb29tIGVmZmVjdF0gZHJhd2luZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IHNlbGVjdGVkQ2FyZElkcy5sZW5ndGhcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBjYXJkL3NgLFxuICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgY291bnQ6IGhhbmQubGVuZ3RoXG4gICAgICAgIH0sXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3N0b3Jlcm9vbSBlZmZlY3RdIG5vIGNhcmQvcyBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc3RvcmVyb29tIGVmZmVjdF0gZ2FpbmluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IHNlbGVjdGVkQ2FyZElkcy5sZW5ndGggfSk7XG4gICAgfVxuICB9LFxuICAndXJjaGluJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGB1cmNoaW46JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkUGxheWVkYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbdXJjaGluIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGFuZCBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4ge1xuICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgICByZXR1cm4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScgJiYgaGFuZC5sZW5ndGggPiA0O1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZC9zYCxcbiAgICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgICBjb3VudDogaGFuZC5sZW5ndGggLSA0LFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW3VyY2hpbiBlZmZlY3RdIG5vIGNhcmQvcyBzZWxlY3RlZCBmb3IgcGxheWVyICR7dGFyZ2V0UGxheWVySWR9YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbdXJjaGluIGVmZmVjdF0gZGlzY2FyZGluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzIGZvciBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGB1cmNoaW46JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWRgLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkUGxheWVkJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCA9PT0gY2FyZEVmZmVjdEFyZ3MuY2FyZElkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGlmICghY2FyZC50eXBlLmluY2x1ZGVzKCdBVFRBQ0snKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc3QgdXJjaGluQ2FyZCA9IHRyaWdnZXJlZEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdXJjaGluIGNhcmRHYWluZWQgZWZmZWN0XSB0cmFzaGluZyB1cmNoaW4gJHt1cmNoaW5DYXJkfWApXG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogdXJjaGluQ2FyZC5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBtZXJjZW5hcnlDYXJkcyA9IHRyaWdnZXJlZEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdub25TdXBwbHlDYXJkcycgfSxcbiAgICAgICAgICAgIHsga2luZ2RvbTogJ21lcmNlbmFyeScgfVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghbWVyY2VuYXJ5Q2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3VyY2hpbiBjYXJkR2FpbmVkIGVmZmVjdF0gbm8gbWVyY2VuYXJ5IGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3VyY2hpbiBjYXJkR2FpbmVkIGVmZmVjdF0gZ2FpbmluZyAke21lcmNlbmFyeUNhcmRzLnNsaWNlKC0xKVswXX1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IG1lcmNlbmFyeUNhcmRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ3ZhZ3JhbnQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbdmFncmFudCBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkIGFuZCBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoIWRlY2subGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdmFncmFudCBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWRlY2subGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt2YWdyYW50IGVmZmVjdF0gc3RpbGwgbm8gY2FyZHMgaW4gZGVja2ApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChkZWNrLnNsaWNlKC0xKVswXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbdmFncmFudCBlZmZlY3RdIHJldmVhbGluZyAke2NhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKFsnQ1VSU0UnLCAnUlVJTlMnLCAnU0hFTFRFUicsICdWSUNUT1JZJ10uc29tZSh0ID0+IGNhcmQudHlwZS5pbmNsdWRlcyh0IGFzIENhcmRUeXBlKSkpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt2YWdyYW50IGVmZmVjdF0gJHtjYXJkfSBpcyBhIGN1cnNlLCBydWlucywgc2hlbHRlciwgb3IgdmljdG9yeTsgbW92aW5nIHRvIGhhbmRgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3dhbmRlcmluZy1taW5zdHJlbCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIGNvbnN0IGNhcmRzVG9EaXNjYXJkOiBDYXJkW10gPSBbXTtcbiAgICAgIGNvbnN0IGFjdGlvbkNhcmRzOiBDYXJkW10gPSBbXTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgbGV0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3dhbmRlcmluZy1taW5zdHJlbCBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFt3YW5kZXJpbmctbWluc3RyZWwgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrYCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKSB7XG4gICAgICAgICAgYWN0aW9uQ2FyZHMucHVzaChjYXJkKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjYXJkc1RvRGlzY2FyZC5wdXNoKGNhcmQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxldCBzb3J0ZWQ6IENhcmRJZFtdID0gW107XG4gICAgICBpZiAoYWN0aW9uQ2FyZHMubGVuZ3RoID4gMSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcHJvbXB0OiAnUHV0IGluIGFueSBvcmRlcicsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgIHR5cGU6ICdyZWFycmFuZ2UnLFxuICAgICAgICAgICAgY2FyZElkczogYWN0aW9uQ2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZClcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFt7IGxhYmVsOiAnRE9ORScsIGFjdGlvbjogMSB9XVxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgIFxuICAgICAgICBzb3J0ZWQgPSBbLi4ucmVzdWx0LnJlc3VsdCA/PyBbXV07XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgc29ydGVkID0gWy4uLmFjdGlvbkNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt3YW5kZXJpbmctbWluc3RyZWwgZWZmZWN0XSBwdXR0aW5nIGNhcmRzICR7Y2FyZHNUb0Rpc2NhcmR9IG9uIGRlY2tgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2Ygc29ydGVkKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3dhbmRlcmluZy1taW5zdHJlbCBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkc1RvRGlzY2FyZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvRGlzY2FyZCkge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAncnVpbmVkLWxpYnJhcnknOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcnVpbmVkIGxpYnJhcnkgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZGApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3J1aW5lZC1tYXJrZXQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcnVpbmVkIG1hcmtldCBlZmZlY3RdIGdhaW5pbmcgMSBidXlgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgfVxuICB9LFxuICAncnVpbmVkLXZpbGxhZ2UnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcnVpbmVkIHZpbGxhZ2UgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICB9XG4gIH0sXG4gICdzcG9pbHMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc3BvaWxzIGVmZmVjdF0gZ2FpbmluZyAxIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDMgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRoaXNDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3Nwb2lscyBlZmZlY3RdIG1vdmluZyAke3RoaXNDYXJkfSBiYWNrIHRvIHN1cHBseWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdub25TdXBwbHlDYXJkcycgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnc3Vydml2b3JzJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGggPCAyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3Vydml2b3JzIGVmZmVjdF0gZGVjayBpcyBlbXB0eSwgc2h1ZmZsaW5nYCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgbnVtVG9Mb29rQXQgPSBNYXRoLm1pbigyLCBkZWNrLmxlbmd0aCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnRGlzY2FyZCBvciBwdXQgYmFjayBvbiBkZWNrPycsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdESVNDQVJEJywgYWN0aW9uOiAxIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ1BVVCBCQUNLJywgYWN0aW9uOiAyIH1cbiAgICAgICAgXSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdkaXNwbGF5LWNhcmRzJyxcbiAgICAgICAgICBjYXJkSWRzOiBkZWNrLnNsaWNlKC1udW1Ub0xvb2tBdClcbiAgICAgICAgfVxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3N1cnZpdm9ycyBlZmZlY3RdIGRpc2NhcmRpbmcgJHtudW1Ub0xvb2tBdH0gY2FyZHNgKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0xvb2tBdDsgaSsrKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogZGVjay5zbGljZSgtaSAtIDEpWzBdLFxuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3N1cnZpdm9ycyBlZmZlY3RdIHB1dHRpbmcgYmFjayAke251bVRvTG9va0F0fSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgaWYgKG51bVRvTG9va0F0ID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc3Vydml2b3JzIGVmZmVjdF0gcmVhcnJhbmdpbmcgY2FyZHNgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdSZWFycmFuZ2UnLFxuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICB0eXBlOiAncmVhcnJhbmdlJyxcbiAgICAgICAgICAgICAgY2FyZElkczogZGVjay5zbGljZSgtbnVtVG9Mb29rQXQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzdXJ2aXZvcnMgZWZmZWN0XSBvbmx5IG9uZSBjYXJkIHRvIGxvb2sgYXQsIGl0J3MgYWxyZWFkeSBvbiB0b3Agb2YgZGVja2ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBjYXJkRWZmZWN0czsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsU0FBUyxrQkFBa0IsUUFBUSxzQ0FBc0M7QUFDekUsU0FBUyxZQUFZLFFBQVEsZ0NBQWdDO0FBQzdELFNBQVMsZ0JBQWdCLFFBQVEsb0NBQW9DO0FBQ3JFLFNBQVMsYUFBYSxRQUFRLGtDQUFrQztBQUVoRSxNQUFNLGNBQW1DO0VBQ3ZDLGtCQUFrQjtJQUNoQixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsMENBQTBDLENBQUM7UUFDeEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtNQUN4RTtFQUNGO0VBQ0EsU0FBUztJQUNQLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsSUFBSSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDN0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLFVBQVUsQ0FBQztVQUNwQixVQUFVO1lBQUUsVUFBVTtZQUFjLFVBQVUsZUFBZSxRQUFRO1VBQUM7VUFDdEUsT0FBTztRQUNUO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQywrQkFBK0IsQ0FBQztVQUM5QztRQUNGO1FBRUEsTUFBTSxjQUFjLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUV6RSxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtVQUN0RCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLFlBQVksRUFBRTtRQUN4QjtRQUVBLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN6RSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsU0FBUyxDQUFDO1VBQ25CLFVBQVU7WUFDUjtjQUFFLFVBQVU7Z0JBQUM7Z0JBQWU7ZUFBZ0I7WUFBQztZQUM3QztjQUFFLE1BQU07Y0FBUSxRQUFRO2dCQUFFLFVBQVU7Y0FBRTtjQUFHLFVBQVUsZUFBZSxRQUFRO1lBQUM7V0FDNUU7VUFDRCxPQUFPO1FBQ1Q7UUFFQSxJQUFJLENBQUMsaUJBQWlCO1VBQ3BCLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLENBQUM7VUFDN0M7UUFDRjtRQUVBLE1BQU0sYUFBYSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFFeEUsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxZQUFZO1FBRXZELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsV0FBVyxFQUFFO1VBQ3JCLElBQUk7WUFBRSxVQUFVO1VBQWdCO1FBQ2xDO01BQ0Y7RUFDRjtFQUNBLFVBQVU7SUFDUixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQy9FLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsQ0FBQyxTQUFTLENBQUM7VUFDbkIsVUFBVTtZQUNSO2NBQUUsVUFBVTtnQkFBQztnQkFBZTtlQUFnQjtZQUFDO1lBQUc7Y0FDOUMsTUFBTTtjQUNOLFVBQVUsZUFBZSxRQUFRO2NBQ2pDLFFBQVE7Z0JBQUUsVUFBVTtjQUFFO1lBQ3hCO1dBQ0Q7VUFDRCxPQUFPO1FBQ1Q7UUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtVQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLGdDQUFnQyxDQUFDO1VBQzlDO1FBQ0Y7UUFFQSxNQUFNLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBRTFFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsY0FBYztRQUUxRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNyRCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLGFBQWEsRUFBRTtVQUN2QixJQUFJO1lBQUUsVUFBVTtVQUFhO1FBQy9CO01BQ0Y7RUFDRjtFQUNBLG1CQUFtQjtJQUNqQixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sV0FBVyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1FBQ3pFLE1BQU0sRUFBRSxNQUFNLFFBQVEsRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLFVBQVU7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBRXZILE1BQU0sVUFBVSxlQUFlLFNBQVMsQ0FBQztVQUN2QztZQUFFLFVBQVU7Y0FBQztjQUFlO2FBQWdCO1VBQUM7VUFDN0M7WUFBRSxNQUFNO1lBQVEsVUFBVSxlQUFlLFFBQVE7WUFBRSxRQUFRO2NBQUUsVUFBVSxTQUFTLFFBQVEsR0FBRztZQUFFO1VBQUU7U0FDaEcsRUFDRSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsSUFBSztjQUFDO2NBQVk7YUFBVSxDQUFDLFFBQVEsQ0FBQztRQUV4RyxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsU0FBUyxDQUFDO1VBQ25CLFVBQVUsUUFBUSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtVQUNyQyxPQUFPO1FBQ1Q7UUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtVQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1VBQ3ZEO1FBQ0Y7UUFFQSxNQUFNLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBRTFFLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLEVBQUUsY0FBYztRQUVuRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNyRCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLGFBQWEsRUFBRTtVQUN2QixXQUFXO1lBQ1QsWUFBWTtZQUNaLFVBQVU7VUFDWjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGVBQWU7SUFDYixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMseURBQXlELENBQUM7UUFDdkUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBQzNGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBRXBFLE1BQU0sY0FBYyxlQUFlLFNBQVMsQ0FBQztVQUMzQztZQUFFLFVBQVU7VUFBaUI7VUFDN0I7WUFBRSxTQUFTO1VBQVM7U0FDckI7UUFFRCxJQUFJLENBQUMsWUFBWSxNQUFNLEVBQUU7VUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxrREFBa0QsQ0FBQztVQUNoRTtRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxZQUFZLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFFdEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFDckQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxZQUFZLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtVQUNuQyxJQUFJO1lBQUUsVUFBVTtVQUFnQjtRQUNsQztNQUNGO0VBQ0Y7RUFDQSxVQUFVO0lBQ1IsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sRUFBRSxVQUFVLE1BQU0sQ0FBQyxXQUFXLENBQUM7UUFDaEY7UUFDQSxhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztZQUM1QyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsTUFBTSxDQUFDLFdBQVcsQ0FBQztZQUMzQyxVQUFVLFVBQVUsUUFBUTtZQUM1QixjQUFjO1lBQ2QsTUFBTTtZQUNOLHdCQUF3QjtZQUN4QixZQUFZO1lBQ1osV0FBVyxDQUFBO2NBQ1QsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLFVBQVUsUUFBUSxFQUFFLE9BQU87Y0FDdkUsTUFBTSxPQUFPLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtjQUNoRixJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsT0FBTztjQUMxQyxPQUFPO1lBQ1Q7WUFDQSxtQkFBbUIsT0FBTTtjQUN2QixNQUFNLFdBQVcsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBTTtjQUVuRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLFVBQVU7Y0FDOUQsTUFBTSxjQUFjLHFCQUFxQixDQUFDLGVBQWU7Z0JBQ3ZELFFBQVEsU0FBUyxFQUFFO2dCQUNuQixVQUFVLFVBQVUsUUFBUTtjQUM5QjtjQUVBLE1BQU0sY0FBYyxjQUFjLFNBQVMsQ0FBQztnQkFDMUM7a0JBQUUsVUFBVTtnQkFBYztnQkFDMUI7a0JBQUUsVUFBVTtnQkFBUztlQUN0QjtjQUVELE1BQU0sWUFBWSxLQUFLLEdBQUcsQ0FBQyxHQUFHLFlBQVksTUFBTTtjQUVoRCxJQUFJLFlBQVksR0FBRztnQkFDakIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxREFBcUQsQ0FBQztnQkFDbkU7Y0FDRjtjQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsb0RBQW9ELEVBQUUsVUFBVSxxQkFBcUIsQ0FBQztjQUVuRyxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksV0FBVyxJQUFLO2dCQUNsQyxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtrQkFDcEQsVUFBVSxVQUFVLFFBQVE7a0JBQzVCLFFBQVEsWUFBWSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFO2tCQUNwQyxJQUFJO29CQUFFLFVBQVUsTUFBTSxJQUFJLGVBQWU7a0JBQWdCO2dCQUMzRDtjQUNGO1lBQ0Y7VUFDRjtRQUNGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxjQUFjLGVBQWUsU0FBUyxDQUFDO1VBQzNDO1lBQUUsVUFBVTtVQUFjO1VBQzFCO1lBQUUsVUFBVTtVQUFTO1NBQ3RCO1FBRUQsTUFBTSxZQUFZLEtBQUssR0FBRyxDQUFDLEdBQUcsWUFBWSxNQUFNO1FBRWhELFFBQVEsR0FBRyxDQUFDLENBQUMsd0JBQXdCLEVBQUUsVUFBVSxRQUFRLENBQUM7UUFFMUQsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFdBQVcsSUFBSztVQUNsQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLFlBQVksS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRTtZQUNwQyxJQUFJO2NBQUUsVUFBVTtZQUFhO1VBQy9CO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsYUFBYTtJQUNYLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsV0FBVyxPQUFPLE1BQU07VUFDdEIsTUFBTSxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07VUFDdEQsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEtBQUssbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07WUFBRSxVQUFVLFVBQVUsUUFBUTtVQUFDO1VBQzFGLE1BQU0sZUFBZSxLQUFLLFNBQVMsQ0FBQztZQUNsQztjQUFFLFVBQVU7Z0JBQUM7Z0JBQWU7ZUFBZ0I7WUFBQztZQUM3QztjQUFFLE1BQU07Y0FBUSxVQUFVLFVBQVUsUUFBUTtjQUFFLFFBQVE7Z0JBQUUsVUFBVSxLQUFLLFFBQVEsR0FBRztjQUFFO1lBQUU7V0FDdkY7VUFFRCxJQUFJLENBQUMsYUFBYSxNQUFNLEVBQUU7WUFDeEIsUUFBUSxHQUFHLENBQUMsQ0FBQyx3REFBd0QsRUFBRSxLQUFLLFFBQVEsR0FBRyxHQUFHO1lBQzFGO1VBQ0Y7VUFFQSxNQUFNLGtCQUFrQixNQUFNLEtBQUsscUJBQXFCLENBQUMsY0FBYztZQUNyRSxVQUFVLFVBQVUsUUFBUTtZQUM1QixRQUFRLENBQUMsU0FBUyxDQUFDO1lBQ25CLFVBQVUsYUFBYSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtZQUMxQyxPQUFPO1VBQ1Q7VUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLDZDQUE2QyxDQUFDO1lBQzVEO1VBQ0Y7VUFFQSxNQUFNLGVBQWUsS0FBSyxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1VBRWhFLFFBQVEsR0FBRyxDQUFDLENBQUMsMENBQTBDLEVBQUUsY0FBYztVQUV2RSxNQUFNLEtBQUsscUJBQXFCLENBQUMsWUFBWTtZQUMzQyxRQUFRLGFBQWEsRUFBRTtZQUN2QixVQUFVLFVBQVUsUUFBUTtZQUM1QixJQUFJO2NBQUUsVUFBVTtZQUFnQjtVQUNsQztRQUNGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBRWhHLElBQUksY0FBYztRQUVsQixJQUFJLEtBQUssTUFBTSxHQUFHLEdBQUc7VUFDbkIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7WUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFDO1VBRTlGLGNBQWMsS0FBSyxHQUFHLENBQUMsR0FBRyxLQUFLLE1BQU07UUFDdkM7UUFFQSxJQUFJLGNBQWMsR0FBRztVQUNuQixRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDO1VBQ2pEO1FBQ0Y7UUFFQSxNQUFNLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxDQUFDO1FBRWxDLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN0RSxRQUFRO1VBQ1IsVUFBVSxlQUFlLFFBQVE7VUFDakMsZUFBZTtZQUNiO2NBQUUsT0FBTztjQUFlLFFBQVE7WUFBRTtZQUNsQztjQUFFLE9BQU87Y0FBb0IsUUFBUTtZQUFFO1dBQ3hDO1VBQ0QsU0FBUztZQUNQLE1BQU07WUFDTixTQUFTO1VBQ1g7UUFDRjtRQUVBLElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztVQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQixFQUFFLGNBQWMsTUFBTSxDQUFDLGNBQWMsQ0FBQztVQUM3RSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksY0FBYyxNQUFNLEVBQUUsSUFBSztZQUM3QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtjQUNyRCxRQUFRLGFBQWEsQ0FBQyxFQUFFO2NBQ3hCLFlBQVksZUFBZSxRQUFRO2NBQ25DLElBQUk7Z0JBQUUsVUFBVTtjQUFhO1lBQy9CO1VBQ0Y7UUFDRixPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyw4QkFBOEIsRUFBRSxjQUFjLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFDekUsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLGNBQWMsTUFBTSxFQUFFLElBQUs7WUFDN0MsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsUUFBUSxhQUFhLENBQUMsRUFBRTtjQUN4QixVQUFVLGVBQWUsUUFBUTtZQUNuQztVQUNGO1VBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQztVQUNoRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUFFLFVBQVUsZUFBZSxRQUFRO1lBQUUsT0FBTztVQUFFO1FBQ3ZHO01BQ0Y7RUFDRjtFQUNBLFNBQVM7SUFDUCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLElBQUksU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUNwRSxRQUFRO1VBQ1IsVUFBVSxlQUFlLFFBQVE7VUFDakMsZUFBZTtZQUNiO2NBQUUsT0FBTztjQUFtQixRQUFRO1lBQUU7WUFDdEM7Y0FBRSxPQUFPO2NBQWlCLFFBQVE7WUFBRTtZQUNwQztjQUFFLE9BQU87Y0FBaUIsUUFBUTtZQUFFO1dBQ3JDO1FBQ0g7UUFFQSxPQUFRLE9BQU8sTUFBTTtVQUNuQixLQUFLO1lBQUc7Y0FDTixNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7Y0FDaEcsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Z0JBQy9FLFVBQVUsZUFBZSxRQUFRO2dCQUNqQyxRQUFRLENBQUMsYUFBYSxDQUFDO2dCQUN2QixVQUFVO2dCQUNWLE9BQU8sS0FBSyxHQUFHLENBQUMsR0FBRyxLQUFLLE1BQU07Y0FDaEM7Y0FFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtnQkFDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQywrQkFBK0IsQ0FBQztnQkFDOUM7Y0FDRjtjQUVBLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxnQkFBZ0IsTUFBTSxFQUFFLElBQUs7Z0JBQy9DLE1BQU0sS0FBSyxlQUFlLENBQUMsRUFBRTtnQkFFN0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7a0JBQ3hELFFBQVE7a0JBQ1IsVUFBVSxlQUFlLFFBQVE7Z0JBQ25DO2NBQ0Y7Y0FDQTtZQUNGO1VBQ0EsS0FBSztZQUFHO2NBQ04sTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Z0JBQy9FLFVBQVUsZUFBZSxRQUFRO2dCQUNqQyxRQUFRLENBQUMsYUFBYSxDQUFDO2dCQUN2QixVQUFVO2tCQUFFLFVBQVU7a0JBQWMsVUFBVSxlQUFlLFFBQVE7Z0JBQUM7Z0JBQ3RFLE9BQU87Y0FDVDtjQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO2dCQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLCtCQUErQixDQUFDO2dCQUM5QztjQUNGO2NBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtjQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLGFBQWEsUUFBUSxDQUFDO2NBRTNELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2dCQUNyRCxRQUFRLGFBQWEsRUFBRTtnQkFDdkIsWUFBWSxlQUFlLFFBQVE7Z0JBQ25DLElBQUk7a0JBQUUsVUFBVTtnQkFBYTtjQUMvQjtjQUNBO1lBQ0Y7VUFDQSxLQUFLO1lBQUc7Y0FDTixNQUFNLGNBQWMsZUFBZSxTQUFTLENBQUM7Z0JBQzNDO2tCQUFFLFVBQVU7Z0JBQWM7Z0JBQzFCO2tCQUFFLFVBQVU7Z0JBQVM7ZUFDdEI7Y0FDRCxJQUFJLENBQUMsWUFBWSxNQUFNLEVBQUU7Z0JBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsbUNBQW1DLENBQUM7Z0JBQ2pEO2NBQ0Y7Y0FDQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixDQUFDO2NBQzdDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2dCQUNyRCxVQUFVLGVBQWUsUUFBUTtnQkFDakMsUUFBUSxZQUFZLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDbkMsSUFBSTtrQkFBRSxVQUFVO2dCQUFnQjtjQUNsQztjQUNBO1lBQ0Y7UUFDRjtRQUVBLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDaEUsUUFBUTtVQUNSLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLGVBQWU7WUFDYjtjQUFFLE9BQU87Y0FBZSxRQUFRO1lBQUU7WUFDbEM7Y0FBRSxPQUFPO2NBQWMsUUFBUTtZQUFFO1lBQ2pDO2NBQUUsT0FBTztjQUFjLFFBQVE7WUFBRTtXQUNsQztRQUNIO1FBRUEsT0FBUSxPQUFPLE1BQU07VUFDbkIsS0FBSztZQUFHO2NBQ04sUUFBUSxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsQ0FBQztjQUMvQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO2dCQUFFLE9BQU87Y0FBRTtjQUN0RTtZQUNGO1VBQ0EsS0FBSztZQUFHO2NBQ04sTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO2NBRWhHLFFBQVEsR0FBRyxDQUFDLENBQUMsd0JBQXdCLEVBQUUsS0FBSyxNQUFNLENBQUMsTUFBTSxDQUFDO2NBRTFELEtBQUssTUFBTSxVQUFVO21CQUFJO2VBQUssQ0FBRTtnQkFDOUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7a0JBQ3RELFVBQVUsZUFBZSxRQUFRO2tCQUNqQztnQkFDRjtjQUNGO2NBQ0E7WUFDRjtVQUNBLEtBQUs7WUFBRztjQUNOLE1BQU0sYUFBYSxlQUFlLFNBQVMsQ0FBQztnQkFDMUM7a0JBQUUsVUFBVTtnQkFBYztnQkFDMUI7a0JBQUUsVUFBVTtnQkFBUTtlQUNyQjtjQUNELElBQUksQ0FBQyxXQUFXLE1BQU0sRUFBRTtnQkFDdEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxtQ0FBbUMsQ0FBQztnQkFDakQ7Y0FDRjtjQUNBLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLENBQUM7Y0FDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7Z0JBQ3JELFVBQVUsZUFBZSxRQUFRO2dCQUNqQyxRQUFRLFdBQVcsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQy9CLElBQUk7a0JBQUUsVUFBVTtnQkFBZ0I7Y0FDbEM7Y0FDQTtZQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsZUFBZTtJQUNiLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxrREFBa0QsQ0FBQztRQUNoRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBQ3RFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxXQUFXO1VBQUUsT0FBTztRQUFFO1FBRWpFLE1BQU0sMkJBQTJCLGVBQWUsU0FBUyxDQUFDO1VBQ3hEO1lBQUUsVUFBVTtZQUFjLFVBQVUsZUFBZSxRQUFRO1VBQUM7VUFDNUQ7WUFBRSxVQUFVO1VBQVc7U0FDeEIsRUFDRSxNQUFNLENBQUMsQ0FBQSxPQUFRLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBRXRDLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQy9FLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsQ0FBQyxhQUFhLENBQUM7VUFDdkIsVUFBVSx5QkFBeUIsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7VUFDdEQsT0FBTztVQUNQLFVBQVU7UUFDWjtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLENBQUM7VUFDbkQ7UUFDRjtRQUVBLE1BQU0sZUFBZSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFFMUUsUUFBUSxHQUFHLENBQUMsQ0FBQyxrQ0FBa0MsRUFBRSxhQUFhLE1BQU0sQ0FBQztRQUVyRSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxJQUFLO1VBQzFCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVEsYUFBYSxFQUFFO1lBQ3ZCLFdBQVc7Y0FDVCxZQUFZO1lBQ2Q7VUFDRjtRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyw4QkFBOEIsRUFBRSxjQUFjO1FBRTNELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO1VBQ3RELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsYUFBYSxFQUFFO1FBQ3pCO01BQ0Y7RUFDRjtFQUNBLFdBQVc7SUFDVCwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLFdBQVcsT0FBTyxNQUFNO1VBQ3RCLFFBQVEsR0FBRyxDQUFDLENBQUMsMENBQTBDLENBQUM7VUFDeEQsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFlBQVk7WUFBRSxVQUFVLFVBQVUsUUFBUTtZQUFFLE9BQU87VUFBRTtRQUN4RjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsZ0NBQWdDLENBQUM7UUFDOUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFFLE9BQU87UUFBRTtRQUVyRyxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxhQUFhLGVBQWUsU0FBUyxDQUFDO1lBQzFDO2NBQUUsVUFBVTtZQUFnQjtZQUM1QjtjQUFFLFNBQVM7WUFBUTtXQUNwQjtVQUVELElBQUksQ0FBQyxXQUFXLE1BQU0sRUFBRTtZQUN0QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZDQUE2QyxDQUFDO1lBQzNEO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLGVBQWUsU0FBUyxFQUFFLFdBQVcsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtVQUUxRixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxVQUFVO1lBQ1YsUUFBUSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNsQyxJQUFJO2NBQUUsVUFBVTtZQUFnQjtVQUNsQztRQUNGO1FBRUEsTUFBTSxpQkFBaUIsZUFBZSxTQUFTLENBQUM7VUFDOUM7WUFBRSxVQUFVO1lBQWMsVUFBVSxlQUFlLFFBQVE7VUFBQztVQUM1RDtZQUFFLFVBQVU7VUFBVTtTQUN2QjtRQUVELElBQUksQ0FBQyxlQUFlLE1BQU0sRUFBRTtVQUMxQixRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxDQUFDO1VBQ2xEO1FBQ0Y7UUFFQSxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDdEUsUUFBUTtVQUNSLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLGVBQWU7WUFDYjtjQUFFLE9BQU87Y0FBVSxRQUFRO1lBQUU7WUFBRztjQUFFLE9BQU87Y0FBUSxRQUFRO1lBQUU7V0FDNUQ7UUFDSDtRQUVBLElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztVQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDJDQUEyQyxDQUFDO1VBQ3pEO1FBQ0Y7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLGdDQUFnQyxDQUFDO1FBRTlDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsZUFBZSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFDdEMsV0FBVztZQUNULFlBQVk7VUFDZDtRQUNGO01BQ0Y7RUFDRjtFQUNBLGFBQWE7SUFDWCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUVoRyxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsV0FBVyxDQUFDO1VBQ3JCLFVBQVU7VUFDVixPQUFPO1lBQUUsTUFBTTtZQUFRLE9BQU87VUFBRTtVQUNoQyxVQUFVO1FBQ1o7UUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtVQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDO1FBQ25EO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxnQkFBZ0IsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUV6RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtZQUN0RCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRO1VBQ1Y7UUFDRjtRQUVBLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLGVBQWUsS0FBSztVQUMzQixXQUFXO1VBQ1gsa0JBQWtCLGVBQWUsUUFBUTtRQUMzQyxHQUFHLE1BQU0sQ0FBQyxDQUFBLFdBQVksZUFBZSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVztRQUU3RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYztVQUV6RSxNQUFNLGlCQUF5QixFQUFFO1VBQ2pDLE1BQU0sZUFBdUIsRUFBRTtVQUUvQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxJQUFLO1lBQzFCLElBQUksU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBRTlCLElBQUksQ0FBQyxRQUFRO2NBQ1gsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztjQUM1RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtnQkFBRSxVQUFVO2NBQWU7Y0FFckYsU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO2NBRTFCLElBQUksQ0FBQyxRQUFRO2dCQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsNkNBQTZDLENBQUM7Z0JBQzNEO2NBQ0Y7WUFDRjtZQUVBLE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUM7WUFFaEQsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxNQUFNO1lBRWxELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3ZELFFBQVE7Y0FDUixVQUFVO2NBQ1YsZ0JBQWdCO1lBQ2xCO1lBRUEsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07Y0FBRSxVQUFVO1lBQWU7WUFFaEcsSUFBSSxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssUUFBUSxJQUFJLEdBQUc7Y0FDNUMsYUFBYSxJQUFJLENBQUM7WUFDcEIsT0FDSztjQUNILGVBQWUsSUFBSSxDQUFDO1lBQ3RCO1VBQ0Y7VUFFQSxJQUFJLGNBQWdDO1VBQ3BDLElBQUksYUFBYSxNQUFNLEtBQUssR0FBRztZQUM3QixjQUFjLFlBQVksQ0FBQyxFQUFFO1VBQy9CLE9BQ0ssSUFBSSxhQUFhLE1BQU0sR0FBRyxHQUFHO1lBQ2hDLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN0RSxRQUFRO2NBQ1IsVUFBVTtjQUNWLFNBQVM7Z0JBQ1AsTUFBTTtnQkFDTixTQUFTLGFBQWEsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7Z0JBQ3pDLGFBQWE7Y0FDZjtZQUNGO1lBRUEsSUFBSSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtjQUN6QixRQUFRLElBQUksQ0FBQyxDQUFDLG1DQUFtQyxDQUFDO1lBQ3BELE9BQ0s7Y0FDSCxjQUFjLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLE1BQU0sQ0FBQyxFQUFFO1lBQ25FO1VBQ0Y7VUFFQSxJQUFJLGFBQWE7WUFDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLGFBQWE7WUFFeEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVTtjQUNWLFFBQVEsWUFBWSxFQUFFO1lBQ3hCO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUUxRSxLQUFLLE1BQU0sUUFBUSxlQUFnQjtZQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUN4RCxRQUFRLEtBQUssRUFBRTtjQUNmLFVBQVUsZUFBZSxRQUFRO1lBQ25DO1VBQ0Y7VUFFQSxJQUFJLGVBQWUsWUFBWSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVc7WUFDdEQsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLE1BQU07WUFFckUsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxNQUFNO1lBRWpELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO2NBQ3RELFVBQVUsZUFBZSxRQUFRO2NBQ2pDLFFBQVEsS0FBSyxFQUFFO1lBQ2pCO1VBQ0Y7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxrQkFBa0I7SUFDaEIsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsTUFBTSxpQkFBeUIsRUFBRTtVQUNqQyxNQUFNLGVBQXVCLEVBQUU7VUFFL0IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztZQUMxQixJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUU5QixJQUFJLENBQUMsUUFBUTtjQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsK0NBQStDLENBQUM7Y0FDN0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQUUsVUFBVTtjQUFlO2NBRXJGLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtjQUUxQixJQUFJLENBQUMsUUFBUTtnQkFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO2dCQUM1RDtjQUNGO1lBQ0Y7WUFFQSxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDO1lBRWhELFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsTUFBTTtZQUVuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RCxRQUFRO2NBQ1IsVUFBVTtjQUNWLGdCQUFnQjtZQUNsQjtZQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2NBQUUsVUFBVTtZQUFlO1lBRWhHLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHO2NBQzVDLGFBQWEsSUFBSSxDQUFDO1lBQ3BCLE9BQ0s7Y0FDSCxlQUFlLElBQUksQ0FBQztZQUN0QjtVQUNGO1VBRUEsSUFBSSxjQUFnQztVQUNwQyxJQUFJLGFBQWEsTUFBTSxLQUFLLEdBQUc7WUFDN0IsY0FBYyxZQUFZLENBQUMsRUFBRTtVQUMvQixPQUNLLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRztZQUNoQyxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdEUsUUFBUTtjQUNSLFVBQVU7Y0FDVixTQUFTO2dCQUNQLE1BQU07Z0JBQ04sU0FBUyxhQUFhLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2dCQUN6QyxhQUFhO2NBQ2Y7WUFDRjtZQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Y0FDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztZQUNyRCxPQUNLO2NBQ0gsY0FBYyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtjQUNqRSxlQUFlLE1BQU0sQ0FBQyxhQUFhLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFLEtBQUssWUFBYSxFQUFFO1lBQy9FO1VBQ0Y7VUFFQSxJQUFJLGFBQWE7WUFDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGFBQWE7WUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVTtjQUNWLFFBQVEsWUFBWSxFQUFFO1lBQ3hCO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUUzRSxLQUFLLE1BQU0sUUFBUSxlQUFnQjtZQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUN4RCxRQUFRLEtBQUssRUFBRTtjQUNmLFVBQVU7WUFDWjtVQUNGO1VBRUEsSUFBSSxlQUFlLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ3RELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1lBRXJFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsTUFBTTtZQUVsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtZQUNqQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQztRQUNuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUVwRSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsTUFBTSxpQkFBeUIsRUFBRTtVQUNqQyxNQUFNLGVBQXVCLEVBQUU7VUFFL0IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztZQUMxQixJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUU5QixJQUFJLENBQUMsUUFBUTtjQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsK0NBQStDLENBQUM7Y0FDN0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQUUsVUFBVTtjQUFlO2NBRXJGLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtjQUUxQixJQUFJLENBQUMsUUFBUTtnQkFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO2dCQUM1RDtjQUNGO1lBQ0Y7WUFFQSxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDO1lBRWhELFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsTUFBTTtZQUVuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RCxRQUFRO2NBQ1IsVUFBVTtjQUNWLGdCQUFnQjtZQUNsQjtZQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2NBQUUsVUFBVTtZQUFlO1lBRWhHLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHO2NBQzVDLGFBQWEsSUFBSSxDQUFDO1lBQ3BCLE9BQ0s7Y0FDSCxlQUFlLElBQUksQ0FBQztZQUN0QjtVQUNGO1VBRUEsSUFBSSxjQUFnQztVQUNwQyxJQUFJLGFBQWEsTUFBTSxLQUFLLEdBQUc7WUFDN0IsY0FBYyxZQUFZLENBQUMsRUFBRTtVQUMvQixPQUNLLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRztZQUNoQyxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdEUsUUFBUTtjQUNSLFVBQVU7Y0FDVixTQUFTO2dCQUNQLE1BQU07Z0JBQ04sU0FBUyxhQUFhLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2dCQUN6QyxhQUFhO2NBQ2Y7WUFDRjtZQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Y0FDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztZQUNyRCxPQUNLO2NBQ0gsY0FBYyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtjQUNqRSxlQUFlLE1BQU0sQ0FBQyxhQUFhLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFLEtBQUssWUFBYSxFQUFFO1lBQy9FO1VBQ0Y7VUFFQSxJQUFJLGFBQWE7WUFDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGFBQWE7WUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVTtjQUNWLFFBQVEsWUFBWSxFQUFFO1lBQ3hCO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUUzRSxLQUFLLE1BQU0sUUFBUSxlQUFnQjtZQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUN4RCxRQUFRLEtBQUssRUFBRTtjQUNmLFVBQVU7WUFDWjtVQUNGO1VBRUEsSUFBSSxlQUFlLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ3RELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1lBRXJFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsTUFBTTtZQUVsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtZQUNqQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsZ0JBQWdCO0lBQ2QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFFBQVEsZUFBZSxTQUFTLENBQUM7VUFDckM7WUFBRSxVQUFVO2NBQUM7Y0FBZTthQUFnQjtVQUFDO1VBQzdDO1lBQUUsTUFBTTtZQUFRLFVBQVUsZUFBZSxRQUFRO1lBQUUsUUFBUTtjQUFFLFVBQVU7WUFBRTtVQUFFO1NBQzVFO1FBRUQsSUFBSSxDQUFDLE1BQU0sTUFBTSxFQUFFO1VBQ2pCLFFBQVEsR0FBRyxDQUFDLENBQUMsd0NBQXdDLENBQUM7UUFDeEQsT0FDSztVQUNILE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQy9FLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDbkIsVUFBVSxNQUFNLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1lBQ25DLE9BQU87WUFDUCxVQUFVO1VBQ1o7VUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHNDQUFzQyxDQUFDO1VBQ3RELE9BQ0s7WUFDSCxNQUFNLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1lBRTFFLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsY0FBYztZQUUzRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtjQUNyRCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLGFBQWEsRUFBRTtjQUN2QixJQUFJO2dCQUFFLFVBQVU7Y0FBZ0I7WUFDbEM7VUFDRjtRQUNGO1FBRUEsTUFBTSxrQkFBa0IsbUJBQW1CO1VBQ3pDLE9BQU8sZUFBZSxLQUFLO1VBQzNCLFdBQVc7VUFDWCxrQkFBa0IsZUFBZSxRQUFRO1FBQzNDLEdBQUcsTUFBTSxDQUFDLENBQUEsV0FBWSxlQUFlLGVBQWUsRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXO1FBRTdFLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjO1VBRXpFLE1BQU0saUJBQXlCLEVBQUU7VUFDakMsTUFBTSxlQUF1QixFQUFFO1VBRS9CLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7WUFDMUIsSUFBSSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFFOUIsSUFBSSxDQUFDLFFBQVE7Y0FDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtDQUErQyxDQUFDO2NBQzdELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2dCQUFFLFVBQVU7Y0FBZTtjQUVyRixTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7Y0FFMUIsSUFBSSxDQUFDLFFBQVE7Z0JBQ1gsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztnQkFDNUQ7Y0FDRjtZQUNGO1lBRUEsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQztZQUVoRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLE1BQU07WUFFbkQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdkQsUUFBUTtjQUNSLFVBQVU7Y0FDVixnQkFBZ0I7WUFDbEI7WUFFQSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBZSxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsTUFBTTtjQUFFLFVBQVU7WUFBZTtZQUVoRyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRztjQUM1QyxhQUFhLElBQUksQ0FBQztZQUNwQixPQUNLO2NBQ0gsZUFBZSxJQUFJLENBQUM7WUFDdEI7VUFDRjtVQUVBLElBQUksY0FBZ0M7VUFDcEMsSUFBSSxhQUFhLE1BQU0sS0FBSyxHQUFHO1lBQzdCLGNBQWMsWUFBWSxDQUFDLEVBQUU7VUFDL0IsT0FDSyxJQUFJLGFBQWEsTUFBTSxHQUFHLEdBQUc7WUFDaEMsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3RFLFFBQVE7Y0FDUixVQUFVO2NBQ1YsU0FBUztnQkFDUCxNQUFNO2dCQUNOLFNBQVMsYUFBYSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtnQkFDekMsYUFBYTtjQUNmO1lBQ0Y7WUFFQSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO2NBQ3pCLFFBQVEsSUFBSSxDQUFDLENBQUMsb0NBQW9DLENBQUM7WUFDckQsT0FDSztjQUNILGNBQWMsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sTUFBTSxDQUFDLEVBQUU7Y0FDakUsZUFBZSxNQUFNLENBQUMsYUFBYSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRSxLQUFLLFlBQWEsRUFBRTtZQUMvRTtVQUNGO1VBRUEsSUFBSSxhQUFhO1lBQ2YsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxhQUFhO1lBRXpELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO2NBQ3RELFVBQVU7Y0FDVixRQUFRLFlBQVksRUFBRTtZQUN4QjtVQUNGO1VBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxlQUFlLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFFM0UsS0FBSyxNQUFNLFFBQVEsZUFBZ0I7WUFDakMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsUUFBUSxLQUFLLEVBQUU7Y0FDZixVQUFVO1lBQ1o7VUFDRjtVQUVBLElBQUksZUFBZSxZQUFZLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVztZQUN0RCxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtZQUVyRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLE1BQU07WUFFbEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxLQUFLLEVBQUU7WUFDakI7VUFDRjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGVBQWU7SUFDYixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLENBQUM7UUFDcEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsTUFBTSxpQkFBeUIsRUFBRTtVQUNqQyxNQUFNLGVBQXVCLEVBQUU7VUFFL0IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztZQUMxQixJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUU5QixJQUFJLENBQUMsUUFBUTtjQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsK0NBQStDLENBQUM7Y0FDN0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQUUsVUFBVTtjQUFlO2NBRXJGLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtjQUUxQixJQUFJLENBQUMsUUFBUTtnQkFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO2dCQUM1RDtjQUNGO1lBQ0Y7WUFFQSxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDO1lBRWhELFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsTUFBTTtZQUVuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RCxRQUFRO2NBQ1IsVUFBVTtjQUNWLGdCQUFnQjtZQUNsQjtZQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2NBQUUsVUFBVTtZQUFlO1lBRWhHLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHO2NBQzVDLGFBQWEsSUFBSSxDQUFDO1lBQ3BCLE9BQ0s7Y0FDSCxlQUFlLElBQUksQ0FBQztZQUN0QjtVQUNGO1VBRUEsSUFBSSxjQUFnQztVQUNwQyxJQUFJLGFBQWEsTUFBTSxLQUFLLEdBQUc7WUFDN0IsY0FBYyxZQUFZLENBQUMsRUFBRTtVQUMvQixPQUNLLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRztZQUNoQyxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdEUsUUFBUTtjQUNSLFVBQVU7Y0FDVixTQUFTO2dCQUNQLE1BQU07Z0JBQ04sU0FBUyxhQUFhLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2dCQUN6QyxhQUFhO2NBQ2Y7WUFDRjtZQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Y0FDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztZQUNyRCxPQUNLO2NBQ0gsY0FBYyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtjQUNqRSxlQUFlLE1BQU0sQ0FBQyxhQUFhLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFLEtBQUssWUFBYSxFQUFFO1lBQy9FO1VBQ0Y7VUFFQSxJQUFJLGFBQWE7WUFDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGFBQWE7WUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVTtjQUNWLFFBQVEsWUFBWSxFQUFFO1lBQ3hCO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUUzRSxLQUFLLE1BQU0sUUFBUSxlQUFnQjtZQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUN4RCxRQUFRLEtBQUssRUFBRTtjQUNmLFVBQVU7WUFDWjtVQUNGO1VBRUEsSUFBSSxlQUFlLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ3RELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1lBRXJFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsTUFBTTtZQUVsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtZQUNqQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsVUFBVSxPQUFPLE1BQU07VUFDckIsTUFBTSxZQUFZLEtBQUssU0FBUyxDQUFDO1lBQy9CO2NBQUUsVUFBVTtZQUFnQjtZQUM1QjtjQUFFLFNBQVM7WUFBUTtXQUNwQjtVQUVELE1BQU0sWUFBWSxLQUFLLEdBQUcsQ0FBQyxHQUFHLFVBQVUsTUFBTTtVQUU5QyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLFVBQVUsTUFBTSxDQUFDO1VBRXJFLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxXQUFXLElBQUs7WUFDbEMsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFlBQVk7Y0FDM0MsVUFBVSxVQUFVLFFBQVE7Y0FDNUIsUUFBUSxVQUFVLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUU7Y0FDbEMsSUFBSTtnQkFBRSxVQUFVO2NBQWdCO1lBQ2xDO1VBQ0Y7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUNoRyxNQUFNLG9CQUFvQixLQUN2QixHQUFHLENBQUMsZUFBZSxXQUFXLENBQUMsT0FBTyxFQUN0QyxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUVyQyxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsV0FBVyxDQUFDO1VBQ3JCLFVBQVU7ZUFBSSxrQkFBa0IsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7WUFBRyxlQUFlLE1BQU07V0FBQztVQUM1RSxPQUFPO1VBQ1AsVUFBVTtRQUNaO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztVQUNsRDtRQUNGO1FBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLGtDQUFrQyxFQUFFLGNBQWM7UUFFL0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7VUFDdEQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxhQUFhLEVBQUU7UUFDekI7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHNDQUFzQyxDQUFDO1FBQ3BELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7TUFDeEU7RUFDRjtFQUNBLFVBQVU7SUFDUix5QkFBeUIsSUFBTSxDQUFDO1FBQzlCLE1BQU0sZUFBZSxLQUFLLFNBQVMsQ0FBQztVQUNsQztZQUFFLE9BQU8sS0FBSyxPQUFPO1VBQUM7VUFDdEI7WUFBRSxVQUFVO1VBQVM7U0FDdEI7UUFFRCxNQUFNLFNBQVMsS0FBSyxLQUFLLENBQUMsYUFBYSxNQUFNLEdBQUc7UUFDaEQsT0FBTztNQUNUO0lBQ0EsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixXQUFXLE9BQU8sTUFBTTtVQUN0QixNQUFNLGNBQWMsS0FBSyxTQUFTLENBQUM7WUFDakM7Y0FBRSxVQUFVO1lBQWM7WUFDMUI7Y0FBRSxVQUFVO1lBQVM7V0FDdEI7VUFFRCxNQUFNLFlBQVksS0FBSyxHQUFHLENBQUMsR0FBRyxZQUFZLE1BQU07VUFFaEQsUUFBUSxHQUFHLENBQUMsQ0FBQyxrQ0FBa0MsRUFBRSxVQUFVLFFBQVEsQ0FBQztVQUVwRSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksV0FBVyxJQUFLO1lBQ2xDLE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxZQUFZO2NBQzNDLFVBQVUsU0FBUyxRQUFRO2NBQzNCLFFBQVEsWUFBWSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFO2NBQ3BDLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztVQUNGO1FBQ0Y7TUFDRixDQUFDO0VBQ0g7RUFDQSxXQUFXO0lBQ1QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDRDQUE0QyxDQUFDO1FBQzFELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBQ3BFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxXQUFXO1VBQUUsT0FBTztRQUFFO1FBRWpFLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUVoRyxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsVUFBVSxDQUFDO1VBQ3BCLFVBQVU7VUFDVixPQUFPO1FBQ1Q7UUFFQSxJQUFJLGdCQUFnQixNQUFNLEtBQUssR0FBRztVQUNoQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1VBQy9DO1FBQ0Y7UUFFQSxNQUFNLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBRTFFLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLEVBQUUsY0FBYztRQUU1RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtVQUN0RCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLGFBQWEsRUFBRTtRQUN6QjtRQUVBLE1BQU0sUUFBUSxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQztRQUM1RCxNQUFNLHlCQUF5QixJQUFJLElBQ2pDLE1BQU0sR0FBRyxDQUFDLGVBQWUsV0FBVyxDQUFDLE9BQU8sRUFDekMsTUFBTSxDQUFDLENBQUEsT0FBUSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsYUFDbEMsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLE9BQU8sR0FDM0IsSUFBSTtRQUVOLFFBQVEsR0FBRyxDQUFDLENBQUMseUJBQXlCLEVBQUUsdUJBQXVCLFNBQVMsQ0FBQztRQUV6RSxJQUFJLHlCQUF5QixHQUFHO1VBQzlCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7WUFBRSxPQUFPO1VBQXVCO1FBQzdGO01BQ0Y7RUFDRjtFQUNBLFlBQVk7SUFDViwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLFdBQVcsT0FBTyxNQUFNO1VBQ3RCLFFBQVEsR0FBRyxDQUFDLENBQUMseURBQXlELENBQUM7VUFFdkUsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFlBQVk7WUFDM0MsUUFBUSxVQUFVLE1BQU07WUFDeEIsWUFBWSxVQUFVLFFBQVE7WUFDOUIsSUFBSTtjQUFFLFVBQVU7WUFBYTtVQUMvQjtRQUNGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyx1REFBdUQsQ0FBQztRQUNyRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7TUFFdEU7RUFDRjtFQUNBLGVBQWU7SUFDYixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN0RSxRQUFRO1VBQ1IsVUFBVSxlQUFlLFFBQVE7VUFDakMsZUFBZTtZQUNiO2NBQUUsT0FBTztjQUFhLFFBQVE7WUFBRTtZQUNoQztjQUFFLE9BQU87Y0FBYyxRQUFRO1lBQUU7V0FDbEM7UUFDSDtRQUVBLElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztVQUN2QixNQUFNLGFBQWEsZUFBZSxTQUFTLENBQUM7WUFDMUM7Y0FBRSxVQUFVO1lBQVE7V0FDckIsRUFDRSxNQUFNLENBQUMsQ0FBQTtZQUNOLE1BQU0sT0FBTyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2NBQUUsVUFBVSxlQUFlLFFBQVE7WUFBQztZQUNyRyxPQUFPLEtBQUssSUFBSSxDQUFDLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLFFBQVEsSUFBSTtVQUMxRDtVQUVGLElBQUksQ0FBQyxXQUFXLE1BQU0sRUFBRTtZQUN0QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHNDQUFzQyxDQUFDO1lBQ3BEO1VBQ0Y7VUFFQSxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDdEUsUUFBUTtZQUNSLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFNBQVM7Y0FDUCxNQUFNO2NBQ04sU0FBUyxXQUFXLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2NBQ3ZDLGFBQWE7WUFDZjtVQUNGO1VBRUEsSUFBSSxDQUFDLE9BQU8sT0FBTyxFQUFFO1lBQ25CLFFBQVEsSUFBSSxDQUFDLENBQUMscUNBQXFDLENBQUM7WUFDcEQ7VUFDRjtVQUVBLE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxPQUFPLENBQUMsRUFBRTtVQUVqRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLGtDQUFrQyxFQUFFLE1BQU07VUFFdkQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxLQUFLLEVBQUU7WUFDZixJQUFJO2NBQUUsVUFBVTtZQUFhO1VBQy9CO1FBQ0YsT0FDSztVQUNILE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtVQUNoRyxNQUFNLGdCQUFnQixLQUFLLEdBQUcsQ0FBQyxlQUFlLFdBQVcsQ0FBQyxPQUFPLEVBQzlELE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1VBRXJDLElBQUksQ0FBQyxjQUFjLE1BQU0sRUFBRTtZQUN6QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHVDQUF1QyxDQUFDO1lBQ3JEO1VBQ0Y7VUFFQSxJQUFJLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUM3RSxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLENBQUMsWUFBWSxDQUFDO1lBQ3RCLFVBQVUsY0FBYyxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtZQUMzQyxPQUFPO1VBQ1Q7VUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLHFDQUFxQyxDQUFDO1lBQ3BEO1VBQ0Y7VUFFQSxJQUFJLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1VBRXhFLFFBQVEsR0FBRyxDQUFDLENBQUMsbUNBQW1DLEVBQUUsY0FBYztVQUVoRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtZQUN0RCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLGFBQWEsRUFBRTtVQUN6QjtVQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxjQUFjO1lBQUUsVUFBVSxlQUFlLFFBQVE7VUFBQztVQUVqSCxNQUFNLFFBQVEsZUFBZSxTQUFTLENBQUM7WUFDckM7Y0FBRSxVQUFVO2dCQUFDO2dCQUFpQjtlQUFjO1lBQUM7WUFDN0M7Y0FDRSxNQUFNO2NBQ04sVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUTtnQkFBRSxVQUFVLEtBQUssUUFBUSxHQUFHO2dCQUFHLFFBQVEsS0FBSyxNQUFNO2NBQUM7WUFDN0Q7V0FDRDtVQUVELElBQUksQ0FBQyxNQUFNLE1BQU0sRUFBRTtZQUNqQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHFEQUFxRCxFQUFFLEtBQUssUUFBUSxHQUFHLEdBQUc7WUFDdkY7VUFDRjtVQUVBLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUN6RSxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQ25CLFVBQVUsTUFBTSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtZQUNuQyxPQUFPO1VBQ1Q7VUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLHFDQUFxQyxDQUFDO1lBQ3BEO1VBQ0Y7VUFFQSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtVQUVwRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGNBQWM7VUFFMUQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxhQUFhLEVBQUU7WUFDdkIsSUFBSTtjQUFFLFVBQVU7WUFBZ0I7VUFDbEM7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxVQUFVO0lBQ1IsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFVBQVUsZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLGVBQWUsUUFBUTtRQUN0RyxJQUFJLG1CQUFtQixRQUNwQixHQUFHLENBQUMsZUFBZSxXQUFXLENBQUMsT0FBTyxFQUN0QyxNQUFNLENBQUMsQ0FBQSxPQUFRLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBRXRDLElBQUksZUFBaUM7UUFFckMsSUFBSSxRQUFRLE1BQU0sR0FBRyxHQUFHO1VBQ3RCLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUN0RSxRQUFRO1lBQ1IsVUFBVSxlQUFlLFFBQVE7WUFDakMsU0FBUztjQUNQLE1BQU07Y0FDTixTQUFTO2NBQ1QsbUJBQW1CLGlCQUFpQixHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtjQUN2RCxhQUFhO1lBQ2Y7WUFDQSxlQUFlO2NBQUM7Z0JBQUUsT0FBTztnQkFBYyxRQUFRO2NBQUU7YUFBRTtVQUNyRDtVQUVBLElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztZQUN2QixRQUFRLElBQUksQ0FBQyxDQUFDLDZDQUE2QyxDQUFDO1VBQzlELE9BQ0ssSUFBSSxPQUFPLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRztZQUNqQyxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLE1BQU0sQ0FBQyxFQUFFO1lBQ2xFLFFBQVEsR0FBRyxDQUFDLENBQUMseUJBQXlCLEVBQUUsYUFBYSxhQUFhLENBQUM7VUFDckU7UUFDRixPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyxtQ0FBbUMsQ0FBQztRQUNuRDtRQUVBLElBQUksQ0FBQyxjQUFjO1VBQ2pCLFFBQVEsR0FBRyxDQUFDLENBQUMsd0NBQXdDLENBQUM7VUFFdEQsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1VBQ2hHLG1CQUFtQixLQUNoQixHQUFHLENBQUMsZUFBZSxXQUFXLENBQUMsT0FBTyxFQUN0QyxNQUFNLENBQUMsQ0FBQSxPQUFRLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1VBRXRDLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQy9FLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFDcEIsVUFBVSxpQkFBaUIsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7WUFDOUMsT0FBTztZQUNQLFVBQVU7VUFDWjtVQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1lBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLENBQUM7VUFDdEQsT0FDSztZQUNILGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1VBQ3RFO1FBQ0Y7UUFFQSxJQUFJLENBQUMsY0FBYztVQUNqQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1FBQ3pELE9BQ0s7VUFDSCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLGNBQWM7VUFFM0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7WUFDdEQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxhQUFhLEVBQUU7VUFDekI7UUFDRjtRQUVBLE1BQU0sUUFBUSxlQUFlLFNBQVMsQ0FBQztVQUNyQztZQUFFLFVBQVU7Y0FBQztjQUFlO2FBQWdCO1VBQUM7VUFDN0M7WUFBRSxNQUFNO1lBQVEsVUFBVSxlQUFlLFFBQVE7WUFBRSxRQUFRO2NBQUUsVUFBVTtZQUFFO1VBQUU7U0FDNUU7UUFFRCxJQUFJLENBQUMsTUFBTSxNQUFNLEVBQUU7VUFDakIsUUFBUSxHQUFHLENBQUMsQ0FBQyxpREFBaUQsQ0FBQztRQUNqRSxPQUNLO1VBQ0gsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDL0UsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUNuQixVQUFVLE1BQU0sR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7WUFDbkMsT0FBTztVQUNUO1VBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7WUFDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztVQUNqRCxPQUNLO1lBQ0gsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtZQUMxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLGNBQWM7WUFFckQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7Y0FDckQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxhQUFhLEVBQUU7Y0FDdkIsSUFBSTtnQkFBRSxVQUFVO2NBQWdCO1lBQ2xDO1VBQ0Y7UUFDRjtRQUVBLGVBQWUsZUFBZSxDQUFDLHdCQUF3QixDQUFDO1VBQ3RELElBQUksQ0FBQyxPQUFPLEVBQUUsZUFBZSxNQUFNLENBQUMsYUFBYSxDQUFDO1VBQ2xELGNBQWM7VUFDZCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxNQUFNO1VBQ04sd0JBQXdCO1VBQ3hCLFlBQVk7VUFDWixXQUFXLENBQUE7WUFDVCxJQUFJLGFBQWEsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBTSxPQUFPLE9BQU87WUFDMUUsSUFBSSxpQkFBaUIsY0FBYyxLQUFLLEVBQUUsRUFBRSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFFakYsTUFBTSxnQkFBZ0IsY0FBYyxLQUFLLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLGNBQWMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUU7WUFFdkcsTUFBTSw4QkFBOEIsY0FBYyxNQUFNLENBQUMsQ0FBQTtjQUN2RCxNQUFNLFFBQVEsY0FBYyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPO2NBQzNELE9BQU8sTUFBTSxRQUFRLEtBQUssZUFBZSxRQUFRLElBQUksTUFBTSxTQUFTLEtBQUs7WUFDM0U7WUFFQSxJQUFJLDRCQUE0QixNQUFNLEdBQUcsR0FBRyxPQUFPO1lBRW5ELE9BQU87VUFDVDtVQUNBLG1CQUFtQixPQUFNO1lBQ3ZCLE1BQU0sY0FBYyxjQUFjLFNBQVMsQ0FBQztjQUMxQztnQkFBRSxVQUFVO2NBQWlCO2NBQzdCO2dCQUFFLFNBQVM7Y0FBUzthQUNyQjtZQUVELElBQUksQ0FBQyxZQUFZLE1BQU0sRUFBRTtjQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGdEQUFnRCxDQUFDO2NBQzlEO1lBQ0Y7WUFFQSxNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtZQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxFQUFFLFdBQVcsVUFBVSxDQUFDO1lBRXpFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2NBQ3JELFFBQVEsV0FBVyxFQUFFO2NBQ3JCLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztZQUNBLE1BQU0sT0FBTyxZQUFZLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBRXJDLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLEVBQUUsTUFBTTtZQUUxRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtjQUNyRCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtjQUNmLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsU0FBUztJQUNQLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxNQUFNLENBQUMsV0FBVyxDQUFDO1FBQy9FO1FBQ0EsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsd0JBQXdCLENBQUM7WUFDNUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxVQUFVLE1BQU0sQ0FBQyxXQUFXLENBQUM7WUFDMUMsVUFBVSxVQUFVLFFBQVE7WUFDNUIsY0FBYztZQUNkLE1BQU07WUFDTixZQUFZO1lBQ1osd0JBQXdCO1lBQ3hCLFdBQVcsQ0FBQTtjQUNULElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxVQUFVLFFBQVEsRUFBRSxPQUFPO2NBQ3ZFLE1BQU0sT0FBTyxjQUFjLFdBQVcsQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU07Y0FDaEYsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLE9BQU87Y0FDM0MsT0FBTztZQUNUO1lBQ0EsbUJBQW1CLE9BQU07Y0FDdkIsTUFBTSxZQUFZLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07Y0FFcEUsUUFBUSxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsRUFBRSxXQUFXO2NBRTNELE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxhQUFhO2dCQUNyRCxVQUFVLFVBQVUsUUFBUTtnQkFDNUIsUUFBUSxVQUFVLEVBQUU7Y0FDdEI7WUFDRjtVQUNGO1FBQ0Y7TUFDRixDQUFDO0VBQ0g7RUFDQSxtQkFBbUI7SUFDakIsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixXQUFXLE9BQU8sTUFBTTtVQUN0QixNQUFNLFNBQVMsTUFBTSxLQUFLLHFCQUFxQixDQUFDLGNBQWM7WUFDNUQsUUFBUTtZQUNSLFVBQVUsVUFBVSxRQUFRO1lBQzVCLGVBQWU7Y0FDYjtnQkFBRSxPQUFPO2dCQUFXLFFBQVE7Y0FBRTtjQUM5QjtnQkFBRSxPQUFPO2dCQUFhLFFBQVE7Y0FBRTthQUNqQztVQUNIO1VBRUEsSUFBSTtVQUNKLElBQUk7VUFFSixJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7WUFDdkIsUUFBUSxLQUFLLFNBQVMsQ0FBQztjQUNyQjtnQkFBRSxVQUFVO2NBQWM7Y0FDMUI7Z0JBQUUsVUFBVTtjQUFRO2FBQ3JCO1lBQ0QsWUFBWSxLQUFLLEdBQUcsQ0FBQyxHQUFHLE1BQU0sTUFBTTtVQUN0QyxPQUNLO1lBQ0gsUUFBUSxLQUFLLFNBQVMsQ0FBQztjQUNyQjtnQkFBRSxVQUFVO2NBQWM7Y0FDMUI7Z0JBQUUsVUFBVTtjQUFTO2FBQ3RCO1lBQ0QsWUFBWSxLQUFLLEdBQUcsQ0FBQyxHQUFHLE1BQU0sTUFBTTtVQUN0QztVQUVBLElBQUksQ0FBQyxXQUFXO1lBQ2QsUUFBUSxHQUFHLENBQUMsQ0FBQyxtREFBbUQsQ0FBQztVQUNuRTtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMkNBQTJDLEVBQUUsVUFBVSxDQUFDLEVBQUUsT0FBTyxNQUFNLEtBQUssSUFBSSxVQUFVLFVBQVU7VUFFakgsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFdBQVcsSUFBSztZQUNsQyxNQUFNLEtBQUsscUJBQXFCLENBQUMsWUFBWTtjQUMzQyxVQUFVLFVBQVUsUUFBUTtjQUM1QixRQUFRLE1BQU0sS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO2NBQzdCLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztVQUNGO1FBQ0Y7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHdDQUF3QyxDQUFDO1FBQ3RELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7VUFBRSxPQUFPO1FBQUU7TUFDdkc7RUFDRjtFQUNBLGNBQWM7SUFDWixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsd0RBQXdELENBQUM7UUFDdEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBQzNGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBRXBFLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUVoRyxJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7VUFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQywrQ0FBK0MsQ0FBQztVQUM3RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUFFLFVBQVUsZUFBZSxRQUFRO1VBQUM7VUFFOUYsSUFBSSxLQUFLLE1BQU0sS0FBSyxHQUFHO1lBQ3JCLFFBQVEsR0FBRyxDQUFDLENBQUMsMENBQTBDLENBQUM7WUFDeEQ7VUFDRjtRQUNGO1FBRUEsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBRWpFLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsTUFBTTtRQUVuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN2RCxRQUFRLEtBQUssRUFBRTtVQUNmLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLGdCQUFnQjtRQUNsQjtRQUVBLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN0RSxRQUFRLENBQUMsUUFBUSxFQUFFLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztVQUNuQyxVQUFVLGVBQWUsUUFBUTtVQUNqQyxlQUFlO1lBQ2I7Y0FBRSxPQUFPO2NBQVUsUUFBUTtZQUFFO1lBQzdCO2NBQUUsT0FBTztjQUFXLFFBQVE7WUFBRTtXQUMvQjtRQUNIO1FBRUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxHQUFHO1VBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsMkNBQTJDLEVBQUUsS0FBSyxhQUFhLENBQUM7VUFFN0UsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsUUFBUSxLQUFLLEVBQUU7WUFDZixZQUFZLGVBQWUsUUFBUTtZQUNuQyxJQUFJO2NBQUUsVUFBVTtZQUFhO1VBQy9CO1FBQ0YsT0FDSztVQUNILFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLEVBQUUsTUFBTTtVQUNwRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUN4RCxRQUFRLEtBQUssRUFBRTtZQUNmLFVBQVUsZUFBZSxRQUFRO1VBQ25DO1FBQ0Y7UUFFQSxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1VBQ2hDLFFBQVEsR0FBRyxDQUFDLENBQUMseURBQXlELENBQUM7VUFDdkUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFBRSxPQUFPO1VBQUU7UUFDdEU7UUFFQSxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhO1VBQ2xDLFFBQVEsR0FBRyxDQUFDLENBQUMsNkRBQTZELENBQUM7VUFDM0UsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtZQUFFLE9BQU87VUFBRTtRQUN4RTtRQUVBLElBQUksS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVk7VUFDakMsUUFBUSxHQUFHLENBQUMsQ0FBQyxtRUFBbUUsQ0FBQztVQUNqRixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUFFLFVBQVUsZUFBZSxRQUFRO1VBQUM7UUFDN0Y7TUFDRjtFQUNGO0VBQ0EsZUFBZTtJQUNiLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyx3RUFBd0UsQ0FBQztRQUN0RixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFDcEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsVUFBVSxDQUFDO1VBQ3BCLFVBQVUsZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7VUFDN0YsT0FBTztRQUNUO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQztVQUNuRDtRQUNGO1FBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxFQUFFLGNBQWM7UUFFaEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7VUFDdEQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxhQUFhLEVBQUU7UUFDekI7TUFDRjtFQUNGO0VBQ0EsVUFBVTtJQUNSLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxXQUFXLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLE1BQU07UUFFekUsUUFBUSxHQUFHLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSxTQUFTLG1CQUFtQixDQUFDO1FBRW5FLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNwRSxRQUFRLFNBQVMsRUFBRTtVQUNuQixJQUFJO1lBQUUsVUFBVTtVQUFpQjtRQUNuQztRQUVBLElBQUksUUFBUTtVQUNWLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtVQUNoRyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLEtBQUssTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUMxRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxPQUFPLEtBQUssTUFBTTtVQUNwQjtRQUNGO01BQ0Y7RUFDRjtFQUNBLFlBQVk7SUFDVixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sYUFBYSxlQUFlLFNBQVMsQ0FBQztVQUMxQztZQUFFLFVBQVU7VUFBaUI7VUFDN0I7WUFBRSxTQUFTO1VBQVM7U0FDckI7UUFFRCxJQUFJLENBQUMsV0FBVyxNQUFNLEVBQUU7VUFDdEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQztRQUNyRCxPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQywwQkFBMEIsRUFBRSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7VUFFbEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUNsQyxJQUFJO2NBQUUsVUFBVTtZQUFnQjtVQUNsQztRQUNGO1FBRUEsTUFBTSxZQUFZLGVBQWUsU0FBUyxDQUFDO1VBQ3pDO1lBQUUsVUFBVTtVQUFnQjtVQUM1QjtZQUFFLFNBQVM7VUFBUTtTQUNwQjtRQUVELElBQUksQ0FBQyxVQUFVLE1BQU0sRUFBRTtVQUNyQixRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxDQUFDO1VBQ2xEO1FBQ0Y7UUFFQSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsSUFBSSxnQkFBZ0IsTUFBTSxHQUFHLFVBQVUsTUFBTSxFQUFFO1VBQzdDLGdCQUFnQixNQUFNLEdBQUcsVUFBVSxNQUFNO1FBQzNDO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxnQkFBZ0IsTUFBTSxDQUFDLHNCQUFzQixDQUFDO1FBRXpGLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFVBQVU7WUFDVixRQUFRLFVBQVUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ2pDLElBQUk7Y0FBRSxVQUFVO1lBQWdCO1VBQ2xDO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsaUJBQWlCO0lBQ2YsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLGNBQWMsRUFBRSxVQUFVLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFDeEY7UUFDQSxhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztZQUM1QyxJQUFJLENBQUMsY0FBYyxFQUFFLFVBQVUsTUFBTSxDQUFDLFlBQVksQ0FBQztZQUNuRCxjQUFjO1lBQ2QsVUFBVSxVQUFVLFFBQVE7WUFDNUIsTUFBTTtZQUNOLFlBQVk7WUFDWix3QkFBd0I7WUFDeEIsV0FBVyxDQUFBO2NBQ1QsTUFBTSxjQUFjLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtjQUN2RixJQUFJLFlBQVksS0FBSyxLQUFLLFVBQVUsUUFBUSxFQUFFLE9BQU87Y0FDckQsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxLQUFLLGNBQWMsT0FBTztjQUNsRixJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEtBQUssVUFBVSxRQUFRLEVBQUUsT0FBTztjQUN4RixPQUFPO1lBQ1Q7WUFDQSxtQkFBbUIsT0FBTTtjQUN2QixNQUFNLG1CQUFtQixjQUFjLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO2NBQzNFLFFBQVEsR0FBRyxDQUFDLENBQUMsOENBQThDLEVBQUUsa0JBQWtCO2NBQy9FLE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxlQUFlO2dCQUN2RCxRQUFRLGlCQUFpQixFQUFFO2dCQUMzQixVQUFVLFVBQVUsUUFBUTtjQUM5QjtjQUVBLE1BQU0sWUFBWSxjQUFjLFNBQVMsQ0FBQztnQkFDeEM7a0JBQUUsVUFBVTtnQkFBYztnQkFDMUI7a0JBQUUsVUFBVTtnQkFBTztlQUNwQjtjQUVELElBQUksQ0FBQyxVQUFVLE1BQU0sRUFBRTtnQkFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQywwREFBMEQsQ0FBQztnQkFDeEU7Y0FDRjtjQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMkNBQTJDLEVBQUUsVUFBVSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO2NBRWxGLE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxZQUFZO2dCQUNwRCxVQUFVLFVBQVUsUUFBUTtnQkFDNUIsUUFBUSxVQUFVLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDakMsSUFBSTtrQkFBRSxVQUFVO2dCQUFnQjtjQUNsQztZQUNGO1VBQ0Y7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0VBQWtFLENBQUM7UUFDaEYsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBQzNGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBQ3BFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxXQUFXO1VBQUUsT0FBTztRQUFFO01BQ25FO0VBQ0Y7RUFDQSxhQUFhO0lBQ1gsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7UUFFaEcsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLFlBQVksQ0FBQztVQUN0QixVQUFVO1VBQ1YsT0FBTztZQUNMLE1BQU07WUFDTixPQUFPLEtBQUssR0FBRyxDQUFDLEdBQUcsS0FBSyxNQUFNO1VBQ2hDO1VBQ0EsVUFBVTtRQUNaO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztVQUNsRDtRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxnQkFBZ0IsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUV6RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtZQUN0RCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRO1VBQ1Y7UUFDRjtRQUVBLElBQUksZ0JBQWdCLE1BQU0sS0FBSyxHQUFHO1VBQ2hDLFFBQVEsR0FBRyxDQUFDLENBQUMsd0NBQXdDLENBQUM7VUFDdEQ7UUFDRjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMERBQTBELENBQUM7UUFDeEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFFLE9BQU87UUFBRTtRQUNyRyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBRXRFLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLGVBQWUsS0FBSztVQUMzQixXQUFXO1VBQ1gsa0JBQWtCLGVBQWUsUUFBUTtRQUMzQyxHQUFHLE1BQU0sQ0FBQyxDQUFBLFdBQVksZUFBZSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVztRQUU3RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYztVQUV6RSxJQUFJLEtBQUssTUFBTSxJQUFJLEdBQUc7WUFDcEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxlQUFlLHVDQUF1QyxDQUFDO1lBQ3pGO1VBQ0Y7VUFFQSxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUMvRSxVQUFVO1lBQ1YsUUFBUSxDQUFDLFlBQVksQ0FBQztZQUN0QixVQUFVO1lBQ1YsT0FBTyxLQUFLLE1BQU0sR0FBRztVQUN2QjtVQUVBLElBQUksZ0JBQWdCLE1BQU0sS0FBSyxHQUFHO1lBQ2hDLFFBQVEsSUFBSSxDQUFDLENBQUMsb0NBQW9DLENBQUM7WUFDbkQ7VUFDRjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMEJBQTBCLEVBQUUsZUFBZSxZQUFZLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFFcEcsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7WUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsVUFBVTtjQUNWLFFBQVE7WUFDVjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsVUFBVTtJQUNSLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztRQUM5RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUNwRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBRXRFLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN0RSxRQUFRO1VBQ1IsVUFBVSxlQUFlLFFBQVE7VUFDakMsU0FBUztZQUFFLE1BQU07VUFBWTtRQUMvQjtRQUVBLE1BQU0sZUFBZSxPQUFPLE1BQU07UUFFbEMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBRWhHLElBQUksQ0FBQyxLQUFLLE1BQU0sRUFBRTtVQUNoQixRQUFRLEdBQUcsQ0FBQyxDQUFDLDJDQUEyQyxDQUFDO1VBQ3pELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO1lBQUUsVUFBVSxlQUFlLFFBQVE7VUFBQztVQUU5RixJQUFJLENBQUMsS0FBSyxNQUFNLEVBQUU7WUFDaEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxzQ0FBc0MsQ0FBQztZQUNwRDtVQUNGO1FBQ0Y7UUFFQSxNQUFNLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFFekUsUUFBUSxHQUFHLENBQUMsQ0FBQywwQkFBMEIsRUFBRSxjQUFjO1FBRXZELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3ZELFFBQVEsYUFBYSxFQUFFO1VBQ3ZCLFVBQVUsZUFBZSxRQUFRO1FBQ25DO1FBRUEsSUFBSSxhQUFhLE9BQU8sS0FBSyxjQUFjO1VBQ3pDLFFBQVEsR0FBRyxDQUFDLENBQUMsNENBQTRDLENBQUM7VUFFMUQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsUUFBUSxhQUFhLEVBQUU7WUFDdkIsWUFBWSxlQUFlLFFBQVE7WUFDbkMsSUFBSTtjQUFFLFVBQVU7WUFBYTtVQUMvQjtRQUNGLE9BQ0s7VUFDSCxRQUFRLEdBQUcsQ0FBQyxDQUFDLHVDQUF1QyxDQUFDO1FBQ3ZEO01BQ0Y7RUFDRjtFQUNBLGNBQWM7SUFDWixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLENBQUM7UUFDbkQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7TUFDdEU7RUFDRjtFQUNBLG9CQUFvQjtJQUNsQiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLFdBQVcsT0FBTyxNQUFNO1VBQ3RCLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1VBQ3RELElBQUksS0FBSyxLQUFLLEtBQUssVUFBVSxRQUFRLEVBQUU7VUFFdkMsUUFBUSxHQUFHLENBQUMsQ0FBQyxrREFBa0QsQ0FBQztVQUVoRSxNQUFNLEtBQUsscUJBQXFCLENBQUMsWUFBWTtZQUFFLFVBQVUsVUFBVSxRQUFRO1VBQUM7UUFDOUU7TUFDRixDQUFDO0VBQ0g7RUFDQSxXQUFXO0lBQ1QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1FBRS9DLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO1VBQ3RELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsZUFBZSxNQUFNO1FBQy9CO1FBRUEsTUFBTSxjQUFjLGVBQWUsU0FBUyxDQUFDO1VBQzNDO1lBQUUsVUFBVTtVQUFpQjtVQUM3QjtZQUFFLFNBQVM7VUFBUztTQUNyQjtRQUVELElBQUksQ0FBQyxZQUFZLE1BQU0sRUFBRTtVQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxDQUFDO1VBQ2xEO1FBQ0Y7UUFFQSxNQUFNLFlBQVksS0FBSyxHQUFHLENBQUMsR0FBRyxZQUFZLE1BQU07UUFFaEQsUUFBUSxHQUFHLENBQUMsQ0FBQyx5QkFBeUIsRUFBRSxVQUFVLE9BQU8sQ0FBQztRQUUxRCxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksV0FBVyxJQUFLO1VBQ2xDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVEsWUFBWSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUN2QyxJQUFJO2NBQUUsVUFBVTtZQUFnQjtVQUNsQztRQUNGO1FBRUEsTUFBTSxrQkFBa0IsbUJBQW1CO1VBQ3pDLE9BQU8sZUFBZSxLQUFLO1VBQzNCLFdBQVc7VUFDWCxrQkFBa0IsZUFBZSxRQUFRO1FBQzNDLEdBQUcsTUFBTSxDQUFDLENBQUEsV0FDUixlQUFlLGVBQWUsRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXLGNBQ3ZELGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsVUFBVSxNQUFNLElBQUk7UUFHbEYsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsUUFBUSxHQUFHLENBQUMsQ0FBQyxrQ0FBa0MsRUFBRSxlQUFlLEtBQUssQ0FBQztVQUN0RSxLQUFLLE1BQU0sVUFBVTtlQUFJO1dBQUssQ0FBRTtZQUM5QixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RDtjQUNBLFVBQVU7WUFDWjtVQUNGO1VBRUEsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQ3RFLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLGVBQWUsS0FBSyxFQUFFLGlCQUFpQixNQUFNO1lBQ3ZGLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFNBQVM7Y0FDUCxNQUFNO2NBQ04sU0FBUztjQUNULGFBQWE7WUFDZjtVQUNGO1VBRUEsSUFBSSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUN6QixRQUFRLElBQUksQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1lBQ2hEO1VBQ0Y7VUFFQSxNQUFNLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sTUFBTSxDQUFDLEVBQUU7VUFFeEUsUUFBUSxHQUFHLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxlQUFlLFlBQVksRUFBRSxjQUFjO1VBRWxGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO1lBQ3hELFFBQVEsYUFBYSxFQUFFO1lBQ3ZCLFVBQVU7VUFDWjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGNBQWM7SUFDWixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLENBQUM7UUFDcEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7UUFFaEcsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsRUFBRSxlQUFlLFFBQVEsQ0FBQyxLQUFLLENBQUM7UUFFbEYsS0FBSyxNQUFNLFVBQVU7YUFBSTtTQUFLLENBQUU7VUFDOUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDdkQ7WUFDQSxVQUFVLGVBQWUsUUFBUTtVQUNuQztRQUNGO1FBRUEsTUFBTSxzQkFBc0IsS0FBSyxHQUFHLENBQUMsZUFBZSxXQUFXLENBQUMsT0FBTyxFQUNwRSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUVyQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixFQUFFLG9CQUFvQixNQUFNLENBQUMsU0FBUyxDQUFDO1FBQy9FLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPLENBQUMsb0JBQW9CLE1BQU07UUFBQztNQUNsRztFQUNGO0VBQ0EsY0FBYztJQUNaLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSwrQkFBK0IsZUFBZSxTQUFTLENBQUM7VUFDNUQ7WUFBRSxVQUFVO1lBQWMsVUFBVSxlQUFlLFFBQVE7VUFBQztTQUM3RCxFQUNFLE1BQU0sQ0FBQyxDQUFBLE9BQVEsQ0FBQyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUM7UUFFeEUsSUFBSSxDQUFDLDZCQUE2QixNQUFNLEVBQUU7VUFDeEMsUUFBUSxHQUFHLENBQUMsQ0FBQyx3REFBd0QsQ0FBQztVQUN0RTtRQUNGO1FBRUEsSUFBSSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDN0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLFNBQVMsQ0FBQztVQUNuQixVQUFVLDZCQUE2QixHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtVQUMxRCxPQUFPO1VBQ1AsVUFBVTtRQUNaO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztVQUNsRDtRQUNGO1FBRUEsSUFBSSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUV4RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxFQUFFLGFBQWEsTUFBTSxDQUFDO1FBRXBFLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7VUFDMUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxhQUFhLEVBQUU7VUFDekI7UUFDRjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsY0FBYztRQUUxRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtVQUN0RCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLGFBQWEsRUFBRTtRQUN6QjtRQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxjQUFjO1VBQUUsVUFBVSxlQUFlLFFBQVE7UUFBQztRQUVqSCxNQUFNLFFBQVEsZUFBZSxTQUFTLENBQUM7VUFDckM7WUFBRSxVQUFVO1VBQWdCO1VBQzVCO1lBQ0UsTUFBTTtZQUNOLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVE7Y0FBRSxVQUFVLEtBQUssUUFBUSxHQUFHO2NBQUcsUUFBUSxLQUFLLE1BQU07WUFBQztVQUM3RDtTQUNEO1FBRUQsa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3pFLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsQ0FBQyxTQUFTLENBQUM7VUFDbkIsVUFBVSxNQUFNLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1VBQ25DLE9BQU87UUFDVDtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsSUFBSSxDQUFDLENBQUMsb0NBQW9DLENBQUM7VUFDbkQ7UUFDRjtRQUVBLGVBQWUsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBRXBFLFFBQVEsR0FBRyxDQUFDLENBQUMsaUNBQWlDLEVBQUUsY0FBYztRQUU5RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNyRCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLGFBQWEsRUFBRTtVQUN2QixJQUFJO1lBQUUsVUFBVTtVQUFnQjtRQUNsQztNQUNGO0VBQ0Y7RUFDQSxRQUFRO0lBQ04sMEJBQTBCLElBQU0sQ0FBQztRQUMvQixXQUFXLE9BQU8sTUFBTTtVQUN0QixNQUFNLGNBQWMsS0FBSyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBTTtVQUM3RCxJQUFJLEtBQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsVUFBVSxNQUFNLENBQUMsQ0FBQyxRQUFRLEtBQUssWUFBWSxLQUFLLEVBQUU7WUFDbEY7VUFDRjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLENBQUM7VUFDcEQsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFlBQVk7WUFBRSxVQUFVLFVBQVUsUUFBUTtVQUFDO1FBQzlFO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztRQUM1RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxXQUFXLGVBQWUsU0FBUyxDQUFDO1VBQ3hDO1lBQUUsVUFBVTtVQUFnQjtVQUM1QjtZQUFFLFVBQVU7VUFBTztTQUNwQjtRQUVELElBQUksQ0FBQyxTQUFTLE1BQU0sRUFBRTtVQUNwQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHVDQUF1QyxDQUFDO1FBQ3ZEO1FBRUEsTUFBTSxVQUFVLFNBQVMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFFckMsUUFBUSxHQUFHLENBQUMsQ0FBQywyQkFBMkIsRUFBRSxTQUFTO1FBRW5ELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsUUFBUSxFQUFFO1VBQ2xCLElBQUk7WUFBRSxVQUFVO1VBQWdCO1FBQ2xDO1FBRUEsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBRWhHLE1BQU0sb0JBQW9CLEtBQ3ZCLEdBQUcsQ0FBQyxlQUFlLFdBQVcsQ0FBQyxPQUFPLEVBQ3RDLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxPQUFPLEtBQUs7UUFFbkMsSUFBSSxDQUFDLGtCQUFrQixNQUFNLEVBQUU7VUFDN0IsUUFBUSxHQUFHLENBQUMsQ0FBQywwREFBMEQsQ0FBQztVQUV4RSxLQUFLLE1BQU0sVUFBVTtlQUFJO1dBQUssQ0FBRTtZQUM5QixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RDtjQUNBLFVBQVUsZUFBZSxRQUFRO1lBQ25DO1VBQ0Y7VUFFQTtRQUNGO1FBRUEsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUTtVQUNSLFVBQVUsa0JBQWtCLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1VBQy9DLE9BQU87UUFDVDtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsSUFBSSxDQUFDLENBQUMsOEJBQThCLENBQUM7VUFDN0M7UUFDRjtRQUVBLE1BQU0sZUFBZSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFFMUUsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxjQUFjO1FBRXpELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO1VBQ3RELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsYUFBYSxFQUFFO1FBQ3pCO01BQ0Y7RUFDRjtFQUNBLFdBQVc7SUFDVCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsaUNBQWlDLENBQUM7UUFDL0MsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3RFLFFBQVE7VUFDUixVQUFVLGVBQWUsUUFBUTtVQUNqQyxTQUFTO1lBQUUsTUFBTTtVQUFZO1FBQy9CO1FBRUEsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBQ2hHLElBQUksWUFBOEI7UUFDbEMsTUFBTSxpQkFBeUIsRUFBRTtRQUVqQyxNQUFPLEtBQU07VUFDWCxJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtVQUU5QixJQUFJLENBQUMsUUFBUTtZQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsNENBQTRDLENBQUM7WUFDMUQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FBRSxVQUFVLGVBQWUsUUFBUTtZQUFDO1lBRTlGLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUUxQixJQUFJLENBQUMsUUFBUTtjQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsdUNBQXVDLENBQUM7Y0FDckQ7WUFDRjtVQUNGO1VBRUEsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQztVQUVoRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixFQUFFLE1BQU07VUFFaEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDdkQsUUFBUSxLQUFLLEVBQUU7WUFDZixVQUFVLGVBQWUsUUFBUTtZQUNqQyxnQkFBZ0I7VUFDbEI7VUFFQSxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEtBQUssT0FBTyxLQUFLLE9BQU8sTUFBTSxFQUFFO1lBQ25FLFlBQVk7WUFDWjtVQUNGLE9BQ0s7WUFDSCxlQUFlLElBQUksQ0FBQztVQUN0QjtRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxlQUFlLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFFeEUsS0FBSyxNQUFNLFFBQVEsZUFBZ0I7VUFDakMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7WUFDeEQsUUFBUSxLQUFLLEVBQUU7WUFDZixVQUFVLGVBQWUsUUFBUTtVQUNuQztRQUNGO1FBRUEsSUFBSSxXQUFXO1VBQ2IsUUFBUSxHQUFHLENBQUMsQ0FBQywwQkFBMEIsRUFBRSxXQUFXO1VBRXBELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO1lBQ3RELFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVEsVUFBVSxFQUFFO1VBQ3RCO1VBRUEsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLFdBQVc7WUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFDO1VBRTlHLE1BQU0sUUFBUSxlQUFlLFNBQVMsQ0FBQztZQUNyQztjQUFFLFVBQVU7Z0JBQUM7Z0JBQWU7ZUFBZ0I7WUFBQztZQUM3QztjQUFFLFVBQVU7WUFBVTtZQUN0QjtjQUNFLE1BQU07Y0FDTixVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRO2dCQUFFLFVBQVUsS0FBSyxRQUFRLEdBQUc7Z0JBQUcsUUFBUSxLQUFLLE1BQU07Y0FBQztZQUM3RDtXQUNEO1VBRUQsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDL0UsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUNuQixVQUFVLE1BQU0sR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7WUFDbkMsT0FBTztVQUNUO1VBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7WUFDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQyxpQ0FBaUMsQ0FBQztZQUNoRDtVQUNGO1VBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtVQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLGNBQWM7VUFFM0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxhQUFhLEVBQUU7WUFDdkIsSUFBSTtjQUFFLFVBQVU7WUFBZ0I7VUFDbEM7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxTQUFTO0lBQ1AsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1FBQy9DLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFdEUsTUFBTSxRQUFRLGVBQWUsU0FBUyxDQUFDO1VBQUUsVUFBVTtRQUFRLEdBQ3hELE1BQU0sQ0FBQyxDQUFBO1VBQ04sTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07WUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFDO1VBQ3pHLE9BQU8sS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsS0FBSyxNQUFNO1FBQ2pFO1FBRUYsSUFBSSxNQUFNLE1BQU0sRUFBRTtVQUNoQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHNEQUFzRCxDQUFDO1VBRXBFLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUN0RSxRQUFRO1lBQ1IsVUFBVSxlQUFlLFFBQVE7WUFDakMsU0FBUztjQUNQLE1BQU07Y0FDTixTQUFTLE1BQU0sR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7Y0FDbEMsYUFBYTtZQUNmO1VBQ0Y7VUFFQSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO1lBQ3pCLFFBQVEsSUFBSSxDQUFDLENBQUMsK0JBQStCLENBQUM7WUFDOUM7VUFDRjtVQUVBLE1BQU0sZUFBZSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtVQUV4RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLGNBQWM7VUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxhQUFhLEVBQUU7WUFDdkIsSUFBSTtjQUFFLFVBQVU7WUFBZ0I7VUFDbEM7UUFDRixPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQywrQ0FBK0MsQ0FBQztVQUU3RCxNQUFNLGtCQUFrQixtQkFBbUI7WUFDekMsT0FBTyxlQUFlLEtBQUs7WUFDM0IsV0FBVztZQUNYLGtCQUFrQixlQUFlLFFBQVE7VUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7VUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7WUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7WUFFekUsSUFBSSxLQUFLLE1BQU0sR0FBRyxHQUFHO2NBQ25CLFFBQVEsR0FBRyxDQUFDLENBQUMsc0JBQXNCLEVBQUUsZUFBZSx5Q0FBeUMsQ0FBQztjQUM5RixNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtnQkFBRSxVQUFVO2NBQWU7WUFDdkY7WUFFQSxNQUFNLGNBQWMsS0FBSyxHQUFHLENBQUMsR0FBRyxLQUFLLE1BQU07WUFFM0MsUUFBUSxHQUFHLENBQUMsQ0FBQyx5QkFBeUIsRUFBRSxZQUFZLG1CQUFtQixFQUFFLGVBQWUsS0FBSyxDQUFDO1lBRTlGLE1BQU0sZUFBdUIsRUFBRTtZQUMvQixNQUFNLGlCQUF5QixFQUFFO1lBRWpDLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxhQUFhLElBQUs7Y0FDcEMsTUFBTSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRTtjQUVwQyxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDO2NBQ2hELE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2dCQUFFLFVBQVU7Y0FBZTtjQUVoRyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLEtBQUssTUFBTSxFQUFFO2dCQUM1RCxhQUFhLElBQUksQ0FBQztjQUNwQixPQUNLO2dCQUNILGVBQWUsSUFBSSxDQUFDO2NBQ3RCO2NBRUEsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Z0JBQ3ZEO2dCQUNBLFVBQVU7Z0JBQ1YsZ0JBQWdCO2NBQ2xCO1lBQ0Y7WUFFQSxJQUFJLGNBQWdDO1lBQ3BDLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRztjQUMzQixNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Z0JBQ3RFLFFBQVE7Z0JBQ1IsVUFBVTtnQkFDVixTQUFTO2tCQUNQLE1BQU07a0JBQ04sU0FBUyxhQUFhLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2tCQUN6QyxhQUFhO2dCQUNmO2NBQ0Y7Y0FFQSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUN6QixRQUFRLElBQUksQ0FBQyxDQUFDLCtCQUErQixDQUFDO2NBQ2hELE9BQ0s7Z0JBQ0gsY0FBYyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtjQUNuRTtZQUNGLE9BQ0ssSUFBSSxhQUFhLE1BQU0sS0FBSyxHQUFHO2NBQ2xDLGNBQWMsWUFBWSxDQUFDLEVBQUU7WUFDL0I7WUFFQSxJQUFJLGFBQWE7Y0FDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGFBQWE7Y0FFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Z0JBQ3RELFVBQVU7Z0JBQ1YsUUFBUSxZQUFZLEVBQUU7Y0FDeEI7WUFDRjtZQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMEJBQTBCLEVBQUUsZUFBZSxNQUFNLENBQUMsTUFBTSxDQUFDO1lBRXRFLEtBQUssTUFBTSxRQUFRLGVBQWUsTUFBTSxDQUFDLGNBQWU7Y0FDdEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQ3hELFFBQVEsS0FBSyxFQUFFO2dCQUNmLFVBQVUsZUFBZSxRQUFRO2NBQ25DO1lBQ0Y7VUFDRjtRQUNGO01BQ0Y7RUFDRjtFQUNBLFFBQVE7SUFDTixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLENBQUM7UUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBRWhHLE1BQU0saUJBQXlCLEVBQUU7UUFFakMsTUFBTyxLQUFLLE1BQU0sR0FBRyxFQUFHO1VBQ3RCLE1BQU0sU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1VBQ2hDLE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUM7VUFFaEQsUUFBUSxHQUFHLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxNQUFNO1VBRTdDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQ3ZELFFBQVEsS0FBSyxFQUFFO1lBQ2YsVUFBVSxlQUFlLFFBQVE7WUFDakMsZ0JBQWdCO1VBQ2xCO1VBRUEsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07WUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFDO1VBQ3pHLElBQUksS0FBSyxRQUFRLElBQUksR0FBRztZQUN0QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGNBQWMsRUFBRSxLQUFLLDJDQUEyQyxDQUFDO1lBRTlFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2NBQ3JELFFBQVEsS0FBSyxFQUFFO2NBQ2YsWUFBWSxlQUFlLFFBQVE7Y0FDbkMsSUFBSTtnQkFBRSxVQUFVO2NBQWE7WUFDL0I7WUFFQTtVQUNGLE9BQ0s7WUFDSCxlQUFlLElBQUksQ0FBQztVQUN0QjtRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyx5QkFBeUIsRUFBRSxlQUFlLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFFckUsS0FBSyxNQUFNLFFBQVEsZUFBZ0I7VUFDakMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7WUFDeEQsUUFBUSxLQUFLLEVBQUU7WUFDZixVQUFVLGVBQWUsUUFBUTtVQUNuQztRQUNGO01BQ0Y7RUFDRjtFQUNBLGFBQWE7SUFDWCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLENBQUM7UUFDbkQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxJQUFJLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDcEUsUUFBUTtVQUNSLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLGVBQWU7WUFDYjtjQUFFLE9BQU87Y0FBVSxRQUFRO1lBQUU7WUFDN0I7Y0FBRSxPQUFPO2NBQVcsUUFBUTtZQUFFO1dBQy9CO1FBQ0g7UUFFQSxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7VUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyw0Q0FBNEMsQ0FBQztVQUUxRCxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7VUFFaEcsS0FBSyxNQUFNLFVBQVU7ZUFBSTtXQUFLLENBQUU7WUFDOUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7Y0FDckQ7Y0FDQSxZQUFZLGVBQWUsUUFBUTtjQUNuQyxJQUFJO2dCQUFFLFVBQVU7Y0FBZ0I7WUFDbEM7VUFDRjtRQUNGO1FBRUEsTUFBTSxVQUFVLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGlCQUFpQixlQUFlLFFBQVE7UUFFdEcsSUFBSSxRQUFRLE1BQU0sRUFBRTtVQUNsQixTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQ2hFLFFBQVE7WUFDUixVQUFVLGVBQWUsUUFBUTtZQUNqQyxTQUFTO2NBQ1AsTUFBTTtjQUNOLFNBQVM7Y0FDVCxhQUFhO1lBQ2Y7VUFDRjtVQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyxtQ0FBbUMsQ0FBQztZQUNsRDtVQUNGO1VBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLE1BQU0sQ0FBQyxFQUFFO1VBRXhFLFFBQVEsR0FBRyxDQUFDLENBQUMsMkJBQTJCLEVBQUUsYUFBYSxlQUFlLENBQUM7VUFFdkUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsUUFBUSxhQUFhLEVBQUU7WUFDdkIsWUFBWSxlQUFlLFFBQVE7WUFDbkMsSUFBSTtjQUFFLFVBQVU7WUFBYTtVQUMvQjtRQUNGLE9BQ0s7VUFDSCxRQUFRLEdBQUcsQ0FBQyxDQUFDLHNDQUFzQyxDQUFDO1FBQ3REO01BQ0Y7RUFDRjtFQUNBLGNBQWM7SUFDWixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLE1BQU07UUFBQztRQUN6RixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUVwRSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsTUFBTSxpQkFBeUIsRUFBRTtVQUNqQyxNQUFNLGVBQXVCLEVBQUU7VUFFL0IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztZQUMxQixJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUU5QixJQUFJLENBQUMsUUFBUTtjQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsK0NBQStDLENBQUM7Y0FDN0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQUUsVUFBVTtjQUFlO2NBRXJGLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtjQUUxQixJQUFJLENBQUMsUUFBUTtnQkFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO2dCQUM1RDtjQUNGO1lBQ0Y7WUFFQSxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDO1lBRWhELFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsTUFBTTtZQUVuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RCxRQUFRO2NBQ1IsVUFBVTtjQUNWLGdCQUFnQjtZQUNsQjtZQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2NBQUUsVUFBVTtZQUFlO1lBRWhHLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHO2NBQzVDLGFBQWEsSUFBSSxDQUFDO1lBQ3BCLE9BQ0s7Y0FDSCxlQUFlLElBQUksQ0FBQztZQUN0QjtVQUNGO1VBRUEsSUFBSSxjQUFnQztVQUNwQyxJQUFJLGFBQWEsTUFBTSxLQUFLLEdBQUc7WUFDN0IsY0FBYyxZQUFZLENBQUMsRUFBRTtVQUMvQixPQUNLLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRztZQUNoQyxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdEUsUUFBUTtjQUNSLFVBQVU7Y0FDVixTQUFTO2dCQUNQLE1BQU07Z0JBQ04sU0FBUyxhQUFhLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2dCQUN6QyxhQUFhO2NBQ2Y7WUFDRjtZQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Y0FDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztZQUNyRCxPQUNLO2NBQ0gsY0FBYyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtjQUNqRSxlQUFlLE1BQU0sQ0FBQyxhQUFhLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFLEtBQUssWUFBYSxFQUFFO1lBQy9FO1VBQ0Y7VUFFQSxJQUFJLGFBQWE7WUFDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGFBQWE7WUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVTtjQUNWLFFBQVEsWUFBWSxFQUFFO1lBQ3hCO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUUzRSxLQUFLLE1BQU0sUUFBUSxlQUFnQjtZQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUN4RCxRQUFRLEtBQUssRUFBRTtjQUNmLFVBQVU7WUFDWjtVQUNGO1VBRUEsSUFBSSxlQUFlLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ3RELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1lBRXJFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsTUFBTTtZQUVsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtZQUNqQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFFLE9BQU87UUFBRTtRQUVyRyxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsTUFBTSxpQkFBeUIsRUFBRTtVQUNqQyxNQUFNLGVBQXVCLEVBQUU7VUFFL0IsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztZQUMxQixJQUFJLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUU5QixJQUFJLENBQUMsUUFBUTtjQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsK0NBQStDLENBQUM7Y0FDN0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQUUsVUFBVTtjQUFlO2NBRXJGLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtjQUUxQixJQUFJLENBQUMsUUFBUTtnQkFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO2dCQUM1RDtjQUNGO1lBQ0Y7WUFFQSxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDO1lBRWhELFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsTUFBTTtZQUVuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RCxRQUFRO2NBQ1IsVUFBVTtjQUNWLGdCQUFnQjtZQUNsQjtZQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNO2NBQUUsVUFBVTtZQUFlO1lBRWhHLElBQUksS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLFFBQVEsSUFBSSxHQUFHO2NBQzVDLGFBQWEsSUFBSSxDQUFDO1lBQ3BCLE9BQ0s7Y0FDSCxlQUFlLElBQUksQ0FBQztZQUN0QjtVQUNGO1VBRUEsSUFBSSxjQUFnQztVQUNwQyxJQUFJLGFBQWEsTUFBTSxLQUFLLEdBQUc7WUFDN0IsY0FBYyxZQUFZLENBQUMsRUFBRTtVQUMvQixPQUNLLElBQUksYUFBYSxNQUFNLEdBQUcsR0FBRztZQUNoQyxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdEUsUUFBUTtjQUNSLFVBQVU7Y0FDVixTQUFTO2dCQUNQLE1BQU07Z0JBQ04sU0FBUyxhQUFhLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2dCQUN6QyxhQUFhO2NBQ2Y7WUFDRjtZQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Y0FDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztZQUNyRCxPQUNLO2NBQ0gsY0FBYyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxNQUFNLENBQUMsRUFBRTtjQUNqRSxlQUFlLE1BQU0sQ0FBQyxhQUFhLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFLEtBQUssWUFBYSxFQUFFO1lBQy9FO1VBQ0Y7VUFFQSxJQUFJLGFBQWE7WUFDZixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGFBQWE7WUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVTtjQUNWLFFBQVEsWUFBWSxFQUFFO1lBQ3hCO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztVQUUzRSxLQUFLLE1BQU0sUUFBUSxlQUFnQjtZQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUN4RCxRQUFRLEtBQUssRUFBRTtjQUNmLFVBQVU7WUFDWjtVQUNGO1VBRUEsSUFBSSxlQUFlLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ3RELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1lBRXJFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsTUFBTTtZQUVsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtZQUNqQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFdBQVc7VUFBRSxPQUFPO1FBQUU7UUFFakUsTUFBTSxrQkFBa0IsbUJBQW1CO1VBQ3pDLE9BQU8sZUFBZSxLQUFLO1VBQzNCLFdBQVc7VUFDWCxrQkFBa0IsZUFBZSxRQUFRO1FBQzNDLEdBQUcsTUFBTSxDQUFDLENBQUEsV0FBWSxlQUFlLGVBQWUsRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXO1FBRTdFLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjO1VBRXpFLE1BQU0saUJBQXlCLEVBQUU7VUFDakMsTUFBTSxlQUF1QixFQUFFO1VBRS9CLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7WUFDMUIsSUFBSSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFFOUIsSUFBSSxDQUFDLFFBQVE7Y0FDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtDQUErQyxDQUFDO2NBQzdELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2dCQUFFLFVBQVU7Y0FBZTtjQUVyRixTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7Y0FFMUIsSUFBSSxDQUFDLFFBQVE7Z0JBQ1gsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztnQkFDNUQ7Y0FDRjtZQUNGO1lBRUEsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQztZQUVoRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLE1BQU07WUFFbkQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdkQsUUFBUTtjQUNSLFVBQVU7Y0FDVixnQkFBZ0I7WUFDbEI7WUFFQSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBZSxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsTUFBTTtjQUFFLFVBQVU7WUFBZTtZQUVoRyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRztjQUM1QyxhQUFhLElBQUksQ0FBQztZQUNwQixPQUNLO2NBQ0gsZUFBZSxJQUFJLENBQUM7WUFDdEI7VUFDRjtVQUVBLElBQUksY0FBZ0M7VUFDcEMsSUFBSSxhQUFhLE1BQU0sS0FBSyxHQUFHO1lBQzdCLGNBQWMsWUFBWSxDQUFDLEVBQUU7VUFDL0IsT0FDSyxJQUFJLGFBQWEsTUFBTSxHQUFHLEdBQUc7WUFDaEMsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3RFLFFBQVE7Y0FDUixVQUFVO2NBQ1YsU0FBUztnQkFDUCxNQUFNO2dCQUNOLFNBQVMsYUFBYSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtnQkFDekMsYUFBYTtjQUNmO1lBQ0Y7WUFFQSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO2NBQ3pCLFFBQVEsSUFBSSxDQUFDLENBQUMsb0NBQW9DLENBQUM7WUFDckQsT0FDSztjQUNILGNBQWMsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sTUFBTSxDQUFDLEVBQUU7Y0FDakUsZUFBZSxNQUFNLENBQUMsYUFBYSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRSxLQUFLLFlBQWEsRUFBRTtZQUMvRTtVQUNGO1VBRUEsSUFBSSxhQUFhO1lBQ2YsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxhQUFhO1lBRXpELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO2NBQ3RELFVBQVU7Y0FDVixRQUFRLFlBQVksRUFBRTtZQUN4QjtVQUNGO1VBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxlQUFlLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFFM0UsS0FBSyxNQUFNLFFBQVEsZUFBZ0I7WUFDakMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsUUFBUSxLQUFLLEVBQUU7Y0FDZixVQUFVO1lBQ1o7VUFDRjtVQUVBLElBQUksZUFBZSxZQUFZLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVztZQUN0RCxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtZQUVyRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLE1BQU07WUFFbEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7Y0FDdEQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxLQUFLLEVBQUU7WUFDakI7VUFDRjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGVBQWU7SUFDYixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLGVBQWUsS0FBSztVQUMzQixXQUFXO1VBQ1gsa0JBQWtCLGVBQWUsUUFBUTtRQUMzQyxHQUFHLE1BQU0sQ0FBQyxDQUFBLFdBQVksZUFBZSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVztRQUU3RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYztVQUV6RSxJQUFJLGVBQWU7VUFFbkIsSUFBSSxLQUFLLE1BQU0sR0FBRyxHQUFHO1lBQ25CLGVBQWUsS0FBSyxNQUFNLEdBQUc7VUFDL0I7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLGVBQWUsWUFBWSxFQUFFLGFBQWEsTUFBTSxDQUFDO1VBRTVGLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQy9FLFVBQVU7WUFDVixRQUFRLENBQUMsWUFBWSxDQUFDO1lBQ3RCLFVBQVU7WUFDVixPQUFPO1VBQ1Q7VUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLHNDQUFzQyxDQUFDO1lBQ3JEO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLGVBQWUsWUFBWSxFQUFFLGdCQUFnQixNQUFNLENBQUMsTUFBTSxDQUFDO1VBRXRHLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1lBQzVDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2NBQUUsVUFBVTtjQUFnQixRQUFRO1lBQWU7VUFDL0c7UUFDRjtRQUVBLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjO1VBRXpFLE1BQU0saUJBQXlCLEVBQUU7VUFDakMsTUFBTSxlQUF1QixFQUFFO1VBRS9CLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7WUFDMUIsSUFBSSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFFOUIsSUFBSSxDQUFDLFFBQVE7Y0FDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtDQUErQyxDQUFDO2NBQzdELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2dCQUFFLFVBQVU7Y0FBZTtjQUVyRixTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7Y0FFMUIsSUFBSSxDQUFDLFFBQVE7Z0JBQ1gsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztnQkFDNUQ7Y0FDRjtZQUNGO1lBRUEsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQztZQUVoRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLE1BQU07WUFFbkQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDdkQsUUFBUTtjQUNSLFVBQVU7Y0FDVixnQkFBZ0I7WUFDbEI7WUFFQSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBZSxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsTUFBTTtjQUFFLFVBQVU7WUFBZTtZQUVoRyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxRQUFRLElBQUksR0FBRztjQUM1QyxhQUFhLElBQUksQ0FBQztZQUNwQixPQUNLO2NBQ0gsZUFBZSxJQUFJLENBQUM7WUFDdEI7VUFDRjtVQUVBLElBQUksY0FBZ0M7VUFDcEMsSUFBSSxhQUFhLE1BQU0sS0FBSyxHQUFHO1lBQzdCLGNBQWMsWUFBWSxDQUFDLEVBQUU7VUFDL0IsT0FDSyxJQUFJLGFBQWEsTUFBTSxHQUFHLEdBQUc7WUFDaEMsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3RFLFFBQVE7Y0FDUixVQUFVO2NBQ1YsU0FBUztnQkFDUCxNQUFNO2dCQUNOLFNBQVMsYUFBYSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtnQkFDekMsYUFBYTtjQUNmO1lBQ0Y7WUFFQSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO2NBQ3pCLFFBQVEsSUFBSSxDQUFDLENBQUMsb0NBQW9DLENBQUM7WUFDckQsT0FDSztjQUNILGNBQWMsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sTUFBTSxDQUFDLEVBQUU7Y0FDakUsZUFBZSxNQUFNLENBQUMsYUFBYSxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRSxLQUFLLFlBQWEsRUFBRTtZQUMvRTtVQUNGO1VBRUEsSUFBSSxhQUFhO1lBQ2YsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxhQUFhO1lBRXpELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO2NBQ3RELFVBQVU7Y0FDVixRQUFRLFlBQVksRUFBRTtZQUN4QjtVQUNGO1VBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxlQUFlLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFFM0UsS0FBSyxNQUFNLFFBQVEsZUFBZ0I7WUFDakMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsUUFBUSxLQUFLLEVBQUU7Y0FDZixVQUFVLGVBQWUsUUFBUTtZQUNuQztVQUNGO1VBRUEsSUFBSSxlQUFlLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ3RELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1lBRXJFLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsTUFBTTtZQUVsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLEtBQUssRUFBRTtZQUNqQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsV0FBVyxPQUFPLE1BQU07VUFDdEIsTUFBTSxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07VUFDdEQsSUFBSSxLQUFLLEtBQUssS0FBSyxVQUFVLFFBQVEsRUFBRTtZQUNyQztVQUNGO1VBRUEsTUFBTSxZQUFZLEtBQUssU0FBUyxDQUFDO1lBQy9CO2NBQUUsVUFBVTtZQUFjO1lBQzFCO2NBQUUsVUFBVTtZQUFPO1dBQ3BCO1VBRUQsSUFBSSxDQUFDLFVBQVUsTUFBTSxFQUFFO1lBQ3JCLFFBQVEsR0FBRyxDQUFDLENBQUMsNkRBQTZELENBQUM7WUFDM0U7VUFDRjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLEVBQUUsVUFBVSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1VBRTdFLE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxZQUFZO1lBQzNDLFVBQVUsVUFBVSxRQUFRO1lBQzVCLFFBQVEsVUFBVSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDakMsSUFBSTtjQUFFLFVBQVU7WUFBZ0I7VUFDbEM7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLGVBQWUsS0FBSztVQUMzQixXQUFXO1VBQ1gsa0JBQWtCLGVBQWUsUUFBUTtRQUMzQyxHQUFHLE1BQU0sQ0FBQyxDQUFBLFdBQVksZUFBZSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVztRQUU3RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYztVQUV6RSxNQUFNLGlCQUF5QixFQUFFO1VBQ2pDLE1BQU0sZUFBdUIsRUFBRTtVQUUvQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxJQUFLO1lBQzFCLElBQUksU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBRTlCLElBQUksQ0FBQyxRQUFRO2NBQ1gsUUFBUSxHQUFHLENBQUMsQ0FBQywrQ0FBK0MsQ0FBQztjQUM3RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtnQkFBRSxVQUFVO2NBQWU7Y0FFckYsU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO2NBRTFCLElBQUksQ0FBQyxRQUFRO2dCQUNYLFFBQVEsR0FBRyxDQUFDLENBQUMsOENBQThDLENBQUM7Z0JBQzVEO2NBQ0Y7WUFDRjtZQUVBLE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUM7WUFFaEQsUUFBUSxHQUFHLENBQUMsQ0FBQyw4QkFBOEIsRUFBRSxNQUFNO1lBRW5ELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3ZELFFBQVE7Y0FDUixVQUFVO2NBQ1YsZ0JBQWdCO1lBQ2xCO1lBRUEsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07Y0FBRSxVQUFVO1lBQWU7WUFFaEcsSUFBSSxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssUUFBUSxJQUFJLEdBQUc7Y0FDNUMsYUFBYSxJQUFJLENBQUM7WUFDcEIsT0FDSztjQUNILGVBQWUsSUFBSSxDQUFDO1lBQ3RCO1VBQ0Y7VUFFQSxJQUFJLGNBQWdDO1VBQ3BDLElBQUksYUFBYSxNQUFNLEtBQUssR0FBRztZQUM3QixjQUFjLFlBQVksQ0FBQyxFQUFFO1VBQy9CLE9BQ0ssSUFBSSxhQUFhLE1BQU0sR0FBRyxHQUFHO1lBQ2hDLE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN0RSxRQUFRO2NBQ1IsVUFBVTtjQUNWLFNBQVM7Z0JBQ1AsTUFBTTtnQkFDTixTQUFTLGFBQWEsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7Z0JBQ3pDLGFBQWE7Y0FDZjtZQUNGO1lBRUEsSUFBSSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtjQUN6QixRQUFRLElBQUksQ0FBQyxDQUFDLG9DQUFvQyxDQUFDO1lBQ3JELE9BQ0s7Y0FDSCxjQUFjLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLE1BQU0sQ0FBQyxFQUFFO2NBQ2pFLGVBQWUsTUFBTSxDQUFDLGFBQWEsTUFBTSxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUUsS0FBSyxZQUFhLEVBQUU7WUFDL0U7VUFDRjtVQUVBLElBQUksYUFBYTtZQUNmLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsYUFBYTtZQUV6RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtjQUN0RCxVQUFVO2NBQ1YsUUFBUSxZQUFZLEVBQUU7WUFDeEI7VUFDRjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLEVBQUUsZUFBZSxNQUFNLENBQUMsTUFBTSxDQUFDO1VBRTNFLEtBQUssTUFBTSxRQUFRLGVBQWdCO1lBQ2pDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2NBQ3hELFFBQVEsS0FBSyxFQUFFO2NBQ2YsVUFBVTtZQUNaO1VBQ0Y7VUFFQSxJQUFJLGVBQWUsWUFBWSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVc7WUFDdEQsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLE1BQU07WUFFckUsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxNQUFNO1lBRWxELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO2NBQ3RELFVBQVUsZUFBZSxRQUFRO2NBQ2pDLFFBQVEsS0FBSyxFQUFFO1lBQ2pCO1VBQ0Y7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxVQUFVO0lBQ1IsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixXQUFXLE9BQU8sTUFBTTtVQUN0QixNQUFNLE9BQU8sS0FBSyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBTTtVQUN0RCxJQUFJLFVBQVUsUUFBUSxJQUFJLEtBQUssS0FBSyxFQUFFO1lBQ3BDO1VBQ0Y7VUFFQSxNQUFNLGNBQWMsS0FBSyxTQUFTLENBQUM7WUFDakM7Y0FBRSxVQUFVO1lBQWdCO1lBQzVCO2NBQUUsVUFBVTtZQUFTO1dBQ3RCO1VBRUQsSUFBSSxDQUFDLFlBQVksTUFBTSxFQUFFO1lBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsbURBQW1ELENBQUM7WUFDakU7VUFDRjtVQUVBLE1BQU0sa0JBQWtCLE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxjQUFjO1lBQ3JFLFVBQVUsVUFBVSxRQUFRO1lBQzVCLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDbkIsVUFBVSxZQUFZLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1lBQ3pDLE9BQU87VUFDVDtVQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1lBQzNCLFFBQVEsSUFBSSxDQUFDLENBQUMsMENBQTBDLENBQUM7WUFDekQ7VUFDRjtVQUVBLE1BQU0sZUFBZSxLQUFLLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7VUFFaEUsUUFBUSxHQUFHLENBQUMsQ0FBQyxrQ0FBa0MsRUFBRSxjQUFjO1VBRS9ELE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxZQUFZO1lBQzNDLFVBQVUsVUFBVSxRQUFRO1lBQzVCLFFBQVEsYUFBYSxFQUFFO1lBQ3ZCLElBQUk7Y0FBRSxVQUFVO1lBQWdCO1VBQ2xDO1FBQ0Y7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGtDQUFrQyxDQUFDO1FBQ2hELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFdEUsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3RFLFFBQVE7VUFDUixVQUFVLGVBQWUsUUFBUTtVQUNqQyxlQUFlO1lBQ2I7Y0FBRSxPQUFPO2NBQWMsUUFBUTtZQUFFO1lBQ2pDO2NBQUUsT0FBTztjQUFXLFFBQVE7WUFBRTtZQUM5QjtjQUFFLE9BQU87Y0FBaUIsUUFBUTtZQUFFO1dBQ3JDO1FBQ0g7UUFFQSxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7VUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsQ0FBQztVQUMvQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUFFLE9BQU87VUFBRTtRQUN0RSxPQUNLLElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztVQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixDQUFDO1VBQzVDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxXQUFXO1lBQUUsT0FBTztVQUFFO1FBQ25FLE9BQ0s7VUFDSCxRQUFRLEdBQUcsQ0FBQyxDQUFDLGdDQUFnQyxDQUFDO1VBQzlDLE1BQU0sY0FBYyxlQUFlLFNBQVMsQ0FBQztZQUMzQztjQUFFLFVBQVU7WUFBYztZQUMxQjtjQUFFLFVBQVU7WUFBUztXQUN0QjtVQUVELElBQUksQ0FBQyxZQUFZLE1BQU0sRUFBRTtZQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1lBQ3ZEO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLFlBQVksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtVQUVqRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLFlBQVksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ25DLElBQUk7Y0FBRSxVQUFVO1lBQWdCO1VBQ2xDO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsYUFBYTtJQUNYLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztRQUM5QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsV0FBVztVQUFFLE9BQU87UUFBRTtRQUVqRSxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7UUFFaEcsSUFBSSxDQUFDLEtBQUssTUFBTSxFQUFFO1VBQ2hCLFFBQVEsR0FBRyxDQUFDLENBQUMsbUNBQW1DLENBQUM7VUFDakQ7UUFDRjtRQUVBLElBQUksa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQzdFLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsQ0FBQyxjQUFjLENBQUM7VUFDeEIsVUFBVTtVQUNWLE9BQU87WUFDTCxNQUFNO1lBQ04sT0FBTyxLQUFLLE1BQU07VUFDcEI7UUFDRjtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLENBQUM7VUFDbkQ7UUFDRjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFFM0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7WUFDeEQsUUFBUTtZQUNSLFVBQVUsZUFBZSxRQUFRO1VBQ25DO1FBQ0Y7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixFQUFFLGdCQUFnQixNQUFNLENBQUMsTUFBTSxDQUFDO1FBRXhFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE9BQU8sZ0JBQWdCLE1BQU07UUFDL0I7UUFFQSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDekUsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLGNBQWMsQ0FBQztVQUN4QixVQUFVO1VBQ1YsT0FBTztZQUNMLE1BQU07WUFDTixPQUFPLEtBQUssTUFBTTtVQUNwQjtVQUNBLFVBQVU7UUFDWjtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLENBQUM7VUFDbkQ7UUFDRjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMkJBQTJCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDM0UsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU8sZ0JBQWdCLE1BQU07UUFBQztNQUM3RjtFQUNGO0VBQ0EsVUFBVTtJQUNSLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxNQUFNLENBQUMsV0FBVyxDQUFDO1FBQ2hGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxvREFBb0QsQ0FBQztRQUNsRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxrQkFBa0IsbUJBQW1CO1VBQ3pDLE9BQU8sZUFBZSxLQUFLO1VBQzNCLFdBQVc7VUFDWCxrQkFBa0IsZUFBZSxRQUFRO1FBQzNDLEdBQUcsTUFBTSxDQUFDLENBQUE7VUFDUixNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYztVQUN6RSxPQUFPLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVcsY0FBYyxLQUFLLE1BQU0sR0FBRztRQUM1RjtRQUVBLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjO1VBRXpFLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQy9FLFVBQVU7WUFDVixRQUFRLENBQUMsY0FBYyxDQUFDO1lBQ3hCLFVBQVU7WUFDVixPQUFPLEtBQUssTUFBTSxHQUFHO1VBQ3ZCO1VBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7WUFDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQyw4Q0FBOEMsRUFBRSxnQkFBZ0I7WUFDOUU7VUFDRjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMkJBQTJCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxnQkFBZ0I7VUFFckcsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7WUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsUUFBUTtjQUNSLFVBQVU7WUFDWjtVQUNGO1FBQ0Y7UUFFQSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztVQUN0RCxJQUFJLENBQUMsT0FBTyxFQUFFLGVBQWUsTUFBTSxDQUFDLFdBQVcsQ0FBQztVQUNoRCxjQUFjO1VBQ2QsVUFBVSxlQUFlLFFBQVE7VUFDakMsTUFBTTtVQUNOLFlBQVk7VUFDWix3QkFBd0I7VUFDeEIsV0FBVyxDQUFBO1lBQ1QsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFDNUUsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLGVBQWUsTUFBTSxFQUFFLE9BQU87WUFDeEUsTUFBTSxPQUFPLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUNoRixJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsT0FBTztZQUMxQyxPQUFPO1VBQ1Q7VUFDQSxtQkFBbUIsT0FBTTtZQUN2QixNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtZQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDJDQUEyQyxFQUFFLFlBQVk7WUFFdEUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLGFBQWE7Y0FDckQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxXQUFXLEVBQUU7WUFDdkI7WUFFQSxNQUFNLGlCQUFpQixjQUFjLFNBQVMsQ0FBQztjQUM3QztnQkFBRSxVQUFVO2NBQWlCO2NBQzdCO2dCQUFFLFNBQVM7Y0FBWTthQUN4QjtZQUVELElBQUksQ0FBQyxlQUFlLE1BQU0sRUFBRTtjQUMxQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHVEQUF1RCxDQUFDO2NBQ3JFO1lBQ0Y7WUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxFQUFFLGVBQWUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUUvRSxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUNwRCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLGVBQWUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO2NBQ3RDLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsV0FBVztJQUNULGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxvREFBb0QsQ0FBQztRQUNsRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBRWhHLElBQUksQ0FBQyxLQUFLLE1BQU0sRUFBRTtVQUNoQixRQUFRLEdBQUcsQ0FBQyxDQUFDLDRDQUE0QyxDQUFDO1VBQzFELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO1lBQUUsVUFBVSxlQUFlLFFBQVE7VUFBQztVQUU5RixJQUFJLENBQUMsS0FBSyxNQUFNLEVBQUU7WUFDaEIsUUFBUSxHQUFHLENBQUMsQ0FBQyx1Q0FBdUMsQ0FBQztZQUNyRDtVQUNGO1FBQ0Y7UUFFQSxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFFakUsUUFBUSxHQUFHLENBQUMsQ0FBQywyQkFBMkIsRUFBRSxNQUFNO1FBRWhELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3ZELFFBQVEsS0FBSyxFQUFFO1VBQ2YsVUFBVSxlQUFlLFFBQVE7UUFDbkM7UUFFQSxJQUFJO1VBQUM7VUFBUztVQUFTO1VBQVc7U0FBVSxDQUFDLElBQUksQ0FBQyxDQUFBLElBQUssS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQWlCO1VBQ3pGLFFBQVEsR0FBRyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsS0FBSyx1REFBdUQsQ0FBQztVQUM3RixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxRQUFRLEtBQUssRUFBRTtZQUNmLFlBQVksZUFBZSxRQUFRO1lBQ25DLElBQUk7Y0FBRSxVQUFVO1lBQWE7VUFDL0I7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxzQkFBc0I7SUFDcEIsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBQ2hHLE1BQU0saUJBQXlCLEVBQUU7UUFDakMsTUFBTSxjQUFzQixFQUFFO1FBRTlCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7VUFDMUIsSUFBSSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFFOUIsSUFBSSxDQUFDLFFBQVE7WUFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLHVEQUF1RCxDQUFDO1lBQ3JFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2NBQUUsVUFBVSxlQUFlLFFBQVE7WUFBQztZQUU5RixTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFFMUIsSUFBSSxDQUFDLFFBQVE7Y0FDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLGtEQUFrRCxDQUFDO2NBQ2hFO1lBQ0Y7VUFDRjtVQUVBLE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUM7VUFFaEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDdkQsUUFBUSxLQUFLLEVBQUU7WUFDZixVQUFVLGVBQWUsUUFBUTtZQUNqQyxnQkFBZ0I7VUFDbEI7VUFFQSxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ2hDLFlBQVksSUFBSSxDQUFDO1VBQ25CLE9BQ0s7WUFDSCxlQUFlLElBQUksQ0FBQztVQUN0QjtRQUNGO1FBRUEsSUFBSSxTQUFtQixFQUFFO1FBQ3pCLElBQUksWUFBWSxNQUFNLEdBQUcsR0FBRztVQUMxQixNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDdEUsUUFBUTtZQUNSLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFNBQVM7Y0FDUCxNQUFNO2NBQ04sU0FBUyxZQUFZLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1lBQzFDO1lBQ0EsZUFBZTtjQUFDO2dCQUFFLE9BQU87Z0JBQVEsUUFBUTtjQUFFO2FBQUU7VUFDL0M7VUFFQSxTQUFTO2VBQUksT0FBTyxNQUFNLElBQUksRUFBRTtXQUFDO1FBQ25DLE9BQ0s7VUFDSCxTQUFTO2VBQUksWUFBWSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtXQUFFO1FBQ2hEO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQywwQ0FBMEMsRUFBRSxlQUFlLFFBQVEsQ0FBQztRQUVqRixLQUFLLE1BQU0sVUFBVSxPQUFRO1VBQzNCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFFBQVE7WUFDUixZQUFZLGVBQWUsUUFBUTtZQUNuQyxJQUFJO2NBQUUsVUFBVTtZQUFhO1VBQy9CO1FBQ0Y7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHVDQUF1QyxFQUFFLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUVuRixLQUFLLE1BQU0sUUFBUSxlQUFnQjtVQUNqQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUN4RCxRQUFRLEtBQUssRUFBRTtZQUNmLFVBQVUsZUFBZSxRQUFRO1VBQ25DO1FBQ0Y7TUFDRjtFQUNGO0VBQ0Esa0JBQWtCO0lBQ2hCLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxzQ0FBc0MsQ0FBQztRQUNwRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7TUFDN0Y7RUFDRjtFQUNBLGlCQUFpQjtJQUNmLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQztRQUNsRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsV0FBVztVQUFFLE9BQU87UUFBRTtNQUNuRTtFQUNGO0VBQ0Esa0JBQWtCO0lBQ2hCLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyx3Q0FBd0MsQ0FBQztRQUN0RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU8sZUFBZSxRQUFRO1FBQUM7TUFDNUY7RUFDRjtFQUNBLFVBQVU7SUFDUixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUM7UUFDaEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUV6RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHVCQUF1QixFQUFFLFNBQVMsZUFBZSxDQUFDO1FBRS9ELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFFBQVEsZUFBZSxNQUFNO1VBQzdCLElBQUk7WUFBRSxVQUFVO1VBQWlCO1FBQ25DO01BQ0Y7RUFDRjtFQUNBLGFBQWE7SUFDWCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUVoRyxJQUFJLEtBQUssTUFBTSxHQUFHLEdBQUc7VUFDbkIsUUFBUSxHQUFHLENBQUMsQ0FBQywyQ0FBMkMsQ0FBQztVQUN6RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUFFLFVBQVUsZUFBZSxRQUFRO1VBQUM7UUFDaEc7UUFFQSxNQUFNLGNBQWMsS0FBSyxHQUFHLENBQUMsR0FBRyxLQUFLLE1BQU07UUFFM0MsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3RFLFFBQVE7VUFDUixVQUFVLGVBQWUsUUFBUTtVQUNqQyxlQUFlO1lBQ2I7Y0FBRSxPQUFPO2NBQVcsUUFBUTtZQUFFO1lBQzlCO2NBQUUsT0FBTztjQUFZLFFBQVE7WUFBRTtXQUNoQztVQUNELFNBQVM7WUFDUCxNQUFNO1lBQ04sU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDO1VBQ3ZCO1FBQ0Y7UUFFQSxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7VUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyw4QkFBOEIsRUFBRSxZQUFZLE1BQU0sQ0FBQztVQUNoRSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksYUFBYSxJQUFLO1lBQ3BDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2NBQ3hELFFBQVEsS0FBSyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFO2NBQzdCLFVBQVUsZUFBZSxRQUFRO1lBQ25DO1VBQ0Y7UUFDRixPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsRUFBRSxZQUFZLE1BQU0sQ0FBQztVQUVsRSxJQUFJLGNBQWMsR0FBRztZQUNuQixRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxDQUFDO1lBRWxELE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN0RSxRQUFRO2NBQ1IsVUFBVSxlQUFlLFFBQVE7Y0FDakMsU0FBUztnQkFDUCxNQUFNO2dCQUNOLFNBQVMsS0FBSyxLQUFLLENBQUMsQ0FBQztjQUN2QjtZQUNGO1lBRUEsS0FBSyxNQUFNLFVBQVUsT0FBTyxNQUFNLENBQUU7Y0FDbEMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7Z0JBQ3JELFFBQVE7Z0JBQ1IsWUFBWSxlQUFlLFFBQVE7Z0JBQ25DLElBQUk7a0JBQUUsVUFBVTtnQkFBYTtjQUMvQjtZQUNGO1VBQ0YsT0FDSztZQUNILFFBQVEsR0FBRyxDQUFDLENBQUMsd0VBQXdFLENBQUM7VUFDeEY7UUFDRjtNQUNGO0VBQ0Y7QUFDRjtBQUVBLGVBQWUsWUFBWSJ9
// denoCacheMetadata=11099131631154971147,9313019274680439061