import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
const expansionModule = {
  'baron': {
    registerEffects: ()=>async ({ runGameActionDelegate, cardLibrary, match, playerId, ...args })=>{
        // +1 Buy
        // You may discard an Estate for +$4. If you don't, gain an Estate.
        console.log(`[BARON EFFECT] gaining 1 buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const handEstateIdx = hand.findLast((cId)=>cardLibrary.getCard(cId).cardKey === 'estate');
        const supplyEstateIdx = args.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'estate'
          }
        ])?.slice(-1)?.[0].id;
        if (!handEstateIdx) {
          console.log(`[BARON EFFECT] player has no estates in hand, they gain one`);
          if (!supplyEstateIdx) {
            console.log(`[BARON EFFECT] no estates in supply`);
            return;
          }
        } else {
          console.log(`[BARON EFFECT] player has an estate in hand`);
          const confirm = await runGameActionDelegate('userPrompt', {
            playerId,
            prompt: 'Discard estate?',
            actionButtons: [
              {
                label: `DON'T DISCARD`,
                action: 1
              },
              {
                label: 'DISCARD',
                action: 2
              }
            ]
          });
          if (confirm.action === 2) {
            console.log(`[BARON EFFECT] player chooses to discard estate, gain 4 treasure`);
            await runGameActionDelegate('discardCard', {
              cardId: handEstateIdx,
              playerId
            });
            await runGameActionDelegate('gainTreasure', {
              count: 4
            });
            return;
          }
        }
        if (!supplyEstateIdx) {
          console.log(`[BARON EFFECT] no estate in supply`);
          return;
        }
        console.log(`[BARON EFFECT] player not discarding estate, gain ${cardLibrary.getCard(supplyEstateIdx)}...`);
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId: supplyEstateIdx,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'bridge': {
    registerEffects: ()=>async ({ reactionManager, cardLibrary, runGameActionDelegate, cardPriceController, cardId, playerId })=>{
        console.log(`[BRIDGE EFFECT] gaining 1 buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
        console.log(`[BRIDGE EFFECT] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
        console.log(`[BRIDGE EFFECT] modify cost by -1 of all cards...`);
        const allCards = cardLibrary.getAllCardsAsArray();
        const ruleCleanups = [];
        for (const card of allCards){
          ruleCleanups.push(cardPriceController.registerRule(card, (card, context)=>{
            return {
              restricted: false,
              cost: {
                treasure: -1
              }
            };
          }));
        }
        reactionManager.registerReactionTemplate({
          id: `bridge:${cardId}:endTurn`,
          listeningFor: 'endTurn',
          condition: ()=>true,
          triggeredEffectFn: async ()=>{
            for (const rule of ruleCleanups){
              rule();
            }
            reactionManager.unregisterTrigger(`bridge:${cardId}:endTurn`);
          },
          playerId,
          compulsory: true
        });
      }
  },
  'conspirator': {
    registerEffects: ()=>async ({ match, cardLibrary, playerId, runGameActionDelegate })=>{
        console.log(`[CONSPIRATOR EFFECT] gaining 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        // we want those cards played on the player's turn that are actions and played by THAT player
        const actionCardCount = Object.keys(match.stats.playedCards).filter((cardId)=>cardLibrary.getCard(+cardId).type.includes('ACTION') && match.stats.playedCards[+cardId].playerId === playerId);
        console.log(`[CONSPIRATOR EFFECT] action cards played so far ${actionCardCount.length}`);
        if (actionCardCount?.length >= 3) {
          console.log(`[CONSPIRATOR EFFECT] drawing card...`);
          await runGameActionDelegate('drawCard', {
            playerId
          });
          console.log(`[CONSPIRATOR EFFECT] gaining 1 action...`);
          await runGameActionDelegate('gainAction', {
            count: 1
          });
        }
      }
  },
  'courtier': {
    registerEffects: ()=>async ({ match, playerId, cardLibrary, runGameActionDelegate, ...args })=>{
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (!hand.length) {
          console.log(`[COURTIER EFFECT] no cards in hand`);
          return;
        }
        console.log(`[COURTIER EFFECT] prompting user to reveal a card...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Reveal card',
          count: 1,
          playerId,
          restrict: hand
        });
        const cardId = cardIds[0];
        console.log(`[COURTIER EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
        await runGameActionDelegate('revealCard', {
          cardId,
          playerId
        });
        let cardTypeCount = cardLibrary.getCard(cardId).type.length;
        console.log(`[COURTIER EFFECT] card has ${cardTypeCount} types`);
        cardTypeCount = Math.min(cardTypeCount, 4);
        console.log(`[COURTIER EFFECT] final choice count ${cardTypeCount}`);
        const choices = [
          {
            label: '+1 Action',
            action: 1
          },
          {
            label: '+1 Buy',
            action: 2
          },
          {
            label: '+3 Treasure',
            action: 3
          },
          {
            label: 'Gain a gold',
            action: 4
          }
        ];
        for(let i = 0; i < cardTypeCount; i++){
          console.log(`[COURTIER EFFECT] prompting user to select an action...`);
          const result = await runGameActionDelegate('userPrompt', {
            playerId,
            prompt: 'Choose one',
            actionButtons: choices
          });
          const resultAction = result.action;
          console.log(`[COURTIER EFFECT] player chose '${choices.find((c)=>c.action === resultAction)?.label}'`);
          const idx = choices.findIndex((c)=>c.action === resultAction);
          choices.splice(idx, 1);
          switch(resultAction){
            case 1:
              console.log(`[COURTIER EFFECT] gaining 1 action...`);
              await runGameActionDelegate('gainAction', {
                count: 1
              });
              break;
            case 2:
              console.log(`[COURTIER EFFECT] gaining 1 buy...`);
              await runGameActionDelegate('gainBuy', {
                count: 1
              });
              break;
            case 3:
              console.log(`[COURTIER EFFECT] gaining 1 treasure...`);
              await runGameActionDelegate('gainTreasure', {
                count: 3
              });
              break;
            case 4:
              {
                const goldCardId = args.findCards([
                  {
                    location: 'basicSupply'
                  },
                  {
                    cardKeys: 'gold'
                  }
                ])?.slice(-1)?.[0].id;
                if (!goldCardId) {
                  console.log(`[COURTIER EFFECT] no gold in supply...`);
                  break;
                }
                console.log(`[COURTIER EFFECT] gaining ${cardLibrary.getCard(goldCardId)}...`);
                await runGameActionDelegate('gainCard', {
                  cardId: goldCardId,
                  playerId,
                  to: {
                    location: 'playerDiscard'
                  }
                });
                break;
              }
          }
        }
      }
  },
  'courtyard': {
    registerEffects: ()=>async ({ match, runGameActionDelegate, playerId, cardLibrary, ...args })=>{
        console.log(`[COURTYARD EFFECT] drawing 3 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 3
        });
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (!hand.length) {
          console.log(`[COURTYARD EFFECT] no cards in hand`);
          return;
        }
        console.log(`[COURTYARD EFFECT] prompting user to put card onto deck...`);
        const result = await runGameActionDelegate('selectCard', {
          prompt: 'Top deck',
          count: 1,
          playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId)
        });
        const cardId = result[0];
        console.log(`[COURTYARD EFFECT] moving ${cardLibrary.getCard(cardId)} to top of deck...`);
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: {
            location: 'playerDeck'
          }
        });
      }
  },
  'diplomat': {
    registerLifeCycleMethods: ()=>({
        onEnterHand: async ({ reactionManager, runGameActionDelegate, ...args }, { playerId, cardId })=>{
          reactionManager.registerReactionTemplate({
            id: `diplomat:${cardId}:cardPlayed`,
            playerId,
            listeningFor: 'cardPlayed',
            condition: ({ match, trigger, cardLibrary, ...args })=>{
              return cardLibrary.getCard(trigger.args.cardId).type.includes('ATTACK') && args.cardSourceController.getSource('playerHand', playerId).length >= 5 && trigger.args.playerId !== playerId;
            },
            triggeredEffectFn: async function({ reaction, cardLibrary }) {
              const sourceId = reaction.getSourceId();
              console.log(`[diplomat triggered effect] running for ${cardLibrary.getCard(cardId)}`);
              await runGameActionDelegate('revealCard', {
                cardId: sourceId,
                playerId: reaction.playerId
              });
              await runGameActionDelegate('drawCard', {
                playerId
              });
              await runGameActionDelegate('drawCard', {
                playerId
              });
              const cardIds = await runGameActionDelegate('selectCard', {
                prompt: 'Confirm discard',
                playerId,
                restrict: args.cardSourceController.getSource('playerHand', playerId),
                count: 3
              });
              for (const cardId of cardIds){
                await runGameActionDelegate('discardCard', {
                  playerId,
                  cardId
                });
              }
            }
          });
        },
        onLeaveHand: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`diplomat:${cardId}:cardPlayed`);
        }
      }),
    registerEffects: ()=>async ({ match, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[DIPLOMAT EFFECT] drawing 2 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 2
        });
        const cardCount = args.cardSourceController.getSource('playerHand', playerId).length;
        if (cardCount <= 5) {
          console.log(`[DIPLOMAT EFFECT] gaining 2 actions...`);
          await runGameActionDelegate('gainAction', {
            count: 2
          });
        } else {
          console.log(`[DIPLOMAT EFFECT] player has more than ${cardCount} cards in hand, can't perform diplomat`);
        }
      }
  },
  'duke': {
    registerScoringFunction: ()=>({ match, cardLibrary, ownerId, ...args })=>{
        const duchies = args.findCards([
          {
            owner: ownerId
          },
          {
            cardKeys: 'duchy'
          }
        ]);
        console.log(`[DUKE SCORING] player ${getPlayerById(match, ownerId)} has ${duchies.length} Duchies`);
        return duchies.length;
      },
    registerEffects: ()=>async ()=>{
        console.log(`[DUKE EFFECT] duke has no effects`);
      }
  },
  'farm': {
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        console.log(`[FARM EFFECT] gaining 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
      }
  },
  'ironworks': {
    registerEffects: ()=>async ({ cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[IRONWORKS EFFECT] prompting user to choose card costing up to 4...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card',
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
              amount: {
                treasure: 4
              },
              kind: 'upTo'
            }
          ],
          playerId
        });
        console.log(`[IRONWORKS EFFECT] gaining ${cardLibrary.getCard(cardIds[0])}...`);
        await runGameActionDelegate('gainCard', {
          cardId: cardIds[0],
          playerId,
          to: {
            location: 'playerDiscard'
          }
        });
        const card = cardLibrary.getCard(cardIds[0]);
        if (card.type.includes('ACTION')) {
          console.log(`[IRONWORKS EFFECT] card is an action, gaining 1 action...`);
          await runGameActionDelegate('gainAction', {
            count: 1
          });
        }
        if (card.type.includes('TREASURE')) {
          console.log(`[IRONWORKS EFFECT] card is a treasure, gaining 1 treasure...`);
          await runGameActionDelegate('gainTreasure', {
            count: 1
          });
        }
        if (card.type.includes('VICTORY')) {
          console.log(`[IRONWORKS EFFECT] card is a victory, drawing card...`);
          await runGameActionDelegate('drawCard', {
            playerId
          });
        }
      }
  },
  'lurker': {
    registerEffects: ()=>async ({ cardLibrary, match, playerId, runGameActionDelegate, ...args })=>{
        console.log(`[LURKER EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        let result = {
          action: 1
        };
        const actionButtons = [
          {
            action: 1,
            label: 'TRASH CARD'
          },
          {
            action: 2,
            label: 'GAIN CARD'
          }
        ];
        result = await runGameActionDelegate('userPrompt', {
          playerId,
          prompt: 'Trash Action card from supply, or gain Action card from trash?',
          actionButtons
        });
        console.log(`[LURKER EFFECT] user choose action ${actionButtons.find((a)=>a.action === result.action)?.label}`);
        if (result.action === 1) {
          console.log(`[LURKER EFFECT] prompting user to select card to trash...`);
          const result = await runGameActionDelegate('selectCard', {
            prompt: 'Confirm trash',
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
                cardType: 'ACTION'
              }
            ]
          });
          const cardId = result[0];
          console.log(`[LURKER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('trashCard', {
            cardId,
            playerId
          });
          return;
        }
        const trash = args.findCards({
          location: 'trash'
        });
        const actionCardIds = trash.filter((cardId)=>cardId.type.includes('ACTION'));
        if (!actionCardIds.length) {
          console.log(`[LURKER EFFECT] trash has no action cards`);
          return;
        }
        if (!trash.some((cId)=>cId.type.includes('ACTION'))) {
          console.log(`[LURKER EFFECT] no action cards in trash, skipping gaining`);
          return;
        }
        let cardId;
        if (args.findCards({
          location: 'trash'
        }).length === 1) {
          console.log(`[LURKER EFFECT] only one card in trash, gaining automatically`);
          cardId = trash[0].id;
        } else {
          console.log(`[LURKER EFFECT] prompting user to select action card to gain...`);
          const chooseCardResult = await runGameActionDelegate('userPrompt', {
            prompt: 'Choose card to gain',
            playerId,
            content: {
              type: 'select',
              selectCount: 1,
              cardIds: actionCardIds.map((card)=>card.id)
            }
          });
          cardId = chooseCardResult.result[0];
        }
        console.log(`[LURKER EFFECT] gaining ${cardLibrary.getCard(cardId)}...`);
        await runGameActionDelegate('gainCard', {
          cardId,
          playerId,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'masquerade': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, match, cardLibrary, ...args })=>{
        console.log(`[masquerade effect] drawing 2 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 2
        });
        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL',
          match
        }).filter((playerId)=>args.cardSourceController.getSource('playerHand', playerId).length > 0);
        console.log(`[masquerade effect] targets in order ${targets.map((t)=>getPlayerById(match, t)).join(',')}`);
        const playerCardMap = new Map();
        for (const playerId of targets){
          console.log(`[masquerade effect] prompting ${getPlayerById(match, playerId)} to choose a card...`);
          const cardIds = await runGameActionDelegate('selectCard', {
            prompt: 'Confirm pass',
            playerId,
            count: 1,
            restrict: args.cardSourceController.getSource('playerHand', playerId)
          });
          playerCardMap.set(playerId, cardIds[0]);
          console.log(`[masquerade effect] ${getPlayerById(match, playerId)} chose ${cardLibrary.getCard(cardIds[0])}`);
        }
        for(let i = 0; i < targets.length; i++){
          const cardId = playerCardMap.get(targets[i]);
          if (!cardId) {
            console.warn(`[masquerade effect] no card for ${getPlayerById(match, targets[i])}`);
            continue;
          }
          const playerId = targets[(i + 1) % targets.length];
          const card = cardLibrary.getCard(cardId);
          card.owner = playerId;
          console.log(`[masquerade effect] moving ${cardLibrary.getCard(cardId)} to ${getPlayerById(match, playerId)}`);
          await runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
        console.log(`[masquerade effect] prompting user to trash card from hand...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Confirm trash',
          count: 1,
          playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId)
        });
        console.log(`[masquerade effect] player chose ${cardIds.length ? cardLibrary.getCard(cardIds[0]) : 'not to trash'}`);
        if (cardIds[0]) {
          console.log(`[masquerade effect] trashing ${cardLibrary.getCard(cardIds[0])}...`);
          await runGameActionDelegate('trashCard', {
            cardId: cardIds[0],
            playerId
          });
        }
      }
  },
  'mill': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, match, cardLibrary, ...args })=>{
        console.log(`[MILL EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[MILL EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (hand.length === 0) {
          console.log(`[MILL EFFECT] player has no cards in hand`);
          return;
        }
        console.log(`[MILL EFFECT] prompting user to select cards to discard`);
        const results = await runGameActionDelegate('selectCard', {
          optional: true,
          prompt: 'Confirm discard',
          playerId,
          restrict: hand,
          count: Math.min(2, hand.length)
        });
        for (const cardId of results){
          console.log(`[MILL EFFECT] discarding ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('discardCard', {
            cardId,
            playerId
          });
        }
        console.log(`[MILL EFFECT] gaining 2 treasure...`);
        if (results.length == 2) {
          await runGameActionDelegate('gainTreasure', {
            count: 2
          });
        }
      }
  },
  'mining-village': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, cardId, cardLibrary })=>{
        console.log(`[MINING VILLAGE EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[MINING VILLAGE EFFECT] gaining 2 actions`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        console.log(`[MINING VILLAGE EFFECT] prompting user to trash mining village or not`);
        const results = await runGameActionDelegate('userPrompt', {
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
          prompt: 'Trash Mining Village?'
        });
        if (results.action === 2) {
          console.log(`[MINING VILLAGE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId
          });
          console.log(`[MINING VILLAGE EFFECT] gaining 2 treasure...`);
          await runGameActionDelegate('gainTreasure', {
            count: 2
          });
        } else {
          console.log(`[MINING VILLAGE EFFECT] player chose not to trash mining village`);
        }
      }
  },
  'minion': {
    registerEffects: ()=>async ({ match, reactionContext, cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[MINION EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        console.log(`[MINION EFFECT] prompting user to gain treasure or discard hand...`);
        const results = await runGameActionDelegate('userPrompt', {
          playerId,
          actionButtons: [
            {
              action: 1,
              label: '+2 Treasure'
            },
            {
              action: 2,
              label: 'Discard hand'
            }
          ]
        });
        if (results.action === 1) {
          console.log(`[MINION EFFECT] gaining 2 treasure...`);
          await runGameActionDelegate('gainTreasure', {
            count: 2
          });
        } else {
          const targets = findOrderedTargets({
            startingPlayerId: playerId,
            appliesTo: 'ALL',
            match
          }).filter((playerId)=>{
            const hand = args.cardSourceController.getSource('playerHand', playerId);
            const handCount = hand.length;
            return playerId === playerId || handCount >= 5 && reactionContext?.[playerId]?.result !== 'immunity';
          });
          for (const playerId of targets){
            const player = getPlayerById(match, playerId);
            const hand = args.cardSourceController.getSource('playerHand', playerId);
            const l = hand.length;
            for(let i = l - 1; i >= 0; i--){
              const cardId = hand[i];
              console.log(`[MINION EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
              await runGameActionDelegate('discardCard', {
                cardId,
                playerId
              });
            }
            console.log(`[MINION EFFECT] ${player} drawing 4 cards...`);
            await runGameActionDelegate('drawCard', {
              playerId,
              count: 4
            });
          }
        }
      }
  },
  'nobles': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[NOBLES EFFECT] prompting user to select actions or treasure`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          actionButtons: [
            {
              action: 1,
              label: '+3 Cards'
            },
            {
              action: 2,
              label: '+2 Actions'
            }
          ],
          prompt: 'Choose one'
        });
        console.log(`[NOBLES EFFECT] player chose ${result.action}`);
        if (result.action === 1) {
          console.log(`[NOBLES EFFECT] drawing 3 cards...`);
          await runGameActionDelegate('drawCard', {
            playerId,
            count: 3
          });
        } else {
          console.log(`[NOBLES EFFECT] gaining 2 actions`);
          await runGameActionDelegate('gainAction', {
            count: 2
          });
        }
      }
  },
  'patrol': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, playerId, cardLibrary, ...args })=>{
        console.log(`[PATROL EFFECT] drawing 3 cards`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 3
        });
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const discard = args.cardSourceController.getSource('playerDiscard', playerId);
        console.log(`[PATROL EFFECT] original num to reveal 4`);
        const numToReveal = Math.min(4, deck.length + discard.length);
        console.log(`[PATROL EFFECT] final num to reveal ${numToReveal}`);
        if (numToReveal === 0) {
          console.log(`[PATROL EFFECT] no cards to reveal`);
          return;
        }
        if (deck.length < numToReveal) {
          console.log(`[PATROL EFFECT] not enough cards in deck, shuffling`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
        }
        const revealedCardIds = args.findCards({
          location: 'playerDeck',
          playerId
        }).slice(-numToReveal);
        for (const cardId of revealedCardIds){
          console.log(`[PATROL EFFECT] revealing ${cardId}...`);
          await runGameActionDelegate('revealCard', {
            cardId,
            playerId,
            moveToSetAside: true
          });
        }
        const [victoryCards, nonVictoryCards] = revealedCardIds.reduce((prev, card)=>{
          if (card.type.includes('VICTORY') || card.cardKey === 'curse') {
            prev[0].push(card);
          } else {
            prev[1].push(card);
          }
          return prev;
        }, [
          [],
          []
        ]);
        for (const card of victoryCards){
          console.log(`[PATROL EFFECT] moving ${card} to hand...`);
          await runGameActionDelegate('moveCard', {
            cardId: card.id,
            toPlayerId: playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
        if (nonVictoryCards.length < 2) {
          if (nonVictoryCards.length === 1) {
            console.log(`[PATROL EFFECT] non-victory card count is ${nonVictoryCards.length}, no need to rearrange`);
            await runGameActionDelegate('moveCard', {
              cardId: nonVictoryCards[0].id,
              to: {
                location: 'playerDeck'
              }
            });
          }
          return;
        }
        console.log(`[PATROL EFFECT] prompting user to rearrange cards...`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId: playerId,
          prompt: 'Choose order to put back on deck',
          content: {
            type: 'rearrange',
            cardIds: nonVictoryCards.map((card)=>card.id)
          },
          actionButtons: [
            {
              action: 1,
              label: 'DONE'
            }
          ]
        });
        for (const cardId of result.result ?? nonVictoryCards.map((card)=>card.id)){
          console.log(`[PATROL EFFECT] top-decking ${cardLibrary.getCard(cardId)}...`);
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
  'pawn': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        const actions = [
          {
            action: 1,
            label: '+1 Card'
          },
          {
            action: 2,
            label: '+1 Action'
          },
          {
            action: 3,
            label: '+1 Buy'
          },
          {
            action: 4,
            label: '+1 Treasure'
          }
        ];
        for(let i = 0; i < 2; i++){
          console.log(`[PAWN EFFECT] prompting user to choose...`);
          const result = await runGameActionDelegate('userPrompt', {
            playerId,
            actionButtons: actions,
            prompt: 'Choose one'
          });
          switch(result.action){
            case 1:
              console.log(`[PAWN EFFECT] drawing card...`);
              await runGameActionDelegate('drawCard', {
                playerId
              });
              break;
            case 2:
              console.log(`[PAWN EFFECT] gaining 1 action...`);
              await runGameActionDelegate('gainAction', {
                count: 1
              });
              break;
            case 3:
              console.log(`[PAWN EFFECT] gaining 1 buy...`);
              await runGameActionDelegate('gainBuy', {
                count: 1
              });
              break;
            case 4:
              console.log(`[PAWN EFFECT] gaining 1 treasure...`);
              await runGameActionDelegate('gainTreasure', {
                count: 1
              });
              break;
          }
          actions.splice(actions.findIndex((a)=>a.action === result.action), 1);
        }
      }
  },
  'replace': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, cardLibrary, playerId, reactionContext, cardPriceController, ...args })=>{
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (hand.length === 0) {
          console.log(`[REPLACE EFFECT] no cards in hand to trash...`);
          return;
        }
        console.log(`[REPLACE EFFECT] prompting user to trash card...`);
        let result = await runGameActionDelegate('selectCard', {
          prompt: 'Trash card',
          playerId,
          restrict: hand,
          count: 1
        });
        let cardId = result[0];
        let card = cardLibrary.getCard(cardId);
        console.log(`[REPLACE EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId
        });
        const { cost: cardCost } = cardPriceController.applyRules(card, {
          playerId
        });
        console.log(`[REPLACE EFFECT] prompting user to gain a card costing up to ${cardCost.treasure + 2}...`);
        result = await runGameActionDelegate('selectCard', {
          prompt: 'Gain card',
          playerId,
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
                potion: cardCost.potion
              }
            }
          ],
          count: 1
        });
        cardId = result[0];
        card = cardLibrary.getCard(cardId);
        const location = card.type.some((t)=>[
            'ACTION',
            'TREASURE'
          ].includes(t)) ? 'playerDeck' : 'playerDiscard';
        console.log(`[REPLACE EFFECT] gaining ${cardLibrary.getCard(cardId)} to ${location}...`);
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId,
          to: {
            location
          }
        });
        if (card.type.includes('VICTORY')) {
          console.log(`[REPLACE EFFECT] card is a victory card`);
          const targets = findOrderedTargets({
            startingPlayerId: playerId,
            appliesTo: 'ALL_OTHER',
            match
          }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
          for (const targetId of targets){
            const curseCardId = args.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'curse'
              }
            ])?.slice(-1)?.[0].id;
            if (!curseCardId) {
              console.log(`[REPLACE EFFECT] no curse cards in supply`);
              break;
            }
            console.log(`[REPLACE EFFECT] ${getPlayerById(match, targetId)} gaining ${cardLibrary.getCard(curseCardId)}`);
            await runGameActionDelegate('gainCard', {
              playerId: targetId,
              cardId: curseCardId,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }
  },
  'secret-passage': {
    registerEffects: ()=>async ({ match, cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[SECRET PASSAGE EFFECT] drawing 2 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 2
        });
        console.log(`[SECRET PASSAGE EFFECT] gaining 1 action`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        if (hand.length === 0) {
          console.log(`[SECRET PASSAGE EFFECT] player has no cards in hand`);
          return;
        }
        console.log(`[SECRET PASSAGE EFFECT] prompting user to select card from hand`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card',
          playerId,
          restrict: hand,
          count: 1
        });
        const cardId = cardIds?.[0];
        if (!cardId) {
          console.warn(`[SECRET PASSAGE EFFECT] player selected card, but result doesn't have it`);
          return;
        }
        console.log(`[SECRET PASSAGE EFFECT] player chose ${cardLibrary.getCard(cardId)}`);
        if (args.findCards({
          location: 'playerDeck',
          playerId
        }).length === 0) {
          console.log(`[SECRET PASSAGE EFFECT] player has no cards in deck, so just putting card on deck`);
          await runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: {
              location: 'playerDeck'
            }
          });
          return;
        }
        console.log(`[SECRET PASSAGE EFFECT] prompting user to select location in deck`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId: playerId,
          actionButtons: [
            {
              action: 1,
              label: 'DONE'
            }
          ],
          prompt: 'Position card',
          content: {
            type: 'blind-rearrange',
            cardIds: args.findCards({
              location: 'playerDeck',
              playerId
            }).map((card)=>card.id)
          }
        });
        const idx = result.result;
        console.log(`[SECRET PASSAGE EFFECT] moving card to deck at position ${idx}...`);
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: {
            location: 'playerDeck',
            index: idx
          }
        });
      }
  },
  'shanty-town': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, cardLibrary, match, ...args })=>{
        console.log(`[SHANTY TOWN EFFECT] gaining 2 actions...`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        for (const cardId of hand){
          console.log(`[SHANTY TOWN EFFECT] revealing ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('revealCard', {
            cardId,
            playerId
          });
        }
        if (!hand.some((cardId)=>cardLibrary.getCard(cardId).type.includes('ACTION'))) {
          console.log(`[SHANTY TOWN EFFECT] drawing 2 cards...`);
          await runGameActionDelegate('drawCard', {
            playerId,
            count: 2
          });
        } else {
          console.log(`[SHANTY TOWN EFFECT] player has actions, not drawing cards`);
        }
      }
  },
  'steward': {
    registerEffects: ()=>async ({ match, cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[STEWARD EFFECT] prompting user to choose cards, treasure, or trashing cards`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          actionButtons: [
            {
              action: 1,
              label: '+2 Card'
            },
            {
              action: 2,
              label: '+2 Treasure'
            },
            {
              action: 3,
              label: 'Trash 2 cards'
            }
          ],
          prompt: 'Choose one'
        });
        switch(result.action){
          case 1:
            console.log(`[STEWARD EFFECT] drawing 2 carda...`);
            await runGameActionDelegate('drawCard', {
              playerId,
              count: 2
            });
            break;
          case 2:
            console.log(`[STEWARD EFFECT] gaining 2 treasure...`);
            await runGameActionDelegate('gainTreasure', {
              count: 2
            });
            break;
          case 3:
            {
              const hand = args.cardSourceController.getSource('playerHand', playerId);
              if (hand.length === 0) {
                console.log(`[STEWARD EFFECT] no cards in hand to trash`);
                break;
              }
              const count = Math.min(2, hand.length);
              console.log(`[STEWARD EFFECT] prompting user to trash ${count} cards...`);
              const cardIds = await runGameActionDelegate('selectCard', {
                prompt: 'Confirm trash',
                playerId,
                restrict: hand,
                count
              });
              for (const cardId of cardIds){
                console.log(`[STEWARD EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
                await runGameActionDelegate('trashCard', {
                  playerId,
                  cardId
                });
              }
              break;
            }
        }
      }
  },
  'swindler': {
    registerEffects: ()=>async ({ reactionContext, runGameActionDelegate, playerId, match, cardLibrary, cardPriceController, ...args })=>{
        console.log(`[SWINDLER EFFECT] gaining 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        console.log(`[SWINDLER EFFECT] targets in order ${targets.map((id)=>getPlayerById(match, id)).join(',')}`);
        for (const target of targets){
          const deck = args.cardSourceController.getSource('playerDeck', target);
          if (deck.length === 0) {
            console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} as no cards, shuffling`);
            await runGameActionDelegate('shuffleDeck', {
              playerId: target
            });
            if (deck.length === 0) {
              console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} still has no cards`);
              continue;
            }
          }
          let cardId = deck.slice(-1)?.[0];
          const card = cardLibrary.getCard(cardId);
          console.log(`[SWINDLER EFFECT] trashing ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('trashCard', {
            playerId: target,
            cardId: cardId
          });
          const { cost } = cardPriceController.applyRules(card, {
            playerId
          });
          console.log(`[SWINDLER EFFECT] prompting user to select card costing ${cost.treasure}...`);
          const cardIds = await runGameActionDelegate('selectCard', {
            prompt: 'Choose card',
            playerId,
            restrict: [
              {
                location: [
                  'basicSupply',
                  'kingdomSupply'
                ]
              },
              {
                playerId,
                kind: 'exact',
                amount: cost
              }
            ],
            count: 1
          });
          cardId = cardIds[0];
          console.log(`[SWINDLER EFFECT] ${getPlayerById(match, target)} gaining ${cardLibrary.getCard(cardId)}...`);
          await runGameActionDelegate('gainCard', {
            playerId: target,
            cardId,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'torturer': {
    registerEffects: ()=>async ({ reactionContext, runGameActionDelegate, playerId, match, cardLibrary, ...args })=>{
        console.log(`[TORTURER EFFECT] drawing 3 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 3
        });
        const targets = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        console.log(`[TORTURER EFFECT] targets ${targets.map((id)=>getPlayerById(match, id)).join(',')}`);
        // Each other player either discards 2 cards or gains a Curse to their hand,
        // their choice. (They may pick an option they can't do.)",
        for (const target of targets){
          const player = getPlayerById(match, target);
          console.log(`[TORTURER EFFECT] prompting ${player} to choose to discard or gain curse to hand...`);
          const result = await runGameActionDelegate('userPrompt', {
            playerId: target,
            actionButtons: [
              {
                action: 1,
                label: 'DISCARD'
              },
              {
                action: 2,
                label: 'GAIN CURSE'
              }
            ],
            prompt: 'Choose one'
          });
          if (result.action === 1) {
            console.log(`[TORTURER EFFECT] prompting ${player} to discard 2 cards...`);
            const hand = args.cardSourceController.getSource('playerHand', target);
            const cardIds = hand.length < 2 ? hand : await runGameActionDelegate('selectCard', {
              prompt: 'Confirm discard',
              playerId: target,
              restrict: hand,
              count: Math.min(2, hand.length)
            });
            for (const cardId of cardIds){
              console.log(`[TORTURER EFFECT] ${player} discarding ${cardLibrary.getCard(cardId)}...`);
              await runGameActionDelegate('discardCard', {
                cardId,
                playerId: target
              });
            }
            return;
          }
          const curseCardId = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ])?.slice(-1)?.[0]?.id;
          if (!curseCardId) {
            console.log(`[TORTURER EFFECT] no curse card in supply`);
            continue;
          }
          const card = cardLibrary.getCard(curseCardId);
          console.log(`[TORTURER EFFECT] gaining ${card}...`);
          await runGameActionDelegate('gainCard', {
            playerId: target,
            cardId: card.id,
            to: {
              location: 'playerHand'
            }
          });
        }
      }
  },
  'trading-post': {
    registerEffects: ()=>async ({ runGameActionDelegate, match, cardLibrary, playerId, ...args })=>{
        const count = Math.min(2, args.cardSourceController.getSource('playerHand', playerId).length);
        if (count === 0) {
          console.log(`[TRADING POST EFFECT] no cards to trash`);
          return;
        }
        console.log(`[TRADING POST EFFECT] prompting user to trash ${count} cards...`);
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const cardIds = count < 2 ? hand : await runGameActionDelegate('selectCard', {
          prompt: 'Confirm trash',
          playerId,
          restrict: hand,
          count
        });
        for (const cardId of cardIds){
          console.log(`[TRADING POST EFFECT] trashing card ${cardLibrary.getCard(cardId)}`);
          await runGameActionDelegate('trashCard', {
            playerId,
            cardId
          });
        }
        if (cardIds.length === 2) {
          const silverCardId = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'silver'
            }
          ])?.slice(-1)?.[0].id;
          if (!silverCardId) {
            console.log(`[TRADING POST EFFECT] no silver in supply`);
            return;
          }
          const card = cardLibrary.getCard(silverCardId);
          console.log(`[TRADING POST EFFECT] gaining ${card}...`);
          await runGameActionDelegate('gainCard', {
            playerId,
            cardId: silverCardId,
            to: {
              location: 'playerHand'
            }
          });
        } else {
          console.log(`[TRADING POST EFFECT] player trashed ${cardIds.length}, so no treasure gained`);
        }
      }
  },
  'upgrade': {
    registerEffects: ()=>async ({ cardLibrary, runGameActionDelegate, match, playerId, cardPriceController, ...args })=>{
        console.log(`[UPGRADE EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[UPGRADE EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
          console.log(`[UPGRADE EFFECT] no cards in hand`);
          return;
        }
        if (args.cardSourceController.getSource('playerHand', playerId).length === 0) {
          console.log(`[UPGRADE EFFECT] no cards in hand, can't trash`);
          return;
        }
        console.log(`[UPGRADE EFFECT] prompting user to trash card from hand...`);
        let cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Confirm trash',
          playerId,
          restrict: args.cardSourceController.getSource('playerHand', playerId),
          count: 1
        });
        const card = cardLibrary.getCard(cardIds[0]);
        console.log(`[UPGRADE EFFECT] trashing ${card}...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId: card.id
        });
        const { cost: cardCost } = cardPriceController.applyRules(card, {
          playerId
        });
        console.log(`[UPGRADE EFFECT] prompting user to select card costing ${cardCost.treasure + 2}...`);
        cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Gain card',
          playerId,
          restrict: [
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              playerId,
              kind: 'exact',
              amount: {
                treasure: cardCost.treasure + 1,
                potion: cardCost.potion
              }
            }
          ],
          count: 1
        });
        const cardId = cardIds[0];
        console.log(`[UPGRADE EFFECT] gaining ${cardLibrary.getCard(cardId)} to hand...`);
        await runGameActionDelegate('gainCard', {
          playerId,
          cardId,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'wishing-well': {
    registerEffects: ()=>async ({ match, cardLibrary, runGameActionDelegate, playerId, ...args })=>{
        console.log(`[WISHING WELL EFFECT] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[WISHING WELL EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        // Name a card, then reveal the top card of your deck. If you named it, put it into your hand."
        console.log(`[WISHING WELL EFFECT] prompting user to name a card...`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          content: {
            type: 'name-card'
          },
          prompt: 'Name a card'
        });
        const cardKey = result.result;
        console.log(`[WISHING WELL EFFECT] player named '${cardKey}'`);
        if (args.findCards({
          location: 'playerDeck',
          playerId
        }).length === 0) {
          console.log(`[WISHING WELL EFFECT] shuffling player's deck...`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
        }
        const cardId = args.findCards({
          location: 'playerDeck',
          playerId
        }).slice(-1)[0]?.id;
        console.log(`[WISHING WELL EFFECT] revealing card ${cardLibrary.getCard(cardId)}...`);
        await runGameActionDelegate('revealCard', {
          cardId,
          playerId
        });
        const card = cardLibrary.getCard(cardId);
        if (card.cardKey === cardKey) {
          console.log(`[WISHING WELL EFFECT] moving ${card} to hand`);
          await runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
      }
  }
};
export default expansionModule;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9pbnRyaWd1ZS9jYXJkLWVmZmVjdHMtaW50cmlndWUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ2V0UGxheWVyQnlJZCB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1wbGF5ZXItYnktaWQudHMnO1xuaW1wb3J0IHsgZmluZE9yZGVyZWRUYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmluZC1vcmRlcmVkLXRhcmdldHMudHMnO1xuaW1wb3J0IHsgQ2FyZEV4cGFuc2lvbk1vZHVsZSB9IGZyb20gJy4uLy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IEFjdGlvbkJ1dHRvbnMsIENhcmQsIENhcmRJZCwgQ2FyZEtleSwgUGxheWVySWQgfSBmcm9tICdzaGFyZWQvc2hhcmVkLXR5cGVzLnRzJztcblxuY29uc3QgZXhwYW5zaW9uTW9kdWxlOiBDYXJkRXhwYW5zaW9uTW9kdWxlID0ge1xuICAnYmFyb24nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIGNhcmRMaWJyYXJ5LCBtYXRjaCwgcGxheWVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgLy8gKzEgQnV5XG4gICAgICAvLyBZb3UgbWF5IGRpc2NhcmQgYW4gRXN0YXRlIGZvciArJDQuIElmIHlvdSBkb24ndCwgZ2FpbiBhbiBFc3RhdGUuXG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQkFST04gRUZGRUNUXSBnYWluaW5nIDEgYnV5Li4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHtcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kRXN0YXRlSWR4ID0gaGFuZC5maW5kTGFzdCgoY0lkKSA9PlxuICAgICAgICBjYXJkTGlicmFyeS5nZXRDYXJkKGNJZCkuY2FyZEtleSA9PT0gJ2VzdGF0ZSdcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN1cHBseUVzdGF0ZUlkeCA9IGFyZ3MuZmluZENhcmRzKFt7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sIHsgY2FyZEtleXM6ICdlc3RhdGUnIH1dKVxuICAgICAgICA/LnNsaWNlKC0xKT8uWzBdLmlkO1xuICAgICAgXG4gICAgICBpZiAoIWhhbmRFc3RhdGVJZHgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtCQVJPTiBFRkZFQ1RdIHBsYXllciBoYXMgbm8gZXN0YXRlcyBpbiBoYW5kLCB0aGV5IGdhaW4gb25lYCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXN1cHBseUVzdGF0ZUlkeCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQkFST04gRUZGRUNUXSBubyBlc3RhdGVzIGluIHN1cHBseWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbQkFST04gRUZGRUNUXSBwbGF5ZXIgaGFzIGFuIGVzdGF0ZSBpbiBoYW5kYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjb25maXJtID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogJ0Rpc2NhcmQgZXN0YXRlPycsXG4gICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgeyBsYWJlbDogYERPTidUIERJU0NBUkRgLCBhY3Rpb246IDEgfSxcbiAgICAgICAgICAgIHsgbGFiZWw6ICdESVNDQVJEJywgYWN0aW9uOiAyIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKGNvbmZpcm0uYWN0aW9uID09PSAyKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtCQVJPTiBFRkZFQ1RdIHBsYXllciBjaG9vc2VzIHRvIGRpc2NhcmQgZXN0YXRlLCBnYWluIDQgdHJlYXN1cmVgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBoYW5kRXN0YXRlSWR4LFxuICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7XG4gICAgICAgICAgICBjb3VudDogNCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIXN1cHBseUVzdGF0ZUlkeCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0JBUk9OIEVGRkVDVF0gbm8gZXN0YXRlIGluIHN1cHBseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQkFST04gRUZGRUNUXSBwbGF5ZXIgbm90IGRpc2NhcmRpbmcgZXN0YXRlLCBnYWluICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChzdXBwbHlFc3RhdGVJZHgpfS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzdXBwbHlFc3RhdGVJZHgsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2JyaWRnZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7XG4gICAgICByZWFjdGlvbk1hbmFnZXIsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSxcbiAgICAgIGNhcmRQcmljZUNvbnRyb2xsZXIsXG4gICAgICBjYXJkSWQsXG4gICAgICBwbGF5ZXJJZFxuICAgIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbQlJJREdFIEVGRkVDVF0gZ2FpbmluZyAxIGJ1eS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0JSSURHRSBFRkZFQ1RdIGdhaW5pbmcgMSB0cmVhc3VyZS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtCUklER0UgRUZGRUNUXSBtb2RpZnkgY29zdCBieSAtMSBvZiBhbGwgY2FyZHMuLi5gKTtcbiAgICAgIFxuICAgICAgY29uc3QgYWxsQ2FyZHMgPSBjYXJkTGlicmFyeS5nZXRBbGxDYXJkc0FzQXJyYXkoKTtcbiAgICAgIGNvbnN0IHJ1bGVDbGVhbnVwczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBhbGxDYXJkcykge1xuICAgICAgICBydWxlQ2xlYW51cHMucHVzaChcbiAgICAgICAgICBjYXJkUHJpY2VDb250cm9sbGVyLnJlZ2lzdGVyUnVsZShcbiAgICAgICAgICAgIGNhcmQsXG4gICAgICAgICAgICAoY2FyZCwgY29udGV4dCkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4geyByZXN0cmljdGVkOiBmYWxzZSwgY29zdDogeyB0cmVhc3VyZTogLTEgfSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBicmlkZ2U6JHtjYXJkSWR9OmVuZFR1cm5gLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuJyxcbiAgICAgICAgY29uZGl0aW9uOiAoKSA9PiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGZvciAoY29uc3QgcnVsZSBvZiBydWxlQ2xlYW51cHMpIHtcbiAgICAgICAgICAgIHJ1bGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBicmlkZ2U6JHtjYXJkSWR9OmVuZFR1cm5gKTtcbiAgICAgICAgfSxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2NvbnNwaXJhdG9yJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgbWF0Y2gsIGNhcmRMaWJyYXJ5LCBwbGF5ZXJJZCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09OU1BJUkFUT1IgRUZGRUNUXSBnYWluaW5nIDIgdHJlYXN1cmUuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICAvLyB3ZSB3YW50IHRob3NlIGNhcmRzIHBsYXllZCBvbiB0aGUgcGxheWVyJ3MgdHVybiB0aGF0IGFyZSBhY3Rpb25zIGFuZCBwbGF5ZWQgYnkgVEhBVCBwbGF5ZXJcbiAgICAgIGNvbnN0IGFjdGlvbkNhcmRDb3VudCA9XG4gICAgICAgIE9iamVjdC5rZXlzKG1hdGNoLnN0YXRzLnBsYXllZENhcmRzKVxuICAgICAgICAgIC5maWx0ZXIoY2FyZElkID0+XG4gICAgICAgICAgICBjYXJkTGlicmFyeS5nZXRDYXJkKCtjYXJkSWQpLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpXG4gICAgICAgICAgICAmJiBtYXRjaC5zdGF0cy5wbGF5ZWRDYXJkc1srY2FyZElkXS5wbGF5ZXJJZCA9PT0gcGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0NPTlNQSVJBVE9SIEVGRkVDVF0gYWN0aW9uIGNhcmRzIHBsYXllZCBzbyBmYXIgJHthY3Rpb25DYXJkQ291bnQubGVuZ3RofWApO1xuICAgICAgXG4gICAgICBpZiAoYWN0aW9uQ2FyZENvdW50Py5sZW5ndGggPj0gMykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0NPTlNQSVJBVE9SIEVGRkVDVF0gZHJhd2luZyBjYXJkLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ09OU1BJUkFUT1IgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7XG4gICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2NvdXJ0aWVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgbWF0Y2gsIHBsYXllcklkLCBjYXJkTGlicmFyeSwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnN0IGhhbmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKCFoYW5kLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0NPVVJUSUVSIEVGRkVDVF0gbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRJRVIgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byByZXZlYWwgYSBjYXJkLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ1JldmVhbCBjYXJkJyxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSBjYXJkSWRzWzBdO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0NPVVJUSUVSIEVGRkVDVF0gcmV2ZWFsaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgIGNhcmRJZCxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgbGV0IGNhcmRUeXBlQ291bnQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCkudHlwZS5sZW5ndGg7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRJRVIgRUZGRUNUXSBjYXJkIGhhcyAke2NhcmRUeXBlQ291bnR9IHR5cGVzYCk7XG4gICAgICBcbiAgICAgIGNhcmRUeXBlQ291bnQgPSBNYXRoLm1pbihjYXJkVHlwZUNvdW50LCA0KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtDT1VSVElFUiBFRkZFQ1RdIGZpbmFsIGNob2ljZSBjb3VudCAke2NhcmRUeXBlQ291bnR9YCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNob2ljZXMgPSBbXG4gICAgICAgIHsgbGFiZWw6ICcrMSBBY3Rpb24nLCBhY3Rpb246IDEgfSxcbiAgICAgICAgeyBsYWJlbDogJysxIEJ1eScsIGFjdGlvbjogMiB9LFxuICAgICAgICB7IGxhYmVsOiAnKzMgVHJlYXN1cmUnLCBhY3Rpb246IDMgfSxcbiAgICAgICAgeyBsYWJlbDogJ0dhaW4gYSBnb2xkJywgYWN0aW9uOiA0IH0sXG4gICAgICBdO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcmRUeXBlQ291bnQ7IGkrKykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0NPVVJUSUVSIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gc2VsZWN0IGFuIGFjdGlvbi4uLmApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IGNob2ljZXMsXG4gICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIgfTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJlc3VsdEFjdGlvbiA9IHJlc3VsdC5hY3Rpb247XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW0NPVVJUSUVSIEVGRkVDVF0gcGxheWVyIGNob3NlICcke2Nob2ljZXMuZmluZChjID0+IGMuYWN0aW9uID09PSByZXN1bHRBY3Rpb24pPy5sYWJlbH0nYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBpZHggPSBjaG9pY2VzLmZpbmRJbmRleCgoYykgPT4gYy5hY3Rpb24gPT09IHJlc3VsdEFjdGlvbik7XG4gICAgICAgIGNob2ljZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKHJlc3VsdEFjdGlvbikge1xuICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRJRVIgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7XG4gICAgICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW0NPVVJUSUVSIEVGRkVDVF0gZ2FpbmluZyAxIGJ1eS4uLmApO1xuICAgICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5Jywge1xuICAgICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtDT1VSVElFUiBFRkZFQ1RdIGdhaW5pbmcgMSB0cmVhc3VyZS4uLmApO1xuICAgICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7XG4gICAgICAgICAgICAgIGNvdW50OiAzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6IHtcbiAgICAgICAgICAgIGNvbnN0IGdvbGRDYXJkSWQgPSBhcmdzLmZpbmRDYXJkcyhbeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LCB7IGNhcmRLZXlzOiAnZ29sZCcgfV0pXG4gICAgICAgICAgICAgID8uc2xpY2UoLTEpPy5bMF0uaWQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghZ29sZENhcmRJZCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW0NPVVJUSUVSIEVGRkVDVF0gbm8gZ29sZCBpbiBzdXBwbHkuLi5gKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRJRVIgRUZGRUNUXSBnYWluaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChnb2xkQ2FyZElkKX0uLi5gKTtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogZ29sZENhcmRJZCxcbiAgICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICAgIHRvOiB7XG4gICAgICAgICAgICAgICAgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnY291cnR5YXJkJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgbWF0Y2gsIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQsIGNhcmRMaWJyYXJ5LCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRZQVJEIEVGRkVDVF0gZHJhd2luZyAzIGNhcmRzLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkLCBjb3VudDogMyB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoIWhhbmQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRZQVJEIEVGRkVDVF0gbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRZQVJEIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gcHV0IGNhcmQgb250byBkZWNrLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnVG9wIGRlY2snLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSByZXN1bHRbMF07XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ09VUlRZQVJEIEVGRkVDVF0gbW92aW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfSB0byB0b3Agb2YgZGVjay4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHRvUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH0sXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdkaXBsb21hdCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkVudGVySGFuZDogYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyLCBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIC4uLmFyZ3MgfSwgeyBwbGF5ZXJJZCwgY2FyZElkIH0pID0+IHtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBkaXBsb21hdDoke2NhcmRJZH06Y2FyZFBsYXllZGAsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZFBsYXllZCcsXG4gICAgICAgICAgY29uZGl0aW9uOiAoeyBtYXRjaCwgdHJpZ2dlciwgY2FyZExpYnJhcnkgLCAuLi5hcmdzfSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGNhcmRMaWJyYXJ5LmdldENhcmQodHJpZ2dlci5hcmdzLmNhcmRJZCEpLnR5cGUuaW5jbHVkZXMoJ0FUVEFDSycpICYmXG4gICAgICAgICAgICAgIGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLmxlbmd0aCA+PSA1ICYmXG4gICAgICAgICAgICAgIHRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gcGxheWVySWRcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyBmdW5jdGlvbiAoeyByZWFjdGlvbiwgY2FyZExpYnJhcnkgfSkge1xuICAgICAgICAgICAgY29uc3Qgc291cmNlSWQgPSByZWFjdGlvbi5nZXRTb3VyY2VJZCgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2RpcGxvbWF0IHRyaWdnZXJlZCBlZmZlY3RdIHJ1bm5pbmcgZm9yICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfWApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogc291cmNlSWQsXG4gICAgICAgICAgICAgIHBsYXllcklkOiByZWFjdGlvbi5wbGF5ZXJJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0pO1xuICAgICAgICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICAgICAgcHJvbXB0OiAnQ29uZmlybSBkaXNjYXJkJyxcbiAgICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICAgIHJlc3RyaWN0OiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgICAgICAgICAgY291bnQ6IDMsXG4gICAgICAgICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZElkcykge1xuICAgICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgb25MZWF2ZUhhbmQ6IGFzeW5jICh7IHJlYWN0aW9uTWFuYWdlciB9LCB7IGNhcmRJZCB9KSA9PiB7XG4gICAgICAgIHJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgZGlwbG9tYXQ6JHtjYXJkSWR9OmNhcmRQbGF5ZWRgKTtcbiAgICAgIH0sXG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBtYXRjaCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0RJUExPTUFUIEVGRkVDVF0gZHJhd2luZyAyIGNhcmRzLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZENvdW50ID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCkubGVuZ3RoO1xuICAgICAgXG4gICAgICBpZiAoY2FyZENvdW50IDw9IDUpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtESVBMT01BVCBFRkZFQ1RdIGdhaW5pbmcgMiBhY3Rpb25zLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbRElQTE9NQVQgRUZGRUNUXSBwbGF5ZXIgaGFzIG1vcmUgdGhhbiAke2NhcmRDb3VudH0gY2FyZHMgaW4gaGFuZCwgY2FuJ3QgcGVyZm9ybSBkaXBsb21hdGAsKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdkdWtlJzoge1xuICAgIHJlZ2lzdGVyU2NvcmluZ0Z1bmN0aW9uOiAoKSA9PiAoeyBtYXRjaCwgY2FyZExpYnJhcnksIG93bmVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc3QgZHVjaGllcyA9IGFyZ3MuZmluZENhcmRzKFt7IG93bmVyOiBvd25lcklkIH0sIHsgY2FyZEtleXM6ICdkdWNoeScgfV0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0RVS0UgU0NPUklOR10gcGxheWVyICR7Z2V0UGxheWVyQnlJZChtYXRjaCwgb3duZXJJZCl9IGhhcyAke2R1Y2hpZXMubGVuZ3RofSBEdWNoaWVzYCk7XG4gICAgICBcbiAgICAgIHJldHVybiBkdWNoaWVzLmxlbmd0aDtcbiAgICB9LFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtEVUtFIEVGRkVDVF0gZHVrZSBoYXMgbm8gZWZmZWN0c2ApO1xuICAgIH1cbiAgfSxcbiAgJ2Zhcm0nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtGQVJNIEVGRkVDVF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywge1xuICAgICAgICBjb3VudDogMixcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2lyb253b3Jrcyc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IGNhcmRMaWJyYXJ5LCBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbSVJPTldPUktTIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gY2hvb3NlIGNhcmQgY29zdGluZyB1cCB0byA0Li4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ0Nob29zZSBjYXJkJyxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIHJlc3RyaWN0OiBbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgICB7IHBsYXllcklkLCBhbW91bnQ6IHsgdHJlYXN1cmU6IDQgfSwga2luZDogJ3VwVG8nIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbSVJPTldPUktTIEVGRkVDVF0gZ2FpbmluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkc1swXSl9Li4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIGNhcmRJZDogY2FyZElkc1swXSxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfSxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgaWYgKGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtJUk9OV09SS1MgRUZGRUNUXSBjYXJkIGlzIGFuIGFjdGlvbiwgZ2FpbmluZyAxIGFjdGlvbi4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywge1xuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGNhcmQudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0lST05XT1JLUyBFRkZFQ1RdIGNhcmQgaXMgYSB0cmVhc3VyZSwgZ2FpbmluZyAxIHRyZWFzdXJlLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ1ZJQ1RPUlknKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0lST05XT1JLUyBFRkZFQ1RdIGNhcmQgaXMgYSB2aWN0b3J5LCBkcmF3aW5nIGNhcmQuLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2x1cmtlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IGNhcmRMaWJyYXJ5LCBtYXRjaCwgcGxheWVySWQsIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0xVUktFUiBFRkZFQ1RdIGdhaW5pbmcgMSBhY3Rpb24uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgbGV0IHJlc3VsdCA9IHsgYWN0aW9uOiAxIH07XG4gICAgICBcbiAgICAgIGNvbnN0IGFjdGlvbkJ1dHRvbnM6IEFjdGlvbkJ1dHRvbnMgPSBbXG4gICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJ1RSQVNIIENBUkQnIH0sXG4gICAgICAgIHsgYWN0aW9uOiAyLCBsYWJlbDogJ0dBSU4gQ0FSRCcgfVxuICAgICAgXTtcbiAgICAgIFxuICAgICAgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiAnVHJhc2ggQWN0aW9uIGNhcmQgZnJvbSBzdXBwbHksIG9yIGdhaW4gQWN0aW9uIGNhcmQgZnJvbSB0cmFzaD8nLFxuICAgICAgICBhY3Rpb25CdXR0b25zLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciB9O1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0xVUktFUiBFRkZFQ1RdIHVzZXIgY2hvb3NlIGFjdGlvbiAke2FjdGlvbkJ1dHRvbnMuZmluZCgoYSkgPT4gYS5hY3Rpb24gPT09IHJlc3VsdC5hY3Rpb24pPy5sYWJlbH1gKTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtMVVJLRVIgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgY2FyZCB0byB0cmFzaC4uLmApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHByb21wdDogJ0NvbmZpcm0gdHJhc2gnLFxuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICAgIHJlc3RyaWN0OiBbXG4gICAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgICAgeyBjYXJkVHlwZTogJ0FDVElPTicgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRJZCA9IHJlc3VsdFswXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbTFVSS0VSIEVGRkVDVF0gdHJhc2hpbmcgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9Li4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0cmFzaCA9IGFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICd0cmFzaCcgfSk7XG4gICAgICBjb25zdCBhY3Rpb25DYXJkSWRzID0gdHJhc2guZmlsdGVyKGNhcmRJZCA9PiBjYXJkSWQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpO1xuICAgICAgXG4gICAgICBpZiAoIWFjdGlvbkNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTFVSS0VSIEVGRkVDVF0gdHJhc2ggaGFzIG5vIGFjdGlvbiBjYXJkc2ApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghdHJhc2guc29tZShjSWQgPT4gY0lkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0xVUktFUiBFRkZFQ1RdIG5vIGFjdGlvbiBjYXJkcyBpbiB0cmFzaCwgc2tpcHBpbmcgZ2FpbmluZ2ApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxldCBjYXJkSWQ6IENhcmRJZDtcbiAgICAgIGlmIChhcmdzLmZpbmRDYXJkcyh7IGxvY2F0aW9uOiAndHJhc2gnIH0pLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0xVUktFUiBFRkZFQ1RdIG9ubHkgb25lIGNhcmQgaW4gdHJhc2gsIGdhaW5pbmcgYXV0b21hdGljYWxseWApO1xuICAgICAgICBjYXJkSWQgPSB0cmFzaFswXS5pZDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW0xVUktFUiBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBhY3Rpb24gY2FyZCB0byBnYWluLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjaG9vc2VDYXJkUmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ0Nob29zZSBjYXJkIHRvIGdhaW4nLFxuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDEsXG4gICAgICAgICAgICBjYXJkSWRzOiBhY3Rpb25DYXJkSWRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pIGFzIHsgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICBcbiAgICAgICAgY2FyZElkID0gY2hvb3NlQ2FyZFJlc3VsdC5yZXN1bHRbMF07XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTFVSS0VSIEVGRkVDVF0gZ2FpbmluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgY2FyZElkLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnbWFzcXVlcmFkZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQsIG1hdGNoLCBjYXJkTGlicmFyeSwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW21hc3F1ZXJhZGUgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHMuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTCcsXG4gICAgICAgIG1hdGNoXG4gICAgICB9KS5maWx0ZXIoKHBsYXllcklkKSA9PiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKS5sZW5ndGggPiAwKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFttYXNxdWVyYWRlIGVmZmVjdF0gdGFyZ2V0cyBpbiBvcmRlciAke3RhcmdldHMubWFwKHQgPT4gZ2V0UGxheWVyQnlJZChtYXRjaCwgdCkpLmpvaW4oJywnKX1gKTtcbiAgICAgIFxuICAgICAgY29uc3QgcGxheWVyQ2FyZE1hcCA9IG5ldyBNYXA8UGxheWVySWQsIENhcmRJZD4oKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBwbGF5ZXJJZCBvZiB0YXJnZXRzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWFzcXVlcmFkZSBlZmZlY3RdIHByb21wdGluZyAke2dldFBsYXllckJ5SWQobWF0Y2gsIHBsYXllcklkKX0gdG8gY2hvb3NlIGEgY2FyZC4uLmApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwcm9tcHQ6ICdDb25maXJtIHBhc3MnLFxuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICAgIHJlc3RyaWN0OiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICAgIFxuICAgICAgICBwbGF5ZXJDYXJkTWFwLnNldChwbGF5ZXJJZCwgY2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW21hc3F1ZXJhZGUgZWZmZWN0XSAke2dldFBsYXllckJ5SWQobWF0Y2gsIHBsYXllcklkKX0gY2hvc2UgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZHNbMF0pfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY2FyZElkID0gcGxheWVyQ2FyZE1hcC5nZXQodGFyZ2V0c1tpXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW21hc3F1ZXJhZGUgZWZmZWN0XSBubyBjYXJkIGZvciAke2dldFBsYXllckJ5SWQobWF0Y2gsIHRhcmdldHNbaV0pfWApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBwbGF5ZXJJZCA9IHRhcmdldHNbKGkgKyAxKSAlIHRhcmdldHMubGVuZ3RoXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIGNhcmQub3duZXIgPSBwbGF5ZXJJZDtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWFzcXVlcmFkZSBlZmZlY3RdIG1vdmluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkISl9IHRvICR7Z2V0UGxheWVyQnlJZChtYXRjaCwgcGxheWVySWQhKX1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkSWQhLFxuICAgICAgICAgIHRvUGxheWVySWQ6IHBsYXllcklkISxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW21hc3F1ZXJhZGUgZWZmZWN0XSBwcm9tcHRpbmcgdXNlciB0byB0cmFzaCBjYXJkIGZyb20gaGFuZC4uLmApO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgcHJvbXB0OiAnQ29uZmlybSB0cmFzaCcsXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcmVzdHJpY3Q6IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLFxuICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbWFzcXVlcmFkZSBlZmZlY3RdIHBsYXllciBjaG9zZSAke2NhcmRJZHMubGVuZ3RoID8gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWRzWzBdKSA6ICdub3QgdG8gdHJhc2gnfWApO1xuICAgICAgXG4gICAgICBpZiAoY2FyZElkc1swXSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW21hc3F1ZXJhZGUgZWZmZWN0XSB0cmFzaGluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkc1swXSl9Li4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmRJZHNbMF0sXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21pbGwnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCBtYXRjaCwgY2FyZExpYnJhcnksIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtNSUxMIEVGRkVDVF0gZHJhd2luZyBjYXJkLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW01JTEwgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKGhhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUlMTCBFRkZFQ1RdIHBsYXllciBoYXMgbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbTUlMTCBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBjYXJkcyB0byBkaXNjYXJkYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgICBwcm9tcHQ6ICdDb25maXJtIGRpc2NhcmQnLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiBNYXRoLm1pbigyLCBoYW5kLmxlbmd0aCksXG4gICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgcmVzdWx0cykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW01JTEwgRUZGRUNUXSBkaXNjYXJkaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW01JTEwgRUZGRUNUXSBnYWluaW5nIDIgdHJlYXN1cmUuLi5gKTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoID09IDIpIHtcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7XG4gICAgICAgICAgY291bnQ6IDIsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21pbmluZy12aWxsYWdlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgY2FyZElkLCBjYXJkTGlicmFyeSB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW01JTklORyBWSUxMQUdFIEVGRkVDVF0gZHJhd2luZyBjYXJkLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW01JTklORyBWSUxMQUdFIEVGRkVDVF0gZ2FpbmluZyAyIGFjdGlvbnNgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNSU5JTkcgVklMTEFHRSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHRyYXNoIG1pbmluZyB2aWxsYWdlIG9yIG5vdGApO1xuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGFjdGlvbjogMSwgbGFiZWw6IGBET04nVCBUUkFTSGAgfSxcbiAgICAgICAgICB7IGFjdGlvbjogMiwgbGFiZWw6ICdUUkFTSCcgfSxcbiAgICAgICAgXSxcbiAgICAgICAgcHJvbXB0OiAnVHJhc2ggTWluaW5nIFZpbGxhZ2U/JyxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIgfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdHMuYWN0aW9uID09PSAyKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUlOSU5HIFZJTExBR0UgRUZGRUNUXSB0cmFzaGluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW01JTklORyBWSUxMQUdFIEVGRkVDVF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgICBjb3VudDogMixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtNSU5JTkcgVklMTEFHRSBFRkZFQ1RdIHBsYXllciBjaG9zZSBub3QgdG8gdHJhc2ggbWluaW5nIHZpbGxhZ2VgKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdtaW5pb24nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBtYXRjaCwgcmVhY3Rpb25Db250ZXh0LCBjYXJkTGlicmFyeSwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW01JTklPTiBFRkZFQ1RdIGdhaW5pbmcgMSBhY3Rpb24uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtNSU5JT04gRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBnYWluIHRyZWFzdXJlIG9yIGRpc2NhcmQgaGFuZC4uLmApO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJysyIFRyZWFzdXJlJyB9LFxuICAgICAgICAgIHsgYWN0aW9uOiAyLCBsYWJlbDogJ0Rpc2NhcmQgaGFuZCcgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIgfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdHMuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUlOSU9OIEVGRkVDVF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgICBjb3VudDogMixcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0cyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgICAgYXBwbGllc1RvOiAnQUxMJyxcbiAgICAgICAgICBtYXRjaFxuICAgICAgICB9KS5maWx0ZXIoKHBsYXllcklkKSA9PiB7XG4gICAgICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgICAgIGNvbnN0IGhhbmRDb3VudCA9IGhhbmQubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiBwbGF5ZXJJZCA9PT0gcGxheWVySWQgfHxcbiAgICAgICAgICAgIChoYW5kQ291bnQgPj0gNSAmJiByZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBwbGF5ZXJJZCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyQnlJZChtYXRjaCwgcGxheWVySWQpO1xuICAgICAgICAgIGNvbnN0IGhhbmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKTtcbiAgICAgICAgICBjb25zdCBsID0gaGFuZC5sZW5ndGg7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IGwgLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgY29uc3QgY2FyZElkID0gaGFuZFtpXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtNSU5JT04gRUZGRUNUXSAke3BsYXllcn0gZGlzY2FyZGluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW01JTklPTiBFRkZFQ1RdICR7cGxheWVyfSBkcmF3aW5nIDQgY2FyZHMuLi5gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCwgY291bnQ6IDQgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdub2JsZXMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbTk9CTEVTIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gc2VsZWN0IGFjdGlvbnMgb3IgdHJlYXN1cmVgKTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJyszIENhcmRzJyB9LFxuICAgICAgICAgIHsgYWN0aW9uOiAyLCBsYWJlbDogJysyIEFjdGlvbnMnIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciB9O1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW05PQkxFUyBFRkZFQ1RdIHBsYXllciBjaG9zZSAke3Jlc3VsdC5hY3Rpb259YCk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTk9CTEVTIEVGRkVDVF0gZHJhd2luZyAzIGNhcmRzLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCwgY291bnQ6IDMgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtOT0JMRVMgRUZGRUNUXSBnYWluaW5nIDIgYWN0aW9uc2ApO1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7XG4gICAgICAgICAgY291bnQ6IDIsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3BhdHJvbCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgbWF0Y2gsIHBsYXllcklkLCBjYXJkTGlicmFyeSwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW1BBVFJPTCBFRkZFQ1RdIGRyYXdpbmcgMyBjYXJkc2ApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCwgY291bnQ6IDMgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIHBsYXllcklkKTtcbiAgICAgIGNvbnN0IGRpc2NhcmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGlzY2FyZCcsIHBsYXllcklkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtQQVRST0wgRUZGRUNUXSBvcmlnaW5hbCBudW0gdG8gcmV2ZWFsIDRgKTtcbiAgICAgIFxuICAgICAgY29uc3QgbnVtVG9SZXZlYWwgPSBNYXRoLm1pbig0LCBkZWNrLmxlbmd0aCArIGRpc2NhcmQubGVuZ3RoKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtQQVRST0wgRUZGRUNUXSBmaW5hbCBudW0gdG8gcmV2ZWFsICR7bnVtVG9SZXZlYWx9YCk7XG4gICAgICBcbiAgICAgIGlmIChudW1Ub1JldmVhbCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1BBVFJPTCBFRkZFQ1RdIG5vIGNhcmRzIHRvIHJldmVhbGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChkZWNrLmxlbmd0aCA8IG51bVRvUmV2ZWFsKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUEFUUk9MIEVGRkVDVF0gbm90IGVub3VnaCBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHtcbiAgICAgICAgICBwbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmV2ZWFsZWRDYXJkSWRzOiBDYXJkW10gPSBhcmdzLmZpbmRDYXJkcyh7IGxvY2F0aW9uOiAncGxheWVyRGVjaycsIHBsYXllcklkIH0pLnNsaWNlKC1udW1Ub1JldmVhbCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHJldmVhbGVkQ2FyZElkcykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1BBVFJPTCBFRkZFQ1RdIHJldmVhbGluZyAke2NhcmRJZH0uLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBbdmljdG9yeUNhcmRzLCBub25WaWN0b3J5Q2FyZHNdID0gcmV2ZWFsZWRDYXJkSWRzXG4gICAgICAgIC5yZWR1Y2UoKHByZXYsIGNhcmQpID0+IHtcbiAgICAgICAgICBpZiAoY2FyZC50eXBlLmluY2x1ZGVzKCdWSUNUT1JZJykgfHwgY2FyZC5jYXJkS2V5ID09PSAnY3Vyc2UnKSB7XG4gICAgICAgICAgICBwcmV2WzBdLnB1c2goY2FyZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcHJldlsxXS5wdXNoKGNhcmQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgfSwgW1tdLCBbXV0gYXMgQ2FyZFtdW10pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgdmljdG9yeUNhcmRzKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUEFUUk9MIEVGRkVDVF0gbW92aW5nICR7Y2FyZH0gdG8gaGFuZC4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9LFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKG5vblZpY3RvcnlDYXJkcy5sZW5ndGggPCAyKSB7XG4gICAgICAgIGlmIChub25WaWN0b3J5Q2FyZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtQQVRST0wgRUZGRUNUXSBub24tdmljdG9yeSBjYXJkIGNvdW50IGlzICR7bm9uVmljdG9yeUNhcmRzLmxlbmd0aH0sIG5vIG5lZWQgdG8gcmVhcnJhbmdlYCk7XG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogbm9uVmljdG9yeUNhcmRzWzBdLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1BBVFJPTCBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHJlYXJyYW5nZSBjYXJkcy4uLmApO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9yZGVyIHRvIHB1dCBiYWNrIG9uIGRlY2snLFxuICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgdHlwZTogJ3JlYXJyYW5nZScsXG4gICAgICAgICAgY2FyZElkczogbm9uVmljdG9yeUNhcmRzLm1hcCgoY2FyZCkgPT4gY2FyZC5pZCksXG4gICAgICAgIH0sXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGFjdGlvbjogMSwgbGFiZWw6ICdET05FJyB9LFxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlcjsgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiByZXN1bHQucmVzdWx0ID8/IG5vblZpY3RvcnlDYXJkcy5tYXAoKGNhcmQpID0+IGNhcmQuaWQpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUEFUUk9MIEVGRkVDVF0gdG9wLWRlY2tpbmcgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9Li4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3Bhd24nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkIH0pID0+IHtcbiAgICAgIGNvbnN0IGFjdGlvbnMgPSBbXG4gICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJysxIENhcmQnIH0sXG4gICAgICAgIHsgYWN0aW9uOiAyLCBsYWJlbDogJysxIEFjdGlvbicgfSxcbiAgICAgICAgeyBhY3Rpb246IDMsIGxhYmVsOiAnKzEgQnV5JyB9LFxuICAgICAgICB7IGFjdGlvbjogNCwgbGFiZWw6ICcrMSBUcmVhc3VyZScgfSxcbiAgICAgIF07XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgaSsrKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbUEFXTiBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIGNob29zZS4uLmApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IGFjdGlvbnMsXG4gICAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9uZScsXG4gICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIgfTtcbiAgICAgICAgXG4gICAgICAgIHN3aXRjaCAocmVzdWx0LmFjdGlvbikge1xuICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbUEFXTiBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1BBV04gRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7XG4gICAgICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1BBV04gRUZGRUNUXSBnYWluaW5nIDEgYnV5Li4uYCk7XG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7XG4gICAgICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1BBV04gRUZGRUNUXSBnYWluaW5nIDEgdHJlYXN1cmUuLi5gKTtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywge1xuICAgICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGFjdGlvbnMuc3BsaWNlKGFjdGlvbnMuZmluZEluZGV4KChhKSA9PiBhLmFjdGlvbiA9PT0gcmVzdWx0LmFjdGlvbiksIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3JlcGxhY2UnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoe1xuICAgICAgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLFxuICAgICAgbWF0Y2gsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIHBsYXllcklkLFxuICAgICAgcmVhY3Rpb25Db250ZXh0LFxuICAgICAgY2FyZFByaWNlQ29udHJvbGxlcixcbiAgICAgIC4uLmFyZ3NcbiAgICB9KSA9PiB7XG4gICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCk7XG4gICAgICBpZiAoaGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtSRVBMQUNFIEVGRkVDVF0gbm8gY2FyZHMgaW4gaGFuZCB0byB0cmFzaC4uLmApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbUkVQTEFDRSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHRyYXNoIGNhcmQuLi5gKTtcbiAgICAgIFxuICAgICAgbGV0IHJlc3VsdCA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnVHJhc2ggY2FyZCcsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgIFxuICAgICAgbGV0IGNhcmRJZCA9IHJlc3VsdFswXTtcbiAgICAgIGxldCBjYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1JFUExBQ0UgRUZGRUNUXSB0cmFzaGluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjYXJkSWQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgeyBjb3N0OiBjYXJkQ29zdCB9ID0gY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbUkVQTEFDRSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIGdhaW4gYSBjYXJkIGNvc3RpbmcgdXAgdG8gJHtjYXJkQ29zdC50cmVhc3VyZSArIDJ9Li4uYCk7XG4gICAgICBcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnR2FpbiBjYXJkJyxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgICB7IHBsYXllcklkLCBraW5kOiAndXBUbycsIGFtb3VudDogeyB0cmVhc3VyZTogY2FyZENvc3QudHJlYXN1cmUgKyAyLCBwb3Rpb246IGNhcmRDb3N0LnBvdGlvbiB9IH0sXG4gICAgICAgIF0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICBcbiAgICAgIGNhcmRJZCA9IHJlc3VsdFswXTtcbiAgICAgIGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGxvY2F0aW9uID0gY2FyZC50eXBlLnNvbWUoKHQpID0+IFsnQUNUSU9OJywgJ1RSRUFTVVJFJ10uaW5jbHVkZXModCkpXG4gICAgICAgID8gJ3BsYXllckRlY2snXG4gICAgICAgIDogJ3BsYXllckRpc2NhcmQnO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1JFUExBQ0UgRUZGRUNUXSBnYWluaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfSB0byAke2xvY2F0aW9ufS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbiB9LFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ1ZJQ1RPUlknKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1JFUExBQ0UgRUZGRUNUXSBjYXJkIGlzIGEgdmljdG9yeSBjYXJkYCk7XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgICAgbWF0Y2gsXG4gICAgICAgIH0pLmZpbHRlcigoaWQpID0+IHJlYWN0aW9uQ29udGV4dD8uW2lkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgdGFyZ2V0SWQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgIGNvbnN0IGN1cnNlQ2FyZElkID0gYXJncy5maW5kQ2FyZHMoW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ2N1cnNlJyB9XSlcbiAgICAgICAgICAgID8uc2xpY2UoLTEpPy5bMF0uaWQ7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFjdXJzZUNhcmRJZCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtSRVBMQUNFIEVGRkVDVF0gbm8gY3Vyc2UgY2FyZHMgaW4gc3VwcGx5YCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtSRVBMQUNFIEVGRkVDVF0gJHtnZXRQbGF5ZXJCeUlkKG1hdGNoLCB0YXJnZXRJZCl9IGdhaW5pbmcgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGN1cnNlQ2FyZElkKX1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldElkLFxuICAgICAgICAgICAgY2FyZElkOiBjdXJzZUNhcmRJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3NlY3JldC1wYXNzYWdlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgbWF0Y2gsIGNhcmRMaWJyYXJ5LCBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbU0VDUkVUIFBBU1NBR0UgRUZGRUNUXSBkcmF3aW5nIDIgY2FyZHMuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1NFQ1JFVCBQQVNTQUdFIEVGRkVDVF0gZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1NFQ1JFVCBQQVNTQUdFIEVGRkVDVF0gcGxheWVyIGhhcyBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtTRUNSRVQgUEFTU0FHRSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBjYXJkIGZyb20gaGFuZGApO1xuICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIGNhcmQnLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZCA9IGNhcmRJZHM/LlswXTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbU0VDUkVUIFBBU1NBR0UgRUZGRUNUXSBwbGF5ZXIgc2VsZWN0ZWQgY2FyZCwgYnV0IHJlc3VsdCBkb2Vzbid0IGhhdmUgaXRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1NFQ1JFVCBQQVNTQUdFIEVGRkVDVF0gcGxheWVyIGNob3NlICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfWApO1xuICAgICAgXG4gICAgICBpZiAoYXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXllckRlY2snLCBwbGF5ZXJJZCB9KS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtTRUNSRVQgUEFTU0FHRSBFRkZFQ1RdIHBsYXllciBoYXMgbm8gY2FyZHMgaW4gZGVjaywgc28ganVzdCBwdXR0aW5nIGNhcmQgb24gZGVja2ApO1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH0sXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbU0VDUkVUIFBBU1NBR0UgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgbG9jYXRpb24gaW4gZGVja2ApO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJ0RPTkUnIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHByb21wdDogJ1Bvc2l0aW9uIGNhcmQnLFxuICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgdHlwZTogJ2JsaW5kLXJlYXJyYW5nZScsXG4gICAgICAgICAgY2FyZElkczogYXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXllckRlY2snLCBwbGF5ZXJJZCB9KS5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgfSxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXI7IHJlc3VsdDogbnVtYmVyIH07XG4gICAgICBcbiAgICAgIGNvbnN0IGlkeCA9IHJlc3VsdC5yZXN1bHQ7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbU0VDUkVUIFBBU1NBR0UgRUZGRUNUXSBtb3ZpbmcgY2FyZCB0byBkZWNrIGF0IHBvc2l0aW9uICR7aWR4fS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHRvUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICB0bzoge1xuICAgICAgICAgIGxvY2F0aW9uOiAncGxheWVyRGVjaycsXG4gICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3NoYW50eS10b3duJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgY2FyZExpYnJhcnksIG1hdGNoLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbU0hBTlRZIFRPV04gRUZGRUNUXSBnYWluaW5nIDIgYWN0aW9ucy4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGhhbmQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtTSEFOVFkgVE9XTiBFRkZFQ1RdIHJldmVhbGluZyAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIWhhbmQuc29tZSgoY2FyZElkKSA9PiBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCkudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbU0hBTlRZIFRPV04gRUZGRUNUXSBkcmF3aW5nIDIgY2FyZHMuLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1NIQU5UWSBUT1dOIEVGRkVDVF0gcGxheWVyIGhhcyBhY3Rpb25zLCBub3QgZHJhd2luZyBjYXJkc2ApO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3N0ZXdhcmQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBtYXRjaCwgY2FyZExpYnJhcnksIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtTVEVXQVJEIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gY2hvb3NlIGNhcmRzLCB0cmVhc3VyZSwgb3IgdHJhc2hpbmcgY2FyZHNgKTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgYWN0aW9uOiAxLCBsYWJlbDogJysyIENhcmQnIH0sXG4gICAgICAgICAgeyBhY3Rpb246IDIsIGxhYmVsOiAnKzIgVHJlYXN1cmUnIH0sXG4gICAgICAgICAgeyBhY3Rpb246IDMsIGxhYmVsOiAnVHJhc2ggMiBjYXJkcycgfSxcbiAgICAgICAgXSxcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9uZScsXG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyIH07XG4gICAgICBcbiAgICAgIHN3aXRjaCAocmVzdWx0LmFjdGlvbikge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgY29uc29sZS5sb2coYFtTVEVXQVJEIEVGRkVDVF0gZHJhd2luZyAyIGNhcmRhLi4uYCk7XG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgY29uc29sZS5sb2coYFtTVEVXQVJEIEVGRkVDVF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7XG4gICAgICAgICAgICBjb3VudDogMixcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOiB7XG4gICAgICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtTVEVXQVJEIEVGRkVDVF0gbm8gY2FyZHMgaW4gaGFuZCB0byB0cmFzaGApO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNvdW50ID0gTWF0aC5taW4oMiwgaGFuZC5sZW5ndGgpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbU1RFV0FSRCBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHRyYXNoICR7Y291bnR9IGNhcmRzLi4uYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICAgIHByb21wdDogJ0NvbmZpcm0gdHJhc2gnLFxuICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgICAgIGNvdW50LFxuICAgICAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIGNhcmRJZHMpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbU1RFV0FSRCBFRkZFQ1RdIHRyYXNoaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3N3aW5kbGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHtcbiAgICAgIHJlYWN0aW9uQ29udGV4dCxcbiAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSxcbiAgICAgIHBsYXllcklkLFxuICAgICAgbWF0Y2gsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIGNhcmRQcmljZUNvbnRyb2xsZXIsXG4gICAgICAuLi5hcmdzXG4gICAgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtTV0lORExFUiBFRkZFQ1RdIGdhaW5pbmcgMiB0cmVhc3VyZS4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHtcbiAgICAgICAgY291bnQ6IDIsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0cyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBtYXRjaCxcbiAgICAgIH0pLmZpbHRlcihpZCA9PiByZWFjdGlvbkNvbnRleHQ/LltpZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbU1dJTkRMRVIgRUZGRUNUXSB0YXJnZXRzIGluIG9yZGVyICR7dGFyZ2V0cy5tYXAoaWQgPT4gZ2V0UGxheWVyQnlJZChtYXRjaCwgaWQpKS5qb2luKCcsJyl9YCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgY29uc3QgZGVjayA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgdGFyZ2V0KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbU1dJTkRMRVIgRUZGRUNUXSAke2dldFBsYXllckJ5SWQobWF0Y2gsIHRhcmdldCl9IGFzIG5vIGNhcmRzLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtTV0lORExFUiBFRkZFQ1RdICR7Z2V0UGxheWVyQnlJZChtYXRjaCwgdGFyZ2V0KX0gc3RpbGwgaGFzIG5vIGNhcmRzYCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGxldCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKT8uWzBdO1xuICAgICAgICBjb25zdCBjYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtTV0lORExFUiBFRkZFQ1RdIHRyYXNoaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHRhcmdldCxcbiAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhjYXJkLCB7IHBsYXllcklkIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtTV0lORExFUiBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBjYXJkIGNvc3RpbmcgJHtjb3N0LnRyZWFzdXJlfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwcm9tcHQ6ICdDaG9vc2UgY2FyZCcsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgICB7IHBsYXllcklkLCBraW5kOiAnZXhhY3QnLCBhbW91bnQ6IGNvc3QgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgICAgY2FyZElkID0gY2FyZElkc1swXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbU1dJTkRMRVIgRUZGRUNUXSAke2dldFBsYXllckJ5SWQobWF0Y2gsIHRhcmdldCl9IGdhaW5pbmcgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9Li4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXQsXG4gICAgICAgICAgY2FyZElkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndG9ydHVyZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoe1xuICAgICAgcmVhY3Rpb25Db250ZXh0LFxuICAgICAgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLFxuICAgICAgcGxheWVySWQsXG4gICAgICBtYXRjaCxcbiAgICAgIGNhcmRMaWJyYXJ5LFxuICAgICAgLi4uYXJnc1xuICAgIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbVE9SVFVSRVIgRUZGRUNUXSBkcmF3aW5nIDMgY2FyZHMuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiAzIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIG1hdGNoLFxuICAgICAgfSkuZmlsdGVyKChpZCkgPT4gcmVhY3Rpb25Db250ZXh0Py5baWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1RPUlRVUkVSIEVGRkVDVF0gdGFyZ2V0cyAke3RhcmdldHMubWFwKGlkID0+IGdldFBsYXllckJ5SWQobWF0Y2gsIGlkKSkuam9pbignLCcpfWApO1xuICAgICAgXG4gICAgICAvLyBFYWNoIG90aGVyIHBsYXllciBlaXRoZXIgZGlzY2FyZHMgMiBjYXJkcyBvciBnYWlucyBhIEN1cnNlIHRvIHRoZWlyIGhhbmQsXG4gICAgICAvLyB0aGVpciBjaG9pY2UuIChUaGV5IG1heSBwaWNrIGFuIG9wdGlvbiB0aGV5IGNhbid0IGRvLilcIixcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyQnlJZChtYXRjaCwgdGFyZ2V0KTtcbiAgICAgICAgY29uc29sZS5sb2coYFtUT1JUVVJFUiBFRkZFQ1RdIHByb21wdGluZyAke3BsYXllcn0gdG8gY2hvb3NlIHRvIGRpc2NhcmQgb3IgZ2FpbiBjdXJzZSB0byBoYW5kLi4uYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHRhcmdldCxcbiAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgICB7IGFjdGlvbjogMSwgbGFiZWw6ICdESVNDQVJEJyB9LFxuICAgICAgICAgICAgeyBhY3Rpb246IDIsIGxhYmVsOiAnR0FJTiBDVVJTRScgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyOyB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1RPUlRVUkVSIEVGRkVDVF0gcHJvbXB0aW5nICR7cGxheWVyfSB0byBkaXNjYXJkIDIgY2FyZHMuLi5gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRJZHMgPSBoYW5kLmxlbmd0aCA8IDIgP1xuICAgICAgICAgICAgaGFuZCA6XG4gICAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICAgIHByb21wdDogJ0NvbmZpcm0gZGlzY2FyZCcsXG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXQsXG4gICAgICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgICAgICBjb3VudDogTWF0aC5taW4oMiwgaGFuZC5sZW5ndGgpXG4gICAgICAgICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBjYXJkSWRzKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1RPUlRVUkVSIEVGRkVDVF0gJHtwbGF5ZXJ9IGRpc2NhcmRpbmcgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9Li4uYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgY3Vyc2VDYXJkSWQgPSBhcmdzLmZpbmRDYXJkcyhbeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LCB7IGNhcmRLZXlzOiAnY3Vyc2UnIH1dKVxuICAgICAgICAgID8uc2xpY2UoLTEpPy5bMF0/LmlkO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFjdXJzZUNhcmRJZCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbVE9SVFVSRVIgRUZGRUNUXSBubyBjdXJzZSBjYXJkIGluIHN1cHBseWApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChjdXJzZUNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW1RPUlRVUkVSIEVGRkVDVF0gZ2FpbmluZyAke2NhcmR9Li4uYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndHJhZGluZy1wb3N0Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBtYXRjaCwgY2FyZExpYnJhcnksIHBsYXllcklkLCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnN0IGNvdW50ID0gTWF0aC5taW4oMiwgYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCkubGVuZ3RoKTtcbiAgICAgIFxuICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbVFJBRElORyBQT1NUIEVGRkVDVF0gbm8gY2FyZHMgdG8gdHJhc2hgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1RSQURJTkcgUE9TVCBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHRyYXNoICR7Y291bnR9IGNhcmRzLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKTtcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBjb3VudCA8IDIgP1xuICAgICAgICBoYW5kIDpcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHByb21wdDogJ0NvbmZpcm0gdHJhc2gnLFxuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgIGNvdW50LFxuICAgICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZElkcykge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1RSQURJTkcgUE9TVCBFRkZFQ1RdIHRyYXNoaW5nIGNhcmQgJHtjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCl9YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoY2FyZElkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgY29uc3Qgc2lsdmVyQ2FyZElkID0gYXJncy5maW5kQ2FyZHMoW3sgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSwgeyBjYXJkS2V5czogJ3NpbHZlcicgfV0pXG4gICAgICAgICAgPy5zbGljZSgtMSk/LlswXS5pZDtcbiAgICAgICAgaWYgKCFzaWx2ZXJDYXJkSWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1RSQURJTkcgUE9TVCBFRkZFQ1RdIG5vIHNpbHZlciBpbiBzdXBwbHlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKHNpbHZlckNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW1RSQURJTkcgUE9TVCBFRkZFQ1RdIGdhaW5pbmcgJHtjYXJkfS4uLmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNpbHZlckNhcmRJZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbVFJBRElORyBQT1NUIEVGRkVDVF0gcGxheWVyIHRyYXNoZWQgJHtjYXJkSWRzLmxlbmd0aH0sIHNvIG5vIHRyZWFzdXJlIGdhaW5lZGApO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3VwZ3JhZGUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoe1xuICAgICAgY2FyZExpYnJhcnksXG4gICAgICBydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICBtYXRjaCxcbiAgICAgIHBsYXllcklkLFxuICAgICAgY2FyZFByaWNlQ29udHJvbGxlcixcbiAgICAgIC4uLmFyZ3NcbiAgICB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW1VQR1JBREUgRUZGRUNUXSBkcmF3aW5nIGNhcmQuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVVBHUkFERSBFRkZFQ1RdIGdhaW5pbmcgMSBhY3Rpb24uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgaWYgKGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1VQR1JBREUgRUZGRUNUXSBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW1VQR1JBREUgRUZGRUNUXSBubyBjYXJkcyBpbiBoYW5kLCBjYW4ndCB0cmFzaGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVVBHUkFERSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHRyYXNoIGNhcmQgZnJvbSBoYW5kLi4uYCk7XG4gICAgICBcbiAgICAgIGxldCBjYXJkSWRzID0gYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwcm9tcHQ6ICdDb25maXJtIHRyYXNoJyxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVVBHUkFERSBFRkZFQ1RdIHRyYXNoaW5nICR7Y2FyZH0uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgeyBjb3N0OiBjYXJkQ29zdCB9ID0gY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbVVBHUkFERSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBjYXJkIGNvc3RpbmcgJHtjYXJkQ29zdC50cmVhc3VyZSArIDJ9Li4uYCk7XG4gICAgICBcbiAgICAgIGNhcmRJZHMgPSBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ0dhaW4gY2FyZCcsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgeyBwbGF5ZXJJZCwga2luZDogJ2V4YWN0JywgYW1vdW50OiB7IHRyZWFzdXJlOiBjYXJkQ29zdC50cmVhc3VyZSArIDEsIHBvdGlvbjogY2FyZENvc3QucG90aW9uIH0gfVxuICAgICAgICBdLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSBjYXJkSWRzWzBdO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1VQR1JBREUgRUZGRUNUXSBnYWluaW5nICR7Y2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpfSB0byBoYW5kLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3dpc2hpbmctd2VsbCc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IG1hdGNoLCBjYXJkTGlicmFyeSwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW1dJU0hJTkcgV0VMTCBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtXSVNISU5HIFdFTEwgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYClcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgLy8gTmFtZSBhIGNhcmQsIHRoZW4gcmV2ZWFsIHRoZSB0b3AgY2FyZCBvZiB5b3VyIGRlY2suIElmIHlvdSBuYW1lZCBpdCwgcHV0IGl0IGludG8geW91ciBoYW5kLlwiXG4gICAgICBjb25zb2xlLmxvZyhgW1dJU0hJTkcgV0VMTCBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIG5hbWUgYSBjYXJkLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNvbnRlbnQ6IHsgdHlwZTogJ25hbWUtY2FyZCcgfSxcbiAgICAgICAgcHJvbXB0OiAnTmFtZSBhIGNhcmQnLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkS2V5IH07XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRLZXk6IENhcmRLZXkgPSByZXN1bHQucmVzdWx0O1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1dJU0hJTkcgV0VMTCBFRkZFQ1RdIHBsYXllciBuYW1lZCAnJHtjYXJkS2V5fSdgKTtcbiAgICAgIFxuICAgICAgaWYgKGFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJywgcGxheWVySWQgfSkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbV0lTSElORyBXRUxMIEVGRkVDVF0gc2h1ZmZsaW5nIHBsYXllcidzIGRlY2suLi5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7XG4gICAgICAgICAgcGxheWVySWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZCA9IGFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJywgcGxheWVySWQgfSkuc2xpY2UoLTEpWzBdPy5pZDtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtXSVNISU5HIFdFTEwgRUZGRUNUXSByZXZlYWxpbmcgY2FyZCAke2NhcmRMaWJyYXJ5LmdldENhcmQoY2FyZElkKX0uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdyZXZlYWxDYXJkJywge1xuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICBpZiAoY2FyZC5jYXJkS2V5ID09PSBjYXJkS2V5KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbV0lTSElORyBXRUxMIEVGRkVDVF0gbW92aW5nICR7Y2FyZH0gdG8gaGFuZGApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGV4cGFuc2lvbk1vZHVsZTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGFBQWEsUUFBUSxrQ0FBa0M7QUFDaEUsU0FBUyxrQkFBa0IsUUFBUSxzQ0FBc0M7QUFJekUsTUFBTSxrQkFBdUM7RUFDM0MsU0FBUztJQUNQLGlCQUFpQixJQUFNLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxHQUFHLE1BQU07UUFDNUYsU0FBUztRQUNULG1FQUFtRTtRQUVuRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtCQUErQixDQUFDO1FBRTdDLE1BQU0sc0JBQXNCLFdBQVc7VUFDckMsT0FBTztRQUNUO1FBRUEsTUFBTSxPQUFPLEtBQUssb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7UUFFL0QsTUFBTSxnQkFBZ0IsS0FBSyxRQUFRLENBQUMsQ0FBQyxNQUNuQyxZQUFZLE9BQU8sQ0FBQyxLQUFLLE9BQU8sS0FBSztRQUd2QyxNQUFNLGtCQUFrQixLQUFLLFNBQVMsQ0FBQztVQUFDO1lBQUUsVUFBVTtVQUFjO1VBQUc7WUFBRSxVQUFVO1VBQVM7U0FBRSxHQUN4RixNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUVuQixJQUFJLENBQUMsZUFBZTtVQUNsQixRQUFRLEdBQUcsQ0FBQyxDQUFDLDJEQUEy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
// denoCacheMetadata=1855067312100762042,13050313831204624533