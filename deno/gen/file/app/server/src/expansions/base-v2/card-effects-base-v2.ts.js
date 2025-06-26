import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
const expansionModule = {
  'copper': {
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'gold': {
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        await runGameActionDelegate('gainTreasure', {
          count: 3
        });
      }
  },
  'silver': {
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
      }
  },
  'artisan': {
    registerEffects: ()=>async ({ cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[ARTISAN EFFECT] choosing card to gain...`);
        //Gain a card to your hand costing up to 5 Treasure.
        //Put a card from your hand onto your deck.
        let results = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card to gain',
          playerId: playerId,
          restrict: [
            {
              location: [
                'kingdomSupply',
                'basicSupply'
              ]
            },
            {
              playerId,
              kind: 'upTo',
              amount: {
                treasure: 5
              }
            }
          ]
        });
        let selectedCardId = results[0];
        console.log(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
        console.log(`[ARTISAN EFFECT] gaining card to hand...`);
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: selectedCardId,
          to: {
            location: 'playerHand'
          }
        });
        console.log(`[ARTISAN EFFECT] choosing card to put on deck...`);
        results = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card to top-deck',
          playerId: playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId)
        });
        selectedCardId = results[0];
        console.log(`[ARTISAN EFFECT] card chosen ${cardLibrary.getCard(selectedCardId)}`);
        console.log(`[ARTISAN EFFECT] moving card to deck...`);
        await runGameActionDelegate('moveCard', {
          toPlayerId: playerId,
          cardId: selectedCardId,
          to: {
            location: 'playerDeck'
          }
        });
      }
  },
  'bandit': {
    registerEffects: ()=>async ({ match, cardLibrary, playerId, runGameActionDelegate, reactionContext, ...args })=>{
        //Gain a Gold. Each other player reveals the top 2 cards of their deck,
        // trashes a revealed Treasure other than Copper, and discards the rest.
        const goldCardId = args.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'gold'
          }
        ])?.slice(-1)?.[0].id;
        if (goldCardId) {
          console.log(`[BANDIT EFFECT] gaining a gold to discard...`);
          const goldCard = cardLibrary.getCard(goldCardId);
          await runGameActionDelegate('gainCard', {
            playerId,
            cardId: goldCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        } else {
          console.log(`[BANDIT EFFECT] no gold in supply`);
        }
        const targetPlayerIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        console.log(`[BANDIT EFFECT] targets ${targetPlayerIds}`);
        for (const targetPlayerId of targetPlayerIds){
          const playerDeck = args.cardSourceController.getSource('playerDeck', targetPlayerId);
          const playerDiscard = args.cardSourceController.getSource('playerDiscard', targetPlayerId);
          let numToReveal = 2;
          const totalCards = playerDiscard.length + playerDeck.length;
          numToReveal = Math.min(numToReveal, totalCards);
          if (numToReveal === 0) {
            console.log(`[BANDIT EFFECT] player has no cards to reveal`);
            continue;
          }
          if (playerDeck.length < numToReveal) {
            console.log(`[BANDIT EFFECT] not enough cards in deck, shuffling...`);
            await runGameActionDelegate('shuffleDeck', {
              playerId: targetPlayerId
            });
          }
          const cardIdsToReveal = playerDeck.slice(-numToReveal);
          for (const cardId of cardIdsToReveal){
            console.log(`[BANDIT EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
            await runGameActionDelegate('revealCard', {
              playerId: targetPlayerId,
              cardId,
              moveToSetAside: true
            });
          }
          const possibleCardIdsToTrash = cardIdsToReveal.filter((cardId)=>{
            const card = cardLibrary.getCard(cardId);
            return card.cardKey !== 'copper' && card.type.includes('TREASURE');
          });
          let cardIdTrashed;
          if (possibleCardIdsToTrash.length > 0) {
            console.log(`[BANDIT EFFECT] cards that can be trashed ${possibleCardIdsToTrash.map((cardId)=>cardLibrary.getCard(cardId))}`);
            // they get a choice if there is more than one to trash, and they are different
            const giveChoice = possibleCardIdsToTrash.length > 1 && cardLibrary.getCard(possibleCardIdsToTrash[0]).cardKey !== cardLibrary.getCard(possibleCardIdsToTrash[1]).cardKey;
            if (giveChoice) {
              console.log(`[BANDIT EFFECT] prompt user to select card to trash...`);
              const results = await runGameActionDelegate('userPrompt', {
                playerId: targetPlayerId,
                prompt: 'Choose a treasure to trash',
                content: {
                  type: 'select',
                  cardIds: possibleCardIdsToTrash,
                  selectCount: 1
                }
              });
              cardIdTrashed = results?.[0];
            } else {
              cardIdTrashed = possibleCardIdsToTrash[0];
              console.log(`[BANDIT EFFECT] not giving player choice, auto trashing ${cardLibrary.getCard(cardIdTrashed)}`);
            }
            console.log(`[BANDIT EFFECT] player chose ${cardLibrary.getCard(cardIdTrashed)}`);
            console.log(`[BANDIT EFFECT] trashing card...`);
            await runGameActionDelegate('trashCard', {
              playerId: targetPlayerId,
              cardId: cardIdTrashed
            });
          } else {
            console.log(`[BANDIT EFFECT] no possible cards to trash`);
          }
          const cardIdsToDiscard = cardIdsToReveal.filter((cardId)=>!possibleCardIdsToTrash.includes(cardId)).concat(possibleCardIdsToTrash.filter((id)=>id !== cardIdTrashed));
          if (cardIdsToDiscard.length > 0) {
            console.log(`[BANDIT EFFECT] cards that will be discarded ${cardIdsToDiscard.map((cardId)=>cardLibrary.getCard(cardId))}`);
            for (const cardId of cardIdsToDiscard){
              console.log(`[BANDIT EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
              await runGameActionDelegate('discardCard', {
                playerId: targetPlayerId,
                cardId
              });
            }
          } else {
            console.log(`[BANDIT EFFECT] no cards to discard`);
          }
        }
      }
  },
  'bureaucrat': {
    registerEffects: ()=>async ({ reactionContext, match, cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        // Gain a Silver onto your deck. Each other player reveals a Victory card
        // from their hand and puts it onto their deck (or reveals a hand with no Victory cards).
        const silverCardId = args.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'silver'
          }
        ])?.slice(-1)?.[0].id;
        if (!silverCardId) {
          console.log('[BUREAUCRAT EFFECT] no silver in supply');
        } else {
          console.log(`[BUREAUCRAT EFFECT] gaining silver to deck...`);
          await runGameActionDelegate('gainCard', {
            playerId,
            cardId: silverCardId,
            to: {
              location: 'playerDeck'
            }
          });
        }
        const targetPlayerIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        console.log(`[BUREAUCRAT EFFECT] targeting ${targetPlayerIds.map((id)=>getPlayerById(match, id))}`);
        for (const targetPlayerId of targetPlayerIds){
          const hand = args.findCards({
            location: 'playerHand',
            playerId: targetPlayerId
          });
          const victoryCardsInHand = hand.filter((c)=>c.type.includes('VICTORY'));
          if (victoryCardsInHand.length === 0) {
            console.log(`[BUREAUCRAT EFFECT] ${getPlayerById(match, targetPlayerId)} has no victory cards, revealing all`);
            for (const card of hand){
              console.log(`[BUREAUCRAT EFFECT] revealing ${card}...`);
              await runGameActionDelegate('revealCard', {
                playerId: targetPlayerId,
                cardId: card.id
              });
            }
          } else {
            let cardToReveal;
            if (hand.length === 1 || hand[0].cardKey === hand[1].cardKey) {
              console.log(`[BUREAUCRAT EFFECT] only one card to reveal or cards are the same, auto selecting`);
              cardToReveal = hand[0];
            } else {
              console.log(`[BUREAUCRAT EFFECT] prompting user to select card to reveal...`);
              const cardIds = await runGameActionDelegate('selectCard', {
                prompt: 'Reveal victory card',
                playerId: targetPlayerId,
                count: 1,
                restrict: [
                  {
                    location: 'playerHand',
                    playerId
                  },
                  {
                    cardType: 'VICTORY'
                  }
                ]
              });
              cardToReveal = cardLibrary.getCard(cardIds[0]);
            }
            console.log(`[BUREAUCRAT EFFECT] revealing ${cardToReveal}...`);
            await runGameActionDelegate('revealCard', {
              playerId: targetPlayerId,
              cardId: cardToReveal.id
            });
            console.log(`[BUREAUCRAT EFFECT] moving card to deck`);
            await runGameActionDelegate('moveCard', {
              toPlayerId: targetPlayerId,
              cardId: cardToReveal.id,
              to: {
                location: 'playerDeck'
              }
            });
          }
        }
      }
  },
  'cellar': {
    registerEffects: ()=>async ({ match, runGameActionDelegate, playerId, cardLibrary, ...args })=>{
        console.log(`[CELLAR EFFECT] gaining action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const hasCards = args.findCards({
          location: 'playerHand',
          playerId
        }).length > 0;
        if (!hasCards) {
          console.log('[CELLAR EFFECT] player has no cards to choose from');
          return;
        }
        console.log(`[CELLAR EFFECT] prompting user to select cards to discard...`);
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const cardIds = await runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Confirm discard',
          playerId: playerId,
          count: {
            kind: 'upTo',
            count: hand.length
          },
          restrict: hand
        });
        console.log(`[CELLAR EFFECT] user selected ${cardIds.length} cards`);
        if (!cardIds.length) {
          return;
        }
        for (const cardId of cardIds){
          console.log(`[CELLAR EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('discardCard', {
            cardId,
            playerId
          });
        }
        await runGameActionDelegate('drawCard', {
          playerId,
          count: cardIds.length
        });
      }
  },
  'chapel': {
    registerEffects: ()=>async ({ match, runGameActionDelegate, cardLibrary, playerId, ...args })=>{
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (!hand.length) {
          console.log(`[CHAPEL EFFECT] player has no cards in hand`);
          return;
        }
        const cardIds = await runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Confirm trash',
          playerId,
          count: {
            kind: 'upTo',
            count: 4
          },
          restrict: args.cardSourceController.getSource('playerHand', playerId)
        });
        if (cardIds?.length === 0) {
          console.log('[CHAPEL EFFECT] no cards selected');
          return;
        }
        for (const cardId of cardIds){
          console.log(`[CELLAR EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId
          });
        }
      }
  },
  'council-room': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, playerId })=>{
        console.log(`[COUNCIL ROOM EFFECT] drawing 4 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 4
        });
        console.log(`[COUNCIL ROOM EFFECT] gaining buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
        const playerIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        });
        console.log(`[COUNCIL ROOM EFFECT] targets ${playerIds.map((id)=>getPlayerById(match, id))}`);
        for (const playerId of playerIds){
          console.log(`[COUNCIL EFFECT] ${getPlayerById(match, playerId)} drawing card...`);
          await runGameActionDelegate('drawCard', {
            playerId
          });
        }
      }
  },
  'festival': {
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        console.log(`[FESTIVAL EFFECT] gaining 2 actions...`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        console.log(`[FESTIVAL EFFECT] gaining 1 buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
        console.log(`[FESTIVAL EFFECT] gaining 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
      }
  },
  'gardens': {
    registerScoringFunction: ()=>({ match, ownerId, ...args })=>{
        const cards = args.findCards({
          owner: ownerId
        });
        return Math.floor(cards.length / 10);
      },
    registerEffects: ()=>async ()=>{
        console.log(`[GARDENS EFFECT] garden has no effects`);
      }
  },
  'harbinger': {
    registerEffects: ()=>async ({ cardLibrary, match, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[HARBINGER EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[HARBINGER EFFECT] drawing 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        if (args.findCards({
          location: 'playerDiscard',
          playerId
        }).length === 0) {
          console.log('[HARBINGER EFFECT] player has no cards in discard');
          return;
        }
        console.log(`[HARBINGER EFFECT] prompting user to select card from discard...`);
        const results = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Choose card to put on deck?',
          actionButtons: [
            {
              label: 'CANCEL',
              action: 2
            }
          ],
          content: {
            type: 'select',
            cardIds: args.findCards({
              location: 'playerDiscard',
              playerId
            }).map((card)=>card.id),
            selectCount: 1
          }
        });
        if (results.action === 2) {
          console.log('[HARBINGER EFFECT] no card selected');
          return;
        }
        const selectedId = results?.result?.[0];
        if (selectedId) {
          console.log(`[HARBINGER EFFECT] card selected: ${cardLibrary.getCard(selectedId)}`);
          console.log(`[HARBINGER EFFECT] moving card to deck...`);
          await runGameActionDelegate('moveCard', {
            cardId: selectedId,
            toPlayerId: playerId,
            to: {
              location: 'playerDeck'
            }
          });
        } else {
          console.log('[HARBINGER EFFECT] no card selected');
        }
      }
  },
  'laboratory': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[LABORATORY EFFECT] drawing 2 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 2
        });
        console.log(`[LABORATORY EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
      }
  },
  'library': {
    registerEffects: ()=>async ({ match, runGameActionDelegate, cardLibrary, playerId, ...args })=>{
        // Draw until you have 7 cards in hand, skipping any Action cards
        // you choose to; set those aside, discarding them afterward.
        const setAside = [];
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', playerId);
        console.log(`[LIBRARY EFFECT] hand size is ${hand.length}`);
        // total hand size should be 7 when done. because i'm drawing to hand and not really
        // placing them in an 'aside' area, the total hand size should be 7 plus the set aside cards.
        // we also make sure the deck+discard length is great enough to be able to draw a card.
        while(hand.length < 7 && deck.length + discard.length > 0){
          console.log(`[LIBRARY EFFECT] drawing card...`);
          const cardId = await runGameActionDelegate('drawCard', {
            playerId
          });
          if (!cardId) {
            console.warn(`[library effect] no card drawn`);
            break;
          }
          const card = cardLibrary.getCard(cardId);
          if (card.type.includes('ACTION')) {
            console.log(`[LIBRARY EFFECT] ${card} is an action prompting user to set aside...`);
            const setAsideResult = await runGameActionDelegate('userPrompt', {
              playerId,
              prompt: `You drew ${card.cardName}. Set it aside (skip putting it in your hand)?`,
              actionButtons: [
                {
                  label: 'KEEP',
                  action: 1
                },
                {
                  label: 'SET ASIDE',
                  action: 2
                }
              ]
            });
            if (setAsideResult.action === 2) {
              console.log(`[LIBRARY EFFECT] setting card aside`);
              await runGameActionDelegate('moveCard', {
                cardId,
                toPlayerId: playerId,
                to: {
                  location: 'set-aside'
                }
              });
              setAside.push(cardId);
            } else {
              console.log('[LIBRARY EFFECT] keeping card in hand');
            }
          } else {
            console.log(`[LIBRARY EFFECT] card was not an action, keeping in hand`);
          }
        }
        if (setAside.length === 0) {
          console.log(`[LIBRARY EFFECT] no set aside cards, done`);
          return;
        }
        for (const cardId of setAside){
          console.log(`[LIBRARY EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('discardCard', {
            cardId,
            playerId
          });
        }
      }
  },
  'market': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[MARKET EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[MARKET EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        console.log(`[MARKET EFFECT] gaining 1 buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
        console.log(`[MARKET EFFECT] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'merchant': {
    registerLifeCycleMethods: ()=>({
        onCardPlayed: async ({ reactionManager }, { cardId, playerId })=>{
          reactionManager.registerReactionTemplate({
            id: `merchant:${cardId}:cardPlayed`,
            playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            listeningFor: 'cardPlayed',
            condition: ({ cardLibrary, trigger: silverTrigger, match })=>{
              const silverCard = cardLibrary.getCard(silverTrigger.args.cardId);
              if (silverCard.cardKey !== 'silver') return false;
              const playedCardInfo = match.stats.playedCards;
              const playedSilvers = Object.keys(playedCardInfo).filter((cardId)=>cardLibrary.getCard(+cardId).cardKey === 'silver' && playedCardInfo[+cardId].turnNumber === match.turnNumber && playedCardInfo[+cardId].playerId === silverTrigger.args.playerId);
              return playedSilvers.length === 1;
            },
            triggeredEffectFn: async ({ runGameActionDelegate })=>{
              await runGameActionDelegate('gainTreasure', {
                count: 1
              }, {
                loggingContext: {
                  source: cardId
                }
              });
            }
          });
        },
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`merchant:${cardId}:cardPlayed`);
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[MERCHANT EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[MERCHANT EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
      }
  },
  'militia': {
    registerEffects: ()=>async ({ runGameActionDelegate, cardLibrary, match, reactionContext, playerId, ...args })=>{
        console.log(`[MILITIA EFFECT] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const playerIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        console.log(`[MILITIA EFFECT] targets ${playerIds.map((id)=>getPlayerById(match, id))}`);
        for (const playerId of playerIds){
          const hand = args.cardSourceController.getSource('playerHand', playerId);
          const handCount = hand.length;
          console.log(`[MILITIA EFFECT] ${getPlayerById(match, playerId)} has ${handCount} cards in hand`);
          if (handCount <= 3) {
            continue;
          }
          const selectCount = handCount - 3;
          console.log(`[MILITIA EFFECT] prompting user to select ${selectCount} hands`);
          const cardIds = await runGameActionDelegate('selectCard', {
            prompt: 'Confirm discard',
            playerId,
            count: selectCount,
            restrict: args.cardSourceController.getSource('playerHand', playerId)
          });
          for (const cardId of cardIds){
            console.log(`[MILITIA EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
            await runGameActionDelegate('discardCard', {
              cardId,
              playerId
            });
          }
        }
      }
  },
  'mine': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, cardLibrary, playerId, cardPriceController, ...args })=>{
        // You may trash a Treasure from your hand. Gain a Treasure to
        // your hand costing up to 3 Treasure more than it.
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const hasTreasureCards = hand.some((c)=>cardLibrary.getCard(c).type.includes('TREASURE'));
        if (!hasTreasureCards) {
          console.log(`[MINE EFFECT] player has no treasure cards in hand`);
          return;
        }
        console.log(`[MINE EFFECT] prompting player to trash a treasure`);
        let cardIds = await runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Confirm trash',
          playerId: playerId,
          count: {
            kind: 'upTo',
            count: 1
          },
          restrict: [
            {
              location: 'playerHand',
              playerId
            },
            {
              cardType: [
                'TREASURE'
              ]
            }
          ]
        });
        let cardId = cardIds?.[0];
        if (!cardId) {
          console.log(`[MINE EFFECT] player selected no card`);
          return;
        }
        console.log(`[MINE EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
        console.log(`[MINE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId
        });
        let card = cardLibrary.getCard(cardId);
        const { cost: cardCost } = cardPriceController.applyRules(card, {
          playerId
        });
        console.log(`[MINE EFFECT] prompting user to select treasure costing up to ${cardCost.treasure + 3}`);
        cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Confirm gain card',
          playerId: playerId,
          count: 1,
          restrict: [
            {
              location: [
                'kingdomSupply',
                'basicSupply'
              ]
            },
            {
              cardType: [
                'TREASURE'
              ]
            },
            {
              playerId,
              kind: 'upTo',
              amount: {
                treasure: cardCost.treasure + 3,
                potion: cardCost.potion
              }
            }
          ]
        });
        cardId = cardIds?.[0];
        if (!cardId) {
          console.log(`[MINE EFFECT] no card selected`);
          return;
        }
        card = cardLibrary.getCard(cardId);
        console.log(`[MINE EFFECT] player selected ${card}`);
        console.log(`[MINE EFFECT] gaining card to hand`);
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId,
          to: {
            location: 'playerHand'
          }
        });
      }
  },
  'moat': {
    registerLifeCycleMethods: ()=>({
        onEnterHand: async ({ reactionManager }, { playerId, cardId })=>{
          reactionManager.registerReactionTemplate({
            id: `moat:${cardId}:cardPlayed`,
            playerId,
            listeningFor: 'cardPlayed',
            allowMultipleInstances: false,
            condition: ({ cardLibrary, trigger })=>{
              return cardLibrary.getCard(trigger.args.cardId).type.includes('ATTACK') && trigger.args.playerId !== playerId;
            },
            triggeredEffectFn: async function({ runGameActionDelegate, reaction }) {
              const sourceId = reaction.getSourceId();
              await runGameActionDelegate('revealCard', {
                cardId: sourceId,
                playerId: reaction.playerId
              });
              return 'immunity';
            }
          });
        },
        onLeaveHand: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`moat:${cardId}:cardPlayed`);
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        await runGameActionDelegate('drawCard', {
          playerId
        });
        await runGameActionDelegate('drawCard', {
          playerId
        });
      }
  },
  'moneylender': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, cardLibrary, playerId, ...args })=>{
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const hasCopper = hand.some((c)=>cardLibrary.getCard(c).cardKey === 'copper');
        if (!hasCopper) {
          console.log(`[MONEYLENDER EFFECT] player has no copper in hand`);
          return;
        }
        console.log(`[MONEYLENDER EFFECT] prompting user to trash a copper`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          actionButtons: [
            {
              action: 1,
              label: `DON'T TRASH`
            },
            {
              action: 2,
              label: 'TRASH'
            }
          ],
          prompt: 'Trash a copper?'
        });
        if (result.action === 1) {
          console.log(`[MONEYLENDER EFFECT] player chose not to trash`);
          return;
        }
        const card = hand.map(cardLibrary.getCard).find((c)=>c.cardKey === 'copper');
        if (!card) {
          console.warn(`[MONEYLENDER EFFECT] no copper in hand`);
          return;
        }
        console.log(`[MONEYLENDER EFFECT] trashing ${card}...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId: card.id
        });
        console.log(`[MONEYLENDER EFFECT] gaining 3 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 3
        });
      }
  },
  'poacher': {
    registerEffects: ()=>async ({ cardLibrary, match, playerId, runGameActionDelegate, ...args })=>{
        console.log(`[POACHER EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[POACHER EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        console.log(`[POACHER EFFECT] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const allSupplyCardKeys = match.config.basicSupply.concat(match.config.kingdomSupply);
        console.log(`[POACHER EFFECT] original supply card piles ${allSupplyCardKeys}`);
        const remainingSupplyCardKeys = args.findCards({
          location: [
            'basicSupply',
            'kingdomSupply'
          ]
        }).map((card)=>card.cardKey).reduce((prev, cardKey)=>{
          if (prev.includes(cardKey)) {
            return prev;
          }
          return prev.concat(cardKey);
        }, []);
        console.log(`[POACHER EFFECT] remaining supply card piles ${remainingSupplyCardKeys}`);
        const emptyPileCount = allSupplyCardKeys.length - remainingSupplyCardKeys.length;
        console.log(`[POACHER EFFECT] number of empty supply piles ${emptyPileCount}`);
        if (emptyPileCount === 0) {
          return;
        }
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (hand.length === 0) {
          console.log(`[POACHER EFFECT] no cards in hand to discard`);
          return;
        }
        let numToDiscard = Math.min(hand.length, emptyPileCount);
        console.log(`[POACHER EFFECT] number of cards to discard ${numToDiscard}`);
        if (hand.length < emptyPileCount) {
          numToDiscard = Math.min(hand.length, emptyPileCount);
          console.log(`[POACHER EFFECT] not enough cards in hand changing number to discard to ${numToDiscard}`);
        }
        if (numToDiscard === 0) {
          console.log(`[POACHER EFFECT] no cards to discard`);
          return;
        }
        console.log(`[POACHER EFFECT] prompting user to discard cards...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Confirm discard',
          playerId: playerId,
          count: numToDiscard,
          restrict: args.cardSourceController.getSource('playerHand', playerId)
        });
        for (const cardId of cardIds){
          console.log(`[POACHER EFFECT] discarding card ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('discardCard', {
            playerId,
            cardId
          });
        }
      }
  },
  'remodel': {
    registerEffects: ()=>async ({ match, cardLibrary, playerId, runGameActionDelegate, cardPriceController, ...args })=>{
        if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
          console.log(`[REMODEL EFFECT] player has no cards in hand`);
          return;
        }
        let cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Trash card',
          playerId: playerId,
          count: 1,
          restrict: args.cardSourceController.getSource('playerHand', playerId)
        });
        let cardId = cardIds[0];
        const card = cardLibrary.getCard(cardId);
        console.log(`[REMODEL EFFECT] trashing card ${card}...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId
        });
        const { cost: cardCost } = cardPriceController.applyRules(card, {
          playerId
        });
        console.log(`[REMODEL EFFECT] prompting user to select card costing up to ${cardCost.treasure}...`);
        cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Gain card',
          playerId,
          count: 1,
          restrict: [
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              playerId,
              kind: 'upTo',
              amount: {
                treasure: cardCost.treasure + 2,
                potion: card.cost.potion
              }
            }
          ]
        });
        cardId = cardIds[0];
        console.log(`[REMODEL EFFECT] gaining ${cardLibrary.getCard(cardId)} to discard...`);
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'sentry': {
    registerEffects: ()=>async ({ runGameActionDelegate, cardLibrary, match, playerId, ...args })=>{
        // +1 Card
        // +1 Action
        // Look at the top 2 cards of your deck. Trash and/or discard any number of
        // them. Put the rest back on top in any order.
        console.log(`[SENTRY EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[SENTRY EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', playerId);
        let numToLookAt = 2;
        console.log(`[SENTRY EFFECT] number of cards to look at ${numToLookAt}`);
        if (deck.length + discard.length < numToLookAt) {
          numToLookAt = Math.min(2, deck.length + discard.length);
          console.log(`[SENTRY EFFECT] not enough cards, number of cards to look at is now ${numToLookAt}`);
        }
        if (numToLookAt === 0) {
          console.log(`[SENTRY EFFECT] player does not have enough cards`);
          return;
        }
        if (deck.length < 2) {
          console.debug(`[SENTRY EFFECT] player has ${deck.length} cards in deck, shuffling deck`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
        }
        const cardsToLookAtIds = deck.slice(-numToLookAt);
        console.debug(`[SENTRY EFFECT] looking at cards ${cardsToLookAtIds.map((id)=>cardLibrary.getCard(id))}`);
        console.log(`[SENTRY EFFECT] prompting user to trash cards...`);
        let result = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Choose card/s to trash?',
          validationAction: 1,
          actionButtons: [
            {
              label: `DON'T TRASH`,
              action: 2
            },
            {
              label: 'TRASH',
              action: 1
            }
          ],
          content: {
            type: 'select',
            cardIds: cardsToLookAtIds,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAtIds.length
            }
          }
        });
        const cardIdsToTrash = result?.result ?? [];
        if (result.action === 1) {
          console.debug(`[SENTRY EFFECT] player selected ${cardIdsToTrash.map((id)=>cardLibrary.getCard(id))} to trash`);
          for (const cardId of cardIdsToTrash){
            console.log(`[SENTRY EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
            await runGameActionDelegate('trashCard', {
              playerId,
              cardId: cardId
            });
          }
        } else {
          console.debug(`[SENTRY EFFECT] player chose not to trash anything`);
        }
        const possibleCardsToDiscard = cardsToLookAtIds.filter((id)=>!cardIdsToTrash.includes(id));
        if (possibleCardsToDiscard.length === 0) {
          console.debug(`[SENTRY EFFECT] all cards trashed or not more to discard`);
          return;
        }
        result = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Choose card/s to discard?',
          validationAction: 1,
          actionButtons: [
            {
              label: `DON'T DISCARD`,
              action: 2
            },
            {
              label: 'DISCARD',
              action: 1
            }
          ],
          content: {
            type: 'select',
            cardIds: possibleCardsToDiscard,
            selectCount: {
              kind: 'upTo',
              count: possibleCardsToDiscard.length
            }
          }
        });
        let cardsToDiscard = [];
        if (result.action === 2) {
          console.debug(`[SENTRY EFFECT] player chose not to discard`);
        } else {
          cardsToDiscard = result?.result ?? [];
          console.debug(`[SENTRY EFFECT] player chose ${cardsToDiscard.map((id)=>cardLibrary.getCard(id))} to discard`);
          for (const selectedCardId of cardsToDiscard){
            console.log(`[SENTRY EFFECT] discarding ${cardLibrary.getCard(selectedCardId)}`);
            await runGameActionDelegate('discardCard', {
              playerId,
              cardId: selectedCardId
            });
          }
        }
        const remainingCardIds = cardsToLookAtIds.filter((id)=>!cardIdsToTrash.includes(id) && !cardsToDiscard.includes(id));
        if (remainingCardIds.length <= 1) {
          console.debug(`[SENTRY EFFECT] not enough cards to rearrange`);
          return;
        }
        console.debug(`[SENTRY EFFECT] prompting user to rearrange cards...`);
        result = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'rearrange cards',
          actionButtons: [
            {
              action: 1,
              label: 'DONE'
            }
          ],
          content: {
            type: 'rearrange',
            cardIds: remainingCardIds
          }
        });
        const cardIds = result.result;
        for (const cardId of cardIds){
          console.log(`[SENTRY EFFECT] putting ${cardLibrary.getCard(cardId)} on top of deck...`);
          await runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: {
              location: 'playerDeck'
            }
          });
        }
      }
  },
  'smithy': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[SMITHY EFFECT] drawing 3 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 3
        });
      }
  },
  'throne-room': {
    registerEffects: ()=>async ({ playerId, runGameActionDelegate, cardLibrary, ...args })=>{
        console.log(`[THRONE ROOM EFFECT] prompting user to select action card from hand...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Choose action',
          playerId,
          count: {
            kind: 'upTo',
            count: 1
          },
          restrict: [
            {
              location: 'playerHand',
              playerId
            },
            {
              cardType: [
                'ACTION'
              ]
            }
          ]
        });
        const cardId = cardIds?.[0];
        if (!cardId) {
          console.debug(`[THRONE ROOM EFFECT] player chose no cards`);
          return;
        }
        console.log(`[THRONE ROOM EFFECT] player selected ${cardLibrary.getCard(cardId)}`);
        for(let i = 0; i < 2; i++){
          console.log(`[THRONE ROOM EFFECT] running generator...`);
          await runGameActionDelegate('playCard', {
            playerId,
            cardId,
            overrides: {
              actionCost: 0
            }
          });
        }
      }
  },
  'vassal': {
    registerEffects: ()=>async ({ cardLibrary, match, playerId, runGameActionDelegate, ...args })=>{
        console.log(`[VASSAL EFFECT] gain 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const playerDeck = args.cardSourceController.getSource('playerDeck', playerId);
        if (playerDeck.length === 0) {
          console.debug(`[VASSAL EFFECT] not enough cards in deck, shuffling`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
        }
        const cardToDiscardId = playerDeck.slice(-1)?.[0];
        if (!cardToDiscardId) {
          console.debug('[VASSAL EFFECT] no cards to discard...');
          return;
        }
        console.log(`[VASSAL EFFECT] discarding ${cardLibrary.getCard(cardToDiscardId)}...`);
        await runGameActionDelegate('discardCard', {
          playerId,
          cardId: cardToDiscardId
        });
        const card = cardLibrary.getCard(cardToDiscardId);
        if (!card.type.includes('ACTION')) {
          console.debug(`[VASSAL EFFECT] card is not an action, done processing`);
          return;
        }
        console.log(`[VASSAL EFFECT] prompting user to play card or not...`);
        const confirm = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: `Play card ${card.cardName}?`,
          actionButtons: [
            {
              label: `DON'T PLAY`,
              action: 1
            },
            {
              label: 'PLAY',
              action: 2
            }
          ]
        });
        if (confirm.action !== 2) {
          console.debug(`[VASSAL EFFECT] player chose not to play card`);
          return;
        }
        console.log(`[VASSAL EFFECT] invoking game action generator...`);
        await runGameActionDelegate('playCard', {
          playerId,
          cardId: card.id,
          overrides: {
            actionCost: 0
          }
        });
      }
  },
  'village': {
    registerEffects: ()=>async ({ playerId, runGameActionDelegate })=>{
        console.log(`[VILLAGE EFFECT] gaining 2 actions...`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        console.log(`[VILLAGE EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
      }
  },
  'witch': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, playerId, cardLibrary, reactionContext, ...args })=>{
        console.log(`[WITCH EFFECT] drawing 2 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 2
        });
        const playerIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        console.debug(`[WITCH EFFECT] targets ${playerIds.map((id)=>getPlayerById(match, id))}`);
        for (const playerId of playerIds){
          const curseCards = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ]);
          if (!curseCards.length) {
            console.debug(`[WITCH EFFECT] no curse cards in supply`);
            return;
          }
          await runGameActionDelegate('gainCard', {
            playerId,
            cardId: curseCards.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'workshop': {
    registerEffects: ()=>async ({ runGameActionDelegate, cardLibrary, playerId, ...args })=>{
        console.log(`[WORKSHOP EFFECT] prompting player to select card to gain...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Gain card',
          playerId: playerId,
          count: 1,
          restrict: [
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              playerId,
              kind: 'upTo',
              amount: {
                treasure: 4
              }
            }
          ]
        });
        const cardId = cardIds[0];
        console.log(`[WORKSHOP EFFECT] gaining card ${cardLibrary.getCard(cardId)}`);
        await runGameActionDelegate('gainCard', {
          playerId: playerId,
          cardId,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  }
};
export default expansionModule;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9iYXNlLXYyL2NhcmQtZWZmZWN0cy1iYXNlLXYyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZpbmRPcmRlcmVkVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2ZpbmQtb3JkZXJlZC10YXJnZXRzLnRzJztcbmltcG9ydCB7IGdldFBsYXllckJ5SWQgfSBmcm9tICcuLi8uLi91dGlscy9nZXQtcGxheWVyLWJ5LWlkLnRzJztcbmltcG9ydCB7IENhcmRFeHBhbnNpb25Nb2R1bGUgfSBmcm9tICcuLi8uLi90eXBlcy50cyc7XG5pbXBvcnQgeyBDYXJkIH0gZnJvbSBcInNoYXJlZC9zaGFyZWQtdHlwZXMudHNcIjtcblxuY29uc3QgZXhwYW5zaW9uTW9kdWxlOiBDYXJkRXhwYW5zaW9uTW9kdWxlID0ge1xuICAnY29wcGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICB9XG4gIH0sXG4gICdnb2xkJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMyB9KTtcbiAgICB9XG4gIH0sXG4gICdzaWx2ZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUgfSkgPT4ge1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2FydGlzYW4nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBjYXJkTGlicmFyeSwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0FSVElTQU4gRUZGRUNUXSBjaG9vc2luZyBjYXJkIHRvIGdhaW4uLi5gKTtcbiAgICAgIC8vR2FpbiBhIGNhcmQgdG8geW91ciBoYW5kIGNvc3RpbmcgdXAgdG8gNSBUcmVhc3VyZS5cbiAgICAgIC8vUHV0IGEgY2FyZCBmcm9tIHlvdXIgaGFuZCBvbnRvIHlvdXIgZGVjay5cbiAgICAgIFxuICAgICAgbGV0IHJlc3VsdHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ0Nob29zZSBjYXJkIHRvIGdhaW4nLFxuICAgICAgICBwbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydraW5nZG9tU3VwcGx5JywgJ2Jhc2ljU3VwcGx5J10gfSxcbiAgICAgICAgICB7IHBsYXllcklkLCBraW5kOiAndXBUbycsIGFtb3VudDogeyB0cmVhc3VyZTogNSB9IH1cbiAgICAgICAgXVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGxldCBzZWxlY3RlZENhcmRJZCA9IHJlc3VsdHNbMF07XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQVJUSVNBTiBFRkZFQ1RdIGNhcmQgY2hvc2VuICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZCl9YCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQVJUSVNBTiBFRkZFQ1RdIGdhaW5pbmcgY2FyZCB0byBoYW5kLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgdG86IHtcbiAgICAgICAgICBsb2NhdGlvbjogJ3BsYXllckhhbmQnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQVJUSVNBTiBFRkZFQ1RdIGNob29zaW5nIGNhcmQgdG8gcHV0IG9uIGRlY2suLi5gKTtcbiAgICAgIFxuICAgICAgcmVzdWx0cyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIGNhcmQgdG8gdG9wLWRlY2snLFxuICAgICAgICBwbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZCA9IHJlc3VsdHNbMF07XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQVJUSVNBTiBFRkZFQ1RdIGNhcmQgY2hvc2VuICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZCl9YCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQVJUSVNBTiBFRkZFQ1RdIG1vdmluZyBjYXJkIHRvIGRlY2suLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgIHRvOiB7XG4gICAgICAgICAgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2JhbmRpdCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7XG4gICAgICBtYXRjaCxcbiAgICAgIGNhcmRMaWJyYXJ5LFxuICAgICAgcGxheWVySWQsXG4gICAgICBydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICByZWFjdGlvbkNvbnRleHQsXG4gICAgICAuLi5hcmdzXG4gICAgfSkgPT4ge1xuICAgICAgLy9HYWluIGEgR29sZC4gRWFjaCBvdGhlciBwbGF5ZXIgcmV2ZWFscyB0aGUgdG9wIDIgY2FyZHMgb2YgdGhlaXIgZGVjayxcbiAgICAgIC8vIHRyYXNoZXMgYSByZXZlYWxlZCBUcmVhc3VyZSBvdGhlciB0aGFuIENvcHBlciwgYW5kIGRpc2NhcmRzIHRoZSByZXN0LlxuICAgICAgXG4gICAgICBjb25zdCBnb2xkQ2FyZElkID0gYXJncy5maW5kQ2FyZHMoW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ2dvbGQnIH1dKVxuICAgICAgICA/LnNsaWNlKC0xKT8uWzBdLmlkO1xuICAgICAgXG4gICAgICBpZiAoZ29sZENhcmRJZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIGdhaW5pbmcgYSBnb2xkIHRvIGRpc2NhcmQuLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGdvbGRDYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChnb2xkQ2FyZElkKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBnb2xkQ2FyZC5pZCxcbiAgICAgICAgICB0bzoge1xuICAgICAgICAgICAgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIG5vIGdvbGQgaW4gc3VwcGx5YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBtYXRjaCxcbiAgICAgIH0pLmZpbHRlcigoaWQpID0+IHJlYWN0aW9uQ29udGV4dD8uW2lkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtCQU5ESVQgRUZGRUNUXSB0YXJnZXRzICR7dGFyZ2V0UGxheWVySWRzfWApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBwbGF5ZXJEZWNrID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIGNvbnN0IHBsYXllckRpc2NhcmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGlzY2FyZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBudW1Ub1JldmVhbCA9IDI7XG4gICAgICAgIGNvbnN0IHRvdGFsQ2FyZHMgPSBwbGF5ZXJEaXNjYXJkLmxlbmd0aCArIHBsYXllckRlY2subGVuZ3RoO1xuICAgICAgICBcbiAgICAgICAgbnVtVG9SZXZlYWwgPSBNYXRoLm1pbihudW1Ub1JldmVhbCwgdG90YWxDYXJkcyk7XG4gICAgICAgIFxuICAgICAgICBpZiAobnVtVG9SZXZlYWwgPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIHBsYXllciBoYXMgbm8gY2FyZHMgdG8gcmV2ZWFsYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChwbGF5ZXJEZWNrLmxlbmd0aCA8IG51bVRvUmV2ZWFsKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtCQU5ESVQgRUZGRUNUXSBub3QgZW5vdWdoIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZy4uLmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRJZHNUb1JldmVhbCA9IHBsYXllckRlY2suc2xpY2UoLW51bVRvUmV2ZWFsKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGNhcmRJZHNUb1JldmVhbCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQkFORElUIEVGRkVDVF0gcmV2ZWFsaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwb3NzaWJsZUNhcmRJZHNUb1RyYXNoID0gY2FyZElkc1RvUmV2ZWFsLmZpbHRlcigoY2FyZElkKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgICAgICByZXR1cm4gY2FyZC5jYXJkS2V5ICE9PSAnY29wcGVyJyAmJiBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgbGV0IGNhcmRJZFRyYXNoZWQ6IG51bWJlcjtcbiAgICAgICAgaWYgKHBvc3NpYmxlQ2FyZElkc1RvVHJhc2gubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQkFORElUIEVGRkVDVF0gY2FyZHMgdGhhdCBjYW4gYmUgdHJhc2hlZCAke3Bvc3NpYmxlQ2FyZElkc1RvVHJhc2gubWFwKFxuICAgICAgICAgICAgKGNhcmRJZCkgPT4gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpKX1gXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyB0aGV5IGdldCBhIGNob2ljZSBpZiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIHRvIHRyYXNoLCBhbmQgdGhleSBhcmUgZGlmZmVyZW50XG4gICAgICAgICAgY29uc3QgZ2l2ZUNob2ljZSA9IHBvc3NpYmxlQ2FyZElkc1RvVHJhc2gubGVuZ3RoID4gMSAmJlxuICAgICAgICAgICAgKGNhcmRMaWJyYXJ5LmdldENhcmQocG9zc2libGVDYXJkSWRzVG9UcmFzaFswXSkuY2FyZEtleSAhPT0gKGNhcmRMaWJyYXJ5LmdldENhcmQocG9zc2libGVDYXJkSWRzVG9UcmFzaFsxXSkuY2FyZEtleSkpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChnaXZlQ2hvaWNlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIHByb21wdCB1c2VyIHRvIHNlbGVjdCBjYXJkIHRvIHRyYXNoLi4uYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIGEgdHJlYXN1cmUgdG8gdHJhc2gnLFxuICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3NlbGVjdCcsXG4gICAgICAgICAgICAgICAgY2FyZElkczogcG9zc2libGVDYXJkSWRzVG9UcmFzaCxcbiAgICAgICAgICAgICAgICBzZWxlY3RDb3VudDogMSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjYXJkSWRUcmFzaGVkID0gcmVzdWx0cz8uWzBdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNhcmRJZFRyYXNoZWQgPSBwb3NzaWJsZUNhcmRJZHNUb1RyYXNoWzBdO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtCQU5ESVQgRUZGRUNUXSBub3QgZ2l2aW5nIHBsYXllciBjaG9pY2UsIGF1dG8gdHJhc2hpbmcgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZFRyYXNoZWQpfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIHBsYXllciBjaG9zZSAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkVHJhc2hlZCl9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtCQU5ESVQgRUZGRUNUXSB0cmFzaGluZyBjYXJkLi4uYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZFRyYXNoZWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtCQU5ESVQgRUZGRUNUXSBubyBwb3NzaWJsZSBjYXJkcyB0byB0cmFzaGApO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkSWRzVG9EaXNjYXJkID1cbiAgICAgICAgICBjYXJkSWRzVG9SZXZlYWwuZmlsdGVyKGNhcmRJZCA9PiAhcG9zc2libGVDYXJkSWRzVG9UcmFzaC5pbmNsdWRlcyhjYXJkSWQpKVxuICAgICAgICAgICAgLmNvbmNhdChwb3NzaWJsZUNhcmRJZHNUb1RyYXNoLmZpbHRlcihpZCA9PiBpZCAhPT0gY2FyZElkVHJhc2hlZCkpO1xuICAgICAgICBcbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkSWRzVG9EaXNjYXJkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIGNhcmRzIHRoYXQgd2lsbCBiZSBkaXNjYXJkZWQgJHtjYXJkSWRzVG9EaXNjYXJkLm1hcChcbiAgICAgICAgICAgIChjYXJkSWQpID0+IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKSl9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZElkc1RvRGlzY2FyZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtCQU5ESVQgRUZGRUNUXSBkaXNjYXJkaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JBTkRJVCBFRkZFQ1RdIG5vIGNhcmRzIHRvIGRpc2NhcmRgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2J1cmVhdWNyYXQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoe1xuICAgICAgcmVhY3Rpb25Db250ZXh0LFxuICAgICAgbWF0Y2gsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSxcbiAgICAgIHBsYXllcklkLFxuICAgICAgLi4uYXJnc1xuICAgIH0pID0+IHtcbiAgICAgIFxuICAgICAgLy8gR2FpbiBhIFNpbHZlciBvbnRvIHlvdXIgZGVjay4gRWFjaCBvdGhlciBwbGF5ZXIgcmV2ZWFscyBhIFZpY3RvcnkgY2FyZFxuICAgICAgLy8gZnJvbSB0aGVpciBoYW5kIGFuZCBwdXRzIGl0IG9udG8gdGhlaXIgZGVjayAob3IgcmV2ZWFscyBhIGhhbmQgd2l0aCBubyBWaWN0b3J5IGNhcmRzKS5cbiAgICAgIGNvbnN0IHNpbHZlckNhcmRJZCA9IGFyZ3MuZmluZENhcmRzKFt7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1dKVxuICAgICAgICA/LnNsaWNlKC0xKT8uWzBdLmlkO1xuICAgICAgXG4gICAgICBpZiAoIXNpbHZlckNhcmRJZCkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0JVUkVBVUNSQVQgRUZGRUNUXSBubyBzaWx2ZXIgaW4gc3VwcGx5Jyk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtCVVJFQVVDUkFUIEVGRkVDVF0gZ2FpbmluZyBzaWx2ZXIgdG8gZGVjay4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNpbHZlckNhcmRJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgbWF0Y2gsXG4gICAgICB9KS5maWx0ZXIoKGlkKSA9PiByZWFjdGlvbkNvbnRleHQ/LltpZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQlVSRUFVQ1JBVCBFRkZFQ1RdIHRhcmdldGluZyAke3RhcmdldFBsYXllcklkcy5tYXAoKGlkKSA9PiBnZXRQbGF5ZXJCeUlkKG1hdGNoLCBpZCkpfWApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBoYW5kID0gYXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB2aWN0b3J5Q2FyZHNJbkhhbmQgPSBoYW5kLmZpbHRlcigoYykgPT4gYy50eXBlLmluY2x1ZGVzKCdWSUNUT1JZJykpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHZpY3RvcnlDYXJkc0luSGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JVUkVBVUNSQVQgRUZGRUNUXSAke2dldFBsYXllckJ5SWQobWF0Y2gsIHRhcmdldFBsYXllcklkKX0gaGFzIG5vIHZpY3RvcnkgY2FyZHMsIHJldmVhbGluZyBhbGxgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgaGFuZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtCVVJFQVVDUkFUIEVGRkVDVF0gcmV2ZWFsaW5nICR7Y2FyZH0uLi5gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBsZXQgY2FyZFRvUmV2ZWFsOiBDYXJkO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMSB8fCAoaGFuZFswXS5jYXJkS2V5ID09PSBoYW5kWzFdLmNhcmRLZXkpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0JVUkVBVUNSQVQgRUZGRUNUXSBvbmx5IG9uZSBjYXJkIHRvIHJldmVhbCBvciBjYXJkcyBhcmUgdGhlIHNhbWUsIGF1dG8gc2VsZWN0aW5nYCk7XG4gICAgICAgICAgICBjYXJkVG9SZXZlYWwgPSBoYW5kWzBdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQlVSRUFVQ1JBVCBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBjYXJkIHRvIHJldmVhbC4uLmApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgICAgICBwcm9tcHQ6ICdSZXZlYWwgdmljdG9yeSBjYXJkJyxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsb2NhdGlvbjogJ3BsYXllckhhbmQnLFxuICAgICAgICAgICAgICAgICAgcGxheWVySWRcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHsgY2FyZFR5cGU6ICdWSUNUT1JZJyB9LFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjYXJkVG9SZXZlYWwgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZHNbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JVUkVBVUNSQVQgRUZGRUNUXSByZXZlYWxpbmcgJHtjYXJkVG9SZXZlYWx9Li4uYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9SZXZlYWwuaWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtCVVJFQVVDUkFUIEVGRkVDVF0gbW92aW5nIGNhcmQgdG8gZGVja2ApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICB0b1BsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvUmV2ZWFsLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnY2VsbGFyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgbWF0Y2gsIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQsIGNhcmRMaWJyYXJ5LCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtDRUxMQVIgRUZGRUNUXSBnYWluaW5nIGFjdGlvbi4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywge1xuICAgICAgICBjb3VudDogMVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhc0NhcmRzID0gYXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCB9KS5sZW5ndGggPiAwO1xuICAgICAgXG4gICAgICBpZiAoIWhhc0NhcmRzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ0VMTEFSIEVGRkVDVF0gcGxheWVyIGhhcyBubyBjYXJkcyB0byBjaG9vc2UgZnJvbScpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ0VMTEFSIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gc2VsZWN0IGNhcmRzIHRvIGRpc2NhcmQuLi5gKTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgIHByb21wdDogJ0NvbmZpcm0gZGlzY2FyZCcsXG4gICAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IHsga2luZDogJ3VwVG8nLCBjb3VudDogaGFuZC5sZW5ndGggfSxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtDRUxMQVIgRUZGRUNUXSB1c2VyIHNlbGVjdGVkICR7Y2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGlmICghY2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBjYXJkSWRzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ0VMTEFSIEVGRkVDVF0gZGlzY2FyZGluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgY2FyZElkLFxuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiBjYXJkSWRzLmxlbmd0aCB9KTtcbiAgICB9XG4gIH0sXG4gICdjaGFwZWwnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBtYXRjaCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBjYXJkTGlicmFyeSwgcGxheWVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoIWhhbmQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ0hBUEVMIEVGRkVDVF0gcGxheWVyIGhhcyBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgIHByb21wdDogJ0NvbmZpcm0gdHJhc2gnLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IHsga2luZDogJ3VwVG8nLCBjb3VudDogNCB9LFxuICAgICAgICByZXN0cmljdDogYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCksXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKGNhcmRJZHM/Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0NIQVBFTCBFRkZFQ1RdIG5vIGNhcmRzIHNlbGVjdGVkJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZElkcykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0NFTExBUiBFRkZFQ1RdIHRyYXNoaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgY2FyZElkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdjb3VuY2lsLXJvb20nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIG1hdGNoLCBwbGF5ZXJJZCB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0NPVU5DSUwgUk9PTSBFRkZFQ1RdIGRyYXdpbmcgNCBjYXJkcy4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiA0IH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0NPVU5DSUwgUk9PTSBFRkZFQ1RdIGdhaW5pbmcgYnV5Li4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7XG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIG1hdGNoLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09VTkNJTCBST09NIEVGRkVDVF0gdGFyZ2V0cyAke3BsYXllcklkcy5tYXAoKGlkKSA9PiBnZXRQbGF5ZXJCeUlkKG1hdGNoLCBpZCkpfWApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBsYXllcklkIG9mIHBsYXllcklkcykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0NPVU5DSUwgRUZGRUNUXSAke2dldFBsYXllckJ5SWQobWF0Y2gsIHBsYXllcklkKX0gZHJhd2luZyBjYXJkLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdmZXN0aXZhbCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0ZFU1RJVkFMIEVGRkVDVF0gZ2FpbmluZyAyIGFjdGlvbnMuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHtcbiAgICAgICAgY291bnQ6IDIsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtGRVNUSVZBTCBFRkZFQ1RdIGdhaW5pbmcgMSBidXkuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHtcbiAgICAgICAgY291bnQ6IDFcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0ZFU1RJVkFMIEVGRkVDVF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgY291bnQ6IDIsXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdnYXJkZW5zJzoge1xuICAgIHJlZ2lzdGVyU2NvcmluZ0Z1bmN0aW9uOiAoKSA9PiAoeyBtYXRjaCwgb3duZXJJZCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zdCBjYXJkcyA9IGFyZ3MuZmluZENhcmRzKHsgb3duZXI6IG93bmVySWQgfSk7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcihjYXJkcy5sZW5ndGggLyAxMCk7XG4gICAgfSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbR0FSREVOUyBFRkZFQ1RdIGdhcmRlbiBoYXMgbm8gZWZmZWN0c2ApO1xuICAgIH1cbiAgfSxcbiAgJ2hhcmJpbmdlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IGNhcmRMaWJyYXJ5LCBtYXRjaCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0hBUkJJTkdFUiBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtIQVJCSU5HRVIgRUZGRUNUXSBkcmF3aW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7XG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChhcmdzLmZpbmRDYXJkcyh7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcsIHBsYXllcklkIH0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZygnW0hBUkJJTkdFUiBFRkZFQ1RdIHBsYXllciBoYXMgbm8gY2FyZHMgaW4gZGlzY2FyZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbSEFSQklOR0VSIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gc2VsZWN0IGNhcmQgZnJvbSBkaXNjYXJkLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6ICdDaG9vc2UgY2FyZCB0byBwdXQgb24gZGVjaz8nLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogJ0NBTkNFTCcsIGFjdGlvbjogMiB9XSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIGNhcmRJZHM6IGFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJywgcGxheWVySWQgfSkubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgfSxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdHMuYWN0aW9uID09PSAyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbSEFSQklOR0VSIEVGRkVDVF0gbm8gY2FyZCBzZWxlY3RlZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkSWQgPSByZXN1bHRzPy5yZXN1bHQ/LlswXTtcbiAgICAgIFxuICAgICAgaWYgKHNlbGVjdGVkSWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtIQVJCSU5HRVIgRUZGRUNUXSBjYXJkIHNlbGVjdGVkOiAke2NhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRJZCl9YCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW0hBUkJJTkdFUiBFRkZFQ1RdIG1vdmluZyBjYXJkIHRvIGRlY2suLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZElkLFxuICAgICAgICAgIHRvUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnW0hBUkJJTkdFUiBFRkZFQ1RdIG5vIGNhcmQgc2VsZWN0ZWQnKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdsYWJvcmF0b3J5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0xBQk9SQVRPUlkgRUZGRUNUXSBkcmF3aW5nIDIgY2FyZHMuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtMQUJPUkFUT1JZIEVGRkVDVF0gZ2FpbmluZyAxIGFjdGlvbi4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICB9XG4gIH0sXG4gICdsaWJyYXJ5Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgbWF0Y2gsIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgY2FyZExpYnJhcnksIHBsYXllcklkLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIC8vIERyYXcgdW50aWwgeW91IGhhdmUgNyBjYXJkcyBpbiBoYW5kLCBza2lwcGluZyBhbnkgQWN0aW9uIGNhcmRzXG4gICAgICAvLyB5b3UgY2hvb3NlIHRvOyBzZXQgdGhvc2UgYXNpZGUsIGRpc2NhcmRpbmcgdGhlbSBhZnRlcndhcmQuXG4gICAgICBjb25zdCBzZXRBc2lkZTogbnVtYmVyW10gPSBbXTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgY29uc3QgZGVjayA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgcGxheWVySWQpO1xuICAgICAgY29uc3QgZGlzY2FyZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0xJQlJBUlkgRUZGRUNUXSBoYW5kIHNpemUgaXMgJHtoYW5kLmxlbmd0aH1gKTtcbiAgICAgIFxuICAgICAgLy8gdG90YWwgaGFuZCBzaXplIHNob3VsZCBiZSA3IHdoZW4gZG9uZS4gYmVjYXVzZSBpJ20gZHJhd2luZyB0byBoYW5kIGFuZCBub3QgcmVhbGx5XG4gICAgICAvLyBwbGFjaW5nIHRoZW0gaW4gYW4gJ2FzaWRlJyBhcmVhLCB0aGUgdG90YWwgaGFuZCBzaXplIHNob3VsZCBiZSA3IHBsdXMgdGhlIHNldCBhc2lkZSBjYXJkcy5cbiAgICAgIC8vIHdlIGFsc28gbWFrZSBzdXJlIHRoZSBkZWNrK2Rpc2NhcmQgbGVuZ3RoIGlzIGdyZWF0IGVub3VnaCB0byBiZSBhYmxlIHRvIGRyYXcgYSBjYXJkLlxuICAgICAgd2hpbGUgKGhhbmQubGVuZ3RoIDwgNyAmJiAoZGVjay5sZW5ndGggKyBkaXNjYXJkLmxlbmd0aCA+IDApKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTElCUkFSWSBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZElkID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW2xpYnJhcnkgZWZmZWN0XSBubyBjYXJkIGRyYXduYCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbTElCUkFSWSBFRkZFQ1RdICR7Y2FyZH0gaXMgYW4gYWN0aW9uIHByb21wdGluZyB1c2VyIHRvIHNldCBhc2lkZS4uLmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHNldEFzaWRlUmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICBwcm9tcHQ6IGBZb3UgZHJldyAke2NhcmQuY2FyZE5hbWV9LiBTZXQgaXQgYXNpZGUgKHNraXAgcHV0dGluZyBpdCBpbiB5b3VyIGhhbmQpP2AsXG4gICAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogJ0tFRVAnLCBhY3Rpb246IDEgfSwgeyBsYWJlbDogJ1NFVCBBU0lERScsIGFjdGlvbjogMiB9XSxcbiAgICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyIH07XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHNldEFzaWRlUmVzdWx0LmFjdGlvbiA9PT0gMikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtMSUJSQVJZIEVGRkVDVF0gc2V0dGluZyBjYXJkIGFzaWRlYCk7XG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICAgIHRvUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3NldC1hc2lkZScgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzZXRBc2lkZS5wdXNoKGNhcmRJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tMSUJSQVJZIEVGRkVDVF0ga2VlcGluZyBjYXJkIGluIGhhbmQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtMSUJSQVJZIEVGRkVDVF0gY2FyZCB3YXMgbm90IGFuIGFjdGlvbiwga2VlcGluZyBpbiBoYW5kYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKHNldEFzaWRlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0xJQlJBUlkgRUZGRUNUXSBubyBzZXQgYXNpZGUgY2FyZHMsIGRvbmVgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBzZXRBc2lkZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0xJQlJBUlkgRUZGRUNUXSBkaXNjYXJkaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21hcmtldCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtNQVJLRVQgRUZGRUNUXSBkcmF3aW5nIGNhcmQuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkLCB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNQVJLRVQgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW01BUktFVCBFRkZFQ1RdIGdhaW5pbmcgMSBidXkuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHtcbiAgICAgICAgY291bnQ6IDFcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW01BUktFVCBFRkZFQ1RdIGdhaW5pbmcgMSB0cmVhc3VyZS4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7XG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdtZXJjaGFudCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkNhcmRQbGF5ZWQ6IGFzeW5jICh7IHJlYWN0aW9uTWFuYWdlciB9LCB7IGNhcmRJZCwgcGxheWVySWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYG1lcmNoYW50OiR7Y2FyZElkfTpjYXJkUGxheWVkYCxcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkUGxheWVkJyxcbiAgICAgICAgICBjb25kaXRpb246ICh7IGNhcmRMaWJyYXJ5LCB0cmlnZ2VyOiBzaWx2ZXJUcmlnZ2VyLCBtYXRjaCB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzaWx2ZXJDYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChzaWx2ZXJUcmlnZ2VyLmFyZ3MuY2FyZElkISk7XG4gICAgICAgICAgICBpZiAoc2lsdmVyQ2FyZC5jYXJkS2V5ICE9PSAnc2lsdmVyJykgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBwbGF5ZWRDYXJkSW5mbyA9IG1hdGNoLnN0YXRzLnBsYXllZENhcmRzO1xuICAgICAgICAgICAgY29uc3QgcGxheWVkU2lsdmVycyA9IE9iamVjdC5rZXlzKHBsYXllZENhcmRJbmZvKVxuICAgICAgICAgICAgICAuZmlsdGVyKChjYXJkSWQpID0+XG4gICAgICAgICAgICAgICAgY2FyZExpYnJhcnkuZ2V0Q2FyZCgrY2FyZElkKS5jYXJkS2V5ID09PSAnc2lsdmVyJ1xuICAgICAgICAgICAgICAgICYmIHBsYXllZENhcmRJbmZvWytjYXJkSWRdLnR1cm5OdW1iZXIgPT09IG1hdGNoLnR1cm5OdW1iZXJcbiAgICAgICAgICAgICAgICAmJiBwbGF5ZWRDYXJkSW5mb1srY2FyZElkXS5wbGF5ZXJJZCA9PT0gc2lsdmVyVHJpZ2dlci5hcmdzLnBsYXllcklkKVxuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gcGxheWVkU2lsdmVycy5sZW5ndGggPT09IDE7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywge1xuICAgICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICAgIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBjYXJkSWQgfSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoeyByZWFjdGlvbk1hbmFnZXIgfSwgeyBjYXJkSWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYG1lcmNoYW50OiR7Y2FyZElkfTpjYXJkUGxheWVkYCk7XG4gICAgICB9LFxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW01FUkNIQU5UIEVGRkVDVF0gZHJhd2luZyBjYXJkLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCwgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTUVSQ0hBTlQgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxLCB9KTtcbiAgICB9XG4gIH0sXG4gICdtaWxpdGlhJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHtcbiAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSxcbiAgICAgIGNhcmRMaWJyYXJ5LFxuICAgICAgbWF0Y2gsXG4gICAgICByZWFjdGlvbkNvbnRleHQsXG4gICAgICBwbGF5ZXJJZCxcbiAgICAgIC4uLmFyZ3NcbiAgICB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW01JTElUSUEgRUZGRUNUXSBnYWluaW5nIDEgdHJlYXN1cmUuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywge1xuICAgICAgICBjb3VudDogMlxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBtYXRjaCxcbiAgICAgIH0pLmZpbHRlcigoaWQpID0+IHJlYWN0aW9uQ29udGV4dD8uW2lkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNSUxJVElBIEVGRkVDVF0gdGFyZ2V0cyAke3BsYXllcklkcy5tYXAoKGlkKSA9PiBnZXRQbGF5ZXJCeUlkKG1hdGNoLCBpZCkpfWApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBsYXllcklkIG9mIHBsYXllcklkcykge1xuICAgICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCk7XG4gICAgICAgIGNvbnN0IGhhbmRDb3VudCA9IGhhbmQubGVuZ3RoO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtNSUxJVElBIEVGRkVDVF0gJHtnZXRQbGF5ZXJCeUlkKG1hdGNoLCBwbGF5ZXJJZCl9IGhhcyAke2hhbmRDb3VudH0gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICBpZiAoaGFuZENvdW50IDw9IDMpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0Q291bnQgPSBoYW5kQ291bnQgLSAzO1xuICAgICAgICBjb25zb2xlLmxvZyhgW01JTElUSUEgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgJHtzZWxlY3RDb3VudH0gaGFuZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcHJvbXB0OiAnQ29uZmlybSBkaXNjYXJkJyxcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBjb3VudDogc2VsZWN0Q291bnQsXG4gICAgICAgICAgcmVzdHJpY3Q6IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGNhcmRJZHMpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW01JTElUSUEgRUZGRUNUXSBkaXNjYXJkaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21pbmUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoe1xuICAgICAgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLFxuICAgICAgbWF0Y2gsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIHBsYXllcklkLFxuICAgICAgY2FyZFByaWNlQ29udHJvbGxlcixcbiAgICAgIC4uLmFyZ3NcbiAgICB9KSA9PiB7XG4gICAgICAvLyBZb3UgbWF5IHRyYXNoIGEgVHJlYXN1cmUgZnJvbSB5b3VyIGhhbmQuIEdhaW4gYSBUcmVhc3VyZSB0b1xuICAgICAgLy8geW91ciBoYW5kIGNvc3RpbmcgdXAgdG8gMyBUcmVhc3VyZSBtb3JlIHRoYW4gaXQuXG4gICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhc1RyZWFzdXJlQ2FyZHMgPSBoYW5kLnNvbWUoXG4gICAgICAgIChjKSA9PiBjYXJkTGlicmFyeS5nZXRDYXJkKGMpLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpO1xuICAgICAgXG4gICAgICBpZiAoIWhhc1RyZWFzdXJlQ2FyZHMpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtNSU5FIEVGRkVDVF0gcGxheWVyIGhhcyBubyB0cmVhc3VyZSBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNSU5FIEVGRkVDVF0gcHJvbXB0aW5nIHBsYXllciB0byB0cmFzaCBhIHRyZWFzdXJlYCk7XG4gICAgICBcbiAgICAgIGxldCBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgcHJvbXB0OiAnQ29uZmlybSB0cmFzaCcsXG4gICAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IHsga2luZDogJ3VwVG8nLCBjb3VudDogMSB9LFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGxvY2F0aW9uOiAncGxheWVySGFuZCcsXG4gICAgICAgICAgICBwbGF5ZXJJZFxuICAgICAgICAgIH0sXG4gICAgICAgICAgeyBjYXJkVHlwZTogWydUUkVBU1VSRSddIH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbGV0IGNhcmRJZCA9IGNhcmRJZHM/LlswXTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtNSU5FIEVGRkVDVF0gcGxheWVyIHNlbGVjdGVkIG5vIGNhcmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW01JTkUgRUZGRUNUXSBwbGF5ZXIgc2VsZWN0ZWQgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9YCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTUlORSBFRkZFQ1RdIHRyYXNoaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNhcmRJZCxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBsZXQgY2FyZCA9IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc3QgeyBjb3N0OiBjYXJkQ29zdCB9ID0gY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTUlORSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCB0cmVhc3VyZSBjb3N0aW5nIHVwIHRvICR7Y2FyZENvc3QudHJlYXN1cmUgKyAzfWApO1xuICAgICAgXG4gICAgICBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwcm9tcHQ6ICdDb25maXJtIGdhaW4gY2FyZCcsXG4gICAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIHJlc3RyaWN0OiBbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydraW5nZG9tU3VwcGx5JywgJ2Jhc2ljU3VwcGx5J10gfSxcbiAgICAgICAgICB7IGNhcmRUeXBlOiBbJ1RSRUFTVVJFJ10gfSxcbiAgICAgICAgICB7IHBsYXllcklkLCBraW5kOiAndXBUbycsIGFtb3VudDogeyB0cmVhc3VyZTogY2FyZENvc3QudHJlYXN1cmUgKyAzLCBwb3Rpb246IGNhcmRDb3N0LnBvdGlvbiB9IH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY2FyZElkID0gY2FyZElkcz8uWzBdO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW01JTkUgRUZGRUNUXSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2FyZCA9IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNSU5FIEVGRkVDVF0gcGxheWVyIHNlbGVjdGVkICR7Y2FyZH1gKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNSU5FIEVGRkVDVF0gZ2FpbmluZyBjYXJkIHRvIGhhbmRgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNhcmRJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnbW9hdCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkVudGVySGFuZDogYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyIH0sIHsgcGxheWVySWQsIGNhcmRJZCB9KSA9PiB7XG4gICAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICAgIGlkOiBgbW9hdDoke2NhcmRJZH06Y2FyZFBsYXllZGAsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZFBsYXllZCcsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogZmFsc2UsXG4gICAgICAgICAgY29uZGl0aW9uOiAoeyBjYXJkTGlicmFyeSwgdHJpZ2dlciB9KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyLmFyZ3MuY2FyZElkISkudHlwZS5pbmNsdWRlcyhcbiAgICAgICAgICAgICAgJ0FUVEFDSycsXG4gICAgICAgICAgICApICYmIHRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gcGxheWVySWQ7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgZnVuY3Rpb24gKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCByZWFjdGlvbiB9KSB7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2VJZCA9IHJlYWN0aW9uLmdldFNvdXJjZUlkKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgICAgY2FyZElkOiBzb3VyY2VJZCxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IHJlYWN0aW9uLnBsYXllcklkLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiAnaW1tdW5pdHknO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIG9uTGVhdmVIYW5kOiBhc3luYyAoeyByZWFjdGlvbk1hbmFnZXIgfSwgeyBjYXJkSWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYG1vYXQ6JHtjYXJkSWR9OmNhcmRQbGF5ZWRgKTtcbiAgICAgIH0sXG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkIH0pID0+IHtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSk7XG4gICAgfVxuICB9LFxuICAnbW9uZXlsZW5kZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIG1hdGNoLCBjYXJkTGlicmFyeSwgcGxheWVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBoYXNDb3BwZXIgPSBoYW5kLnNvbWUoKGMpID0+XG4gICAgICAgIGNhcmRMaWJyYXJ5LmdldENhcmQoYykuY2FyZEtleSA9PT0gJ2NvcHBlcicpO1xuICAgICAgXG4gICAgICBpZiAoIWhhc0NvcHBlcikge1xuICAgICAgICBjb25zb2xlLmxvZyhgW01PTkVZTEVOREVSIEVGRkVDVF0gcGxheWVyIGhhcyBubyBjb3BwZXIgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTU9ORVlMRU5ERVIgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byB0cmFzaCBhIGNvcHBlcmApO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgeyBhY3Rpb246IDEsIGxhYmVsOiBgRE9OJ1QgVFJBU0hgIH0sIHsgYWN0aW9uOiAyLCBsYWJlbDogJ1RSQVNIJyB9XG4gICAgICAgIF0sXG4gICAgICAgIHByb21wdDogJ1RyYXNoIGEgY29wcGVyPydcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtNT05FWUxFTkRFUiBFRkZFQ1RdIHBsYXllciBjaG9zZSBub3QgdG8gdHJhc2hgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gaGFuZC5tYXAoY2FyZExpYnJhcnkuZ2V0Q2FyZCkuZmluZChjID0+IGMuY2FyZEtleSA9PT0gJ2NvcHBlcicpO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbTU9ORVlMRU5ERVIgRUZGRUNUXSBubyBjb3BwZXIgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTU9ORVlMRU5ERVIgRUZGRUNUXSB0cmFzaGluZyAke2NhcmR9Li4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkLmlkXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNT05FWUxFTkRFUiBFRkZFQ1RdIGdhaW5pbmcgMyB0cmVhc3VyZS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgY291bnQ6IDMsXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdwb2FjaGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgY2FyZExpYnJhcnksIG1hdGNoLCBwbGF5ZXJJZCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbUE9BQ0hFUiBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtQT0FDSEVSIEVGRkVDVF0gZ2FpbmluZyAxIGFjdGlvbi4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1BPQUNIRVIgRUZGRUNUXSBnYWluaW5nIDEgdHJlYXN1cmUuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgYWxsU3VwcGx5Q2FyZEtleXMgPSBtYXRjaC5jb25maWcuYmFzaWNTdXBwbHkuY29uY2F0KFxuICAgICAgICBtYXRjaC5jb25maWcua2luZ2RvbVN1cHBseSxcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbUE9BQ0hFUiBFRkZFQ1RdIG9yaWdpbmFsIHN1cHBseSBjYXJkIHBpbGVzICR7YWxsU3VwcGx5Q2FyZEtleXN9YCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1N1cHBseUNhcmRLZXlzID1cbiAgICAgICAgYXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSlcbiAgICAgICAgICAubWFwKGNhcmQgPT4gY2FyZC5jYXJkS2V5KVxuICAgICAgICAgIC5yZWR1Y2UoKHByZXYsIGNhcmRLZXkpID0+IHtcbiAgICAgICAgICAgIGlmIChwcmV2LmluY2x1ZGVzKGNhcmRLZXkpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwcmV2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByZXYuY29uY2F0KGNhcmRLZXkpO1xuICAgICAgICAgIH0sIFtdIGFzIHN0cmluZ1tdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtQT0FDSEVSIEVGRkVDVF0gcmVtYWluaW5nIHN1cHBseSBjYXJkIHBpbGVzICR7cmVtYWluaW5nU3VwcGx5Q2FyZEtleXN9YCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGVtcHR5UGlsZUNvdW50ID0gYWxsU3VwcGx5Q2FyZEtleXMubGVuZ3RoIC0gcmVtYWluaW5nU3VwcGx5Q2FyZEtleXMubGVuZ3RoO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1BPQUNIRVIgRUZGRUNUXSBudW1iZXIgb2YgZW1wdHkgc3VwcGx5IHBpbGVzICR7ZW1wdHlQaWxlQ291bnR9YCk7XG4gICAgICBcbiAgICAgIGlmIChlbXB0eVBpbGVDb3VudCA9PT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKGhhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUE9BQ0hFUiBFRkZFQ1RdIG5vIGNhcmRzIGluIGhhbmQgdG8gZGlzY2FyZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxldCBudW1Ub0Rpc2NhcmQgPSBNYXRoLm1pbihoYW5kLmxlbmd0aCwgZW1wdHlQaWxlQ291bnQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1BPQUNIRVIgRUZGRUNUXSBudW1iZXIgb2YgY2FyZHMgdG8gZGlzY2FyZCAke251bVRvRGlzY2FyZH1gKTtcbiAgICAgIFxuICAgICAgaWYgKGhhbmQubGVuZ3RoIDwgZW1wdHlQaWxlQ291bnQpIHtcbiAgICAgICAgbnVtVG9EaXNjYXJkID0gTWF0aC5taW4oaGFuZC5sZW5ndGgsIGVtcHR5UGlsZUNvdW50KTtcbiAgICAgICAgY29uc29sZS5sb2coYFtQT0FDSEVSIEVGRkVDVF0gbm90IGVub3VnaCBjYXJkcyBpbiBoYW5kIGNoYW5naW5nIG51bWJlciB0byBkaXNjYXJkIHRvICR7bnVtVG9EaXNjYXJkfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAobnVtVG9EaXNjYXJkID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUE9BQ0hFUiBFRkZFQ1RdIG5vIGNhcmRzIHRvIGRpc2NhcmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1BPQUNIRVIgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBkaXNjYXJkIGNhcmRzLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ0NvbmZpcm0gZGlzY2FyZCcsXG4gICAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgY291bnQ6IG51bVRvRGlzY2FyZCxcbiAgICAgICAgcmVzdHJpY3Q6IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGNhcmRJZHMpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtQT0FDSEVSIEVGRkVDVF0gZGlzY2FyZGluZyBjYXJkICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3JlbW9kZWwnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoe1xuICAgICAgbWF0Y2gsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIHBsYXllcklkLFxuICAgICAgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLFxuICAgICAgY2FyZFByaWNlQ29udHJvbGxlcixcbiAgICAgIC4uLmFyZ3NcbiAgICB9KSA9PiB7XG4gICAgICBpZiAoYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUkVNT0RFTCBFRkZFQ1RdIHBsYXllciBoYXMgbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxldCBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgcGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgcmVzdHJpY3Q6IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGxldCBjYXJkSWQgPSBjYXJkSWRzWzBdO1xuICAgICAgY29uc3QgY2FyZCA9IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtSRU1PREVMIEVGRkVDVF0gdHJhc2hpbmcgY2FyZCAke2NhcmR9Li4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdDogY2FyZENvc3QgfSA9IGNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1JFTU9ERUwgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgY2FyZCBjb3N0aW5nIHVwIHRvICR7Y2FyZENvc3QudHJlYXN1cmV9Li4uYCk7XG4gICAgICBcbiAgICAgIGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ0dhaW4gY2FyZCcsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsgcGxheWVySWQsIGtpbmQ6ICd1cFRvJywgYW1vdW50OiB7IHRyZWFzdXJlOiBjYXJkQ29zdC50cmVhc3VyZSArIDIsIHBvdGlvbjogY2FyZC5jb3N0LnBvdGlvbiB9IH0sXG4gICAgICAgIF0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY2FyZElkID0gY2FyZElkc1swXTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtSRU1PREVMIEVGRkVDVF0gZ2FpbmluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0gdG8gZGlzY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdzZW50cnknOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIGNhcmRMaWJyYXJ5LCBtYXRjaCwgcGxheWVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgLy8gKzEgQ2FyZFxuICAgICAgLy8gKzEgQWN0aW9uXG4gICAgICAvLyBMb29rIGF0IHRoZSB0b3AgMiBjYXJkcyBvZiB5b3VyIGRlY2suIFRyYXNoIGFuZC9vciBkaXNjYXJkIGFueSBudW1iZXIgb2ZcbiAgICAgIC8vIHRoZW0uIFB1dCB0aGUgcmVzdCBiYWNrIG9uIHRvcCBpbiBhbnkgb3JkZXIuXG4gICAgICBjb25zb2xlLmxvZyhgW1NFTlRSWSBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtTRU5UUlkgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHtcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgcGxheWVySWQpO1xuICAgICAgY29uc3QgZGlzY2FyZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBsZXQgbnVtVG9Mb29rQXQgPSAyO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1NFTlRSWSBFRkZFQ1RdIG51bWJlciBvZiBjYXJkcyB0byBsb29rIGF0ICR7bnVtVG9Mb29rQXR9YCk7XG4gICAgICBcbiAgICAgIGlmIChkZWNrLmxlbmd0aCArIGRpc2NhcmQubGVuZ3RoIDwgbnVtVG9Mb29rQXQpIHtcbiAgICAgICAgbnVtVG9Mb29rQXQgPSBNYXRoLm1pbigyLCBkZWNrLmxlbmd0aCArIGRpc2NhcmQubGVuZ3RoKTtcbiAgICAgICAgY29uc29sZS5sb2coYFtTRU5UUlkgRUZGRUNUXSBub3QgZW5vdWdoIGNhcmRzLCBudW1iZXIgb2YgY2FyZHMgdG8gbG9vayBhdCBpcyBub3cgJHtudW1Ub0xvb2tBdH1gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKG51bVRvTG9va0F0ID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbU0VOVFJZIEVGRkVDVF0gcGxheWVyIGRvZXMgbm90IGhhdmUgZW5vdWdoIGNhcmRzYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGRlY2subGVuZ3RoIDwgMikge1xuICAgICAgICBjb25zb2xlLmRlYnVnKGBbU0VOVFJZIEVGRkVDVF0gcGxheWVyIGhhcyAke2RlY2subGVuZ3RofSBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmcgZGVja2ApO1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywge1xuICAgICAgICAgIHBsYXllcklkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkc1RvTG9va0F0SWRzID0gZGVjay5zbGljZSgtbnVtVG9Mb29rQXQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmRlYnVnKGBbU0VOVFJZIEVGRkVDVF0gbG9va2luZyBhdCBjYXJkcyAke2NhcmRzVG9Mb29rQXRJZHMubWFwKFxuICAgICAgICAoaWQpID0+IGNhcmRMaWJyYXJ5LmdldENhcmQoaWQpKX1gKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtTRU5UUlkgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byB0cmFzaCBjYXJkcy4uLmApO1xuICAgICAgXG4gICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIGNhcmQvcyB0byB0cmFzaD8nLFxuICAgICAgICB2YWxpZGF0aW9uQWN0aW9uOiAxLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogYERPTidUIFRSQVNIYCwgYWN0aW9uOiAyIH0sIHsgbGFiZWw6ICdUUkFTSCcsIGFjdGlvbjogMSB9XSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIGNhcmRJZHM6IGNhcmRzVG9Mb29rQXRJZHMsXG4gICAgICAgICAgc2VsZWN0Q291bnQ6IHtcbiAgICAgICAgICAgIGtpbmQ6ICd1cFRvJyxcbiAgICAgICAgICAgIGNvdW50OiBjYXJkc1RvTG9va0F0SWRzLmxlbmd0aCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlcjsgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzVG9UcmFzaCA9IHJlc3VsdD8ucmVzdWx0ID8/IFtdO1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmRlYnVnKGBbU0VOVFJZIEVGRkVDVF0gcGxheWVyIHNlbGVjdGVkICR7Y2FyZElkc1RvVHJhc2gubWFwKFxuICAgICAgICAgIChpZCkgPT4gY2FyZExpYnJhcnkuZ2V0Q2FyZChpZCkpfSB0byB0cmFzaGApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZElkc1RvVHJhc2gpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1NFTlRSWSBFRkZFQ1RdIHRyYXNoaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoYFtTRU5UUlkgRUZGRUNUXSBwbGF5ZXIgY2hvc2Ugbm90IHRvIHRyYXNoIGFueXRoaW5nYCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHBvc3NpYmxlQ2FyZHNUb0Rpc2NhcmQgPSBjYXJkc1RvTG9va0F0SWRzLmZpbHRlcigoaWQpID0+XG4gICAgICAgICFjYXJkSWRzVG9UcmFzaC5pbmNsdWRlcyhpZClcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChwb3NzaWJsZUNhcmRzVG9EaXNjYXJkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmRlYnVnKGBbU0VOVFJZIEVGRkVDVF0gYWxsIGNhcmRzIHRyYXNoZWQgb3Igbm90IG1vcmUgdG8gZGlzY2FyZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHByb21wdDogJ0Nob29zZSBjYXJkL3MgdG8gZGlzY2FyZD8nLFxuICAgICAgICB2YWxpZGF0aW9uQWN0aW9uOiAxLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogYERPTidUIERJU0NBUkRgLCBhY3Rpb246IDIgfSwgeyBsYWJlbDogJ0RJU0NBUkQnLCBhY3Rpb246IDEgfV0sXG4gICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICBjYXJkSWRzOiBwb3NzaWJsZUNhcmRzVG9EaXNjYXJkLFxuICAgICAgICAgIHNlbGVjdENvdW50OiB7XG4gICAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgICBjb3VudDogcG9zc2libGVDYXJkc1RvRGlzY2FyZC5sZW5ndGgsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXI7IHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgbGV0IGNhcmRzVG9EaXNjYXJkOiBudW1iZXJbXSA9IFtdO1xuICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDIpIHtcbiAgICAgICAgY29uc29sZS5kZWJ1ZyhgW1NFTlRSWSBFRkZFQ1RdIHBsYXllciBjaG9zZSBub3QgdG8gZGlzY2FyZGApO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNhcmRzVG9EaXNjYXJkID0gcmVzdWx0Py5yZXN1bHQgPz8gW107XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmRlYnVnKGBbU0VOVFJZIEVGRkVDVF0gcGxheWVyIGNob3NlICR7Y2FyZHNUb0Rpc2NhcmQubWFwKFxuICAgICAgICAgIChpZCkgPT4gY2FyZExpYnJhcnkuZ2V0Q2FyZChpZCkpfSB0byBkaXNjYXJkYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IHNlbGVjdGVkQ2FyZElkIG9mIGNhcmRzVG9EaXNjYXJkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtTRU5UUlkgRUZGRUNUXSBkaXNjYXJkaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZCl9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRJZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZW1haW5pbmdDYXJkSWRzID0gY2FyZHNUb0xvb2tBdElkc1xuICAgICAgICAuZmlsdGVyKGlkID0+ICFjYXJkSWRzVG9UcmFzaC5pbmNsdWRlcyhpZCkgJiYgIWNhcmRzVG9EaXNjYXJkLmluY2x1ZGVzKGlkKSk7XG4gICAgICBcbiAgICAgIGlmIChyZW1haW5pbmdDYXJkSWRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoYFtTRU5UUlkgRUZGRUNUXSBub3QgZW5vdWdoIGNhcmRzIHRvIHJlYXJyYW5nZWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUuZGVidWcoYFtTRU5UUlkgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byByZWFycmFuZ2UgY2FyZHMuLi5gKTtcbiAgICAgIFxuICAgICAgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiAncmVhcnJhbmdlIGNhcmRzJyxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJ0RPTkUnIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICB0eXBlOiAncmVhcnJhbmdlJyxcbiAgICAgICAgICBjYXJkSWRzOiByZW1haW5pbmdDYXJkSWRzXG4gICAgICAgIH1cbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZElkcyA9IHJlc3VsdC5yZXN1bHQ7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGNhcmRJZHMpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtTRU5UUlkgRUZGRUNUXSBwdXR0aW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfSBvbiB0b3Agb2YgZGVjay4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3NtaXRoeSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtTTUlUSFkgRUZGRUNUXSBkcmF3aW5nIDMgY2FyZHMuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkLCBjb3VudDogMyB9KTtcbiAgICB9XG4gIH0sXG4gICd0aHJvbmUtcm9vbSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHBsYXllcklkLCBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIGNhcmRMaWJyYXJ5LCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbVEhST05FIFJPT00gRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgYWN0aW9uIGNhcmQgZnJvbSBoYW5kLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgICBwcm9tcHQ6ICdDaG9vc2UgYWN0aW9uJyxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNvdW50OiB7IGtpbmQ6ICd1cFRvJywgY291bnQ6IDEgfSxcbiAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsb2NhdGlvbjogJ3BsYXllckhhbmQnLFxuICAgICAgICAgICAgcGxheWVySWRcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgY2FyZFR5cGU6IFsnQUNUSU9OJ10gfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSBjYXJkSWRzPy5bMF07XG4gICAgICBcbiAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoYFtUSFJPTkUgUk9PTSBFRkZFQ1RdIHBsYXllciBjaG9zZSBubyBjYXJkc2ApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVEhST05FIFJPT00gRUZGRUNUXSBwbGF5ZXIgc2VsZWN0ZWQgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9YCk7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbVEhST05FIFJPT00gRUZGRUNUXSBydW5uaW5nIGdlbmVyYXRvci4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgb3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICBhY3Rpb25Db3N0OiAwLFxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndmFzc2FsJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgY2FyZExpYnJhcnksIG1hdGNoLCBwbGF5ZXJJZCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbVkFTU0FMIEVGRkVDVF0gZ2FpbiAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywge1xuICAgICAgICBjb3VudDogMixcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBwbGF5ZXJEZWNrID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBwbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChwbGF5ZXJEZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmRlYnVnKGBbVkFTU0FMIEVGRkVDVF0gbm90IGVub3VnaCBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRUb0Rpc2NhcmRJZCA9IHBsYXllckRlY2suc2xpY2UoLTEpPy5bMF07XG4gICAgICBcbiAgICAgIGlmICghY2FyZFRvRGlzY2FyZElkKSB7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoJ1tWQVNTQUwgRUZGRUNUXSBubyBjYXJkcyB0byBkaXNjYXJkLi4uJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtWQVNTQUwgRUZGRUNUXSBkaXNjYXJkaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkVG9EaXNjYXJkSWQpfS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkVG9EaXNjYXJkSWQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZFRvRGlzY2FyZElkKTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKSB7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoYFtWQVNTQUwgRUZGRUNUXSBjYXJkIGlzIG5vdCBhbiBhY3Rpb24sIGRvbmUgcHJvY2Vzc2luZ2ApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVkFTU0FMIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gcGxheSBjYXJkIG9yIG5vdC4uLmApO1xuICAgICAgXG4gICAgICBjb25zdCBjb25maXJtID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgUGxheSBjYXJkICR7Y2FyZC5jYXJkTmFtZX0/YCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW3sgbGFiZWw6IGBET04nVCBQTEFZYCwgYWN0aW9uOiAxIH0sIHsgbGFiZWw6ICdQTEFZJywgYWN0aW9uOiAyIH1dLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciB9O1xuICAgICAgXG4gICAgICBpZiAoY29uZmlybS5hY3Rpb24gIT09IDIpIHtcbiAgICAgICAgY29uc29sZS5kZWJ1ZyhgW1ZBU1NBTCBFRkZFQ1RdIHBsYXllciBjaG9zZSBub3QgdG8gcGxheSBjYXJkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtWQVNTQUwgRUZGRUNUXSBpbnZva2luZyBnYW1lIGFjdGlvbiBnZW5lcmF0b3IuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgb3ZlcnJpZGVzOiB7XG4gICAgICAgICAgYWN0aW9uQ29zdDogMCxcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAndmlsbGFnZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHBsYXllcklkLCBydW5HYW1lQWN0aW9uRGVsZWdhdGUgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtWSUxMQUdFIEVGRkVDVF0gZ2FpbmluZyAyIGFjdGlvbnMuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVklMTEFHRSBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICB9XG4gIH0sXG4gICd3aXRjaCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7XG4gICAgICBydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICBtYXRjaCxcbiAgICAgIHBsYXllcklkLFxuICAgICAgY2FyZExpYnJhcnksXG4gICAgICByZWFjdGlvbkNvbnRleHQsXG4gICAgICAuLi5hcmdzXG4gICAgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtXSVRDSCBFRkZFQ1RdIGRyYXdpbmcgMiBjYXJkcy4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBtYXRjaCxcbiAgICAgIH0pLmZpbHRlcigoaWQpID0+IHJlYWN0aW9uQ29udGV4dD8uW2lkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5kZWJ1ZyhgW1dJVENIIEVGRkVDVF0gdGFyZ2V0cyAke3BsYXllcklkcy5tYXAoKGlkKSA9PiBnZXRQbGF5ZXJCeUlkKG1hdGNoLCBpZCkpfWApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBsYXllcklkIG9mIHBsYXllcklkcykge1xuICAgICAgICBjb25zdCBjdXJzZUNhcmRzID0gYXJncy5maW5kQ2FyZHMoW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ2N1cnNlJyB9XSk7XG4gICAgICAgIGlmICghY3Vyc2VDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmRlYnVnKGBbV0lUQ0ggRUZGRUNUXSBubyBjdXJzZSBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjdXJzZUNhcmRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3dvcmtzaG9wJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBjYXJkTGlicmFyeSwgcGxheWVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtXT1JLU0hPUCBFRkZFQ1RdIHByb21wdGluZyBwbGF5ZXIgdG8gc2VsZWN0IGNhcmQgdG8gZ2Fpbi4uLmApO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwcm9tcHQ6ICdHYWluIGNhcmQnLFxuICAgICAgICBwbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgeyBwbGF5ZXJJZCwga2luZDogJ3VwVG8nLCBhbW91bnQ6IHsgdHJlYXN1cmU6IDQgfSB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZCA9IGNhcmRJZHNbMF07XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbV09SS1NIT1AgRUZGRUNUXSBnYWluaW5nIGNhcmQgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9YClcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGV4cGFuc2lvbk1vZHVsZTtcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsa0JBQWtCLFFBQVEsc0NBQXNDO0FBQ3pFLFNBQVMsYUFBYSxRQUFRLGtDQUFrQztBQUloRSxNQUFNLGtCQUF1QztFQUMzQyxVQUFVO0lBQ1IsaUJBQWlCLElBQU0sT0FBTyxFQUFFLHFCQUFxQixFQUFFO1FBQ3JELE1BQU0sc0JBQXNCLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtNQUN6RDtFQUNGO0VBQ0EsUUFBUTtJQUNOLGlCQUFpQixJQUFNLE9BQU8sRUFBRSxxQkFBcUIsRUFBRTtRQUNyRCxNQUFNLHNCQUFzQixnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7TUFDekQ7RUFDRjtFQUNBLFVBQVU7SUFDUixpQkFBaUIsSUFBTSxPQUFPLEVBQUUscUJBQXFCLEVBQUU7UUFDckQsTUFBTSxzQkFBc0IsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO01BQ3pEO0VBQ0Y7RUFDQSxXQUFXO0lBQ1QsaUJBQWlCLElBQU0sT0FBTyxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxRQUFRLEVBQUUsR0FBRyxNQUFNO1FBQ3JGLFFBQVEsR0FBRyxDQUFDLENBQUMseUNBQXlDLENBQUM7UUFDdkQsb0RBQW9EO1FBQ3BELDJDQUEyQztRQUUz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
// denoCacheMetadata=5625474033709818719,5782492563592805838