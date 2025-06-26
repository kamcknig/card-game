import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getRemainingSupplyCount, getStartingSupplyCount } from '../../utils/get-starting-supply-count.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
const expansion = {
  'anvil': {
    registerEffects: ()=>async (effectArgs)=>{
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const selectedCardToDiscardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Discard treasure`,
          restrict: [
            {
              location: 'playerHand',
              playerId: effectArgs.playerId
            },
            {
              cardType: 'TREASURE'
            }
          ],
          count: 1,
          optional: true
        });
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
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              playerId: effectArgs.playerId,
              kind: 'upTo',
              amount: {
                treasure: 4
              }
            }
          ],
          count: 1
        });
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
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'bank': {
    registerEffects: ()=>async (effectArgs)=>{
        const playedCardIds = effectArgs.match.stats.playedCardsByTurn[effectArgs.match.turnNumber];
        const playedTreasureCards = playedCardIds.map(effectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE'));
        console.log(`[bank effect] played ${playedTreasureCards.length} treasure cards, gaining ${playedTreasureCards.length} treasure`);
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: playedTreasureCards.length
        });
      }
  },
  'bishop': {
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[bishop effect] gaining 1 treasure and 1 victory token`);
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        await effectArgs.runGameActionDelegate('gainVictoryToken', {
          playerId: effectArgs.playerId,
          count: 1
        });
        const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
        if (hand.length === 0) {
          console.log(`[bishop effect] no cards in hand`);
        } else {
          console.log(`[bishop effect] prompting player to select card to trash`);
          const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
            playerId: effectArgs.playerId,
            prompt: `Trash card`,
            restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
            count: 1
          });
          const selectedCardId = selectedCardIds[0];
          if (!selectedCardId) {
            console.warn(`[bishop effect] no card selected`);
          } else {
            const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
            console.log(`[bishop effect] selected ${selectedCard} to trash`);
            await effectArgs.runGameActionDelegate('trashCard', {
              playerId: effectArgs.playerId,
              cardId: selectedCardId
            });
            const { cost: selectedCardCost } = effectArgs.cardPriceController.applyRules(selectedCard, {
              playerId: effectArgs.playerId
            });
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
        for (const targetPlayerId of targetPlayerIds){
          const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Trash card`,
            restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
            count: 1,
            optional: true
          });
          const selectedCardId = selectedCardIds[0];
          if (!selectedCardId) {
            console.log(`[bishop effect] target player ${targetPlayerId} selected no card`);
            continue;
          }
          await effectArgs.runGameActionDelegate('trashCard', {
            playerId: targetPlayerId,
            cardId: selectedCardId
          });
        }
      }
  },
  'charlatan': {
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[charlatan effect] gaining 3 treasure and 1 action`);
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 3
        });
        const targetPlayerIds = findOrderedTargets({
          match: effectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: effectArgs.playerId
        }).filter((playerId)=>effectArgs.reactionContext?.[playerId].result !== 'immunity');
        console.log(`[charlatan effect] targets ${targetPlayerIds} gaining a curse`);
        for (const targetPlayerId of targetPlayerIds){
          const curseCards = effectArgs.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ]);
          if (!curseCards.length) {
            console.log(`[charlatan effect] no curse cards in supply`);
            break;
          }
          await effectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'city': {
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[city effect] drawing 1 card and gaining 1 action`);
        await effectArgs.runGameActionDelegate('drawCard', {
          playerId: effectArgs.playerId
        });
        await effectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const emptySupplyCount = getStartingSupplyCount(effectArgs.match) - getRemainingSupplyCount(effectArgs.findCards);
        if (emptySupplyCount > 0) {
          console.log(`[city effect] empty supply count is greater than 0; drawing 1 card`);
          await effectArgs.runGameActionDelegate('drawCard', {
            playerId: effectArgs.playerId
          });
        }
        if (emptySupplyCount > 1) {
          console.log(`[city effect] empty supply count is greater than 1; gaining 1 buy and 1 treasure`);
          await effectArgs.runGameActionDelegate('gainBuy', {
            count: 1
          });
          await effectArgs.runGameActionDelegate('gainTreasure', {
            count: 1
          });
        }
      }
  },
  'clerk': {
    registerLifeCycleMethods: ()=>({
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `clerk:${eventArgs.cardId}:startTurn`,
            listeningFor: 'startTurn',
            playerId: eventArgs.playerId,
            once: true,
            allowMultipleInstances: true,
            compulsory: false,
            condition: (conditionArgs)=>conditionArgs.trigger.args.playerId === eventArgs.playerId,
            triggeredEffectFn: async (triggerEffectArgs)=>{
              await triggerEffectArgs.runGameActionDelegate('playCard', {
                playerId: eventArgs.playerId,
                cardId: eventArgs.cardId,
                overrides: {
                  actionCost: 0
                }
              });
            }
          });
        },
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`clerk:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (effectArgs)=>{
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: effectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: effectArgs.playerId
        }).filter((playerId)=>{
          return effectArgs.reactionContext?.[playerId]?.result !== 'immunity' && effectArgs.cardSourceController.getSource('playerHand', playerId).length >= 5;
        });
        for (const targetPlayerId of targetPlayerIds){
          const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Top-deck card`,
            restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
            count: 1
          });
          if (!selectedCardIds) {
            console.log(`[clerk effect] target player ${targetPlayerId} selected no card`);
            continue;
          }
          await effectArgs.runGameActionDelegate('moveCard', {
            cardId: selectedCardIds[0],
            toPlayerId: targetPlayerId,
            to: {
              location: 'playerDeck'
            }
          });
        }
      }
  },
  'collection': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`collection:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[collection effect] gaining 2 treasure and 1 buy`);
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        await effectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        effectArgs.reactionManager.registerReactionTemplate({
          id: `collection:${effectArgs.cardId}:cardGained`,
          playerId: effectArgs.playerId,
          listeningFor: 'cardGained',
          compulsory: true,
          once: true,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            const currentTurnNumber = conditionArgs.match.turnNumber;
            if (currentTurnNumber !== conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId].turnNumber) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!card.type.includes('ACTION')) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredEffectArgs)=>{
            console.log(`[collection triggered effect] gaining 1 victory token`);
            await triggeredEffectArgs.runGameActionDelegate('gainVictoryToken', {
              playerId: effectArgs.playerId,
              count: 1
            });
          }
        });
      }
  },
  'crystal-ball': {
    registerEffects: ()=>async (effectArgs)=>{
        await effectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const deck = effectArgs.cardSourceController.getSource('playerDeck', effectArgs.playerId);
        const discard = effectArgs.cardSourceController.getSource('playerDiscard', effectArgs.playerId);
        if (deck.length + discard.length === 0) {
          console.log(`[crystal-ball effect] no cards to look at`);
          return;
        }
        if (deck.length === 0) {
          await effectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: effectArgs.playerId
          });
        }
        const cardId = deck.slice(-1)[0];
        const card = effectArgs.cardLibrary.getCard(cardId);
        const actions = [
          {
            label: 'Trash',
            action: 1
          },
          {
            label: 'Discard',
            action: 2
          }
        ];
        const isAction = card.type.includes('ACTION');
        const isTreasure = card.type.includes('TREASURE');
        if (isAction || isTreasure) {
          actions.push({
            label: 'Play',
            action: 3
          });
        }
        const result = await effectArgs.runGameActionDelegate('userPrompt', {
          prompt: `You drew ${card.cardName}`,
          playerId: effectArgs.playerId,
          actionButtons: actions
        });
        switch(result.action){
          case 1:
            await effectArgs.runGameActionDelegate('trashCard', {
              playerId: effectArgs.playerId,
              cardId
            });
            break;
          case 2:
            await effectArgs.runGameActionDelegate('discardCard', {
              cardId,
              playerId: effectArgs.playerId
            });
            break;
          case 3:
            await effectArgs.runGameActionDelegate('playCard', {
              playerId: effectArgs.playerId,
              cardId,
              overrides: {
                actionCost: 0
              }
            });
            break;
        }
      }
  },
  'expand': {
    registerEffects: ()=>async (effectArgs)=>{
        console.log('[expand effect] prompting to select card to trash');
        const selectedToTrashIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash card`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: 1
        });
        if (!selectedToTrashIds.length) {
          console.log(`[expand effect] no card selected`);
          return;
        }
        const selectedToTrashId = selectedToTrashIds[0];
        let card = effectArgs.cardLibrary.getCard(selectedToTrashId);
        console.log(`[expand effect] selected ${card} to trash`);
        const { cost: effectCost } = effectArgs.cardPriceController.applyRules(card, {
          playerId: effectArgs.playerId
        });
        const selectedToGainIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
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
              playerId: effectArgs.playerId,
              amount: {
                treasure: effectCost.treasure + 3,
                potion: effectCost.potion
              }
            }
          ],
          count: 1
        });
        if (!selectedToGainIds.length) {
          console.log(`[expand effect] no card selected`);
          return;
        }
        card = effectArgs.cardLibrary.getCard(selectedToGainIds[0]);
        console.log(`[expand effect] selected ${card} to gain`);
        await effectArgs.runGameActionDelegate('gainCard', {
          playerId: effectArgs.playerId,
          cardId: selectedToGainIds[0],
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'forge': {
    registerEffects: ()=>async (effectArgs)=>{
        const selectedCardIdsToTrash = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Trash cards`,
          restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
          count: {
            kind: 'upTo',
            count: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId).length
          },
          optional: true
        });
        let cost = {
          treasure: 0,
          potion: 0
        };
        if (!selectedCardIdsToTrash.length) {
          cost = {
            treasure: 0,
            potion: 0
          };
        } else {
          for (const cardId of selectedCardIdsToTrash){
            const card = effectArgs.cardLibrary.getCard(cardId);
            const { cost: cardCost } = effectArgs.cardPriceController.applyRules(card, {
              playerId: effectArgs.playerId
            });
            cost = {
              treasure: cost.treasure + cardCost.treasure,
              potion: cost.potion + (cardCost.potion ?? 0)
            };
            await effectArgs.runGameActionDelegate('trashCard', {
              playerId: effectArgs.playerId,
              cardId
            });
          }
        }
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Gain card`,
          restrict: [
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              kind: 'exact',
              amount: {
                treasure: cost.treasure,
                potion: 0
              },
              playerId: effectArgs.playerId
            }
          ],
          count: 1
        });
        if (selectedCardIds.length === 0) {
          console.log(`[forge effect] no card selected`);
          return;
        }
        await effectArgs.runGameActionDelegate('gainCard', {
          playerId: effectArgs.playerId,
          cardId: selectedCardIds[0],
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'grand-market': {
    registerActionConditions: ()=>({
        canBuy: ({ match, cardLibrary, playerId })=>!match.stats.playedCardsByTurn[match.turnNumber]?.find((cardId)=>{
            return cardLibrary.getCard(cardId).cardKey === 'copper' && match.stats.playedCards[cardId].playerId === playerId;
          })
      }),
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[grand market effect] drawing 1 card, gaining 1 action, gaining 1 buy, and gaining 2 treasure`);
        await effectArgs.runGameActionDelegate('drawCard', {
          playerId: effectArgs.playerId
        });
        await effectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await effectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
      }
  },
  'hoard': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`hoard:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async (effectArgs)=>{
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        effectArgs.reactionManager.registerReactionTemplate({
          id: `hoard:${effectArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          compulsory: true,
          allowMultipleInstances: true,
          once: false,
          condition: (conditionArgs)=>{
            if (conditionArgs.match.turnNumber !== conditionArgs.match.stats.cardsGained[conditionArgs.trigger.args.cardId]?.turnNumber) return false;
            if (!conditionArgs.trigger.args.bought) return false;
            if (conditionArgs.trigger.args.playerId !== effectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredEffectArgs)=>{
            const goldCardIds = effectArgs.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'gold'
              }
            ]);
            if (!goldCardIds.length) {
              console.log(`[hoard triggered effect] no gold in supply`);
              return;
            }
            await triggeredEffectArgs.runGameActionDelegate('gainCard', {
              playerId: effectArgs.playerId,
              cardId: goldCardIds.slice(-1)[0].id,
              to: {
                location: 'playerDiscard'
              }
            });
          },
          playerId: effectArgs.playerId
        });
      }
  },
  'investment': {
    registerEffects: ()=>async (effectArgs)=>{
        if (effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId).length === 0) {
          console.log(`[investment effect] no cards in hand`);
        } else {
          const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
            playerId: effectArgs.playerId,
            prompt: `Trash card`,
            restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
            count: 1
          });
          if (!selectedCardIds[0]) {
            console.warn(`[investment effect] no card selected to trash`);
          } else {
            await effectArgs.runGameActionDelegate('trashCard', {
              playerId: effectArgs.playerId,
              cardId: selectedCardIds[0]
            });
          }
        }
        const result = await effectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: effectArgs.playerId,
          actionButtons: [
            {
              label: '+1 Treasure',
              action: 1
            },
            {
              label: 'Trash and reveal',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          await effectArgs.runGameActionDelegate('gainTreasure', {
            count: 1
          });
        } else {
          const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
          let uniqueTreasureCount = [];
          const l = hand.length - 1;
          for(let i = l; i >= 0; i--){
            await effectArgs.runGameActionDelegate('revealCard', {
              cardId: hand[i],
              playerId: effectArgs.playerId
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
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[kings court effect] prompting user to select card`);
        const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
          playerId: effectArgs.playerId,
          prompt: `Choose action`,
          restrict: [
            {
              location: 'playerHand',
              playerId: effectArgs.playerId
            },
            {
              cardType: 'ACTION'
            }
          ],
          count: 1,
          optional: true
        });
        const selectedCardId = selectedCardIds[0];
        if (!selectedCardId) {
          console.log(`[kings court effect] no selected card`);
          return;
        }
        const selectedCard = effectArgs.cardLibrary.getCard(selectedCardId);
        console.log(`[kings court effect] selected ${selectedCard}`);
        for(let i = 0; i < 3; i++){
          await effectArgs.runGameActionDelegate('playCard', {
            playerId: effectArgs.playerId,
            cardId: selectedCardId,
            overrides: {
              actionCost: 0
            }
          });
        }
      }
  },
  'magnate': {
    registerEffects: ()=>async (effectArgs)=>{
        console.log(`[magnate effect] revealing hand`);
        const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
        let treasureCardCount = 0;
        for(let i = hand.length - 1; i >= 0; i--){
          const card = effectArgs.cardLibrary.getCard(hand[i]);
          treasureCardCount += card.type.includes('TREASURE') ? 1 : 0;
          await effectArgs.runGameActionDelegate('revealCard', {
            cardId: hand[i],
            playerId: effectArgs.playerId
          });
        }
        console.log(`[magnate effect] ${treasureCardCount} treasure revealed`);
        await effectArgs.runGameActionDelegate('drawCard', {
          playerId: effectArgs.playerId,
          count: treasureCardCount
        });
      }
  },
  'mint': {
    registerLifeCycleMethods: ()=>({
        onGained: async ({ runGameActionDelegate, cardLibrary, match, ...args }, { playerId })=>{
          const cardsInPlay = getCardsInPlay(args.findCards);
          const nonDurationTreasures = cardsInPlay.filter((card)=>card.type.includes('TREASURE') && !card.type.includes('DURATION') && match.stats.playedCards[card.id].playerId === playerId);
          if (nonDurationTreasures.length === 0) {
            console.log(`[mint onGained] no non-duration treasure cards in play`);
            return;
          }
          console.log(`[mint onGained] trashing ${nonDurationTreasures.length} non-duration treasure cards`);
          for(let i = nonDurationTreasures.length - 1; i >= 0; i--){
            await runGameActionDelegate('trashCard', {
              playerId,
              cardId: nonDurationTreasures[i].id
            });
          }
        }
      }),
    registerEffects: ()=>async (effectArgs)=>{
        const hand = effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId);
        const handCards = hand.map(effectArgs.cardLibrary.getCard);
        const treasuresInHand = handCards.filter((card)=>card.type.includes('TREASURE'));
        if (treasuresInHand.length === 0) {
          console.log(`[mint effect] no treasures in hand`);
          return;
        }
        const uniqueTreasureCount = new Set(treasuresInHand.map((card)=>card.cardKey)).size;
        let selectedCard = undefined;
        if (uniqueTreasureCount === 1) {
          selectedCard = treasuresInHand[0];
        } else {
          const selectedCardIds = await effectArgs.runGameActionDelegate('selectCard', {
            playerId: effectArgs.playerId,
            prompt: `Reveal card`,
            restrict: effectArgs.cardSourceController.getSource('playerHand', effectArgs.playerId),
            count: 1
          });
          if (!selectedCardIds[0]) {
            console.warn(`[mint effect] no card selected to reveal`);
            return;
          }
          selectedCard = effectArgs.cardLibrary.getCard(selectedCardIds[0]);
        }
        console.log(`[mint effect] card to reveal ${selectedCard}`);
        await effectArgs.runGameActionDelegate('revealCard', {
          cardId: selectedCard.id,
          playerId: effectArgs.playerId
        });
        const cardsInSupply = effectArgs.findCards([
          {
            location: selectedCard.isBasic ? 'basicSupply' : 'kingdomSupply'
          },
          {
            cardKeys: selectedCard.cardKey
          }
        ]);
        if (cardsInSupply.length === 0) {
          console.log(`[mint effect] no copies of ${selectedCard} in supply`);
          return;
        }
        await effectArgs.runGameActionDelegate('gainCard', {
          playerId: effectArgs.playerId,
          cardId: cardsInSupply.slice(-1)[0].id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'monument': {
    registerEffects: ()=>async ({ playerId, runGameActionDelegate })=>{
        console.log(`[monument effect] gaining 2 treasure, and 1 victory token`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        await runGameActionDelegate('gainVictoryToken', {
          playerId,
          count: 1
        });
      }
  },
  'peddler': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[peddler effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'platinum': {
    registerEffects: ()=>async (effectArgs)=>{
        await effectArgs.runGameActionDelegate('gainTreasure', {
          count: 5
        });
      }
  },
  'quarry': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[quarry effect] gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const actionCards = cardEffectArgs.findCards({
          cardType: 'ACTION'
        });
        const unsubs = [];
        for (const actionCard of actionCards){
          const rule = ()=>({
              restricted: false,
              cost: {
                treasure: -2
              }
            });
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
          condition: ()=>true,
          triggeredEffectFn: async ()=>{
            unsubs.forEach((e)=>e());
          }
        });
      }
  },
  'rabble': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[rabble effect] drawing 3 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const match = cardEffectArgs.match;
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
          if (deck.length < 3) {
            console.log(`[rabble effect] ${targetPlayerId} has less than 3 cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: targetPlayerId
            });
          }
          if (deck.length === 0) {
            console.log(`[rabble effect] ${targetPlayerId} has no cards in deck`);
            continue;
          }
          const numToReveal = Math.min(3, deck.length);
          const cardsToRearrange = [];
          for(let i = 0; i < numToReveal; i++){
            const cardId = deck.slice(-1)[0];
            const card = cardEffectArgs.cardLibrary.getCard(cardId);
            await cardEffectArgs.runGameActionDelegate('revealCard', {
              cardId,
              playerId: targetPlayerId,
              moveToSetAside: true
            });
            if (card.type.includes('ACTION') || card.type.includes('TREASURE')) {
              console.log(`[rabble effect] action or treasure revealed, discarding`);
              await cardEffectArgs.runGameActionDelegate('discardCard', {
                cardId,
                playerId: targetPlayerId
              });
            } else {
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
              to: {
                location: 'playerDeck'
              }
            });
          } else {
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: 'Rearrange',
              playerId: targetPlayerId,
              actionButtons: [
                {
                  label: 'DONE',
                  action: 1
                }
              ],
              content: {
                type: 'rearrange',
                cardIds: cardsToRearrange.map((card)=>card.id)
              }
            });
            for (const cardId of result.result){
              await cardEffectArgs.runGameActionDelegate('moveCard', {
                cardId,
                toPlayerId: targetPlayerId,
                to: {
                  location: 'playerDeck'
                }
              });
            }
          }
        }
      }
  },
  'tiara': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[tiara effect] gaining 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `tiara:${cardEffectArgs.cardId}:cardGained`,
          playerId: cardEffectArgs.playerId,
          listeningFor: 'cardGained',
          once: false,
          allowMultipleInstances: false,
          compulsory: false,
          condition: (conditionArgs)=>conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
          triggeredEffectFn: async (triggerEffectArgs)=>{
            const card = triggerEffectArgs.cardLibrary.getCard(triggerEffectArgs.trigger.args.cardId);
            console.log(`[tiara triggered effect] putting ${card} on deck`);
            await triggerEffectArgs.runGameActionDelegate('moveCard', {
              cardId: card.id,
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `tiara:${cardEffectArgs.cardId}:endTurn`,
          playerId: cardEffectArgs.playerId,
          listeningFor: 'endTurn',
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: ()=>true,
          triggeredEffectFn: async (triggerEffectArgs)=>{
            cardEffectArgs.reactionManager.unregisterTrigger(`tiara:${cardEffectArgs.cardId}:cardGained`);
            cardEffectArgs.reactionManager.unregisterTrigger(`tiara:${cardEffectArgs.cardId}:endTurn`);
          }
        });
        const handIds = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const handCards = handIds.map(cardEffectArgs.cardLibrary.getCard);
        const treasureCards = handCards.filter((card)=>card.type.includes('TREASURE'));
        if (treasureCards.length === 0) {
          console.log(`[tiara effect] no treasure cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play treasure`,
          restrict: [
            {
              location: 'playerHand',
              playerId: cardEffectArgs.playerId
            },
            {
              cardType: 'TREASURE'
            }
          ],
          count: 1,
          optional: true
        });
        if (!selectedCardIds[0]) {
          console.log(`[tiara effect] no treasure card selected`);
          return;
        }
        const selectedCardId = selectedCardIds[0];
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        console.log(`[tiara effect] playing ${selectedCard} twice`);
        for(let i = 0; i < 2; i++){
          await cardEffectArgs.runGameActionDelegate('playCard', {
            cardId: selectedCardId,
            playerId: cardEffectArgs.playerId,
            overrides: {
              actionCost: 0
            }
          });
        }
      }
  },
  'vault': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[vault effect] drawing 2 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: {
            kind: 'upTo',
            count: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length
          }
        });
        if (!selectedCardIds.length) {
          console.log(`[vault effect] no cards selected`);
          return;
        }
        console.log(`[vault effect] discarding ${selectedCardIds.length} cards`);
        for (const cardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId,
            playerId: cardEffectArgs.playerId
          });
        }
        console.log(`[vault effect] gaining ${selectedCardIds.length} treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: selectedCardIds.length
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        });
        for (const targetPlayerId of targetPlayerIds){
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
            optional: true
          });
          console.log(`[vault effect] discarding ${selectedCardIds.length} cards`);
          for (const selectedCardId of selectedCardIds){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: selectedCardId,
              playerId: targetPlayerId
            });
          }
          if (selectedCardIds.length !== 2) {
            console.log(`[vault effect] ${targetPlayerId} did not discard 2 cards, only ${selectedCardIds.length}`);
            return;
          }
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: targetPlayerId
          });
        }
      }
  },
  'war-chest': {
    registerEffects: ()=>{
      const cardsNamedByTurn = {};
      return async (cardEffectArgs)=>{
        const leftPlayer = getPlayerStartingFrom({
          startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
          match: cardEffectArgs.match,
          distance: 1
        });
        console.log(`[war-chest effect] prompting ${leftPlayer} to name a card`);
        const namedCardResult = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Name a card',
          playerId: leftPlayer.id,
          content: {
            type: 'name-card'
          }
        });
        const cardKey = namedCardResult.result;
        cardsNamedByTurn[cardEffectArgs.match.turnNumber] ??= [];
        cardsNamedByTurn[cardEffectArgs.match.turnNumber].push(cardKey);
        const cardIds = cardEffectArgs.findCards([
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
        ]).filter((card)=>!cardsNamedByTurn[cardEffectArgs.match.turnNumber].includes(card.cardKey)).map((card)=>card.id);
        if (!cardIds.length) {
          console.log(`[war-chest effect] no cards found`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain a card`,
          restrict: cardIds,
          count: 1
        });
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
          to: {
            location: 'playerDiscard'
          }
        });
      };
    }
  },
  'watchtower': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`watchtower:${eventArgs.cardId}:cardGained`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `watchtower:${eventArgs.cardId}:cardGained`,
            playerId: eventArgs.playerId,
            once: false,
            compulsory: false,
            allowMultipleInstances: false,
            listeningFor: 'cardGained',
            condition: (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
              return true;
            },
            triggeredEffectFn: async (triggerEffectArgs)=>{
              const card = triggerEffectArgs.cardLibrary.getCard(triggerEffectArgs.trigger.args.cardId);
              await triggerEffectArgs.runGameActionDelegate('revealCard', {
                cardId: eventArgs.cardId,
                playerId: eventArgs.playerId
              });
              const result = await triggerEffectArgs.runGameActionDelegate('userPrompt', {
                prompt: `Trash or top deck ${card.cardName}?`,
                playerId: eventArgs.playerId,
                actionButtons: [
                  {
                    label: 'TRASH',
                    action: 1
                  },
                  {
                    label: 'TOP-DECK',
                    action: 2
                  }
                ]
              });
              if (result.action === 1) {
                console.log(`[watchtower triggered effect] player chose to trash ${card}`);
                await triggerEffectArgs.runGameActionDelegate('trashCard', {
                  playerId: eventArgs.playerId,
                  cardId: card.id
                });
              } else {
                console.log(`[watchtower triggered effect] player chose to top-deck ${card}`);
                await triggerEffectArgs.runGameActionDelegate('moveCard', {
                  cardId: card.id,
                  toPlayerId: eventArgs.playerId,
                  to: {
                    location: 'playerDeck'
                  }
                });
              }
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
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
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[workers-village effect] drawing 1 card, gaining 2 actions, and gaining 1 buy`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
      }
  }
};
export default expansion;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9wcm9zcGVyaXR5L2NhcmQtZWZmZWN0cy1wcm9zcGVyaXR5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENhcmQsIENhcmRJZCwgQ2FyZEtleSB9IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgQ2FyZEV4cGFuc2lvbk1vZHVsZSB9IGZyb20gJy4uLy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IGZpbmRPcmRlcmVkVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2ZpbmQtb3JkZXJlZC10YXJnZXRzLnRzJztcbmltcG9ydCB7IGdldFJlbWFpbmluZ1N1cHBseUNvdW50LCBnZXRTdGFydGluZ1N1cHBseUNvdW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LXN0YXJ0aW5nLXN1cHBseS1jb3VudC50cyc7XG5pbXBvcnQgeyBnZXRDYXJkc0luUGxheSB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1jYXJkcy1pbi1wbGF5LnRzJztcbmltcG9ydCB7IENhcmRQcmljZVJ1bGUgfSBmcm9tICcuLi8uLi9jb3JlL2NhcmQtcHJpY2UtcnVsZXMtY29udHJvbGxlci50cyc7XG5pbXBvcnQgeyBnZXRQbGF5ZXJTdGFydGluZ0Zyb20gfSBmcm9tICcuLi8uLi9zaGFyZWQvZ2V0LXBsYXllci1wb3NpdGlvbi11dGlscy50cyc7XG5cbmNvbnN0IGV4cGFuc2lvbjogQ2FyZEV4cGFuc2lvbk1vZHVsZSA9IHtcbiAgJ2FudmlsJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRUb0Rpc2NhcmRJZHMgPSBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgdHJlYXN1cmVgLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQgfSxcbiAgICAgICAgICB7IGNhcmRUeXBlOiAnVFJFQVNVUkUnIH1cbiAgICAgICAgXSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZFRvRGlzY2FyZElkID0gc2VsZWN0ZWRDYXJkVG9EaXNjYXJkSWRzWzBdO1xuICAgICAgaWYgKCFzZWxlY3RlZENhcmRUb0Rpc2NhcmRJZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2FudmlsIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZFRvVHJhc2ggPSBlZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkVG9EaXNjYXJkSWQpO1xuICAgICAgY29uc29sZS5sb2coYFthbnZpbCBlZmZlY3RdIHNlbGVjdGVkICR7c2VsZWN0ZWRDYXJkVG9UcmFzaH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZFRvRGlzY2FyZElkLFxuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZFRvR2FpbklkcyA9IGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsIGtpbmQ6ICd1cFRvJywgYW1vdW50OiB7IHRyZWFzdXJlOiA0IH0gfVxuICAgICAgICBdLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRUb0dhaW5JZCA9IHNlbGVjdGVkQ2FyZFRvR2Fpbklkc1swXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRUb0dhaW5JZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2FudmlsIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZFRvR2FpbiA9IGVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRUb0dhaW5JZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYW52aWwgZWZmZWN0XSBzZWxlY3RlZCAke3NlbGVjdGVkQ2FyZFRvR2Fpbn1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRUb0dhaW5JZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdiYW5rJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHBsYXllZENhcmRJZHMgPSBlZmZlY3RBcmdzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzQnlUdXJuW2VmZmVjdEFyZ3MubWF0Y2gudHVybk51bWJlcl07XG4gICAgICBjb25zdCBwbGF5ZWRUcmVhc3VyZUNhcmRzID0gcGxheWVkQ2FyZElkcy5tYXAoZWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtiYW5rIGVmZmVjdF0gcGxheWVkICR7cGxheWVkVHJlYXN1cmVDYXJkcy5sZW5ndGh9IHRyZWFzdXJlIGNhcmRzLCBnYWluaW5nICR7cGxheWVkVHJlYXN1cmVDYXJkcy5sZW5ndGh9IHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogcGxheWVkVHJlYXN1cmVDYXJkcy5sZW5ndGggfSk7XG4gICAgfVxuICB9LFxuICAnYmlzaG9wJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYmlzaG9wIGVmZmVjdF0gZ2FpbmluZyAxIHRyZWFzdXJlIGFuZCAxIHZpY3RvcnkgdG9rZW5gKTtcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5WaWN0b3J5VG9rZW4nLCB7IHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgZWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBpZiAoaGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtiaXNob3AgZWZmZWN0XSBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtiaXNob3AgZWZmZWN0XSBwcm9tcHRpbmcgcGxheWVyIHRvIHNlbGVjdCBjYXJkIHRvIHRyYXNoYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBlZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZCA9IHNlbGVjdGVkQ2FyZElkc1swXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWQpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtiaXNob3AgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gZWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Jpc2hvcCBlZmZlY3RdIHNlbGVjdGVkICR7c2VsZWN0ZWRDYXJkfSB0byB0cmFzaGApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyBjb3N0OiBzZWxlY3RlZENhcmRDb3N0IH0gPSBlZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhzZWxlY3RlZENhcmQsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgICAgfSlcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCB0b2tlbnNUb0dhaW4gPSBNYXRoLmZsb29yKHNlbGVjdGVkQ2FyZENvc3QudHJlYXN1cmUgLyAyKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Jpc2hvcCBlZmZlY3RdIGdhaW5pbmcgJHt0b2tlbnNUb0dhaW59IHZpY3RvcnkgdG9rZW5zYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5WaWN0b3J5VG9rZW4nLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNvdW50OiB0b2tlbnNUb0dhaW5cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogZWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBlZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZCA9IHNlbGVjdGVkQ2FyZElkc1swXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Jpc2hvcCBlZmZlY3RdIHRhcmdldCBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gc2VsZWN0ZWQgbm8gY2FyZGApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdjaGFybGF0YW4nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoZWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtjaGFybGF0YW4gZWZmZWN0XSBnYWluaW5nIDMgdHJlYXN1cmUgYW5kIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMyB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBlZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXS5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2NoYXJsYXRhbiBlZmZlY3RdIHRhcmdldHMgJHt0YXJnZXRQbGF5ZXJJZHN9IGdhaW5pbmcgYSBjdXJzZWApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBjdXJzZUNhcmRzID0gZWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiAnY3Vyc2UnIH1cbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWN1cnNlQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtjaGFybGF0YW4gZWZmZWN0XSBubyBjdXJzZSBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGN1cnNlQ2FyZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdjaXR5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbY2l0eSBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkIGFuZCBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBlbXB0eVN1cHBseUNvdW50ID0gZ2V0U3RhcnRpbmdTdXBwbHlDb3VudChlZmZlY3RBcmdzLm1hdGNoKSAtIGdldFJlbWFpbmluZ1N1cHBseUNvdW50KGVmZmVjdEFyZ3MuZmluZENhcmRzKTtcbiAgICAgIFxuICAgICAgaWYgKGVtcHR5U3VwcGx5Q291bnQgPiAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbY2l0eSBlZmZlY3RdIGVtcHR5IHN1cHBseSBjb3VudCBpcyBncmVhdGVyIHRoYW4gMDsgZHJhd2luZyAxIGNhcmRgKTtcbiAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGVtcHR5U3VwcGx5Q291bnQgPiAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbY2l0eSBlZmZlY3RdIGVtcHR5IHN1cHBseSBjb3VudCBpcyBncmVhdGVyIHRoYW4gMTsgZ2FpbmluZyAxIGJ1eSBhbmQgMSB0cmVhc3VyZWApO1xuICAgICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2NsZXJrJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uRW50ZXJIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBjbGVyazoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiBjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlckVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZDogZXZlbnRBcmdzLmNhcmRJZCxcbiAgICAgICAgICAgICAgb3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICAgICAgYWN0aW9uQ29zdDogMFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgICAgb25MZWF2ZUhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGNsZXJrOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYClcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChlZmZlY3RBcmdzKSA9PiB7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiB7XG4gICAgICAgIHJldHVybiBlZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknICYmXG4gICAgICAgICAgZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCkubGVuZ3RoID49IDU7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYFRvcC1kZWNrIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpLFxuICAgICAgICAgIGNvdW50OiAxXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NsZXJrIGVmZmVjdF0gdGFyZ2V0IHBsYXllciAke3RhcmdldFBsYXllcklkfSBzZWxlY3RlZCBubyBjYXJkYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkc1swXSxcbiAgICAgICAgICB0b1BsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnY29sbGVjdGlvbic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgY29sbGVjdGlvbjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChlZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2NvbGxlY3Rpb24gZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmUgYW5kIDEgYnV5YCk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgZWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBjb2xsZWN0aW9uOiR7ZWZmZWN0QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZEdhaW5lZCcsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgIGNvbmRpdGlvbjogKGNvbmRpdGlvbkFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50VHVybk51bWJlciA9IGNvbmRpdGlvbkFyZ3MubWF0Y2gudHVybk51bWJlcjtcbiAgICAgICAgICBpZiAoY3VycmVudFR1cm5OdW1iZXIgIT09IGNvbmRpdGlvbkFyZ3MubWF0Y2guc3RhdHMuY2FyZHNHYWluZWRbY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkXS50dXJuTnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGlmICghY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHRyaWdnZXJlZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvbGxlY3Rpb24gdHJpZ2dlcmVkIGVmZmVjdF0gZ2FpbmluZyAxIHZpY3RvcnkgdG9rZW5gKTtcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblZpY3RvcnlUb2tlbicsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY291bnQ6IDFcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdjcnlzdGFsLWJhbGwnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoZWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBlZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIGNvbnN0IGRpc2NhcmQgPSBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGlzY2FyZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGggKyBkaXNjYXJkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2NyeXN0YWwtYmFsbCBlZmZlY3RdIG5vIGNhcmRzIHRvIGxvb2sgYXRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICBjb25zdCBjYXJkID0gZWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGFjdGlvbnMgPSBbXG4gICAgICAgIHsgbGFiZWw6ICdUcmFzaCcsIGFjdGlvbjogMSB9LFxuICAgICAgICB7IGxhYmVsOiAnRGlzY2FyZCcsIGFjdGlvbjogMiB9XG4gICAgICBdO1xuICAgICAgXG4gICAgICBjb25zdCBpc0FjdGlvbiA9IGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJylcbiAgICAgIGNvbnN0IGlzVHJlYXN1cmUgPSBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJylcbiAgICAgIFxuICAgICAgaWYgKGlzQWN0aW9uIHx8IGlzVHJlYXN1cmUpIHtcbiAgICAgICAgYWN0aW9ucy5wdXNoKHsgbGFiZWw6ICdQbGF5JywgYWN0aW9uOiAzIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiBgWW91IGRyZXcgJHtjYXJkLmNhcmROYW1lfWAsXG4gICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBhY3Rpb25zLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgY2FyZElkczogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgc3dpdGNoIChyZXN1bHQuYWN0aW9uKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywgeyBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCwgY2FyZElkIH0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBjYXJkSWQsIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3BsYXlDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICBvdmVycmlkZXM6IHsgYWN0aW9uQ29zdDogMCB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZXhwYW5kJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKCdbZXhwYW5kIGVmZmVjdF0gcHJvbXB0aW5nIHRvIHNlbGVjdCBjYXJkIHRvIHRyYXNoJylcbiAgICAgIGNvbnN0IHNlbGVjdGVkVG9UcmFzaElkcyA9IGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpLFxuICAgICAgICBjb3VudDogMVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRUb1RyYXNoSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2V4cGFuZCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZFRvVHJhc2hJZCA9IHNlbGVjdGVkVG9UcmFzaElkc1swXTtcbiAgICAgIGxldCBjYXJkID0gZWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkVG9UcmFzaElkKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbZXhwYW5kIGVmZmVjdF0gc2VsZWN0ZWQgJHtjYXJkfSB0byB0cmFzaGApXG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdDogZWZmZWN0Q29zdCB9ID0gZWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwge1xuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkVG9HYWluSWRzID0gYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBhbW91bnQ6IHsgdHJlYXN1cmU6IGVmZmVjdENvc3QudHJlYXN1cmUgKyAzLCBwb3Rpb246IGVmZmVjdENvc3QucG90aW9uIH1cbiAgICAgICAgICB9XG4gICAgICAgIF0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRUb0dhaW5JZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZXhwYW5kIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNhcmQgPSBlZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRUb0dhaW5JZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2V4cGFuZCBlZmZlY3RdIHNlbGVjdGVkICR7Y2FyZH0gdG8gZ2FpbmApXG4gICAgICBcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRUb0dhaW5JZHNbMF0sXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnZm9yZ2UnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoZWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzVG9UcmFzaCA9IGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZHNgLFxuICAgICAgICByZXN0cmljdDogZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBlZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgY291bnQ6IGVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgZWZmZWN0QXJncy5wbGF5ZXJJZCkubGVuZ3RoXG4gICAgICAgIH0sXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGxldCBjb3N0ID0geyB0cmVhc3VyZTogMCwgcG90aW9uOiAwIH07XG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkc1RvVHJhc2gubGVuZ3RoKSB7XG4gICAgICAgIGNvc3QgPSB7IHRyZWFzdXJlOiAwLCBwb3Rpb246IDAgfTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHNUb1RyYXNoKSB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICAgIGNvbnN0IHsgY29zdDogY2FyZENvc3QgfSA9IGVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29zdCA9IHtcbiAgICAgICAgICAgIHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlICsgY2FyZENvc3QudHJlYXN1cmUsXG4gICAgICAgICAgICBwb3Rpb246IGNvc3QucG90aW9uICsgKGNhcmRDb3N0LnBvdGlvbiA/PyAwKVxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHsgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsIGNhcmRJZCB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYEdhaW4gY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBraW5kOiAnZXhhY3QnLFxuICAgICAgICAgICAgYW1vdW50OiB7IHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlLCBwb3Rpb246IDAgfSxcbiAgICAgICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgICAgfVxuICAgICAgICBdLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2ZvcmdlIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWRzWzBdLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2dyYW5kLW1hcmtldCc6IHtcbiAgICByZWdpc3RlckFjdGlvbkNvbmRpdGlvbnM6ICgpID0+ICh7XG4gICAgICBjYW5CdXk6ICh7IG1hdGNoLCBjYXJkTGlicmFyeSwgcGxheWVySWQgfSkgPT5cbiAgICAgICAgIW1hdGNoLnN0YXRzLnBsYXllZENhcmRzQnlUdXJuW21hdGNoLnR1cm5OdW1iZXJdPy5maW5kKChjYXJkSWQpID0+IHtcbiAgICAgICAgICByZXR1cm4gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpLmNhcmRLZXkgPT09ICdjb3BwZXInICYmXG4gICAgICAgICAgICBtYXRjaC5zdGF0cy5wbGF5ZWRDYXJkc1tjYXJkSWRdLnBsYXllcklkID09PSBwbGF5ZXJJZFxuICAgICAgICB9KVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZ3JhbmQgbWFya2V0IGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGdhaW5pbmcgMSBhY3Rpb24sIGdhaW5pbmcgMSBidXksIGFuZCBnYWluaW5nIDIgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICB9XG4gIH0sXG4gICdob2FyZCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgaG9hcmQ6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoZWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgaG9hcmQ6JHtlZmZlY3RBcmdzLmNhcmRJZH06Y2FyZEdhaW5lZGAsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRHYWluZWQnLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBvbmNlOiBmYWxzZSxcbiAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLm1hdGNoLnR1cm5OdW1iZXIgIT09XG4gICAgICAgICAgICBjb25kaXRpb25BcmdzLm1hdGNoLnN0YXRzLmNhcmRzR2FpbmVkW2NvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZF0/LnR1cm5OdW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmJvdWdodCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gZWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHRyaWdnZXJlZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCBnb2xkQ2FyZElkcyA9IGVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICAgIHsgY2FyZEtleXM6ICdnb2xkJyB9XG4gICAgICAgICAgXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFnb2xkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbaG9hcmQgdHJpZ2dlcmVkIGVmZmVjdF0gbm8gZ29sZCBpbiBzdXBwbHlgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGdvbGRDYXJkSWRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdpbnZlc3RtZW50Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGlmIChlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2ludmVzdG1lbnQgZWZmZWN0XSBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IGVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgZWZmZWN0QXJncy5wbGF5ZXJJZCksXG4gICAgICAgICAgY291bnQ6IDFcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkc1swXSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW2ludmVzdG1lbnQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkIHRvIHRyYXNoYCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBlZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZHNbMF0sXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICcrMSBUcmVhc3VyZScsIGFjdGlvbjogMSB9LFxuICAgICAgICAgIHsgbGFiZWw6ICdUcmFzaCBhbmQgcmV2ZWFsJywgYWN0aW9uOiAyIH1cbiAgICAgICAgXSxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIGNhcmRJZHM6IG51bWJlcltdIH07XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGhhbmQgPSBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgICBsZXQgdW5pcXVlVHJlYXN1cmVDb3VudDogQ2FyZEtleVtdID0gW107XG4gICAgICAgIGNvbnN0IGwgPSBoYW5kLmxlbmd0aCAtIDE7XG4gICAgICAgIGZvciAobGV0IGkgPSBsOyBpID49IDA7IGktLSkge1xuICAgICAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBoYW5kW2ldLFxuICAgICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChoYW5kW2ldKTtcbiAgICAgICAgICB1bmlxdWVUcmVhc3VyZUNvdW50LnB1c2goY2FyZC5jYXJkS2V5KTtcbiAgICAgICAgfVxuICAgICAgICB1bmlxdWVUcmVhc3VyZUNvdW50ID0gQXJyYXkuZnJvbShuZXcgU2V0KHVuaXF1ZVRyZWFzdXJlQ291bnQpKTtcbiAgICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5WaWN0b3J5VG9rZW4nLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY291bnQ6IHVuaXF1ZVRyZWFzdXJlQ291bnQubGVuZ3RoXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2tpbmdzLWNvdXJ0Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBba2luZ3MgY291cnQgZWZmZWN0XSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgY2FyZGApO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYENob29zZSBhY3Rpb25gLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQgfSxcbiAgICAgICAgICB7IGNhcmRUeXBlOiAnQUNUSU9OJyB9XG4gICAgICAgIF0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkID0gc2VsZWN0ZWRDYXJkSWRzWzBdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBba2luZ3MgY291cnQgZWZmZWN0XSBubyBzZWxlY3RlZCBjYXJkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gZWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtraW5ncyBjb3VydCBlZmZlY3RdIHNlbGVjdGVkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICBhd2FpdCBlZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgICBvdmVycmlkZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbkNvc3Q6IDBcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnbWFnbmF0ZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChlZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW21hZ25hdGUgZWZmZWN0XSByZXZlYWxpbmcgaGFuZGApO1xuICAgICAgY29uc3QgaGFuZCA9IGVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgZWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBsZXQgdHJlYXN1cmVDYXJkQ291bnQgPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IGhhbmQubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgY29uc3QgY2FyZCA9IGVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChoYW5kW2ldKTtcbiAgICAgICAgdHJlYXN1cmVDYXJkQ291bnQgKz0gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpID8gMSA6IDA7XG4gICAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogaGFuZFtpXSxcbiAgICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbWFnbmF0ZSBlZmZlY3RdICR7dHJlYXN1cmVDYXJkQ291bnR9IHRyZWFzdXJlIHJldmVhbGVkYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiB0cmVhc3VyZUNhcmRDb3VudCB9KTtcbiAgICB9XG4gIH0sXG4gICdtaW50Jzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uR2FpbmVkOiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIGNhcmRMaWJyYXJ5LCBtYXRjaCwgLi4uYXJncyB9LCB7IHBsYXllcklkIH0pID0+IHtcbiAgICAgICAgY29uc3QgY2FyZHNJblBsYXkgPSBnZXRDYXJkc0luUGxheShhcmdzLmZpbmRDYXJkcyk7XG4gICAgICAgIGNvbnN0IG5vbkR1cmF0aW9uVHJlYXN1cmVzID0gY2FyZHNJblBsYXlcbiAgICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpICYmXG4gICAgICAgICAgICAhY2FyZC50eXBlLmluY2x1ZGVzKCdEVVJBVElPTicpICYmXG4gICAgICAgICAgICBtYXRjaC5zdGF0cy5wbGF5ZWRDYXJkc1tjYXJkLmlkXS5wbGF5ZXJJZCA9PT0gcGxheWVySWRcbiAgICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKG5vbkR1cmF0aW9uVHJlYXN1cmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWludCBvbkdhaW5lZF0gbm8gbm9uLWR1cmF0aW9uIHRyZWFzdXJlIGNhcmRzIGluIHBsYXlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWludCBvbkdhaW5lZF0gdHJhc2hpbmcgJHtub25EdXJhdGlvblRyZWFzdXJlcy5sZW5ndGh9IG5vbi1kdXJhdGlvbiB0cmVhc3VyZSBjYXJkc2ApO1xuICAgICAgICBmb3IgKGxldCBpID0gbm9uRHVyYXRpb25UcmVhc3VyZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBub25EdXJhdGlvblRyZWFzdXJlc1tpXS5pZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGhhbmQgPSBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgaGFuZENhcmRzID0gaGFuZC5tYXAoZWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKTtcbiAgICAgIGNvbnN0IHRyZWFzdXJlc0luSGFuZCA9IGhhbmRDYXJkcy5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpO1xuICAgICAgXG4gICAgICBpZiAodHJlYXN1cmVzSW5IYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW21pbnQgZWZmZWN0XSBubyB0cmVhc3VyZXMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHVuaXF1ZVRyZWFzdXJlQ291bnQgPSBuZXcgU2V0KHRyZWFzdXJlc0luSGFuZC5tYXAoY2FyZCA9PiBjYXJkLmNhcmRLZXkpKS5zaXplO1xuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRDYXJkOiBDYXJkIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgXG4gICAgICBpZiAodW5pcXVlVHJlYXN1cmVDb3VudCA9PT0gMSkge1xuICAgICAgICBzZWxlY3RlZENhcmQgPSB0cmVhc3VyZXNJbkhhbmRbMF07XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgUmV2ZWFsIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGVmZmVjdEFyZ3MucGxheWVySWQpLFxuICAgICAgICAgIGNvdW50OiAxXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHNbMF0pIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFttaW50IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZCB0byByZXZlYWxgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHNlbGVjdGVkQ2FyZCA9IGVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW21pbnQgZWZmZWN0XSBjYXJkIHRvIHJldmVhbCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICBwbGF5ZXJJZDogZWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkc0luU3VwcGx5ID0gZWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiBzZWxlY3RlZENhcmQuaXNCYXNpYyA/ICdiYXNpY1N1cHBseScgOiAna2luZ2RvbVN1cHBseScgfSxcbiAgICAgICAgeyBjYXJkS2V5czogc2VsZWN0ZWRDYXJkLmNhcmRLZXkgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmIChjYXJkc0luU3VwcGx5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW21pbnQgZWZmZWN0XSBubyBjb3BpZXMgb2YgJHtzZWxlY3RlZENhcmR9IGluIHN1cHBseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGF3YWl0IGVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZHNJblN1cHBseS5zbGljZSgtMSlbMF0uaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnbW9udW1lbnQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBwbGF5ZXJJZCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbW9udW1lbnQgZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmUsIGFuZCAxIHZpY3RvcnkgdG9rZW5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblZpY3RvcnlUb2tlbicsIHsgcGxheWVySWQsIGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3BlZGRsZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcGVkZGxlciBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBnYWluaW5nIDEgYWN0aW9uLCBhbmQgZ2FpbmluZyAxIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgfVxuICB9LFxuICAncGxhdGludW0nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoZWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgZWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDUgfSk7XG4gICAgfVxuICB9LFxuICAncXVhcnJ5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3F1YXJyeSBlZmZlY3RdIGdhaW5pbmcgMSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBhY3Rpb25DYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyh7IGNhcmRUeXBlOiAnQUNUSU9OJyB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBhY3Rpb25DYXJkIG9mIGFjdGlvbkNhcmRzKSB7XG4gICAgICAgIGNvbnN0IHJ1bGU6IENhcmRQcmljZVJ1bGUgPSAoKSA9PiAoeyByZXN0cmljdGVkOiBmYWxzZSwgY29zdDogeyB0cmVhc3VyZTogLTIgfSB9KTtcbiAgICAgICAgY29uc3QgdW5zdWIgPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLnJlZ2lzdGVyUnVsZShhY3Rpb25DYXJkLCBydWxlKTtcbiAgICAgICAgdW5zdWJzLnB1c2godW5zdWIpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBwZWRkbGVyOiR7Y2FyZEVmZmVjdEFyZ3MuY2FyZElkfTplbmRUdXJuYCxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuJyxcbiAgICAgICAgY29uZGl0aW9uOiAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHVuc3Vicy5mb3JFYWNoKGUgPT4gZSgpKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdyYWJibGUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcmFiYmxlIGVmZmVjdF0gZHJhd2luZyAzIGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDMgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBtYXRjaCA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoO1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRlY2subGVuZ3RoIDwgMykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbcmFiYmxlIGVmZmVjdF0gJHt0YXJnZXRQbGF5ZXJJZH0gaGFzIGxlc3MgdGhhbiAzIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtyYWJibGUgZWZmZWN0XSAke3RhcmdldFBsYXllcklkfSBoYXMgbm8gY2FyZHMgaW4gZGVja2ApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBudW1Ub1JldmVhbCA9IE1hdGgubWluKDMsIGRlY2subGVuZ3RoKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRzVG9SZWFycmFuZ2U6IENhcmRbXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub1JldmVhbDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpIHx8IGNhcmQudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtyYWJibGUgZWZmZWN0XSBhY3Rpb24gb3IgdHJlYXN1cmUgcmV2ZWFsZWQsIGRpc2NhcmRpbmdgKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7IGNhcmRJZCwgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRzVG9SZWFycmFuZ2UucHVzaChjYXJkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkc1RvUmVhcnJhbmdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbcmFiYmxlIGVmZmVjdF0gbm8gY2FyZHMgdG8gcmVhcnJhbmdlYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZHNUb1JlYXJyYW5nZS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3JhYmJsZSBlZmZlY3RdIG9ubHkgMSBjYXJkIHRvIHJlYXJyYW5nZSwgbW92aW5nIHRvIGRlY2tgKTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkc1RvUmVhcnJhbmdlWzBdLmlkLFxuICAgICAgICAgICAgdG9QbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6ICdSZWFycmFuZ2UnLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgICB7IGxhYmVsOiAnRE9ORScsIGFjdGlvbjogMSB9XG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICB0eXBlOiAncmVhcnJhbmdlJyxcbiAgICAgICAgICAgICAgY2FyZElkczogY2FyZHNUb1JlYXJyYW5nZS5tYXAoY2FyZCA9PiBjYXJkLmlkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiByZXN1bHQucmVzdWx0KSB7XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICAgIHRvUGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3RpYXJhJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3RpYXJhIGVmZmVjdF0gZ2FpbmluZyAxIGJ1eWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgdGlhcmE6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRHYWluZWQnLFxuICAgICAgICBvbmNlOiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogZmFsc2UsXG4gICAgICAgIGNvbXB1bHNvcnk6IGZhbHNlLFxuICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiBjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlckVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCBjYXJkID0gdHJpZ2dlckVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyRWZmZWN0QXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3RpYXJhIHRyaWdnZXJlZCBlZmZlY3RdIHB1dHRpbmcgJHtjYXJkfSBvbiBkZWNrYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlckVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYHRpYXJhOiR7Y2FyZEVmZmVjdEFyZ3MuY2FyZElkfTplbmRUdXJuYCxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuJyxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHRyaWdnZXJFZmZlY3RBcmdzKSA9PiB7XG4gICAgICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGB0aWFyYToke2NhcmRFZmZlY3RBcmdzLmNhcmRJZH06Y2FyZEdhaW5lZGApO1xuICAgICAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgdGlhcmE6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmVuZFR1cm5gKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmRJZHMgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBjb25zdCBoYW5kQ2FyZHMgPSBoYW5kSWRzLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKTtcbiAgICAgIGNvbnN0IHRyZWFzdXJlQ2FyZHMgPSBoYW5kQ2FyZHMuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKTtcbiAgICAgIGlmICh0cmVhc3VyZUNhcmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3RpYXJhIGVmZmVjdF0gbm8gdHJlYXN1cmUgY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBQbGF5IHRyZWFzdXJlYCxcbiAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9LFxuICAgICAgICAgIHsgY2FyZFR5cGU6ICdUUkVBU1VSRScgfVxuICAgICAgICBdLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHNbMF0pIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt0aWFyYSBlZmZlY3RdIG5vIHRyZWFzdXJlIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZCA9IHNlbGVjdGVkQ2FyZElkc1swXTtcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3RpYXJhIGVmZmVjdF0gcGxheWluZyAke3NlbGVjdGVkQ2FyZH0gdHdpY2VgKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBvdmVycmlkZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbkNvc3Q6IDBcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndmF1bHQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbdmF1bHQgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHNgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIGNhcmRzYCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IHtcbiAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgY291bnQ6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKS5sZW5ndGhcbiAgICAgICAgfVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3ZhdWx0IGVmZmVjdF0gbm8gY2FyZHMgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3ZhdWx0IGVmZmVjdF0gZGlzY2FyZGluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHNlbGVjdGVkQ2FyZElkcykge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBjYXJkSWQsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt2YXVsdCBlZmZlY3RdIGdhaW5pbmcgJHtzZWxlY3RlZENhcmRJZHMubGVuZ3RofSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiBzZWxlY3RlZENhcmRJZHMubGVuZ3RoIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIGlmICghaGFuZC5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3ZhdWx0IGVmZmVjdF0gJHt0YXJnZXRQbGF5ZXJJZH0gaGFzIG5vIGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkJHtoYW5kLmxlbmd0aCA+IDEgPyAnIHRvIGRyYXcnIDogJyd9P2AsXG4gICAgICAgICAgcmVzdHJpY3Q6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgICBjb3VudDogTWF0aC5taW4oMiwgaGFuZC5sZW5ndGgpLFxuICAgICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbdmF1bHQgZWZmZWN0XSBkaXNjYXJkaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgZm9yIChjb25zdCBzZWxlY3RlZENhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCAhPT0gMikge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdmF1bHQgZWZmZWN0XSAke3RhcmdldFBsYXllcklkfSBkaWQgbm90IGRpc2NhcmQgMiBjYXJkcywgb25seSAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9YCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnd2FyLWNoZXN0Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4ge1xuICAgICAgY29uc3QgY2FyZHNOYW1lZEJ5VHVybjogUmVjb3JkPG51bWJlciwgQ2FyZEtleVtdPiA9IHt9O1xuICAgICAgXG4gICAgICByZXR1cm4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGxlZnRQbGF5ZXIgPSBnZXRQbGF5ZXJTdGFydGluZ0Zyb20oe1xuICAgICAgICAgIHN0YXJ0RnJvbUlkeDogY2FyZEVmZmVjdEFyZ3MubWF0Y2guY3VycmVudFBsYXllclR1cm5JbmRleCxcbiAgICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgICAgZGlzdGFuY2U6IDEsXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFt3YXItY2hlc3QgZWZmZWN0XSBwcm9tcHRpbmcgJHtsZWZ0UGxheWVyfSB0byBuYW1lIGEgY2FyZGApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgbmFtZWRDYXJkUmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ05hbWUgYSBjYXJkJyxcbiAgICAgICAgICBwbGF5ZXJJZDogbGVmdFBsYXllci5pZCxcbiAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICB0eXBlOiAnbmFtZS1jYXJkJ1xuICAgICAgICAgIH1cbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkS2V5IH07XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkS2V5ID0gbmFtZWRDYXJkUmVzdWx0LnJlc3VsdDtcbiAgICAgICAgXG4gICAgICAgIGNhcmRzTmFtZWRCeVR1cm5bY2FyZEVmZmVjdEFyZ3MubWF0Y2gudHVybk51bWJlcl0gPz89IFtdO1xuICAgICAgICBjYXJkc05hbWVkQnlUdXJuW2NhcmRFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXJdLnB1c2goY2FyZEtleSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkSWRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsga2luZDogJ3VwVG8nLCBhbW91bnQ6IHsgdHJlYXN1cmU6IDUgfSwgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH1cbiAgICAgICAgXSlcbiAgICAgICAgICAuZmlsdGVyKGNhcmQgPT4gIWNhcmRzTmFtZWRCeVR1cm5bY2FyZEVmZmVjdEFyZ3MubWF0Y2gudHVybk51bWJlcl0uaW5jbHVkZXMoY2FyZC5jYXJkS2V5KSlcbiAgICAgICAgICAubWFwKGNhcmQgPT4gY2FyZC5pZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt3YXItY2hlc3QgZWZmZWN0XSBubyBjYXJkcyBmb3VuZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBHYWluIGEgY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IGNhcmRJZHMsXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbd2FyLWNoZXN0IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWQgPSBzZWxlY3RlZENhcmRJZHNbMF07XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFt3YXItY2hlc3QgZWZmZWN0XSBnYWluaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnd2F0Y2h0b3dlcic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlSGFuZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgd2F0Y2h0b3dlcjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgIH0sXG4gICAgICBvbkVudGVySGFuZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICAgIGlkOiBgd2F0Y2h0b3dlcjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgY29tcHVsc29yeTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogZmFsc2UsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZEdhaW5lZCcsXG4gICAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBldmVudEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyRWZmZWN0QXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgY2FyZCA9IHRyaWdnZXJFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQodHJpZ2dlckVmZmVjdEFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCk7XG4gICAgICAgICAgICBhd2FpdCB0cmlnZ2VyRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogZXZlbnRBcmdzLmNhcmRJZCxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmlnZ2VyRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICAgIHByb21wdDogYFRyYXNoIG9yIHRvcCBkZWNrICR7Y2FyZC5jYXJkTmFtZX0/YCxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdUUkFTSCcsIGFjdGlvbjogMSB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdUT1AtREVDSycsIGFjdGlvbjogMiB9XG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbd2F0Y2h0b3dlciB0cmlnZ2VyZWQgZWZmZWN0XSBwbGF5ZXIgY2hvc2UgdG8gdHJhc2ggJHtjYXJkfWApO1xuICAgICAgICAgICAgICBhd2FpdCB0cmlnZ2VyRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFt3YXRjaHRvd2VyIHRyaWdnZXJlZCBlZmZlY3RdIHBsYXllciBjaG9zZSB0byB0b3AtZGVjayAke2NhcmR9YCk7XG4gICAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgICAgICAgIHRvUGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgbnVtVG9EcmF3ID0gNiAtIGhhbmQubGVuZ3RoO1xuICAgICAgXG4gICAgICBpZiAobnVtVG9EcmF3IDwgMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3dhdGNodG93ZXIgZWZmZWN0XSBhbHJlYWR5IGhhcyA2IGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3dhdGNodG93ZXIgZWZmZWN0XSBkcmF3aW5nICR7bnVtVG9EcmF3fSBjYXJkc2ApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNvdW50OiBoYW5kLmxlbmd0aCAtIDZcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3dvcmtlcnMtdmlsbGFnZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFt3b3JrZXJzLXZpbGxhZ2UgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAyIGFjdGlvbnMsIGFuZCBnYWluaW5nIDEgYnV5YCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBleHBhbnNpb247Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLFNBQVMsa0JBQWtCLFFBQVEsc0NBQXNDO0FBQ3pFLFNBQVMsdUJBQXVCLEVBQUUsc0JBQXNCLFFBQVEsMkNBQTJDO0FBQzNHLFNBQVMsY0FBYyxRQUFRLG1DQUFtQztBQUVsRSxTQUFTLHFCQUFxQixRQUFRLDRDQUE0QztBQUVsRixNQUFNLFlBQWlDO0VBQ3JDLFNBQVM7SUFDUCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFbEUsTUFBTSwyQkFBMkIsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFDcEYsVUFBVSxXQUFXLFFBQVE7VUFDN0IsUUFBUSxDQUFDLGdCQUFnQixDQUFDO1VBQzFCLFVBQVU7WUFDUjtjQUFFLFVBQVU7Y0FBYyxVQUFVLFdBQVcsUUFBUTtZQUFDO1lBQ3hEO2NBQUUsVUFBVTtZQUFXO1dBQ3hCO1VBQ0QsT0FBTztVQUNQLFVBQVU7UUFDWjtRQUVBLE1BQU0sMEJBQTBCLHdCQUF3QixDQUFDLEVBQUU7UUFDM0QsSUFBSSxDQUFDLHlCQUF5QjtVQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixDQUFDO1VBQzdDO1FBQ0Y7UUFFQSxNQUFNLHNCQUFzQixXQUFXLFdBQVcsQ0FBQyxPQUFPLENBQUM7UUFDM0QsUUFBUSxHQUFHLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxxQkFBcUI7UUFFNUQsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGVBQWU7VUFDcEQsUUFBUTtVQUNSLFVBQVUsV0FBVyxRQUFRO1FBQy9CO1FBRUEsTUFBTSx3QkFBd0IsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFDakYsVUFBVSxXQUFXLFFBQVE7VUFDN0IsUUFBUSxDQUFDLFNBQVMsQ0FBQztVQUNuQixVQUFVO1lBQ1I7Y0FBRSxVQUFVO2dCQUFDO2dCQUFlO2VBQWdCO1lBQUM7WUFDN0M7Y0FBRSxVQUFVLFdBQVcsUUFBUTtjQUFFLE1BQU07Y0FBUSxRQUFRO2dCQUFFLFVBQVU7Y0FBRTtZQUFFO1dBQ3hFO1VBQ0QsT0FBTztRQUNUO1FBRUEsTUFBTSx1QkFBdUIscUJBQXFCLENBQUMsRUFBRTtRQUVyRCxJQUFJLENBQUMsc0JBQXNCO1VBQ3pCLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLENBQUM7VUFDN0M7UUFDRjtRQUVBLE1BQU0scUJBQXFCLFdBQVcsV0FBVyxDQUFDLE9BQU8sQ0FBQztRQUUxRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLG9CQUFvQjtRQUUzRCxNQUFNLFdBQVcscUJBQXFCLENBQUMsWUFBWTtVQUNqRCxVQUFVLFdBQVcsUUFBUTtVQUM3QixRQUFRO1VBQ1IsSUFBSTtZQUFFLFVBQVU7VUFBZ0I7UUFDbEM7TUFDRjtFQUNGO0VBQ0EsUUFBUTtJQUNOLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxnQkFBZ0IsV0FBVyxLQUFLLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFdBQVcsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUMzRixNQUFNLHNCQUFzQixjQUFjLEdBQUcsQ0FBQyxXQUFXLFdBQVcsQ0FBQyxPQUFPLEVBQ3pFLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBRXJDLFFBQVEsR0FBRyxDQUFDLENBQUMscUJBQXFCLEVBQUUsb0JBQW9CLE1BQU0sQ0FBQyx5QkFBeUIsRUFBRSxvQkFBb0IsTUFBTSxDQUFDLFNBQVMsQ0FBQztRQUMvSCxNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTyxvQkFBb0IsTUFBTTtRQUFDO01BQzdGO0VBQ0Y7RUFDQSxVQUFVO0lBQ1IsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHNEQUFzRCxDQUFDO1FBQ3BFLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFDbEUsTUFBTSxXQUFXLHFCQUFxQixDQUFDLG9CQUFvQjtVQUFFLFVBQVUsV0FBVyxRQUFRO1VBQUUsT0FBTztRQUFFO1FBRXJHLE1BQU0sT0FBTyxXQUFXLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLFdBQVcsUUFBUTtRQUN4RixJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7VUFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztRQUNoRCxPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyx3REFBd0QsQ0FBQztVQUV0RSxNQUFNLGtCQUFrQixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztZQUMzRSxVQUFVLFdBQVcsUUFBUTtZQUM3QixRQUFRLENBQUMsVUFBVSxDQUFDO1lBQ3BCLFVBQVUsV0FBVyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxXQUFXLFFBQVE7WUFDckYsT0FBTztVQUNUO1VBRUEsTUFBTSxpQkFBaUIsZUFBZSxDQUFDLEVBQUU7VUFFekMsSUFBSSxDQUFDLGdCQUFnQjtZQUNuQixRQUFRLElBQUksQ0FBQyxDQUFDLGdDQUFnQyxDQUFDO1VBQ2pELE9BQ0s7WUFDSCxNQUFNLGVBQWUsV0FBVyxXQUFXLENBQUMsT0FBTyxDQUFDO1lBRXBELFFBQVEsR0FBRyxDQUFDLENBQUMseUJBQXlCLEVBQUUsYUFBYSxTQUFTLENBQUM7WUFFL0QsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGFBQWE7Y0FDbEQsVUFBVSxXQUFXLFFBQVE7Y0FDN0IsUUFBUTtZQUNWO1lBRUEsTUFBTSxFQUFFLE1BQU0sZ0JBQWdCLEVBQUUsR0FBRyxXQUFXLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxjQUFjO2NBQ3pGLFVBQVUsV0FBVyxRQUFRO1lBQy9CO1lBRUEsTUFBTSxlQUFlLEtBQUssS0FBSyxDQUFDLGlCQUFpQixRQUFRLEdBQUc7WUFFNUQsUUFBUSxHQUFHLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxhQUFhLGVBQWUsQ0FBQztZQUVwRSxNQUFNLFdBQVcscUJBQXFCLENBQUMsb0JBQW9CO2NBQ3pELFVBQVUsV0FBVyxRQUFRO2NBQzdCLE9BQU87WUFDVDtVQUNGO1FBQ0Y7UUFFQSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxXQUFXLEtBQUs7VUFDdkIsV0FBVztVQUNYLGtCQUFrQixXQUFXLFFBQVE7UUFDdkM7UUFFQSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLGtCQUFrQixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztZQUMzRSxVQUFVO1lBQ1YsUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUNwQixVQUFVLFdBQVcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsV0FBVyxRQUFRO1lBQ3JGLE9BQU87WUFDUCxVQUFVO1VBQ1o7VUFFQSxNQUFNLGlCQUFpQixlQUFlLENBQUMsRUFBRTtVQUV6QyxJQUFJLENBQUMsZ0JBQWdCO1lBQ25CLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLEVBQUUsZUFBZSxpQkFBaUIsQ0FBQztZQUM5RTtVQUNGO1VBRUEsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGFBQWE7WUFDbEQsVUFBVTtZQUNWLFFBQVE7VUFDVjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGFBQWE7SUFDWCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0RBQWtELENBQUM7UUFDaEUsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUVsRSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxXQUFXLEtBQUs7VUFDdkIsV0FBVztVQUNYLGtCQUFrQixXQUFXLFFBQVE7UUFDdkMsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLFdBQVcsZUFBZSxFQUFFLENBQUMsU0FBUyxDQUFDLFdBQVc7UUFFeEUsUUFBUSxHQUFHLENBQUMsQ0FBQywyQkFBMkIsRUFBRSxnQkFBZ0IsZ0JBQWdCLENBQUM7UUFFM0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxhQUFhLFdBQVcsU0FBUyxDQUFDO1lBQ3RDO2NBQUUsVUFBVTtZQUFjO1lBQzFCO2NBQUUsVUFBVTtZQUFRO1dBQ3JCO1VBRUQsSUFBSSxDQUFDLFdBQVcsTUFBTSxFQUFFO1lBQ3RCLFFBQVEsR0FBRyxDQUFDLENBQUMsMkNBQTJDLENBQUM7WUFDekQ7VUFDRjtVQUVBLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxZQUFZO1lBQ2pELFVBQVU7WUFDVixRQUFRLFdBQVcsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ2xDLElBQUk7Y0FBRSxVQUFVO1lBQWdCO1VBQ2xDO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsUUFBUTtJQUNOLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxpREFBaUQsQ0FBQztRQUMvRCxNQUFNLFdBQVcscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsV0FBVyxRQUFRO1FBQUM7UUFDbkYsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFaEUsTUFBTSxtQkFBbUIsdUJBQXVCLFdBQVcsS0FBSyxJQUFJLHdCQUF3QixXQUFXLFNBQVM7UUFFaEgsSUFBSSxtQkFBbUIsR0FBRztVQUN4QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGtFQUFrRSxDQUFDO1VBQ2hGLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxZQUFZO1lBQUUsVUFBVSxXQUFXLFFBQVE7VUFBQztRQUNyRjtRQUVBLElBQUksbUJBQW1CLEdBQUc7VUFDeEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnRkFBZ0YsQ0FBQztVQUM5RixNQUFNLFdBQVcscUJBQXFCLENBQUMsV0FBVztZQUFFLE9BQU87VUFBRTtVQUM3RCxNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1lBQUUsT0FBTztVQUFFO1FBQ3BFO01BQ0Y7RUFDRjtFQUNBLFNBQVM7SUFDUCwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLEtBQUssZUFBZSxDQUFDLHdCQUF3QixDQUFDO1lBQzVDLElBQUksQ0FBQyxNQUFNLEVBQUUsVUFBVSxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3pDLGNBQWM7WUFDZCxVQUFVLFVBQVUsUUFBUTtZQUM1QixNQUFNO1lBQ04sd0JBQXdCO1lBQ3hCLFlBQVk7WUFDWixXQUFXLENBQUMsZ0JBQWtCLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEtBQUssVUFBVSxRQUFRO1lBQ3hGLG1CQUFtQixPQUFPO2NBQ3hCLE1BQU0sa0JBQWtCLHFCQUFxQixDQUFDLFlBQVk7Z0JBQ3hELFVBQVUsVUFBVSxRQUFRO2dCQUM1QixRQUFRLFVBQVUsTUFBTTtnQkFDeEIsV0FBVztrQkFDVCxZQUFZO2dCQUNkO2NBQ0Y7WUFDRjtVQUNGO1FBQ0Y7UUFDQSxhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sRUFBRSxVQUFVLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDOUU7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBRWxFLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLFdBQVcsS0FBSztVQUN2QixXQUFXO1VBQ1gsa0JBQWtCLFdBQVcsUUFBUTtRQUN2QyxHQUFHLE1BQU0sQ0FBQyxDQUFBO1VBQ1IsT0FBTyxXQUFXLGVBQWUsRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXLGNBQ3hELFdBQVcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsVUFBVSxNQUFNLElBQUk7UUFDaEY7UUFFQSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLGtCQUFrQixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztZQUMzRSxVQUFVO1lBQ1YsUUFBUSxDQUFDLGFBQWEsQ0FBQztZQUN2QixVQUFVLFdBQVcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsV0FBVyxRQUFRO1lBQ3JGLE9BQU87VUFDVDtVQUVBLElBQUksQ0FBQyxpQkFBaUI7WUFDcEIsUUFBUSxHQUFHLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxlQUFlLGlCQUFpQixDQUFDO1lBQzdFO1VBQ0Y7VUFFQSxNQUFNLFdBQVcscUJBQXFCLENBQUMsWUFBWTtZQUNqRCxRQUFRLGVBQWUsQ0FBQyxFQUFFO1lBQzFCLFlBQVk7WUFDWixJQUFJO2NBQUUsVUFBVTtZQUFhO1VBQy9CO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxXQUFXLEVBQUUsVUFBVSxNQUFNLENBQUMsV0FBVyxDQUFDO1FBQ3BGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztRQUM5RCxNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBQ2xFLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxXQUFXO1VBQUUsT0FBTztRQUFFO1FBRTdELFdBQVcsZUFBZSxDQUFDLHdCQUF3QixDQUFDO1VBQ2xELElBQUksQ0FBQyxXQUFXLEVBQUUsV0FBVyxNQUFNLENBQUMsV0FBVyxDQUFDO1VBQ2hELFVBQVUsV0FBVyxRQUFRO1VBQzdCLGNBQWM7VUFDZCxZQUFZO1VBQ1osTUFBTTtVQUNOLHdCQUF3QjtVQUN4QixXQUFXLENBQUM7WUFDVixNQUFNLG9CQUFvQixjQUFjLEtBQUssQ0FBQyxVQUFVO1lBQ3hELElBQUksc0JBQXNCLGNBQWMsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFVBQVUsRUFBRSxPQUFPO1lBQ3RILE1BQU0sT0FBTyxjQUFjLFdBQVcsQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU07WUFDaEYsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLE9BQU87WUFDMUMsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU87WUFDeEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxREFBcUQsQ0FBQztZQUNuRSxNQUFNLG9CQUFvQixxQkFBcUIsQ0FBQyxvQkFBb0I7Y0FDbEUsVUFBVSxXQUFXLFFBQVE7Y0FDN0IsT0FBTztZQUNUO1VBQ0Y7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxnQkFBZ0I7SUFDZCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxXQUFXO1VBQUUsT0FBTztRQUFFO1FBRTdELE1BQU0sT0FBTyxXQUFXLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLFdBQVcsUUFBUTtRQUN4RixNQUFNLFVBQVUsV0FBVyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLFdBQVcsUUFBUTtRQUU5RixJQUFJLEtBQUssTUFBTSxHQUFHLFFBQVEsTUFBTSxLQUFLLEdBQUc7VUFDdEMsUUFBUSxHQUFHLENBQUMsQ0FBQyx5Q0FBeUMsQ0FBQztVQUN2RDtRQUNGO1FBRUEsSUFBSSxLQUFLLE1BQU0sS0FBSyxHQUFHO1VBQ3JCLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxlQUFlO1lBQUUsVUFBVSxXQUFXLFFBQVE7VUFBQztRQUN4RjtRQUVBLE1BQU0sU0FBUyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBQ2hDLE1BQU0sT0FBTyxXQUFXLFdBQVcsQ0FBQyxPQUFPLENBQUM7UUFFNUMsTUFBTSxVQUFVO1VBQ2Q7WUFBRSxPQUFPO1lBQVMsUUFBUTtVQUFFO1VBQzVCO1lBQUUsT0FBTztZQUFXLFFBQVE7VUFBRTtTQUMvQjtRQUVELE1BQU0sV0FBVyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDcEMsTUFBTSxhQUFhLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUV0QyxJQUFJLFlBQVksWUFBWTtVQUMxQixRQUFRLElBQUksQ0FBQztZQUFFLE9BQU87WUFBUSxRQUFRO1VBQUU7UUFDMUM7UUFFQSxNQUFNLFNBQVMsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFDbEUsUUFBUSxDQUFDLFNBQVMsRUFBRSxLQUFLLFFBQVEsRUFBRTtVQUNuQyxVQUFVLFdBQVcsUUFBUTtVQUM3QixlQUFlO1FBQ2pCO1FBRUEsT0FBUSxPQUFPLE1BQU07VUFDbkIsS0FBSztZQUNILE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxhQUFhO2NBQUUsVUFBVSxXQUFXLFFBQVE7Y0FBRTtZQUFPO1lBQzVGO1VBQ0YsS0FBSztZQUNILE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxlQUFlO2NBQUU7Y0FBUSxVQUFVLFdBQVcsUUFBUTtZQUFDO1lBQzlGO1VBQ0YsS0FBSztZQUNILE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxZQUFZO2NBQ2pELFVBQVUsV0FBVyxRQUFRO2NBQzdCO2NBQ0EsV0FBVztnQkFBRSxZQUFZO2NBQUU7WUFDN0I7WUFDQTtRQUNKO01BQ0Y7RUFDRjtFQUNBLFVBQVU7SUFDUixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDO1FBQ1osTUFBTSxxQkFBcUIsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFDOUUsVUFBVSxXQUFXLFFBQVE7VUFDN0IsUUFBUSxDQUFDLFVBQVUsQ0FBQztVQUNwQixVQUFVLFdBQVcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsV0FBVyxRQUFRO1VBQ3JGLE9BQU87UUFDVDtRQUVBLElBQUksQ0FBQyxtQkFBbUIsTUFBTSxFQUFFO1VBQzlCLFFBQVEsR0FBRyxDQUFDLENBQUMsZ0NBQWdDLENBQUM7VUFDOUM7UUFDRjtRQUVBLE1BQU0sb0JBQW9CLGtCQUFrQixDQUFDLEVBQUU7UUFDL0MsSUFBSSxPQUFPLFdBQVcsV0FBVyxDQUFDLE9BQU8sQ0FBQztRQUMxQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLEtBQUssU0FBUyxDQUFDO1FBRXZELE1BQU0sRUFBRSxNQUFNLFVBQVUsRUFBRSxHQUFHLFdBQVcsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07VUFDM0UsVUFBVSxXQUFXLFFBQVE7UUFDL0I7UUFFQSxNQUFNLG9CQUFvQixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztVQUM3RSxVQUFVLFdBQVcsUUFBUTtVQUM3QixRQUFRLENBQUMsU0FBUyxDQUFDO1VBQ25CLFVBQVU7WUFDUjtjQUFFLFVBQVU7Z0JBQUM7Z0JBQWU7ZUFBZ0I7WUFBQztZQUM3QztjQUNFLE1BQU07Y0FDTixVQUFVLFdBQVcsUUFBUTtjQUM3QixRQUFRO2dCQUFFLFVBQVUsV0FBVyxRQUFRLEdBQUc7Z0JBQUcsUUFBUSxXQUFXLE1BQU07Y0FBQztZQUN6RTtXQUNEO1VBQ0QsT0FBTztRQUNUO1FBRUEsSUFBSSxDQUFDLGtCQUFrQixNQUFNLEVBQUU7VUFDN0IsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztVQUM5QztRQUNGO1FBRUEsT0FBTyxXQUFXLFdBQVcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsRUFBRTtRQUUxRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLEtBQUssUUFBUSxDQUFDO1FBRXRELE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxZQUFZO1VBQ2pELFVBQVUsV0FBVyxRQUFRO1VBQzdCLFFBQVEsaUJBQWlCLENBQUMsRUFBRTtVQUM1QixJQUFJO1lBQUUsVUFBVTtVQUFnQjtRQUNsQztNQUNGO0VBQ0Y7RUFDQSxTQUFTO0lBQ1AsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLHlCQUF5QixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztVQUNsRixVQUFVLFdBQVcsUUFBUTtVQUM3QixRQUFRLENBQUMsV0FBVyxDQUFDO1VBQ3JCLFVBQVUsV0FBVyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxXQUFXLFFBQVE7VUFDckYsT0FBTztZQUNMLE1BQU07WUFDTixPQUFPLFdBQVcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsV0FBVyxRQUFRLEVBQUUsTUFBTTtVQUM1RjtVQUNBLFVBQVU7UUFDWjtRQUVBLElBQUksT0FBTztVQUFFLFVBQVU7VUFBRyxRQUFRO1FBQUU7UUFDcEMsSUFBSSxDQUFDLHVCQUF1QixNQUFNLEVBQUU7VUFDbEMsT0FBTztZQUFFLFVBQVU7WUFBRyxRQUFRO1VBQUU7UUFDbEMsT0FDSztVQUNILEtBQUssTUFBTSxVQUFVLHVCQUF3QjtZQUMzQyxNQUFNLE9BQU8sV0FBVyxXQUFXLENBQUMsT0FBTyxDQUFDO1lBQzVDLE1BQU0sRUFBRSxNQUFNLFFBQVEsRUFBRSxHQUFHLFdBQVcsbUJBQW1CLENBQUMsVUFBVSxDQUFDLE1BQU07Y0FDekUsVUFBVSxXQUFXLFFBQVE7WUFDL0I7WUFDQSxPQUFPO2NBQ0wsVUFBVSxLQUFLLFFBQVEsR0FBRyxTQUFTLFFBQVE7Y0FDM0MsUUFBUSxLQUFLLE1BQU0sR0FBRyxDQUFDLFNBQVMsTUFBTSxJQUFJLENBQUM7WUFDN0M7WUFFQSxNQUFNLFdBQVcscUJBQXFCLENBQUMsYUFBYTtjQUFFLFVBQVUsV0FBVyxRQUFRO2NBQUU7WUFBTztVQUM5RjtRQUNGO1FBRUEsTUFBTSxrQkFBa0IsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFDM0UsVUFBVSxXQUFXLFFBQVE7VUFDN0IsUUFBUSxDQUFDLFNBQVMsQ0FBQztVQUNuQixVQUFVO1lBQ1I7Y0FBRSxVQUFVO2dCQUFDO2dCQUFlO2VBQWdCO1lBQUM7WUFDN0M7Y0FDRSxNQUFNO2NBQ04sUUFBUTtnQkFBRSxVQUFVLEtBQUssUUFBUTtnQkFBRSxRQUFRO2NBQUU7Y0FDN0MsVUFBVSxXQUFXLFFBQVE7WUFDL0I7V0FDRDtVQUNELE9BQU87UUFDVDtRQUVBLElBQUksZ0JBQWdCLE1BQU0sS0FBSyxHQUFHO1VBQ2hDLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLENBQUM7VUFDN0M7UUFDRjtRQUVBLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxZQUFZO1VBQ2pELFVBQVUsV0FBVyxRQUFRO1VBQzdCLFFBQVEsZUFBZSxDQUFDLEVBQUU7VUFDMUIsSUFBSTtZQUFFLFVBQVU7VUFBZ0I7UUFDbEM7TUFDRjtFQUNGO0VBQ0EsZ0JBQWdCO0lBQ2QsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixRQUFRLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxHQUN2QyxDQUFDLE1BQU0sS0FBSyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sVUFBVSxDQUFDLEVBQUUsS0FBSyxDQUFDO1lBQ3RELE9BQU8sWUFBWSxPQUFPLENBQUMsUUFBUSxPQUFPLEtBQUssWUFDN0MsTUFBTSxLQUFLLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEtBQUs7VUFDakQ7TUFDSixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZGQUE2RixDQUFDO1FBQzNHLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxXQUFXLFFBQVE7UUFBQztRQUNuRixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUNoRSxNQUFNLFdBQVcscUJBQXFCLENBQUMsV0FBVztVQUFFLE9BQU87UUFBRTtRQUM3RCxNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO01BQ3BFO0VBQ0Y7RUFDQSxTQUFTO0lBQ1AsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sRUFBRSxVQUFVLE1BQU0sQ0FBQyxXQUFXLENBQUM7UUFDL0U7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBRWxFLFdBQVcsZUFBZSxDQUFDLHdCQUF3QixDQUFDO1VBQ2xELElBQUksQ0FBQyxNQUFNLEVBQUUsV0FBVyxNQUFNLENBQUMsV0FBVyxDQUFDO1VBQzNDLGNBQWM7VUFDZCxZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLE1BQU07VUFDTixXQUFXLENBQUM7WUFDVixJQUFJLGNBQWMsS0FBSyxDQUFDLFVBQVUsS0FDaEMsY0FBYyxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsWUFBWSxPQUFPO1lBRS9GLElBQUksQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU87WUFFL0MsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLFdBQVcsUUFBUSxFQUFFLE9BQU87WUFFeEUsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU87WUFDeEIsTUFBTSxjQUFjLFdBQVcsU0FBUyxDQUFDO2NBQ3ZDO2dCQUFFLFVBQVU7Y0FBYztjQUMxQjtnQkFBRSxVQUFVO2NBQU87YUFDcEI7WUFFRCxJQUFJLENBQUMsWUFBWSxNQUFNLEVBQUU7Y0FDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQywwQ0FBMEMsQ0FBQztjQUN4RDtZQUNGO1lBRUEsTUFBTSxvQkFBb0IscUJBQXFCLENBQUMsWUFBWTtjQUMxRCxVQUFVLFdBQVcsUUFBUTtjQUM3QixRQUFRLFlBQVksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO2NBQ25DLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztVQUNGO1VBQ0EsVUFBVSxXQUFXLFFBQVE7UUFDL0I7TUFDRjtFQUNGO0VBQ0EsY0FBYztJQUNaLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsSUFBSSxXQUFXLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLFdBQVcsUUFBUSxFQUFFLE1BQU0sS0FBSyxHQUFHO1VBQzdGLFFBQVEsR0FBRyxDQUFDLENBQUMsb0NBQW9DLENBQUM7UUFDcEQsT0FDSztVQUNILE1BQU0sa0JBQWtCLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxjQUFjO1lBQzNFLFVBQVUsV0FBVyxRQUFRO1lBQzdCLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFDcEIsVUFBVSxXQUFXLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLFdBQVcsUUFBUTtZQUNyRixPQUFPO1VBQ1Q7VUFFQSxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQUUsRUFBRTtZQUN2QixRQUFRLElBQUksQ0FBQyxDQUFDLDZDQUE2QyxDQUFDO1VBQzlELE9BQ0s7WUFDSCxNQUFNLFdBQVcscUJBQXFCLENBQUMsYUFBYTtjQUNsRCxVQUFVLFdBQVcsUUFBUTtjQUM3QixRQUFRLGVBQWUsQ0FBQyxFQUFFO1lBQzVCO1VBQ0Y7UUFDRjtRQUVBLE1BQU0sU0FBUyxNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztVQUNsRSxRQUFRO1VBQ1IsVUFBVSxXQUFXLFFBQVE7VUFDN0IsZUFBZTtZQUNiO2NBQUUsT0FBTztjQUFlLFFBQVE7WUFBRTtZQUNsQztjQUFFLE9BQU87Y0FBb0IsUUFBUTtZQUFFO1dBQ3hDO1FBQ0g7UUFFQSxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7VUFDdkIsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGdCQUFnQjtZQUFFLE9BQU87VUFBRTtRQUNwRSxPQUNLO1VBQ0gsTUFBTSxPQUFPLFdBQVcsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsV0FBVyxRQUFRO1VBQ3hGLElBQUksc0JBQWlDLEVBQUU7VUFDdkMsTUFBTSxJQUFJLEtBQUssTUFBTSxHQUFHO1VBQ3hCLElBQUssSUFBSSxJQUFJLEdBQUcsS0FBSyxHQUFHLElBQUs7WUFDM0IsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7Y0FDbkQsUUFBUSxJQUFJLENBQUMsRUFBRTtjQUNmLFVBQVUsV0FBVyxRQUFRO1lBQy9CO1lBQ0EsTUFBTSxPQUFPLFdBQVcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNuRCxvQkFBb0IsSUFBSSxDQUFDLEtBQUssT0FBTztVQUN2QztVQUNBLHNCQUFzQixNQUFNLElBQUksQ0FBQyxJQUFJLElBQUk7VUFDekMsTUFBTSxXQUFXLHFCQUFxQixDQUFDLG9CQUFvQjtZQUN6RCxVQUFVLFdBQVcsUUFBUTtZQUM3QixPQUFPLG9CQUFvQixNQUFNO1VBQ25DO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsZUFBZTtJQUNiLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxrREFBa0QsQ0FBQztRQUVoRSxNQUFNLGtCQUFrQixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztVQUMzRSxVQUFVLFdBQVcsUUFBUTtVQUM3QixRQUFRLENBQUMsYUFBYSxDQUFDO1VBQ3ZCLFVBQVU7WUFDUjtjQUFFLFVBQVU7Y0FBYyxVQUFVLFdBQVcsUUFBUTtZQUFDO1lBQ3hEO2NBQUUsVUFBVTtZQUFTO1dBQ3RCO1VBQ0QsT0FBTztVQUNQLFVBQVU7UUFDWjtRQUVBLE1BQU0saUJBQWlCLGVBQWUsQ0FBQyxFQUFFO1FBRXpDLElBQUksQ0FBQyxnQkFBZ0I7VUFDbkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQztVQUNuRDtRQUNGO1FBRUEsTUFBTSxlQUFlLFdBQVcsV0FBVyxDQUFDLE9BQU8sQ0FBQztRQUVwRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLGNBQWM7UUFFM0QsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztVQUMxQixNQUFNLFdBQVcscUJBQXFCLENBQUMsWUFBWTtZQUNqRCxVQUFVLFdBQVcsUUFBUTtZQUM3QixRQUFRO1lBQ1IsV0FBVztjQUNULFlBQVk7WUFDZDtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsV0FBVztJQUNULGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsQ0FBQztRQUM3QyxNQUFNLE9BQU8sV0FBVyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxXQUFXLFFBQVE7UUFDeEYsSUFBSSxvQkFBb0I7UUFDeEIsSUFBSyxJQUFJLElBQUksS0FBSyxNQUFNLEdBQUcsR0FBRyxLQUFLLEdBQUcsSUFBSztVQUN6QyxNQUFNLE9BQU8sV0FBVyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1VBQ25ELHFCQUFxQixLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxJQUFJO1VBQzFELE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxjQUFjO1lBQ25ELFFBQVEsSUFBSSxDQUFDLEVBQUU7WUFDZixVQUFVLFdBQVcsUUFBUTtVQUMvQjtRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0Isa0JBQWtCLENBQUM7UUFFckUsTUFBTSxXQUFXLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLFdBQVcsUUFBUTtVQUFFLE9BQU87UUFBa0I7TUFDL0c7RUFDRjtFQUNBLFFBQVE7SUFDTiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLFVBQVUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLEVBQUUsRUFBRSxRQUFRLEVBQUU7VUFDbkYsTUFBTSxjQUFjLGVBQWUsS0FBSyxTQUFTO1VBQ2pELE1BQU0sdUJBQXVCLFlBQzFCLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQ2pDLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQ3BCLE1BQU0sS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLFFBQVEsS0FBSztVQUdsRCxJQUFJLHFCQUFxQixNQUFNLEtBQUssR0FBRztZQUNyQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHNEQUFzRCxDQUFDO1lBQ3BFO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLHFCQUFxQixNQUFNLENBQUMsNEJBQTRCLENBQUM7VUFDakcsSUFBSyxJQUFJLElBQUkscUJBQXFCLE1BQU0sR0FBRyxHQUFHLEtBQUssR0FBRyxJQUFLO1lBQ3pELE1BQU0sc0JBQXNCLGFBQWE7Y0FDdkM7Y0FDQSxRQUFRLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ3BDO1VBQ0Y7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sT0FBTyxXQUFXLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLFdBQVcsUUFBUTtRQUN4RixNQUFNLFlBQVksS0FBSyxHQUFHLENBQUMsV0FBVyxXQUFXLENBQUMsT0FBTztRQUN6RCxNQUFNLGtCQUFrQixVQUFVLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBRXBFLElBQUksZ0JBQWdCLE1BQU0sS0FBSyxHQUFHO1VBQ2hDLFFBQVEsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUM7VUFDaEQ7UUFDRjtRQUVBLE1BQU0sc0JBQXNCLElBQUksSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLE9BQU8sR0FBRyxJQUFJO1FBRW5GLElBQUksZUFBaUM7UUFFckMsSUFBSSx3QkFBd0IsR0FBRztVQUM3QixlQUFlLGVBQWUsQ0FBQyxFQUFFO1FBQ25DLE9BQ0s7VUFDSCxNQUFNLGtCQUFrQixNQUFNLFdBQVcscUJBQXFCLENBQUMsY0FBYztZQUMzRSxVQUFVLFdBQVcsUUFBUTtZQUM3QixRQUFRLENBQUMsV0FBVyxDQUFDO1lBQ3JCLFVBQVUsV0FBVyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxXQUFXLFFBQVE7WUFDckYsT0FBTztVQUNUO1VBRUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUU7WUFDdkIsUUFBUSxJQUFJLENBQUMsQ0FBQyx3Q0FBd0MsQ0FBQztZQUN2RDtVQUNGO1VBRUEsZUFBZSxXQUFXLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFDbEU7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGNBQWM7UUFFMUQsTUFBTSxXQUFXLHFCQUFxQixDQUFDLGNBQWM7VUFDbkQsUUFBUSxhQUFhLEVBQUU7VUFDdkIsVUFBVSxXQUFXLFFBQVE7UUFDL0I7UUFFQSxNQUFNLGdCQUFnQixXQUFXLFNBQVMsQ0FBQztVQUN6QztZQUFFLFVBQVUsYUFBYSxPQUFPLEdBQUcsZ0JBQWdCO1VBQWdCO1VBQ25FO1lBQUUsVUFBVSxhQUFhLE9BQU87VUFBQztTQUNsQztRQUVELElBQUksY0FBYyxNQUFNLEtBQUssR0FBRztVQUM5QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixFQUFFLGFBQWEsVUFBVSxDQUFDO1VBQ2xFO1FBQ0Y7UUFFQSxNQUFNLFdBQVcscUJBQXFCLENBQUMsWUFBWTtVQUNqRCxVQUFVLFdBQVcsUUFBUTtVQUM3QixRQUFRLGNBQWMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1VBQ3JDLElBQUk7WUFBRSxVQUFVO1VBQWdCO1FBQ2xDO01BQ0Y7RUFDRjtFQUNBLFlBQVk7SUFDVixpQkFBaUIsSUFBTSxPQUFPLEVBQUUsUUFBUSxFQUFFLHFCQUFxQixFQUFFO1FBQy9ELFFBQVEsR0FBRyxDQUFDLENBQUMseURBQXlELENBQUM7UUFDdkUsTUFBTSxzQkFBc0IsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBQ3ZELE1BQU0sc0JBQXNCLG9CQUFvQjtVQUFFO1VBQVUsT0FBTztRQUFFO01BQ3ZFO0VBQ0Y7RUFDQSxXQUFXO0lBQ1QsaUJBQWlCLElBQU0sT0FBTyxFQUFFLHFCQUFxQixFQUFFLFFBQVEsRUFBRTtRQUMvRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLHlFQUF5RSxDQUFDO1FBQ3ZGLE1BQU0sc0JBQXNCLFlBQVk7VUFBRTtRQUFTO1FBQ25ELE1BQU0sc0JBQXNCLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFDckQsTUFBTSxzQkFBc0IsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO01BQ3pEO0VBQ0Y7RUFDQSxZQUFZO0lBQ1YsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFdBQVcscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO01BQ3BFO0VBQ0Y7RUFDQSxVQUFVO0lBQ1IsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGtDQUFrQyxDQUFDO1FBQ2hELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFdEUsTUFBTSxjQUFjLGVBQWUsU0FBUyxDQUFDO1VBQUUsVUFBVTtRQUFTO1FBRWxFLE1BQU0sU0FBeUIsRUFBRTtRQUNqQyxLQUFLLE1BQU0sY0FBYyxZQUFhO1VBQ3BDLE1BQU0sT0FBc0IsSUFBTSxDQUFDO2NBQUUsWUFBWTtjQUFPLE1BQU07Z0JBQUUsVUFBVSxDQUFDO2NBQUU7WUFBRSxDQUFDO1VBQ2hGLE1BQU0sUUFBUSxlQUFlLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxZQUFZO1VBQzFFLE9BQU8sSUFBSSxDQUFDO1FBQ2Q7UUFFQSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztVQUN0RCxJQUFJLENBQUMsUUFBUSxFQUFFLGVBQWUsTUFBTSxDQUFDLFFBQVEsQ0FBQztVQUM5QyxVQUFVLGVBQWUsUUFBUTtVQUNqQyxNQUFNO1VBQ04sd0JBQXdCO1VBQ3hCLFlBQVk7VUFDWixjQUFjO1VBQ2QsV0FBVyxJQUFNO1VBQ2pCLG1CQUFtQjtZQUNqQixPQUFPLE9BQU8sQ0FBQyxDQUFBLElBQUs7VUFDdEI7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxVQUFVO0lBQ1IsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixDQUFDO1FBRTdDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7VUFBRSxPQUFPO1FBQUU7UUFFckcsTUFBTSxrQkFBa0IsbUJBQW1CO1VBQ3pDLE9BQU8sZUFBZSxLQUFLO1VBQzNCLFdBQVc7VUFDWCxrQkFBa0IsZUFBZSxRQUFRO1FBQzNDLEdBQUcsTUFBTSxDQUFDLENBQUEsV0FBWSxlQUFlLGVBQWUsRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXO1FBRTdFLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sUUFBUSxlQUFlLEtBQUs7VUFDbEMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsSUFBSSxLQUFLLE1BQU0sR0FBRyxHQUFHO1lBQ25CLFFBQVEsR0FBRyxDQUFDLENBQUMsZ0JBQWdCLEVBQUUsZUFBZSx5Q0FBeUMsQ0FBQztZQUN4RixNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUFFLFVBQVU7WUFBZTtVQUN2RjtVQUVBLElBQUksS0FBSyxNQUFNLEtBQUssR0FBRztZQUNyQixRQUFRLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixFQUFFLGVBQWUscUJBQXFCLENBQUM7WUFDcEU7VUFDRjtVQUVBLE1BQU0sY0FBYyxLQUFLLEdBQUcsQ0FBQyxHQUFHLEtBQUssTUFBTTtVQUUzQyxNQUFNLG1CQUEyQixFQUFFO1VBRW5DLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxhQUFhLElBQUs7WUFDcEMsTUFBTSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDaEMsTUFBTSxPQUFPLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQztZQUNoRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN2RDtjQUNBLFVBQVU7Y0FDVixnQkFBZ0I7WUFDbEI7WUFFQSxJQUFJLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhO2NBQ2xFLFFBQVEsR0FBRyxDQUFDLENBQUMsdURBQXVELENBQUM7Y0FDckUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Z0JBQUU7Z0JBQVEsVUFBVTtjQUFlO1lBQy9GLE9BQ0s7Y0FDSCxpQkFBaUIsSUFBSSxDQUFDO1lBQ3hCO1VBQ0Y7VUFFQSxJQUFJLGlCQUFpQixNQUFNLEtBQUssR0FBRztZQUNqQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHFDQUFxQyxDQUFDO1lBQ25EO1VBQ0Y7VUFFQSxJQUFJLGlCQUFpQixNQUFNLEtBQUssR0FBRztZQUNqQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdEQUF3RCxDQUFDO1lBQ3RFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2NBQ3JELFFBQVEsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLEVBQUU7Y0FDOUIsWUFBWTtjQUNaLElBQUk7Z0JBQUUsVUFBVTtjQUFhO1lBQy9CO1VBQ0YsT0FDSztZQUNILE1BQU0sU0FBUyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztjQUN0RSxRQUFRO2NBQ1IsVUFBVTtjQUNWLGVBQWU7Z0JBQ2I7a0JBQUUsT0FBTztrQkFBUSxRQUFRO2dCQUFFO2VBQzVCO2NBQ0QsU0FBUztnQkFDUCxNQUFNO2dCQUNOLFNBQVMsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2NBQy9DO1lBQ0Y7WUFFQSxLQUFLLE1BQU0sVUFBVSxPQUFPLE1BQU0sQ0FBRTtjQUNsQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtnQkFDckQ7Z0JBQ0EsWUFBWTtnQkFDWixJQUFJO2tCQUFFLFVBQVU7Z0JBQWE7Y0FDL0I7WUFDRjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsU0FBUztJQUNQLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQztRQUMxQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsV0FBVztVQUFFLE9BQU87UUFBRTtRQUVqRSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztVQUN0RCxJQUFJLENBQUMsTUFBTSxFQUFFLGVBQWUsTUFBTSxDQUFDLFdBQVcsQ0FBQztVQUMvQyxVQUFVLGVBQWUsUUFBUTtVQUNqQyxjQUFjO1VBQ2QsTUFBTTtVQUNOLHdCQUF3QjtVQUN4QixZQUFZO1VBQ1osV0FBVyxDQUFDLGdCQUFrQixjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUTtVQUM3RixtQkFBbUIsT0FBTztZQUN4QixNQUFNLE9BQU8sa0JBQWtCLFdBQVcsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUV4RixRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxFQUFFLEtBQUssUUFBUSxDQUFDO1lBRTlELE1BQU0sa0JBQWtCLHFCQUFxQixDQUFDLFlBQVk7Y0FDeEQsUUFBUSxLQUFLLEVBQUU7Y0FDZixZQUFZLGVBQWUsUUFBUTtjQUNuQyxJQUFJO2dCQUFFLFVBQVU7Y0FBYTtZQUMvQjtVQUNGO1FBQ0Y7UUFFQSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztVQUN0RCxJQUFJLENBQUMsTUFBTSxFQUFFLGVBQWUsTUFBTSxDQUFDLFFBQVEsQ0FBQztVQUM1QyxVQUFVLGVBQWUsUUFBUTtVQUNqQyxjQUFjO1VBQ2QsTUFBTTtVQUNOLHdCQUF3QjtVQUN4QixZQUFZO1VBQ1osV0FBVyxJQUFNO1VBQ2pCLG1CQUFtQixPQUFPO1lBQ3hCLGVBQWUsZUFBZSxDQUFDLGlCQUFpQixDQUFDLENBQUMsTUFBTSxFQUFFLGVBQWUsTUFBTSxDQUFDLFdBQVcsQ0FBQztZQUM1RixlQUFlLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0sRUFBRSxlQUFlLE1BQU0sQ0FBQyxRQUFRLENBQUM7VUFDM0Y7UUFDRjtRQUVBLE1BQU0sVUFBVSxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUNuRyxNQUFNLFlBQVksUUFBUSxHQUFHLENBQUMsZUFBZSxXQUFXLENBQUMsT0FBTztRQUNoRSxNQUFNLGdCQUFnQixVQUFVLE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ2xFLElBQUksY0FBYyxNQUFNLEtBQUssR0FBRztVQUM5QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHdDQUF3QyxDQUFDO1VBQ3REO1FBQ0Y7UUFFQSxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsYUFBYSxDQUFDO1VBQ3ZCLFVBQVU7WUFDUjtjQUFFLFVBQVU7Y0FBYyxVQUFVLGVBQWUsUUFBUTtZQUFDO1lBQzVEO2NBQUUsVUFBVTtZQUFXO1dBQ3hCO1VBQ0QsT0FBTztVQUNQLFVBQVU7UUFDWjtRQUVBLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxFQUFFO1VBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsd0NBQXdDLENBQUM7VUFDdEQ7UUFDRjtRQUVBLE1BQU0saUJBQWlCLGVBQWUsQ0FBQyxFQUFFO1FBQ3pDLE1BQU0sZUFBZSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUM7UUFFeEQsUUFBUSxHQUFHLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSxhQUFhLE1BQU0sQ0FBQztRQUUxRCxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksR0FBRyxJQUFLO1VBQzFCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFFBQVE7WUFDUixVQUFVLGVBQWUsUUFBUTtZQUNqQyxXQUFXO2NBQ1QsWUFBWTtZQUNkO1VBQ0Y7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxTQUFTO0lBQ1AsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixDQUFDO1FBQzVDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7VUFBRSxPQUFPO1FBQUU7UUFFckcsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLGFBQWEsQ0FBQztVQUN2QixVQUFVLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1VBQzdGLE9BQU87WUFDTCxNQUFNO1lBQ04sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUSxFQUFFLE1BQU07VUFDcEc7UUFDRjtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMsZ0NBQWdDLENBQUM7VUFDOUM7UUFDRjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMEJBQTBCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFFdkUsS0FBSyxNQUFNLFVBQVUsZ0JBQWlCO1VBQ3BDLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO1lBQUU7WUFBUSxVQUFVLGVBQWUsUUFBUTtVQUFDO1FBQ3hHO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSxnQkFBZ0IsTUFBTSxDQUFDLFNBQVMsQ0FBQztRQUN2RSxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTyxnQkFBZ0IsTUFBTTtRQUFDO1FBRTNGLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLGVBQWUsS0FBSztVQUMzQixXQUFXO1VBQ1gsa0JBQWtCLGVBQWUsUUFBUTtRQUMzQztRQUVBLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1VBQzVDLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjO1VBQ3pFLElBQUksQ0FBQyxLQUFLLE1BQU0sRUFBRTtZQUNoQixRQUFRLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRSxlQUFlLHFCQUFxQixDQUFDO1lBQ25FO1VBQ0Y7VUFFQSxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUMvRSxVQUFVO1lBQ1YsUUFBUSxDQUFDLE9BQU8sRUFBRSxLQUFLLE1BQU0sR0FBRyxJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUM7WUFDdEQsVUFBVSxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtZQUM3RixPQUFPLEtBQUssR0FBRyxDQUFDLEdBQUcsS0FBSyxNQUFNO1lBQzlCLFVBQVU7VUFDWjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsMEJBQTBCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFDdkUsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7WUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsUUFBUTtjQUNSLFVBQVU7WUFDWjtVQUNGO1VBRUEsSUFBSSxnQkFBZ0IsTUFBTSxLQUFLLEdBQUc7WUFDaEMsUUFBUSxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQUUsZUFBZSwrQkFBK0IsRUFBRSxnQkFBZ0IsTUFBTSxFQUFFO1lBQ3RHO1VBQ0Y7VUFFQSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUFFLFVBQVU7VUFBZTtRQUNwRjtNQUNGO0VBQ0Y7RUFDQSxhQUFhO0lBQ1gsaUJBQWlCO01BQ2YsTUFBTSxtQkFBOEMsQ0FBQztNQUVyRCxPQUFPLE9BQU87UUFDWixNQUFNLGFBQWEsc0JBQXNCO1VBQ3ZDLGNBQWMsZUFBZSxLQUFLLENBQUMsc0JBQXNCO1VBQ3pELE9BQU8sZUFBZSxLQUFLO1VBQzNCLFVBQVU7UUFDWjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsV0FBVyxlQUFlLENBQUM7UUFFdkUsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsUUFBUTtVQUNSLFVBQVUsV0FBVyxFQUFFO1VBQ3ZCLFNBQVM7WUFDUCxNQUFNO1VBQ1I7UUFDRjtRQUVBLE1BQU0sVUFBVSxnQkFBZ0IsTUFBTTtRQUV0QyxnQkFBZ0IsQ0FBQyxlQUFlLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFO1FBQ3hELGdCQUFnQixDQUFDLGVBQWUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUV2RCxNQUFNLFVBQVUsZUFBZSxTQUFTLENBQUM7VUFDdkM7WUFBRSxVQUFVO2NBQUM7Y0FBZTthQUFnQjtVQUFDO1VBQzdDO1lBQUUsTUFBTTtZQUFRLFFBQVE7Y0FBRSxVQUFVO1lBQUU7WUFBRyxVQUFVLGVBQWUsUUFBUTtVQUFDO1NBQzVFLEVBQ0UsTUFBTSxDQUFDLENBQUEsT0FBUSxDQUFDLGdCQUFnQixDQUFDLGVBQWUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLE9BQU8sR0FDdkYsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7UUFFdEIsSUFBSSxDQUFDLFFBQVEsTUFBTSxFQUFFO1VBQ25CLFFBQVEsR0FBRyxDQUFDLENBQUMsaUNBQWlDLENBQUM7VUFDL0M7UUFDRjtRQUVBLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQy9FLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsQ0FBQyxXQUFXLENBQUM7VUFDckIsVUFBVTtVQUNWLE9BQU87UUFDVDtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsSUFBSSxDQUFDLENBQUMsbUNBQW1DLENBQUM7VUFDbEQ7UUFDRjtRQUVBLE1BQU0saUJBQWlCLGVBQWUsQ0FBQyxFQUFFO1FBQ3pDLE1BQU0sZUFBZSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUM7UUFFeEQsUUFBUSxHQUFHLENBQUMsQ0FBQywyQkFBMkIsRUFBRSxjQUFjO1FBRXhELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVE7VUFDUixJQUFJO1lBQUUsVUFBVTtVQUFnQjtRQUNsQztNQUNGO0lBQ0Y7RUFDRjtFQUNBLGNBQWM7SUFDWiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLEtBQUssZUFBZSxDQUFDLGlCQUFpQixDQUFDLENBQUMsV0FBVyxFQUFFLFVBQVUsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUNwRjtRQUNBLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLEtBQUssZUFBZSxDQUFDLHdCQUF3QixDQUFDO1lBQzVDLElBQUksQ0FBQyxXQUFXLEVBQUUsVUFBVSxNQUFNLENBQUMsV0FBVyxDQUFDO1lBQy9DLFVBQVUsVUFBVSxRQUFRO1lBQzVCLE1BQU07WUFDTixZQUFZO1lBQ1osd0JBQXdCO1lBQ3hCLGNBQWM7WUFDZCxXQUFXLENBQUM7Y0FDVixJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEtBQUssVUFBVSxRQUFRLEVBQUUsT0FBTztjQUN2RSxPQUFPO1lBQ1Q7WUFDQSxtQkFBbUIsT0FBTztjQUN4QixNQUFNLE9BQU8sa0JBQWtCLFdBQVcsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtjQUN4RixNQUFNLGtCQUFrQixxQkFBcUIsQ0FBQyxjQUFjO2dCQUMxRCxRQUFRLFVBQVUsTUFBTTtnQkFDeEIsVUFBVSxVQUFVLFFBQVE7Y0FDOUI7Y0FFQSxNQUFNLFNBQVMsTUFBTSxrQkFBa0IscUJBQXFCLENBQUMsY0FBYztnQkFDekUsUUFBUSxDQUFDLGtCQUFrQixFQUFFLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDN0MsVUFBVSxVQUFVLFFBQVE7Z0JBQzVCLGVBQWU7a0JBQ2I7b0JBQUUsT0FBTztvQkFBUyxRQUFRO2tCQUFFO2tCQUM1QjtvQkFBRSxPQUFPO29CQUFZLFFBQVE7a0JBQUU7aUJBQ2hDO2NBQ0g7Y0FFQSxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7Z0JBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsb0RBQW9ELEVBQUUsTUFBTTtnQkFDekUsTUFBTSxrQkFBa0IscUJBQXFCLENBQUMsYUFBYTtrQkFDekQsVUFBVSxVQUFVLFFBQVE7a0JBQzVCLFFBQVEsS0FBSyxFQUFFO2dCQUNqQjtjQUNGLE9BQ0s7Z0JBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyx1REFBdUQsRUFBRSxNQUFNO2dCQUM1RSxNQUFNLGtCQUFrQixxQkFBcUIsQ0FBQyxZQUFZO2tCQUN4RCxRQUFRLEtBQUssRUFBRTtrQkFDZixZQUFZLFVBQVUsUUFBUTtrQkFDOUIsSUFBSTtvQkFBRSxVQUFVO2tCQUFhO2dCQUMvQjtjQUNGO1lBQ0Y7VUFDRjtRQUNGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBQ2hHLE1BQU0sWUFBWSxJQUFJLEtBQUssTUFBTTtRQUVqQyxJQUFJLFlBQVksR0FBRztVQUNqQixRQUFRLEdBQUcsQ0FBQyxDQUFDLCtDQUErQyxDQUFDO1VBQzdEO1FBQ0Y7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLFVBQVUsTUFBTSxDQUFDO1FBRTVELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE9BQU8sS0FBSyxNQUFNLEdBQUc7UUFDdkI7TUFDRjtFQUNGO0VBQ0EsbUJBQW1CO0lBQ2pCLGlCQUFpQixJQUFNLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxRQUFRLEVBQUU7UUFDL0QsUUFBUSxHQUFHLENBQUMsQ0FBQyw2RUFBNkUsQ0FBQztRQUMzRixNQUFNLHNCQUFzQixZQUFZO1VBQUU7UUFBUztRQUNuRCxNQUFNLHNCQUFzQixjQUFjO1VBQUUsT0FBTztRQUFFO1FBQ3JELE1BQU0sc0JBQXNCLFdBQVc7VUFBRSxPQUFPO1FBQUU7TUFDcEQ7RUFDRjtBQUNGO0FBRUEsZUFBZSxVQUFVIn0=
// denoCacheMetadata=8324268011418628458,15122030638813051350