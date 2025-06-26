import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { fisherYatesShuffle } from '../../utils/fisher-yates-shuffler.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
const expansion = {
  'berserker': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const actionCardsInPlay = getCardsInPlay(args.findCards).some((card)=>card.type.includes('ACTION') && card.owner === eventArgs.playerId);
          if (!actionCardsInPlay) {
            console.log(`[berserker onGained effect] no action cards in play`);
            return;
          }
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          console.log(`[berserker onGained effect] playing ${card}`);
          await args.runGameActionDelegate('playCard', {
            playerId: eventArgs.playerId,
            cardId: eventArgs.cardId
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
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
            playerId: cardEffectArgs.playerId,
            kind: 'upTo',
            amount: {
              treasure: cost.treasure - 1
            }
          }
        ]);
        if (cardIds.length === 0) {
          console.log(`[berserker effect] no cards costing less than ${cost.treasure - 1}`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cardIds.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[berserker effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[berserker effect] gaining card ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0],
          to: {
            location: 'playerDiscard'
          }
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
            console.log(`[berserker triggered effect] no cards to discard for player ${targetPlayerId}`);
            continue;
          }
          console.log(`[berserker triggered effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);
          for(let i = 0; i < numToDiscard; i++){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: hand.slice(-1)[0],
              playerId: targetPlayerId
            });
          }
        }
      }
  },
  'border-village': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          const { cost } = args.cardPriceController.applyRules(card, {
            playerId: eventArgs.playerId
          });
          const cardIds = args.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              playerId: eventArgs.playerId,
              kind: 'upTo',
              amount: {
                treasure: cost.treasure - 1
              }
            }
          ]);
          if (!cardIds.length) {
            console.log(`[border-village onGained effect] no cards costing less than ${cost.treasure - 1}`);
            return;
          }
          const selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: eventArgs.playerId,
            prompt: `Gain card`,
            restrict: cardIds.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[border-village onGained effect] no card selected`);
            return;
          }
          const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[border-village onGained effect] gaining card ${selectedCard}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: selectedCard.id,
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
        console.log(`[border-village effect] drawing 1 card and 2 actions`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
      }
  },
  'cartographer': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[cartographer effect] drawing 1 card and 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        const discard = cardEffectArgs.cardSourceController.getSource('playerDiscard', cardEffectArgs.playerId);
        const numToLookAt = Math.min(4, deck.length + discard.length);
        console.log(`[cartographer effect] looking at ${numToLookAt} cards`);
        if (deck.length < numToLookAt) {
          console.log(`[cartographer effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
        }
        const cardsToLookAt = deck.slice(-numToLookAt);
        let result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: `May discard up to ${cardsToLookAt.length}`,
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'DONE',
              action: 1
            }
          ],
          content: {
            type: 'select',
            cardIds: cardsToLookAt,
            selectCount: {
              kind: 'upTo',
              count: cardsToLookAt.length
            }
          }
        });
        if (!result.result.length) {
          console.warn(`[cartographer effect] no card selected`);
        } else {
          console.log(`[cartographer effect] discarding ${result.result.length} cards`);
          for (const cardId of result.result){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: cardId,
              playerId: cardEffectArgs.playerId
            });
          }
        }
        const cardsToRearrange = cardsToLookAt.filter((id)=>!result.result.includes(id));
        if (!cardsToRearrange.length) {
          console.log(`[cartographer effect] no cards to rearrange`);
          return;
        }
        console.log(`[cartographer effect] rearranging ${cardsToRearrange.length} cards`);
        result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Put back on top of deck in any order',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'DONE',
              action: 1
            }
          ],
          content: {
            type: 'rearrange',
            cardIds: cardsToRearrange
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
      }
  },
  'cauldron': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`cauldron:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[cauldron effect] gaining 1 treasure, and 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        let actionGainCount = 0;
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `cauldron:${cardEffectArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (card.type.includes('ACTION')) {
              actionGainCount++;
              console.log(`[cauldron triggered condition] incrementing action gains for cauldron card ${cardEffectArgs.cardId} to ${actionGainCount}`);
            }
            return actionGainCount === 3;
          },
          triggeredEffectFn: async ()=>{
            cardEffectArgs.reactionManager.unregisterTrigger(`cauldron:${cardEffectArgs.cardId}:cardGained`);
            const targetPlayerIds = findOrderedTargets({
              match: cardEffectArgs.match,
              appliesTo: 'ALL_OTHER',
              startingPlayerId: cardEffectArgs.playerId
            }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
            for (const targetPlayerId of targetPlayerIds){
              const curseIds = cardEffectArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'curse'
                }
              ]);
              if (!curseIds.length) {
                console.log(`[cauldron triggered effect] no curse cards in supply`);
                break;
              }
              console.log(`[cauldron triggered effect] player ${targetPlayerId} gaining ${curseIds.slice(-1)[0]}`);
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: targetPlayerId,
                cardId: curseIds.slice(-1)[0].id,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          }
        });
      }
  },
  'crossroads': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        console.log(`[crossroads effect] revealing ${hand.length} cards`);
        for (const cardId of hand){
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: cardId,
            playerId: cardEffectArgs.playerId
          });
        }
        const victoryCardInHandCount = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('VICTORY')).length;
        console.log(`[crossroads effect] drawing ${victoryCardInHandCount} cards`);
        for(let i = 0; i < victoryCardInHandCount; i++){
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId
          });
        }
        const crossroadsPlayedThisTurnCount = cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.turnNumber].map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.owner === cardEffectArgs.playerId && card.cardKey === 'crossroads').length;
        if (crossroadsPlayedThisTurnCount === 1) {
          console.log(`[crossroads effect] crossroads played this turn ${crossroadsPlayedThisTurnCount}, gaining 3 actions`);
          await cardEffectArgs.runGameActionDelegate('gainAction', {
            count: 3
          });
        } else {
          console.log(`[crossroads effect] crossroads played this turn ${crossroadsPlayedThisTurnCount}, not gaining actions`);
        }
      }
  },
  'develop': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length === 0) {
          console.log(`[develop effect] no cards in hand`);
          return;
        }
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
          console.warn(`[develop effect] no card selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[develop effect] trashing ${card}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: card.id
        });
        const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
          playerId: cardEffectArgs.playerId
        });
        const oneLessCards = cardEffectArgs.findCards([
          {
            location: [
              'basicSupply',
              'kingdomSupply'
            ]
          },
          {
            playerId: cardEffectArgs.playerId,
            kind: 'exact',
            amount: {
              treasure: cost.treasure - 1
            }
          }
        ]);
        const oneMoreCards = cardEffectArgs.findCards([
          {
            location: [
              'basicSupply',
              'kingdomSupply'
            ]
          },
          {
            playerId: cardEffectArgs.playerId,
            kind: 'exact',
            amount: {
              treasure: cost.treasure + 1
            }
          }
        ]);
        let combined = oneLessCards.concat(oneMoreCards);
        if (!combined.length) {
          console.log(`[develop effect] no cards costing 1 less or 1 more in supply`);
          return;
        }
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card costing 1 less, or 1 more`,
          restrict: combined.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[develop effect] no card selected`);
          return;
        }
        combined = [];
        let nextPrompt = '';
        if (oneLessCards.findIndex((card)=>card.id === selectedCardIds[0]) !== -1) {
          console.log(`[develop effect] card gained was one less`);
          nextPrompt = `Gain card costing 1 more`;
          combined = oneMoreCards;
        } else if (oneMoreCards.findIndex((card)=>card.id === selectedCardIds[0]) !== -1) {
          console.log(`[develop effect] card gained was one more`);
          nextPrompt = `Gain card costing 1 less`;
          combined = oneLessCards;
        }
        if (!combined.length) {
          console.log(`[develop effect] no remaining cards to gain`);
          return;
        }
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: nextPrompt,
          restrict: combined.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[develop effect] no card selected`);
          return;
        }
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0],
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'farmland': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, rest)=>{
          const hand = args.cardSourceController.getSource('playerHand', rest.playerId);
          if (hand.length === 0) {
            console.log(`[farmland onGained effect] no cards in hand`);
            return;
          }
          let selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: rest.playerId,
            prompt: `Trash a card`,
            restrict: {
              location: 'playerHand',
              playerId: rest.playerId
            },
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[farmland onGained effect] no card selected`);
            return;
          }
          let selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[farmland onGained effect] trashing ${selectedCard}`);
          await args.runGameActionDelegate('trashCard', {
            playerId: rest.playerId,
            cardId: selectedCard.id
          });
          const { cost } = args.cardPriceController.applyRules(selectedCard, {
            playerId: rest.playerId
          });
          const nonFarmlandCards = args.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              playerId: rest.playerId,
              kind: 'exact',
              amount: {
                treasure: cost.treasure + 2
              }
            }
          ]).filter((card)=>card.cardKey !== 'farmland');
          if (!nonFarmlandCards.length) {
            console.log(`[farmland onGained effect] no non-farmland cards costing exactly 2 more than ${selectedCard} in supply`);
            return;
          }
          selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: rest.playerId,
            prompt: `Gain card`,
            restrict: nonFarmlandCards.map((card)=>card.id),
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[farmland onGained effect] no card selected`);
            return;
          }
          selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[farmland onGained effect] gaining card ${selectedCard}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: rest.playerId,
            cardId: selectedCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      })
  },
  'fools-gold': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`fools-gold:${eventArgs.cardId}:cardGained`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `fools-gold:${eventArgs.cardId}:cardGained`,
            playerId: eventArgs.playerId,
            listeningFor: 'cardGained',
            once: false,
            compulsory: false,
            allowMultipleInstances: true,
            condition: (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
              const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (card.cardKey !== 'province') return false;
              return true;
            },
            triggeredEffectFn: async (triggeredEffectArgs)=>{
              console.log(`[fools-gold triggered effect] trashing fools gold`);
              await triggeredEffectArgs.runGameActionDelegate('trashCard', {
                playerId: triggeredEffectArgs.trigger.args.playerId,
                cardId: eventArgs.cardId
              });
              const goldCardIds = triggeredEffectArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'gold'
                }
              ]);
              if (!goldCardIds.length) {
                console.log(`[fools-gold triggered effect] no gold cards in supply`);
                return;
              }
              const card = goldCardIds.slice(-1)[0];
              console.log(`[fools-gold triggered effect] gaining ${card}`);
              await triggeredEffectArgs.runGameActionDelegate('gainCard', {
                playerId: eventArgs.playerId,
                cardId: card.id,
                to: {
                  location: 'playerDeck'
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const foolsGoldPlayedThisTurnCount = cardEffectArgs.match.stats.playedCardsByTurn[cardEffectArgs.match.turnNumber].map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.owner === cardEffectArgs.playerId && card.cardKey === 'fools-gold').length;
        console.log(`[fools-gold effect] fools-gold played this turn ${foolsGoldPlayedThisTurnCount}`);
        if (foolsGoldPlayedThisTurnCount === 1) {
          console.log(`[fools-gold effect] gaining 1 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', {
            count: 1
          });
        } else {
          console.log(`[fools-gold effect] gaining 4 treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', {
            count: 4
          });
        }
      }
  },
  'guard-dog': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`guard-dog:${eventArgs.cardId}:cardPlayed`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `guard-dog:${eventArgs.cardId}:cardPlayed`,
            listeningFor: 'cardPlayed',
            once: false,
            playerId: eventArgs.playerId,
            allowMultipleInstances: true,
            compulsory: false,
            condition: (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
              const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!card.type.includes('ATTACK')) return false;
              return true;
            },
            triggeredEffectFn: async ()=>{
              console.log(`[guard-dog triggered effect] playing guard-dog ${eventArgs.cardId}`);
              await args.runGameActionDelegate('playCard', {
                playerId: eventArgs.playerId,
                cardId: eventArgs.cardId,
                overrides: {
                  actionCost: 0
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[guard-dog effect] drawing 2 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length <= 5) {
          console.log(`[guard-dog effect] hand size is ${hand.length}, drawing 2 more cards`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2
          });
        }
      }
  },
  'haggler': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`haggler:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[haggler effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `haggler:${cardEffectArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          playerId: cardEffectArgs.playerId,
          condition: (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (!conditionArgs.trigger.args.bought) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredEffectArgs)=>{
            const card = triggeredEffectArgs.cardLibrary.getCard(triggeredEffectArgs.trigger.args.cardId);
            const { cost } = cardEffectArgs.cardPriceController.applyRules(card, {
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
                playerId: cardEffectArgs.playerId,
                kind: 'upTo',
                amount: {
                  treasure: cost.treasure - 1,
                  potion: cost.potion
                }
              }
            ]).filter((card)=>!card.type.includes('VICTORY'));
            if (cards.length === 0) {
              console.log(`[haggler triggered effect] no cards non-victory cards costing 2 less than ${cost.treasure}`);
              return;
            }
            const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Gain non-Victory card`,
              restrict: cards.map((card)=>card.id),
              count: 1
            });
            if (!selectedCardIds.length) {
              console.log(`[haggler triggered effect] no card selected`);
              return;
            }
            const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
            console.log(`[haggler triggered effect] gaining ${selectedCard}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCard.id,
              to: {
                location: 'playerDiscard'
              }
            }, {
              loggingContext: {
                source: cardEffectArgs.cardId
              }
            });
          }
        });
      }
  },
  'highway': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[highway effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const cards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
        const unsubs = [];
        const rule = (card, context)=>{
          return {
            restricted: false,
            cost: {
              treasure: -1,
              potion: 0
            }
          };
        };
        for (const card of cards){
          unsubs.push(cardEffectArgs.cardPriceController.registerRule(card, rule));
        }
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `highway:${cardEffectArgs.cardId}:endTurn`,
          listeningFor: 'endTurn',
          condition: ()=>true,
          once: true,
          compulsory: true,
          playerId: cardEffectArgs.playerId,
          allowMultipleInstances: true,
          triggeredEffectFn: async ()=>{
            unsubs.forEach((c)=>c());
          }
        });
      }
  },
  'inn': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const actionsInDiscard = args.findCards({
            location: 'playerDiscard',
            playerId: eventArgs.playerId
          }).filter((card)=>card.type.includes('ACTION'));
          if (!actionsInDiscard.length) {
            console.log(`[inn onGained effect] no actions in discard`);
            return;
          }
          const result = await args.runGameActionDelegate('userPrompt', {
            prompt: 'Reveal actions to shuffle into deck?',
            playerId: eventArgs.playerId,
            actionButtons: [
              {
                label: 'DONE',
                action: 1
              }
            ],
            content: {
              type: 'select',
              cardIds: actionsInDiscard.map((card)=>card.id),
              selectCount: {
                kind: 'upTo',
                count: actionsInDiscard.length
              }
            }
          });
          if (!result.result.length) {
            console.log(`[inn onGained effect] no cards selected`);
            return;
          }
          console.log(`[inn onGained effect] revealing ${result.result.length} cards and moving to deck`);
          for (const cardId of result.result){
            await args.runGameActionDelegate('revealCard', {
              cardId: cardId,
              playerId: eventArgs.playerId
            });
            await args.runGameActionDelegate('moveCard', {
              cardId: cardId,
              toPlayerId: eventArgs.playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
          console.log(`[inn onGained effect] shuffling player deck`);
          fisherYatesShuffle(args.cardSourceController.getSource('playerDeck', eventArgs.playerId), true);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[inn effect] drawing 2 cards, and gaining 2 actions`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          count: Math.min(2, cardEffectArgs.findCards({
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          }).length)
        });
        if (!selectedCardIds) {
          console.warn(`[inn effect] no card selected`);
          return;
        }
        console.log(`[inn effect] discarding ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: selectedCardId,
            playerId: cardEffectArgs.playerId
          });
        }
      }
  },
  'jack-of-all-trades': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const silverCardIds = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'silver'
          }
        ]);
        if (!silverCardIds.length) {
          console.log(`[jack-of-all-trades effect] no silver cards in supply`);
        } else {
          console.log(`[jack-of-all-trades effect] gaining a silver`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCardIds.slice(-1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (deck.length === 0) {
          console.log(`[jack-of-all-trades effect] no cards in deck, shuffling`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
        }
        if (deck.length === 0) {
          console.log(`[jack-of-all-trades effect] no cards in deck after shuffling`);
        } else {
          const cardId = deck.slice(-1)[0];
          const card = cardEffectArgs.cardLibrary.getCard(cardId);
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            prompt: `Discard ${card.cardName}`,
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
          if (result.action === 2) {
            console.log(`[jack-of-all-trades effect] discarding ${card}`);
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId,
              playerId: cardEffectArgs.playerId
            });
          }
        }
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        while(deck.length > 0 && hand.length < 5){
          console.log(`[jack-of-all-trades effect] drawing card`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId
          });
        }
        const nonTreasureCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>!card.type.includes('TREASURE'));
        if (nonTreasureCardsInHand.length === 0) {
          console.log(`[jack-of-all-trades effect] no non-treasure cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash a card`,
          restrict: nonTreasureCardsInHand.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (selectedCardIds.length === 0) {
          console.log(`[jack-of-all-trades effect] no card selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[jack-of-all-trades effect] trashing ${card}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardIds[0]
        });
      }
  },
  'margrave': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[margrave effect] drawing 3 cards, and gaining 1 buy`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          startingPlayerId: cardEffectArgs.playerId,
          appliesTo: 'ALL_OTHER'
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: targetPlayerId
          });
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const numToDiscard = hand.length > 3 ? hand.length - 3 : 0;
          if (numToDiscard === 0) {
            console.log(`[margrave effect] player ${targetPlayerId} already at 3 or less cards`);
            continue;
          }
          console.log(`[margrave effect] player ${targetPlayerId} discarding ${numToDiscard} cards`);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Discard card/s`,
            restrict: hand,
            count: numToDiscard
          });
          if (!selectedCardIds.length) {
            console.warn(`[margrave effect] no card selected`);
            continue;
          }
          for(let i = 0; i < selectedCardIds.length; i++){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              cardId: selectedCardIds[i],
              playerId: targetPlayerId
            });
          }
        }
      }
  },
  'nomads': {
    registerLifeCycleMethods: ()=>({
        onTrashed: async (args, eventArgs)=>{
          if (eventArgs.playerId !== getCurrentPlayer(args.match).id) {
            return;
          }
          console.log(`[nomads onTrashed effect] gaining 2 treasure`);
          await args.runGameActionDelegate('gainTreasure', {
            count: 2
          });
        },
        onGained: async (args, eventArgs)=>{
          if (eventArgs.playerId !== getCurrentPlayer(args.match).id) {
            return;
          }
          console.log(`[nomads onGained effect] gaining 2 treasure`);
          await args.runGameActionDelegate('gainTreasure', {
            count: 2
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[nomads effect] gaining 1 buy, and 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
      }
  },
  'oasis': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[oasis effect] drawing 1 card, gaining 1 action, and gaining 1 treasure`);
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
          prompt: `Discard card`,
          restrict: {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[oasis effect] no card selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[oasis effect] discarding ${card}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: card.id,
          playerId: cardEffectArgs.playerId
        });
      }
  },
  'scheme': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[scheme effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `scheme:${cardEffectArgs.cardId}:discardCard`,
          listeningFor: 'discardCard',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (!conditionArgs.trigger.args.previousLocation) return false;
            if (!isLocationInPlay(conditionArgs.trigger.args.previousLocation.location)) return false;
            const card = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (card.owner !== cardEffectArgs.playerId) return false;
            if (!card.type.includes('ACTION')) return false;
            const result = await conditionArgs.runGameActionDelegate('userPrompt', {
              prompt: `Top-deck ${card.cardName}?`,
              playerId: conditionArgs.trigger.args.playerId,
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
            if (result.action === 1) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredEffectArgs)=>{
            const card = triggeredEffectArgs.cardLibrary.getCard(triggeredEffectArgs.trigger.args.cardId);
            console.log(`[scheme triggered effect] moving ${card} to deck`);
            await triggeredEffectArgs.runGameActionDelegate('moveCard', {
              cardId: triggeredEffectArgs.trigger.args.cardId,
              toPlayerId: cardEffectArgs.playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        });
      }
  },
  'souk': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const numToTrash = Math.min(2, args.cardSourceController.getSource('playerHand', eventArgs.playerId).length);
          const selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: eventArgs.playerId,
            prompt: `Trash card/s`,
            restrict: {
              location: 'playerHand',
              playerId: eventArgs.playerId
            },
            count: {
              kind: 'upTo',
              count: numToTrash
            },
            optional: true
          });
          if (!selectedCardIds.length) {
            console.log(`[souk onGained effect] no card selected`);
            return;
          }
          console.log(`[souk onGained effect] trashing ${selectedCardIds.length} cards`);
          for (const cardId of selectedCardIds){
            await args.runGameActionDelegate('trashCard', {
              playerId: eventArgs.playerId,
              cardId: cardId
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[souk effect] gaining 1 buy, and gaining 7 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 7
        });
        const handSize = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length;
        const numToLose = Math.min(cardEffectArgs.match.playerTreasure, handSize);
        console.log(`[souk effect] losing ${numToLose} treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: -handSize
        });
      }
  },
  'spice-merchant': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const treasuresInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE'));
        if (!treasuresInHand.length) {
          console.log(`[spice-merchant effect] no treasure cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: treasuresInHand.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[spice-merchant effect] no card selected`);
          return;
        }
        const card = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[spice-merchant effect] trashing ${card}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: card.id
        });
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose one',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: '+2 Cards, + 1 Action',
              action: 1
            },
            {
              label: '+1 Buy, +2 Treasure',
              action: 2
            }
          ]
        });
        switch(result.action){
          case 1:
            console.log(`[spice-merchant effect] drawing 2 cards and gaining 1 action`);
            await cardEffectArgs.runGameActionDelegate('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 2
            });
            await cardEffectArgs.runGameActionDelegate('gainAction', {
              count: 1
            });
            break;
          case 2:
            console.log(`[spice-merchant effect] gaining 1 buy, and 2 treasure`);
            await cardEffectArgs.runGameActionDelegate('gainBuy', {
              count: 1
            });
            await cardEffectArgs.runGameActionDelegate('gainTreasure', {
              count: 2
            });
            break;
        }
      }
  },
  'stables': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const treasuresInHand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE'));
        if (!treasuresInHand.length) {
          console.log(`[stables effect] no treasure cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard treasure`,
          restrict: treasuresInHand.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[stables effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[stables effect] discarding ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCard.id,
          playerId: cardEffectArgs.playerId
        });
        console.log(`[stables effect] drawing 3 cards, and gaining 1 action `);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 3
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
      }
  },
  'trader': {
    registerLifeCycleMethods: ()=>({
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`trader:${eventArgs.cardId}:cardGained`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `trader:${eventArgs.cardId}:cardGained`,
            listeningFor: 'cardGained',
            playerId: eventArgs.playerId,
            once: false,
            allowMultipleInstances: false,
            compulsory: false,
            condition: (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) return false;
              return true;
            },
            triggeredEffectFn: async (triggerArgs)=>{
              const traderCard = triggerArgs.cardLibrary.getCard(eventArgs.cardId);
              console.log(`[trader onEnterHand event] revealing trader`);
              await triggerArgs.runGameActionDelegate('revealCard', {
                cardId: traderCard.id,
                playerId: eventArgs.playerId
              });
              const gainedCard = triggerArgs.cardLibrary.getCard(triggerArgs.trigger.args.cardId);
              if (triggerArgs.trigger.args.previousLocation) {
                console.log(`[trader onEnterHand event] putting ${gainedCard} back in previous location`);
                await triggerArgs.runGameActionDelegate('moveCard', {
                  cardId: gainedCard.id,
                  toPlayerId: triggerArgs.trigger.args.previousLocation.playerId,
                  to: {
                    location: triggerArgs.trigger.args.previousLocation.location
                  }
                });
              } else {
                console.warn(`[trader onEnterHand event] gained ${gainedCard} has no previous location`);
              }
              const silverCardIds = triggerArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'silver'
                }
              ]);
              if (!silverCardIds.length) {
                console.log(`[trader onEnterHand event] no silvers in supply`);
                return;
              }
              const silverCard = silverCardIds[0];
              console.log(`[trader onEnterHand event] gaining ${silverCard} instead`);
              await triggerArgs.runGameActionDelegate('moveCard', {
                cardId: silverCard.id,
                toPlayerId: eventArgs.playerId,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length === 0) {
          console.log(`[trader effect] no cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash card`,
          restrict: {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[trader effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[trader effect] trashing ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId
        });
        const silverCardIds = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'silver'
          }
        ]);
        if (!silverCardIds.length) {
          console.log(`[trader effect] no silver cards in supply`);
          return;
        }
        const numToGain = Math.min(silverCardIds.length, cost.treasure);
        console.log(`[trader effect] gaining ${numToGain} silver cards`);
        for(let i = 0; i < numToGain; i++){
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCardIds.slice(-i - 1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'trail': {
    registerLifeCycleMethods: ()=>{
      async function doTrail(args, eventArgs) {
        if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
          console.log(`[trail onGained/Trashed/Discarded event] happening during clean-up, skipping`);
          return;
        }
        const result = await args.runGameActionDelegate('userPrompt', {
          prompt: 'Play Trail?',
          playerId: eventArgs.playerId,
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
          console.log(`[trail onGained/Trashed/Discarded event] not playing trail`);
          return;
        }
        console.log(`[trail onGained/Trashed/Discarded event] playing trail`);
        await args.runGameActionDelegate('playCard', {
          playerId: eventArgs.playerId,
          cardId: eventArgs.cardId,
          overrides: {
            actionCost: 0
          }
        });
      }
      return {
        onGained: async (args, eventArgs)=>{
          await doTrail(args, eventArgs);
        },
        onTrashed: async (args, eventArgs)=>{
          await doTrail(args, eventArgs);
        },
        onDiscarded: async (args, eventArgs)=>{
          await doTrail(args, eventArgs);
        }
      };
    },
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[trail effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
      }
  },
  'tunnel': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
            console.log(`[tunnel onDiscarded event] happening during clean-up, skipping`);
            return;
          }
          const result = await args.runGameActionDelegate('userPrompt', {
            prompt: 'Reveal tunnel?',
            playerId: eventArgs.playerId,
            actionButtons: [
              {
                label: 'CANCEL',
                action: 1
              },
              {
                label: 'REVEAL',
                action: 2
              }
            ]
          });
          if (result.action === 1) {
            console.log(`[tunnel onDiscarded event] not revealing tunnel`);
            return;
          }
          console.log(`[tunnel onDiscarded event] revealing tunnel`);
          await args.runGameActionDelegate('revealCard', {
            cardId: eventArgs.cardId,
            playerId: eventArgs.playerId
          });
          const goldCardIds = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'gold'
            }
          ]);
          if (!goldCardIds.length) {
            console.log(`[tunnel onDiscarded event] no gold cards in supply`);
            return;
          }
          const goldCard = goldCardIds.slice(-1)[0];
          console.log(`[tunnel onDiscarded event] gaining ${goldCard}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: goldCard.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      })
  },
  'weaver': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          if (getTurnPhase(args.match.turnPhaseIndex) === 'cleanup') {
            console.log(`[weaver onDiscarded event] happening during clean-up, skipping`);
            return;
          }
          const result = await args.runGameActionDelegate('userPrompt', {
            prompt: 'Play Weaver?',
            playerId: eventArgs.playerId,
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
            console.log(`[weaver onDiscarded event] not playing weaver`);
            return;
          }
          console.log(`[weaver onDiscarded event] playing weaver`);
          await args.runGameActionDelegate('playCard', {
            playerId: eventArgs.playerId,
            cardId: eventArgs.cardId
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          prompt: 'Choose two silvers, or gain a card costing up to $4',
          playerId: cardEffectArgs.playerId,
          actionButtons: [
            {
              label: 'SILVERS',
              action: 1
            },
            {
              label: 'GAIN CARD',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[weaver effect] choosing silvers`);
          const silverCardIds = cardEffectArgs.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'silver'
            }
          ]);
          if (!silverCardIds.length) {
            console.log(`[weaver effect] no silver cards in supply`);
            return;
          }
          const numToGain = Math.min(silverCardIds.length, 2);
          console.log(`[weaver effect] gaining ${numToGain} silver cards`);
          for(let i = 0; i < numToGain; i++){
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: silverCardIds.slice(-i - 1)[0].id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        } else {
          console.log(`[weaver effect] choosing card costing up to $4`);
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
            console.warn(`[weaver effect] no card selected`);
            return;
          }
        }
      }
  },
  'wheelwright': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        if (hand.length === 0) {
          console.log(`[wheelwright effect] no cards in hand`);
          return;
        }
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard card`,
          restrict: {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[wheelwright effect] no card selected`);
          return;
        }
        let selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          cardId: selectedCard.id,
          playerId: cardEffectArgs.playerId
        });
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId
        });
        const actionCardIds = cardEffectArgs.findCards([
          {
            location: [
              'kingdomSupply'
            ]
          },
          {
            cardType: 'ACTION'
          },
          {
            kind: 'upTo',
            playerId: cardEffectArgs.playerId,
            amount: {
              treasure: cost.treasure,
              potion: cost.potion
            }
          }
        ]);
        if (!actionCardIds.length) {
          console.log(`[wheelwright effect] no action cards in kingdom`);
          return;
        }
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: actionCardIds.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[wheelwright effect] no card selected`);
          return;
        }
        selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[wheelwright effect] gaining ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'witchs-hut': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[witchs-hut effect] drawing 4 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 4
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards`,
          restrict: {
            location: 'playerHand',
            playerId: cardEffectArgs.playerId
          },
          count: Math.min(2, cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).length)
        });
        console.log(`[witchs-hut effect] revealing and discarding ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('revealCard', {
            cardId: selectedCardId,
            playerId: cardEffectArgs.playerId
          });
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            cardId: selectedCardId,
            playerId: cardEffectArgs.playerId
          });
        }
        if (selectedCardIds.length === 2) {
          if (selectedCardIds.map(cardEffectArgs.cardLibrary.getCard).every((card)=>card.type.includes('ACTION'))) {
            console.log(`[witchs-hut effect] every card discarded is an action, others gaining a curse`);
            const targetPlayerIds = findOrderedTargets({
              match: cardEffectArgs.match,
              startingPlayerId: cardEffectArgs.playerId,
              appliesTo: 'ALL_OTHER'
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
                console.log(`[witchs-hut effect] no curse cards in supply`);
                return;
              }
              const curseCard = curseCardIds.slice(-1)[0];
              console.log(`[witchs-hut effect] gaining ${curseCard} to ${targetPlayerId}`);
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: targetPlayerId,
                cardId: curseCard.id,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          } else {
            console.log(`[witchs-hut effect] not every card discarded is an action`);
          }
        }
      }
  }
};
export default expansion;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9oaW50ZXJsYW5kcy9jYXJkLWVmZmVjdHMtaGludGVybGFuZHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2FyZElkLCBQbGF5ZXJJZCB9IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHsgQ2FyZEV4cGFuc2lvbk1vZHVsZSwgQ2FyZExpZmVjeWNsZUNhbGxiYWNrQ29udGV4dCB9IGZyb20gJy4uLy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IGdldENhcmRzSW5QbGF5IH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LWNhcmRzLWluLXBsYXkudHMnO1xuaW1wb3J0IHsgZmluZE9yZGVyZWRUYXJnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmluZC1vcmRlcmVkLXRhcmdldHMudHMnO1xuaW1wb3J0IHsgQ2FyZFByaWNlUnVsZSB9IGZyb20gJy4uLy4uL2NvcmUvY2FyZC1wcmljZS1ydWxlcy1jb250cm9sbGVyLnRzJztcbmltcG9ydCB7IGZpc2hlcllhdGVzU2h1ZmZsZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Zpc2hlci15YXRlcy1zaHVmZmxlci50cyc7XG5pbXBvcnQgeyBnZXRDdXJyZW50UGxheWVyIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LWN1cnJlbnQtcGxheWVyLnRzJztcbmltcG9ydCB7IGlzTG9jYXRpb25JblBsYXkgfSBmcm9tICcuLi8uLi91dGlscy9pcy1pbi1wbGF5LnRzJztcbmltcG9ydCB7IGdldFR1cm5QaGFzZSB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC10dXJuLXBoYXNlLnRzJztcblxuY29uc3QgZXhwYW5zaW9uOiBDYXJkRXhwYW5zaW9uTW9kdWxlID0ge1xuICAnYmVyc2Vya2VyJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uR2FpbmVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGFjdGlvbkNhcmRzSW5QbGF5ID0gZ2V0Q2FyZHNJblBsYXkoYXJncy5maW5kQ2FyZHMpXG4gICAgICAgICAgLnNvbWUoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpICYmIGNhcmQub3duZXIgPT09IGV2ZW50QXJncy5wbGF5ZXJJZClcbiAgICAgICAgXG4gICAgICAgIGlmICghYWN0aW9uQ2FyZHNJblBsYXkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2JlcnNlcmtlciBvbkdhaW5lZCBlZmZlY3RdIG5vIGFjdGlvbiBjYXJkcyBpbiBwbGF5YCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGV2ZW50QXJncy5jYXJkSWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtiZXJzZXJrZXIgb25HYWluZWQgZWZmZWN0XSBwbGF5aW5nICR7Y2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogZXZlbnRBcmdzLmNhcmRJZFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoXG4gICAgICAgIGNhcmQsXG4gICAgICAgIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH1cbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBraW5kOiAndXBUbycsIGFtb3VudDogeyB0cmVhc3VyZTogY29zdC50cmVhc3VyZSAtIDEgfVxuICAgICAgICB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKGNhcmRJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYmVyc2Vya2VyIGVmZmVjdF0gbm8gY2FyZHMgY29zdGluZyBsZXNzIHRoYW4gJHtjb3N0LnRyZWFzdXJlIC0gMX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRJZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtiZXJzZXJrZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2JlcnNlcmtlciBlZmZlY3RdIGdhaW5pbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkc1swXSxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgbWF0Y2g6IGNhcmRFZmZlY3RBcmdzLm1hdGNoLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSkuZmlsdGVyKHBsYXllcklkID0+IGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uQ29udGV4dD8uW3BsYXllcklkXT8ucmVzdWx0ICE9PSAnaW1tdW5pdHknKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHRhcmdldFBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IG51bVRvRGlzY2FyZCA9IGhhbmQubGVuZ3RoIC0gMztcbiAgICAgICAgaWYgKG51bVRvRGlzY2FyZCA8PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtiZXJzZXJrZXIgdHJpZ2dlcmVkIGVmZmVjdF0gbm8gY2FyZHMgdG8gZGlzY2FyZCBmb3IgcGxheWVyICR7dGFyZ2V0UGxheWVySWR9YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbYmVyc2Vya2VyIHRyaWdnZXJlZCBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBkaXNjYXJkaW5nICR7bnVtVG9EaXNjYXJkfSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0Rpc2NhcmQ7IGkrKykge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGhhbmQuc2xpY2UoLTEpWzBdLFxuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdib3JkZXItdmlsbGFnZSc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkdhaW5lZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGV2ZW50QXJncy5jYXJkSWQpO1xuICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKFxuICAgICAgICAgIGNhcmQsXG4gICAgICAgICAgeyBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkIH1cbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRJZHMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgICB7IHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsIGtpbmQ6ICd1cFRvJywgYW1vdW50OiB7IHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlIC0gMSB9IH0sXG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFjYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbYm9yZGVyLXZpbGxhZ2Ugb25HYWluZWQgZWZmZWN0XSBubyBjYXJkcyBjb3N0aW5nIGxlc3MgdGhhbiAke2Nvc3QudHJlYXN1cmUgLSAxfWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBjYXJkSWRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW2JvcmRlci12aWxsYWdlIG9uR2FpbmVkIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2JvcmRlci12aWxsYWdlIG9uR2FpbmVkIGVmZmVjdF0gZ2FpbmluZyBjYXJkICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBldmVudEFyZ3MuY2FyZElkIH0gfSk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYm9yZGVyLXZpbGxhZ2UgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCBhbmQgMiBhY3Rpb25zYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2NhcnRvZ3JhcGhlcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtjYXJ0b2dyYXBoZXIgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCBhbmQgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBjb25zdCBkaXNjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEaXNjYXJkJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBudW1Ub0xvb2tBdCA9IE1hdGgubWluKDQsIGRlY2subGVuZ3RoICsgZGlzY2FyZC5sZW5ndGgpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2NhcnRvZ3JhcGhlciBlZmZlY3RdIGxvb2tpbmcgYXQgJHtudW1Ub0xvb2tBdH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgaWYgKGRlY2subGVuZ3RoIDwgbnVtVG9Mb29rQXQpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtjYXJ0b2dyYXBoZXIgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkc1RvTG9va0F0ID0gZGVjay5zbGljZSgtbnVtVG9Mb29rQXQpO1xuICAgICAgXG4gICAgICBsZXQgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwcm9tcHQ6IGBNYXkgZGlzY2FyZCB1cCB0byAke2NhcmRzVG9Mb29rQXQubGVuZ3RofWAsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdET05FJywgYWN0aW9uOiAxIH1cbiAgICAgICAgXSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIGNhcmRJZHM6IGNhcmRzVG9Mb29rQXQsXG4gICAgICAgICAgc2VsZWN0Q291bnQ6IHtcbiAgICAgICAgICAgIGtpbmQ6ICd1cFRvJyxcbiAgICAgICAgICAgIGNvdW50OiBjYXJkc1RvTG9va0F0Lmxlbmd0aFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkSWRbXSB9O1xuICAgICAgXG4gICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2NhcnRvZ3JhcGhlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2NhcnRvZ3JhcGhlciBlZmZlY3RdIGRpc2NhcmRpbmcgJHtyZXN1bHQucmVzdWx0Lmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkc1RvUmVhcnJhbmdlID0gY2FyZHNUb0xvb2tBdC5maWx0ZXIoaWQgPT4gIXJlc3VsdC5yZXN1bHQuaW5jbHVkZXMoaWQpKTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkc1RvUmVhcnJhbmdlLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2NhcnRvZ3JhcGhlciBlZmZlY3RdIG5vIGNhcmRzIHRvIHJlYXJyYW5nZWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbY2FydG9ncmFwaGVyIGVmZmVjdF0gcmVhcnJhbmdpbmcgJHtjYXJkc1RvUmVhcnJhbmdlLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnUHV0IGJhY2sgb24gdG9wIG9mIGRlY2sgaW4gYW55IG9yZGVyJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgeyBsYWJlbDogJ0RPTkUnLCBhY3Rpb246IDEgfVxuICAgICAgICBdLFxuICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgdHlwZTogJ3JlYXJyYW5nZScsXG4gICAgICAgICAgY2FyZElkczogY2FyZHNUb1JlYXJyYW5nZSxcbiAgICAgICAgfVxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBDYXJkSWRbXSB9O1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiByZXN1bHQucmVzdWx0KSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2NhdWxkcm9uJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjYXVsZHJvbjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtjYXVsZHJvbiBlZmZlY3RdIGdhaW5pbmcgMSB0cmVhc3VyZSwgYW5kIDEgYnV5YCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBsZXQgYWN0aW9uR2FpbkNvdW50ID0gMDtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgY2F1bGRyb246JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkR2FpbmVkJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGlmIChjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKSB7XG4gICAgICAgICAgICBhY3Rpb25HYWluQ291bnQrKztcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbY2F1bGRyb24gdHJpZ2dlcmVkIGNvbmRpdGlvbl0gaW5jcmVtZW50aW5nIGFjdGlvbiBnYWlucyBmb3IgY2F1bGRyb24gY2FyZCAke2NhcmRFZmZlY3RBcmdzLmNhcmRJZH0gdG8gJHthY3Rpb25HYWluQ291bnR9YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBhY3Rpb25HYWluQ291bnQgPT09IDM7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjYXVsZHJvbjoke2NhcmRFZmZlY3RBcmdzLmNhcmRJZH06Y2FyZEdhaW5lZGApXG4gICAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgICAgICBzdGFydGluZ1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnNlSWRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgICAgICB7IGNhcmRLZXlzOiAnY3Vyc2UnIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWN1cnNlSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW2NhdWxkcm9uIHRyaWdnZXJlZCBlZmZlY3RdIG5vIGN1cnNlIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtjYXVsZHJvbiB0cmlnZ2VyZWQgZWZmZWN0XSBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gZ2FpbmluZyAke2N1cnNlSWRzLnNsaWNlKC0xKVswXX1gKTtcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBjdXJzZUlkcy5zbGljZSgtMSlbMF0uaWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ2Nyb3Nzcm9hZHMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbY3Jvc3Nyb2FkcyBlZmZlY3RdIHJldmVhbGluZyAke2hhbmQubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBoYW5kKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB2aWN0b3J5Q2FyZEluSGFuZENvdW50ID0gaGFuZC5tYXAoY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZClcbiAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQudHlwZS5pbmNsdWRlcygnVklDVE9SWScpKVxuICAgICAgICAubGVuZ3RoO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2Nyb3Nzcm9hZHMgZWZmZWN0XSBkcmF3aW5nICR7dmljdG9yeUNhcmRJbkhhbmRDb3VudH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2aWN0b3J5Q2FyZEluSGFuZENvdW50OyBpKyspIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjcm9zc3JvYWRzUGxheWVkVGhpc1R1cm5Db3VudCA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzQnlUdXJuW2NhcmRFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXJdXG4gICAgICAgIC5tYXAoY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZClcbiAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQub3duZXIgPT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkICYmIGNhcmQuY2FyZEtleSA9PT0gJ2Nyb3Nzcm9hZHMnKVxuICAgICAgICAubGVuZ3RoO1xuICAgICAgXG4gICAgICBpZiAoY3Jvc3Nyb2Fkc1BsYXllZFRoaXNUdXJuQ291bnQgPT09IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtjcm9zc3JvYWRzIGVmZmVjdF0gY3Jvc3Nyb2FkcyBwbGF5ZWQgdGhpcyB0dXJuICR7Y3Jvc3Nyb2Fkc1BsYXllZFRoaXNUdXJuQ291bnR9LCBnYWluaW5nIDMgYWN0aW9uc2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAzIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbY3Jvc3Nyb2FkcyBlZmZlY3RdIGNyb3Nzcm9hZHMgcGxheWVkIHRoaXMgdHVybiAke2Nyb3Nzcm9hZHNQbGF5ZWRUaGlzVHVybkNvdW50fSwgbm90IGdhaW5pbmcgYWN0aW9uc2ApO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2RldmVsb3AnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2RldmVsb3AgZWZmZWN0XSBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgbGV0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBUcmFzaCBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtkZXZlbG9wIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbZGV2ZWxvcCBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKFxuICAgICAgICBjYXJkLFxuICAgICAgICB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9XG4gICAgICApO1xuICAgICAgXG4gICAgICBjb25zdCBvbmVMZXNzQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwga2luZDogJ2V4YWN0JywgYW1vdW50OiB7IHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlIC0gMSB9IH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBjb25zdCBvbmVNb3JlQ2FyZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwga2luZDogJ2V4YWN0JywgYW1vdW50OiB7IHRyZWFzdXJlOiBjb3N0LnRyZWFzdXJlICsgMSB9IH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBsZXQgY29tYmluZWQgPSBvbmVMZXNzQ2FyZHMuY29uY2F0KG9uZU1vcmVDYXJkcyk7XG4gICAgICBcbiAgICAgIGlmICghY29tYmluZWQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZGV2ZWxvcCBlZmZlY3RdIG5vIGNhcmRzIGNvc3RpbmcgMSBsZXNzIG9yIDEgbW9yZSBpbiBzdXBwbHlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkIGNvc3RpbmcgMSBsZXNzLCBvciAxIG1vcmVgLFxuICAgICAgICByZXN0cmljdDogY29tYmluZWQubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2RldmVsb3AgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29tYmluZWQgPSBbXTtcbiAgICAgIFxuICAgICAgbGV0IG5leHRQcm9tcHQgPSAnJztcbiAgICAgIGlmIChvbmVMZXNzQ2FyZHMuZmluZEluZGV4KGNhcmQgPT4gY2FyZC5pZCA9PT0gc2VsZWN0ZWRDYXJkSWRzWzBdKSAhPT0gLTEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtkZXZlbG9wIGVmZmVjdF0gY2FyZCBnYWluZWQgd2FzIG9uZSBsZXNzYCk7XG4gICAgICAgIG5leHRQcm9tcHQgPSBgR2FpbiBjYXJkIGNvc3RpbmcgMSBtb3JlYDtcbiAgICAgICAgY29tYmluZWQgPSBvbmVNb3JlQ2FyZHM7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChvbmVNb3JlQ2FyZHMuZmluZEluZGV4KGNhcmQgPT4gY2FyZC5pZCA9PT0gc2VsZWN0ZWRDYXJkSWRzWzBdKSAhPT0gLTEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtkZXZlbG9wIGVmZmVjdF0gY2FyZCBnYWluZWQgd2FzIG9uZSBtb3JlYCk7XG4gICAgICAgIG5leHRQcm9tcHQgPSBgR2FpbiBjYXJkIGNvc3RpbmcgMSBsZXNzYDtcbiAgICAgICAgY29tYmluZWQgPSBvbmVMZXNzQ2FyZHNcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKCFjb21iaW5lZC5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtkZXZlbG9wIGVmZmVjdF0gbm8gcmVtYWluaW5nIGNhcmRzIHRvIGdhaW5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBuZXh0UHJvbXB0LFxuICAgICAgICByZXN0cmljdDogY29tYmluZWQubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2RldmVsb3AgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkc1swXSxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdmYXJtbGFuZCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkdhaW5lZDogYXN5bmMgKGFyZ3MsIHJlc3QpID0+IHtcbiAgICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcmVzdC5wbGF5ZXJJZCk7XG4gICAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZmFybWxhbmQgb25HYWluZWQgZWZmZWN0XSBubyBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBsZXQgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHJlc3QucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgVHJhc2ggYSBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogcmVzdC5wbGF5ZXJJZCB9LFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW2Zhcm1sYW5kIG9uR2FpbmVkIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgbGV0IHNlbGVjdGVkQ2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtmYXJtbGFuZCBvbkdhaW5lZCBlZmZlY3RdIHRyYXNoaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogcmVzdC5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB7IGNvc3QgfSA9IGFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKHNlbGVjdGVkQ2FyZCwge1xuICAgICAgICAgIHBsYXllcklkOiByZXN0LnBsYXllcklkXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgbm9uRmFybWxhbmRDYXJkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICAgIHsgcGxheWVySWQ6IHJlc3QucGxheWVySWQsIGtpbmQ6ICdleGFjdCcsIGFtb3VudDogeyB0cmVhc3VyZTogY29zdC50cmVhc3VyZSArIDIgfSB9XG4gICAgICAgIF0pXG4gICAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQuY2FyZEtleSAhPT0gJ2Zhcm1sYW5kJyk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIW5vbkZhcm1sYW5kQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtmYXJtbGFuZCBvbkdhaW5lZCBlZmZlY3RdIG5vIG5vbi1mYXJtbGFuZCBjYXJkcyBjb3N0aW5nIGV4YWN0bHkgMiBtb3JlIHRoYW4gJHtzZWxlY3RlZENhcmR9IGluIHN1cHBseWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHJlc3QucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgICByZXN0cmljdDogbm9uRmFybWxhbmRDYXJkcy5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFtmYXJtbGFuZCBvbkdhaW5lZCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHNlbGVjdGVkQ2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtmYXJtbGFuZCBvbkdhaW5lZCBlZmZlY3RdIGdhaW5pbmcgY2FyZCAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogcmVzdC5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSlcbiAgfSxcbiAgJ2Zvb2xzLWdvbGQnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25MZWF2ZUhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGZvb2xzLWdvbGQ6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICB9LFxuICAgICAgb25FbnRlckhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYGZvb2xzLWdvbGQ6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCxcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRHYWluZWQnLFxuICAgICAgICAgIG9uY2U6IGZhbHNlLFxuICAgICAgICAgIGNvbXB1bHNvcnk6IGZhbHNlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBldmVudEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBjb25kaXRpb25BcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkKTtcbiAgICAgICAgICAgIGlmIChjYXJkLmNhcmRLZXkgIT09ICdwcm92aW5jZScpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyZWRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2Zvb2xzLWdvbGQgdHJpZ2dlcmVkIGVmZmVjdF0gdHJhc2hpbmcgZm9vbHMgZ29sZGApXG4gICAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgICBwbGF5ZXJJZDogdHJpZ2dlcmVkRWZmZWN0QXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZDogZXZlbnRBcmdzLmNhcmRJZCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBnb2xkQ2FyZElkcyA9IHRyaWdnZXJlZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgICAgICB7IGNhcmRLZXlzOiAnZ29sZCcgfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghZ29sZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZm9vbHMtZ29sZCB0cmlnZ2VyZWQgZWZmZWN0XSBubyBnb2xkIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNhcmQgPSBnb2xkQ2FyZElkcy5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbZm9vbHMtZ29sZCB0cmlnZ2VyZWQgZWZmZWN0XSBnYWluaW5nICR7Y2FyZH1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgZm9vbHNHb2xkUGxheWVkVGhpc1R1cm5Db3VudCA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzQnlUdXJuW2NhcmRFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXJdXG4gICAgICAgIC5tYXAoY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZClcbiAgICAgICAgLmZpbHRlcihjYXJkID0+IGNhcmQub3duZXIgPT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkICYmIGNhcmQuY2FyZEtleSA9PT0gJ2Zvb2xzLWdvbGQnKVxuICAgICAgICAubGVuZ3RoO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2Zvb2xzLWdvbGQgZWZmZWN0XSBmb29scy1nb2xkIHBsYXllZCB0aGlzIHR1cm4gJHtmb29sc0dvbGRQbGF5ZWRUaGlzVHVybkNvdW50fWApO1xuICAgICAgXG4gICAgICBpZiAoZm9vbHNHb2xkUGxheWVkVGhpc1R1cm5Db3VudCA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2Zvb2xzLWdvbGQgZWZmZWN0XSBnYWluaW5nIDEgdHJlYXN1cmVgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZm9vbHMtZ29sZCBlZmZlY3RdIGdhaW5pbmcgNCB0cmVhc3VyZWApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDQgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnZ3VhcmQtZG9nJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBndWFyZC1kb2c6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkUGxheWVkYCk7XG4gICAgICB9LFxuICAgICAgb25FbnRlckhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYGd1YXJkLWRvZzoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWRgLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRQbGF5ZWQnLFxuICAgICAgICAgIG9uY2U6IGZhbHNlLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiB7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgPT09IGV2ZW50QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgY2FyZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgICAgaWYgKCFjYXJkLnR5cGUuaW5jbHVkZXMoJ0FUVEFDSycpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2d1YXJkLWRvZyB0cmlnZ2VyZWQgZWZmZWN0XSBwbGF5aW5nIGd1YXJkLWRvZyAke2V2ZW50QXJncy5jYXJkSWR9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBldmVudEFyZ3MuY2FyZElkLFxuICAgICAgICAgICAgICBvdmVycmlkZXM6IHtcbiAgICAgICAgICAgICAgICBhY3Rpb25Db3N0OiAwXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2d1YXJkLWRvZyBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkc2ApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIFxuICAgICAgaWYgKGhhbmQubGVuZ3RoIDw9IDUpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtndWFyZC1kb2cgZWZmZWN0XSBoYW5kIHNpemUgaXMgJHtoYW5kLmxlbmd0aH0sIGRyYXdpbmcgMiBtb3JlIGNhcmRzYCk7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnaGFnZ2xlcic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgaGFnZ2xlcjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtoYWdnbGVyIGVmZmVjdF0gZ2FpbmluZyAyIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYGhhZ2dsZXI6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkR2FpbmVkJyxcbiAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY29uZGl0aW9uOiBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKCFjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5ib3VnaHQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyZWRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2FyZCA9IHRyaWdnZXJlZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyZWRFZmZlY3RBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgICAgICBhbW91bnQ6IHsgdHJlYXN1cmU6IGNvc3QudHJlYXN1cmUgLSAxLCBwb3Rpb246IGNvc3QucG90aW9uIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdKVxuICAgICAgICAgICAgLmZpbHRlcihjYXJkID0+ICFjYXJkLnR5cGUuaW5jbHVkZXMoJ1ZJQ1RPUlknKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNhcmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtoYWdnbGVyIHRyaWdnZXJlZCBlZmZlY3RdIG5vIGNhcmRzIG5vbi12aWN0b3J5IGNhcmRzIGNvc3RpbmcgMiBsZXNzIHRoYW4gJHtjb3N0LnRyZWFzdXJlfWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBwcm9tcHQ6IGBHYWluIG5vbi1WaWN0b3J5IGNhcmRgLFxuICAgICAgICAgICAgcmVzdHJpY3Q6IGNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2hhZ2dsZXIgdHJpZ2dlcmVkIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtoYWdnbGVyIHRyaWdnZXJlZCBlZmZlY3RdIGdhaW5pbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ2hpZ2h3YXknOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbaGlnaHdheSBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZHMgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRBbGxDYXJkc0FzQXJyYXkoKTtcbiAgICAgIFxuICAgICAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICAgICAgXG4gICAgICBjb25zdCBydWxlOiBDYXJkUHJpY2VSdWxlID0gKGNhcmQsIGNvbnRleHQpID0+IHtcbiAgICAgICAgcmV0dXJuIHsgcmVzdHJpY3RlZDogZmFsc2UsIGNvc3Q6IHsgdHJlYXN1cmU6IC0xLCBwb3Rpb246IDAgfSB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGNhcmQgb2YgY2FyZHMpIHtcbiAgICAgICAgdW5zdWJzLnB1c2goY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5yZWdpc3RlclJ1bGUoY2FyZCwgcnVsZSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBoaWdod2F5OiR7Y2FyZEVmZmVjdEFyZ3MuY2FyZElkfTplbmRUdXJuYCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnZW5kVHVybicsXG4gICAgICAgIGNvbmRpdGlvbjogKCkgPT4gdHJ1ZSxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHVuc3Vicy5mb3JFYWNoKGMgPT4gYygpKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdpbm4nOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgYWN0aW9uc0luRGlzY2FyZCA9IGFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJywgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCB9KVxuICAgICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghYWN0aW9uc0luRGlzY2FyZC5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2lubiBvbkdhaW5lZCBlZmZlY3RdIG5vIGFjdGlvbnMgaW4gZGlzY2FyZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcHJvbXB0OiAnUmV2ZWFsIGFjdGlvbnMgdG8gc2h1ZmZsZSBpbnRvIGRlY2s/JyxcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICAgIHsgbGFiZWw6ICdET05FJywgYWN0aW9uOiAxIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgICAgY2FyZElkczogYWN0aW9uc0luRGlzY2FyZC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICAgIHNlbGVjdENvdW50OiB7XG4gICAgICAgICAgICAgIGtpbmQ6ICd1cFRvJyxcbiAgICAgICAgICAgICAgY291bnQ6IGFjdGlvbnNJbkRpc2NhcmQubGVuZ3RoXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IENhcmRJZFtdIH07XG4gICAgICAgIFxuICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtpbm4gb25HYWluZWQgZWZmZWN0XSBubyBjYXJkcyBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtpbm4gb25HYWluZWQgZWZmZWN0XSByZXZlYWxpbmcgJHtyZXN1bHQucmVzdWx0Lmxlbmd0aH0gY2FyZHMgYW5kIG1vdmluZyB0byBkZWNrYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiByZXN1bHQucmVzdWx0KSB7XG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtpbm4gb25HYWluZWQgZWZmZWN0XSBzaHVmZmxpbmcgcGxheWVyIGRlY2tgKTtcbiAgICAgICAgXG4gICAgICAgIGZpc2hlcllhdGVzU2h1ZmZsZShhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIGV2ZW50QXJncy5wbGF5ZXJJZCksIHRydWUpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2lubiBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkcywgYW5kIGdhaW5pbmcgMiBhY3Rpb25zYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZHNgLFxuICAgICAgICByZXN0cmljdDogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSxcbiAgICAgICAgY291bnQ6IE1hdGgubWluKDIsIGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyh7XG4gICAgICAgICAgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSkubGVuZ3RoKSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcykge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtpbm4gZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtpbm4gZWZmZWN0XSBkaXNjYXJkaW5nICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBzZWxlY3RlZENhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdqYWNrLW9mLWFsbC10cmFkZXMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHNpbHZlckNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIXNpbHZlckNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbamFjay1vZi1hbGwtdHJhZGVzIGVmZmVjdF0gbm8gc2lsdmVyIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbamFjay1vZi1hbGwtdHJhZGVzIGVmZmVjdF0gZ2FpbmluZyBhIHNpbHZlcmApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBzaWx2ZXJDYXJkSWRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2phY2stb2YtYWxsLXRyYWRlcyBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2ssIHNodWZmbGluZ2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2phY2stb2YtYWxsLXRyYWRlcyBlZmZlY3RdIG5vIGNhcmRzIGluIGRlY2sgYWZ0ZXIgc2h1ZmZsaW5nYCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3QgY2FyZElkID0gZGVjay5zbGljZSgtMSlbMF07XG4gICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCAke2NhcmQuY2FyZE5hbWV9YCxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgeyBsYWJlbDogJ0NBTkNFTCcsIGFjdGlvbjogMSB9LCB7IGxhYmVsOiAnRElTQ0FSRCcsIGFjdGlvbjogMiB9XG4gICAgICAgICAgXSxcbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDIpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2phY2stb2YtYWxsLXRyYWRlcyBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkfWApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgd2hpbGUgKGRlY2subGVuZ3RoID4gMCAmJiBoYW5kLmxlbmd0aCA8IDUpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtqYWNrLW9mLWFsbC10cmFkZXMgZWZmZWN0XSBkcmF3aW5nIGNhcmRgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBub25UcmVhc3VyZUNhcmRzSW5IYW5kID0gaGFuZC5tYXAoY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZClcbiAgICAgICAgLmZpbHRlcihjYXJkID0+ICFjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpO1xuICAgICAgXG4gICAgICBpZiAobm9uVHJlYXN1cmVDYXJkc0luSGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtqYWNrLW9mLWFsbC10cmFkZXMgZWZmZWN0XSBubyBub24tdHJlYXN1cmUgY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBUcmFzaCBhIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogbm9uVHJlYXN1cmVDYXJkc0luSGFuZC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmRJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbamFjay1vZi1hbGwtdHJhZGVzIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbamFjay1vZi1hbGwtdHJhZGVzIGVmZmVjdF0gdHJhc2hpbmcgJHtjYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkc1swXSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ21hcmdyYXZlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW21hcmdyYXZlIGVmZmVjdF0gZHJhd2luZyAzIGNhcmRzLCBhbmQgZ2FpbmluZyAxIGJ1eWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMyB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUidcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRQbGF5ZXJJZCk7XG4gICAgICAgIGNvbnN0IG51bVRvRGlzY2FyZCA9IGhhbmQubGVuZ3RoID4gMyA/IGhhbmQubGVuZ3RoIC0gMyA6IDA7XG4gICAgICAgIFxuICAgICAgICBpZiAobnVtVG9EaXNjYXJkID09PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFttYXJncmF2ZSBlZmZlY3RdIHBsYXllciAke3RhcmdldFBsYXllcklkfSBhbHJlYWR5IGF0IDMgb3IgbGVzcyBjYXJkc2ApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW21hcmdyYXZlIGVmZmVjdF0gcGxheWVyICR7dGFyZ2V0UGxheWVySWR9IGRpc2NhcmRpbmcgJHtudW1Ub0Rpc2NhcmR9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZC9zYCxcbiAgICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgICBjb3VudDogbnVtVG9EaXNjYXJkLFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW21hcmdyYXZlIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdGVkQ2FyZElkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkc1tpXSxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnbm9tYWRzJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uVHJhc2hlZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBpZiAoZXZlbnRBcmdzLnBsYXllcklkICE9PSBnZXRDdXJyZW50UGxheWVyKGFyZ3MubWF0Y2gpLmlkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW25vbWFkcyBvblRyYXNoZWQgZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmVgKTtcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICB9LFxuICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGV2ZW50QXJncy5wbGF5ZXJJZCAhPT0gZ2V0Q3VycmVudFBsYXllcihhcmdzLm1hdGNoKS5pZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtub21hZHMgb25HYWluZWQgZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmVgKTtcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbm9tYWRzIGVmZmVjdF0gZ2FpbmluZyAxIGJ1eSwgYW5kIDIgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgfVxuICB9LFxuICAnb2FzaXMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbb2FzaXMgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAxIGFjdGlvbiwgYW5kIGdhaW5pbmcgMSB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9LFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbb2FzaXMgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtvYXNpcyBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBjYXJkSWQ6IGNhcmQuaWQsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICB9XG4gIH0sXG4gICdzY2hlbWUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2NoZW1lIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGFuZCBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBzY2hlbWU6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmRpc2NhcmRDYXJkYCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnZGlzY2FyZENhcmQnLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgIGNvbmRpdGlvbjogYXN5bmMgKGNvbmRpdGlvbkFyZ3MpID0+IHtcbiAgICAgICAgICBpZiAoIWNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnByZXZpb3VzTG9jYXRpb24pIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoIWlzTG9jYXRpb25JblBsYXkoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucHJldmlvdXNMb2NhdGlvbi5sb2NhdGlvbikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBjb25zdCBjYXJkID0gY29uZGl0aW9uQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCk7XG4gICAgICAgICAgaWYgKGNhcmQub3duZXIgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKCFjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29uZGl0aW9uQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgICBwcm9tcHQ6IGBUb3AtZGVjayAke2NhcmQuY2FyZE5hbWV9P2AsXG4gICAgICAgICAgICBwbGF5ZXJJZDogY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgICAgIHsgbGFiZWw6ICdDQU5DRUwnLCBhY3Rpb246IDF9LFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnQ09ORklSTScsIGFjdGlvbjogMn1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlcmVkRWZmZWN0QXJncykgPT4ge1xuICAgICAgICAgIGNvbnN0IGNhcmQgPSB0cmlnZ2VyZWRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQodHJpZ2dlcmVkRWZmZWN0QXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3NjaGVtZSB0cmlnZ2VyZWQgZWZmZWN0XSBtb3ZpbmcgJHtjYXJkfSB0byBkZWNrYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiB0cmlnZ2VyZWRFZmZlY3RBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ3NvdWsnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgbnVtVG9UcmFzaCA9IE1hdGgubWluKDIsIGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgZXZlbnRBcmdzLnBsYXllcklkKS5sZW5ndGgpO1xuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYFRyYXNoIGNhcmQvc2AsXG4gICAgICAgICAgcmVzdHJpY3Q6IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCB9LFxuICAgICAgICAgIGNvdW50OiB7XG4gICAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgICBjb3VudDogbnVtVG9UcmFzaFxuICAgICAgICAgIH0sXG4gICAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzb3VrIG9uR2FpbmVkIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtzb3VrIG9uR2FpbmVkIGVmZmVjdF0gdHJhc2hpbmcgJHtzZWxlY3RlZENhcmRJZHMubGVuZ3RofSBjYXJkc2ApO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3NvdWsgZWZmZWN0XSBnYWluaW5nIDEgYnV5LCBhbmQgZ2FpbmluZyA3IHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiA3IH0pO1xuICAgICAgXG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmRTaXplID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpLmxlbmd0aDtcbiAgICAgIGNvbnN0IG51bVRvTG9zZSA9IE1hdGgubWluKGNhcmRFZmZlY3RBcmdzLm1hdGNoLnBsYXllclRyZWFzdXJlLCBoYW5kU2l6ZSlcbiAgICAgIGNvbnNvbGUubG9nKGBbc291ayBlZmZlY3RdIGxvc2luZyAke251bVRvTG9zZX0gdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogLWhhbmRTaXplIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3NwaWNlLW1lcmNoYW50Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCB0cmVhc3VyZXNJbkhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZClcbiAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKTtcbiAgICAgIFxuICAgICAgaWYgKCF0cmVhc3VyZXNJbkhhbmQubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3BpY2UtbWVyY2hhbnQgZWZmZWN0XSBubyB0cmVhc3VyZSBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogdHJlYXN1cmVzSW5IYW5kLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3BpY2UtbWVyY2hhbnQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzcGljZS1tZXJjaGFudCBlZmZlY3RdIHRyYXNoaW5nICR7Y2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkLmlkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIG9uZScsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICcrMiBDYXJkcywgKyAxIEFjdGlvbicsIGFjdGlvbjogMSB9LCB7IGxhYmVsOiAnKzEgQnV5LCArMiBUcmVhc3VyZScsIGFjdGlvbjogMiB9XG4gICAgICAgIF0sXG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICBcbiAgICAgIHN3aXRjaCAocmVzdWx0LmFjdGlvbikge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzcGljZS1tZXJjaGFudCBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkcyBhbmQgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbc3BpY2UtbWVyY2hhbnQgZWZmZWN0XSBnYWluaW5nIDEgYnV5LCBhbmQgMiB0cmVhc3VyZWApO1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3N0YWJsZXMnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHRyZWFzdXJlc0luSGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKVxuICAgICAgICAubWFwKGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQpXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpO1xuICAgICAgXG4gICAgICBpZiAoIXRyZWFzdXJlc0luSGFuZC5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzdGFibGVzIGVmZmVjdF0gbm8gdHJlYXN1cmUgY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIHRyZWFzdXJlYCxcbiAgICAgICAgcmVzdHJpY3Q6IHRyZWFzdXJlc0luSGFuZC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICAgIG9wdGlvbmFsOiB0cnVlXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc3RhYmxlcyBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc3RhYmxlcyBlZmZlY3RdIGRpc2NhcmRpbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3N0YWJsZXMgZWZmZWN0XSBkcmF3aW5nIDMgY2FyZHMsIGFuZCBnYWluaW5nIDEgYWN0aW9uIGApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMyB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgfVxuICB9LFxuICAndHJhZGVyJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGB0cmFkZXI6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICB9LFxuICAgICAgb25FbnRlckhhbmQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYHRyYWRlcjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRHYWluZWQnLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogZmFsc2UsXG4gICAgICAgICAgY29tcHVsc29yeTogZmFsc2UsXG4gICAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBldmVudEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyQXJncykgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHJhZGVyQ2FyZCA9IHRyaWdnZXJBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbdHJhZGVyIG9uRW50ZXJIYW5kIGV2ZW50XSByZXZlYWxpbmcgdHJhZGVyYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgICAgY2FyZElkOiB0cmFkZXJDYXJkLmlkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGdhaW5lZENhcmQgPSB0cmlnZ2VyQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHRyaWdnZXJBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAodHJpZ2dlckFyZ3MudHJpZ2dlci5hcmdzLnByZXZpb3VzTG9jYXRpb24pIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFt0cmFkZXIgb25FbnRlckhhbmQgZXZlbnRdIHB1dHRpbmcgJHtnYWluZWRDYXJkfSBiYWNrIGluIHByZXZpb3VzIGxvY2F0aW9uYCk7XG4gICAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICAgICAgY2FyZElkOiBnYWluZWRDYXJkLmlkLFxuICAgICAgICAgICAgICAgIHRvUGxheWVySWQ6IHRyaWdnZXJBcmdzLnRyaWdnZXIuYXJncy5wcmV2aW91c0xvY2F0aW9uLnBsYXllcklkLFxuICAgICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiB0cmlnZ2VyQXJncy50cmlnZ2VyLmFyZ3MucHJldmlvdXNMb2NhdGlvbi5sb2NhdGlvbiB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3RyYWRlciBvbkVudGVySGFuZCBldmVudF0gZ2FpbmVkICR7Z2FpbmVkQ2FyZH0gaGFzIG5vIHByZXZpb3VzIGxvY2F0aW9uYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHNpbHZlckNhcmRJZHMgPSB0cmlnZ2VyQXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgICAgIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXNpbHZlckNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbdHJhZGVyIG9uRW50ZXJIYW5kIGV2ZW50XSBubyBzaWx2ZXJzIGluIHN1cHBseWApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHNpbHZlckNhcmQgPSBzaWx2ZXJDYXJkSWRzWzBdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3RyYWRlciBvbkVudGVySGFuZCBldmVudF0gZ2FpbmluZyAke3NpbHZlckNhcmR9IGluc3RlYWRgKTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICAgIGNhcmRJZDogc2lsdmVyQ2FyZC5pZCxcbiAgICAgICAgICAgICAgdG9QbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgaGFuZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3RyYWRlciBlZmZlY3RdIG5vIGNhcmRzIGluIGhhbmRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW3RyYWRlciBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbdHJhZGVyIGVmZmVjdF0gdHJhc2hpbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHsgY29zdCB9ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKFxuICAgICAgICBzZWxlY3RlZENhcmQsXG4gICAgICAgIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH1cbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNpbHZlckNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIXNpbHZlckNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdHJhZGVyIGVmZmVjdF0gbm8gc2lsdmVyIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IG51bVRvR2FpbiA9IE1hdGgubWluKHNpbHZlckNhcmRJZHMubGVuZ3RoLCBjb3N0LnRyZWFzdXJlKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt0cmFkZXIgZWZmZWN0XSBnYWluaW5nICR7bnVtVG9HYWlufSBzaWx2ZXIgY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1Ub0dhaW47IGkrKykge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNpbHZlckNhcmRJZHMuc2xpY2UoLWkgLSAxKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndHJhaWwnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiB7XG4gICAgICBhc3luYyBmdW5jdGlvbiBkb1RyYWlsKGFyZ3M6IENhcmRMaWZlY3ljbGVDYWxsYmFja0NvbnRleHQsIGV2ZW50QXJnczogeyBwbGF5ZXJJZDogUGxheWVySWQ7IGNhcmRJZDogQ2FyZElkOyB9KSB7XG4gICAgICAgIGlmIChnZXRUdXJuUGhhc2UoYXJncy5tYXRjaC50dXJuUGhhc2VJbmRleCkgPT09ICdjbGVhbnVwJykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdHJhaWwgb25HYWluZWQvVHJhc2hlZC9EaXNjYXJkZWQgZXZlbnRdIGhhcHBlbmluZyBkdXJpbmcgY2xlYW4tdXAsIHNraXBwaW5nYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwcm9tcHQ6ICdQbGF5IFRyYWlsPycsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgICB7IGxhYmVsOiAnQ0FOQ0VMJywgYWN0aW9uOiAxIH0sIHsgbGFiZWw6ICdQTEFZJywgYWN0aW9uOiAyIH1cbiAgICAgICAgICBdLFxuICAgICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICAgIFxuICAgICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdHJhaWwgb25HYWluZWQvVHJhc2hlZC9EaXNjYXJkZWQgZXZlbnRdIG5vdCBwbGF5aW5nIHRyYWlsYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3RyYWlsIG9uR2FpbmVkL1RyYXNoZWQvRGlzY2FyZGVkIGV2ZW50XSBwbGF5aW5nIHRyYWlsYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGV2ZW50QXJncy5jYXJkSWQsXG4gICAgICAgICAgb3ZlcnJpZGVzOiB7XG4gICAgICAgICAgICBhY3Rpb25Db3N0OiAwXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgICBhd2FpdCBkb1RyYWlsKGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICAgIH0sXG4gICAgICAgIG9uVHJhc2hlZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICAgIGF3YWl0IGRvVHJhaWwoYXJncywgZXZlbnRBcmdzKTtcbiAgICAgICAgfSxcbiAgICAgICAgb25EaXNjYXJkZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgICBhd2FpdCBkb1RyYWlsKGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3RyYWlsIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGFuZCBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3R1bm5lbCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkRpc2NhcmRlZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBpZiAoZ2V0VHVyblBoYXNlKGFyZ3MubWF0Y2gudHVyblBoYXNlSW5kZXgpID09PSAnY2xlYW51cCcpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3R1bm5lbCBvbkRpc2NhcmRlZCBldmVudF0gaGFwcGVuaW5nIGR1cmluZyBjbGVhbi11cCwgc2tpcHBpbmdgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICAgIHByb21wdDogJ1JldmVhbCB0dW5uZWw/JyxcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICAgIHsgbGFiZWw6ICdDQU5DRUwnLCBhY3Rpb246IDEgfSwgeyBsYWJlbDogJ1JFVkVBTCcsIGFjdGlvbjogMiB9XG4gICAgICAgICAgXSxcbiAgICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3R1bm5lbCBvbkRpc2NhcmRlZCBldmVudF0gbm90IHJldmVhbGluZyB0dW5uZWxgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbdHVubmVsIG9uRGlzY2FyZGVkIGV2ZW50XSByZXZlYWxpbmcgdHVubmVsYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGV2ZW50QXJncy5jYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBnb2xkQ2FyZElkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgeyBjYXJkS2V5czogJ2dvbGQnIH1cbiAgICAgICAgXSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWdvbGRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbdHVubmVsIG9uRGlzY2FyZGVkIGV2ZW50XSBubyBnb2xkIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgZ29sZENhcmQgPSBnb2xkQ2FyZElkcy5zbGljZSgtMSlbMF07XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3R1bm5lbCBvbkRpc2NhcmRlZCBldmVudF0gZ2FpbmluZyAke2dvbGRDYXJkfWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBnb2xkQ2FyZC5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSksXG4gIH0sXG4gICd3ZWF2ZXInOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25EaXNjYXJkZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgaWYgKGdldFR1cm5QaGFzZShhcmdzLm1hdGNoLnR1cm5QaGFzZUluZGV4KSA9PT0gJ2NsZWFudXAnKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt3ZWF2ZXIgb25EaXNjYXJkZWQgZXZlbnRdIGhhcHBlbmluZyBkdXJpbmcgY2xlYW4tdXAsIHNraXBwaW5nYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICBwcm9tcHQ6ICdQbGF5IFdlYXZlcj8nLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgICAgeyBsYWJlbDogJ0NBTkNFTCcsIGFjdGlvbjogMSB9LCB7IGxhYmVsOiAnUExBWScsIGFjdGlvbjogMiB9XG4gICAgICAgICAgXVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt3ZWF2ZXIgb25EaXNjYXJkZWQgZXZlbnRdIG5vdCBwbGF5aW5nIHdlYXZlcmApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFt3ZWF2ZXIgb25EaXNjYXJkZWQgZXZlbnRdIHBsYXlpbmcgd2VhdmVyYCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGV2ZW50QXJncy5jYXJkSWQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHByb21wdDogJ0Nob29zZSB0d28gc2lsdmVycywgb3IgZ2FpbiBhIGNhcmQgY29zdGluZyB1cCB0byAkNCcsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdTSUxWRVJTJywgYWN0aW9uOiAxIH0sIHsgbGFiZWw6ICdHQUlOIENBUkQnLCBhY3Rpb246IDIgfVxuICAgICAgICBdLFxuICAgICAgfSkgYXMgeyBhY3Rpb246IG51bWJlciwgcmVzdWx0OiBudW1iZXJbXSB9O1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3dlYXZlciBlZmZlY3RdIGNob29zaW5nIHNpbHZlcnNgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNpbHZlckNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiAnc2lsdmVyJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFzaWx2ZXJDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbd2VhdmVyIGVmZmVjdF0gbm8gc2lsdmVyIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgbnVtVG9HYWluID0gTWF0aC5taW4oc2lsdmVyQ2FyZElkcy5sZW5ndGgsIDIpO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFt3ZWF2ZXIgZWZmZWN0XSBnYWluaW5nICR7bnVtVG9HYWlufSBzaWx2ZXIgY2FyZHNgKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVG9HYWluOyBpKyspIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBzaWx2ZXJDYXJkSWRzLnNsaWNlKC1pIC0gMSlbMF0uaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbd2VhdmVyIGVmZmVjdF0gY2hvb3NpbmcgY2FyZCBjb3N0aW5nIHVwIHRvICQ0YCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYEdhaW4gY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgICB7IGtpbmQ6ICd1cFRvJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBhbW91bnQ6IHsgdHJlYXN1cmU6IDQgfSB9XG4gICAgICAgICAgXSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFt3ZWF2ZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnd2hlZWx3cmlnaHQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGlmIChoYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3doZWVsd3JpZ2h0IGVmZmVjdF0gbm8gY2FyZHMgaW4gaGFuZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxldCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZVxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3doZWVsd3JpZ2h0IGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGxldCBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZC5pZCxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoc2VsZWN0ZWRDYXJkLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGFjdGlvbkNhcmRJZHMgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiBbJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgICAgICB7IGNhcmRUeXBlOiAnQUNUSU9OJyB9LFxuICAgICAgICB7XG4gICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBhbW91bnQ6IHsgdHJlYXN1cmU6IGNvc3QudHJlYXN1cmUsIHBvdGlvbjogY29zdC5wb3Rpb24gfVxuICAgICAgICB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKCFhY3Rpb25DYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3doZWVsd3JpZ2h0IGVmZmVjdF0gbm8gYWN0aW9uIGNhcmRzIGluIGtpbmdkb21gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGFjdGlvbkNhcmRJZHMubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFt3aGVlbHdyaWdodCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBzZWxlY3RlZENhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbd2hlZWx3cmlnaHQgZWZmZWN0XSBnYWluaW5nICR7c2VsZWN0ZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3dpdGNocy1odXQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbd2l0Y2hzLWh1dCBlZmZlY3RdIGRyYXdpbmcgNCBjYXJkc2ApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogNCB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYERpc2NhcmQgY2FyZHNgLFxuICAgICAgICByZXN0cmljdDogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSxcbiAgICAgICAgY291bnQ6IE1hdGgubWluKDIsIGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKS5sZW5ndGgpLFxuICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbd2l0Y2hzLWh1dCBlZmZlY3RdIHJldmVhbGluZyBhbmQgZGlzY2FyZGluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkSWRzKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICBpZiAoc2VsZWN0ZWRDYXJkSWRzLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKS5ldmVyeShjYXJkID0+IGNhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt3aXRjaHMtaHV0IGVmZmVjdF0gZXZlcnkgY2FyZCBkaXNjYXJkZWQgaXMgYW4gYWN0aW9uLCBvdGhlcnMgZ2FpbmluZyBhIGN1cnNlYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJ1xuICAgICAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnNlQ2FyZElkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICAgICAgeyBjYXJkS2V5czogJ2N1cnNlJyB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFjdXJzZUNhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbd2l0Y2hzLWh1dCBlZmZlY3RdIG5vIGN1cnNlIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGN1cnNlQ2FyZCA9IGN1cnNlQ2FyZElkcy5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbd2l0Y2hzLWh1dCBlZmZlY3RdIGdhaW5pbmcgJHtjdXJzZUNhcmR9IHRvICR7dGFyZ2V0UGxheWVySWR9YCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBjdXJzZUNhcmQuaWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbd2l0Y2hzLWh1dCBlZmZlY3RdIG5vdCBldmVyeSBjYXJkIGRpc2NhcmRlZCBpcyBhbiBhY3Rpb25gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgZXhwYW5zaW9uOyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxTQUFTLGNBQWMsUUFBUSxtQ0FBbUM7QUFDbEUsU0FBUyxrQkFBa0IsUUFBUSxzQ0FBc0M7QUFFekUsU0FBUyxrQkFBa0IsUUFBUSx1Q0FBdUM7QUFDMUUsU0FBUyxnQkFBZ0IsUUFBUSxvQ0FBb0M7QUFDckUsU0FBUyxnQkFBZ0IsUUFBUSw0QkFBNEI7QUFDN0QsU0FBUyxZQUFZLFFBQVEsZ0NBQWdDO0FBRTdELE1BQU0sWUFBaUM7RUFDckMsYUFBYTtJQUNYLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsVUFBVSxPQUFPLE1BQU07VUFDckIsTUFBTSxvQkFBb0IsZUFBZSxLQUFLLFNBQVMsRUFDcEQsSUFBSSxDQUFDLENBQUEsT0FBUSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxLQUFLLEtBQUssS0FBSyxVQUFVLFFBQVE7VUFFakYsSUFBSSxDQUFDLG1CQUFtQjtZQUN0QixRQUFRLEdBQUcsQ0FBQyxDQUFDLG1EQUFtRCxDQUFDO1lBQ2pFO1VBQ0Y7VUFFQSxNQUFNLE9BQU8sS0FBSyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBTTtVQUV0RCxRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxFQUFFLE1BQU07VUFFekQsTUFB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
// denoCacheMetadata=15414710412298734714,1088662473350613138