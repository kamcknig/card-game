import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { getPlayerStartingFrom, getPlayerTurnIndex } from '../../shared/get-player-position-utils.ts';
import { getCurrentPlayer } from '../../utils/get-current-player.ts';
import { getPlayerById } from '../../utils/get-player-by-id.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
const expansion = {
  'astrolabe': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`astrolabe:${eventArgs.cardId}:starTurn`);
        },
        onCardPlayed: async ({ reactionManager }, { playerId, cardId })=>{
          const id = `astrolabe:${cardId}:starTurn`;
          reactionManager.registerReactionTemplate({
            id,
            playerId,
            listeningFor: 'startTurn',
            compulsory: true,
            allowMultipleInstances: true,
            once: true,
            condition: (args)=>{
              const { trigger } = args;
              return trigger.args.playerId === playerId;
            },
            triggeredEffectFn: async ({ runGameActionDelegate })=>{
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 treasure...`);
              await runGameActionDelegate('gainTreasure', {
                count: 1
              }, {
                loggingContext: {
                  source: cardId
                }
              });
              console.log(`[SEASIDE TRIGGERED EFFECT] gaining 1 buy...`);
              await runGameActionDelegate('gainBuy', {
                count: 1
              }, {
                loggingContext: {
                  source: cardId
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        console.log(`[SEASON EFFECT] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
        console.log(`[SEASON EFFECT] gaining 1 buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
      }
  },
  'bazaar': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId })=>{
        console.log(`[SEASON EFFECT] drawing 1 card...`);
        await runGameActionDelegate('drawCard', {
          playerId: playerId
        });
        console.log(`[SEASON EFFECT] gaining 2 actions...`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        console.log(`[SEASON EFFECT] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'blockade': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`blockade:${eventArgs.cardId}:startTurn`);
          args.reactionManager.unregisterTrigger(`blockade:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async (args)=>{
        console.log(`[BLOCKADE EFFECT] prompting user to select card...`);
        const cardIds = await args.runGameActionDelegate('selectCard', {
          prompt: 'Gain card',
          playerId: args.playerId,
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
                treasure: 4
              },
              playerId: args.playerId
            }
          ],
          count: 1
        });
        const gainedCardId = cardIds[0];
        console.log(`[BLOCKADE EFFECT] selected card ${args.cardLibrary.getCard(gainedCardId)}`);
        await args.runGameActionDelegate('gainCard', {
          playerId: args.playerId,
          cardId: gainedCardId,
          to: {
            location: 'set-aside'
          }
        });
        args.reactionManager.registerReactionTemplate({
          playerId: args.playerId,
          id: `blockade:${args.cardId}:startTurn`,
          once: true,
          condition: ({ trigger })=>trigger.args.playerId === args.playerId,
          listeningFor: 'startTurn',
          compulsory: true,
          triggeredEffectFn: async ()=>{
            console.log(`[BLOCKADE TRIGGERED EFFECT] moving previously selected card to hand...`);
            await args.runGameActionDelegate('moveCard', {
              cardId: gainedCardId,
              toPlayerId: args.playerId,
              to: {
                location: 'playerHand'
              }
            });
            args.reactionManager.unregisterTrigger(`blockade:${args.cardId}:cardGained`);
          }
        });
        const cardGained = args.cardLibrary.getCard(gainedCardId);
        args.reactionManager.registerReactionTemplate({
          playerId: args.playerId,
          id: `blockade:${args.cardId}:cardGained`,
          condition: (conditionArgs)=>{
            if (getCurrentPlayer(args.match).id !== conditionArgs.trigger.args.playerId) {
              return false;
            }
            return conditionArgs.trigger.args.cardId !== undefined && args.cardLibrary.getCard(conditionArgs.trigger.args.cardId).cardKey == cardGained.cardKey;
          },
          compulsory: true,
          listeningFor: 'cardGained',
          triggeredEffectFn: async (args)=>{
            const curseCardIds = args.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'curse'
              }
            ]);
            if (!curseCardIds.length) {
              console.log(`[BLOCKADE TRIGGERED EFFECT] no curse cards in supply...`);
              return;
            }
            console.log(`[BLOCKADE TRIGGERED EFFECT] gaining curse card to player's discard...`);
            await args.runGameActionDelegate('gainCard', {
              playerId: args.trigger.args.playerId,
              cardId: curseCardIds[0].id,
              to: {
                location: 'playerDiscard'
              }
            }, {
              loggingContext: {
                source: args.trigger.args.cardId
              }
            });
          }
        });
      }
  },
  'caravan': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`caravan:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, reactionManager, cardId })=>{
        console.log(`[CARAVAN EFFECT] drawing a card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[CARAVAN EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        reactionManager.registerReactionTemplate({
          id: `caravan:${cardId}:startTurn`,
          playerId,
          compulsory: true,
          once: true,
          listeningFor: 'startTurn',
          condition: ({ trigger })=>trigger.args.playerId === playerId,
          triggeredEffectFn: async ()=>{
            console.log(`[CARAVAN TRIGGERED EFFECT] drawing a card...`);
            await runGameActionDelegate('drawCard', {
              playerId
            }, {
              loggingContext: {
                source: cardId
              }
            });
          }
        });
      }
  },
  'corsair': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`corsair:${cardId}:starTurn`);
          reactionManager.unregisterTrigger(`corsair:${cardId}:cardPlayed`);
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate, reactionManager, cardId, playerId, reactionContext })=>{
        console.log(`[CORSAIR EFFECT] gaining 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const startTurnTriggerId = `corsair:${cardId}:startTurn`;
        const cardPlayedTriggerId = `corsair:${cardId}:cardPlayed`;
        reactionManager.registerReactionTemplate({
          id: startTurnTriggerId,
          playerId,
          compulsory: true,
          once: true,
          listeningFor: 'startTurn',
          condition: ({ trigger })=>trigger.args.playerId === playerId,
          triggeredEffectFn: async ()=>{
            console.log(`[CORSAIR TRIGGERED EFFECT] drawing card...`);
            await runGameActionDelegate('drawCard', {
              playerId
            }, {
              loggingContext: {
                source: cardId
              }
            });
            reactionManager.unregisterTrigger(startTurnTriggerId);
            reactionManager.unregisterTrigger(cardPlayedTriggerId);
          }
        });
        reactionManager.registerReactionTemplate({
          id: cardPlayedTriggerId,
          playerId,
          listeningFor: 'cardPlayed',
          compulsory: true,
          condition: ({ match, trigger, cardLibrary })=>{
            if (!trigger.args.cardId || trigger.args.playerId === playerId) return false;
            if (reactionContext[trigger.args.playerId]?.result === 'immunity') {
              console.log(`[corsair triggered effect] ${getPlayerById(match, trigger.args.playerId)} is immune`);
              return false;
            }
            const card = cardLibrary.getCard(trigger.args.cardId);
            if (![
              'silver',
              'gold'
            ].includes(card.cardKey)) return false;
            const playedSilverCards = Object.keys(match.stats.playedCards).filter((cardId)=>{
              return [
                'silver',
                'gold'
              ].includes(cardLibrary.getCard(+cardId).cardKey) && match.stats.playedCards[+cardId].turnNumber === match.turnNumber && match.stats.playedCards[+cardId].playerId === trigger.args.playerId;
            });
            return playedSilverCards.length === 1;
          },
          triggeredEffectFn: async ({ trigger })=>{
            console.log(`[CORSAIR TRIGGERED EFFECT] trashing card...`);
            await runGameActionDelegate('trashCard', {
              playerId: trigger.args.playerId,
              cardId: trigger.args.cardId
            }, {
              loggingContext: {
                source: cardId
              }
            });
          }
        });
      }
  },
  'cutpurse': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, match, reactionContext, cardLibrary, ...args })=>{
        console.log(`[cutpurse effect] gaining 2 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const targetIds = findOrderedTargets({
          startingPlayerId: playerId,
          appliesTo: 'ALL_OTHER',
          match
        }).filter((id)=>reactionContext?.[id]?.result !== 'immunity');
        for (const targetId of targetIds){
          const hand = args.cardSourceController.getSource('playerHand', targetId);
          const copperId = hand.find((cardId)=>cardLibrary.getCard(cardId).cardKey === 'copper');
          if (copperId) {
            console.log(`[cutpurse effect] discarding copper...`);
            await runGameActionDelegate('discardCard', {
              cardId: copperId,
              playerId: targetId
            });
            continue;
          }
          console.log(`[cutpurse effect] revealing hand...`);
          for (const cardId of hand){
            await runGameActionDelegate('revealCard', {
              cardId,
              playerId: targetId
            });
          }
        }
      }
  },
  'fishing-village': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`fishing-village:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, reactionManager, cardId })=>{
        console.log(`[fishing village effect] gaining 2 action...`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        console.log(`[fishing village effect] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
        reactionManager.registerReactionTemplate({
          id: `fishing-village:${cardId}:startTurn`,
          once: true,
          compulsory: true,
          playerId,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger })=>trigger.args.playerId === playerId,
          triggeredEffectFn: async ()=>{
            console.log(`[fishing village triggered effect] gaining 1 action...`);
            await runGameActionDelegate('gainAction', {
              count: 1
            }, {
              loggingContext: {
                source: cardId
              }
            });
            console.log(`[fishing village triggered effect] gaining 1 treasure...`);
            await runGameActionDelegate('gainTreasure', {
              count: 1
            }, {
              loggingContext: {
                source: cardId
              }
            });
          }
        });
      }
  },
  'haven': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, cardId: playedCardId, reactionManager, cardLibrary, ...effectArgs })=>{
        console.log(`[haven effect] drawing card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[haven effect] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card to set aside',
          playerId,
          restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
          count: 1
        });
        const cardId = cardIds[0];
        if (!cardId) {
          console.warn('[haven effect] no card selected');
          return;
        }
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: {
            location: 'set-aside'
          }
        });
        cardLibrary.getCard(cardId).facing = 'back';
        reactionManager.registerReactionTemplate({
          id: `haven:${playedCardId}:startTurn`,
          listeningFor: 'startTurn',
          compulsory: true,
          once: true,
          playerId,
          condition: ({ trigger })=>trigger.args.playerId === playerId,
          triggeredEffectFn: async (triggerEffectArgs)=>{
            console.log(`[haven triggered effect] moving selected card to hand...`);
            await runGameActionDelegate('moveCard', {
              cardId,
              toPlayerId: playerId,
              to: {
                location: 'playerHand'
              }
            });
            const card = triggerEffectArgs.cardLibrary.getCard(cardId);
            card.facing = 'front';
          }
        });
      }
  },
  'island': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, cardId, ...effectArgs })=>{
        console.log(`[ISLAND EFFECT] prompting user to select card...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Choose card',
          validPrompt: '',
          playerId,
          restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
          count: 1
        });
        console.log(`[ISLAND EFFECT] moving island to island mat...`);
        await runGameActionDelegate('moveCard', {
          cardId,
          to: {
            location: 'island'
          },
          toPlayerId: playerId
        });
        const selectedCardId = cardIds[0];
        console.log(`[ISLAND EFFECT] moving selected card to island mat...`);
        if (selectedCardId) {
          await runGameActionDelegate('moveCard', {
            cardId: selectedCardId,
            to: {
              location: 'island'
            },
            toPlayerId: playerId
          });
        }
      }
  },
  'lighthouse': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:startTurn`);
          args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:cardPlayed`);
        },
        onCardPlayed: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `lighthouse:${eventArgs.cardId}:cardPlayed`,
            playerId: eventArgs.playerId,
            listeningFor: 'cardPlayed',
            condition: ({ trigger, cardLibrary })=>{
              const playedCard = cardLibrary.getCard(trigger.args.cardId);
              return trigger.args.cardId !== eventArgs.cardId && trigger.args.playerId !== eventArgs.playerId && playedCard.type.includes('ATTACK');
            },
            once: false,
            allowMultipleInstances: false,
            compulsory: true,
            triggeredEffectFn: async ()=>{
              return 'immunity';
            }
          });
          args.reactionManager.registerReactionTemplate({
            id: `lighthouse:${eventArgs.cardId}:startTurn`,
            playerId: eventArgs.playerId,
            listeningFor: 'startTurn',
            condition: ({ trigger })=>trigger.args.playerId === eventArgs.playerId,
            once: true,
            allowMultipleInstances: true,
            compulsory: true,
            triggeredEffectFn: async ()=>{
              args.reactionManager.unregisterTrigger(`lighthouse:${eventArgs.cardId}:cardPlayed`);
              await args.runGameActionDelegate('gainTreasure', {
                count: 1
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        console.log(`[lighthouse effect] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        console.log(`[lighthouse effect] gaining 1 treasure...`);
        await runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'lookout': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, match, ...args })=>{
        console.log(`[LOOKOUT EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        const cardIds = [];
        while(cardIds.length < 3){
          let cardId = deck.slice(-1)[0];
          if (cardId === undefined) {
            await runGameActionDelegate('shuffleDeck', {
              playerId
            });
          }
          cardId = deck.slice(-1)[0];
          if (cardId === undefined) {
            console.log(`[lookout effect] no card in deck`);
            break;
          }
          await runGameActionDelegate('moveCard', {
            cardId,
            to: {
              location: 'set-aside'
            }
          });
          cardIds.push(cardId);
        }
        const prompts = [
          'Trash one',
          'Discard one'
        ];
        const l = cardIds.length;
        for(let i = 0; i < l; i++){
          let selectedId = undefined;
          if (cardIds.length === 1) {
            selectedId = cardIds[0];
          } else {
            const selectedIds = await runGameActionDelegate('userPrompt', {
              playerId,
              prompt: prompts[i],
              content: {
                type: 'select',
                cardIds,
                selectCount: 1
              }
            });
            selectedId = selectedIds.result[0];
          }
          cardIds.splice(cardIds.findIndex((id)=>id === selectedId), 1);
          if (i === 0) {
            await runGameActionDelegate('trashCard', {
              playerId,
              cardId: selectedId
            });
          } else if (i === 1) {
            await runGameActionDelegate('discardCard', {
              cardId: selectedId,
              playerId
            });
          } else {
            await runGameActionDelegate('moveCard', {
              cardId: selectedId,
              toPlayerId: playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        }
      }
  },
  'merchant-ship': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`merchant-ship:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, reactionManager, cardId })=>{
        console.log(`[merchant ship effect] gaining 2 treasures...`);
        await runGameActionDelegate('gainTreasure', {
          count: 2
        });
        reactionManager.registerReactionTemplate({
          id: `merchant-ship:${cardId}:startTurn`,
          playerId,
          compulsory: true,
          allowMultipleInstances: true,
          once: true,
          listeningFor: 'startTurn',
          condition: ({ trigger })=>trigger.args.playerId === playerId,
          triggeredEffectFn: async ()=>{
            console.log(`[merchant ship triggered effect] gaining 2 treasure...`);
            await runGameActionDelegate('gainTreasure', {
              count: 2
            }, {
              loggingContext: {
                source: cardId
              }
            });
          }
        });
      }
  },
  'monkey': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`monkey:${eventArgs.cardId}:startTurn`);
          args.reactionManager.unregisterTrigger(`monkey:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async ({ reactionManager, match, playerId, cardId, runGameActionDelegate })=>{
        reactionManager.registerReactionTemplate({
          id: `monkey:${cardId}:startTurn`,
          playerId,
          compulsory: true,
          once: true,
          allowMultipleInstances: true,
          listeningFor: 'startTurn',
          condition: ({ trigger })=>trigger.args.playerId === playerId,
          triggeredEffectFn: async ()=>{
            console.log(`[monkey triggered effect] drawing card at start of turn...`);
            await runGameActionDelegate('drawCard', {
              playerId
            }, {
              loggingContext: {
                source: cardId
              }
            });
            reactionManager.unregisterTrigger(`monkey:${cardId}:cardGained`);
          }
        });
        const thisPlayerTurnIdx = match.players.findIndex((p)=>p.id === playerId);
        const playerToRightId = getPlayerStartingFrom({
          startFromIdx: thisPlayerTurnIdx,
          match,
          distance: -1
        }).id;
        reactionManager.registerReactionTemplate({
          id: `monkey:${cardId}:cardGained`,
          playerId,
          compulsory: true,
          allowMultipleInstances: true,
          listeningFor: 'cardGained',
          once: false,
          triggeredEffectFn: async ()=>{
            console.log(`[monkey triggered effect] drawing card, because player to the right gained a card...`);
            await runGameActionDelegate('drawCard', {
              playerId
            }, {
              loggingContext: {
                source: cardId
              }
            });
          },
          condition: ({ trigger })=>trigger.args.playerId === playerToRightId
        });
      }
  },
  'pirate': {
    registerLifeCycleMethods: ()=>({
        onEnterHand: async ({ reactionManager }, { playerId, cardId })=>{
          reactionManager.registerReactionTemplate({
            id: `pirate:${cardId}:cardGained`,
            playerId,
            compulsory: false,
            allowMultipleInstances: true,
            once: true,
            listeningFor: 'cardGained',
            condition: ({ cardLibrary, trigger })=>cardLibrary.getCard(trigger.args.cardId).type.includes('TREASURE'),
            triggeredEffectFn: async ({ runGameActionDelegate })=>{
              await runGameActionDelegate('playCard', {
                playerId,
                cardId,
                overrides: {
                  actionCost: 0
                }
              }, {
                loggingContext: {
                  source: cardId
                }
              });
            }
          });
        },
        onLeaveHand: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`pirate:${cardId}:cardGained`);
        },
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`pirate:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async ({ reactionManager, playerId, match, cardId, runGameActionDelegate, ...effectArgs })=>{
        const id = `pirate:${cardId}:startTurn`;
        const turnPlayed = match.stats.playedCards[cardId].turnNumber;
        reactionManager.registerReactionTemplate({
          id,
          playerId,
          listeningFor: 'startTurn',
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: ({ trigger, reaction })=>trigger.args.playerId === playerId && reaction.id === id && match.turnNumber !== turnPlayed,
          triggeredEffectFn: async ()=>{
            console.log(`[pirate triggered effect] prompting user to select treasure costing up to 6...`);
            const cardIds = await runGameActionDelegate('selectCard', {
              prompt: 'Gain card',
              validPrompt: '',
              playerId,
              restrict: [
                {
                  location: [
                    'basicSupply',
                    'kingdomSupply'
                  ]
                },
                {
                  cardType: 'TREASURE'
                },
                {
                  kind: 'upTo',
                  amount: {
                    treasure: 6
                  },
                  playerId
                }
              ],
              count: 1
            });
            const cardId = cardIds[0];
            if (!cardId) {
              console.warn(`[pirate triggered effect] no card selected...`);
              return;
            }
            console.log(`[pirate triggered effect] gaining selected card to hand...`);
            await runGameActionDelegate('gainCard', {
              playerId,
              cardId: cardId,
              to: {
                location: 'playerHand'
              }
            }, {
              loggingContext: {
                source: cardId
              }
            });
          }
        });
      }
  },
  'native-village': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, match, ...args })=>{
        console.log(`[NATIVE VILLAGE EFFECT] gaining 2 actions...`);
        await runGameActionDelegate('gainAction', {
          count: 2
        });
        console.log(`[NATIVE VILLAGE EFFECT] prompting user to choose...`);
        const result = await runGameActionDelegate('userPrompt', {
          playerId,
          actionButtons: [
            {
              label: 'Put top card on mat',
              action: 1
            },
            {
              label: 'Take cards from mat',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          const deck = args.cardSourceController.getSource('playerDeck', playerId);
          if (deck.length === 0) {
            console.log(`[NATIVE VILLAGE EFFECT] shuffling deck...`);
            await runGameActionDelegate('shuffleDeck', {
              playerId
            });
          }
          const cardId = deck.slice(-1)[0];
          if (!cardId) {
            console.log(`[NATIVE VILLAGE EFFECT] no cards in deck...`);
            return;
          }
          console.log(`[NATIVE VILLAGE EFFECT] moving card to native village mat...`);
          await runGameActionDelegate('moveCard', {
            cardId,
            toPlayerId: playerId,
            to: {
              location: 'native-village'
            }
          });
          return;
        }
        const matCardIds = args.findCards({
          location: 'native-village'
        });
        console.log(`[NATIVE VILLAGE EFFECT] moving ${matCardIds.length} cards from native village mat to hand...`);
        for (const cardId of matCardIds){
          await runGameActionDelegate('moveCard', {
            cardId: cardId,
            toPlayerId: playerId,
            to: {
              location: 'playerHand'
            }
          });
        }
      }
  },
  'sailor': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`sailor:${cardId}:cardGained`);
          reactionManager.unregisterTrigger(`sailor:${cardId}:startTurn`);
          reactionManager.unregisterTrigger(`sailor:${cardId}:endTurn`);
        },
        onCardPlayed: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `sailor:${eventArgs.cardId}:endTurn`,
            playerId: eventArgs.playerId,
            listeningFor: 'endTurn',
            compulsory: true,
            allowMultipleInstances: true,
            once: true,
            condition: ()=>true,
            triggeredEffectFn: async (triggerArgs)=>{
              args.reactionManager.unregisterTrigger(`sailor:${eventArgs.cardId}:cardGained`);
              args.reactionManager.unregisterTrigger(`sailor:${eventArgs.cardId}:endTurn`);
            }
          });
          args.reactionManager.registerReactionTemplate({
            id: `sailor:${eventArgs.cardId}:cardGained`,
            playerId: eventArgs.playerId,
            listeningFor: 'cardGained',
            once: true,
            compulsory: false,
            allowMultipleInstances: true,
            condition: (conditionArgs)=>{
              const cardGained = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!cardGained.type.includes('DURATION')) {
                return false;
              }
              if (conditionArgs.trigger.args.playerId !== eventArgs.playerId) {
                return false;
              }
              return conditionArgs.match.stats.playedCards[conditionArgs.trigger.args.cardId] === undefined;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              console.log(`[sailor triggered effect] playing ${triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId)}`);
              await triggeredArgs.runGameActionDelegate('playCard', {
                playerId: eventArgs.playerId,
                cardId: triggeredArgs.trigger.args.cardId,
                overrides: {
                  actionCost: 0
                }
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
            }
          });
          args.reactionManager.registerReactionTemplate({
            id: `sailor:${eventArgs.cardId}:startTurn`,
            listeningFor: 'startTurn',
            playerId: eventArgs.playerId,
            compulsory: true,
            once: true,
            allowMultipleInstances: true,
            condition: ({ trigger, match })=>trigger.args.playerId === eventArgs.playerId && match.stats.playedCards[eventArgs.cardId].turnNumber !== match.turnNumber,
            triggeredEffectFn: async ()=>{
              console.log(`[sailor triggered effect] gaining 2 treasure...`);
              await args.runGameActionDelegate('gainTreasure', {
                count: 2
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
              const cardIds = await args.runGameActionDelegate('selectCard', {
                prompt: 'Trash card',
                playerId: eventArgs.playerId,
                restrict: args.cardSourceController.getSource('playerHand', eventArgs.playerId),
                count: 1,
                optional: true,
                cancelPrompt: `Don't trash`
              });
              const cardId = cardIds[0];
              if (!cardId) {
                console.log(`[sailor triggered effect] no card chosen`);
                return;
              }
              console.log(`[sailor triggered effect] trashing selected card...`);
              await args.runGameActionDelegate('trashCard', {
                playerId: eventArgs.playerId,
                cardId
              }, {
                loggingContext: {
                  source: cardId
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async ({ runGameActionDelegate })=>{
        console.log(`[sailor effect] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
      }
  },
  'salvager': {
    registerEffects: ()=>async ({ cardPriceController, runGameActionDelegate, playerId, cardLibrary, ...effectArgs })=>{
        console.log(`[salvager effect] gaining 1 buy...`);
        await runGameActionDelegate('gainBuy', {
          count: 1
        });
        console.log(`[salvager effect] prompting user to select a card from hand...`);
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Trash card',
          playerId,
          restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
          count: 1
        });
        const cardId = cardIds[0];
        if (!cardId) {
          console.log(`[salvager effect] no card selected...`);
          return;
        }
        console.log(`[salvager effect] trashing card...`);
        await runGameActionDelegate('trashCard', {
          cardId,
          playerId
        });
        const card = cardLibrary.getCard(cardId);
        const { cost: cardCost } = cardPriceController.applyRules(card, {
          playerId
        });
        console.log(`[salvager effect] gaining ${cardCost.treasure} buy...`);
        await runGameActionDelegate('gainTreasure', {
          count: cardCost.treasure
        });
      }
  },
  'sea-chart': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, match, cardLibrary, ...args })=>{
        console.log(`[SEA CHART EFFECT] drawing 1 card...`);
        await runGameActionDelegate('drawCard', {
          playerId
        });
        console.log(`[SEA CHART EFFECT] gaining 1 action...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = args.cardSourceController.getSource('playerDeck', playerId);
        if (deck.length === 0) {
          console.log(`[SEA CHART EFFECT] shuffling deck...`);
          await runGameActionDelegate('shuffleDeck', {
            playerId
          });
          if (deck.length === 0) {
            console.log(`[SEA CHART EFFECT] no cards in deck...`);
            return;
          }
        }
        const cardId = deck.slice(-1)[0];
        const card = cardLibrary.getCard(cardId);
        console.log(`[SEA CHART EFFECT] revealing card...`);
        await runGameActionDelegate('revealCard', {
          cardId,
          playerId,
          moveToSetAside: true
        });
        const copyInPlay = args.findCards({
          location: 'playArea'
        }).find((playAreaCard)=>playAreaCard.cardKey === card.cardKey && playAreaCard.owner === playerId);
        console.log(`[SEA CHART EFFECT] ${copyInPlay ? 'copy is in play' : 'no copy in play'}...`);
        console.log(`[SEA CHART EFFECT] moving card to ${copyInPlay ? 'playerHand' : 'playerDeck'}...`);
        await runGameActionDelegate('moveCard', {
          cardId,
          toPlayerId: playerId,
          to: {
            location: copyInPlay ? 'playerHand' : 'playerDeck'
          }
        });
      }
  },
  'sea-witch': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`sea-witch:${eventArgs.cardId}:startTurn`);
        },
        onCardPlayed: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `sea-witch:${eventArgs.cardId}:startTurn`,
            playerId: eventArgs.playerId,
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            listeningFor: 'startTurn',
            condition: (conditionArgs)=>{
              return conditionArgs.trigger.args.playerId === eventArgs.playerId;
            },
            triggeredEffectFn: async (triggerArgs)=>{
              console.log(`[sea-witch triggered effect] drawing 2 cards...`);
              await triggerArgs.runGameActionDelegate('drawCard', {
                playerId: eventArgs.playerId,
                count: 2
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
              console.log(`[sea-witch triggered effect] selecting discarding cards...`);
              const selectedCards = await triggerArgs.runGameActionDelegate('selectCard', {
                prompt: 'Discard cards',
                restrict: args.cardSourceController.getSource('playerHand', eventArgs.playerId),
                count: 2,
                playerId: eventArgs.playerId
              });
              for (const selectedCardId of selectedCards){
                await triggerArgs.runGameActionDelegate('discardCard', {
                  cardId: selectedCardId,
                  playerId: eventArgs.playerId
                }, {
                  loggingContext: {
                    source: eventArgs.cardId
                  }
                });
              }
            }
          });
        }
      }),
    registerEffects: ()=>async (args)=>{
        console.log(`[sea witch effect] drawing 2 cards...`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: 2
        });
        const targetPlayerIds = findOrderedTargets({
          startingPlayerId: args.playerId,
          appliesTo: 'ALL_OTHER',
          match: args.match
        }).filter((playerId)=>args.reactionContext[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const curseCardIds = args.findCards([
            {
              location: 'basicSupply'
            },
            {
              cardKeys: 'curse'
            }
          ]);
          if (curseCardIds.length === 0) {
            console.log(`[sea witch effect] no curses in supply...`);
            break;
          }
          console.log(`[sea witch effect] giving curse to ${getPlayerById(args.match, targetPlayerId)}`);
          await args.runGameActionDelegate('gainCard', {
            cardId: curseCardIds[0].id,
            playerId: targetPlayerId,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'smugglers': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const previousPlayer = getPlayerStartingFrom({
          startFromIdx: getPlayerTurnIndex({
            match: cardEffectArgs.match,
            playerId: cardEffectArgs.playerId
          }),
          match: cardEffectArgs.match,
          distance: -1
        });
        console.log(`[smugglers effect] looking at ${previousPlayer} cards gained`);
        const cardsGained = cardEffectArgs.match.stats.cardsGained;
        const cardIdsGained = Object.keys(cardsGained).map(Number).filter((cardId)=>{
          return cardsGained[cardId].playerId === previousPlayer.id && cardsGained[cardId].turnNumber === cardEffectArgs.match.turnNumber - 1;
        });
        let cards = cardEffectArgs.findCards({
          kind: 'upTo',
          amount: {
            treasure: 6
          },
          playerId: cardEffectArgs.playerId
        }).filter((card)=>cardIdsGained.includes(card.id));
        console.log(`[smugglers effect] found ${cards.length} costing up to 6 that were played`);
        const inSupply = (card)=>cardEffectArgs.findCards({
            location: [
              'kingdomSupply',
              'basicSupply'
            ]
          }).find((supplyCard)=>supplyCard.cardKey === card.cardKey);
        const cardsInSupply = cards.map(inSupply).filter((id)=>id !== undefined);
        console.log(`[smugglers effect] found ${cardsInSupply.length} available cards in supply to choose from`);
        if (!cardsInSupply.length) {
          return;
        }
        console.log(`[smugglers effect] prompting user to select a card...`);
        const results = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          restrict: cardsInSupply.map((card)=>card.id),
          prompt: `Gain a card`
        });
        const cardId = results[0];
        if (!cardId) {
          console.warn(`[smugglers effect] no card selected`);
          return;
        }
        console.log(`[smugglers effect] gaining card...`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardId,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'tactician': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`tactician:${cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (args)=>{
        const hand = args.cardSourceController.getSource('playerHand', args.playerId);
        if (hand.length === 0) {
          console.log(`[tactician effect] no cards in hand...`);
          return;
        }
        console.log(`[tactician effect] discarding hand...`);
        for (const cardId of [
          ...hand
        ]){
          await args.runGameActionDelegate('discardCard', {
            cardId,
            playerId: args.playerId
          });
        }
        args.reactionManager.registerReactionTemplate({
          id: `tactician:${args.cardId}:startTurn`,
          playerId: args.playerId,
          listeningFor: 'startTurn',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            return conditionArgs.trigger.args.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber;
          },
          triggeredEffectFn: async (triggerArgs)=>{
            console.warn(`[tactician triggered effect] drawing 5 cards`);
            await triggerArgs.runGameActionDelegate('drawCard', {
              count: 5,
              playerId: args.playerId
            }, {
              loggingContext: {
                source: args.cardId
              }
            });
            console.warn(`[tactician triggered effect] gaining 1 action`);
            await triggerArgs.runGameActionDelegate('gainAction', {
              count: 1
            });
            console.warn(`[tactician triggered effect] gaining 1 buy`);
            await triggerArgs.runGameActionDelegate('gainBuy', {
              count: 1
            });
          }
        });
      }
  },
  'tide-pools': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`tide-pools:${cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (args)=>{
        console.log(`[tide pools effect] drawing 3 cards...`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: 3
        });
        console.log(`[tide pools effect] gaining 1 action...`);
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        args.reactionManager.registerReactionTemplate({
          id: `tide-pools:${args.cardId}:startTurn`,
          playerId: args.playerId,
          listeningFor: 'startTurn',
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>conditionArgs.trigger.args.playerId === args.playerId && args.match.stats.playedCards[args.cardId].turnNumber < args.match.turnNumber,
          triggeredEffectFn: async (triggerArgs)=>{
            console.log(`[tide pools triggered effect] selecting two cards to discard`);
            const selectedCardIds = await triggerArgs.runGameActionDelegate('selectCard', {
              playerId: args.playerId,
              prompt: `Discard cards`,
              restrict: args.cardSourceController.getSource('playerHand', args.playerId),
              count: 2
            });
            if (!selectedCardIds.length) {
              return;
            }
            for (const cardId of selectedCardIds){
              await triggerArgs.runGameActionDelegate('discardCard', {
                cardId,
                playerId: args.playerId
              }, {
                loggingContext: {
                  source: cardId
                }
              });
            }
          }
        });
      }
  },
  'treasure-map': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, cardId, match, cardLibrary, ...args })=>{
        console.log(`[treasure map effect] trashing played treasure map...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId
        });
        const hand = args.cardSourceController.getSource('playerHand', playerId);
        const inHand = hand.find((cardId)=>cardLibrary.getCard(cardId).cardKey === 'treasure-map');
        console.log(`[treasure map effect] ${inHand ? 'another treasure map is in hand' : 'no other treasure map in hand'}...`);
        if (!inHand) {
          return;
        }
        console.log(`[treasure map effect] trashing treasure map from hand...`);
        await runGameActionDelegate('trashCard', {
          playerId,
          cardId: inHand
        });
        const goldCardIds = args.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'gold'
          }
        ]);
        for(let i = 0; i < Math.min(goldCardIds.length, 4); i++){
          await runGameActionDelegate('gainCard', {
            playerId,
            cardId: goldCardIds.slice(-i - 1)[0].id,
            to: {
              location: 'playerDeck'
            }
          });
        }
      }
  },
  'treasury': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`treasury:${cardId}:endTurnPhase`);
        }
      }),
    registerEffects: ()=>async (args)=>{
        console.log(`[treasury effect] drawing 1 card...`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId
        });
        console.log(`[treasury effect] gaining 1 action...`);
        await args.runGameActionDelegate('gainAction', {
          count: 1
        });
        console.log(`[treasury effect] gaining 1 treasure...`);
        await args.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        args.reactionManager.registerReactionTemplate({
          id: `treasury:${args.cardId}:endTurnPhase`,
          playerId: args.playerId,
          listeningFor: 'endTurnPhase',
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: (conditionArgs)=>{
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
            const victoryCardsGained = Object.entries(conditionArgs.match.stats.cardsGained).filter(([id, stats])=>{
              return stats.turnNumber === conditionArgs.match.turnNumber && conditionArgs.cardLibrary.getCard(+id).type.includes('VICTORY');
            }).map((results)=>Number(results[0]));
            if (victoryCardsGained.length > 0) {
              return false;
            }
            return getCurrentPlayer(args.match).id === args.playerId;
          },
          triggeredEffectFn: async (triggerArgs)=>{
            await triggerArgs.runGameActionDelegate('moveCard', {
              cardId: args.cardId,
              toPlayerId: args.playerId,
              to: {
                location: 'playerDeck'
              }
            });
          }
        });
      }
  },
  'warehouse': {
    registerEffects: ()=>async ({ runGameActionDelegate, playerId, ...effectArgs })=>{
        console.log(`[warehouse effect] drawing 3 cards...`);
        await runGameActionDelegate('drawCard', {
          playerId,
          count: 3
        });
        console.log(`[warehouse effect] gaining 1 actions...`);
        await runGameActionDelegate('gainAction', {
          count: 1
        });
        const cardIds = await runGameActionDelegate('selectCard', {
          prompt: 'Discard cards',
          playerId,
          restrict: effectArgs.cardSourceController.getSource('playerHand', playerId),
          count: 3
        });
        console.log(`[warehouse effect] discarding cards...`);
        for (const cardId of cardIds){
          await runGameActionDelegate('discardCard', {
            cardId,
            playerId
          });
        }
      }
  },
  'wharf': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async ({ reactionManager }, { cardId })=>{
          reactionManager.unregisterTrigger(`wharf:${cardId}:startTurn`);
        },
        onCardPlayed: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `wharf:${eventArgs.cardId}:startTurn`,
            playerId: eventArgs.playerId,
            listeningFor: 'startTurn',
            once: true,
            compulsory: true,
            allowMultipleInstances: true,
            condition: (conditionArgs)=>{
              return conditionArgs.trigger.args.playerId === eventArgs.playerId && conditionArgs.match.stats.playedCards[eventArgs.cardId].turnNumber < conditionArgs.match.turnNumber;
            },
            triggeredEffectFn: async (triggerArgs)=>{
              console.log(`[wharf triggered effect] drawing 2 cards`);
              await triggerArgs.runGameActionDelegate('drawCard', {
                playerId: eventArgs.playerId,
                count: 2
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
              console.log(`[wharf triggered effect] gaining 1 buy`);
              await triggerArgs.runGameActionDelegate('gainBuy', {
                count: 1
              }, {
                loggingContext: {
                  source: eventArgs.cardId
                }
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (args)=>{
        console.log(`[wharf effect] drawing 2 cards...`);
        await args.runGameActionDelegate('drawCard', {
          playerId: args.playerId,
          count: 2
        });
        console.log(`[wharf effect] gaining 1 buy...`);
        await args.runGameActionDelegate('gainBuy', {
          count: 1
        });
      }
  }
};
export default expansion;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9zZWFzaWRlL2NhcmQtZWZmZWN0cy1zZWFzaWRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENhcmRFeHBhbnNpb25Nb2R1bGUgfSBmcm9tICcuLi8uLi90eXBlcy50cyc7XG5pbXBvcnQgeyBmaW5kT3JkZXJlZFRhcmdldHMgfSBmcm9tICcuLi8uLi91dGlscy9maW5kLW9yZGVyZWQtdGFyZ2V0cy50cyc7XG5pbXBvcnQgeyBDYXJkLCBDYXJkSWQgfSBmcm9tICdzaGFyZWQvc2hhcmVkLXR5cGVzLnRzJztcbmltcG9ydCB7IGdldFBsYXllclN0YXJ0aW5nRnJvbSwgZ2V0UGxheWVyVHVybkluZGV4IH0gZnJvbSAnLi4vLi4vc2hhcmVkL2dldC1wbGF5ZXItcG9zaXRpb24tdXRpbHMudHMnO1xuaW1wb3J0IHsgZ2V0Q3VycmVudFBsYXllciB9IGZyb20gJy4uLy4uL3V0aWxzL2dldC1jdXJyZW50LXBsYXllci50cyc7XG5pbXBvcnQgeyBnZXRQbGF5ZXJCeUlkIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LXBsYXllci1ieS1pZC50cyc7XG5pbXBvcnQgeyBnZXRUdXJuUGhhc2UgfSBmcm9tICcuLi8uLi91dGlscy9nZXQtdHVybi1waGFzZS50cyc7XG5cbmNvbnN0IGV4cGFuc2lvbjogQ2FyZEV4cGFuc2lvbk1vZHVsZSA9IHtcbiAgJ2FzdHJvbGFiZSc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgYXN0cm9sYWJlOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhclR1cm5gKTtcbiAgICAgIH0sXG4gICAgICBvbkNhcmRQbGF5ZWQ6IGFzeW5jICh7IHJlYWN0aW9uTWFuYWdlciB9LCB7IHBsYXllcklkLCBjYXJkSWQgfSkgPT4ge1xuICAgICAgICBjb25zdCBpZCA9IGBhc3Ryb2xhYmU6JHtjYXJkSWR9OnN0YXJUdXJuYDtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgICBjb25kaXRpb246IChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7IHRyaWdnZXIgfSA9IGFyZ3M7XG4gICAgICAgICAgICByZXR1cm4gdHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBwbGF5ZXJJZDtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUgfSkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtTRUFTSURFIFRSSUdHRVJFRCBFRkZFQ1RdIGdhaW5pbmcgMSB0cmVhc3VyZS4uLmApO1xuICAgICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBjYXJkSWQgfSB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtTRUFTSURFIFRSSUdHRVJFRCBFRkZFQ1RdIGdhaW5pbmcgMSBidXkuLi5gKTtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRJZCB9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtTRUFTT04gRUZGRUNUXSBnYWluaW5nIDEgdHJlYXN1cmUuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtTRUFTT04gRUZGRUNUXSBnYWluaW5nIDEgYnV5Li4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2JhemFhcic6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtTRUFTT04gRUZGRUNUXSBkcmF3aW5nIDEgY2FyZC4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IHBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1NFQVNPTiBFRkZFQ1RdIGdhaW5pbmcgMiBhY3Rpb25zLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1NFQVNPTiBFRkZFQ1RdIGdhaW5pbmcgMSB0cmVhc3VyZS4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2Jsb2NrYWRlJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBibG9ja2FkZToke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmApO1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgYmxvY2thZGU6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoYXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtCTE9DS0FERSBFRkZFQ1RdIHByb21wdGluZyB1c2VyIHRvIHNlbGVjdCBjYXJkLi4uYCk7XG4gICAgICBjb25zdCBjYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHByb21wdDogJ0dhaW4gY2FyZCcsXG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICByZXN0cmljdDogW1xuICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgeyBraW5kOiAndXBUbycsIGFtb3VudDogeyB0cmVhc3VyZTogNCB9LCBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCB9LFxuICAgICAgICBdLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zdCBnYWluZWRDYXJkSWQgPSBjYXJkSWRzWzBdO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0JMT0NLQURFIEVGRkVDVF0gc2VsZWN0ZWQgY2FyZCAke2FyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChnYWluZWRDYXJkSWQpfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGdhaW5lZENhcmRJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdzZXQtYXNpZGUnIH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgIGlkOiBgYmxvY2thZGU6JHthcmdzLmNhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyIH0pID0+IHRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JMT0NLQURFIFRSSUdHRVJFRCBFRkZFQ1RdIG1vdmluZyBwcmV2aW91c2x5IHNlbGVjdGVkIGNhcmQgdG8gaGFuZC4uLmApO1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogZ2FpbmVkQ2FyZElkLFxuICAgICAgICAgICAgdG9QbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBibG9ja2FkZToke2FyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkR2FpbmVkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGdhaW5lZENhcmRJZCk7XG4gICAgICBcbiAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBpZDogYGJsb2NrYWRlOiR7YXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiB7XG4gICAgICAgICAgaWYgKGdldEN1cnJlbnRQbGF5ZXIoYXJncy5tYXRjaCkuaWQgIT09IGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQgIT09IHVuZGVmaW5lZCAmJiBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkKS5jYXJkS2V5ID09IGNhcmRHYWluZWQuY2FyZEtleTtcbiAgICAgICAgfSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZEdhaW5lZCcsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoYXJncykgPT4ge1xuICAgICAgICAgIGNvbnN0IGN1cnNlQ2FyZElkcyA9IGFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICAgIHsgY2FyZEtleXM6ICdjdXJzZScgfVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY3Vyc2VDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtCTE9DS0FERSBUUklHR0VSRUQgRUZGRUNUXSBubyBjdXJzZSBjYXJkcyBpbiBzdXBwbHkuLi5gKTtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0JMT0NLQURFIFRSSUdHRVJFRCBFRkZFQ1RdIGdhaW5pbmcgY3Vyc2UgY2FyZCB0byBwbGF5ZXIncyBkaXNjYXJkLi4uYCk7XG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkISxcbiAgICAgICAgICAgIGNhcmRJZDogY3Vyc2VDYXJkSWRzWzBdLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9LFxuICAgICAgICAgIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBhcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQgfSB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdjYXJhdmFuJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjYXJhdmFuOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCByZWFjdGlvbk1hbmFnZXIsIGNhcmRJZCB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0NBUkFWQU4gRUZGRUNUXSBkcmF3aW5nIGEgY2FyZC4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbQ0FSQVZBTiBFRkZFQ1RdIGdhaW5pbmcgMSBhY3Rpb24uLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYGNhcmF2YW46JHtjYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICBjb25kaXRpb246ICh7IHRyaWdnZXIgfSkgPT4gdHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBwbGF5ZXJJZCxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0NBUkFWQU4gVFJJR0dFUkVEIEVGRkVDVF0gZHJhd2luZyBhIGNhcmQuLi5gKTtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogY2FyZElkIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnY29yc2Fpcic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyIH0sIHsgY2FyZElkIH0pID0+IHtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjb3JzYWlyOiR7Y2FyZElkfTpzdGFyVHVybmApO1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGNvcnNhaXI6JHtjYXJkSWR9OmNhcmRQbGF5ZWRgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcmVhY3Rpb25NYW5hZ2VyLCBjYXJkSWQsIHBsYXllcklkLCByZWFjdGlvbkNvbnRleHQgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtDT1JTQUlSIEVGRkVDVF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN0YXJ0VHVyblRyaWdnZXJJZCA9IGBjb3JzYWlyOiR7Y2FyZElkfTpzdGFydFR1cm5gO1xuICAgICAgY29uc3QgY2FyZFBsYXllZFRyaWdnZXJJZCA9IGBjb3JzYWlyOiR7Y2FyZElkfTpjYXJkUGxheWVkYDtcbiAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogc3RhcnRUdXJuVHJpZ2dlcklkLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyIH0pID0+IHRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gcGxheWVySWQsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtDT1JTQUlSIFRSSUdHRVJFRCBFRkZFQ1RdIGRyYXdpbmcgY2FyZC4uLmApO1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBjYXJkSWQgfSB9KTtcbiAgICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoc3RhcnRUdXJuVHJpZ2dlcklkKTtcbiAgICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoY2FyZFBsYXllZFRyaWdnZXJJZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICByZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGNhcmRQbGF5ZWRUcmlnZ2VySWQsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkUGxheWVkJyxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoeyBtYXRjaCwgdHJpZ2dlciwgY2FyZExpYnJhcnkgfSkgPT4ge1xuICAgICAgICAgIGlmICghdHJpZ2dlci5hcmdzLmNhcmRJZCB8fCB0cmlnZ2VyLmFyZ3MucGxheWVySWQgPT09IHBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHJlYWN0aW9uQ29udGV4dFt0cmlnZ2VyLmFyZ3MucGxheWVySWQhXT8ucmVzdWx0ID09PSAnaW1tdW5pdHknKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvcnNhaXIgdHJpZ2dlcmVkIGVmZmVjdF0gJHtnZXRQbGF5ZXJCeUlkKG1hdGNoLCB0cmlnZ2VyLmFyZ3MucGxheWVySWQhKX0gaXMgaW1tdW5lYCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKHRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghWydzaWx2ZXInLCAnZ29sZCddLmluY2x1ZGVzKGNhcmQuY2FyZEtleSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBwbGF5ZWRTaWx2ZXJDYXJkcyA9IE9iamVjdC5rZXlzKG1hdGNoLnN0YXRzLnBsYXllZENhcmRzKVxuICAgICAgICAgICAgLmZpbHRlcihjYXJkSWQgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gWydzaWx2ZXInLCAnZ29sZCddLmluY2x1ZGVzKGNhcmRMaWJyYXJ5LmdldENhcmQoK2NhcmRJZCkuY2FyZEtleSkgJiZcbiAgICAgICAgICAgICAgICBtYXRjaC5zdGF0cy5wbGF5ZWRDYXJkc1srY2FyZElkXS50dXJuTnVtYmVyID09PSBtYXRjaC50dXJuTnVtYmVyICYmXG4gICAgICAgICAgICAgICAgbWF0Y2guc3RhdHMucGxheWVkQ2FyZHNbK2NhcmRJZF0ucGxheWVySWQgPT09IHRyaWdnZXIuYXJncy5wbGF5ZXJJZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHBsYXllZFNpbHZlckNhcmRzLmxlbmd0aCA9PT0gMTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh7IHRyaWdnZXIgfSkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQ09SU0FJUiBUUklHR0VSRUQgRUZGRUNUXSB0cmFzaGluZyBjYXJkLi4uYCk7XG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKFxuICAgICAgICAgICAgJ3RyYXNoQ2FyZCcsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0cmlnZ2VyLmFyZ3MucGxheWVySWQhLFxuICAgICAgICAgICAgICBjYXJkSWQ6IHRyaWdnZXIuYXJncy5jYXJkSWQhLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbG9nZ2luZ0NvbnRleHQ6IHtcbiAgICAgICAgICAgICAgICBzb3VyY2U6IGNhcmRJZFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICdjdXRwdXJzZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSwgcGxheWVySWQsIG1hdGNoLCByZWFjdGlvbkNvbnRleHQsIGNhcmRMaWJyYXJ5LCAuLi5hcmdzIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbY3V0cHVyc2UgZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmUuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiwgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldElkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IHBsYXllcklkLFxuICAgICAgICBhcHBsaWVzVG86ICdBTExfT1RIRVInLFxuICAgICAgICBtYXRjaFxuICAgICAgfSkuZmlsdGVyKChpZCkgPT4gcmVhY3Rpb25Db250ZXh0Py5baWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldElkIG9mIHRhcmdldElkcykge1xuICAgICAgICBjb25zdCBoYW5kID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCB0YXJnZXRJZCk7XG4gICAgICAgIGNvbnN0IGNvcHBlcklkID0gaGFuZC5maW5kKGNhcmRJZCA9PiBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCkuY2FyZEtleSA9PT0gJ2NvcHBlcicpO1xuICAgICAgICBpZiAoY29wcGVySWQpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2N1dHB1cnNlIGVmZmVjdF0gZGlzY2FyZGluZyBjb3BwZXIuLi5gKTtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiBjb3BwZXJJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRJZFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW2N1dHB1cnNlIGVmZmVjdF0gcmV2ZWFsaW5nIGhhbmQuLi5gKTtcbiAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgaGFuZCkge1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRJZCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ2Zpc2hpbmctdmlsbGFnZSc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgZmlzaGluZy12aWxsYWdlOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCByZWFjdGlvbk1hbmFnZXIsIGNhcmRJZCB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2Zpc2hpbmcgdmlsbGFnZSBlZmZlY3RdIGdhaW5pbmcgMiBhY3Rpb24uLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbZmlzaGluZyB2aWxsYWdlIGVmZmVjdF0gZ2FpbmluZyAxIHRyZWFzdXJlLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYGZpc2hpbmctdmlsbGFnZToke2NhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIGNvbmRpdGlvbjogKHsgdHJpZ2dlciB9KSA9PiB0cmlnZ2VyLmFyZ3MucGxheWVySWQgPT09IHBsYXllcklkLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZmlzaGluZyB2aWxsYWdlIHRyaWdnZXJlZCBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb24uLi5gKTtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBjYXJkSWQgfSB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2Zpc2hpbmcgdmlsbGFnZSB0cmlnZ2VyZWQgZWZmZWN0XSBnYWluaW5nIDEgdHJlYXN1cmUuLi5gKTtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRJZCB9IH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ2hhdmVuJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHtcbiAgICAgIHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSxcbiAgICAgIHBsYXllcklkLFxuICAgICAgY2FyZElkOiBwbGF5ZWRDYXJkSWQsXG4gICAgICByZWFjdGlvbk1hbmFnZXIsXG4gICAgICBjYXJkTGlicmFyeSxcbiAgICAgIC4uLmVmZmVjdEFyZ3NcbiAgICB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2hhdmVuIGVmZmVjdF0gZHJhd2luZyBjYXJkLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgIFxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2hhdmVuIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbi4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIGNhcmQgdG8gc2V0IGFzaWRlJyxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBudW1iZXJbXTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZElkID0gY2FyZElkc1swXTtcbiAgICAgIFxuICAgICAgaWYgKCFjYXJkSWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdbaGF2ZW4gZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgY2FyZElkLFxuICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdzZXQtYXNpZGUnIH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpLmZhY2luZyA9ICdiYWNrJztcbiAgICAgIFxuICAgICAgcmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgaGF2ZW46JHtwbGF5ZWRDYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjb25kaXRpb246ICh7IHRyaWdnZXIgfSkgPT4gdHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBwbGF5ZXJJZCxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyRWZmZWN0QXJncykgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbaGF2ZW4gdHJpZ2dlcmVkIGVmZmVjdF0gbW92aW5nIHNlbGVjdGVkIGNhcmQgdG8gaGFuZC4uLmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmQgPSB0cmlnZ2VyRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICAgICAgY2FyZC5mYWNpbmcgPSAnZnJvbnQnO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdpc2xhbmQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCBjYXJkSWQsIC4uLmVmZmVjdEFyZ3MgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtJU0xBTkQgRUZGRUNUXSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgY2FyZC4uLmApO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzID0gKGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnQ2hvb3NlIGNhcmQnLFxuICAgICAgICB2YWxpZFByb21wdDogJycsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICByZXN0cmljdDogZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgfSkpIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW0lTTEFORCBFRkZFQ1RdIG1vdmluZyBpc2xhbmQgdG8gaXNsYW5kIG1hdC4uLmApO1xuICAgICAgXG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICBjYXJkSWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAnaXNsYW5kJyB9LFxuICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkID0gY2FyZElkc1swXTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtJU0xBTkQgRUZGRUNUXSBtb3Zpbmcgc2VsZWN0ZWQgY2FyZCB0byBpc2xhbmQgbWF0Li4uYCk7XG4gICAgICBcbiAgICAgIGlmIChzZWxlY3RlZENhcmRJZCkge1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdpc2xhbmQnIH0sXG4gICAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWRcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdsaWdodGhvdXNlJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBsaWdodGhvdXNlOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBsaWdodGhvdXNlOiR7ZXZlbnRBcmdzLmNhcmRJZH06Y2FyZFBsYXllZGApO1xuICAgICAgfSxcbiAgICAgIG9uQ2FyZFBsYXllZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICAgIGlkOiBgbGlnaHRob3VzZToke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWRgLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZFBsYXllZCcsXG4gICAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyLCBjYXJkTGlicmFyeSB9KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZWRDYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyLmFyZ3MuY2FyZElkISk7XG4gICAgICAgICAgICByZXR1cm4gdHJpZ2dlci5hcmdzLmNhcmRJZCAhPT0gZXZlbnRBcmdzLmNhcmRJZCAmJiB0cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGV2ZW50QXJncy5wbGF5ZXJJZCAmJiBwbGF5ZWRDYXJkLnR5cGUuaW5jbHVkZXMoJ0FUVEFDSycpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogZmFsc2UsXG4gICAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuICdpbW11bml0eSc7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBsaWdodGhvdXNlOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyIH0pID0+IHRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgbGlnaHRob3VzZToke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWRgKTtcbiAgICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBldmVudEFyZ3MuY2FyZElkIH0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbbGlnaHRob3VzZSBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb24uLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbGlnaHRob3VzZSBlZmZlY3RdIGdhaW5pbmcgMSB0cmVhc3VyZS4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2xvb2tvdXQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCBtYXRjaCwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW0xPT0tPVVQgRUZGRUNUXSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBwbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSBbXSBhcyBDYXJkSWRbXTtcbiAgICAgIHdoaWxlIChjYXJkSWRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgbGV0IGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNhcmRJZCA9IGRlY2suc2xpY2UoLTEpWzBdO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNhcmRJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtsb29rb3V0IGVmZmVjdF0gbm8gY2FyZCBpbiBkZWNrYClcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdzZXQtYXNpZGUnIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjYXJkSWRzLnB1c2goY2FyZElkKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcHJvbXB0cyA9IFsnVHJhc2ggb25lJywgJ0Rpc2NhcmQgb25lJ107XG4gICAgICBjb25zdCBsID0gY2FyZElkcy5sZW5ndGg7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGxldCBzZWxlY3RlZElkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIFxuICAgICAgICBpZiAoY2FyZElkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBzZWxlY3RlZElkID0gY2FyZElkc1swXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZElkcyA9IGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgICAgcHJvbXB0OiBwcm9tcHRzW2ldLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICB0eXBlOiAnc2VsZWN0JyxcbiAgICAgICAgICAgICAgY2FyZElkcyxcbiAgICAgICAgICAgICAgc2VsZWN0Q291bnQ6IDFcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSBhcyB7IHJlc3VsdDogbnVtYmVyW10gfVxuICAgICAgICAgIFxuICAgICAgICAgIHNlbGVjdGVkSWQgPSBzZWxlY3RlZElkcy5yZXN1bHRbMF07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNhcmRJZHMuc3BsaWNlKGNhcmRJZHMuZmluZEluZGV4KGlkID0+IGlkID09PSBzZWxlY3RlZElkKSwgMSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkSWQsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaSA9PT0gMSkge1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkSWQsXG4gICAgICAgICAgICBwbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnbWVyY2hhbnQtc2hpcCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgbWVyY2hhbnQtc2hpcDoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmApO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgcmVhY3Rpb25NYW5hZ2VyLCBjYXJkSWQgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFttZXJjaGFudCBzaGlwIGVmZmVjdF0gZ2FpbmluZyAyIHRyZWFzdXJlcy4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICByZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgaWQ6IGBtZXJjaGFudC1zaGlwOiR7Y2FyZElkfTpzdGFydFR1cm5gLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyIH0pID0+IHRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gcGxheWVySWQsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFttZXJjaGFudCBzaGlwIHRyaWdnZXJlZCBlZmZlY3RdIGdhaW5pbmcgMiB0cmVhc3VyZS4uLmApO1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogY2FyZElkIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnbW9ua2V5Jzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBtb25rZXk6JHtldmVudEFyZ3MuY2FyZElkfTpzdGFydFR1cm5gKTtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYG1vbmtleToke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKVxuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyLCBtYXRjaCwgcGxheWVySWQsIGNhcmRJZCwgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYG1vbmtleToke2NhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIGNvbmRpdGlvbjogKHsgdHJpZ2dlciB9KSA9PiB0cmlnZ2VyLmFyZ3MucGxheWVySWQgPT09IHBsYXllcklkLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbbW9ua2V5IHRyaWdnZXJlZCBlZmZlY3RdIGRyYXdpbmcgY2FyZCBhdCBzdGFydCBvZiB0dXJuLi4uYCk7XG4gICAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRJZCB9IH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIHJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgbW9ua2V5OiR7Y2FyZElkfTpjYXJkR2FpbmVkYCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0aGlzUGxheWVyVHVybklkeCA9IG1hdGNoLnBsYXllcnMuZmluZEluZGV4KHAgPT4gcC5pZCA9PT0gcGxheWVySWQpO1xuICAgICAgY29uc3QgcGxheWVyVG9SaWdodElkID0gZ2V0UGxheWVyU3RhcnRpbmdGcm9tKHtcbiAgICAgICAgc3RhcnRGcm9tSWR4OiB0aGlzUGxheWVyVHVybklkeCxcbiAgICAgICAgbWF0Y2gsXG4gICAgICAgIGRpc3RhbmNlOiAtMVxuICAgICAgfSkuaWQ7XG4gICAgICBcbiAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYG1vbmtleToke2NhcmRJZH06Y2FyZEdhaW5lZGAsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkR2FpbmVkJyxcbiAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFttb25rZXkgdHJpZ2dlcmVkIGVmZmVjdF0gZHJhd2luZyBjYXJkLCBiZWNhdXNlIHBsYXllciB0byB0aGUgcmlnaHQgZ2FpbmVkIGEgY2FyZC4uLmApO1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBjYXJkSWQgfSB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyIH0pID0+IHRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gcGxheWVyVG9SaWdodElkXG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdwaXJhdGUnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25FbnRlckhhbmQ6IGFzeW5jICh7IHJlYWN0aW9uTWFuYWdlciB9LCB7IHBsYXllcklkLCBjYXJkSWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYHBpcmF0ZToke2NhcmRJZH06Y2FyZEdhaW5lZGAsXG4gICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgY29tcHVsc29yeTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRHYWluZWQnLFxuICAgICAgICAgIGNvbmRpdGlvbjogKHsgY2FyZExpYnJhcnksIHRyaWdnZXIgfSkgPT4gY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyLmFyZ3MuY2FyZElkISkudHlwZS5pbmNsdWRlcygnVFJFQVNVUkUnKSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlIH0pID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncGxheUNhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICAgIG92ZXJyaWRlczoge1xuICAgICAgICAgICAgICAgIGFjdGlvbkNvc3Q6IDAsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBjYXJkSWQgfSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIG9uTGVhdmVIYW5kOiBhc3luYyAoeyByZWFjdGlvbk1hbmFnZXIgfSwgeyBjYXJkSWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYHBpcmF0ZToke2NhcmRJZH06Y2FyZEdhaW5lZGApO1xuICAgICAgfSxcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBwaXJhdGU6JHtldmVudEFyZ3MuY2FyZElkfTpzdGFydFR1cm5gKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jICh7XG4gICAgICByZWFjdGlvbk1hbmFnZXIsXG4gICAgICBwbGF5ZXJJZCxcbiAgICAgIG1hdGNoLFxuICAgICAgY2FyZElkLFxuICAgICAgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLFxuICAgICAgLi4uZWZmZWN0QXJnc1xuICAgIH0pID0+IHtcbiAgICAgIGNvbnN0IGlkID0gYHBpcmF0ZToke2NhcmRJZH06c3RhcnRUdXJuYDtcbiAgICAgIGNvbnN0IHR1cm5QbGF5ZWQgPSBtYXRjaC5zdGF0cy5wbGF5ZWRDYXJkc1tjYXJkSWRdLnR1cm5OdW1iZXI7XG4gICAgICBcbiAgICAgIHJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZCxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgIGNvbmRpdGlvbjogKHtcbiAgICAgICAgICB0cmlnZ2VyLFxuICAgICAgICAgIHJlYWN0aW9uXG4gICAgICAgIH0pID0+IHRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gcGxheWVySWQgJiYgcmVhY3Rpb24uaWQgPT09IGlkICYmIG1hdGNoLnR1cm5OdW1iZXIgIT09IHR1cm5QbGF5ZWQsXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtwaXJhdGUgdHJpZ2dlcmVkIGVmZmVjdF0gcHJvbXB0aW5nIHVzZXIgdG8gc2VsZWN0IHRyZWFzdXJlIGNvc3RpbmcgdXAgdG8gNi4uLmApO1xuICAgICAgICAgIGNvbnN0IGNhcmRJZHMgPSAoYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgICAgcHJvbXB0OiAnR2FpbiBjYXJkJyxcbiAgICAgICAgICAgIHZhbGlkUHJvbXB0OiAnJyxcbiAgICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgICAgcmVzdHJpY3Q6IFtcbiAgICAgICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgICAgICAgeyBjYXJkVHlwZTogJ1RSRUFTVVJFJyB9LFxuICAgICAgICAgICAgICB7IGtpbmQ6ICd1cFRvJywgYW1vdW50OiB7IHRyZWFzdXJlOiA2IH0sIHBsYXllcklkIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICB9KSkgYXMgbnVtYmVyW107XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZElkID0gY2FyZElkc1swXTtcbiAgICAgICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbcGlyYXRlIHRyaWdnZXJlZCBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWQuLi5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtwaXJhdGUgdHJpZ2dlcmVkIGVmZmVjdF0gZ2FpbmluZyBzZWxlY3RlZCBjYXJkIHRvIGhhbmQuLi5gKTtcbiAgICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfSxcbiAgICAgICAgICB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogY2FyZElkIH0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ25hdGl2ZS12aWxsYWdlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgbWF0Y2gsIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtOQVRJVkUgVklMTEFHRSBFRkZFQ1RdIGdhaW5pbmcgMiBhY3Rpb25zLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW05BVElWRSBWSUxMQUdFIEVGRkVDVF0gcHJvbXB0aW5nIHVzZXIgdG8gY2hvb3NlLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IChhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICBhY3Rpb25CdXR0b25zOiBbXG4gICAgICAgICAgeyBsYWJlbDogJ1B1dCB0b3AgY2FyZCBvbiBtYXQnLCBhY3Rpb246IDEgfSxcbiAgICAgICAgICB7IGxhYmVsOiAnVGFrZSBjYXJkcyBmcm9tIG1hdCcsIGFjdGlvbjogMiB9XG4gICAgICAgIF1cbiAgICAgIH0pKSBhcyB7IGFjdGlvbjogbnVtYmVyIH07XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIGNvbnN0IGRlY2sgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVyRGVjaycsIHBsYXllcklkKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbTkFUSVZFIFZJTExBR0UgRUZGRUNUXSBzaHVmZmxpbmcgZGVjay4uLmApO1xuICAgICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2h1ZmZsZURlY2snLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtOQVRJVkUgVklMTEFHRSBFRkZFQ1RdIG5vIGNhcmRzIGluIGRlY2suLi5gKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbTkFUSVZFIFZJTExBR0UgRUZGRUNUXSBtb3ZpbmcgY2FyZCB0byBuYXRpdmUgdmlsbGFnZSBtYXQuLi5gKTtcbiAgICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICduYXRpdmUtdmlsbGFnZScgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgbWF0Q2FyZElkcyA9IGFyZ3MuZmluZENhcmRzKHsgbG9jYXRpb246ICduYXRpdmUtdmlsbGFnZSd9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtOQVRJVkUgVklMTEFHRSBFRkZFQ1RdIG1vdmluZyAke21hdENhcmRJZHMubGVuZ3RofSBjYXJkcyBmcm9tIG5hdGl2ZSB2aWxsYWdlIG1hdCB0byBoYW5kLi4uYCk7XG4gICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBtYXRDYXJkSWRzKSB7XG4gICAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgY2FyZElkOiBjYXJkSWQsXG4gICAgICAgICAgdG9QbGF5ZXJJZDogcGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3NhaWxvcic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyIH0sIHsgY2FyZElkIH0pID0+IHtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBzYWlsb3I6JHtjYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBzYWlsb3I6JHtjYXJkSWR9OnN0YXJ0VHVybmApO1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYHNhaWxvcjoke2NhcmRJZH06ZW5kVHVybmApO1xuICAgICAgfSxcbiAgICAgIG9uQ2FyZFBsYXllZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICAgIGlkOiBgc2FpbG9yOiR7ZXZlbnRBcmdzLmNhcmRJZH06ZW5kVHVybmAsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuJyxcbiAgICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgICBjb25kaXRpb246ICgpID0+IHRydWUsXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyQXJncykgPT4ge1xuICAgICAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYHNhaWxvcjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBzYWlsb3I6JHtldmVudEFyZ3MuY2FyZElkfTplbmRUdXJuYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBzYWlsb3I6JHtldmVudEFyZ3MuY2FyZElkfTpjYXJkR2FpbmVkYCxcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRHYWluZWQnLFxuICAgICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgICAgY29tcHVsc29yeTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjYXJkR2FpbmVkID0gY29uZGl0aW9uQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCEpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIWNhcmRHYWluZWQudHlwZS5pbmNsdWRlcygnRFVSQVRJT04nKSkge1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gZXZlbnRBcmdzLnBsYXllcklkKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGNvbmRpdGlvbkFyZ3MubWF0Y2guc3RhdHMucGxheWVkQ2FyZHNbY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MuY2FyZElkIV0gPT09IHVuZGVmaW5lZDtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyAodHJpZ2dlcmVkQXJncykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzYWlsb3IgdHJpZ2dlcmVkIGVmZmVjdF0gcGxheWluZyAke3RyaWdnZXJlZEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyZWRBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQhKX1gKTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiB0cmlnZ2VyZWRBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQhLFxuICAgICAgICAgICAgICBvdmVycmlkZXM6IHsgYWN0aW9uQ29zdDogMCB9XG4gICAgICAgICAgICB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogZXZlbnRBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICAgIGlkOiBgc2FpbG9yOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IHRydWUsXG4gICAgICAgICAgY29uZGl0aW9uOiAoeyB0cmlnZ2VyLCBtYXRjaCB9KSA9PlxuICAgICAgICAgICAgdHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBldmVudEFyZ3MucGxheWVySWQgJiYgbWF0Y2guc3RhdHMucGxheWVkQ2FyZHNbZXZlbnRBcmdzLmNhcmRJZF0udHVybk51bWJlciAhPT0gbWF0Y2gudHVybk51bWJlcixcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzYWlsb3IgdHJpZ2dlcmVkIGVmZmVjdF0gZ2FpbmluZyAyIHRyZWFzdXJlLi4uYCk7XG4gICAgICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogZXZlbnRBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjYXJkSWRzID0gYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICAgIHByb21wdDogJ1RyYXNoIGNhcmQnLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICByZXN0cmljdDogYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBldmVudEFyZ3MucGxheWVySWQpLFxuICAgICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICAgICAgICAgIGNhbmNlbFByb21wdDogYERvbid0IHRyYXNoYFxuICAgICAgICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNhcmRJZCA9IGNhcmRJZHNbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2FpbG9yIHRyaWdnZXJlZCBlZmZlY3RdIG5vIGNhcmQgY2hvc2VuYCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtzYWlsb3IgdHJpZ2dlcmVkIGVmZmVjdF0gdHJhc2hpbmcgc2VsZWN0ZWQgY2FyZC4uLmApO1xuICAgICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRJZCB9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtzYWlsb3IgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3NhbHZhZ2VyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHtcbiAgICAgIGNhcmRQcmljZUNvbnRyb2xsZXIsXG4gICAgICBydW5HYW1lQWN0aW9uRGVsZWdhdGUsXG4gICAgICBwbGF5ZXJJZCxcbiAgICAgIGNhcmRMaWJyYXJ5LFxuICAgICAgLi4uZWZmZWN0QXJnc1xuICAgIH0pID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc2FsdmFnZXIgZWZmZWN0XSBnYWluaW5nIDEgYnV5Li4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3NhbHZhZ2VyIGVmZmVjdF0gcHJvbXB0aW5nIHVzZXIgdG8gc2VsZWN0IGEgY2FyZCBmcm9tIGhhbmQuLi5gKTtcbiAgICAgIGNvbnN0IGNhcmRJZHMgPSAoYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwcm9tcHQ6ICdUcmFzaCBjYXJkJyxcbiAgICAgICAgcGxheWVySWQsXG4gICAgICAgIHJlc3RyaWN0OiBlZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSkgYXMgbnVtYmVyW107XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRJZCA9IGNhcmRJZHNbMF07XG4gICAgICBcbiAgICAgIGlmICghY2FyZElkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2FsdmFnZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkLi4uYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzYWx2YWdlciBlZmZlY3RdIHRyYXNoaW5nIGNhcmQuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywgeyBjYXJkSWQsIHBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpO1xuICAgICAgY29uc3QgeyBjb3N0OiBjYXJkQ29zdCB9ID0gY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmQsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc2FsdmFnZXIgZWZmZWN0XSBnYWluaW5nICR7Y2FyZENvc3QudHJlYXN1cmV9IGJ1eS4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiBjYXJkQ29zdC50cmVhc3VyZSB9KTtcbiAgICB9XG4gIH0sXG4gICdzZWEtY2hhcnQnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCBtYXRjaCwgY2FyZExpYnJhcnksIC4uLmFyZ3MgfSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtTRUEgQ0hBUlQgRUZGRUNUXSBkcmF3aW5nIDEgY2FyZC4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbU0VBIENIQVJUIEVGRkVDVF0gZ2FpbmluZyAxIGFjdGlvbi4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZGVjayA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgcGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtTRUEgQ0hBUlQgRUZGRUNUXSBzaHVmZmxpbmcgZGVjay4uLmApO1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZCB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmIChkZWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbU0VBIENIQVJUIEVGRkVDVF0gbm8gY2FyZHMgaW4gZGVjay4uLmApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSBkZWNrLnNsaWNlKC0xKVswXTtcbiAgICAgIGNvbnN0IGNhcmQgPSBjYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbU0VBIENIQVJUIEVGRkVDVF0gcmV2ZWFsaW5nIGNhcmQuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgncmV2ZWFsQ2FyZCcsIHtcbiAgICAgICAgY2FyZElkLFxuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgbW92ZVRvU2V0QXNpZGU6IHRydWVcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjb3B5SW5QbGF5ID0gYXJncy5maW5kQ2FyZHMoeyBsb2NhdGlvbjogJ3BsYXlBcmVhJyB9KVxuICAgICAgICAuZmluZChwbGF5QXJlYUNhcmQgPT4gcGxheUFyZWFDYXJkLmNhcmRLZXkgPT09IGNhcmQuY2FyZEtleSAmJiBwbGF5QXJlYUNhcmQub3duZXIgPT09IHBsYXllcklkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtTRUEgQ0hBUlQgRUZGRUNUXSAke2NvcHlJblBsYXkgPyAnY29weSBpcyBpbiBwbGF5JyA6ICdubyBjb3B5IGluIHBsYXknfS4uLmApO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW1NFQSBDSEFSVCBFRkZFQ1RdIG1vdmluZyBjYXJkIHRvICR7Y29weUluUGxheSA/ICdwbGF5ZXJIYW5kJyA6ICdwbGF5ZXJEZWNrJ30uLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgY2FyZElkLFxuICAgICAgICB0b1BsYXllcklkOiBwbGF5ZXJJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246IGNvcHlJblBsYXkgPyAncGxheWVySGFuZCcgOiAncGxheWVyRGVjaycgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnc2VhLXdpdGNoJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBzZWEtd2l0Y2g6JHtldmVudEFyZ3MuY2FyZElkfTpzdGFydFR1cm5gKTtcbiAgICAgIH0sXG4gICAgICBvbkNhcmRQbGF5ZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZDogYHNlYS13aXRjaDoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICAgIGNvbXB1bHNvcnk6IHRydWUsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICAgIGNvbmRpdGlvbjogKGNvbmRpdGlvbkFyZ3MpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gZXZlbnRBcmdzLnBsYXllcklkXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHRyaWdnZXJBcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3NlYS13aXRjaCB0cmlnZ2VyZWQgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHMuLi5gKVxuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY291bnQ6IDJcbiAgICAgICAgICAgIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBldmVudEFyZ3MuY2FyZElkIH0gfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc2VhLXdpdGNoIHRyaWdnZXJlZCBlZmZlY3RdIHNlbGVjdGluZyBkaXNjYXJkaW5nIGNhcmRzLi4uYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZHMgPSBhd2FpdCB0cmlnZ2VyQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICAgIHByb21wdDogJ0Rpc2NhcmQgY2FyZHMnLFxuICAgICAgICAgICAgICByZXN0cmljdDogYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBldmVudEFyZ3MucGxheWVySWQpLFxuICAgICAgICAgICAgICBjb3VudDogMixcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZFxuICAgICAgICAgICAgfSkgYXMgbnVtYmVyW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2VsZWN0ZWRDYXJkSWQgb2Ygc2VsZWN0ZWRDYXJkcykge1xuICAgICAgICAgICAgICBhd2FpdCB0cmlnZ2VyQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZFxuICAgICAgICAgICAgICB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogZXZlbnRBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3NlYSB3aXRjaCBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkcy4uLmApO1xuICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGFyZ3MucGxheWVySWQsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIG1hdGNoOiBhcmdzLm1hdGNoXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gYXJncy5yZWFjdGlvbkNvbnRleHRbcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBjdXJzZUNhcmRJZHMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICAgIHsgY2FyZEtleXM6ICdjdXJzZScgfVxuICAgICAgICBdKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjdXJzZUNhcmRJZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzZWEgd2l0Y2ggZWZmZWN0XSBubyBjdXJzZXMgaW4gc3VwcGx5Li4uYCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbc2VhIHdpdGNoIGVmZmVjdF0gZ2l2aW5nIGN1cnNlIHRvICR7Z2V0UGxheWVyQnlJZChhcmdzLm1hdGNoLCB0YXJnZXRQbGF5ZXJJZCl9YCk7XG4gICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IGN1cnNlQ2FyZElkc1swXS5pZCxcbiAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3NtdWdnbGVycyc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgcHJldmlvdXNQbGF5ZXIgPSBnZXRQbGF5ZXJTdGFydGluZ0Zyb20oe1xuICAgICAgICBzdGFydEZyb21JZHg6IGdldFBsYXllclR1cm5JbmRleCh7IG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCwgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pLFxuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGRpc3RhbmNlOiAtMVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc211Z2dsZXJzIGVmZmVjdF0gbG9va2luZyBhdCAke3ByZXZpb3VzUGxheWVyfSBjYXJkcyBnYWluZWRgKTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZHNHYWluZWQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC5zdGF0cy5jYXJkc0dhaW5lZDtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZElkc0dhaW5lZCA9IE9iamVjdC5rZXlzKGNhcmRzR2FpbmVkKVxuICAgICAgICAubWFwKE51bWJlcilcbiAgICAgICAgLmZpbHRlcihjYXJkSWQgPT4ge1xuICAgICAgICAgIHJldHVybiBjYXJkc0dhaW5lZFtjYXJkSWRdLnBsYXllcklkID09PSBwcmV2aW91c1BsYXllci5pZCAmJlxuICAgICAgICAgICAgY2FyZHNHYWluZWRbY2FyZElkXS50dXJuTnVtYmVyID09PSBjYXJkRWZmZWN0QXJncy5tYXRjaC50dXJuTnVtYmVyIC0gMTtcbiAgICAgICAgfSk7XG4gICAgICBcbiAgICAgIGxldCBjYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyh7IGtpbmQ6ICd1cFRvJywgYW1vdW50OiB7IHRyZWFzdXJlOiA2IH0sIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZElkc0dhaW5lZC5pbmNsdWRlcyhjYXJkLmlkKSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc211Z2dsZXJzIGVmZmVjdF0gZm91bmQgJHtjYXJkcy5sZW5ndGh9IGNvc3RpbmcgdXAgdG8gNiB0aGF0IHdlcmUgcGxheWVkYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGluU3VwcGx5ID0gKGNhcmQ6IENhcmQpID0+XG4gICAgICAgIGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyh7IGxvY2F0aW9uOiBbJ2tpbmdkb21TdXBwbHknLCAnYmFzaWNTdXBwbHknXSB9KVxuICAgICAgICAgIC5maW5kKHN1cHBseUNhcmQgPT4gc3VwcGx5Q2FyZC5jYXJkS2V5ID09PSBjYXJkLmNhcmRLZXkpO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkc0luU3VwcGx5ID0gY2FyZHMubWFwKGluU3VwcGx5KS5maWx0ZXIoaWQgPT4gaWQgIT09IHVuZGVmaW5lZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbc211Z2dsZXJzIGVmZmVjdF0gZm91bmQgJHtjYXJkc0luU3VwcGx5Lmxlbmd0aH0gYXZhaWxhYmxlIGNhcmRzIGluIHN1cHBseSB0byBjaG9vc2UgZnJvbWApO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRzSW5TdXBwbHkubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzbXVnZ2xlcnMgZWZmZWN0XSBwcm9tcHRpbmcgdXNlciB0byBzZWxlY3QgYSBjYXJkLi4uYCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRzSW5TdXBwbHkubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIHByb21wdDogYEdhaW4gYSBjYXJkYCxcbiAgICAgIH0pIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWQgPSByZXN1bHRzWzBdO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRJZCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtzbXVnZ2xlcnMgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzbXVnZ2xlcnMgZWZmZWN0XSBnYWluaW5nIGNhcmQuLi5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGNhcmRJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAndGFjdGljaWFuJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoeyByZWFjdGlvbk1hbmFnZXIgfSwgeyBjYXJkSWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYHRhY3RpY2lhbjoke2NhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoYXJncykgPT4ge1xuICAgICAgY29uc3QgaGFuZCA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgYXJncy5wbGF5ZXJJZCk7XG4gICAgICBpZiAoaGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFt0YWN0aWNpYW4gZWZmZWN0XSBubyBjYXJkcyBpbiBoYW5kLi4uYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt0YWN0aWNpYW4gZWZmZWN0XSBkaXNjYXJkaW5nIGhhbmQuLi5gKTtcbiAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIFsuLi5oYW5kXSkge1xuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7IGNhcmRJZCwgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgdGFjdGljaWFuOiR7YXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IChjb25kaXRpb25BcmdzKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkID09PSBhcmdzLnBsYXllcklkICYmIGFyZ3MubWF0Y2guc3RhdHMucGxheWVkQ2FyZHNbYXJncy5jYXJkSWRdLnR1cm5OdW1iZXIgPCBhcmdzLm1hdGNoLnR1cm5OdW1iZXJcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyQXJncykgPT4ge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW3RhY3RpY2lhbiB0cmlnZ2VyZWQgZWZmZWN0XSBkcmF3aW5nIDUgY2FyZHNgKTtcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywge1xuICAgICAgICAgICAgY291bnQ6IDUsXG4gICAgICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgICAgICAgIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiBhcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUud2FybihgW3RhY3RpY2lhbiB0cmlnZ2VyZWQgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlckFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFt0YWN0aWNpYW4gdHJpZ2dlcmVkIGVmZmVjdF0gZ2FpbmluZyAxIGJ1eWApO1xuICAgICAgICAgIGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAndGlkZS1wb29scyc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyIH0sIHsgY2FyZElkIH0pID0+IHtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGB0aWRlLXBvb2xzOiR7Y2FyZElkfTpzdGFydFR1cm5gKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3RpZGUgcG9vbHMgZWZmZWN0XSBkcmF3aW5nIDMgY2FyZHMuLi5gKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGFyZ3MucGxheWVySWQsIGNvdW50OiAzIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3RpZGUgcG9vbHMgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgIGlkOiBgdGlkZS1wb29sczoke2FyZ3MuY2FyZElkfTpzdGFydFR1cm5gLFxuICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT5cbiAgICAgICAgICBjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gYXJncy5wbGF5ZXJJZCAmJiBhcmdzLm1hdGNoLnN0YXRzLnBsYXllZENhcmRzW2FyZ3MuY2FyZElkXS50dXJuTnVtYmVyIDwgYXJncy5tYXRjaC50dXJuTnVtYmVyLFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHRyaWdnZXJBcmdzKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt0aWRlIHBvb2xzIHRyaWdnZXJlZCBlZmZlY3RdIHNlbGVjdGluZyB0d28gY2FyZHMgdG8gZGlzY2FyZGApO1xuICAgICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBjYXJkc2AsXG4gICAgICAgICAgICByZXN0cmljdDogYXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBhcmdzLnBsYXllcklkKSxcbiAgICAgICAgICAgIGNvdW50OiAyXG4gICAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIHNlbGVjdGVkQ2FyZElkcykge1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkaXNjYXJkQ2FyZCcsIHtcbiAgICAgICAgICAgICAgY2FyZElkLFxuICAgICAgICAgICAgICBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZFxuICAgICAgICAgICAgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGNhcmRJZCB9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gICd0cmVhc3VyZS1tYXAnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoeyBydW5HYW1lQWN0aW9uRGVsZWdhdGUsIHBsYXllcklkLCBjYXJkSWQsIG1hdGNoLCBjYXJkTGlicmFyeSwgLi4uYXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3RyZWFzdXJlIG1hcCBlZmZlY3RdIHRyYXNoaW5nIHBsYXllZCB0cmVhc3VyZSBtYXAuLi5gKTtcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBhcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIHBsYXllcklkKTtcbiAgICAgIGNvbnN0IGluSGFuZCA9IGhhbmQuZmluZChjYXJkSWQgPT4gY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkSWQpLmNhcmRLZXkgPT09ICd0cmVhc3VyZS1tYXAnKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt0cmVhc3VyZSBtYXAgZWZmZWN0XSAke2luSGFuZCA/ICdhbm90aGVyIHRyZWFzdXJlIG1hcCBpcyBpbiBoYW5kJyA6ICdubyBvdGhlciB0cmVhc3VyZSBtYXAgaW4gaGFuZCd9Li4uYCk7XG4gICAgICBcbiAgICAgIGlmICghaW5IYW5kKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt0cmVhc3VyZSBtYXAgZWZmZWN0XSB0cmFzaGluZyB0cmVhc3VyZSBtYXAgZnJvbSBoYW5kLi4uYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndHJhc2hDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBpbkhhbmQsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZ29sZENhcmRJZHMgPSBhcmdzLmZpbmRDYXJkcyhbeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LCB7IGNhcmRLZXlzOiAnZ29sZCcgfV0pO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKGdvbGRDYXJkSWRzLmxlbmd0aCwgNCk7IGkrKykge1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogZ29sZENhcmRJZHMuc2xpY2UoLWkgLSAxKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRlY2snIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3RyZWFzdXJ5Jzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoeyByZWFjdGlvbk1hbmFnZXIgfSwgeyBjYXJkSWQgfSkgPT4ge1xuICAgICAgICByZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYHRyZWFzdXJ5OiR7Y2FyZElkfTplbmRUdXJuUGhhc2VgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChhcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3RyZWFzdXJ5IGVmZmVjdF0gZHJhd2luZyAxIGNhcmQuLi5gKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGFyZ3MucGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cnkgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uLi4uYCk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cnkgZWZmZWN0XSBnYWluaW5nIDEgdHJlYXN1cmUuLi5gKTtcbiAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYHRyZWFzdXJ5OiR7YXJncy5jYXJkSWR9OmVuZFR1cm5QaGFzZWAsXG4gICAgICAgIHBsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdlbmRUdXJuUGhhc2UnLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiAoY29uZGl0aW9uQXJncykgPT4ge1xuICAgICAgICAgIGlmIChnZXRUdXJuUGhhc2UoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGhhc2VJbmRleCkgIT09ICdidXknKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgdmljdG9yeUNhcmRzR2FpbmVkID0gT2JqZWN0LmVudHJpZXMoY29uZGl0aW9uQXJncy5tYXRjaC5zdGF0cy5jYXJkc0dhaW5lZClcbiAgICAgICAgICAgIC5maWx0ZXIoKFtpZCwgc3RhdHNdKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBzdGF0cy50dXJuTnVtYmVyID09PSBjb25kaXRpb25BcmdzLm1hdGNoLnR1cm5OdW1iZXIgJiZcbiAgICAgICAgICAgICAgICBjb25kaXRpb25BcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoK2lkKS50eXBlLmluY2x1ZGVzKCdWSUNUT1JZJyk7XG4gICAgICAgICAgICB9KS5tYXAocmVzdWx0cyA9PiBOdW1iZXIocmVzdWx0c1swXSkpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICh2aWN0b3J5Q2FyZHNHYWluZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gZ2V0Q3VycmVudFBsYXllcihhcmdzLm1hdGNoKS5pZCA9PT0gYXJncy5wbGF5ZXJJZFxuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgKHRyaWdnZXJBcmdzKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlckFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogYXJncy5jYXJkSWQsXG4gICAgICAgICAgICB0b1BsYXllcklkOiBhcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnd2FyZWhvdXNlJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKHsgcnVuR2FtZUFjdGlvbkRlbGVnYXRlLCBwbGF5ZXJJZCwgLi4uZWZmZWN0QXJncyB9KSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3dhcmVob3VzZSBlZmZlY3RdIGRyYXdpbmcgMyBjYXJkcy4uLmApO1xuICAgICAgYXdhaXQgcnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQsIGNvdW50OiAzIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3dhcmVob3VzZSBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb25zLi4uYCk7XG4gICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkSWRzID0gKGF3YWl0IHJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgcHJvbXB0OiAnRGlzY2FyZCBjYXJkcycsXG4gICAgICAgIHBsYXllcklkLFxuICAgICAgICByZXN0cmljdDogZWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBwbGF5ZXJJZCksXG4gICAgICAgIGNvdW50OiAzLFxuICAgICAgfSkpIGFzIG51bWJlcltdO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3dhcmVob3VzZSBlZmZlY3RdIGRpc2NhcmRpbmcgY2FyZHMuLi5gKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgY2FyZElkcykge1xuICAgICAgICBhd2FpdCBydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICBwbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICd3aGFyZic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKHsgcmVhY3Rpb25NYW5hZ2VyIH0sIHsgY2FyZElkIH0pID0+IHtcbiAgICAgICAgcmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGB3aGFyZjoke2NhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9LFxuICAgICAgb25DYXJkUGxheWVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGB3aGFyZjoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICAgIGNvbmRpdGlvbjogKGNvbmRpdGlvbkFyZ3MpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gZXZlbnRBcmdzLnBsYXllcklkICYmXG4gICAgICAgICAgICAgIGNvbmRpdGlvbkFyZ3MubWF0Y2guc3RhdHMucGxheWVkQ2FyZHNbZXZlbnRBcmdzLmNhcmRJZF0udHVybk51bWJlciA8IGNvbmRpdGlvbkFyZ3MubWF0Y2gudHVybk51bWJlclxuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jICh0cmlnZ2VyQXJncykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFt3aGFyZiB0cmlnZ2VyZWQgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHNgKTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgIGNvdW50OiAyXG4gICAgICAgICAgICB9LCB7IGxvZ2dpbmdDb250ZXh0OiB7IHNvdXJjZTogZXZlbnRBcmdzLmNhcmRJZCB9IH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3doYXJmIHRyaWdnZXJlZCBlZmZlY3RdIGdhaW5pbmcgMSBidXlgKTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzb3VyY2U6IGV2ZW50QXJncy5jYXJkSWQgfSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoYXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFt3aGFyZiBlZmZlY3RdIGRyYXdpbmcgMiBjYXJkcy4uLmApO1xuICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogYXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbd2hhcmYgZWZmZWN0XSBnYWluaW5nIDEgYnV5Li4uYCk7XG4gICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkJ1eScsIHsgY291bnQ6IDEgfSk7XG4g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
// denoCacheMetadata=2398188240879969637,9732324230244423732