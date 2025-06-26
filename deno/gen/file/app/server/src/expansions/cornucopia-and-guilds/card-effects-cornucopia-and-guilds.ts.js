import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
const expansion = {
  'advisor': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[advisor effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const cardsRevealed = [];
        console.log(`[advisor effect] revealing 3 cards`);
        for(let i = 0; i < 3; i++){
          if (deck.length === 0) {
            console.log(`[advisor effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
            if (deck.length === 0) {
              console.log(`[advisor effect] no cards in deck after shuffling`);
              break;
            }
          }
          const cardId = deck.slice(-1)[0];
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          cardsRevealed.push(card);
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId,
            playerId: cardEffectArgs.playerId,
            moveToSetAside: true
          });
        }
        const leftPlayer = getPlayerStartingFrom({
          startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
          match: cardEffectArgs.match,
          distance: 1
        });
        console.log(`[advisor effect] player ${leftPlayer} choosing card to discard`);
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: `Choose one for ${getPlayerById(cardEffectArgs.match, cardEffectArgs.playerId)?.name} to discard`,
          playerId: leftPlayer.id,
          content: {
            type: 'select',
            cardIds: cardsRevealed.map((card)=>card.id),
            selectCount: 1
          }
        });
        const cardId = result.result[0];
        if (!cardId) {
          console.warn(`[advisor effect] no card selected`);
        } else {
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          console.log(`[advisor effect] player ${cardEffectArgs.playerId} discarding ${card}`);
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId,
            playerId: cardEffectArgs.playerId
          });
        }
        const toMoveToHand = cardsRevealed.filter((card)=>card.id !== cardId);
        console.log(`[advisor effect] moving ${toMoveToHand.length} cards to hand`);
        for (const card of toMoveToHand){
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
  'baker': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: 1
        });
      }
  },
  'butcher': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[butcher effect] gaining 2 coffers`);
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card?`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[butcher effect] no card selected`);
          return;
        }
        let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
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
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: {
              treasure: cost.treasure + (cardEffectArgs.match.coffers[cardEffectArgs.playerId] ?? 0),
              potion: cost.potion
            }
          }
        ]);
        if (!cards.length) {
          console.log(`[butcher effect] no cards in supply that match cost`);
          return;
        }
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[butcher effect] no card selected`);
          return;
        }
        selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        const { cost: selectedCardCost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId
        });
        console.log(`[butcher effect] gaining ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
        if (selectedCardCost.treasure - cost.treasure > 0) {
          console.log(`[butcher effect] spending ${selectedCardCost.treasure - cost.treasure} coffers`);
          await cardEffectArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: -(selectedCardCost.treasure - cost.treasure)
          });
        }
      }
  },
  'candlestick-maker': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[candlestick maker effect] gaining 1 action, 1 buy, and 1 coffer`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: 1
        });
      }
  },
  'carnival': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const cardsToKeep = [];
        const cardsToDiscard = [];
        for(let i = 0; i < 4; i++){
          if (deck.length === 0) {
            console.log(`[carnival effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
            if (deck.length === 0) {
              console.log(`[carnival effect] no cards in deck after shuffling`);
              break;
            }
          }
          const revealedCardId = deck.slice(-1)[0];
          const revealedCard = cardEffectArgs.cardLibrary.getCard(revealedCardId);
          console.log(`[carnival effect] revealing ${revealedCard}`);
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: revealedCardId,
            playerId: cardEffectArgs.playerId,
            moveToSetAside: true
          });
          if (!cardsToKeep.find((card)=>card.cardKey === revealedCard.cardKey)) {
            console.log(`[carnival effect] adding ${revealedCard} to keep`);
            cardsToKeep.push(revealedCard);
          } else {
            console.log(`[carnival effect] adding ${revealedCard} to discard`);
            cardsToDiscard.push(revealedCard);
          }
        }
        console.log(`[carnival effect] discarding ${cardsToDiscard.length} cards`);
        for (const card of cardsToDiscard){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId
          });
        }
        console.log(`[carnival effect] moving ${cardsToKeep.length} cards to hand`);
        for (const card of cardsToKeep){
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
  'coronet': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const handCards = cardEffectArgs.findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId
        });
        const cardSources = [
          handCards.filter((card)=>!card.type.includes('REWARD') && card.type.includes('ACTION')),
          handCards.filter((card)=>!card.type.includes('REWARD') && card.type.includes('TREASURE'))
        ];
        for(let i = 0; i < 2; i++){
          console.log(`[coronet effect] processing ${i === 0 ? 'non-reward action instruction' : 'non-reward treasure instruction'}`);
          const cardSource = cardSources[i];
          if (cardSource.length === 0) {
            console.log(`[coronet effect] no non-reward action cards in hand`);
            return;
          }
          const uniqueCardNames = Array.from(new Set(cardSource.map((card)=>card.cardName)));
          let selectedCardId = undefined;
          if (uniqueCardNames.length === 1) {
            console.log(`[coronet effect] only one unique card in hand, prompting to play`);
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: `Play ${uniqueCardNames[0]}?`,
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
            if (result.action === 2) {
              selectedCardId = cardSource[0].id;
            }
          } else {
            console.log(`[coronet effect] multiple unique cards in hand, prompting to select`);
            const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Play non-Reward ${i === 0 ? 'Action' : 'Treasure'}?`,
              restrict: cardSource.map((card)=>card.id),
              count: 1,
              optional: true
            });
            if (selectedCardIds.length) {
              selectedCardId = selectedCardIds[0];
            }
          }
          if (!selectedCardId) {
            console.log(`[coronet effect] no card selected`);
            return;
          }
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
          console.log(`[coronet effect] playing ${selectedCard} twice`);
          for(let i = 0; i < 2; i++){
            await cardEffectArgs.runGameActionDelegate('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCardId,
              overrides: {
                actionCost: 0
              }
            });
          }
        }
      }
  },
  'courser': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const actions = [
          {
            label: '+2 Cards',
            action: 1
          },
          {
            label: '+2 Actions',
            action: 2
          },
          {
            label: '+2 Treasure',
            action: 3
          },
          {
            label: 'Gain 4 Silvers',
            action: 4
          }
        ];
        for(let i = 0; i < 2; i++){
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: 'Choose one',
            playerId: cardEffectArgs.playerId,
            actionButtons: actions
          });
          const idx = actions.findIndex((action)=>action.action === result.action);
          if (idx !== -1) {
            actions.splice(idx, 1);
          }
          switch(result.action){
            case 1:
              await cardEffectArgs.runGameActionDelegate('drawCard', {
                playerId: cardEffectArgs.playerId,
                count: 2
              });
              break;
            case 2:
              await cardEffectArgs.runGameActionDelegate('gainAction', {
                count: 2
              });
              break;
            case 3:
              await cardEffectArgs.runGameActionDelegate('gainTreasure', {
                count: 2
              });
              break;
            case 4:
              {
                const silverCardIds = cardEffectArgs.findCards([
                  {
                    location: 'basicSupply'
                  },
                  {
                    cardKeys: 'silver'
                  }
                ]);
                const numToGain = Math.min(4, silverCardIds.length);
                for(let i = 0; i < numToGain; i++){
                  await cardEffectArgs.runGameActionDelegate('gainCard', {
                    playerId: cardEffectArgs.playerId,
                    cardId: silverCardIds.slice(-(i + 1))[0].id,
                    to: {
                      location: 'playerDiscard'
                    }
                  });
                }
                break;
              }
          }
        }
      }
  },
  'demesne': {
    registerScoringFunction: ()=>(args)=>{
        const ownedGoldCards = args.findCards([
          {
            owner: args.ownerId
          }
        ]).filter((card)=>card.cardKey === 'gold');
        return ownedGoldCards.length;
      },
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[demesne effect] gaining 2 actions, and 2 buys`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 2
        });
        const goldCardIds = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'gold'
          }
        ]);
        if (!goldCardIds.length) {
          console.log(`[demesne effect] no gold cards in supply`);
          return;
        }
        const goldCard = cardEffectArgs.cardLibrary.getCard(goldCardIds.slice(-1)[0].id);
        console.log(`[demesne effect] gaining ${goldCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: goldCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'fairgrounds': {
    registerScoringFunction: ()=>(args)=>{
        const cards = args.cardLibrary.getAllCardsAsArray().filter((card)=>card.owner === args.ownerId);
        const uniqueNameCardCount = new Set(cards.map((card)=>card.cardName)).size;
        const score = Math.floor(uniqueNameCardCount / 5);
        return score;
      }
  },
  'farmhands': {
    registerLifeCycleMethods: ()=>({
        onGained: async (cardEffectArgs, eventArgs)=>{
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', eventArgs.playerId);
          const actionTreasureCards = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('ACTION') || card.type.includes('TREASURE'));
          if (actionTreasureCards.length === 0) {
            console.log(`[farmhands effect] no action or treasure cards in hand, not prompting to select`);
            return;
          }
          const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
            prompt: 'Set aside?',
            playerId: eventArgs.playerId,
            optional: true,
            count: 1,
            restrict: [
              {
                location: 'playerHand',
                playerId: eventArgs.playerId
              },
              {
                cardType: [
                  'ACTION',
                  'TREASURE'
                ]
              }
            ]
          });
          if (result.length) {
            const cardId = result[0];
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId,
              toPlayerId: eventArgs.playerId,
              to: {
                location: 'set-aside'
              }
            });
            cardEffectArgs.reactionManager.registerReactionTemplate({
              id: `farmhands:${cardEffectArgs.cardLibrary}:startTurn`,
              listeningFor: 'startTurn',
              condition: (conditionArgs)=>{
                if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
                return true;
              },
              once: true,
              compulsory: true,
              allowMultipleInstances: true,
              playerId: eventArgs.playerId,
              triggeredEffectFn: async (triggerEffectArgs)=>{
                await triggerEffectArgs.runGameActionDelegate('playCard', {
                  playerId: eventArgs.playerId,
                  cardId,
                  overrides: {
                    actionCost: 0
                  }
                });
              }
            });
          } else {
            console.log(`[farmhands effect] player chose not to set aside`);
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[farmhands effect] drawing 1 card, and 2 actions`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
      }
  },
  'farrier': {
    registerLifeCycleMethods: ()=>({
        onGained: async (cardEffectArgs, eventArgs)=>{
          const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
          const overpaid = boughtStats.paid - boughtStats.cost;
          if (!eventArgs.bought || overpaid <= 0) {
            return;
          }
          cardEffectArgs.reactionManager.registerReactionTemplate({
            id: `farrier:${eventArgs.cardId}:endTurn`,
            listeningFor: 'endTurn',
            playerId: eventArgs.playerId,
            once: true,
            allowMultipleInstances: true,
            compulsory: true,
            condition: ()=>true,
            triggeredEffectFn: async (triggerEffectArgs)=>{
              await triggerEffectArgs.runGameActionDelegate('drawCard', {
                playerId: eventArgs.playerId,
                count: overpaid
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[farrier effect] drawing 1 card, gaining 1 action, and 1 buy`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `farrier:${cardEffectArgs.cardId}:endTurn`,
          listeningFor: 'endTurn',
          playerId: cardEffectArgs.playerId,
          allowMultipleInstances: true,
          once: true,
          compulsory: true,
          condition: (conditionArgs)=>true,
          triggeredEffectFn: async (triggerEffectArgs)=>{}
        });
      }
  },
  'ferryman': {
    registerLifeCycleMethods: ()=>({
        onGained: async (cardEffectArgs, eventArgs)=>{
          const cardIds = cardEffectArgs.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              tags: 'ferryman'
            }
          ]);
          if (!cardIds.length) {
            console.log(`[ferryman effect] no ferryman cards in kingdom, can't gain`);
            return;
          }
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: cardIds.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          }, {
            loggingContext: {
              source: eventArgs.cardId
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[ferryman effect] drawing 2 cards, and 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard card`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[ferryman effect] no cards selected`);
          return;
        }
        const selectedCardId = selectedCardIds.slice(-1)[0];
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardId);
        console.log(`[ferryman effect] discarding ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCardId,
          playerId: cardEffectArgs.playerId
        });
      }
  },
  'footpad': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[footpad effect] gaining 2 coffers`);
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const numToDiscard = hand.length - 3;
          if (numToDiscard <= 0) {
            console.log(`[footpad effect] player ${targetPlayerId} already at 3 or less`);
            continue;
          }
          console.log(`[footpad effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard cards`,
            restrict: hand,
            count: numToDiscard
          });
          if (!selectedCardIds.length) {
            console.warn(`[footpad effect] no cards selected`);
            continue;
          }
          console.log(`[footpad effect] player ${targetPlayerId} discarding ${selectedCardIds.length} cards`);
          for(let i = 0; i < selectedCardIds.length; i++){
            const cardId = selectedCardIds[i];
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: cardId,
              playerId: targetPlayerId
            });
          }
        }
      }
  },
  'hamlet': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[hamlet effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length > 0) {
          const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
            prompt: 'Discard to gain action?',
            playerId: cardEffectArgs.playerId,
            optional: true,
            count: 1,
            restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
          });
          if (result.length) {
            console.log(`[hamlet effect] player chose to discard to gain +1 action`);
            const cardId = result[0];
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId,
              playerId: cardEffectArgs.playerId
            });
            await cardEffectArgs.runGameActionDelegate('gainAction', {
              count: 1
            });
          } else {
            console.log(`[hamlet effect] player chose not to discard to gain +1 action`);
          }
        } else {
          console.log(`[hamlet effect] no cards in hand, not prompting to discard for action`);
        }
        if (hand.length > 0) {
          const result = await cardEffectArgs.runGameActionDelegate('selectCard', {
            prompt: 'Discard to gain buy?',
            playerId: cardEffectArgs.playerId,
            optional: true,
            count: 1,
            restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId)
          });
          if (result.length) {
            const cardId = result[0];
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId,
              playerId: cardEffectArgs.playerId
            });
            await cardEffectArgs.runGameActionDelegate('gainBuy', {
              count: 1
            });
          } else {
            console.log(`[hamlet effect] player chose not to discard to gain +1 buy`);
          }
        } else {
          console.log(`[hamlet effect] no cards in hand, not prompting to discard for buy`);
        }
      }
  },
  'herald': {
    registerLifeCycleMethods: ()=>({
        onGained: async (cardEffectArgs, eventArgs)=>{
          cardEffectArgs.reactionManager.registerReactionTemplate({
            id: `herald:${eventArgs.cardId}:endTurn`,
            playerId: eventArgs.playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            listeningFor: 'endTurn',
            condition: ()=>true,
            triggeredEffectFn: async (triggerEffectArgs)=>{
              const boughtStats = triggerEffectArgs.match.stats.cardsBought[eventArgs.cardId];
              const overpaid = boughtStats.paid - boughtStats.cost;
              if (!eventArgs.bought || overpaid <= 0) {
                console.log(`[herald triggered effect] no overpay cost spent for ${eventArgs.cardId}`);
                return;
              }
              console.log(`[herald triggered effect] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);
              const discardIds = triggerEffectArgs.findCards({
                location: 'playerDiscard',
                playerId: eventArgs.playerId
              }).map((card)=>card.id);
              const numToChoose = Math.min(overpaid, discardIds.length);
              if (!numToChoose) {
                console.log(`[herald onGained effect] no cards in discard`);
                return;
              }
              const result = await triggerEffectArgs.runGameActionDelegate('userPrompt', {
                prompt: `You may choose up to ${numToChoose} from your discard to top-deck`,
                playerId: eventArgs.playerId,
                actionButtons: [
                  {
                    label: 'DONE',
                    action: 1
                  }
                ],
                content: {
                  type: 'select',
                  cardIds: discardIds,
                  selectCount: {
                    kind: 'upTo',
                    count: numToChoose
                  }
                },
                validationAction: 1
              });
              console.log(`[herald triggered effect] putting ${result.result.length} cards on top of deck`);
              for (const cardId of result.result){
                await cardEffectArgs.runGameActionDelegate('moveCard', {
                  cardId: cardId,
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
        console.log(`[herald effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (deck.length === 0) {
          console.log(`[herald effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
          if (deck.length === 0) {
            console.log(`[herald effect] no cards in deck after shuffling`);
            return;
          }
        }
        const cardId = deck.slice(-1)[0];
        const card = cardEffectArgs.cardLibrary.getCard(cardId);
        console.log(`[herald effect] player ${cardEffectArgs.playerId} revealing ${card}`);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          cardId,
          playerId: cardEffectArgs.playerId
        });
        if (card.type.includes('ACTION')) {
          console.log(`[herald effect] card is an action card, playing it`);
          await cardEffectArgs.runGameActionDelegate('playCard', {
            cardId,
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'horn-of-plenty': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const uniquelyNamesCardsInPlay = new Set(getCardsInPlay(cardEffectArgs.findCards).filter((card)=>card.owner === cardEffectArgs.playerId).map((card)=>card.cardName)).size;
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
              treasure: uniquelyNamesCardsInPlay
            }
          }
        ]);
        if (!cards.length) {
          console.log(`[horn of plenty effect] no cards in supply costing up to ${uniquelyNamesCardsInPlay}`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cards.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[horn of plenty effect] no cards selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds.slice(-1)[0]);
        console.log(`[horn of plenty effect] gaining ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
        if (selectedCard.type.includes('VICTORY')) {
          console.log(`[horn of plenty effect] card is a victory card, trashing horn of plenty`);
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: cardEffectArgs.cardId
          });
        }
      }
  },
  'housecarl': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const uniqueActionCardsInPlay = Array.from(getCardsInPlay(cardEffectArgs.findCards).filter((card)=>card.type.includes('ACTION')).reduce((map, card)=>{
          if (!map.has(card.cardKey)) {
            map.set(card.cardKey, card);
          }
          return map;
        }, new Map()).values());
        if (uniqueActionCardsInPlay.length === 0) {
          console.log(`[housecarl effect] no action cards in play`);
          return;
        }
        console.log(`[housecarl effect] drawing ${uniqueActionCardsInPlay.length} cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: uniqueActionCardsInPlay.length
        });
      }
  },
  'huge-turnip': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          count: 2,
          playerId: cardEffectArgs.playerId
        });
        const coffers = cardEffectArgs.match.coffers?.[cardEffectArgs.playerId] ?? 0;
        if (coffers === 0) {
          console.log(`[huge turnip effect] no coffers`);
          return;
        }
        console.log(`[huge turnip effect] gaining ${coffers} treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: coffers
        });
      }
  },
  'hunting-party': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[hunting party effect] drawing 1 card and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length === 0) {
          console.warn(`[hunting party effect] no cards in hand`);
          return;
        }
        console.log(`[hunting party effect] revealing ${hand.length} cards`);
        for (const cardId of hand){
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: cardId,
            playerId: cardEffectArgs.playerId
          });
        }
        const uniqueHandCardNames = new Set(hand.map(cardEffectArgs.cardLibrary.getCard).map((card)=>card.cardName));
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
        const cardsToDiscard = [];
        while(deck.length + discard.length > 0){
          let cardId = deck.slice(-1)[0];
          if (!cardId) {
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
            cardId = deck.slice(-1)[0];
            if (!cardId) {
              console.warn(`[hunting party effect] no cards in deck after shuffling`);
              return;
            }
          }
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          console.log(`[hunting party effect] revealing ${card}`);
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: card.id,
            playerId: cardEffectArgs.playerId,
            moveToSetAside: true
          });
          if (uniqueHandCardNames.has(card.cardName)) {
            console.log(`[hunting party effect] adding ${card.cardName} to discards`);
            cardsToDiscard.push(cardId);
          } else {
            console.log(`[hunting party effect] moving ${card.cardName} to hand`);
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId: cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerHand'
              }
            });
            break;
          }
        }
        console.log(`[hunting party effect] discarding ${cardsToDiscard.length} cards`);
        for (const cardId of cardsToDiscard){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: cardId,
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'infirmary': {
    registerLifeCycleMethods: ()=>({
        onGained: async (cardEffectArgs, eventArgs)=>{
          const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
          const overpaid = boughtStats.paid - boughtStats.cost;
          if (!eventArgs.bought || overpaid <= 0) {
            console.log(`[infirmary onGained] no overpay cost spent for ${eventArgs.cardId}`);
            return;
          }
          console.log(`[infirmary onGained] ${eventArgs.playerId} overpaid for ${eventArgs.cardId}`);
          for(let i = 0; i < overpaid; i++){
            await cardEffectArgs.runGameActionDelegate('playCard', {
              playerId: eventArgs.playerId,
              cardId: eventArgs.cardId
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[infirmary effect] drawing 1 card`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count: 1,
          optional: true
        });
        if (!selectedCardIds[0]) {
          console.log(`[infirmary effect] no cards selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[infirmary effect] player ${cardEffectArgs.playerId} trashing ${card}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0]
        });
      }
  },
  'jester': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[jester effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
          if (deck.length === 0) {
            console.log(`[jester effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: targetPlayerId
            });
            if (deck.length === 0) {
              console.log(`[jester effect] no cards in deck after shuffling`);
              continue;
            }
          }
          const cardId = deck.slice(-1)[0];
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          console.log(`[jester effect] player ${targetPlayerId} discarding ${card}`);
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: cardId,
            playerId: targetPlayerId
          });
          if (card.type.includes('VICTORY')) {
            console.log(`[jester effect] card is a victory card, gaining curse`);
            const curseCardIds = cardEffectArgs.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'curse'
              }
            ]);
            if (!curseCardIds.length) {
              console.log(`[jester effect] no curse cards in supply`);
              continue;
            }
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: curseCardIds.slice(-1)[0].id,
              to: {
                location: 'basicSupply'
              }
            });
          } else {
            const copyIds = cardEffectArgs.findCards([
              {
                location: [
                  'basicSupply',
                  'kingdomSupply'
                ]
              },
              {
                cardKeys: card.cardKey
              }
            ]);
            if (!copyIds.length) {
              console.log(`[jester effect] no copies of ${card.cardName} in supply`);
              continue;
            }
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: `You or they gain a ${card.cardName}`,
              playerId: cardEffectArgs.playerId,
              actionButtons: [
                {
                  label: 'THEY GAIN',
                  action: 1
                },
                {
                  label: 'YOU GAIN',
                  action: 2
                }
              ]
            });
            const copyId = copyIds.slice(-1)[0];
            if (result.action === 1) {
              console.log(`[jester effect] player ${targetPlayerId} gaining ${card.cardName}`);
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: targetPlayerId,
                cardId: copyId.id,
                to: {
                  location: 'playerDiscard'
                }
              });
            } else {
              console.log(`[jester effect] player ${cardEffectArgs.playerId} gaining ${card.cardName}`);
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: copyId.id,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          }
        }
      }
  },
  'journeyman': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Name a card',
          playerId: cardEffectArgs.playerId,
          content: {
            type: 'name-card'
          }
        });
        const key = result.result;
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
        let count = 0;
        while(deck.length + discard.length > 0 && count < 3){
          if (deck.length === 0) {
            console.warn(`[journeyman effect] no cards in deck, shuffling`);
            await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
              playerId: cardEffectArgs.playerId
            });
            if (deck.length === 0) {
              console.warn(`[journeyman effect] no cards in deck after shuffling`);
              break;
            }
          }
          const cardId = deck.slice(-1)[0];
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId,
            playerId: cardEffectArgs.playerId,
            moveToSetAside: true
          });
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          if (card.cardKey === key) {
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId,
              playerId: cardEffectArgs.playerId
            });
          } else {
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerHand'
              }
            });
            count++;
          }
        }
      }
  },
  'joust': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[joust effect] drawing 1 card, and gaining 1 action, and 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const provinceCardsInHand = cardEffectArgs.findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId
        }).filter((card)=>card.cardKey === 'province');
        if (provinceCardsInHand.length === 0) {
          console.log(`[joust effect] no province cards in hand`);
          return;
        }
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Set aside province?',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'CANCEL',
              action: 1
            },
            {
              label: 'SET ASIDE',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[joust effect] player ${cardEffectArgs.playerId} cancelling joust`);
          return;
        }
        const provinceCard = provinceCardsInHand.slice(-1)[0];
        console.log(`[joust effect] player ${cardEffectArgs.playerId} setting aside ${provinceCard}`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          cardId: provinceCard.id,
          toPlayerId: cardEffectArgs.playerId,
          to: {
            location: 'set-aside'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `joust:${cardEffectArgs.cardId}:startPhase`,
          listeningFor: 'startTurnPhase',
          condition: (conditionArgs)=>{
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') return false;
            return true;
          },
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          triggeredEffectFn: async ()=>{
            console.log(`[joust triggered effect] player ${cardEffectArgs.playerId} discarding set aside ${provinceCard}`);
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: provinceCard.id,
              playerId: cardEffectArgs.playerId
            });
          }
        });
        const rewardCardIds = cardEffectArgs.findCards([
          {
            location: 'nonSupplyCards'
          },
          {
            cardType: 'REWARD'
          }
        ]);
        if (!rewardCardIds.length) {
          console.log(`[joust effect] no reward cards in supply`);
          return;
        }
        let selectedRewardId = undefined;
        if (rewardCardIds.length === 1) {
          selectedRewardId = rewardCardIds[0].id;
        } else {
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Select reward`,
            restrict: rewardCardIds.map((card)=>card.id),
            count: 1
          });
          selectedRewardId = selectedCardIds[0];
        }
        if (!selectedRewardId) {
          console.warn(`[joust effect] no reward card selected`);
          return;
        }
        const selectedRewardCard = cardEffectArgs.cardLibrary.getCard(selectedRewardId);
        console.log(`[joust effect] player ${cardEffectArgs.playerId} gaining ${selectedRewardCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedRewardId,
          to: {
            location: 'playerHand'
          }
        });
      }
  },
  'menagerie': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[menagerie effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        console.log(`[menagerie effect] revealing ${hand.length} cards`);
        for (const cardId of hand){
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: cardId,
            playerId: cardEffectArgs.playerId
          });
        }
        const uniqueHandCardNames = new Set(hand.map(cardEffectArgs.cardLibrary.getCard).map((card)=>card.cardName));
        if (uniqueHandCardNames.size === hand.length) {
          console.log(`[menagerie effect] all cards in hand are unique, gaining 3 cards`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 3
          });
        } else {
          console.log(`[menagerie effect] not all cards in hand are unique, gaining 1 card`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'merchant-guild': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[merchant guild effect] gaining 1 buy, and 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `merchant-guild:${cardEffectArgs.cardId}:endTurnPhase`,
          playerId: cardEffectArgs.playerId,
          listeningFor: 'endTurnPhase',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
            return true;
          },
          triggeredEffectFn: async (triggerEffectArgs)=>{
            const stats = triggerEffectArgs.match.stats;
            const cardIdsGainedThisTurn = stats.cardsGainedByTurn[triggerEffectArgs.match.turnNumber];
            const selfGainedCardIdsThisTurn = cardIdsGainedThisTurn?.filter((cardId)=>stats.cardsGained[cardId].playerId === cardEffectArgs.playerId) ?? [];
            if (!selfGainedCardIdsThisTurn.length) {
              console.log(`[merchant guild triggered effect] no cards gained this buy phase`);
              return;
            }
            console.log(`[merchant guild triggered effect] gaining ${selfGainedCardIdsThisTurn.length} coffers`);
            await cardEffectArgs.runGameActionDelegate('gainCoffer', {
              playerId: cardEffectArgs.playerId,
              count: selfGainedCardIdsThisTurn.length
            }, {
              loggingContext: {
                source: cardEffectArgs.cardId
              }
            });
          }
        });
      }
  },
  'plaza': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[plaza effect] drawing 1 card, and gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard treasure`,
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
        if (!selectedCardIds.length) {
          console.log(`[plaza effect] no cards selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[plaza effect] player ${cardEffectArgs.playerId} discarding ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCardIds[0],
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainCoffer', {
          playerId: cardEffectArgs.playerId,
          count: 1
        });
      }
  },
  'remake': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const count = Math.min(2, hand.length);
        console.log(`[remake effect] selecting ${count} cards`);
        for(let i = 0; i < count; i++){
          let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Trash card`,
            restrict: hand,
            count: 1
          });
          const selectedId = selectedCardIds[0];
          const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedId);
          console.log(`[remake effect] player ${cardEffectArgs.playerId} trashing ${selectedCard}`);
          await cardEffectArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedId
          });
          const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
            playerId: cardEffectArgs.playerId
          });
          const availableCardIds = cardEffectArgs.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              kind: 'exact',
              playerId: cardEffectArgs.playerId,
              amount: {
                ...cost,
                treasure: cost.treasure + 1
              }
            }
          ]);
          if (!availableCardIds.length) {
            console.log(`[remake effect] no cards in supply with cost ${cost}`);
            continue;
          }
          selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: availableCardIds.map((card)=>card.id),
            count: 1
          });
          const selectedCardId = selectedCardIds[0];
          if (!selectedCardId) {
            console.warn(`[remake effect] no card selected`);
            continue;
          }
          const card = cardEffectArgs.cardLibrary.getCard(availableCardIds.slice(-1)[0].id);
          console.log(`[remake effect] player ${cardEffectArgs.playerId} gaining ${card}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: availableCardIds.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'renown': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const rule = (card, context)=>{
          return {
            restricted: false,
            cost: {
              treasure: -2,
              potion: card.cost.potion
            }
          };
        };
        const ruleSubs = [];
        const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
        for (const card of allCards){
          ruleSubs.push(cardEffectArgs.cardPriceController.registerRule(card, rule));
        }
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `renown:${cardEffectArgs.cardId}:endTurn`,
          listeningFor: 'endTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: ()=>true,
          triggeredEffectFn: async ()=>{
            console.log(`[renown triggered effect] removing price rule`);
            for (const unsub of ruleSubs){
              unsub();
            }
          }
        });
      }
  },
  'shop': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[shop effect] drawing 1 card, and gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const cardsInPlay = getCardsInPlay(cardEffectArgs.findCards);
        const uniqueInPlayCardNames = new Set(cardsInPlay.map((card)=>card.cardName));
        const cardsInHand = cardEffectArgs.findCards({
          location: 'playerHand',
          playerId: cardEffectArgs.playerId
        }).filter((card)=>!uniqueInPlayCardNames.has(card.cardKey) && card.type.includes('ACTION'));
        if (cardsInHand.length === 0) {
          console.log(`[shop effect] no action cards in hand that are not in play`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play card?`,
          restrict: cardsInHand.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[shop effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[shop effect] player ${cardEffectArgs.playerId} playing ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('playCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0],
          overrides: {
            actionCost: 0
          }
        });
      }
  },
  'soothsayer': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const goldCardIds = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'gold'
          }
        ]);
        if (!goldCardIds.length) {
          console.log(`[soothsayer effect] no gold cards in supply`);
        } else {
          console.log(`[soothsayer effect] player ${cardEffectArgs.playerId} gaining gold`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: goldCardIds.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const curseCardIds = cardEffectArgs.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ]);
          if (!curseCardIds.length) {
            console.log(`[soothsayer effect] no curse cards in supply`);
            break;
          }
          console.log(`[soothsayer effect] player ${targetPlayerId} gaining a curse`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: targetPlayerId,
            cardId: curseCardIds.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
          console.log(`[soothsayer effect] player ${targetPlayerId} drawing 1 card`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: targetPlayerId
          });
        }
      }
  },
  'stonemason': {
    registerLifeCycleMethods: ()=>({
        onGained: async (cardEffectArgs, eventArgs)=>{
          if (!eventArgs.bought) {
            console.log(`[stonemason onGained effect] ${eventArgs.cardId} was not bought, skipping`);
            return;
          }
          const boughtStats = cardEffectArgs.match.stats.cardsBought[eventArgs.cardId];
          const overpaid = boughtStats.paid - boughtStats.cost;
          if (overpaid <= 0) {
            console.log(`[stonemason onGained effect] ${eventArgs.cardId} was not overpaid, skipping`);
            return;
          }
          const cardIds = cardEffectArgs.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              cardType: 'ACTION'
            },
            {
              playerId: eventArgs.playerId,
              kind: 'exact',
              amount: {
                treasure: overpaid
              }
            }
          ]);
          if (!cardIds.length) {
            console.log(`[stonemason triggered effect] no cards in supply with cost ${overpaid}`);
            return;
          }
          const numToGain = Math.min(2, cardIds.length);
          console.log(`[stonemason onGained effect] gaining ${numToGain} cards`);
          for(let i = 0; i < numToGain; i++){
            const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
              playerId: eventArgs.playerId,
              prompt: `Gain card`,
              restrict: cardIds.map((card)=>card.id),
              count: 1
            });
            if (!selectedCardIds.length) {
              console.warn(`[stonemason triggered effect] no card selected`);
              continue;
            }
            const selectedCardId = selectedCardIds[0];
            const card = cardEffectArgs.cardLibrary.getCard(selectedCardId);
            console.log(`[stonemason onGained effect] player ${eventArgs.playerId} gaining ${card}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: eventArgs.playerId,
              cardId: selectedCardId,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length === 0) {
          console.log(`[stonemason effect] no cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: hand,
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[stonemason effect] no card selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[stonemason effect] player ${cardEffectArgs.playerId} trashing ${card}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0]
        });
        const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
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
              treasure: cost.treasure - 1,
              potion: 1
            }
          }
        ]);
        if (!cardIds.length) {
          console.log(`[stonemason effect] no cards in supply with cost ${cost} or less to gain`);
          return;
        }
        const numToGain = Math.min(2, cardIds.length);
        console.log(`[stonemason effect] player ${cardEffectArgs.playerId} gaining ${numToGain} cards`);
        for(let i = 0; i < numToGain; i++){
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Gain card`,
            restrict: cardIds.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[stonemason effect] no card selected`);
            continue;
          }
          const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[stonemason effect] player ${cardEffectArgs.playerId} gaining ${card}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'young-witch': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[young witch effect] drawing 2 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const count = Math.min(2, hand.length);
        console.log(`[young witch effect] selecting ${count} cards`);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
          count
        });
        if (!selectedCardIds.length) {
          console.log(`[young witch effect] no cards selected`);
        } else {
          console.log(`[young witch effect] player ${cardEffectArgs.playerId} discarding ${selectedCardIds.length} cards`);
          for (const selectedCardId of selectedCardIds){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: selectedCardId,
              playerId: cardEffectArgs.playerId
            });
          }
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const handIds = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const handCards = handIds.map((cardId)=>cardEffectArgs.cardLibrary.getCard(cardId));
          const baneCards = handCards.filter((card)=>card.tags?.includes('bane'));
          const curseCardIds = cardEffectArgs.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ]);
          if (!curseCardIds.length) {
            console.log(`[young witch effect] no curse cards in supply`);
            return;
          }
          let reveal = false;
          if (baneCards.length > 0) {
            console.log(`[young witch effect] player ${targetPlayerId} has a bane, asking to reveal`);
            const baneCard = baneCards[0];
            const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
              prompt: `Reveal ${baneCard.cardName}`,
              playerId: targetPlayerId,
              actionButtons: [
                {
                  label: 'Cancel',
                  action: 1
                },
                {
                  label: 'Reveal',
                  action: 2
                }
              ]
            });
            reveal = result.action === 2;
            if (result.action === 2) {
              console.log(`[young witch effect] player ${targetPlayerId} revealed a bane`);
              await cardEffectArgs.runGameActionDelegate('revealCard', {
                cardId: baneCard.id,
                playerId: targetPlayerId
              });
            }
          } else {
            reveal = false;
          }
          if (!reveal) {
            console.log(`[young witch effect] player ${targetPlayerId} did not reveal a bane`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: targetPlayerId,
              cardId: curseCardIds[0].id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }
  }
};
export default expansion;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9jb3JudWNvcGlhLWFuZC1ndWlsZHMvY2FyZC1lZmZlY3RzLWNvcm51Y29waWEtYW5kLWd1aWxkcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDYXJkLCBDYXJkSWQsIENhcmRLZXkgfSBmcm9tICdzaGFyZWQvc2hhcmVkLXR5cGVzLnRzJztcbmltcG9ydCB7IENhcmRFeHBhbnNpb25Nb2R1bGUgfSBmcm9tICcuLi8uLi90eXBlcy50cyc7XG5pbXBvcnQgeyBmaW5kT3JkZXJlZFRhcmdldHMgfSBmcm9tICcuLi8uLi91dGlscy9maW5kLW9yZGVyZWQtdGFyZ2V0cy50cyc7XG5pbXBvcnQgeyBnZXRDYXJkc0luUGxheSB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1jYXJkcy1pbi1wbGF5LnRzJztcbmltcG9ydCB7IGdldFBsYXllclN0YXJ0aW5nRnJvbSB9IGZyb20gJy4uLy4uL3NoYXJlZC9nZXQtcGxheWVyLXBvc2l0aW9uLXV0aWxzLnRzJztcbmltcG9ydCB7IGdldFBsYXllckJ5SWQgfSBmcm9tICcuLi8uLi91dGlscy9nZXQtcGxheWVyLWJ5LWlkLnRzJztcbmltcG9ydCB7IGdldFR1cm5QaGFzZSB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC10dXJuLXBoYXNlLnRzJztcbmltcG9ydCB7IENhcmRQcmljZVJ1bGUgfSBmcm9tICcuLi8uLi9jb3JlL2NhcmQtcHJpY2UtcnVsZXMtY29udHJvbGxlci50cyc7XG5cbmNvbnN0IGV4cGFuc2lvbjogQ2FyZEV4cGFuc2lvbk1vZHVsZSA9IHtcbiAgJ2Fkdmlzb3InOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYWR2aXNvciBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgY2FyZHNSZXZlYWxlZDogQ2FyZFtdID0gW107XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYWR2aXNvciBlZmZlY3RdIHJldmVhbGluZyAzIGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbYWR2aXNvciBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYWR2aXNvciBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2sgYWZ0ZXIgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICBjYXJkc1JldmVhbGVkLnB1c2goY2FyZCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBsZWZ0UGxheWVyID0gZ2V0UGxheWVyU3RhcnRpbmdGcm9tKHtcbiAgICAgICAgc3RhcnRGcm9tSWR4OiBjYXJkRWZmZWN0QXJncy5tYXRjaC5jdXJyZW50UGxheWVyVHVybkluZGV4LFxuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGRpc3RhbmNlOiAxXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFthZHZpc29yIGVmZmVjdF0gcGxheWVyICR7bGVmdFBsYXllcn0gY2hvb3NpbmcgY2FyZCB0byBkaXNjYXJkYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiBgQ2hvb3NlIG9uZSBmb3IgJHtnZXRQbGF5ZXJCeUlkKGNhcmRFZmZlY3RBcmdzLm1hdGNoLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk/Lm5hbWV9IHRvIGRpc2NhcmRgLFxuICAgICAgICBwbGF5ZXJJZDogbGVmdFBsYXllci5pZCxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIGNhcmRJZHM6IGNhcmRzUmV2ZWFsZWQubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgfVxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSByZXN1bHQucmVzdWx0WzBdO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFthZHZpc29yIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYWR2aXNvciBlZmZlY3RdIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSBkaXNjYXJkaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHsgY2FyZElkLCBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRvTW92ZVRvSGFuZCA9IGNhcmRzUmV2ZWFsZWQuZmlsdGVyKGNhcmQgPT4gY2FyZC5pZCAhPT0gY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFthZHZpc29yIGVmZmVjdF0gbW92aW5nICR7dG9Nb3ZlVG9IYW5kLmxlbmd0aH0gY2FyZHMgdG8gaGFuZGApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgdG9Nb3ZlVG9IYW5kKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdiYWtlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNvZmZlcicsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMSB9KTtcbiAgICB9XG4gIH0sXG4gICdidXRjaGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2J1dGNoZXIgZWZmZWN0XSBnYWluaW5nIDIgY29mZmVyc2ApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ29mZmVyJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGNhcmQ/YCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2J1dGNoZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgbGV0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKHNlbGVjdGVkQ2FyZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAge1xuICAgICAgICAgIGtpbmQ6ICd1cFRvJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBhbW91bnQ6IHtcbiAgICAgICAgICAgIHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlICsgKGNhcmRFZmZlY3RBcmdzLm1hdGNoLmNvZmZlcnNbY2FyZEVmZmVjdEFyZ3MucGxheWVySWRdID8/IDApLFxuICAgICAgICAgICAgcG90aW9uOiBjb3N0LnBvdGlvblxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghY2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYnV0Y2hlciBlZmZlY3RdIG5vIGNhcmRzIGluIHN1cHBseSB0aGF0IG1hdGNoIGNvc3RgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbYnV0Y2hlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdDogc2VsZWN0ZWRDYXJkQ29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKHNlbGVjdGVkQ2FyZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbYnV0Y2hlciBlZmZlY3RdIGdhaW5pbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmRDb3N0LnRyZWFzdXJlIC0gY29zdC50cmVhc3VyZSA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtidXRjaGVyIGVmZmVjdF0gc3BlbmRpbmcgJHtzZWxlY3RlZENhcmRDb3N0LnRyZWFzdXJlIC0gY29zdC50cmVhc3VyZX0gY29mZmVyc2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5Db2ZmZXInLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNvdW50OiAtKHNlbGVjdGVkQ2FyZENvc3QudHJlYXN1cmUgLSBjb3N0LnRyZWFzdXJlKVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdjYW5kbGVzdGljay1tYWtlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtjYW5kbGVzdGljayBtYWtlciBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb24sIDEgYnV5LCBhbmQgMSBjb2ZmZXJgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ29mZmVyJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2Nhcm5pdmFsJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgY2FyZHNUb0tlZXA6IENhcmRbXSA9IFtdO1xuICAgICAgY29uc3QgY2FyZHNUb0Rpc2NhcmQ6IENhcmRbXSA9IFtdO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Nhcm5pdmFsIGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjaywgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtjYXJuaXZhbCBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2sgYWZ0ZXIgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJldmVhbGVkQ2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgIGNvbnN0IHJldmVhbGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQocmV2ZWFsZWRDYXJkSWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtjYXJuaXZhbCBlZmZlY3RdIHJldmVhbGluZyAke3JldmVhbGVkQ2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHJldmVhbGVkQ2FyZElkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBtb3ZlVG9TZXRBc2lkZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZHNUb0tlZXAuZmluZChjYXJkID0+IGNhcmQuY2FyZEtleSA9PT0gcmV2ZWFsZWRDYXJkLmNhcmRLZXkpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtjYXJuaXZhbCBlZmZlY3RdIGFkZGluZyAke3JldmVhbGVkQ2FyZH0gdG8ga2VlcGApO1xuICAgICAgICAgIGNhcmRzVG9LZWVwLnB1c2gocmV2ZWFsZWRDYXJkKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Nhcm5pdmFsIGVmZmVjdF0gYWRkaW5nICR7cmV2ZWFsZWRDYXJkfSB0byBkaXNjYXJkYCk7XG4gICAgICAgICAgY2FyZHNUb0Rpc2NhcmQucHVzaChyZXZlYWxlZENhcmQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbY2Fybml2YWwgZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZHNUb0Rpc2NhcmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHNUb0Rpc2NhcmQpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2Nhcm5pdmFsIGVmZmVjdF0gbW92aW5nICR7Y2FyZHNUb0tlZXAubGVuZ3RofSBjYXJkcyB0byBoYW5kYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBjYXJkc1RvS2VlcCkge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnY29yb25ldCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgaGFuZENhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkU291cmNlcyA9IFtcbiAgICAgICAgaGFuZENhcmRzXG4gICAgICAgICAgLmZpbHRlcihjYXJkID0+ICFjYXJkLnR5cGUuaW5jbHVkZXMoJ1JFV0FSRCcpICYmIGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpLFxuICAgICAgICBoYW5kQ2FyZHNcbiAgICAgICAgICAuZmlsdGVyKGNhcmQgPT4gIWNhcmQudHlwZS5pbmNsdWRlcygnUkVXQVJEJykgJiYgY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKVxuICAgICAgXVxuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkrKykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2Nvcm9uZXQgZWZmZWN0XSBwcm9jZXNzaW5nICR7aSA9PT0gMCA/ICdub24tcmV3YXJkIGFjdGlvbiBpbnN0cnVjdGlvbicgOiAnbm9uLXJld2FyZCB0cmVhc3VyZSBpbnN0cnVjdGlvbid9YCk7XG4gICAgICAgIGNvbnN0IGNhcmRTb3VyY2UgPSBjYXJkU291cmNlc1tpXTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkU291cmNlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbY29yb25ldCBlZmZlY3RdIG5vIG5vbi1yZXdhcmQgYWN0aW9uIGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHVuaXF1ZUNhcmROYW1lcyA9IEFycmF5LmZyb20obmV3IFNldChjYXJkU291cmNlLm1hcChjYXJkID0+IGNhcmQuY2FyZE5hbWUpKSk7XG4gICAgICAgIFxuICAgICAgICBsZXQgc2VsZWN0ZWRDYXJkSWQ6IENhcmRJZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgXG4gICAgICAgIGlmICh1bmlxdWVDYXJkTmFtZXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtjb3JvbmV0IGVmZmVjdF0gb25seSBvbmUgdW5pcXVlIGNhcmQgaW4gaGFuZCwgcHJvbXB0aW5nIHRvIHBsYXlgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6IGBQbGF5ICR7dW5pcXVlQ2FyZE5hbWVzWzBdfT9gLFxuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgICB7IGxhYmVsOiAnQ0FOQ0VMJywgYWN0aW9uOiAxIH0sIHsgbGFiZWw6ICdQTEFZJywgYWN0aW9uOiAyIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAyKSB7XG4gICAgICAgICAgICBzZWxlY3RlZENhcmRJZCA9IGNhcmRTb3VyY2VbMF0uaWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbY29yb25ldCBlZmZlY3RdIG11bHRpcGxlIHVuaXF1ZSBjYXJkcyBpbiBoYW5kLCBwcm9tcHRpbmcgdG8gc2VsZWN0YCk7XG4gICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgcHJvbXB0OiBgUGxheSBub24tUmV3YXJkICR7aSA9PT0gMCA/ICdBY3Rpb24nIDogJ1RyZWFzdXJlJ30/YCxcbiAgICAgICAgICAgIHJlc3RyaWN0OiBjYXJkU291cmNlLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgc2VsZWN0ZWRDYXJkSWQgPSBzZWxlY3RlZENhcmRJZHNbMF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtjb3JvbmV0IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2Nvcm9uZXQgZWZmZWN0XSBwbGF5aW5nICR7c2VsZWN0ZWRDYXJkfSB0d2ljZWApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3BsYXlDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgICAgIG92ZXJyaWRlczoge1xuICAgICAgICAgICAgICBhY3Rpb25Db3N0OiAwXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdjb3Vyc2VyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBhY3Rpb25zID0gW1xuICAgICAgICB7IGxhYmVsOiAnKzIgQ2FyZHMnLCBhY3Rpb246IDEgfSxcbiAgICAgICAgeyBsYWJlbDogJysyIEFjdGlvbnMnLCBhY3Rpb246IDIgfSxcbiAgICAgICAgeyBsYWJlbDogJysyIFRyZWFzdXJlJywgYWN0aW9uOiAzIH0sXG4gICAgICAgIHsgbGFiZWw6ICdHYWluIDQgU2lsdmVycycsIGFjdGlvbjogNCB9LFxuICAgICAgXTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBhY3Rpb25CdXR0b25zOiBhY3Rpb25zLFxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgIFxuICAgICAgICBjb25zdCBpZHggPSBhY3Rpb25zLmZpbmRJbmRleChhY3Rpb24gPT4gYWN0aW9uLmFjdGlvbiA9PT0gcmVzdWx0LmFjdGlvbik7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgYWN0aW9ucy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc3dpdGNoIChyZXN1bHQuYWN0aW9uKSB7XG4gICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6IHtcbiAgICAgICAgICAgIGNvbnN0IHNpbHZlckNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoXG4gICAgICAgICAgICAgIFt7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1dXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBudW1Ub0dhaW4gPSBNYXRoLm1pbig0LCBzaWx2ZXJDYXJkSWRzLmxlbmd0aCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVRvR2FpbjsgaSsrKSB7XG4gICAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICAgIGNhcmRJZDogc2lsdmVyQ2FyZElkcy5zbGljZSgtKGkgKyAxKSlbMF0uaWQsXG4gICAgICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdkZW1lc25lJzoge1xuICAgIHJlZ2lzdGVyU2NvcmluZ0Z1bmN0aW9uOiAoKSA9PiAoYXJncykgPT4ge1xuICAgICAgY29uc3Qgb3duZWRHb2xkQ2FyZHMgPSBhcmdzLmZpbmRDYXJkcyhcbiAgICAgICAgW3sgb3duZXI6IGFyZ3Mub3duZXJJZCB9XSxcbiAgICAgIClcbiAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQuY2FyZEtleSA9PT0gJ2dvbGQnKTtcbiAgICAgIHJldHVybiBvd25lZEdvbGRDYXJkcy5sZW5ndGg7XG4gICAgfSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtkZW1lc25lIGVmZmVjdF0gZ2FpbmluZyAyIGFjdGlvbnMsIGFuZCAyIGJ1eXNgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBnb2xkQ2FyZElkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhcbiAgICAgICAgW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ2dvbGQnIH1dXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAoIWdvbGRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2RlbWVzbmUgZWZmZWN0XSBubyBnb2xkIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGdvbGRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChnb2xkQ2FyZElkcy5zbGljZSgtMSlbMF0uaWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2RlbWVzbmUgZWZmZWN0XSBnYWluaW5nICR7Z29sZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBnb2xkQ2FyZC5pZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdmYWlyZ3JvdW5kcyc6IHtcbiAgICByZWdpc3RlclNjb3JpbmdGdW5jdGlvbjogKCkgPT4gKGFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGNhcmRzID0gYXJncy5jYXJkTGlicmFyeS5nZXRBbGxDYXJkc0FzQXJyYXkoKS5maWx0ZXIoY2FyZCA9PiBjYXJkLm93bmVyID09PSBhcmdzLm93bmVySWQpO1xuICAgICAgY29uc3QgdW5pcXVlTmFtZUNhcmRDb3VudCA9IG5ldyBTZXQoY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5jYXJkTmFtZSkpLnNpemU7XG4gICAgICBjb25zdCBzY29yZSA9IE1hdGguZmxvb3IodW5pcXVlTmFtZUNhcmRDb3VudCAvIDUpO1xuICAgICAgcmV0dXJuIHNjb3JlO1xuICAgIH1cbiAgfSxcbiAgJ2Zhcm1oYW5kcyc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkdhaW5lZDogYXN5bmMgKGNhcmRFZmZlY3RBcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGV2ZW50QXJncy5wbGF5ZXJJZCk7XG4gICAgICAgIGNvbnN0IGFjdGlvblRyZWFzdXJlQ2FyZHMgPSBoYW5kXG4gICAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpIHx8IGNhcmQudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoYWN0aW9uVHJlYXN1cmVDYXJkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Zhcm1oYW5kcyBlZmZlY3RdIG5vIGFjdGlvbiBvciB0cmVhc3VyZSBjYXJkcyBpbiBoYW5kLCBub3QgcHJvbXB0aW5nIHRvIHNlbGVjdGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHByb21wdDogJ1NldCBhc2lkZT8nLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCB9LFxuICAgICAgICAgICAgeyBjYXJkVHlwZTogWydBQ1RJT04nLCAnVFJFQVNVUkUnXSB9XG4gICAgICAgICAgXSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IGNhcmRJZCA9IHJlc3VsdFswXTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgdG9QbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdzZXQtYXNpZGUnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICAgIGlkOiBgZmFybWhhbmRzOiR7Y2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnl9OnN0YXJ0VHVybmAsXG4gICAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGV2ZW50QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyRWZmZWN0QXJncykgPT4ge1xuICAgICAgICAgICAgICBhd2FpdCB0cmlnZ2VyRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3BsYXlDYXJkJywge1xuICAgICAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICAgIG92ZXJyaWRlczoge1xuICAgICAgICAgICAgICAgICAgYWN0aW9uQ29zdDogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZmFybWhhbmRzIGVmZmVjdF0gcGxheWVyIGNob3NlIG5vdCB0byBzZXQgYXNpZGVgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2Zhcm1oYW5kcyBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgMiBhY3Rpb25zYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2ZhcnJpZXInOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChjYXJkRWZmZWN0QXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGJvdWdodFN0YXRzID0gY2FyZEVmZmVjdEFyZ3MubWF0Y2guc3RhdHMuY2FyZHNCb3VnaHRbZXZlbnRBcmdzLmNhcmRJZF07XG4gICAgICAgIGNvbnN0IG92ZXJwYWlkID0gYm91Z2h0U3RhdHMucGFpZCAtIGJvdWdodFN0YXRzLmNvc3Q7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWV2ZW50QXJncy5ib3VnaHQgfHwgb3ZlcnBhaWQgPD0gMCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBmYXJyaWVyOiR7ZXZlbnRBcmdzLmNhcmRJZH06ZW5kVHVybmAsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnZW5kVHVybicsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgICBjb25kaXRpb246ICgpID0+IHRydWUsXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyRWZmZWN0QXJncykgPT4ge1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY291bnQ6IG92ZXJwYWlkXG4gICAgICAgICAgICB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogZXZlbnRBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZmFycmllciBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBnYWluaW5nIDEgYWN0aW9uLCBhbmQgMSBidXlgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBmYXJyaWVyOiR7Y2FyZEVmZmVjdEFyZ3MuY2FyZElkfTplbmRUdXJuYCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnZW5kVHVybicsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4gdHJ1ZSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyRWZmZWN0QXJncykgPT4ge1xuICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ2ZlcnJ5bWFuJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uR2FpbmVkOiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjb25zdCBjYXJkSWRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFxuICAgICAgICAgIFt7IGxvY2F0aW9uOiAna2luZ2RvbVN1cHBseScgfSwgeyB0YWdzOiAnZmVycnltYW4nIH1dLFxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFjYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZmVycnltYW4gZWZmZWN0XSBubyBmZXJyeW1hbiBjYXJkcyBpbiBraW5nZG9tLCBjYW4ndCBnYWluYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkSWRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGV2ZW50QXJncy5jYXJkSWQgfSB9KTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtmZXJyeW1hbiBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkcywgYW5kIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCksXG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2ZlcnJ5bWFuIGVmZmVjdF0gbm8gY2FyZHMgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZCA9IHNlbGVjdGVkQ2FyZElkcy5zbGljZSgtMSlbMF07XG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtmZXJyeW1hbiBlZmZlY3RdIGRpc2NhcmRpbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnZm9vdHBhZCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtmb290cGFkIGVmZmVjdF0gZ2FpbmluZyAyIGNvZmZlcnNgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNvZmZlcicsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgY29uc3QgbnVtVG9EaXNjYXJkID0gaGFuZC5sZW5ndGggLSAzO1xuICAgICAgICBpZiAobnVtVG9EaXNjYXJkIDw9IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Zvb3RwYWQgZWZmZWN0XSBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gYWxyZWFkeSBhdCAzIG9yIGxlc3NgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtmb290cGFkIGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGRpc2NhcmRpbmcgJHtudW1Ub0Rpc2NhcmR9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZHNgLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgIGNvdW50OiBudW1Ub0Rpc2NhcmQsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbZm9vdHBhZCBlZmZlY3RdIG5vIGNhcmRzIHNlbGVjdGVkYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbZm9vdHBhZCBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkaXNjYXJkaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY2FyZElkID0gc2VsZWN0ZWRDYXJkSWRzW2ldO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnaGFtbGV0Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2hhbWxldCBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKGhhbmQubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcHJvbXB0OiAnRGlzY2FyZCB0byBnYWluIGFjdGlvbj8nLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICByZXN0cmljdDogY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpLFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGlmIChyZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtoYW1sZXQgZWZmZWN0XSBwbGF5ZXIgY2hvc2UgdG8gZGlzY2FyZCB0byBnYWluICsxIGFjdGlvbmApO1xuICAgICAgICAgIGNvbnN0IGNhcmRJZCA9IHJlc3VsdFswXTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBjYXJkSWQsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaGFtbGV0IGVmZmVjdF0gcGxheWVyIGNob3NlIG5vdCB0byBkaXNjYXJkIHRvIGdhaW4gKzEgYWN0aW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2hhbWxldCBlZmZlY3RdIG5vIGNhcmRzIGluIGhhbmQsIG5vdCBwcm9tcHRpbmcgdG8gZGlzY2FyZCBmb3IgYWN0aW9uYCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChoYW5kLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHByb21wdDogJ0Rpc2NhcmQgdG8gZ2FpbiBidXk/JyxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgcmVzdHJpY3Q6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IGNhcmRJZCA9IHJlc3VsdFswXTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBjYXJkSWQsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaGFtbGV0IGVmZmVjdF0gcGxheWVyIGNob3NlIG5vdCB0byBkaXNjYXJkIHRvIGdhaW4gKzEgYnV5YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2hhbWxldCBlZmZlY3RdIG5vIGNhcmRzIGluIGhhbmQsIG5vdCBwcm9tcHRpbmcgdG8gZGlzY2FyZCBmb3IgYnV5YCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnaGVyYWxkJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uR2FpbmVkOiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYGhlcmFsZDoke2V2ZW50QXJncy5jYXJkSWR9OmVuZFR1cm5gLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnZW5kVHVybicsXG4gICAgICAgICAgY29uZGl0aW9uOiAoKSA9PiB0cnVlLFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlckVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJvdWdodFN0YXRzID0gdHJpZ2dlckVmZmVjdEFyZ3MubWF0Y2guc3RhdHMuY2FyZHNCb3VnaHRbZXZlbnRBcmdzLmNhcmRJZF07XG4gICAgICAgICAgICBjb25zdCBvdmVycGFpZCA9IGJvdWdodFN0YXRzLnBhaWQgLSBib3VnaHRTdGF0cy5jb3N0O1xuICAgICAgICAgICAgaWYgKCFldmVudEFyZ3MuYm91Z2h0IHx8IG92ZXJwYWlkIDw9IDApIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtoZXJhbGQgdHJpZ2dlcmVkIGVmZmVjdF0gbm8gb3ZlcnBheSBjb3N0IHNwZW50IGZvciAke2V2ZW50QXJncy5jYXJkSWR9YCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtoZXJhbGQgdHJpZ2dlcmVkIGVmZmVjdF0gJHtldmVudEFyZ3MucGxheWVySWR9IG92ZXJwYWlkIGZvciAke2V2ZW50QXJncy5jYXJkSWR9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGRpc2NhcmRJZHMgPSB0cmlnZ2VyRWZmZWN0QXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnLCBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkIH0pXG4gICAgICAgICAgICAgIC5tYXAoY2FyZCA9PiBjYXJkLmlkKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgbnVtVG9DaG9vc2UgPSBNYXRoLm1pbihvdmVycGFpZCwgZGlzY2FyZElkcy5sZW5ndGgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIW51bVRvQ2hvb3NlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbaGVyYWxkIG9uR2FpbmVkIGVmZmVjdF0gbm8gY2FyZHMgaW4gZGlzY2FyZGApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRyaWdnZXJFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgICAgcHJvbXB0OiBgWW91IG1heSBjaG9vc2UgdXAgdG8gJHtudW1Ub0Nob29zZX0gZnJvbSB5b3VyIGRpc2NhcmQgdG8gdG9wLWRlY2tgLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ0RPTkUnLCBhY3Rpb246IDEgfVxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgICAgY2FyZElkczogZGlzY2FyZElkcyxcbiAgICAgICAgICAgICAgICBzZWxlY3RDb3VudDoge1xuICAgICAgICAgICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgICAgICAgICAgY291bnQ6IG51bVRvQ2hvb3NlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB2YWxpZGF0aW9uQWN0aW9uOiAxLFxuICAgICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkSWRbXSB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2hlcmFsZCB0cmlnZ2VyZWQgZWZmZWN0XSBwdXR0aW5nICR7cmVzdWx0LnJlc3VsdC5sZW5ndGh9IGNhcmRzIG9uIHRvcCBvZiBkZWNrYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgICAgICB0b1BsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtoZXJhbGQgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgYW5kIGdhaW5pbmcgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2hlcmFsZCBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2hlcmFsZCBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2sgYWZ0ZXIgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtoZXJhbGQgZWZmZWN0XSBwbGF5ZXIgJHtjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZH0gcmV2ZWFsaW5nICR7Y2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpZiAoY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2hlcmFsZCBlZmZlY3RdIGNhcmQgaXMgYW4gYWN0aW9uIGNhcmQsIHBsYXlpbmcgaXRgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdob3JuLW9mLXBsZW50eSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgdW5pcXVlbHlOYW1lc0NhcmRzSW5QbGF5ID0gbmV3IFNldChnZXRDYXJkc0luUGxheShjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMpXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLm93bmVyID09PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZClcbiAgICAgICAgLm1hcChjYXJkID0+IGNhcmQuY2FyZE5hbWUpXG4gICAgICApLnNpemU7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgeyBraW5kOiAndXBUbycsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgYW1vdW50OiB7IHRyZWFzdXJlOiB1bmlxdWVseU5hbWVzQ2FyZHNJblBsYXkgfSB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtob3JuIG9mIHBsZW50eSBlZmZlY3RdIG5vIGNhcmRzIGluIHN1cHBseSBjb3N0aW5nIHVwIHRvICR7dW5pcXVlbHlOYW1lc0NhcmRzSW5QbGF5fWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogY2FyZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtob3JuIG9mIHBsZW50eSBlZmZlY3RdIG5vIGNhcmRzIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHMuc2xpY2UoLTEpWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtob3JuIG9mIHBsZW50eSBlZmZlY3RdIGdhaW5pbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmQudHlwZS5pbmNsdWRlcygnVklDVE9SWScpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaG9ybiBvZiBwbGVudHkgZWZmZWN0XSBjYXJkIGlzIGEgdmljdG9yeSBjYXJkLCB0cmFzaGluZyBob3JuIG9mIHBsZW50eWApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkRWZmZWN0QXJncy5jYXJkSWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2hvdXNlY2FybCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgdW5pcXVlQWN0aW9uQ2FyZHNJblBsYXkgPSBBcnJheS5mcm9tKGdldENhcmRzSW5QbGF5KGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcylcbiAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpXG4gICAgICAgIC5yZWR1Y2UoKG1hcCwgY2FyZCkgPT4ge1xuICAgICAgICAgIGlmICghbWFwLmhhcyhjYXJkLmNhcmRLZXkpKSB7XG4gICAgICAgICAgICBtYXAuc2V0KGNhcmQuY2FyZEtleSwgY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBtYXA7XG4gICAgICAgIH0sIG5ldyBNYXA8Q2FyZFsnY2FyZEtleSddLCBDYXJkPigpKVxuICAgICAgICAudmFsdWVzKCkpO1xuICAgICAgXG4gICAgICBpZiAodW5pcXVlQWN0aW9uQ2FyZHNJblBsYXkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaG91c2VjYXJsIGVmZmVjdF0gbm8gYWN0aW9uIGNhcmRzIGluIHBsYXlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2hvdXNlY2FybCBlZmZlY3RdIGRyYXdpbmcgJHt1bmlxdWVBY3Rpb25DYXJkc0luUGxheS5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IHVuaXF1ZUFjdGlvbkNhcmRzSW5QbGF5Lmxlbmd0aFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnaHVnZS10dXJuaXAnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNvZmZlcicsIHsgY291bnQ6IDIsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY29mZmVycyA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLmNvZmZlcnM/LltjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZF0gPz8gMDtcbiAgICAgIFxuICAgICAgaWYgKGNvZmZlcnMgPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtodWdlIHR1cm5pcCBlZmZlY3RdIG5vIGNvZmZlcnNgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2h1Z2UgdHVybmlwIGVmZmVjdF0gZ2FpbmluZyAke2NvZmZlcnN9IHRyZWFzdXJlYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogY29mZmVycyB9KTtcbiAgICB9XG4gIH0sXG4gICdodW50aW5nLXBhcnR5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2h1bnRpbmcgcGFydHkgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCBhbmQgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKGhhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2h1bnRpbmcgcGFydHkgZWZmZWN0XSBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtodW50aW5nIHBhcnR5IGVmZmVjdF0gcmV2ZWFsaW5nICR7aGFuZC5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGhhbmQpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHVuaXF1ZUhhbmRDYXJkTmFtZXMgPSBuZXcgU2V0KGhhbmRcbiAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAubWFwKGNhcmQgPT4gY2FyZC5jYXJkTmFtZSlcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBjb25zdCBkaXNjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkc1RvRGlzY2FyZDogQ2FyZElkW10gPSBbXTtcbiAgICAgIFxuICAgICAgd2hpbGUgKGRlY2subGVuZ3RoICsgZGlzY2FyZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxldCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtodW50aW5nIHBhcnR5IGVmZmVjdF0gbm8gY2FyZHMgaW4gZGVjayBhZnRlciBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2h1bnRpbmcgcGFydHkgZWZmZWN0XSByZXZlYWxpbmcgJHtjYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAodW5pcXVlSGFuZENhcmROYW1lcy5oYXMoY2FyZC5jYXJkTmFtZSkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2h1bnRpbmcgcGFydHkgZWZmZWN0XSBhZGRpbmcgJHtjYXJkLmNhcmROYW1lfSB0byBkaXNjYXJkc2ApO1xuICAgICAgICAgIGNhcmRzVG9EaXNjYXJkLnB1c2goY2FyZElkKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2h1bnRpbmcgcGFydHkgZWZmZWN0XSBtb3ZpbmcgJHtjYXJkLmNhcmROYW1lfSB0byBoYW5kYCk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZElkLFxuICAgICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2h1bnRpbmcgcGFydHkgZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZHNUb0Rpc2NhcmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZHNUb0Rpc2NhcmQpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnaW5maXJtYXJ5Jzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uR2FpbmVkOiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjb25zdCBib3VnaHRTdGF0cyA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnN0YXRzLmNhcmRzQm91Z2h0W2V2ZW50QXJncy5jYXJkSWRdO1xuICAgICAgICBjb25zdCBvdmVycGFpZCA9IGJvdWdodFN0YXRzLnBhaWQgLSBib3VnaHRTdGF0cy5jb3N0O1xuICAgICAgICBpZiAoIWV2ZW50QXJncy5ib3VnaHQgfHwgb3ZlcnBhaWQgPD0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaW5maXJtYXJ5IG9uR2FpbmVkXSBubyBvdmVycGF5IGNvc3Qgc3BlbnQgZm9yICR7ZXZlbnRBcmdzLmNhcmRJZH1gKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbaW5maXJtYXJ5IG9uR2FpbmVkXSAke2V2ZW50QXJncy5wbGF5ZXJJZH0gb3ZlcnBhaWQgZm9yICR7ZXZlbnRBcmdzLmNhcmRJZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3ZlcnBhaWQ7IGkrKykge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBldmVudEFyZ3MuY2FyZElkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtpbmZpcm1hcnkgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZGApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzWzBdKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbaW5maXJtYXJ5IGVmZmVjdF0gbm8gY2FyZHMgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2luZmlybWFyeSBlZmZlY3RdIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSB0cmFzaGluZyAke2NhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWRzWzBdLFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnamVzdGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2plc3RlciBlZmZlY3RdIGdhaW5pbmcgMiB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtqZXN0ZXIgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2plc3RlciBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2sgYWZ0ZXIgc2h1ZmZsaW5nYCk7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2plc3RlciBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkaXNjYXJkaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHsgY2FyZElkOiBjYXJkSWQsIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ1ZJQ1RPUlknKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbamVzdGVyIGVmZmVjdF0gY2FyZCBpcyBhIHZpY3RvcnkgY2FyZCwgZ2FpbmluZyBjdXJzZWApO1xuICAgICAgICAgIGNvbnN0IGN1cnNlQ2FyZElkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhcbiAgICAgICAgICAgIFt7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sIHsgY2FyZEtleXM6ICdjdXJzZScgfV1cbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY3Vyc2VDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtqZXN0ZXIgZWZmZWN0XSBubyBjdXJzZSBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjdXJzZUNhcmRJZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGNvcHlJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoXG4gICAgICAgICAgICBbeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSwgeyBjYXJkS2V5czogY2FyZC5jYXJkS2V5IH1dXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNvcHlJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2plc3RlciBlZmZlY3RdIG5vIGNvcGllcyBvZiAke2NhcmQuY2FyZE5hbWV9IGluIHN1cHBseWApO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgIHByb21wdDogYFlvdSBvciB0aGV5IGdhaW4gYSAke2NhcmQuY2FyZE5hbWV9YCxcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ1RIRVkgR0FJTicsIGFjdGlvbjogMSB9LFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnWU9VIEdBSU4nLCBhY3Rpb246IDIgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNvcHlJZCA9IGNvcHlJZHMuc2xpY2UoLTEpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2plc3RlciBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBnYWluaW5nICR7Y2FyZC5jYXJkTmFtZX1gKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBjb3B5SWQuaWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtqZXN0ZXIgZWZmZWN0XSBwbGF5ZXIgJHtjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZH0gZ2FpbmluZyAke2NhcmQuY2FyZE5hbWV9YCk7XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZDogY29weUlkLmlkLFxuICAgICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2pvdXJuZXltYW4nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnTmFtZSBhIGNhcmQnLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNvbnRlbnQ6IHsgdHlwZTogJ25hbWUtY2FyZCcgfVxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkS2V5IH07XG4gICAgICBcbiAgICAgIGNvbnN0IGtleSA9IHJlc3VsdC5yZXN1bHQ7XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBjb25zdCBkaXNjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgbGV0IGNvdW50ID0gMDtcbiAgICAgIHdoaWxlIChkZWNrLmxlbmd0aCArIGRpc2NhcmQubGVuZ3RoID4gMCAmJiBjb3VudCA8IDMpIHtcbiAgICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBbam91cm5leW1hbiBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW2pvdXJuZXltYW4gZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrIGFmdGVyIHNodWZmbGluZ2ApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIGlmIChjYXJkLmNhcmRLZXkgPT09IGtleSkge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7IGNhcmRJZCwgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdqb3VzdCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtqb3VzdCBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIGFjdGlvbiwgYW5kIDEgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHByb3ZpbmNlQ2FyZHNJbkhhbmQgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoe1xuICAgICAgICBsb2NhdGlvbjogJ3BsYXllckhhbmQnLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLmNhcmRLZXkgPT09ICdwcm92aW5jZScpO1xuICAgICAgXG4gICAgICBpZiAocHJvdmluY2VDYXJkc0luSGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtqb3VzdCBlZmZlY3RdIG5vIHByb3ZpbmNlIGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogJ1NldCBhc2lkZSBwcm92aW5jZT8nLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnQ0FOQ0VMJywgYWN0aW9uOiAxIH0sIHsgbGFiZWw6ICdTRVQgQVNJREUnLCBhY3Rpb246IDIgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2pvdXN0IGVmZmVjdF0gcGxheWVyICR7Y2FyZEVmZmVjdEFyZ3MucGxheWVySWR9IGNhbmNlbGxpbmcgam91c3RgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBwcm92aW5jZUNhcmQgPSBwcm92aW5jZUNhcmRzSW5IYW5kLnNsaWNlKC0xKVswXTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtqb3VzdCBlZmZlY3RdIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSBzZXR0aW5nIGFzaWRlICR7cHJvdmluY2VDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IHByb3ZpbmNlQ2FyZC5pZCxcbiAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAnc2V0LWFzaWRlJyB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgam91c3Q6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OnN0YXJ0UGhhc2VgLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm5QaGFzZScsXG4gICAgICAgIGNvbmRpdGlvbjogKGNvbmRpdGlvbkFyZ3MpID0+IHtcbiAgICAgICAgICBpZiAoZ2V0VHVyblBoYXNlKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBoYXNlSW5kZXgpICE9PSAnY2xlYW51cCcpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbam91c3QgdHJpZ2dlcmVkIGVmZmVjdF0gcGxheWVyICR7Y2FyZEVmZmVjdEFyZ3MucGxheWVySWR9IGRpc2NhcmRpbmcgc2V0IGFzaWRlICR7cHJvdmluY2VDYXJkfWApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHByb3ZpbmNlQ2FyZC5pZCxcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcmV3YXJkQ2FyZElkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdub25TdXBwbHlDYXJkcycgfSxcbiAgICAgICAgeyBjYXJkVHlwZTogJ1JFV0FSRCcgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghcmV3YXJkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtqb3VzdCBlZmZlY3RdIG5vIHJld2FyZCBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBsZXQgc2VsZWN0ZWRSZXdhcmRJZDogQ2FyZElkIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgICAgXG4gICAgICBpZiAocmV3YXJkQ2FyZElkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgc2VsZWN0ZWRSZXdhcmRJZCA9IHJld2FyZENhcmRJZHNbMF0uaWQ7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBTZWxlY3QgcmV3YXJkYCxcbiAgICAgICAgICByZXN0cmljdDogcmV3YXJkQ2FyZElkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMVxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIHNlbGVjdGVkUmV3YXJkSWQgPSBzZWxlY3RlZENhcmRJZHNbMF07XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRSZXdhcmRJZCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtqb3VzdCBlZmZlY3RdIG5vIHJld2FyZCBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRSZXdhcmRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZFJld2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtqb3VzdCBlZmZlY3RdIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSBnYWluaW5nICR7c2VsZWN0ZWRSZXdhcmRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRSZXdhcmRJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdtZW5hZ2VyaWUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbWVuYWdlcmllIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFttZW5hZ2VyaWUgZWZmZWN0XSByZXZlYWxpbmcgJHtoYW5kLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgaGFuZCkge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgdW5pcXVlSGFuZENhcmROYW1lcyA9IG5ldyBTZXQoaGFuZFxuICAgICAgICAubWFwKGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQpXG4gICAgICAgIC5tYXAoY2FyZCA9PiBjYXJkLmNhcmROYW1lKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKHVuaXF1ZUhhbmRDYXJkTmFtZXMuc2l6ZSA9PT0gaGFuZC5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttZW5hZ2VyaWUgZWZmZWN0XSBhbGwgY2FyZHMgaW4gaGFuZCBhcmUgdW5pcXVlLCBnYWluaW5nIDMgY2FyZHNgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMyB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW21lbmFnZXJpZSBlZmZlY3RdIG5vdCBhbGwgY2FyZHMgaW4gaGFuZCBhcmUgdW5pcXVlLCBnYWluaW5nIDEgY2FyZGApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnbWVyY2hhbnQtZ3VpbGQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbWVyY2hhbnQgZ3VpbGQgZWZmZWN0XSBnYWluaW5nIDEgYnV5LCBhbmQgMSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgbWVyY2hhbnQtZ3VpbGQ6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmVuZFR1cm5QaGFzZWAsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnZW5kVHVyblBoYXNlJyxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgIGlmIChnZXRUdXJuUGhhc2UoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGhhc2VJbmRleCkgIT09ICdidXknKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlckVmZmVjdEFyZ3MpID0+IHtcbiAgICAgICAgICBjb25zdCBzdGF0cyA9IHRyaWdnZXJFZmZlY3RBcmdzLm1hdGNoLnN0YXRzO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRJZHNHYWluZWRUaGlzVHVybiA9IHN0YXRzLmNhcmRzR2FpbmVkQnlUdXJuW3RyaWdnZXJFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXJdO1xuICAgICAgICAgIGNvbnN0IHNlbGZHYWluZWRDYXJkSWRzVGhpc1R1cm4gPSBjYXJkSWRzR2FpbmVkVGhpc1R1cm4/LmZpbHRlcihjYXJkSWQgPT4gc3RhdHMuY2FyZHNHYWluZWRbY2FyZElkXS5wbGF5ZXJJZCA9PT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpID8/IFtdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghc2VsZkdhaW5lZENhcmRJZHNUaGlzVHVybi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWVyY2hhbnQgZ3VpbGQgdHJpZ2dlcmVkIGVmZmVjdF0gbm8gY2FyZHMgZ2FpbmVkIHRoaXMgYnV5IHBoYXNlYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWVyY2hhbnQgZ3VpbGQgdHJpZ2dlcmVkIGVmZmVjdF0gZ2FpbmluZyAke3NlbGZHYWluZWRDYXJkSWRzVGhpc1R1cm4ubGVuZ3RofSBjb2ZmZXJzYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ29mZmVyJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY291bnQ6IHNlbGZHYWluZWRDYXJkSWRzVGhpc1R1cm4ubGVuZ3RoXG4gICAgICAgICAgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ3BsYXphJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3BsYXphIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGFuZCBnYWluaW5nIDIgYWN0aW9uc2ApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgdHJlYXN1cmVgLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgICAgeyBjYXJkVHlwZTogJ1RSRUFTVVJFJyB9XG4gICAgICAgIF0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtwbGF6YSBlZmZlY3RdIG5vIGNhcmRzIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIGNvbnNvbGUubG9nKGBbcGxhemEgZWZmZWN0XSBwbGF5ZXIgJHtjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZH0gZGlzY2FyZGluZyAke2NhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWRzWzBdLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5Db2ZmZXInLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDEgfSk7XG4gICAgfVxuICB9LFxuICAncmVtYWtlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgY291bnQgPSBNYXRoLm1pbigyLCBoYW5kLmxlbmd0aCk7XG4gICAgICBjb25zb2xlLmxvZyhgW3JlbWFrZSBlZmZlY3RdIHNlbGVjdGluZyAke2NvdW50fSBjYXJkc2ApO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgbGV0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRJZCA9IHNlbGVjdGVkQ2FyZElkc1swXTtcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZElkKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbcmVtYWtlIGVmZmVjdF0gcGxheWVyICR7Y2FyZEVmZmVjdEFyZ3MucGxheWVySWR9IHRyYXNoaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhzZWxlY3RlZENhcmQsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBhdmFpbGFibGVDYXJkSWRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGtpbmQ6ICdleGFjdCcsXG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBhbW91bnQ6IHsgLi4uY29zdCwgdHJlYXN1cmU6IGNvc3QudHJlYXN1cmUgKyAxIH1cbiAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFhdmFpbGFibGVDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbcmVtYWtlIGVmZmVjdF0gbm8gY2FyZHMgaW4gc3VwcGx5IHdpdGggY29zdCAke2Nvc3R9YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogYXZhaWxhYmxlQ2FyZElkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMVxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkID0gc2VsZWN0ZWRDYXJkSWRzWzBdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW3JlbWFrZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoYXZhaWxhYmxlQ2FyZElkcy5zbGljZSgtMSlbMF0uaWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtyZW1ha2UgZWZmZWN0XSBwbGF5ZXIgJHtjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZH0gZ2FpbmluZyAke2NhcmR9YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGF2YWlsYWJsZUNhcmRJZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdyZW5vd24nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJ1bGU6IENhcmRQcmljZVJ1bGUgPSAoY2FyZCwgY29udGV4dCkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlc3RyaWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGNvc3Q6IHtcbiAgICAgICAgICAgIHRyZWFzdXJlOiAtMixcbiAgICAgICAgICAgIHBvdGlvbjogY2FyZC5jb3N0LnBvdGlvbixcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcnVsZVN1YnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gICAgICBjb25zdCBhbGxDYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldEFsbENhcmRzQXNBcnJheSgpO1xuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGFsbENhcmRzKSB7XG4gICAgICAgIHJ1bGVTdWJzLnB1c2goY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5yZWdpc3RlclJ1bGUoY2FyZCwgcnVsZSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGByZW5vd246JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmVuZFR1cm5gLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBjb25kaXRpb246ICgpID0+IHRydWUsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtyZW5vd24gdHJpZ2dlcmVkIGVmZmVjdF0gcmVtb3ZpbmcgcHJpY2UgcnVsZWApO1xuICAgICAgICAgIGZvciAoY29uc3QgdW5zdWIgb2YgcnVsZVN1YnMpIHtcbiAgICAgICAgICAgIHVuc3ViKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ3Nob3AnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2hvcCBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzSW5QbGF5ID0gZ2V0Q2FyZHNJblBsYXkoY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKTtcbiAgICAgIFxuICAgICAgY29uc3QgdW5pcXVlSW5QbGF5Q2FyZE5hbWVzID0gbmV3IFNldChjYXJkc0luUGxheVxuICAgICAgICAubWFwKGNhcmQgPT4gY2FyZC5jYXJkTmFtZSlcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzSW5IYW5kID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiAhdW5pcXVlSW5QbGF5Q2FyZE5hbWVzLmhhcyhjYXJkLmNhcmRLZXkpICYmIGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpO1xuICAgICAgXG4gICAgICBpZiAoY2FyZHNJbkhhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2hvcCBlZmZlY3RdIG5vIGFjdGlvbiBjYXJkcyBpbiBoYW5kIHRoYXQgYXJlIG5vdCBpbiBwbGF5YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFBsYXkgY2FyZD9gLFxuICAgICAgICByZXN0cmljdDogY2FyZHNJbkhhbmQubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzaG9wIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKVxuICAgICAgY29uc29sZS5sb2coYFtzaG9wIGVmZmVjdF0gcGxheWVyICR7Y2FyZEVmZmVjdEFyZ3MucGxheWVySWR9IHBsYXlpbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZHNbMF0sXG4gICAgICAgIG92ZXJyaWRlczoge1xuICAgICAgICAgIGFjdGlvbkNvc3Q6IDBcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnc29vdGhzYXllcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZ29sZENhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoXG4gICAgICAgIFt7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sIHsgY2FyZEtleXM6ICdnb2xkJyB9XVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKCFnb2xkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzb290aHNheWVyIGVmZmVjdF0gbm8gZ29sZCBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3Nvb3Roc2F5ZXIgZWZmZWN0XSBwbGF5ZXIgJHtjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZH0gZ2FpbmluZyBnb2xkYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGdvbGRDYXJkSWRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGN1cnNlQ2FyZElkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhcbiAgICAgICAgICBbeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LCB7IGNhcmRLZXlzOiAnY3Vyc2UnIH1dXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWN1cnNlQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3Nvb3Roc2F5ZXIgZWZmZWN0XSBubyBjdXJzZSBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzb290aHNheWVyIGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGdhaW5pbmcgYSBjdXJzZWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjdXJzZUNhcmRJZHMuc2xpY2UoLTEpWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbc29vdGhzYXllciBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkcmF3aW5nIDEgY2FyZGApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IHRhcmdldFBsYXllcklkIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3N0b25lbWFzb24nOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChjYXJkRWZmZWN0QXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGlmICghZXZlbnRBcmdzLmJvdWdodCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc3RvbmVtYXNvbiBvbkdhaW5lZCBlZmZlY3RdICR7ZXZlbnRBcmdzLmNhcmRJZH0gd2FzIG5vdCBib3VnaHQsIHNraXBwaW5nYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBib3VnaHRTdGF0cyA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnN0YXRzLmNhcmRzQm91Z2h0W2V2ZW50QXJncy5jYXJkSWRdO1xuICAgICAgICBjb25zdCBvdmVycGFpZCA9IGJvdWdodFN0YXRzLnBhaWQgLSBib3VnaHRTdGF0cy5jb3N0O1xuICAgICAgICBcbiAgICAgICAgaWYgKG92ZXJwYWlkIDw9IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3N0b25lbWFzb24gb25HYWluZWQgZWZmZWN0XSAke2V2ZW50QXJncy5jYXJkSWR9IHdhcyBub3Qgb3ZlcnBhaWQsIHNraXBwaW5nYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkSWRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsgY2FyZFR5cGU6ICdBQ1RJT04nIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCwga2luZDogJ2V4YWN0JywgYW1vdW50OiB7IHRyZWFzdXJlOiBvdmVycGFpZCB9XG4gICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3N0b25lbWFzb24gdHJpZ2dlcmVkIGVmZmVjdF0gbm8gY2FyZHMgaW4gc3VwcGx5IHdpdGggY29zdCAke292ZXJwYWlkfWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgbnVtVG9HYWluID0gTWF0aC5taW4oMiwgY2FyZElkcy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzdG9uZW1hc29uIG9uR2FpbmVkIGVmZmVjdF0gZ2FpbmluZyAke251bVRvR2Fpbn0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVG9HYWluOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgICAgIHJlc3RyaWN0OiBjYXJkSWRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtzdG9uZW1hc29uIHRyaWdnZXJlZCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZCA9IHNlbGVjdGVkQ2FyZElkc1swXTtcbiAgICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtzdG9uZW1hc29uIG9uR2FpbmVkIGVmZmVjdF0gcGxheWVyICR7ZXZlbnRBcmdzLnBsYXllcklkfSBnYWluaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoaGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzdG9uZW1hc29uIGVmZmVjdF0gbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW3N0b25lbWFzb24gZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzdG9uZW1hc29uIGVmZmVjdF0gcGxheWVyICR7Y2FyZEVmZmVjdEFyZ3MucGxheWVySWR9IHRyYXNoaW5nICR7Y2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZHNbMF0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZCwge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAge1xuICAgICAgICAgIGtpbmQ6ICd1cFRvJyxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgYW1vdW50OiB7XG4gICAgICAgICAgICB0cmVhc3VyZTogY29zdC50cmVhc3VyZSAtIDEsXG4gICAgICAgICAgICBwb3Rpb246IDFcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3RvbmVtYXNvbiBlZmZlY3RdIG5vIGNhcmRzIGluIHN1cHBseSB3aXRoIGNvc3QgJHtjb3N0fSBvciBsZXNzIHRvIGdhaW5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBudW1Ub0dhaW4gPSBNYXRoLm1pbigyLCBjYXJkSWRzLmxlbmd0aCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc3RvbmVtYXNvbiBlZmZlY3RdIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSBnYWluaW5nICR7bnVtVG9HYWlufSBjYXJkc2ApO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVRvR2FpbjsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogY2FyZElkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtzdG9uZW1hc29uIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzdG9uZW1hc29uIGVmZmVjdF0gcGxheWVyICR7Y2FyZEVmZmVjdEFyZ3MucGxheWVySWR9IGdhaW5pbmcgJHtjYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZHNbMF0sXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3lvdW5nLXdpdGNoJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3lvdW5nIHdpdGNoIGVmZmVjdF0gZHJhd2luZyAyIGNhcmRzYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgY29uc3QgY291bnQgPSBNYXRoLm1pbigyLCBoYW5kLmxlbmd0aCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbeW91bmcgd2l0Y2ggZWZmZWN0XSBzZWxlY3RpbmcgJHtjb3VudH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZHNgLFxuICAgICAgICByZXN0cmljdDogY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpLFxuICAgICAgICBjb3VudCxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt5b3VuZyB3aXRjaCBlZmZlY3RdIG5vIGNhcmRzIHNlbGVjdGVkYCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt5b3VuZyB3aXRjaCBlZmZlY3RdIHBsYXllciAke2NhcmRFZmZlY3RBcmdzLnBsYXllcklkfSBkaXNjYXJkaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBoYW5kSWRzID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBjb25zdCBoYW5kQ2FyZHMgPSBoYW5kSWRzLm1hcChjYXJkSWQgPT4gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpKTtcbiAgICAgICAgY29uc3QgYmFuZUNhcmRzID0gaGFuZENhcmRzLmZpbHRlcihjYXJkID0+IGNhcmQudGFncz8uaW5jbHVkZXMoJ2JhbmUnKSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjdXJzZUNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoXG4gICAgICAgICAgW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ2N1cnNlJyB9XVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFjdXJzZUNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt5b3VuZyB3aXRjaCBlZmZlY3RdIG5vIGN1cnNlIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHJldmVhbCA9IGZhbHNlO1xuICAgICAgICBcbiAgICAgICAgaWYgKGJhbmVDYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt5b3VuZyB3aXRjaCBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBoYXMgYSBiYW5lLCBhc2tpbmcgdG8gcmV2ZWFsYCk7XG4gICAgICAgICAgY29uc3QgYmFuZUNhcmQgPSBiYW5lQ2FyZHNbMF07XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgcHJvbXB0OiBgUmV2ZWFsICR7YmFuZUNhcmQuY2FyZE5hbWV9YCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ0NhbmNlbCcsIGFjdGlvbjogMSB9LFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnUmV2ZWFsJywgYWN0aW9uOiAyIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIFxuICAgICAgICAgIHJldmVhbCA9IHJlc3VsdC5hY3Rpb24gPT09IDI7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbeW91bmcgd2l0Y2ggZWZmZWN0XSBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gcmV2ZWFsZWQgYSBiYW5lYCk7XG4gICAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogYmFuZUNhcmQuaWQsXG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZXZlYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFyZXZlYWwpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3lvdW5nIHdpdGNoIGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGRpZCBub3QgcmV2ZWFsIGEgYmFuZWApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGN1cnNlQ2FyZElkc1swXS5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBleHBhbnNpb247XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsU0FBUyxrQkFBa0IsUUFBUSxzQ0FBc0M7QUFDekUsU0FBUyxjQUFjLFFBQVEsbUNBQW1DO0FBQ2xFLFNBQVMscUJBQXFCLFFBQVEsNENBQTRDO0FBQ2xGLFNBQVMsYUFBYSxRQUFRLGtDQUFrQztBQUNoRSxTQUFTLFlBQVksUUFBUSxnQ0FBZ0M7QUFHN0QsTUFBTSxZQUFpQztFQUNyQyxXQUFXO0lBQ1QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1FBQy9DLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBQ3BFLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUNoRyxNQUFNLGdCQUF3QixFQUFFO1FBRWhDLFFBQVEsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUM7UUFFaEQsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSztVQUMxQixJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7WUFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQyw0Q0FBNEMsQ0FBQztZQUMxRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtjQUFFLFVBQVUsZUFBZSxRQUFRO1lBQUM7WUFFOUYsSUFBSSxLQUFLLE1BQU0sS0FBSyxHQUFHO2NBQ3JCLFFBQVEsR0FBRyxDQUFDLENBQUMsaURBQWlELENBQUM7Y0FDL0Q7WUFDRjtVQUNGO1VBRUEsTUFBTSxTQUFTLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFDaEMsTUFBTSxPQUFPLGVBQWUsV0FBVyxD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
// denoCacheMetadata=3450492341474415892,15354911266809624606