import { findOrderedTargets } from '../../utils/find-ordered-targets.ts';
import { isLocationInPlay } from '../../utils/is-in-play.ts';
import { getPlayerStartingFrom } from '../../shared/get-player-position-utils.ts';
import { getCardsInPlay } from '../../utils/get-cards-in-play.ts';
import { getTurnPhase } from '../../utils/get-turn-phase.ts';
import { castArray } from 'es-toolkit/compat';
const addTravellerEffect = async (card, travelTo, context, eventArgs)=>{
  if (!isLocationInPlay(eventArgs.previousLocation?.location)) {
    return;
  }
  const newCards = context.findCards([
    {
      location: [
        'basicSupply',
        'kingdomSupply'
      ]
    },
    {
      cardKeys: travelTo
    }
  ]);
  if (!newCards.length) {
    console.log(`[${card.cardKey} onDiscarded effect] no ${travelTo} cards in supply`);
    return;
  }
  const newCard = newCards.slice(-1)[0];
  const result = await context.runGameActionDelegate('userPrompt', {
    playerId: eventArgs.playerId,
    prompt: `Exchange ${card.cardName} for ${newCard.cardName}?`,
    actionButtons: [
      {
        label: 'CANCEL',
        action: 1
      },
      {
        label: 'EXCHANGE',
        action: 2
      }
    ]
  });
  if (result.action === 1) {
    console.log(`[${card.cardKey} onDiscarded effect] user chose not to exchange`);
    return;
  }
  console.log(`[${card.cardKey} onDiscarded effect] moving ${card} back to supply`);
  await context.runGameActionDelegate('moveCard', {
    cardId: card.id,
    to: {
      location: 'kingdomSupply'
    }
  });
  console.log(`[${card.cardKey} onDiscarded effect] moving ${newCard} to discard pile`);
  await context.runGameActionDelegate('moveCard', {
    toPlayerId: eventArgs.playerId,
    cardId: newCard.id,
    to: {
      location: 'playerDiscard'
    }
  });
};
/**
 * Adds a system even for the start of the cleanup phase to move the card to the active duration zone so that it's not
 * discarded
 *
 * also registers the given trigger to actually run the duration card's effect
 *
 * WARNING make sure to move the card back to the play area when its duration effect has completed. Usually this
 * will be done at the start of the next turn, but not always.
 *
 * WARNING currently the reaction/trigger system doesn't hook into card lifecycle events. So when this card leaves play
 * the system doesn't currently auto-detect this and remove any triggers. so you must manually remove the trigger
 * in the onLeavePlay lifecycle hook of the card expansion
 */ export const addDurationEffect = (card, context, triggeredTemplate)=>{
  // register event for the cleanup phase to move the card to the activeDuration zone. This will leave it "in play,"
  // but will prevent it from being discarded
  context.reactionManager.registerSystemTemplate(card.id, 'startTurnPhase', {
    playerId: context.playerId,
    once: true,
    allowMultipleInstances: true,
    condition: async (conditionArgs)=>{
      if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'cleanup') return false;
      return true;
    },
    triggeredEffectFn: async (triggeredArgs)=>{
      console.log(`[${card.cardKey} duration effect] moving to activeDuration zone`);
      await triggeredArgs.runGameActionDelegate('moveCard', {
        cardId: card.id,
        to: {
          location: 'activeDuration'
        }
      });
    }
  });
  triggeredTemplate = castArray(triggeredTemplate);
  // register the trigger to run when the duration card triggers
  for (const triggeredTemplateElement of triggeredTemplate){
    context.reactionManager.registerReactionTemplate(triggeredTemplateElement);
  }
};
const expansion = {
  'amulet': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`amulet:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const actions = [
          {
            label: '+1 TREASURE',
            action: 1
          },
          {
            label: 'TRASH A CARD',
            action: 2
          },
          {
            label: 'GAIN A SILVER',
            action: 3
          }
        ];
        const decision = async ()=>{
          const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Choose one',
            actionButtons: actions
          });
          if (result.action === 1) {
            console.log(`[amulet effect] gaining 1 treasure`);
            await cardEffectArgs.runGameActionDelegate('gainTreasure', {
              count: 1
            });
          } else if (result.action === 2) {
            const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
            const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Trash card`,
              restrict: hand,
              count: 1
            });
            if (!selectedCardIds.length) {
              console.log(`[amulet effect] no card selected`);
            } else {
              const cardToTrash = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
              console.log(`[amulet effect] selected ${cardToTrash} to trash`);
              await cardEffectArgs.runGameActionDelegate('trashCard', {
                playerId: cardEffectArgs.playerId,
                cardId: cardToTrash.id
              });
            }
          } else {
            const silverCards = cardEffectArgs.findCards([
              {
                location: 'basicSupply'
              },
              {
                cardKeys: 'silver'
              }
            ]);
            if (!silverCards.length) {
              console.log(`[amulet effect] no silver cards in supply`);
            } else {
              const silverCardToGain = silverCards.slice(-1)[0];
              await cardEffectArgs.runGameActionDelegate('gainCard', {
                playerId: cardEffectArgs.playerId,
                cardId: silverCardToGain.id,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          }
        };
        await decision();
        const turnPlayed = cardEffectArgs.match.turnNumber;
        const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(card, cardEffectArgs, {
          id: `amulet:${cardEffectArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[amulet startTurn effect] re-running decision fn`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: card.id,
              to: {
                location: 'playArea'
              }
            });
            await decision();
          }
        });
      }
  },
  'artificer': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[artificer effect] drawing 1 card, gaining 1 action and 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        let selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Discard cards?`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: hand.length
          },
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[artificer effect] no cards selected`);
          return;
        }
        console.log(`[artificer effect] selected ${selectedCardIds.length} cards to discard`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardId
          });
        }
        const cardsToSelect = cardEffectArgs.findCards([
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
              treasure: selectedCardIds.length ?? 0
            }
          }
        ]);
        if (!cardsToSelect.length) {
          console.log(`[artificer effect] no cards in supply costing ${selectedCardIds.length ?? 0} treasure`);
          return;
        }
        selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain card`,
          restrict: cardsToSelect.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[artificer effect] no card selected`);
          return;
        }
        const cardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[artificer effect] selected ${cardToGain} to gain`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardToGain.id,
          to: {
            location: 'playerDeck'
          }
        });
      }
  },
  'caravan-guard': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`caravan-guard:${eventArgs.cardId}:startTurn`);
        },
        onLeaveHand: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`caravan-guard:${eventArgs.cardId}:cardPlayed`);
        },
        onEnterHand: async (args, eventArgs)=>{
          args.reactionManager.registerReactionTemplate({
            id: `caravan-guard:${eventArgs.cardId}:cardPlayed`,
            listeningFor: 'cardPlayed',
            playerId: eventArgs.playerId,
            once: false,
            compulsory: false,
            allowMultipleInstances: true,
            condition: async (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId === eventArgs.playerId) return false;
              const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!cardPlayed.type.includes('ATTACK')) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              console.log(`[caravan-guard cardPlayed effect] playing Caravan Guard`);
              await triggeredArgs.runGameActionDelegate('playCard', {
                playerId: eventArgs.playerId,
                cardId: eventArgs.cardId
              });
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[caravan-guard effect] drawing 1 card, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const turnPlayed = cardEffectArgs.match.turnNumber;
        const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(card, cardEffectArgs, {
          id: `caravan-guard:${cardEffectArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: card.id,
              to: {
                location: 'playArea'
              }
            });
            console.log(`[caravan-guard startTurn effect] gaining 1 treasure`);
            await triggeredArgs.runGameActionDelegate('gainTreasure', {
              count: 1
            });
          }
        });
      }
  },
  'champion': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`champion:${eventArgs.cardId}:cardPlayed:attack`);
          args.reactionManager.unregisterTrigger(`champion:${eventArgs.cardId}:cardPlayed:action`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(thisCard, cardEffectArgs, [
          {
            id: `champion:${thisCard.id}:cardPlayed:attack`,
            listeningFor: 'cardPlayed',
            playerId: cardEffectArgs.playerId,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: async (conditionArgs)=>{
              const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!playedCard.type.includes('ATTACK')) return false;
              if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              console.log(`[champion cardPlayed effect] attack played, gaining immunity`);
              return 'immunity';
            }
          },
          {
            id: `champion:${thisCard.id}:cardPlayed:action`,
            listeningFor: 'cardPlayed',
            playerId: cardEffectArgs.playerId,
            once: false,
            compulsory: true,
            allowMultipleInstances: false,
            condition: async (conditionArgs)=>{
              const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
              if (!playedCard.type.includes('ACTION')) return false;
              if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              console.log(`[champion cardPlayed effect] action played, gaining 1 action`);
              await triggeredArgs.runGameActionDelegate('gainAction', {
                count: 1
              }, {
                loggingContext: {
                  source: thisCard.id
                }
              });
            }
          }
        ]);
      }
  },
  'coin-of-the-realm': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[coin-of-the-realm effect] gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        console.log(`[coin-of-the-realm effect] moving card to tavern mat`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'tavern'
          }
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'cardPlayed', {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!cardPlayed.type.includes('ACTION')) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[coin-of-the-realm cardPlayed effect] calling back to play`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            console.log(`[coin-of-the-realm cardPlayed effect] gaining 2 actions`);
            await triggeredArgs.runGameActionDelegate('gainAction', {
              count: 2
            });
          }
        });
      }
  },
  'disciple': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'teacher', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const actionCardsInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('ACTION'));
        if (!actionCardsInHand.length) {
          console.log(`[disciple effect] no action cards in hand`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Play action card`,
          restrict: actionCardsInHand.map((card)=>card.id),
          count: 1,
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[disciple effect] no card selected`);
          return;
        }
        const selectedCardToPlay = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[disciple effect] playing ${selectedCardToPlay} twice`);
        for(let i = 0; i < 2; i++){
          await cardEffectArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardToPlay.id,
            overrides: {
              actionCost: 0
            }
          });
        }
        const copies = cardEffectArgs.findCards([
          {
            location: [
              'basicSupply',
              'kingdomSupply'
            ]
          },
          {
            cardKeys: selectedCardToPlay.cardKey
          }
        ]);
        if (!copies.length) {
          console.log(`[disciple effect] no copies of ${selectedCardToPlay} in supply`);
          return;
        }
        console.log(`[disciple effect] gaining ${selectedCardToPlay}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: copies.slice(-1)[0],
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'distant-lands': {
    registerScoringFunction: ()=>(args)=>{
        const distantLandCards = args.cardSourceController.getSource('tavern', args.ownerId).map(args.cardLibrary.getCard).filter((card)=>card.cardKey === 'distant-lands');
        console.log(`[distant-lands scoring function] number of distant lands on tavern mat ${distantLandCards.length} for player ${args.ownerId}`);
        return distantLandCards.length * 4;
      },
    registerEffects: ()=>async (cardEffectArgs)=>{
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[distant-lands effect] moving ${thisCard} to tavern mat`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'tavern'
          }
        });
      }
  },
  'dungeon': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`dungeon:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[dungeon effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const effects = async ()=>{
          console.log(`[dungeon effect] and drawing 2 cards`);
          await cardEffectArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2
          });
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Discard cards`,
            restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
            count: 2
          });
          if (!selectedCardIds.length) {
            console.log(`[dungeon effect] no cards selected`);
            return;
          }
          console.log(`[dungeon effect] discarding ${selectedCardIds.length} cards`);
          for (const selectedCardId of selectedCardIds){
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCardId
            });
          }
        };
        const turnPlayed = cardEffectArgs.match.turnNumber;
        await effects();
        const card = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(card, cardEffectArgs, {
          id: `dungeon:${cardEffectArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[dungeon startTurn effect] running`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: card.id,
              to: {
                location: 'playArea'
              }
            });
            await effects();
          }
        });
      }
  },
  'duplicate': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[duplicate effect] moving ${thisCard} to tavern mat`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'tavern'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'cardGained', {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            const cardGained = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            const { cost } = conditionArgs.cardPriceController.applyRules(cardGained, {
              playerId: cardEffectArgs.playerId
            });
            if (cost.treasure <= 6 && (!cost.potion || cost.potion <= 0)) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[duplicate cardGained] calling ${thisCard} to play area`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            const cardGained = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            const copies = triggeredArgs.findCards([
              {
                location: [
                  'basicSupply',
                  'kingdomSupply'
                ]
              },
              {
                cardKeys: cardGained.cardKey
              }
            ]);
            if (!copies.length) {
              console.log(`[duplicate cardGained], no copies of ${cardGained} in supply`);
              return;
            }
            const cardToGain = copies.slice(-1)[0];
            console.log(`[duplicate cardGained] gaining ${cardToGain}`);
            await cardEffectArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToGain.id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        });
      }
  },
  'fugitive': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'disciple', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[fugitive effect] drawing 2 cards and gaining 1 action`);
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
          console.log(`[fugitive effect] no card selected`);
          return;
        }
        const cardToDiscard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[fugitive effect] discarding ${cardToDiscard}`);
        await cardEffectArgs.runGameActionDelegate('discardCard', {
          playerId: cardEffectArgs.playerId,
          cardId: cardToDiscard.id
        });
      }
  },
  'gear': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`gear:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Set aside cards`,
          restrict: hand,
          count: {
            kind: 'upTo',
            count: Math.min(2, hand.length)
          },
          optional: true
        });
        if (!selectedCardIds.length) {
          console.log(`[gear effect] no cards selected`);
          return;
        }
        console.log(`[gear effect] set aside ${selectedCardIds.length} cards`);
        for (const selectedCardId of selectedCardIds){
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId: selectedCardId,
            to: {
              location: 'set-aside'
            }
          });
        }
        const turnPlayed = cardEffectArgs.match.turnNumber;
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(thisCard, cardEffectArgs, {
          id: `gear:${cardEffectArgs.cardId}:startTurn`,
          playerId: cardEffectArgs.playerId,
          listeningFor: 'startTurn',
          once: true,
          allowMultipleInstances: true,
          compulsory: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[gear startTurn effect] moving ${selectedCardIds.length} to hand`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            for (const selectedCardId of selectedCardIds){
              await cardEffectArgs.runGameActionDelegate('moveCard', {
                toPlayerId: cardEffectArgs.playerId,
                cardId: selectedCardId,
                to: {
                  location: 'playerHand'
                }
              });
            }
          }
        });
      }
  },
  'guide': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[guide effect] drawing 1 card, and gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[guide effect] moving ${thisCard} to tavern mat`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'tavern'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'startTurn', {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[guide startTurn effect] calling ${thisCard} to playArea`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
            console.log(`[guide startTurn effect] discarding hand`);
            for (const cardId of [
              ...hand
            ]){
              await triggeredArgs.runGameActionDelegate('discardCard', {
                playerId: cardEffectArgs.playerId,
                cardId
              });
            }
            console.log(`[guide startTurn effect] drawing 5 cards`);
            await triggeredArgs.runGameActionDelegate('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 5
            });
          }
        });
      }
  },
  'haunted-woods': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`haunted-woods:${eventArgs.cardId}:startTurn`);
          args.reactionManager.unregisterTrigger(`haunted-woods:${eventArgs.cardId}:cardGained`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const turnPlayed = cardEffectArgs.match.turnNumber;
        cardEffectArgs.reactionManager.registerReactionTemplate({
          id: `haunted-woods:${cardEffectArgs.cardId}:cardGained`,
          listeningFor: 'cardGained',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) return false;
            if (!conditionArgs.trigger.args.bought) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            const triggeringPlayerId = triggeredArgs.trigger.args.playerId;
            console.log(`[haunted-woods cardGained effect] player ${triggeringPlayerId} rearranging hand and top-decking`);
            const hand = triggeredArgs.cardSourceController.getSource('playerHand', triggeringPlayerId);
            const result = await triggeredArgs.runGameActionDelegate('userPrompt', {
              playerId: triggeringPlayerId,
              prompt: 'Rearrange hand to put on deck',
              actionButtons: [
                {
                  label: 'DONE',
                  action: 1
                }
              ],
              content: {
                type: 'rearrange',
                cardIds: hand
              }
            });
            if (!result.result.length) {
              console.warn(`[haunted-woods cardGained effect] no cards rearranged`);
              return;
            }
            console.warn(`[haunted-woods cardGained effect] moving ${result.result.length} cards to deck`);
            for (const cardId of result.result){
              await triggeredArgs.runGameActionDelegate('moveCard', {
                toPlayerId: triggeringPlayerId,
                cardId,
                to: {
                  location: 'playerDeck'
                }
              });
            }
          }
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(thisCard, cardEffectArgs, {
          id: `haunted-woods:${cardEffectArgs.cardId}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.trigger.args.turnNumber === turnPlayed) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            triggeredArgs.reactionManager.unregisterTrigger(`haunted-woods:${cardEffectArgs.cardId}:cardGained`);
            await triggeredArgs.runGameActionDelegate('drawCard', {
              playerId: cardEffectArgs.playerId,
              count: 2
            });
          }
        });
      }
  },
  'hero': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'champion', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[hero effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const treasureCards = cardEffectArgs.findCards([
          {
            location: [
              'basicSupply',
              'kingdomSupply'
            ]
          },
          {
            cardType: 'TREASURE'
          }
        ]);
        if (!treasureCards.length) {
          console.log(`[hero effect] no treasure cards in supply`);
          return;
        }
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Gain treasure`,
          restrict: treasureCards.map((card)=>card.id),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[hero effect] no card selected`);
          return;
        }
        const selectedCardToGain = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[hero effect] gaining ${selectedCardToGain}`);
        await cardEffectArgs.runGameActionDelegate('gainCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCardToGain.id,
          to: {
            location: 'playerDiscard'
          }
        });
      }
  },
  'hireling': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          args.reactionManager.unregisterTrigger(`hireling:${eventArgs.cardId}:startTurn`);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        addDurationEffect(thisCard, cardEffectArgs, {
          id: `hireling:${thisCard.id}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: false,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.trigger.args.turnNumber === conditionArgs.match.turnNumber) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[hireling startTurn effect] drawing 1 card`);
            await triggeredArgs.runGameActionDelegate('drawCard', {
              playerId: cardEffectArgs.playerId
            });
          }
        });
      }
  },
  'lost-city': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const targetPlayerIds = findOrderedTargets({
            match: args.match,
            appliesTo: 'ALL_OTHER',
            startingPlayerId: eventArgs.playerId
          });
          for (const targetPlayerId of targetPlayerIds){
            console.log(`[lost-city onGained effect] ${targetPlayerId} drawing 1 card`);
            await args.runGameActionDelegate('drawCard', {
              playerId: targetPlayerId
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
      }
  },
  'magpie': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[magpie effect] drawing 1 card, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (deck.length) {
          console.log(`[magpie effect] no cards in deck, shuffling deck`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
          if (!deck.length) {
            console.log(`[magpie effect] still no cards in deck, no cards to reveal`);
            return;
          }
        }
        const revealedCard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
        console.log(`[magpie effect] revealing ${revealedCard}`);
        await cardEffectArgs.runGameActionDelegate('revealCard', {
          playerId: cardEffectArgs.playerId,
          cardId: revealedCard,
          moveToSetAside: true
        });
        if (revealedCard.type.includes('TREASURE')) {
          console.log(`[magpie effect] treasure revealed, moving revealed card to hand`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId: revealedCard.id,
            to: {
              location: 'playerHand'
            }
          });
        } else if (revealedCard.type.some((t)=>[
            'ACTION',
            'VICTORY'
          ].includes(t))) {
          console.log(`[magpie effect] action or victory revealed, gaining magpie`);
          const magpieCards = cardEffectArgs.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              cardKeys: 'magpie'
            }
          ]);
          if (!magpieCards.length) {
            console.log(`[magpie effect] no magpie cards in supply`);
            return;
          }
          const magPieToGain = magpieCards.slice(-1)[0];
          console.log(`[magpie effect] gaining ${magPieToGain}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: magPieToGain.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'messenger': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const stats = args.match.stats;
          if (stats.cardsGained?.[eventArgs.cardId]?.turnPhase !== 'buy') {
            return;
          }
          const cardsGainedThisTurnBuyPhase = stats.cardsGainedByTurn?.[args.match.turnNumber]?.filter((cardId)=>stats.cardsGained[cardId].playerId === eventArgs.playerId && stats.cardsGained[cardId].turnPhase === 'buy')?.length ?? 0;
          if (cardsGainedThisTurnBuyPhase !== 1) {
            console.log(`[messenger onGained effect] player ${eventArgs.playerId} gained more than 1 card in buy phase`);
            return;
          }
          const selectedCardIds = await args.runGameActionDelegate('selectCard', {
            playerId: eventArgs.playerId,
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
                playerId: eventArgs.playerId,
                amount: {
                  treasure: 4
                }
              }
            ],
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[messenger onGained effect] no card selected`);
            return;
          }
          const selectedCard = args.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[messenger onGained effect] selected ${selectedCard}`);
          const copies = args.findCards([
            {
              location: [
                'basicSupply',
                'kingdomSupply'
              ]
            },
            {
              cardKeys: selectedCard.cardKey
            }
          ]);
          const targetPlayerIds = findOrderedTargets({
            match: args.match,
            appliesTo: 'ALL',
            startingPlayerId: eventArgs.playerId
          });
          targetPlayerIds.length = Math.min(targetPlayerIds.length, copies.length);
          for(let i = 0; i < targetPlayerIds.length; i++){
            console.log(`[messenger onGained effect] gaining ${copies.slice(-i - 1)[0]} to ${targetPlayerIds[i]}`);
            await args.runGameActionDelegate('gainCard', {
              playerId: targetPlayerIds[i],
              cardId: copies.slice(-i - 1)[0].id,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[messenger effect] drawing 1 card, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Put deck into your discard?',
          actionButtons: [
            {
              label: 'CANCEL',
              action: 1
            },
            {
              label: 'PUT IN DISCARD',
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[messenger effect] user cancelled`);
          return;
        } else {
          console.log(`[messenger effect] putting deck into discard`);
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
          for (const cardId of [
            ...deck
          ]){
            await cardEffectArgs.runGameActionDelegate('moveCard', {
              toPlayerId: cardEffectArgs.playerId,
              cardId,
              to: {
                location: 'playerDiscard'
              }
            });
          }
        }
      }
  },
  'miser': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        const copperCardsOnTreasureMat = cardEffectArgs.findCards([
          {
            location: 'tavern',
            playerId: cardEffectArgs.playerId
          },
          {
            cardKeys: 'copper'
          }
        ]);
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one',
          actionButtons: [
            {
              label: 'PUT COPPER ON TAVERN',
              action: 1
            },
            {
              label: `+${copperCardsOnTreasureMat.length} TREASURE`,
              action: 2
            }
          ]
        });
        if (result.action === 1) {
          console.log(`[miser effect] putting copper on tavern`);
          const coppersInHand = cardEffectArgs.findCards([
            {
              location: 'playerHand',
              playerId: cardEffectArgs.playerId
            },
            {
              cardKeys: 'copper'
            }
          ]);
          if (!coppersInHand.length) {
            console.log(`[miser effect] no coppers in hand`);
            return;
          }
          console.log(`[miser effect] moving ${coppersInHand[0]} to tavern`);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId: coppersInHand[0].id,
            to: {
              location: 'tavern'
            }
          });
        } else {
          console.log(`[miser effect] gaining ${copperCardsOnTreasureMat.length} treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', {
            count: copperCardsOnTreasureMat.length
          });
        }
      }
  },
  'page': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'treasure-hunter', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[page effect] drawing 1 card, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
      }
  },
  'peasant': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'soldier', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[peasant effect] gaining 1 buy, and 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
      }
  },
  'port': {
    registerLifeCycleMethods: ()=>({
        onGained: async (args, eventArgs)=>{
          const portCards = args.findCards([
            {
              location: 'kingdomSupply'
            },
            {
              cardKeys: 'port'
            }
          ]);
          if (!portCards.length) {
            console.log(`[port onGained effect] no port cards in supply`);
            return;
          }
          const portToGain = portCards.slice(-1)[0];
          console.log(`[port onGained effect] gaining ${portToGain}`);
          await args.runGameActionDelegate('gainCard', {
            playerId: eventArgs.playerId,
            cardId: portToGain.id,
            to: {
              location: 'playerDiscard'
            }
          }, {
            suppressLifeCycle: {
              events: [
                'onGained'
              ]
            }
          });
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[port effect] drawing 1 card, gaining 2 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 2
        });
      }
  },
  'raze': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[raze effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
          playerId: cardEffectArgs.playerId,
          prompt: `Trash a card`,
          restrict: cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId).concat(cardEffectArgs.cardId),
          count: 1
        });
        if (!selectedCardIds.length) {
          console.warn(`[raze effect] no card selected`);
          return;
        }
        const selectedCard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
        console.log(`[raze effect] trashing ${selectedCard}`);
        await cardEffectArgs.runGameActionDelegate('trashCard', {
          playerId: cardEffectArgs.playerId,
          cardId: selectedCard.id
        });
        const { cost } = cardEffectArgs.cardPriceController.applyRules(selectedCard, {
          playerId: cardEffectArgs.playerId
        });
        const numToLookAt = cost.treasure;
        if (numToLookAt === 0) {
          console.log(`[raze effect] cost is 0, not looking at deck`);
          return;
        }
        const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
        if (deck.length === 0) {
          console.log(`[raze effect] deck is empty, shuffling deck`);
          await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
            playerId: cardEffectArgs.playerId
          });
          if (deck.length === 0) {
            console.log(`[raze effect] still empty, no cards to look at`);
            return;
          }
        }
        const lookingAtCards = [];
        for(let i = 0; i < numToLookAt; i++){
          const cardToLookAt = cardEffectArgs.cardLibrary.getCard(deck.slice(-i - 1)[0]);
          console.log(`[raze effect] looking at ${cardToLookAt}`);
          lookingAtCards.push(cardToLookAt);
          await cardEffectArgs.runGameActionDelegate('moveCard', {
            toPlayerId: cardEffectArgs.playerId,
            cardId: cardToLookAt.id,
            to: {
              location: 'set-aside'
            }
          });
        }
        const result = await cardEffectArgs.runGameActionDelegate('userPrompt', {
          playerId: cardEffectArgs.playerId,
          prompt: 'Choose one to put in hand',
          actionButtons: [
            {
              label: 'DONE',
              action: 1
            }
          ],
          content: {
            type: 'select',
            cardIds: lookingAtCards.map((card)=>card.id),
            selectCount: 1
          }
        });
        if (!result.result.length) {
          console.warn(`[raze effect] no card selected`);
          return;
        }
        const selectedCardToPutInHand = cardEffectArgs.cardLibrary.getCard(result.result[0]);
        console.log(`[raze effect] putting ${selectedCardToPutInHand} in hand`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: selectedCardToPutInHand.id,
          to: {
            location: 'playerHand'
          }
        });
        console.log(`[raze effect] discarding ${lookingAtCards.length - 1} cards`);
        for (const lookingAtCard of lookingAtCards){
          if (lookingAtCard.id === selectedCardToPutInHand.id) continue;
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: lookingAtCard.id
          });
        }
      }
  },
  'ratcatcher': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[ratcatcher effect] drawing 1 card, gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[ratcatcher effect] moving ${thisCard} to play area`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'tavern'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'startTurn', {
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          playerId: cardEffectArgs.playerId,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[ratcatcher startTurn effect] calling ${thisCard} to playArea`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Trash card`,
              restrict: triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId),
              count: 1
            });
            if (!selectedCardIds.length) {
              console.log(`[ratcatcher startTurn effect] no cards selected`);
              return;
            }
            const selectedCard = triggeredArgs.cardLibrary.getCard(selectedCardIds[0]);
            console.log(`[ratcatcher startTurn effect] trashing ${selectedCard}`);
            await triggeredArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: selectedCard.id
            });
          }
        });
      }
  },
  'royal-carriage': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[royal-carriage effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[royal-carriage effect] moving ${thisCard} to tavern`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: cardEffectArgs.cardId,
          to: {
            location: 'tavern'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'afterCardPlayed', {
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          playerId: cardEffectArgs.playerId,
          condition: async (conditionArgs)=>{
            const cardPlayed = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
            if (!cardPlayed.type.includes('ACTION')) return false;
            if (!getCardsInPlay(conditionArgs.findCards).includes(cardPlayed)) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            const cardToPlay = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
            console.log(`[royal-carriage afterCardPlayed effect] calling ${thisCard} to playArea`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            console.log(`[royal-carriage afterCardPlayed effect] re-playing ${cardToPlay}`);
            await triggeredArgs.runGameActionDelegate('playCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToPlay.id,
              overrides: {
                actionCost: 0
              }
            });
          }
        });
      }
  },
  'soldier': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'fugitive', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[soldier effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const attacksInPlay = getCardsInPlay(cardEffectArgs.findCards).filter((card)=>card.owner === cardEffectArgs.playerId && card.type.includes('ATTACK'));
        if (attacksInPlay.length > 0) {
          console.log(`[soldier effect] ${attacksInPlay.length} attacks in play, gaining that much treasure`);
          await cardEffectArgs.runGameActionDelegate('gainTreasure', {
            count: attacksInPlay.length
          });
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>{
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', playerId);
          return cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity' && hand.length >= 4;
        });
        for (const targetPlayerId of targetPlayerIds){
          const hand = cardEffectArgs.cardSourceController.getSource('playerHand', targetPlayerId);
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: targetPlayerId,
            prompt: `Discard card`,
            restrict: hand,
            count: 1
          });
          if (!selectedCardIds.length) {
            console.warn(`[soldier effect] no card selected`);
            continue;
          }
          const cardToDiscard = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[soldier effect] player ${targetPlayerId} discarding ${cardToDiscard}`);
          await cardEffectArgs.runGameActionDelegate('discardCard', {
            playerId: targetPlayerId,
            cardId: cardToDiscard.id
          });
        }
      }
  },
  'storyteller': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[storyteller effect] gaining 1 action`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const hand = cardEffectArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
        let treasuresInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE'));
        const numCanPlay = Math.min(3, treasuresInHand.length);
        for(let i = 0; i < numCanPlay; i++){
          treasuresInHand = hand.map(cardEffectArgs.cardLibrary.getCard).filter((card)=>card.type.includes('TREASURE'));
          if (!treasuresInHand.length) {
            console.log(`[storyteller effect] no treasures in hand`);
            break;
          }
          const selectedCardIds = await cardEffectArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: `Play treasure ${i + 1} of ${numCanPlay}?`,
            restrict: treasuresInHand.map((card)=>card.id),
            count: 1,
            optional: true
          });
          if (!selectedCardIds.length) {
            console.log(`[storyteller effect] no treasure selected`);
            break;
          }
          const selectedToPlay = cardEffectArgs.cardLibrary.getCard(selectedCardIds[0]);
          console.log(`[storyteller effect] playing ${selectedToPlay}`);
          await cardEffectArgs.runGameActionDelegate('playCard', {
            cardId: selectedCardIds[0],
            playerId: cardEffectArgs.playerId
          });
        }
        console.log(`[storyteller effect] drawing 1 card`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId
        });
        const playerTreasure = cardEffectArgs.match.playerTreasure;
        if (playerTreasure === 0) {
          console.log(`[storyteller effect] no player treasure, not drawing more cards`);
          return;
        }
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: -playerTreasure
        }, {
          loggingContext: {
            suppress: true
          }
        });
        console.log(`[storyteller effect] drawing ${playerTreasure} cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: playerTreasure
        });
      }
  },
  'swamp-hag': {
    registerLifeCycleMethods: ()=>({
        onLeavePlay: async (args, eventArgs)=>{
          const thisCard = args.cardLibrary.getCard(eventArgs.cardId);
          for (const player of args.match.players){
            args.reactionManager.unregisterTrigger(`swamp-hag:${thisCard.id}:cardGained:${player.id}`);
          }
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        const ids = [];
        addDurationEffect(thisCard, cardEffectArgs, {
          id: `swamp-hag:${thisCard.id}:startTurn`,
          listeningFor: 'startTurn',
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: true,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.turnNumber === conditionArgs.match.turnNumber) return false;
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            for (const id of ids){
              triggeredArgs.reactionManager.unregisterTrigger(id);
            }
            console.log(`[swamp-hag startTurn effect] gaining 3 treasure`);
            await triggeredArgs.runGameActionDelegate('gainTreasure', {
              count: 3
            });
          }
        });
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const id = `swamp-hag:${thisCard.id}:cardGained:${targetPlayerId}`;
          ids.push(id);
          cardEffectArgs.reactionManager.registerReactionTemplate({
            id,
            listeningFor: 'cardGained',
            playerId: targetPlayerId,
            once: false,
            allowMultipleInstances: true,
            compulsory: true,
            condition: async (conditionArgs)=>{
              if (conditionArgs.trigger.args.playerId !== targetPlayerId) return false;
              if (!conditionArgs.trigger.args.bought) return false;
              return true;
            },
            triggeredEffectFn: async (triggeredArgs)=>{
              const curseCards = triggeredArgs.findCards([
                {
                  location: 'basicSupply'
                },
                {
                  cardKeys: 'curse'
                }
              ]);
              if (!curseCards.length) {
                console.log(`[swamp-hag cardGained effect] no curse cards in supply`);
                return;
              }
              console.log(`[swamp-hag cardGained effect] player ${targetPlayerId} gaining ${curseCards.slice(-1)[0]}`);
              await triggeredArgs.runGameActionDelegate('gainCard', {
                playerId: targetPlayerId,
                cardId: curseCards.slice(-1)[0].id,
                to: {
                  location: 'playerDiscard'
                }
              });
            }
          });
        }
      }
  },
  'transmogrify': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: thisCard.id,
          to: {
            location: 'tavern'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'startTurn', {
          playerId: cardEffectArgs.playerId,
          once: true,
          allowMultipleInstances: true,
          compulsory: false,
          condition: async (conditionArgs)=>{
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[transmogrify startTurn effect] calling ${thisCard} to playArea`);
            await triggeredArgs.runGameActionDelegate('moveCard', {
              cardId: thisCard.id,
              to: {
                location: 'playArea'
              }
            });
            const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
            let selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Trash card`,
              restrict: hand,
              count: 1
            });
            if (!selectedCardIds.length) {
              console.warn(`[transmogrify startTurn effect] no card selected`);
              return;
            }
            const cardToTrash = triggeredArgs.cardLibrary.getCard(selectedCardIds[0]);
            await triggeredArgs.runGameActionDelegate('trashCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToTrash.id
            });
            const { cost } = triggeredArgs.cardPriceController.applyRules(cardToTrash, {
              playerId: cardEffectArgs.playerId
            });
            const cards = triggeredArgs.findCards([
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
                  treasure: cost.treasure + 1,
                  potion: cost.potion
                }
              }
            ]);
            if (!cards.length) {
              console.log(`[transmogrify startTurn effect] no cards costing less than ${cost.treasure + 1} treasure and ${cost.potion} potions`);
              return;
            }
            selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
              playerId: cardEffectArgs.playerId,
              prompt: `Gain card`,
              restrict: cards.map((card)=>card.id),
              count: 1
            });
            if (!selectedCardIds.length) {
              console.warn(`[transmogrify startTurn effect] no cards selected to gain`);
              return;
            }
            const cardToGain = triggeredArgs.cardLibrary.getCard(selectedCardIds[0]);
            console.warn(`[transmogrify startTurn effect] gaining ${cardToGain} to hand`);
            await triggeredArgs.runGameActionDelegate('gainCard', {
              playerId: cardEffectArgs.playerId,
              cardId: cardToGain.id,
              to: {
                location: 'playerHand'
              }
            });
          }
        });
      }
  },
  'treasure-hunter': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'warrior', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[treasure-hunter effect] gaining 1 action, gaining 1 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainAction', {
          count: 1
        });
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 1
        });
        const silverCards = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: 'silver'
          }
        ]);
        if (!silverCards.length) {
          console.log(`[treasure-hunter effect] no silver cards in supply`);
          return;
        }
        const rightPlayer = getPlayerStartingFrom({
          startFromIdx: cardEffectArgs.match.currentPlayerTurnIndex,
          match: cardEffectArgs.match,
          distance: -1
        });
        const cardsGained = cardEffectArgs.match.stats.cardsGainedByTurn?.[cardEffectArgs.match.turnNumber]?.map(cardEffectArgs.cardLibrary.getCard)?.filter((card)=>card.owner === rightPlayer.id) ?? [];
        const numToGain = Math.min(silverCards.length, cardsGained.length);
        for(let i = 0; i < numToGain; i++){
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: silverCards.slice(-i - 1)[0].id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'treasure-trove': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[treasure-trove effect] gaining 2 treasure`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 2
        });
        const goldAndCopperCards = cardEffectArgs.findCards([
          {
            location: 'basicSupply'
          },
          {
            cardKeys: [
              'gold',
              'copper'
            ]
          }
        ]);
        const [goldCards, copperCards] = goldAndCopperCards.reduce((acc, nextCard)=>{
          if (nextCard.cardKey === 'gold') {
            acc[0].push(nextCard);
          } else {
            acc[1].push(nextCard);
          }
          return acc;
        }, [
          [],
          []
        ]);
        if (!goldCards.length) {
          console.log(`[treasure-trove effect] no gold cards in supply`);
        } else {
          const goldCardToGain = goldCards.slice(-1)[0];
          console.log(`[treasure-trove effect] gaining ${goldCardToGain}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: goldCardToGain.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
        if (!copperCards.length) {
          console.log(`[treasure-trove effect] no copper cards in supply`);
        } else {
          const copperCardToGain = copperCards.slice(-1)[0];
          console.log(`[treasure-trove effect] gaining ${copperCardToGain}`);
          await cardEffectArgs.runGameActionDelegate('gainCard', {
            playerId: cardEffectArgs.playerId,
            cardId: copperCardToGain.id,
            to: {
              location: 'playerDiscard'
            }
          });
        }
      }
  },
  'warrior': {
    registerLifeCycleMethods: ()=>({
        onDiscarded: async (args, eventArgs)=>{
          const card = args.cardLibrary.getCard(eventArgs.cardId);
          await addTravellerEffect(card, 'hero', args, eventArgs);
        }
      }),
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[warrior effect] drawing 2 cards`);
        await cardEffectArgs.runGameActionDelegate('drawCard', {
          playerId: cardEffectArgs.playerId,
          count: 2
        });
        const travellersInPlay = getCardsInPlay(cardEffectArgs.findCards).filter((card)=>card.owner === cardEffectArgs.playerId && card.type.includes('TRAVELLER'));
        if (!travellersInPlay.length) {
          console.log(`[warrior effect] no travellers in play`);
          return;
        }
        const targetPlayerIds = findOrderedTargets({
          match: cardEffectArgs.match,
          appliesTo: 'ALL_OTHER',
          startingPlayerId: cardEffectArgs.playerId
        }).filter((playerId)=>cardEffectArgs.reactionContext?.[playerId]?.result !== 'immunity');
        for (const targetPlayerId of targetPlayerIds){
          const deck = cardEffectArgs.cardSourceController.getSource('playerDeck', targetPlayerId);
          for(let i = 0; i < travellersInPlay.length; i++){
            if (deck.length === 0) {
              console.log(`[warrior effect] no cards in deck, shuffling`);
              await cardEffectArgs.runGameActionDelegate('shuffleDeck', {
                playerId: cardEffectArgs.playerId
              });
              if (deck.length === 0) {
                console.log(`[warrior effect] still empty, no cards to look at`);
                break;
              }
            }
            const cardToDiscard = cardEffectArgs.cardLibrary.getCard(deck.slice(-1)[0]);
            console.log(`[warrior effect] discarding ${cardToDiscard}`);
            await cardEffectArgs.runGameActionDelegate('discardCard', {
              playerId: targetPlayerId,
              cardId: cardToDiscard.id
            });
            const { cost } = cardEffectArgs.cardPriceController.applyRules(cardToDiscard, {
              playerId: cardEffectArgs.playerId
            });
            if (cost.treasure === 3 || cost.treasure === 4) {
              console.log(`[warrior effect] card costs 3 or 3, trashing ${cardToDiscard}`);
              await cardEffectArgs.runGameActionDelegate('trashCard', {
                playerId: targetPlayerId,
                cardId: cardToDiscard.id
              });
            }
          }
        }
      }
  },
  'wine-merchant': {
    registerEffects: ()=>async (cardEffectArgs)=>{
        console.log(`[wine-merchant effect] gaining 4 treasure, and 1 buy`);
        await cardEffectArgs.runGameActionDelegate('gainTreasure', {
          count: 4
        });
        await cardEffectArgs.runGameActionDelegate('gainBuy', {
          count: 1
        });
        const thisCard = cardEffectArgs.cardLibrary.getCard(cardEffectArgs.cardId);
        console.log(`[wine-merchant effect] moving ${thisCard} to tavern`);
        await cardEffectArgs.runGameActionDelegate('moveCard', {
          toPlayerId: cardEffectArgs.playerId,
          cardId: thisCard.id,
          to: {
            location: 'tavern'
          }
        });
        cardEffectArgs.reactionManager.registerReactionTemplate(thisCard.id, 'endTurnPhase', {
          playerId: cardEffectArgs.playerId,
          once: true,
          compulsory: false,
          allowMultipleInstances: true,
          condition: async (conditionArgs)=>{
            if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') return false;
            if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) return false;
            if (conditionArgs.match.playerTreasure < 2) return false;
            return true;
          },
          triggeredEffectFn: async (triggeredArgs)=>{
            console.log(`[wine-merchant endTurnPhase effect] discarding ${thisCard}`);
            await triggeredArgs.runGameActionDelegate('discardCard', {
              playerId: cardEffectArgs.playerId,
              cardId: thisCard.id
            });
          }
        });
      }
  }
};
export default expansion;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vYXBwL3NlcnZlci9zcmMvZXhwYW5zaW9ucy9hZHZlbnR1cmVzL2NhcmQtZWZmZWN0cy1hZHZlbnR1cmVzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENhcmQsIENhcmRJZCwgQ2FyZEtleSB9IGZyb20gJ3NoYXJlZC9zaGFyZWQtdHlwZXMudHMnO1xuaW1wb3J0IHtcbiAgQ2FyZEVmZmVjdEZ1bmN0aW9uQ29udGV4dCxcbiAgQ2FyZEV4cGFuc2lvbk1vZHVsZSxcbiAgQ2FyZExpZmVjeWNsZUNhbGxiYWNrQ29udGV4dCxcbiAgQ2FyZExpZmVjeWNsZUV2ZW50QXJnTWFwLFxuICBSZWFjdGlvblRlbXBsYXRlLFxuICBUcmlnZ2VyRXZlbnRUeXBlXG59IGZyb20gJy4uLy4uL3R5cGVzLnRzJztcbmltcG9ydCB7IGZpbmRPcmRlcmVkVGFyZ2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2ZpbmQtb3JkZXJlZC10YXJnZXRzLnRzJztcbmltcG9ydCB7IGlzTG9jYXRpb25JblBsYXkgfSBmcm9tICcuLi8uLi91dGlscy9pcy1pbi1wbGF5LnRzJztcbmltcG9ydCB7IGdldFBsYXllclN0YXJ0aW5nRnJvbSB9IGZyb20gJy4uLy4uL3NoYXJlZC9nZXQtcGxheWVyLXBvc2l0aW9uLXV0aWxzLnRzJztcbmltcG9ydCB7IGdldENhcmRzSW5QbGF5IH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LWNhcmRzLWluLXBsYXkudHMnO1xuaW1wb3J0IHsgZ2V0VHVyblBoYXNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2V0LXR1cm4tcGhhc2UudHMnO1xuaW1wb3J0IHsgY2FzdEFycmF5IH0gZnJvbSAnZXMtdG9vbGtpdC9jb21wYXQnO1xuXG5jb25zdCBhZGRUcmF2ZWxsZXJFZmZlY3QgPSBhc3luYyAoY2FyZDogQ2FyZCwgdHJhdmVsVG86IENhcmRLZXksIGNvbnRleHQ6IENhcmRMaWZlY3ljbGVDYWxsYmFja0NvbnRleHQsIGV2ZW50QXJnczogQ2FyZExpZmVjeWNsZUV2ZW50QXJnTWFwWydvbkRpc2NhcmRlZCddKSA9PiB7XG4gIGlmICghaXNMb2NhdGlvbkluUGxheShldmVudEFyZ3MucHJldmlvdXNMb2NhdGlvbj8ubG9jYXRpb24pKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIFxuICBjb25zdCBuZXdDYXJkcyA9IGNvbnRleHQuZmluZENhcmRzKFtcbiAgICB7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LFxuICAgIHsgY2FyZEtleXM6IHRyYXZlbFRvIH1cbiAgXSk7XG4gIFxuICBpZiAoIW5ld0NhcmRzLmxlbmd0aCkge1xuICAgIGNvbnNvbGUubG9nKGBbJHtjYXJkLmNhcmRLZXl9IG9uRGlzY2FyZGVkIGVmZmVjdF0gbm8gJHt0cmF2ZWxUb30gY2FyZHMgaW4gc3VwcGx5YCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIFxuICBjb25zdCBuZXdDYXJkID0gbmV3Q2FyZHMuc2xpY2UoLTEpWzBdO1xuICBcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29udGV4dC5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICBwcm9tcHQ6IGBFeGNoYW5nZSAke2NhcmQuY2FyZE5hbWV9IGZvciAke25ld0NhcmQuY2FyZE5hbWV9P2AsXG4gICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgeyBsYWJlbDogJ0NBTkNFTCcsIGFjdGlvbjogMSB9LFxuICAgICAgeyBsYWJlbDogJ0VYQ0hBTkdFJywgYWN0aW9uOiAyIH1cbiAgICBdLFxuICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gIFxuICBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMSkge1xuICAgIGNvbnNvbGUubG9nKGBbJHtjYXJkLmNhcmRLZXl9IG9uRGlzY2FyZGVkIGVmZmVjdF0gdXNlciBjaG9zZSBub3QgdG8gZXhjaGFuZ2VgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgXG4gIGNvbnNvbGUubG9nKGBbJHtjYXJkLmNhcmRLZXl9IG9uRGlzY2FyZGVkIGVmZmVjdF0gbW92aW5nICR7Y2FyZH0gYmFjayB0byBzdXBwbHlgKTtcbiAgXG4gIGF3YWl0IGNvbnRleHQucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgdG86IHsgbG9jYXRpb246ICdraW5nZG9tU3VwcGx5JyB9XG4gIH0pO1xuICBcbiAgY29uc29sZS5sb2coYFske2NhcmQuY2FyZEtleX0gb25EaXNjYXJkZWQgZWZmZWN0XSBtb3ZpbmcgJHtuZXdDYXJkfSB0byBkaXNjYXJkIHBpbGVgKTtcbiAgXG4gIGF3YWl0IGNvbnRleHQucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICB0b1BsYXllcklkOiBldmVudEFyZ3MucGxheWVySWQsXG4gICAgY2FyZElkOiBuZXdDYXJkLmlkLFxuICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBBZGRzIGEgc3lzdGVtIGV2ZW4gZm9yIHRoZSBzdGFydCBvZiB0aGUgY2xlYW51cCBwaGFzZSB0byBtb3ZlIHRoZSBjYXJkIHRvIHRoZSBhY3RpdmUgZHVyYXRpb24gem9uZSBzbyB0aGF0IGl0J3Mgbm90XG4gKiBkaXNjYXJkZWRcbiAqXG4gKiBhbHNvIHJlZ2lzdGVycyB0aGUgZ2l2ZW4gdHJpZ2dlciB0byBhY3R1YWxseSBydW4gdGhlIGR1cmF0aW9uIGNhcmQncyBlZmZlY3RcbiAqXG4gKiBXQVJOSU5HIG1ha2Ugc3VyZSB0byBtb3ZlIHRoZSBjYXJkIGJhY2sgdG8gdGhlIHBsYXkgYXJlYSB3aGVuIGl0cyBkdXJhdGlvbiBlZmZlY3QgaGFzIGNvbXBsZXRlZC4gVXN1YWxseSB0aGlzXG4gKiB3aWxsIGJlIGRvbmUgYXQgdGhlIHN0YXJ0IG9mIHRoZSBuZXh0IHR1cm4sIGJ1dCBub3QgYWx3YXlzLlxuICpcbiAqIFdBUk5JTkcgY3VycmVudGx5IHRoZSByZWFjdGlvbi90cmlnZ2VyIHN5c3RlbSBkb2Vzbid0IGhvb2sgaW50byBjYXJkIGxpZmVjeWNsZSBldmVudHMuIFNvIHdoZW4gdGhpcyBjYXJkIGxlYXZlcyBwbGF5XG4gKiB0aGUgc3lzdGVtIGRvZXNuJ3QgY3VycmVudGx5IGF1dG8tZGV0ZWN0IHRoaXMgYW5kIHJlbW92ZSBhbnkgdHJpZ2dlcnMuIHNvIHlvdSBtdXN0IG1hbnVhbGx5IHJlbW92ZSB0aGUgdHJpZ2dlclxuICogaW4gdGhlIG9uTGVhdmVQbGF5IGxpZmVjeWNsZSBob29rIG9mIHRoZSBjYXJkIGV4cGFuc2lvblxuICovXG5leHBvcnQgY29uc3QgYWRkRHVyYXRpb25FZmZlY3QgPSA8VCBleHRlbmRzIFRyaWdnZXJFdmVudFR5cGU+KGNhcmQ6IENhcmQsIGNvbnRleHQ6IENhcmRFZmZlY3RGdW5jdGlvbkNvbnRleHQsIHRyaWdnZXJlZFRlbXBsYXRlOiBSZWFjdGlvblRlbXBsYXRlPFQ+IHwgUmVhY3Rpb25UZW1wbGF0ZTxUPltdKSA9PiB7XG4gIC8vIHJlZ2lzdGVyIGV2ZW50IGZvciB0aGUgY2xlYW51cCBwaGFzZSB0byBtb3ZlIHRoZSBjYXJkIHRvIHRoZSBhY3RpdmVEdXJhdGlvbiB6b25lLiBUaGlzIHdpbGwgbGVhdmUgaXQgXCJpbiBwbGF5LFwiXG4gIC8vIGJ1dCB3aWxsIHByZXZlbnQgaXQgZnJvbSBiZWluZyBkaXNjYXJkZWRcbiAgY29udGV4dC5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJTeXN0ZW1UZW1wbGF0ZShjYXJkLmlkLCAnc3RhcnRUdXJuUGhhc2UnLCB7XG4gICAgcGxheWVySWQ6IGNvbnRleHQucGxheWVySWQsXG4gICAgb25jZTogdHJ1ZSxcbiAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICBpZiAoZ2V0VHVyblBoYXNlKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBoYXNlSW5kZXgpICE9PSAnY2xlYW51cCcpIHJldHVybiBmYWxzZTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jIHRyaWdnZXJlZEFyZ3MgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFske2NhcmQuY2FyZEtleX0gZHVyYXRpb24gZWZmZWN0XSBtb3ZpbmcgdG8gYWN0aXZlRHVyYXRpb24gem9uZWApO1xuICAgICAgXG4gICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICdhY3RpdmVEdXJhdGlvbicgfVxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbiAgXG4gIHRyaWdnZXJlZFRlbXBsYXRlID0gY2FzdEFycmF5KHRyaWdnZXJlZFRlbXBsYXRlKTtcbiAgXG4gIC8vIHJlZ2lzdGVyIHRoZSB0cmlnZ2VyIHRvIHJ1biB3aGVuIHRoZSBkdXJhdGlvbiBjYXJkIHRyaWdnZXJzXG4gIFxuICBmb3IgKGNvbnN0IHRyaWdnZXJlZFRlbXBsYXRlRWxlbWVudCBvZiB0cmlnZ2VyZWRUZW1wbGF0ZSkge1xuICAgIGNvbnRleHQucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh0cmlnZ2VyZWRUZW1wbGF0ZUVsZW1lbnQpO1xuICB9XG59XG5cbmNvbnN0IGV4cGFuc2lvbjogQ2FyZEV4cGFuc2lvbk1vZHVsZSA9IHtcbiAgJ2FtdWxldCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgYW11bGV0OiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGFjdGlvbnMgPSBbXG4gICAgICAgIHsgbGFiZWw6ICcrMSBUUkVBU1VSRScsIGFjdGlvbjogMSB9LFxuICAgICAgICB7IGxhYmVsOiAnVFJBU0ggQSBDQVJEJywgYWN0aW9uOiAyIH0sXG4gICAgICAgIHsgbGFiZWw6ICdHQUlOIEEgU0lMVkVSJywgYWN0aW9uOiAzIH1cbiAgICAgIF07XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2lzaW9uID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3VzZXJQcm9tcHQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogJ0Nob29zZSBvbmUnLFxuICAgICAgICAgIGFjdGlvbkJ1dHRvbnM6IGFjdGlvbnMsXG4gICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgXG4gICAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFthbXVsZXQgZWZmZWN0XSBnYWluaW5nIDEgdHJlYXN1cmVgKTtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocmVzdWx0LmFjdGlvbiA9PT0gMikge1xuICAgICAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFthbXVsZXQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgY2FyZFRvVHJhc2ggPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYW11bGV0IGVmZmVjdF0gc2VsZWN0ZWQgJHtjYXJkVG9UcmFzaH0gdG8gdHJhc2hgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9UcmFzaC5pZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNpbHZlckNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgICAgIHsgY2FyZEtleXM6ICdzaWx2ZXInIH1cbiAgICAgICAgICBdKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXNpbHZlckNhcmRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFthbXVsZXQgZWZmZWN0XSBubyBzaWx2ZXIgY2FyZHMgaW4gc3VwcGx5YCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2lsdmVyQ2FyZFRvR2FpbiA9IHNpbHZlckNhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICBjYXJkSWQ6IHNpbHZlckNhcmRUb0dhaW4uaWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGF3YWl0IGRlY2lzaW9uKCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHR1cm5QbGF5ZWQgPSBjYXJkRWZmZWN0QXJncy5tYXRjaC50dXJuTnVtYmVyO1xuICAgICAgXG4gICAgICBjb25zdCBjYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgXG4gICAgICBhZGREdXJhdGlvbkVmZmVjdChjYXJkLCBjYXJkRWZmZWN0QXJncywge1xuICAgICAgICBpZDogYGFtdWxldDoke2NhcmRFZmZlY3RBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MudHVybk51bWJlciA9PT0gdHVyblBsYXllZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFthbXVsZXQgc3RhcnRUdXJuIGVmZmVjdF0gcmUtcnVubmluZyBkZWNpc2lvbiBmbmApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheUFyZWEnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBkZWNpc2lvbigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdhcnRpZmljZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbYXJ0aWZpY2VyIGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGdhaW5pbmcgMSBhY3Rpb24gYW5kIDEgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBcbiAgICAgIGxldCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBjYXJkcz9gLFxuICAgICAgICByZXN0cmljdDogaGFuZCxcbiAgICAgICAgY291bnQ6IHsga2luZDogJ3VwVG8nLCBjb3VudDogaGFuZC5sZW5ndGggfSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYXJ0aWZpY2VyIGVmZmVjdF0gbm8gY2FyZHMgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2FydGlmaWNlciBlZmZlY3RdIHNlbGVjdGVkICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHMgdG8gZGlzY2FyZGApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHNlbGVjdGVkQ2FyZElkIG9mIHNlbGVjdGVkQ2FyZElkcykge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBjYXJkc1RvU2VsZWN0ID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgeyBraW5kOiAndXBUbycsIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgYW1vdW50OiB7IHRyZWFzdXJlOiAoc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCA/PyAwKSB9IH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBpZiAoIWNhcmRzVG9TZWxlY3QubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYXJ0aWZpY2VyIGVmZmVjdF0gbm8gY2FyZHMgaW4gc3VwcGx5IGNvc3RpbmcgJHtzZWxlY3RlZENhcmRJZHMubGVuZ3RoID8/IDB9IHRyZWFzdXJlYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYEdhaW4gY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBjYXJkc1RvU2VsZWN0Lm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWVcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFthcnRpZmljZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZFRvR2FpbiA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFthcnRpZmljZXIgZWZmZWN0XSBzZWxlY3RlZCAke2NhcmRUb0dhaW59IHRvIGdhaW5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGNhcmRUb0dhaW4uaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGVjaycgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnY2FyYXZhbi1ndWFyZCc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgY2FyYXZhbi1ndWFyZDoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmApO1xuICAgICAgfSxcbiAgICAgIG9uTGVhdmVIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjYXJhdmFuLWd1YXJkOiR7ZXZlbnRBcmdzLmNhcmRJZH06Y2FyZFBsYXllZGApO1xuICAgICAgfSxcbiAgICAgIG9uRW50ZXJIYW5kOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh7XG4gICAgICAgICAgaWQ6IGBjYXJhdmFuLWd1YXJkOiR7ZXZlbnRBcmdzLmNhcmRJZH06Y2FyZFBsYXllZGAsXG4gICAgICAgICAgbGlzdGVuaW5nRm9yOiAnY2FyZFBsYXllZCcsXG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBvbmNlOiBmYWxzZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgPT09IGV2ZW50QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgY2FyZFBsYXllZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgICAgaWYgKCFjYXJkUGxheWVkLnR5cGUuaW5jbHVkZXMoJ0FUVEFDSycpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbY2FyYXZhbi1ndWFyZCBjYXJkUGxheWVkIGVmZmVjdF0gcGxheWluZyBDYXJhdmFuIEd1YXJkYCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBldmVudEFyZ3MuY2FyZElkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW2NhcmF2YW4tZ3VhcmQgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdHVyblBsYXllZCA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXI7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBhZGREdXJhdGlvbkVmZmVjdChjYXJkLCBjYXJkRWZmZWN0QXJncywge1xuICAgICAgICBpZDogYGNhcmF2YW4tZ3VhcmQ6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnR1cm5OdW1iZXIgPT09IHR1cm5QbGF5ZWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jIHRyaWdnZXJlZEFyZ3MgPT4ge1xuICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZC5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheUFyZWEnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NhcmF2YW4tZ3VhcmQgc3RhcnRUdXJuIGVmZmVjdF0gZ2FpbmluZyAxIHRyZWFzdXJlYCk7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDEgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2NoYW1waW9uJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjaGFtcGlvbjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWQ6YXR0YWNrYCk7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBjaGFtcGlvbjoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRQbGF5ZWQ6YWN0aW9uYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRoaXNDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgYWRkRHVyYXRpb25FZmZlY3QodGhpc0NhcmQsIGNhcmRFZmZlY3RBcmdzLCBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogYGNoYW1waW9uOiR7dGhpc0NhcmQuaWR9OmNhcmRQbGF5ZWQ6YXR0YWNrYCxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkUGxheWVkJyxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiBmYWxzZSxcbiAgICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGxheWVkQ2FyZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgICAgaWYgKCFwbGF5ZWRDYXJkLnR5cGUuaW5jbHVkZXMoJ0FUVEFDSycpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgPT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbY2hhbXBpb24gY2FyZFBsYXllZCBlZmZlY3RdIGF0dGFjayBwbGF5ZWQsIGdhaW5pbmcgaW1tdW5pdHlgKTtcbiAgICAgICAgICAgIHJldHVybiAnaW1tdW5pdHknO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBgY2hhbXBpb246JHt0aGlzQ2FyZC5pZH06Y2FyZFBsYXllZDphY3Rpb25gLFxuICAgICAgICAgIGxpc3RlbmluZ0ZvcjogJ2NhcmRQbGF5ZWQnLFxuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBvbmNlOiBmYWxzZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICAgIGFsbG93TXVsdGlwbGVJbnN0YW5jZXM6IGZhbHNlLFxuICAgICAgICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZWRDYXJkID0gY29uZGl0aW9uQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCk7XG4gICAgICAgICAgICBpZiAoIXBsYXllZENhcmQudHlwZS5pbmNsdWRlcygnQUNUSU9OJykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jIHRyaWdnZXJlZEFyZ3MgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtjaGFtcGlvbiBjYXJkUGxheWVkIGVmZmVjdF0gYWN0aW9uIHBsYXllZCwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0sIHsgbG9nZ2luZ0NvbnRleHQ6IHsgc291cmNlOiB0aGlzQ2FyZC5pZCB9IH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXSk7XG4gICAgfVxuICB9LFxuICAnY29pbi1vZi10aGUtcmVhbG0nOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbY29pbi1vZi10aGUtcmVhbG0gZWZmZWN0XSBnYWluaW5nIDEgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtjb2luLW9mLXRoZS1yZWFsbSBlZmZlY3RdIG1vdmluZyBjYXJkIHRvIHRhdmVybiBtYXRgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZEVmZmVjdEFyZ3MuY2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3RhdmVybicgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRoaXNDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHRoaXNDYXJkLmlkLCAnY2FyZFBsYXllZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgY29uc3QgY2FyZFBsYXllZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGlmICghY2FyZFBsYXllZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtjb2luLW9mLXRoZS1yZWFsbSBjYXJkUGxheWVkIGVmZmVjdF0gY2FsbGluZyBiYWNrIHRvIHBsYXlgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5QXJlYScgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbY29pbi1vZi10aGUtcmVhbG0gY2FyZFBsYXllZCBlZmZlY3RdIGdhaW5pbmcgMiBhY3Rpb25zYCk7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAyIH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ2Rpc2NpcGxlJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uRGlzY2FyZGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgIGF3YWl0IGFkZFRyYXZlbGxlckVmZmVjdChjYXJkLCAndGVhY2hlcicsIGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IGhhbmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICBjb25zdCBhY3Rpb25DYXJkc0luSGFuZCA9IGhhbmQubWFwKGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQpXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ0FDVElPTicpKTtcbiAgICAgIFxuICAgICAgaWYgKCFhY3Rpb25DYXJkc0luSGFuZC5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtkaXNjaXBsZSBlZmZlY3RdIG5vIGFjdGlvbiBjYXJkcyBpbiBoYW5kYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFBsYXkgYWN0aW9uIGNhcmRgLFxuICAgICAgICByZXN0cmljdDogYWN0aW9uQ2FyZHNJbkhhbmQubWFwKGNhcmQgPT4gY2FyZC5pZCksXG4gICAgICAgIGNvdW50OiAxLFxuICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtkaXNjaXBsZSBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRUb1BsYXkgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbZGlzY2lwbGUgZWZmZWN0XSBwbGF5aW5nICR7c2VsZWN0ZWRDYXJkVG9QbGF5fSB0d2ljZWApO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkrKykge1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3BsYXlDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZFRvUGxheS5pZCxcbiAgICAgICAgICBvdmVycmlkZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbkNvc3Q6IDAsXG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY29waWVzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgeyBjYXJkS2V5czogc2VsZWN0ZWRDYXJkVG9QbGF5LmNhcmRLZXkgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghY29waWVzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2Rpc2NpcGxlIGVmZmVjdF0gbm8gY29waWVzIG9mICR7c2VsZWN0ZWRDYXJkVG9QbGF5fSBpbiBzdXBwbHlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2Rpc2NpcGxlIGVmZmVjdF0gZ2FpbmluZyAke3NlbGVjdGVkQ2FyZFRvUGxheX1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGNvcGllcy5zbGljZSgtMSlbMF0sXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnZGlzdGFudC1sYW5kcyc6IHtcbiAgICByZWdpc3RlclNjb3JpbmdGdW5jdGlvbjogKCkgPT4gKGFyZ3MpID0+IHtcbiAgICAgIFxuICAgICAgY29uc3QgZGlzdGFudExhbmRDYXJkcyA9IGFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCd0YXZlcm4nLCBhcmdzLm93bmVySWQpXG4gICAgICAgIC5tYXAoYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC5jYXJkS2V5ID09PSAnZGlzdGFudC1sYW5kcycpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2Rpc3RhbnQtbGFuZHMgc2NvcmluZyBmdW5jdGlvbl0gbnVtYmVyIG9mIGRpc3RhbnQgbGFuZHMgb24gdGF2ZXJuIG1hdCAke2Rpc3RhbnRMYW5kQ2FyZHMubGVuZ3RofSBmb3IgcGxheWVyICR7YXJncy5vd25lcklkfWApO1xuICAgICAgXG4gICAgICByZXR1cm4gZGlzdGFudExhbmRDYXJkcy5sZW5ndGggKiA0O1xuICAgIH0sXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHRoaXNDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2Rpc3RhbnQtbGFuZHMgZWZmZWN0XSBtb3ZpbmcgJHt0aGlzQ2FyZH0gdG8gdGF2ZXJuIG1hdGApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkRWZmZWN0QXJncy5jYXJkSWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAndGF2ZXJuJyB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdkdW5nZW9uJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGFyZ3MucmVhY3Rpb25NYW5hZ2VyLnVucmVnaXN0ZXJUcmlnZ2VyKGBkdW5nZW9uOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZHVuZ2VvbiBlZmZlY3RdIGdhaW5pbmcgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDEgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGVmZmVjdHMgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZHVuZ2VvbiBlZmZlY3RdIGFuZCBkcmF3aW5nIDIgY2FyZHNgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBjYXJkc2AsXG4gICAgICAgICAgcmVzdHJpY3Q6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgICBjb3VudDogMixcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2R1bmdlb24gZWZmZWN0XSBubyBjYXJkcyBzZWxlY3RlZGApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtkdW5nZW9uIGVmZmVjdF0gZGlzY2FyZGluZyAke3NlbGVjdGVkQ2FyZElkcy5sZW5ndGh9IGNhcmRzYCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IHNlbGVjdGVkQ2FyZElkIG9mIHNlbGVjdGVkQ2FyZElkcykge1xuICAgICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgdHVyblBsYXllZCA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXI7XG4gICAgICBcbiAgICAgIGF3YWl0IGVmZmVjdHMoKTtcbiAgICAgIFxuICAgICAgY29uc3QgY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgIGFkZER1cmF0aW9uRWZmZWN0KGNhcmQsIGNhcmRFZmZlY3RBcmdzLCB7XG4gICAgICAgIGlkOiBgZHVuZ2Vvbjoke2NhcmRFZmZlY3RBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy50dXJuTnVtYmVyID09PSB0dXJuUGxheWVkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtkdW5nZW9uIHN0YXJ0VHVybiBlZmZlY3RdIHJ1bm5pbmdgKTtcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IGNhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXlBcmVhJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYXdhaXQgZWZmZWN0cygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdkdXBsaWNhdGUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHRoaXNDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW2R1cGxpY2F0ZSBlZmZlY3RdIG1vdmluZyAke3RoaXNDYXJkfSB0byB0YXZlcm4gbWF0YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IGNhcmRFZmZlY3RBcmdzLmNhcmRJZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICd0YXZlcm4nIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHRoaXNDYXJkLmlkLCAnY2FyZEdhaW5lZCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgY29uc3QgY2FyZEdhaW5lZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGNvbnN0IHsgY29zdCB9ID0gY29uZGl0aW9uQXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZEdhaW5lZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPD0gNiAmJiAoIWNvc3QucG90aW9uIHx8IGNvc3QucG90aW9uIDw9IDApKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2R1cGxpY2F0ZSBjYXJkR2FpbmVkXSBjYWxsaW5nICR7dGhpc0NhcmR9IHRvIHBsYXkgYXJlYWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogdGhpc0NhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXlBcmVhJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2FyZEdhaW5lZCA9IHRyaWdnZXJlZEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZCh0cmlnZ2VyZWRBcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNvcGllcyA9IHRyaWdnZXJlZEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgICB7IGNhcmRLZXlzOiBjYXJkR2FpbmVkLmNhcmRLZXkgfVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICghY29waWVzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtkdXBsaWNhdGUgY2FyZEdhaW5lZF0sIG5vIGNvcGllcyBvZiAke2NhcmRHYWluZWR9IGluIHN1cHBseWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkVG9HYWluID0gY29waWVzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2R1cGxpY2F0ZSBjYXJkR2FpbmVkXSBnYWluaW5nICR7Y2FyZFRvR2Fpbn1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9HYWluLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnZnVnaXRpdmUnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25EaXNjYXJkZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChldmVudEFyZ3MuY2FyZElkKTtcbiAgICAgICAgYXdhaXQgYWRkVHJhdmVsbGVyRWZmZWN0KGNhcmQsICdkaXNjaXBsZScsIGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbZnVnaXRpdmUgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHMgYW5kIGdhaW5pbmcgMSBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgRGlzY2FyZCBjYXJkYCxcbiAgICAgICAgcmVzdHJpY3Q6IGNhcmRFZmZlY3RBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSxcbiAgICAgICAgY291bnQ6IDEsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZnVnaXRpdmUgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgY2FyZFRvRGlzY2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtmdWdpdGl2ZSBlZmZlY3RdIGRpc2NhcmRpbmcgJHtjYXJkVG9EaXNjYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZFRvRGlzY2FyZC5pZFxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnZ2Vhcic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgZ2Vhcjoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmApO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgU2V0IGFzaWRlIGNhcmRzYCxcbiAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgIGNvdW50OiB7XG4gICAgICAgICAga2luZDogJ3VwVG8nLFxuICAgICAgICAgIGNvdW50OiBNYXRoLm1pbigyLCBoYW5kLmxlbmd0aClcbiAgICAgICAgfSxcbiAgICAgICAgb3B0aW9uYWw6IHRydWUsXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbZ2VhciBlZmZlY3RdIG5vIGNhcmRzIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtnZWFyIGVmZmVjdF0gc2V0IGFzaWRlICR7c2VsZWN0ZWRDYXJkSWRzLmxlbmd0aH0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBzZWxlY3RlZENhcmRJZCBvZiBzZWxlY3RlZENhcmRJZHMpIHtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAnc2V0LWFzaWRlJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0dXJuUGxheWVkID0gY2FyZEVmZmVjdEFyZ3MubWF0Y2gudHVybk51bWJlcjtcbiAgICAgIFxuICAgICAgY29uc3QgdGhpc0NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGFkZER1cmF0aW9uRWZmZWN0KHRoaXNDYXJkLCBjYXJkRWZmZWN0QXJncywge1xuICAgICAgICBpZDogYGdlYXI6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgbGlzdGVuaW5nRm9yOiAnc3RhcnRUdXJuJyxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnR1cm5OdW1iZXIgPT09IHR1cm5QbGF5ZWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jIHRyaWdnZXJlZEFyZ3MgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbZ2VhciBzdGFydFR1cm4gZWZmZWN0XSBtb3ZpbmcgJHtzZWxlY3RlZENhcmRJZHMubGVuZ3RofSB0byBoYW5kYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiB0aGlzQ2FyZC5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheUFyZWEnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IHNlbGVjdGVkQ2FyZElkIG9mIHNlbGVjdGVkQ2FyZElkcykge1xuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkSWQsXG4gICAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVySGFuZCcgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICdndWlkZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtndWlkZSBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBhbmQgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGhpc0NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbZ3VpZGUgZWZmZWN0XSBtb3ZpbmcgJHt0aGlzQ2FyZH0gdG8gdGF2ZXJuIG1hdGApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBjYXJkRWZmZWN0QXJncy5jYXJkSWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAndGF2ZXJuJyB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25NYW5hZ2VyLnJlZ2lzdGVyUmVhY3Rpb25UZW1wbGF0ZSh0aGlzQ2FyZC5pZCwgJ3N0YXJ0VHVybicsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiBmYWxzZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2d1aWRlIHN0YXJ0VHVybiBlZmZlY3RdIGNhbGxpbmcgJHt0aGlzQ2FyZH0gdG8gcGxheUFyZWFgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5QXJlYScgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGhhbmQgPSB0cmlnZ2VyZWRBcmdzLmNhcmRTb3VyY2VDb250cm9sbGVyLmdldFNvdXJjZSgncGxheWVySGFuZCcsIGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2d1aWRlIHN0YXJ0VHVybiBlZmZlY3RdIGRpc2NhcmRpbmcgaGFuZGApO1xuICAgICAgICAgIFxuICAgICAgICAgIGZvciAoY29uc3QgY2FyZElkIG9mIFsuLi5oYW5kXSkge1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsIGNhcmRJZCB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtndWlkZSBzdGFydFR1cm4gZWZmZWN0XSBkcmF3aW5nIDUgY2FyZHNgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDUgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAnaGF1bnRlZC13b29kcyc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkxlYXZlUGxheTogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgaGF1bnRlZC13b29kczoke2V2ZW50QXJncy5jYXJkSWR9OnN0YXJ0VHVybmApO1xuICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgaGF1bnRlZC13b29kczoke2V2ZW50QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgdHVyblBsYXllZCA9IGNhcmRFZmZlY3RBcmdzLm1hdGNoLnR1cm5OdW1iZXI7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUoe1xuICAgICAgICBpZDogYGhhdW50ZWQtd29vZHM6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkR2FpbmVkJyxcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBvbmNlOiB0cnVlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCA9PT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoIWNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmJvdWdodCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc3QgdHJpZ2dlcmluZ1BsYXllcklkID0gdHJpZ2dlcmVkQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQ7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtoYXVudGVkLXdvb2RzIGNhcmRHYWluZWQgZWZmZWN0XSBwbGF5ZXIgJHt0cmlnZ2VyaW5nUGxheWVySWR9IHJlYXJyYW5naW5nIGhhbmQgYW5kIHRvcC1kZWNraW5nYCk7XG4gICAgICAgICAgY29uc3QgaGFuZCA9IHRyaWdnZXJlZEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdHJpZ2dlcmluZ1BsYXllcklkKTtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0cmlnZ2VyaW5nUGxheWVySWQsXG4gICAgICAgICAgICBwcm9tcHQ6ICdSZWFycmFuZ2UgaGFuZCB0byBwdXQgb24gZGVjaycsXG4gICAgICAgICAgICBhY3Rpb25CdXR0b25zOiBbeyBsYWJlbDogJ0RPTkUnLCBhY3Rpb246IDEgfV0sXG4gICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgIHR5cGU6ICdyZWFycmFuZ2UnLFxuICAgICAgICAgICAgICBjYXJkSWRzOiBoYW5kLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXJlc3VsdC5yZXN1bHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFtoYXVudGVkLXdvb2RzIGNhcmRHYWluZWQgZWZmZWN0XSBubyBjYXJkcyByZWFycmFuZ2VkYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnNvbGUud2FybihgW2hhdW50ZWQtd29vZHMgY2FyZEdhaW5lZCBlZmZlY3RdIG1vdmluZyAke3Jlc3VsdC5yZXN1bHQubGVuZ3RofSBjYXJkcyB0byBkZWNrYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgZm9yIChjb25zdCBjYXJkSWQgb2YgcmVzdWx0LnJlc3VsdCkge1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgICB0b1BsYXllcklkOiB0cmlnZ2VyaW5nUGxheWVySWQsXG4gICAgICAgICAgICAgIGNhcmRJZCxcbiAgICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEZWNrJyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0aGlzQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgIGFkZER1cmF0aW9uRWZmZWN0KHRoaXNDYXJkLCBjYXJkRWZmZWN0QXJncywge1xuICAgICAgICBpZDogYGhhdW50ZWQtd29vZHM6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnR1cm5OdW1iZXIgPT09IHR1cm5QbGF5ZWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgdHJpZ2dlcmVkRWZmZWN0Rm46IGFzeW5jIHRyaWdnZXJlZEFyZ3MgPT4ge1xuICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogdGhpc0NhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXlBcmVhJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgdHJpZ2dlcmVkQXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGhhdW50ZWQtd29vZHM6JHtjYXJkRWZmZWN0QXJncy5jYXJkSWR9OmNhcmRHYWluZWRgKTtcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2hlcm8nOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25EaXNjYXJkZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChldmVudEFyZ3MuY2FyZElkKTtcbiAgICAgICAgYXdhaXQgYWRkVHJhdmVsbGVyRWZmZWN0KGNhcmQsICdjaGFtcGlvbicsIGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbaGVybyBlZmZlY3RdIGdhaW5pbmcgMiB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0cmVhc3VyZUNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgeyBjYXJkVHlwZTogJ1RSRUFTVVJFJyB9XG4gICAgICBdKTtcbiAgICAgIFxuICAgICAgaWYgKCF0cmVhc3VyZUNhcmRzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW2hlcm8gZWZmZWN0XSBubyB0cmVhc3VyZSBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgcHJvbXB0OiBgR2FpbiB0cmVhc3VyZWAsXG4gICAgICAgIHJlc3RyaWN0OiB0cmVhc3VyZUNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICBjb3VudDogMSxcbiAgICAgIH0pIGFzIENhcmRJZFtdO1xuICAgICAgXG4gICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBbaGVybyBlZmZlY3RdIG5vIGNhcmQgc2VsZWN0ZWRgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RlZENhcmRUb0dhaW4gPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbaGVybyBlZmZlY3RdIGdhaW5pbmcgJHtzZWxlY3RlZENhcmRUb0dhaW59YCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmRUb0dhaW4uaWQsXG4gICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnaGlyZWxpbmcnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25MZWF2ZVBsYXk6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgYXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoYGhpcmVsaW5nOiR7ZXZlbnRBcmdzLmNhcmRJZH06c3RhcnRUdXJuYCk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHRoaXNDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjYXJkRWZmZWN0QXJncy5jYXJkSWQpO1xuICAgICAgXG4gICAgICBhZGREdXJhdGlvbkVmZmVjdCh0aGlzQ2FyZCwgY2FyZEVmZmVjdEFyZ3MsIHtcbiAgICAgICAgaWQ6IGBoaXJlbGluZzoke3RoaXNDYXJkLmlkfTpzdGFydFR1cm5gLFxuICAgICAgICBsaXN0ZW5pbmdGb3I6ICdzdGFydFR1cm4nLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIG9uY2U6IGZhbHNlLFxuICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5wbGF5ZXJJZCAhPT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MudHVybk51bWJlciA9PT0gY29uZGl0aW9uQXJncy5tYXRjaC50dXJuTnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2hpcmVsaW5nIHN0YXJ0VHVybiBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkYCk7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcbiAgJ2xvc3QtY2l0eSc6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkdhaW5lZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICAgIG1hdGNoOiBhcmdzLm1hdGNoLFxuICAgICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgZm9yIChjb25zdCB0YXJnZXRQbGF5ZXJJZCBvZiB0YXJnZXRQbGF5ZXJJZHMpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW2xvc3QtY2l0eSBvbkdhaW5lZCBlZmZlY3RdICR7dGFyZ2V0UGxheWVySWR9IGRyYXdpbmcgMSBjYXJkYCk7XG4gICAgICAgICAgYXdhaXQgYXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLCBjb3VudDogMiB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgfVxuICB9LFxuICAnbWFncGllJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW21hZ3BpZSBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkLCBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttYWdwaWUgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmcgZGVja2ApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NodWZmbGVEZWNrJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWRlY2subGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFttYWdwaWUgZWZmZWN0XSBzdGlsbCBubyBjYXJkcyBpbiBkZWNrLCBubyBjYXJkcyB0byByZXZlYWxgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmV2ZWFsZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChkZWNrLnNsaWNlKC0xKVswXSk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbbWFncGllIGVmZmVjdF0gcmV2ZWFsaW5nICR7cmV2ZWFsZWRDYXJkfWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3JldmVhbENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiByZXZlYWxlZENhcmQsXG4gICAgICAgIG1vdmVUb1NldEFzaWRlOiB0cnVlXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKHJldmVhbGVkQ2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWFncGllIGVmZmVjdF0gdHJlYXN1cmUgcmV2ZWFsZWQsIG1vdmluZyByZXZlYWxlZCBjYXJkIHRvIGhhbmRgKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiByZXZlYWxlZENhcmQuaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAocmV2ZWFsZWRDYXJkLnR5cGUuc29tZSh0ID0+IFsnQUNUSU9OJywgJ1ZJQ1RPUlknXS5pbmNsdWRlcyh0KSkpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttYWdwaWUgZWZmZWN0XSBhY3Rpb24gb3IgdmljdG9yeSByZXZlYWxlZCwgZ2FpbmluZyBtYWdwaWVgKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IG1hZ3BpZUNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICB7IGxvY2F0aW9uOiAna2luZ2RvbVN1cHBseScgfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiAnbWFncGllJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFtYWdwaWVDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW21hZ3BpZSBlZmZlY3RdIG5vIG1hZ3BpZSBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IG1hZ1BpZVRvR2FpbiA9IG1hZ3BpZUNhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWFncGllIGVmZmVjdF0gZ2FpbmluZyAke21hZ1BpZVRvR2Fpbn1gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogbWFnUGllVG9HYWluLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheWVyRGlzY2FyZCcgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdtZXNzZW5nZXInOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhcmdzLm1hdGNoLnN0YXRzO1xuICAgICAgICBpZiAoc3RhdHMuY2FyZHNHYWluZWQ/LltldmVudEFyZ3MuY2FyZElkXT8udHVyblBoYXNlICE9PSAnYnV5Jykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3QgY2FyZHNHYWluZWRUaGlzVHVybkJ1eVBoYXNlID1cbiAgICAgICAgICBzdGF0cy5jYXJkc0dhaW5lZEJ5VHVybj8uW2FyZ3MubWF0Y2gudHVybk51bWJlcl1cbiAgICAgICAgICAgID8uZmlsdGVyKGNhcmRJZCA9PiBzdGF0cy5jYXJkc0dhaW5lZFtjYXJkSWRdLnBsYXllcklkID09PSBldmVudEFyZ3MucGxheWVySWQgJiYgc3RhdHMuY2FyZHNHYWluZWRbY2FyZElkXS50dXJuUGhhc2UgPT09ICdidXknKVxuICAgICAgICAgICAgPy5sZW5ndGggPz8gMDtcbiAgICAgICAgXG4gICAgICAgIGlmIChjYXJkc0dhaW5lZFRoaXNUdXJuQnV5UGhhc2UgIT09IDEpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW21lc3NlbmdlciBvbkdhaW5lZCBlZmZlY3RdIHBsYXllciAke2V2ZW50QXJncy5wbGF5ZXJJZH0gZ2FpbmVkIG1vcmUgdGhhbiAxIGNhcmQgaW4gYnV5IHBoYXNlYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgIHByb21wdDogYEdhaW4gY2FyZGAsXG4gICAgICAgICAgcmVzdHJpY3Q6IFt7IGxvY2F0aW9uOiBbJ2Jhc2ljU3VwcGx5JywgJ2tpbmdkb21TdXBwbHknXSB9LCB7XG4gICAgICAgICAgICBraW5kOiAndXBUbycsXG4gICAgICAgICAgICBwbGF5ZXJJZDogZXZlbnRBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgYW1vdW50OiB7IHRyZWFzdXJlOiA0IH1cbiAgICAgICAgICB9XSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYFttZXNzZW5nZXIgb25HYWluZWQgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWVzc2VuZ2VyIG9uR2FpbmVkIGVmZmVjdF0gc2VsZWN0ZWQgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjb3BpZXMgPSBhcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogWydiYXNpY1N1cHBseScsICdraW5nZG9tU3VwcGx5J10gfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiBzZWxlY3RlZENhcmQuY2FyZEtleSB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVySWRzID0gZmluZE9yZGVyZWRUYXJnZXRzKHtcbiAgICAgICAgICBtYXRjaDogYXJncy5tYXRjaCxcbiAgICAgICAgICBhcHBsaWVzVG86ICdBTEwnLFxuICAgICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHRhcmdldFBsYXllcklkcy5sZW5ndGggPSBNYXRoLm1pbih0YXJnZXRQbGF5ZXJJZHMubGVuZ3RoLCBjb3BpZXMubGVuZ3RoKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0UGxheWVySWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFttZXNzZW5nZXIgb25HYWluZWQgZWZmZWN0XSBnYWluaW5nICR7Y29waWVzLnNsaWNlKC1pIC0gMSlbMF19IHRvICR7dGFyZ2V0UGxheWVySWRzW2ldfWApO1xuICAgICAgICAgIGF3YWl0IGFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZHNbaV0sXG4gICAgICAgICAgICBjYXJkSWQ6IGNvcGllcy5zbGljZSgtaSAtIDEpWzBdLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFttZXNzZW5nZXIgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQnV5JywgeyBjb3VudDogMSB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd1c2VyUHJvbXB0Jywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogJ1B1dCBkZWNrIGludG8geW91ciBkaXNjYXJkPycsXG4gICAgICAgIGFjdGlvbkJ1dHRvbnM6IFtcbiAgICAgICAgICB7IGxhYmVsOiAnQ0FOQ0VMJywgYWN0aW9uOiAxIH0sXG4gICAgICAgICAgeyBsYWJlbDogJ1BVVCBJTiBESVNDQVJEJywgYWN0aW9uOiAyIH1cbiAgICAgICAgXSxcbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5hY3Rpb24gPT09IDEpIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttZXNzZW5nZXIgZWZmZWN0XSB1c2VyIGNhbmNlbGxlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coYFttZXNzZW5nZXIgZWZmZWN0XSBwdXR0aW5nIGRlY2sgaW50byBkaXNjYXJkYCk7XG4gICAgICAgIGNvbnN0IGRlY2sgPSBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckRlY2snLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCk7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGNhcmRJZCBvZiBbLi4uZGVja10pIHtcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ21pc2VyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zdCBjb3BwZXJDYXJkc09uVHJlYXN1cmVNYXQgPSBjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMoW1xuICAgICAgICB7IGxvY2F0aW9uOiAndGF2ZXJuJywgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0sXG4gICAgICAgIHsgY2FyZEtleXM6ICdjb3BwZXInIH1cbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6ICdDaG9vc2Ugb25lJyxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdQVVQgQ09QUEVSIE9OIFRBVkVSTicsIGFjdGlvbjogMSB9LFxuICAgICAgICAgIHsgbGFiZWw6IGArJHtjb3BwZXJDYXJkc09uVHJlYXN1cmVNYXQubGVuZ3RofSBUUkVBU1VSRWAsIGFjdGlvbjogMiB9XG4gICAgICAgIF0sXG4gICAgICB9KSBhcyB7IGFjdGlvbjogbnVtYmVyLCByZXN1bHQ6IG51bWJlcltdIH07XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuYWN0aW9uID09PSAxKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWlzZXIgZWZmZWN0XSBwdXR0aW5nIGNvcHBlciBvbiB0YXZlcm5gKTtcbiAgICAgICAgY29uc3QgY29wcGVyc0luSGFuZCA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgICAgeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnLCBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSxcbiAgICAgICAgICB7IGNhcmRLZXlzOiAnY29wcGVyJyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFjb3BwZXJzSW5IYW5kLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbbWlzZXIgZWZmZWN0XSBubyBjb3BwZXJzIGluIGhhbmRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWlzZXIgZWZmZWN0XSBtb3ZpbmcgJHtjb3BwZXJzSW5IYW5kWzBdfSB0byB0YXZlcm5gKTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjb3BwZXJzSW5IYW5kWzBdLmlkLFxuICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAndGF2ZXJuJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbbWlzZXIgZWZmZWN0XSBnYWluaW5nICR7Y29wcGVyQ2FyZHNPblRyZWFzdXJlTWF0Lmxlbmd0aH0gdHJlYXN1cmVgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiBjb3BwZXJDYXJkc09uVHJlYXN1cmVNYXQubGVuZ3RoIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3BhZ2UnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25EaXNjYXJkZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChldmVudEFyZ3MuY2FyZElkKTtcbiAgICAgICAgYXdhaXQgYWRkVHJhdmVsbGVyRWZmZWN0KGNhcmQsICd0cmVhc3VyZS1odW50ZXInLCBhcmdzLCBldmVudEFyZ3MpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3BhZ2UgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICB9XG4gIH0sXG4gICdwZWFzYW50Jzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uRGlzY2FyZGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgIGF3YWl0IGFkZFRyYXZlbGxlckVmZmVjdChjYXJkLCAnc29sZGllcicsIGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcGVhc2FudCBlZmZlY3RdIGdhaW5pbmcgMSBidXksIGFuZCAxIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgIH1cbiAgfSxcbiAgJ3BvcnQnOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25HYWluZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgcG9ydENhcmRzID0gYXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgIHsgbG9jYXRpb246ICdraW5nZG9tU3VwcGx5JyB9LFxuICAgICAgICAgIHsgY2FyZEtleXM6ICdwb3J0JyB9XG4gICAgICAgIF0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFwb3J0Q2FyZHMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtwb3J0IG9uR2FpbmVkIGVmZmVjdF0gbm8gcG9ydCBjYXJkcyBpbiBzdXBwbHlgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHBvcnRUb0dhaW4gPSBwb3J0Q2FyZHMuc2xpY2UoLTEpWzBdO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtwb3J0IG9uR2FpbmVkIGVmZmVjdF0gZ2FpbmluZyAke3BvcnRUb0dhaW59YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBhcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGV2ZW50QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IHBvcnRUb0dhaW4uaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0sIHsgc3VwcHJlc3NMaWZlQ3ljbGU6IHsgZXZlbnRzOiBbJ29uR2FpbmVkJ10gfSB9KTtcbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtwb3J0IGVmZmVjdF0gZHJhd2luZyAxIGNhcmQsIGdhaW5pbmcgMiBhY3Rpb25gKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkFjdGlvbicsIHsgY291bnQ6IDIgfSk7XG4gICAgfVxuICB9LFxuICAncmF6ZSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc29sZS5sb2coYFtyYXplIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIHByb21wdDogYFRyYXNoIGEgY2FyZGAsXG4gICAgICAgIHJlc3RyaWN0OiBjYXJkRWZmZWN0QXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZClcbiAgICAgICAgICAuY29uY2F0KGNhcmRFZmZlY3RBcmdzLmNhcmRJZCksXG4gICAgICAgIGNvdW50OiAxXG4gICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgIFxuICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW3JhemUgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChzZWxlY3RlZENhcmRJZHNbMF0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3JhemUgZWZmZWN0XSB0cmFzaGluZyAke3NlbGVjdGVkQ2FyZH1gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiBzZWxlY3RlZENhcmQuaWRcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB7IGNvc3QgfSA9IGNhcmRFZmZlY3RBcmdzLmNhcmRQcmljZUNvbnRyb2xsZXIuYXBwbHlSdWxlcyhzZWxlY3RlZENhcmQsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBudW1Ub0xvb2tBdCA9IGNvc3QudHJlYXN1cmU7XG4gICAgICBcbiAgICAgIGlmIChudW1Ub0xvb2tBdCA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3JhemUgZWZmZWN0XSBjb3N0IGlzIDAsIG5vdCBsb29raW5nIGF0IGRlY2tgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgXG4gICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtyYXplIGVmZmVjdF0gZGVjayBpcyBlbXB0eSwgc2h1ZmZsaW5nIGRlY2tgKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtyYXplIGVmZmVjdF0gc3RpbGwgZW1wdHksIG5vIGNhcmRzIHRvIGxvb2sgYXRgKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgbG9va2luZ0F0Q2FyZHM6IENhcmRbXSA9IFtdO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVRvTG9va0F0OyBpKyspIHtcbiAgICAgICAgY29uc3QgY2FyZFRvTG9va0F0ID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChkZWNrLnNsaWNlKC1pIC0gMSlbMF0pO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coYFtyYXplIGVmZmVjdF0gbG9va2luZyBhdCAke2NhcmRUb0xvb2tBdH1gKTtcbiAgICAgICAgXG4gICAgICAgIGxvb2tpbmdBdENhcmRzLnB1c2goY2FyZFRvTG9va0F0KTtcbiAgICAgICAgXG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBjYXJkVG9Mb29rQXQuaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdzZXQtYXNpZGUnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgndXNlclByb21wdCcsIHtcbiAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBwcm9tcHQ6ICdDaG9vc2Ugb25lIHRvIHB1dCBpbiBoYW5kJyxcbiAgICAgICAgYWN0aW9uQnV0dG9uczogW1xuICAgICAgICAgIHsgbGFiZWw6ICdET05FJywgYWN0aW9uOiAxIH1cbiAgICAgICAgXSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHR5cGU6ICdzZWxlY3QnLFxuICAgICAgICAgIGNhcmRJZHM6IGxvb2tpbmdBdENhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgIHNlbGVjdENvdW50OiAxXG4gICAgICAgIH1cbiAgICAgIH0pIGFzIHsgYWN0aW9uOiBudW1iZXIsIHJlc3VsdDogbnVtYmVyW10gfTtcbiAgICAgIFxuICAgICAgaWYgKCFyZXN1bHQucmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLndhcm4oYFtyYXplIGVmZmVjdF0gbm8gY2FyZCBzZWxlY3RlZGApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZFRvUHV0SW5IYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChyZXN1bHQucmVzdWx0WzBdKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtyYXplIGVmZmVjdF0gcHV0dGluZyAke3NlbGVjdGVkQ2FyZFRvUHV0SW5IYW5kfSBpbiBoYW5kYCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZFRvUHV0SW5IYW5kLmlkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckhhbmQnIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3JhemUgZWZmZWN0XSBkaXNjYXJkaW5nICR7bG9va2luZ0F0Q2FyZHMubGVuZ3RoIC0gMX0gY2FyZHNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBsb29raW5nQXRDYXJkIG9mIGxvb2tpbmdBdENhcmRzKSB7XG4gICAgICAgIGlmIChsb29raW5nQXRDYXJkLmlkID09PSBzZWxlY3RlZENhcmRUb1B1dEluSGFuZC5pZCkgY29udGludWU7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogbG9va2luZ0F0Q2FyZC5pZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICdyYXRjYXRjaGVyJzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3JhdGNhdGNoZXIgZWZmZWN0XSBkcmF3aW5nIDEgY2FyZCwgZ2FpbmluZyAxIGFjdGlvbmApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdkcmF3Q2FyZCcsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGhpc0NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGBbcmF0Y2F0Y2hlciBlZmZlY3RdIG1vdmluZyAke3RoaXNDYXJkfSB0byBwbGF5IGFyZWFgKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZEVmZmVjdEFyZ3MuY2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3RhdmVybicgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUodGhpc0NhcmQuaWQsICdzdGFydFR1cm4nLCB7XG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGNvbXB1bHNvcnk6IGZhbHNlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtyYXRjYXRjaGVyIHN0YXJ0VHVybiBlZmZlY3RdIGNhbGxpbmcgJHt0aGlzQ2FyZH0gdG8gcGxheUFyZWFgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5QXJlYScgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgcHJvbXB0OiBgVHJhc2ggY2FyZGAsXG4gICAgICAgICAgICByZXN0cmljdDogdHJpZ2dlcmVkQXJncy5jYXJkU291cmNlQ29udHJvbGxlci5nZXRTb3VyY2UoJ3BsYXllckhhbmQnLCBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCksXG4gICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbcmF0Y2F0Y2hlciBzdGFydFR1cm4gZWZmZWN0XSBubyBjYXJkcyBzZWxlY3RlZGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBzZWxlY3RlZENhcmQgPSB0cmlnZ2VyZWRBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoc2VsZWN0ZWRDYXJkSWRzWzBdKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3JhdGNhdGNoZXIgc3RhcnRUdXJuIGVmZmVjdF0gdHJhc2hpbmcgJHtzZWxlY3RlZENhcmR9YCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogc2VsZWN0ZWRDYXJkLmlkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAncm95YWwtY2FycmlhZ2UnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbcm95YWwtY2FycmlhZ2UgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0aGlzQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtyb3lhbC1jYXJyaWFnZSBlZmZlY3RdIG1vdmluZyAke3RoaXNDYXJkfSB0byB0YXZlcm5gKTtcbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgdG9QbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNhcmRJZDogY2FyZEVmZmVjdEFyZ3MuY2FyZElkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3RhdmVybicgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUodGhpc0NhcmQuaWQsICdhZnRlckNhcmRQbGF5ZWQnLCB7XG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGNvbXB1bHNvcnk6IGZhbHNlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgY29uc3QgY2FyZFBsYXllZCA9IGNvbmRpdGlvbkFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChjb25kaXRpb25BcmdzLnRyaWdnZXIuYXJncy5jYXJkSWQpO1xuICAgICAgICAgIGlmICghY2FyZFBsYXllZC50eXBlLmluY2x1ZGVzKCdBQ1RJT04nKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIGlmICghZ2V0Q2FyZHNJblBsYXkoY29uZGl0aW9uQXJncy5maW5kQ2FyZHMpLmluY2x1ZGVzKGNhcmRQbGF5ZWQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIHRyaWdnZXJlZEVmZmVjdEZuOiBhc3luYyB0cmlnZ2VyZWRBcmdzID0+IHtcbiAgICAgICAgICBjb25zdCBjYXJkVG9QbGF5ID0gdHJpZ2dlcmVkQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHRyaWdnZXJlZEFyZ3MudHJpZ2dlci5hcmdzLmNhcmRJZCk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS5sb2coYFtyb3lhbC1jYXJyaWFnZSBhZnRlckNhcmRQbGF5ZWQgZWZmZWN0XSBjYWxsaW5nICR7dGhpc0NhcmR9IHRvIHBsYXlBcmVhYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiB0aGlzQ2FyZC5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheUFyZWEnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3JveWFsLWNhcnJpYWdlIGFmdGVyQ2FyZFBsYXllZCBlZmZlY3RdIHJlLXBsYXlpbmcgJHtjYXJkVG9QbGF5fWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvUGxheS5pZCxcbiAgICAgICAgICAgIG92ZXJyaWRlczoge1xuICAgICAgICAgICAgICBhY3Rpb25Db3N0OiAwLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSxcbiAgJ3NvbGRpZXInOiB7XG4gICAgcmVnaXN0ZXJMaWZlQ3ljbGVNZXRob2RzOiAoKSA9PiAoe1xuICAgICAgb25EaXNjYXJkZWQ6IGFzeW5jIChhcmdzLCBldmVudEFyZ3MpID0+IHtcbiAgICAgICAgY29uc3QgY2FyZCA9IGFyZ3MuY2FyZExpYnJhcnkuZ2V0Q2FyZChldmVudEFyZ3MuY2FyZElkKTtcbiAgICAgICAgYXdhaXQgYWRkVHJhdmVsbGVyRWZmZWN0KGNhcmQsICdmdWdpdGl2ZScsIGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc29sZGllciBlZmZlY3RdIGdhaW5pbmcgMiB0cmVhc3VyZWApO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAyIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBhdHRhY2tzSW5QbGF5ID0gZ2V0Q2FyZHNJblBsYXkoY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC5vd25lciA9PT0gY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgJiYgY2FyZC50eXBlLmluY2x1ZGVzKCdBVFRBQ0snKSk7XG4gICAgICBcbiAgICAgIGlmIChhdHRhY2tzSW5QbGF5Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtzb2xkaWVyIGVmZmVjdF0gJHthdHRhY2tzSW5QbGF5Lmxlbmd0aH0gYXR0YWNrcyBpbiBwbGF5LCBnYWluaW5nIHRoYXQgbXVjaCB0cmVhc3VyZWApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IGF0dGFja3NJblBsYXkubGVuZ3RoIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4ge1xuICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgcGxheWVySWQpO1xuICAgICAgICByZXR1cm4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScgJiYgaGFuZC5sZW5ndGggPj0gNDtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzZWxlY3RDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBwcm9tcHQ6IGBEaXNjYXJkIGNhcmRgLFxuICAgICAgICAgIHJlc3RyaWN0OiBoYW5kLFxuICAgICAgICAgIGNvdW50OiAxLFxuICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZWN0ZWRDYXJkSWRzLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgW3NvbGRpZXIgZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNhcmRUb0Rpc2NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3NvbGRpZXIgZWZmZWN0XSBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gZGlzY2FyZGluZyAke2NhcmRUb0Rpc2NhcmR9YCk7XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGNhcmRUb0Rpc2NhcmQuaWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAnc3Rvcnl0ZWxsZXInOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbc3Rvcnl0ZWxsZXIgZWZmZWN0XSBnYWluaW5nIDEgYWN0aW9uYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBoYW5kID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgbGV0IHRyZWFzdXJlc0luSGFuZCA9IGhhbmRcbiAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAuZmlsdGVyKGNhcmQgPT4gY2FyZC50eXBlLmluY2x1ZGVzKCdUUkVBU1VSRScpKTtcbiAgICAgIFxuICAgICAgY29uc3QgbnVtQ2FuUGxheSA9IE1hdGgubWluKDMsIHRyZWFzdXJlc0luSGFuZC5sZW5ndGgpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUNhblBsYXk7IGkrKykge1xuICAgICAgICB0cmVhc3VyZXNJbkhhbmQgPSBoYW5kXG4gICAgICAgICAgLm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSRUFTVVJFJykpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCF0cmVhc3VyZXNJbkhhbmQubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFtzdG9yeXRlbGxlciBlZmZlY3RdIG5vIHRyZWFzdXJlcyBpbiBoYW5kYCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNlbGVjdGVkQ2FyZElkcyA9IGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgcHJvbXB0OiBgUGxheSB0cmVhc3VyZSAke2kgKyAxfSBvZiAke251bUNhblBsYXl9P2AsXG4gICAgICAgICAgcmVzdHJpY3Q6IHRyZWFzdXJlc0luSGFuZC5tYXAoY2FyZCA9PiBjYXJkLmlkKSxcbiAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICBvcHRpb25hbDogdHJ1ZSxcbiAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgIFxuICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3N0b3J5dGVsbGVyIGVmZmVjdF0gbm8gdHJlYXN1cmUgc2VsZWN0ZWRgKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWRUb1BsYXkgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgW3N0b3J5dGVsbGVyIGVmZmVjdF0gcGxheWluZyAke3NlbGVjdGVkVG9QbGF5fWApO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdwbGF5Q2FyZCcsIHtcbiAgICAgICAgICBjYXJkSWQ6IHNlbGVjdGVkQ2FyZElkc1swXSxcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFtzdG9yeXRlbGxlciBlZmZlY3RdIGRyYXdpbmcgMSBjYXJkYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHBsYXllclRyZWFzdXJlID0gY2FyZEVmZmVjdEFyZ3MubWF0Y2gucGxheWVyVHJlYXN1cmU7XG4gICAgICBcbiAgICAgIGlmIChwbGF5ZXJUcmVhc3VyZSA9PT0gMCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3N0b3J5dGVsbGVyIGVmZmVjdF0gbm8gcGxheWVyIHRyZWFzdXJlLCBub3QgZHJhd2luZyBtb3JlIGNhcmRzYCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAtcGxheWVyVHJlYXN1cmUgfSwgeyBsb2dnaW5nQ29udGV4dDogeyBzdXBwcmVzczogdHJ1ZSB9IH0pO1xuICAgICAgXG4gICAgICBjb25zb2xlLmxvZyhgW3N0b3J5dGVsbGVyIGVmZmVjdF0gZHJhd2luZyAke3BsYXllclRyZWFzdXJlfSBjYXJkc2ApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2RyYXdDYXJkJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIGNvdW50OiBwbGF5ZXJUcmVhc3VyZVxuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAnc3dhbXAtaGFnJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uTGVhdmVQbGF5OiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHRoaXNDYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGV2ZW50QXJncy5jYXJkSWQpO1xuICAgICAgICBmb3IgKGNvbnN0IHBsYXllciBvZiBhcmdzLm1hdGNoLnBsYXllcnMpIHtcbiAgICAgICAgICBhcmdzLnJlYWN0aW9uTWFuYWdlci51bnJlZ2lzdGVyVHJpZ2dlcihgc3dhbXAtaGFnOiR7dGhpc0NhcmQuaWR9OmNhcmRHYWluZWQ6JHtwbGF5ZXIuaWR9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSxcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgY29uc3QgdGhpc0NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGNvbnN0IGlkczogc3RyaW5nW10gPSBbXTtcbiAgICAgIFxuICAgICAgYWRkRHVyYXRpb25FZmZlY3QodGhpc0NhcmQsIGNhcmRFZmZlY3RBcmdzLCB7XG4gICAgICAgIGlkOiBgc3dhbXAtaGFnOiR7dGhpc0NhcmQuaWR9OnN0YXJ0VHVybmAsXG4gICAgICAgIGxpc3RlbmluZ0ZvcjogJ3N0YXJ0VHVybicsXG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29uZGl0aW9uOiBhc3luYyBjb25kaXRpb25BcmdzID0+IHtcbiAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MudHVybk51bWJlciA9PT0gY29uZGl0aW9uQXJncy5tYXRjaC50dXJuTnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICAgICAgY2FyZElkOiB0aGlzQ2FyZC5pZCxcbiAgICAgICAgICAgIHRvOiB7IGxvY2F0aW9uOiAncGxheUFyZWEnIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuICAgICAgICAgICAgdHJpZ2dlcmVkQXJncy5yZWFjdGlvbk1hbmFnZXIudW5yZWdpc3RlclRyaWdnZXIoaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3N3YW1wLWhhZyBzdGFydFR1cm4gZWZmZWN0XSBnYWluaW5nIDMgdHJlYXN1cmVgKTtcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMyB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRhcmdldFBsYXllcklkcyA9IGZpbmRPcmRlcmVkVGFyZ2V0cyh7XG4gICAgICAgIG1hdGNoOiBjYXJkRWZmZWN0QXJncy5tYXRjaCxcbiAgICAgICAgYXBwbGllc1RvOiAnQUxMX09USEVSJyxcbiAgICAgICAgc3RhcnRpbmdQbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWRcbiAgICAgIH0pLmZpbHRlcihwbGF5ZXJJZCA9PiBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbkNvbnRleHQ/LltwbGF5ZXJJZF0/LnJlc3VsdCAhPT0gJ2ltbXVuaXR5Jyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgdGFyZ2V0UGxheWVySWQgb2YgdGFyZ2V0UGxheWVySWRzKSB7XG4gICAgICAgIGNvbnN0IGlkID0gYHN3YW1wLWhhZzoke3RoaXNDYXJkLmlkfTpjYXJkR2FpbmVkOiR7dGFyZ2V0UGxheWVySWR9YDtcbiAgICAgICAgaWRzLnB1c2goaWQpO1xuICAgICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBsaXN0ZW5pbmdGb3I6ICdjYXJkR2FpbmVkJyxcbiAgICAgICAgICBwbGF5ZXJJZDogdGFyZ2V0UGxheWVySWQsXG4gICAgICAgICAgb25jZTogZmFsc2UsXG4gICAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgICBjb21wdWxzb3J5OiB0cnVlLFxuICAgICAgICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGxheWVySWQgIT09IHRhcmdldFBsYXllcklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBpZiAoIWNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLmJvdWdodCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSxcbiAgICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgICBjb25zdCBjdXJzZUNhcmRzID0gdHJpZ2dlcmVkQXJncy5maW5kQ2FyZHMoW1xuICAgICAgICAgICAgICB7IGxvY2F0aW9uOiAnYmFzaWNTdXBwbHknIH0sXG4gICAgICAgICAgICAgIHsgY2FyZEtleXM6ICdjdXJzZScgfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICghY3Vyc2VDYXJkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtzd2FtcC1oYWcgY2FyZEdhaW5lZCBlZmZlY3RdIG5vIGN1cnNlIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc3dhbXAtaGFnIGNhcmRHYWluZWQgZWZmZWN0XSBwbGF5ZXIgJHt0YXJnZXRQbGF5ZXJJZH0gZ2FpbmluZyAke2N1cnNlQ2FyZHMuc2xpY2UoLTEpWzBdfWApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBjdXJzZUNhcmRzLnNsaWNlKC0xKVswXS5pZCxcbiAgICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJ3RyYW5zbW9ncmlmeSc6IHtcbiAgICByZWdpc3RlckVmZmVjdHM6ICgpID0+IGFzeW5jIChjYXJkRWZmZWN0QXJncykgPT4ge1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQWN0aW9uJywgeyBjb3VudDogMSB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGhpc0NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGNhcmRFZmZlY3RBcmdzLmNhcmRJZCk7XG4gICAgICBcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnbW92ZUNhcmQnLCB7XG4gICAgICAgIHRvUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkLFxuICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3RhdmVybicgfVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNhcmRFZmZlY3RBcmdzLnJlYWN0aW9uTWFuYWdlci5yZWdpc3RlclJlYWN0aW9uVGVtcGxhdGUodGhpc0NhcmQuaWQsICdzdGFydFR1cm4nLCB7XG4gICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgb25jZTogdHJ1ZSxcbiAgICAgICAgYWxsb3dNdWx0aXBsZUluc3RhbmNlczogdHJ1ZSxcbiAgICAgICAgY29tcHVsc29yeTogZmFsc2UsXG4gICAgICAgIGNvbmRpdGlvbjogYXN5bmMgY29uZGl0aW9uQXJncyA9PiB7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt0cmFuc21vZ3JpZnkgc3RhcnRUdXJuIGVmZmVjdF0gY2FsbGluZyAke3RoaXNDYXJkfSB0byBwbGF5QXJlYWApO1xuICAgICAgICAgIFxuICAgICAgICAgIGF3YWl0IHRyaWdnZXJlZEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdtb3ZlQ2FyZCcsIHtcbiAgICAgICAgICAgIGNhcmRJZDogdGhpc0NhcmQuaWQsXG4gICAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXlBcmVhJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgaGFuZCA9IHRyaWdnZXJlZEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJIYW5kJywgY2FyZEVmZmVjdEFyZ3MucGxheWVySWQpO1xuICAgICAgICAgIFxuICAgICAgICAgIGxldCBzZWxlY3RlZENhcmRJZHMgPSBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnc2VsZWN0Q2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIHByb21wdDogYFRyYXNoIGNhcmRgLFxuICAgICAgICAgICAgcmVzdHJpY3Q6IGhhbmQsXG4gICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICB9KSBhcyBDYXJkSWRbXTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIXNlbGVjdGVkQ2FyZElkcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW3RyYW5zbW9ncmlmeSBzdGFydFR1cm4gZWZmZWN0XSBubyBjYXJkIHNlbGVjdGVkYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRUb1RyYXNoID0gdHJpZ2dlcmVkQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3RyYXNoQ2FyZCcsIHtcbiAgICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICAgIGNhcmRJZDogY2FyZFRvVHJhc2guaWRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCB7IGNvc3QgfSA9IHRyaWdnZXJlZEFyZ3MuY2FyZFByaWNlQ29udHJvbGxlci5hcHBseVJ1bGVzKGNhcmRUb1RyYXNoLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkcyA9IHRyaWdnZXJlZEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgICAgIHsgbG9jYXRpb246IFsnYmFzaWNTdXBwbHknLCAna2luZ2RvbVN1cHBseSddIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGtpbmQ6ICd1cFRvJyxcbiAgICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgICBhbW91bnQ6IHsgdHJlYXN1cmU6IGNvc3QudHJlYXN1cmUgKyAxLCBwb3Rpb246IGNvc3QucG90aW9uIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoIWNhcmRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFt0cmFuc21vZ3JpZnkgc3RhcnRUdXJuIGVmZmVjdF0gbm8gY2FyZHMgY29zdGluZyBsZXNzIHRoYW4gJHtjb3N0LnRyZWFzdXJlICsgMX0gdHJlYXN1cmUgYW5kICR7Y29zdC5wb3Rpb259IHBvdGlvbnNgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgc2VsZWN0ZWRDYXJkSWRzID0gYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ3NlbGVjdENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBwcm9tcHQ6IGBHYWluIGNhcmRgLFxuICAgICAgICAgICAgcmVzdHJpY3Q6IGNhcmRzLm1hcChjYXJkID0+IGNhcmQuaWQpLFxuICAgICAgICAgICAgY291bnQ6IDEsXG4gICAgICAgICAgfSkgYXMgQ2FyZElkW107XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKCFzZWxlY3RlZENhcmRJZHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFt0cmFuc21vZ3JpZnkgc3RhcnRUdXJuIGVmZmVjdF0gbm8gY2FyZHMgc2VsZWN0ZWQgdG8gZ2FpbmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBjYXJkVG9HYWluID0gdHJpZ2dlcmVkQXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKHNlbGVjdGVkQ2FyZElkc1swXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc29sZS53YXJuKGBbdHJhbnNtb2dyaWZ5IHN0YXJ0VHVybiBlZmZlY3RdIGdhaW5pbmcgJHtjYXJkVG9HYWlufSB0byBoYW5kYCk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgdHJpZ2dlcmVkQXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9HYWluLmlkLFxuICAgICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJIYW5kJyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxuICAndHJlYXN1cmUtaHVudGVyJzoge1xuICAgIHJlZ2lzdGVyTGlmZUN5Y2xlTWV0aG9kczogKCkgPT4gKHtcbiAgICAgIG9uRGlzY2FyZGVkOiBhc3luYyAoYXJncywgZXZlbnRBcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhcmQgPSBhcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoZXZlbnRBcmdzLmNhcmRJZCk7XG4gICAgICAgIGF3YWl0IGFkZFRyYXZlbGxlckVmZmVjdChjYXJkLCAnd2FycmlvcicsIGFyZ3MsIGV2ZW50QXJncyk7XG4gICAgICB9XG4gICAgfSksXG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cmUtaHVudGVyIGVmZmVjdF0gZ2FpbmluZyAxIGFjdGlvbiwgZ2FpbmluZyAxIHRyZWFzdXJlYCk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5BY3Rpb24nLCB7IGNvdW50OiAxIH0pO1xuICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluVHJlYXN1cmUnLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzaWx2ZXJDYXJkcyA9IGNhcmRFZmZlY3RBcmdzLmZpbmRDYXJkcyhbXG4gICAgICAgIHsgbG9jYXRpb246ICdiYXNpY1N1cHBseScgfSxcbiAgICAgICAgeyBjYXJkS2V5czogJ3NpbHZlcicgfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGlmICghc2lsdmVyQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cmUtaHVudGVyIGVmZmVjdF0gbm8gc2lsdmVyIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJpZ2h0UGxheWVyID0gZ2V0UGxheWVyU3RhcnRpbmdGcm9tKHtcbiAgICAgICAgc3RhcnRGcm9tSWR4OiBjYXJkRWZmZWN0QXJncy5tYXRjaC5jdXJyZW50UGxheWVyVHVybkluZGV4LFxuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGRpc3RhbmNlOiAtMVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNhcmRzR2FpbmVkID0gY2FyZEVmZmVjdEFyZ3MubWF0Y2guc3RhdHMuY2FyZHNHYWluZWRCeVR1cm4/LltjYXJkRWZmZWN0QXJncy5tYXRjaC50dXJuTnVtYmVyXVxuICAgICAgICA/Lm1hcChjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKVxuICAgICAgICA/LmZpbHRlcihjYXJkID0+IGNhcmQub3duZXIgPT09IHJpZ2h0UGxheWVyLmlkKSA/PyBbXTtcbiAgICAgIFxuICAgICAgY29uc3QgbnVtVG9HYWluID0gTWF0aC5taW4oc2lsdmVyQ2FyZHMubGVuZ3RoLCBjYXJkc0dhaW5lZC5sZW5ndGgpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVRvR2FpbjsgaSsrKSB7XG4gICAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpbkNhcmQnLCB7XG4gICAgICAgICAgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkLFxuICAgICAgICAgIGNhcmRJZDogc2lsdmVyQ2FyZHMuc2xpY2UoLWkgLSAxKVswXS5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAndHJlYXN1cmUtdHJvdmUnOiB7XG4gICAgcmVnaXN0ZXJFZmZlY3RzOiAoKSA9PiBhc3luYyAoY2FyZEVmZmVjdEFyZ3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cmUtdHJvdmUgZWZmZWN0XSBnYWluaW5nIDIgdHJlYXN1cmVgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZ2FpblRyZWFzdXJlJywgeyBjb3VudDogMiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgZ29sZEFuZENvcHBlckNhcmRzID0gY2FyZEVmZmVjdEFyZ3MuZmluZENhcmRzKFtcbiAgICAgICAgeyBsb2NhdGlvbjogJ2Jhc2ljU3VwcGx5JyB9LFxuICAgICAgICB7IGNhcmRLZXlzOiBbJ2dvbGQnLCAnY29wcGVyJ10gfVxuICAgICAgXSk7XG4gICAgICBcbiAgICAgIGNvbnN0IFtnb2xkQ2FyZHMsIGNvcHBlckNhcmRzXSA9IGdvbGRBbmRDb3BwZXJDYXJkcy5yZWR1Y2UoKGFjYywgbmV4dENhcmQpID0+IHtcbiAgICAgICAgaWYgKG5leHRDYXJkLmNhcmRLZXkgPT09ICdnb2xkJykge1xuICAgICAgICAgIGFjY1swXS5wdXNoKG5leHRDYXJkKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBhY2NbMV0ucHVzaChuZXh0Q2FyZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sIFtbXSwgW11dIGFzIENhcmRbXVtdKTtcbiAgICAgIFxuICAgICAgaWYgKCFnb2xkQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cmUtdHJvdmUgZWZmZWN0XSBubyBnb2xkIGNhcmRzIGluIHN1cHBseWApO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IGdvbGRDYXJkVG9HYWluID0gZ29sZENhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgY29uc29sZS5sb2coYFt0cmVhc3VyZS10cm92ZSBlZmZlY3RdIGdhaW5pbmcgJHtnb2xkQ2FyZFRvR2Fpbn1gKTtcbiAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdnYWluQ2FyZCcsIHtcbiAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgY2FyZElkOiBnb2xkQ2FyZFRvR2Fpbi5pZCxcbiAgICAgICAgICB0bzogeyBsb2NhdGlvbjogJ3BsYXllckRpc2NhcmQnIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmICghY29wcGVyQ2FyZHMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbdHJlYXN1cmUtdHJvdmUgZWZmZWN0XSBubyBjb3BwZXIgY2FyZHMgaW4gc3VwcGx5YCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc3QgY29wcGVyQ2FyZFRvR2FpbiA9IGNvcHBlckNhcmRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgY29uc29sZS5sb2coYFt0cmVhc3VyZS10cm92ZSBlZmZlY3RdIGdhaW5pbmcgJHtjb3BwZXJDYXJkVG9HYWlufWApO1xuICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5DYXJkJywge1xuICAgICAgICAgIHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgICBjYXJkSWQ6IGNvcHBlckNhcmRUb0dhaW4uaWQsXG4gICAgICAgICAgdG86IHsgbG9jYXRpb246ICdwbGF5ZXJEaXNjYXJkJyB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgfVxuICB9LFxuICAnd2Fycmlvcic6IHtcbiAgICByZWdpc3RlckxpZmVDeWNsZU1ldGhvZHM6ICgpID0+ICh7XG4gICAgICBvbkRpc2NhcmRlZDogYXN5bmMgKGFyZ3MsIGV2ZW50QXJncykgPT4ge1xuICAgICAgICBjb25zdCBjYXJkID0gYXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGV2ZW50QXJncy5jYXJkSWQpO1xuICAgICAgICBhd2FpdCBhZGRUcmF2ZWxsZXJFZmZlY3QoY2FyZCwgJ2hlcm8nLCBhcmdzLCBldmVudEFyZ3MpO1xuICAgICAgfVxuICAgIH0pLFxuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3dhcnJpb3IgZWZmZWN0XSBkcmF3aW5nIDIgY2FyZHNgKTtcbiAgICAgIGF3YWl0IGNhcmRFZmZlY3RBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZHJhd0NhcmQnLCB7IHBsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCwgY291bnQ6IDIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRyYXZlbGxlcnNJblBsYXkgPSBnZXRDYXJkc0luUGxheShjYXJkRWZmZWN0QXJncy5maW5kQ2FyZHMpXG4gICAgICAgIC5maWx0ZXIoY2FyZCA9PiBjYXJkLm93bmVyID09PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCAmJiBjYXJkLnR5cGUuaW5jbHVkZXMoJ1RSQVZFTExFUicpKTtcbiAgICAgIFxuICAgICAgaWYgKCF0cmF2ZWxsZXJzSW5QbGF5Lmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgW3dhcnJpb3IgZWZmZWN0XSBubyB0cmF2ZWxsZXJzIGluIHBsYXlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0YXJnZXRQbGF5ZXJJZHMgPSBmaW5kT3JkZXJlZFRhcmdldHMoe1xuICAgICAgICBtYXRjaDogY2FyZEVmZmVjdEFyZ3MubWF0Y2gsXG4gICAgICAgIGFwcGxpZXNUbzogJ0FMTF9PVEhFUicsXG4gICAgICAgIHN0YXJ0aW5nUGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkXG4gICAgICB9KS5maWx0ZXIocGxheWVySWQgPT4gY2FyZEVmZmVjdEFyZ3MucmVhY3Rpb25Db250ZXh0Py5bcGxheWVySWRdPy5yZXN1bHQgIT09ICdpbW11bml0eScpO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHRhcmdldFBsYXllcklkIG9mIHRhcmdldFBsYXllcklkcykge1xuICAgICAgICBjb25zdCBkZWNrID0gY2FyZEVmZmVjdEFyZ3MuY2FyZFNvdXJjZUNvbnRyb2xsZXIuZ2V0U291cmNlKCdwbGF5ZXJEZWNrJywgdGFyZ2V0UGxheWVySWQpO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmF2ZWxsZXJzSW5QbGF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGRlY2subGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3dhcnJpb3IgZWZmZWN0XSBubyBjYXJkcyBpbiBkZWNrLCBzaHVmZmxpbmdgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCdzaHVmZmxlRGVjaycsIHsgcGxheWVySWQ6IGNhcmRFZmZlY3RBcmdzLnBsYXllcklkIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoZGVjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYFt3YXJyaW9yIGVmZmVjdF0gc3RpbGwgZW1wdHksIG5vIGNhcmRzIHRvIGxvb2sgYXRgKTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGNhcmRUb0Rpc2NhcmQgPSBjYXJkRWZmZWN0QXJncy5jYXJkTGlicmFyeS5nZXRDYXJkKGRlY2suc2xpY2UoLTEpWzBdKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3dhcnJpb3IgZWZmZWN0XSBkaXNjYXJkaW5nICR7Y2FyZFRvRGlzY2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2Rpc2NhcmRDYXJkJywge1xuICAgICAgICAgICAgcGxheWVySWQ6IHRhcmdldFBsYXllcklkLFxuICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9EaXNjYXJkLmlkXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgeyBjb3N0IH0gPSBjYXJkRWZmZWN0QXJncy5jYXJkUHJpY2VDb250cm9sbGVyLmFwcGx5UnVsZXMoY2FyZFRvRGlzY2FyZCwgeyBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGNvc3QudHJlYXN1cmUgPT09IDMgfHwgY29zdC50cmVhc3VyZSA9PT0gNCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFt3YXJyaW9yIGVmZmVjdF0gY2FyZCBjb3N0cyAzIG9yIDMsIHRyYXNoaW5nICR7Y2FyZFRvRGlzY2FyZH1gKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgY2FyZEVmZmVjdEFyZ3MucnVuR2FtZUFjdGlvbkRlbGVnYXRlKCd0cmFzaENhcmQnLCB7XG4gICAgICAgICAgICAgIHBsYXllcklkOiB0YXJnZXRQbGF5ZXJJZCxcbiAgICAgICAgICAgICAgY2FyZElkOiBjYXJkVG9EaXNjYXJkLmlkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICd3aW5lLW1lcmNoYW50Jzoge1xuICAgIHJlZ2lzdGVyRWZmZWN0czogKCkgPT4gYXN5bmMgKGNhcmRFZmZlY3RBcmdzKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhgW3dpbmUtbWVyY2hhbnQgZWZmZWN0XSBnYWluaW5nIDQgdHJlYXN1cmUsIGFuZCAxIGJ1eWApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5UcmVhc3VyZScsIHsgY291bnQ6IDQgfSk7XG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ2dhaW5CdXknLCB7IGNvdW50OiAxIH0pO1xuICAgICAgXG4gICAgICBjb25zdCB0aGlzQ2FyZCA9IGNhcmRFZmZlY3RBcmdzLmNhcmRMaWJyYXJ5LmdldENhcmQoY2FyZEVmZmVjdEFyZ3MuY2FyZElkKTtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFt3aW5lLW1lcmNoYW50IGVmZmVjdF0gbW92aW5nICR7dGhpc0NhcmR9IHRvIHRhdmVybmApO1xuICAgICAgXG4gICAgICBhd2FpdCBjYXJkRWZmZWN0QXJncy5ydW5HYW1lQWN0aW9uRGVsZWdhdGUoJ21vdmVDYXJkJywge1xuICAgICAgICB0b1BsYXllcklkOiBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCxcbiAgICAgICAgY2FyZElkOiB0aGlzQ2FyZC5pZCxcbiAgICAgICAgdG86IHsgbG9jYXRpb246ICd0YXZlcm4nIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjYXJkRWZmZWN0QXJncy5yZWFjdGlvbk1hbmFnZXIucmVnaXN0ZXJSZWFjdGlvblRlbXBsYXRlKHRoaXNDYXJkLmlkLCAnZW5kVHVyblBoYXNlJywge1xuICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgIG9uY2U6IHRydWUsXG4gICAgICAgIGNvbXB1bHNvcnk6IGZhbHNlLFxuICAgICAgICBhbGxvd011bHRpcGxlSW5zdGFuY2VzOiB0cnVlLFxuICAgICAgICBjb25kaXRpb246IGFzeW5jIGNvbmRpdGlvbkFyZ3MgPT4ge1xuICAgICAgICAgIGlmIChnZXRUdXJuUGhhc2UoY29uZGl0aW9uQXJncy50cmlnZ2VyLmFyZ3MucGhhc2VJbmRleCkgIT09ICdidXknKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKGNvbmRpdGlvbkFyZ3MudHJpZ2dlci5hcmdzLnBsYXllcklkICE9PSBjYXJkRWZmZWN0QXJncy5wbGF5ZXJJZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIGlmIChjb25kaXRpb25BcmdzLm1hdGNoLnBsYXllclRyZWFzdXJlIDwgMikgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICB0cmlnZ2VyZWRFZmZlY3RGbjogYXN5bmMgdHJpZ2dlcmVkQXJncyA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFt3aW5lLW1lcmNoYW50IGVuZFR1cm5QaGFzZSBlZmZlY3RdIGRpc2NhcmRpbmcgJHt0aGlzQ2FyZH1gKTtcbiAgICAgICAgICBcbiAgICAgICAgICBhd2FpdCB0cmlnZ2VyZWRBcmdzLnJ1bkdhbWVBY3Rpb25EZWxlZ2F0ZSgnZGlzY2FyZENhcmQnLCB7XG4gICAgICAgICAgICBwbGF5ZXJJZDogY2FyZEVmZmVjdEFyZ3MucGxheWVySWQsXG4gICAgICAgICAgICBjYXJkSWQ6IHRoaXNDYXJkLmlkXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBleHBhbnNpb247Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVNBLFNBQVMsa0JBQWtCLFFBQVEsc0NBQXNDO0FBQ3pFLFNBQVMsZ0JBQWdCLFFBQVEsNEJBQTRCO0FBQzdELFNBQVMscUJBQXFCLFFBQVEsNENBQTRDO0FBQ2xGLFNBQVMsY0FBYyxRQUFRLG1DQUFtQztBQUNsRSxTQUFTLFlBQVksUUFBUSxnQ0FBZ0M7QUFDN0QsU0FBUyxTQUFTLFFBQVEsb0JBQW9CO0FBRTlDLE1BQU0scUJBQXFCLE9BQU8sTUFBWSxVQUFtQixTQUF1QztFQUN0RyxJQUFJLENBQUMsaUJBQWlCLFVBQVUsZ0JBQWdCLEVBQUUsV0FBVztJQUMzRDtFQUNGO0VBRUEsTUFBTSxXQUFXLFFBQVEsU0FBUyxDQUFDO0lBQ2pDO01BQUUsVUFBVTtRQUFDO1FBQWU7T0FBZ0I7SUFBQztJQUM3QztNQUFFLFVBQVU7SUFBUztHQUN0QjtFQUVELElBQUksQ0FBQyxTQUFTLE1BQU0sRUFBRTtJQUNwQixRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLE9BQU8sQ0FBQyx3QkFBd0IsRUFBRSxTQUFTLGdCQUFnQixDQUFDO0lBQ2pGO0VBQ0Y7RUFFQSxNQUFNLFVBQVUsU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtFQUVyQyxNQUFNLFNBQVMsTUFBTSxRQUFRLHFCQUFxQixDQUFDLGNBQWM7SUFDL0QsVUFBVSxVQUFVLFFBQVE7SUFDNUIsUUFBUSxDQUFDLFNBQVMsRUFBRSxLQUFLLFFBQVEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzVELGVBQWU7TUFDYjtRQUFFLE9BQU87UUFBVSxRQUFRO01BQUU7TUFDN0I7UUFBRSxPQUFPO1FBQVksUUFBUTtNQUFFO0tBQ2hDO0VBQ0g7RUFFQSxJQUFJLE9BQU8sTUFBTSxLQUFLLEdBQUc7SUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxPQUFPLENBQUMsK0NBQStDLENBQUM7SUFDN0U7RUFDRjtFQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssT0FBTyxDQUFDLDRCQUE0QixFQUFFLEtBQUssZUFBZSxDQUFDO0VBRWhGLE1BQU0sUUFBUSxxQkFBcUIsQ0FBQyxZQUFZO0lBQzlDLFFBQVEsS0FBSyxFQUFFO0lBQ2YsSUFBSTtNQUFFLFVBQVU7SUFBZ0I7RUFDbEM7RUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxRQUFRLGdCQUFnQixDQUFDO0VBRXBGLE1BQU0sUUFBUSxxQkFBcUIsQ0FBQyxZQUFZO0lBQzlDLFlBQVksVUFBVSxRQUFRO0lBQzlCLFFBQVEsUUFBUSxFQUFFO0lBQ2xCLElBQUk7TUFBRSxVQUFVO0lBQWdCO0VBQ2xDO0FBQ0Y7QUFFQTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLE1BQU0sb0JBQW9CLENBQTZCLE1BQVksU0FBb0M7RUFDNUcsa0hBQWtIO0VBQ2xILDJDQUEyQztFQUMzQyxRQUFRLGVBQWUsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUUsRUFBRSxrQkFBa0I7SUFDeEUsVUFBVSxRQUFRLFFBQVE7SUFDMUIsTUFBTTtJQUNOLHdCQUF3QjtJQUN4QixXQUFXLE9BQU07TUFDZixJQUFJLGFBQWEsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBTSxXQUFXLE9BQU87TUFDOUUsT0FBTztJQUNUO0lBQ0EsbUJBQW1CLE9BQU07TUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxPQUFPLENBQUMsK0NBQStDLENBQUM7TUFFN0UsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7UUFDcEQsUUFBUSxLQUFLLEVBQUU7UUFDZixJQUFJO1VBQUUsVUFBVTtRQUFpQjtNQUNuQztJQUNGO0VBQ0Y7RUFFQSxvQkFBb0IsVUFBVTtFQUU5Qiw4REFBOEQ7RUFFOUQsS0FBSyxNQUFNLDRCQUE0QixrQkFBbUI7SUFDeEQsUUFBUSxlQUFlLENBQUMsd0JBQXdCLENBQUM7RUFDbkQ7QUFDRixFQUFDO0FBRUQsTUFBTSxZQUFpQztFQUNyQyxVQUFVO0lBQ1IsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sRUFBRSxVQUFVLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDL0U7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFVBQVU7VUFDZDtZQUFFLE9BQU87WUFBZSxRQUFRO1VBQUU7VUFDbEM7WUFBRSxPQUFPO1lBQWdCLFFBQVE7VUFBRTtVQUNuQztZQUFFLE9BQU87WUFBaUIsUUFBUTtVQUFFO1NBQ3JDO1FBRUQsTUFBTSxXQUFXO1VBQ2YsTUFBTSxTQUFTLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1lBQ3RFLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLFFBQVE7WUFDUixlQUFlO1VBQ2pCO1VBRUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxHQUFHO1lBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUM7WUFDaEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtjQUFFLE9BQU87WUFBRTtVQUN4RSxPQUNLLElBQUksT0FBTyxNQUFNLEtBQUssR0FBRztZQUM1QixNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7WUFDaEcsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7Y0FDL0UsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxDQUFDLFVBQVUsQ0FBQztjQUNwQixVQUFVO2NBQ1YsT0FBTztZQUNUO1lBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7Y0FDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztZQUNoRCxPQUNLO2NBQ0gsTUFBTSxjQUFjLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtjQUV6RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHlCQUF5QixFQUFFLFlBQVksU0FBUyxDQUFDO2NBRTlELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxhQUFhO2dCQUN0RCxVQUFVLGVBQWUsUUFBUTtnQkFDakMsUUFBUSxZQUFZLEVBQUU7Y0FDeEI7WUFDRjtVQUNGLE9BQ0s7WUFDSCxNQUFNLGNBQWMsZUFBZSxTQUFTLENBQUM7Y0FDM0M7Z0JBQUUsVUFBVTtjQUFjO2NBQzFCO2dCQUFFLFVBQVU7Y0FBUzthQUN0QjtZQUVELElBQUksQ0FBQyxZQUFZLE1BQU0sRUFBRTtjQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1lBQ3pELE9BQ0s7Y0FDSCxNQUFNLG1CQUFtQixZQUFZLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO2NBRWpELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2dCQUNyRCxVQUFVLGVBQWUsUUFBUTtnQkFDakMsUUFBUSxpQkFBaUIsRUFBRTtnQkFDM0IsSUFBSTtrQkFBRSxVQUFVO2dCQUFnQjtjQUNsQztZQUNGO1VBQ0Y7UUFDRjtRQUVBLE1BQU07UUFFTixNQUFNLGFBQWEsZUFBZSxLQUFLLENBQUMsVUFBVTtRQUVsRCxNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUVyRSxrQkFBa0IsTUFBTSxnQkFBZ0I7VUFDdEMsSUFBSSxDQUFDLE9BQU8sRUFBRSxlQUFlLE1BQU0sQ0FBQyxVQUFVLENBQUM7VUFDL0MsY0FBYztVQUNkLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE1BQU07VUFDTix3QkFBd0I7VUFDeEIsWUFBWTtVQUNaLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxZQUFZLE9BQU87WUFDakUsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU07WUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztZQUU5RCxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUNwRCxRQUFRLEtBQUssRUFBRTtjQUNmLElBQUk7Z0JBQUUsVUFBVTtjQUFXO1lBQzdCO1lBRUEsTUFBTTtVQUNSO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsYUFBYTtJQUNYLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxrRUFBa0UsQ0FBQztRQUNoRixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFDcEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7UUFFaEcsSUFBSSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDN0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLGNBQWMsQ0FBQztVQUN4QixVQUFVO1VBQ1YsT0FBTztZQUFFLE1BQU07WUFBUSxPQUFPLEtBQUssTUFBTTtVQUFDO1VBQzFDLFVBQVU7UUFDWjtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMsb0NBQW9DLENBQUM7VUFDbEQ7UUFDRjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsNEJBQTRCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQztRQUVwRixLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUN4RCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRO1VBQ1Y7UUFDRjtRQUVBLE1BQU0sZ0JBQWdCLGVBQWUsU0FBUyxDQUFDO1VBQzdDO1lBQUUsVUFBVTtjQUFDO2NBQWU7YUFBZ0I7VUFBQztVQUM3QztZQUFFLE1BQU07WUFBUSxVQUFVLGVBQWUsUUFBUTtZQUFFLFFBQVE7Y0FBRSxVQUFXLGdCQUFnQixNQUFNLElBQUk7WUFBRztVQUFFO1NBQ3hHO1FBRUQsSUFBSSxDQUFDLGNBQWMsTUFBTSxFQUFFO1VBQ3pCLFFBQVEsR0FBRyxDQUFDLENBQUMsOENBQThDLEVBQUUsZ0JBQWdCLE1BQU0sSUFBSSxFQUFFLFNBQVMsQ0FBQztVQUNuRztRQUNGO1FBRUEsa0JBQWtCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQ3pFLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFFBQVEsQ0FBQyxTQUFTLENBQUM7VUFDbkIsVUFBVSxjQUFjLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1VBQzNDLE9BQU87VUFDUCxVQUFVO1FBQ1o7UUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtVQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDO1VBQ2pEO1FBQ0Y7UUFFQSxNQUFNLGFBQWEsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBRXhFLFFBQVEsR0FBRyxDQUFDLENBQUMsNEJBQTRCLEVBQUUsV0FBVyxRQUFRLENBQUM7UUFFL0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFDckQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxXQUFXLEVBQUU7VUFDckIsSUFBSTtZQUFFLFVBQVU7VUFBYTtRQUMvQjtNQUNGO0VBQ0Y7RUFDQSxpQkFBaUI7SUFDZiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLEtBQUssZUFBZSxDQUFDLGlCQUFpQixDQUFDLENBQUMsY0FBYyxFQUFFLFVBQVUsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQUN0RjtRQUNBLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLEtBQUssZUFBZSxDQUFDLGlCQUFpQixDQUFDLENBQUMsY0FBYyxFQUFFLFVBQVUsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUN2RjtRQUNBLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLEtBQUssZUFBZSxDQUFDLHdCQUF3QixDQUFDO1lBQzVDLElBQUksQ0FBQyxjQUFjLEVBQUUsVUFBVSxNQUFNLENBQUMsV0FBVyxDQUFDO1lBQ2xELGNBQWM7WUFDZCxVQUFVLFVBQVUsUUFBUTtZQUM1QixNQUFNO1lBQ04sWUFBWTtZQUNaLHdCQUF3QjtZQUN4QixXQUFXLE9BQU07Y0FDZixJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEtBQUssVUFBVSxRQUFRLEVBQUUsT0FBTztjQUN2RSxNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNO2NBQ3RGLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxPQUFPO2NBQ2hELE9BQU87WUFDVDtZQUNBLG1CQUFtQixPQUFNO2NBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsdURBQXVELENBQUM7Y0FFckUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Z0JBQ3BELFVBQVUsVUFBVSxRQUFRO2dCQUM1QixRQUFRLFVBQVUsTUFBTTtjQUMxQjtZQUNGO1VBQ0Y7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsdURBQXVELENBQUM7UUFDckUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBQzNGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBRXBFLE1BQU0sYUFBYSxlQUFlLEtBQUssQ0FBQyxVQUFVO1FBRWxELE1BQU0sT0FBTyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1FBQ3JFLGtCQUFrQixNQUFNLGdCQUFnQjtVQUN0QyxJQUFJLENBQUMsY0FBYyxFQUFFLGVBQWUsTUFBTSxDQUFDLFVBQVUsQ0FBQztVQUN0RCxjQUFjO1VBQ2QsVUFBVSxlQUFlLFFBQVE7VUFDakMsTUFBTTtVQUNOLFlBQVk7VUFDWix3QkFBd0I7VUFDeEIsV0FBVyxPQUFNO1lBQ2YsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFDNUUsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxLQUFLLFlBQVksT0FBTztZQUNqRSxPQUFPO1VBQ1Q7VUFDQSxtQkFBbUIsT0FBTTtZQUN2QixNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUNwRCxRQUFRLEtBQUssRUFBRTtjQUNmLElBQUk7Z0JBQUUsVUFBVTtjQUFXO1lBQzdCO1lBQ0EsUUFBUSxHQUFHLENBQUMsQ0FBQyxtREFBbUQsQ0FBQztZQUNqRSxNQUFNLGNBQWMscUJBQXFCLENBQUMsZ0JBQWdCO2NBQUUsT0FBTztZQUFFO1VBQ3ZFO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsWUFBWTtJQUNWLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLEVBQUUsVUFBVSxNQUFNLENBQUMsa0JBQWtCLENBQUM7VUFDdkYsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxTQUFTLEVBQUUsVUFBVSxNQUFNLENBQUMsa0JBQWtCLENBQUM7UUFDekY7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUVwRSxNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUN6RSxrQkFBa0IsVUFBVSxnQkFBZ0I7VUFDMUM7WUFDRSxJQUFJLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLGtCQUFrQixDQUFDO1lBQy9DLGNBQWM7WUFDZCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxNQUFNO1lBQ04sWUFBWTtZQUNaLHdCQUF3QjtZQUN4QixXQUFXLE9BQU07Y0FDZixNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNO2NBQ3RGLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxPQUFPO2NBQ2hELElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO2NBQzVFLE9BQU87WUFDVDtZQUNBLG1CQUFtQixPQUFNO2NBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsNERBQTRELENBQUM7Y0FDMUUsT0FBTztZQUNUO1VBQ0Y7VUFDQTtZQUNFLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsa0JBQWtCLENBQUM7WUFDL0MsY0FBYztZQUNkLFVBQVUsZUFBZSxRQUFRO1lBQ2pDLE1BQU07WUFDTixZQUFZO1lBQ1osd0JBQXdCO1lBQ3hCLFdBQVcsT0FBTTtjQUNmLE1BQU0sYUFBYSxjQUFjLFdBQVcsQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU07Y0FDdEYsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLE9BQU87Y0FDaEQsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87Y0FDNUUsT0FBTztZQUNUO1lBQ0EsbUJBQW1CLE9BQU07Y0FDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyw0REFBNEQsQ0FBQztjQUMxRSxNQUFNLGNBQWMscUJBQXFCLENBQUMsY0FBYztnQkFBRSxPQUFPO2NBQUUsR0FBRztnQkFBRSxnQkFBZ0I7a0JBQUUsUUFBUSxTQUFTLEVBQUU7Z0JBQUM7Y0FBRTtZQUNsSDtVQUNGO1NBQ0Q7TUFDSDtFQUNGO0VBQ0EscUJBQXFCO0lBQ25CLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyw2Q0FBNkMsQ0FBQztRQUMzRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBRXRFLFFBQVEsR0FBRyxDQUFDLENBQUMsb0RBQW9ELENBQUM7UUFFbEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFDckQsWUFBWSxlQUFlLFFBQVE7VUFDbkMsUUFBUSxlQUFlLE1BQU07VUFDN0IsSUFBSTtZQUFFLFVBQVU7VUFBUztRQUMzQjtRQUVBLE1BQU0sV0FBVyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1FBRXpFLGVBQWUsZUFBZSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsRUFBRSxFQUFFLGNBQWM7VUFDakYsVUFBVSxlQUFlLFFBQVE7VUFDakMsTUFBTTtVQUNOLFlBQVk7VUFDWix3QkFBd0I7VUFDeEIsV0FBVyxPQUFNO1lBQ2YsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFDNUUsTUFBTSxhQUFhLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUN0RixJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsT0FBTztZQUNoRCxPQUFPO1VBQ1Q7VUFDQSxtQkFBbUIsT0FBTTtZQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDBEQUEwRCxDQUFDO1lBRXhFLE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxZQUFZO2NBQ3BELFFBQVEsU0FBUyxFQUFFO2NBQ25CLElBQUk7Z0JBQUUsVUFBVTtjQUFXO1lBQzdCO1lBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyx1REFBdUQsQ0FBQztZQUNyRSxNQUFNLGNBQWMscUJBQXFCLENBQUMsY0FBYztjQUFFLE9BQU87WUFBRTtVQUNyRTtRQUNGO01BQ0Y7RUFDRjtFQUNBLFlBQVk7SUFDViwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1VBQ3RELE1BQU0sbUJBQW1CLE1BQU0sV0FBVyxNQUFNO1FBQ2xEO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1FBQ2hHLE1BQU0sb0JBQW9CLEtBQUssR0FBRyxDQUFDLGVBQWUsV0FBVyxDQUFDLE9BQU8sRUFDbEUsTUFBTSxDQUFDLENBQUEsT0FBUSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUM7UUFFckMsSUFBSSxDQUFDLGtCQUFrQixNQUFNLEVBQUU7VUFDN0IsUUFBUSxHQUFHLENBQUMsQ0FBQyx5Q0FBeUMsQ0FBQztVQUN2RDtRQUNGO1FBRUEsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO1VBQzFCLFVBQVUsa0JBQWtCLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO1VBQy9DLE9BQU87VUFDUCxVQUFVO1FBQ1o7UUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtVQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLGtDQUFrQyxDQUFDO1VBQ2hEO1FBQ0Y7UUFFQSxNQUFNLHFCQUFxQixlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFFaEYsUUFBUSxHQUFHLENBQUMsQ0FBQywwQkFBMEIsRUFBRSxtQkFBbUIsTUFBTSxDQUFDO1FBRW5FLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUs7VUFDMUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxtQkFBbUIsRUFBRTtZQUM3QixXQUFXO2NBQ1QsWUFBWTtZQUNkO1VBQ0Y7UUFDRjtRQUVBLE1BQU0sU0FBUyxlQUFlLFNBQVMsQ0FBQztVQUN0QztZQUFFLFVBQVU7Y0FBQztjQUFlO2FBQWdCO1VBQUM7VUFDN0M7WUFBRSxVQUFVLG1CQUFtQixPQUFPO1VBQUM7U0FDeEM7UUFFRCxJQUFJLENBQUMsT0FBTyxNQUFNLEVBQUU7VUFDbEIsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxtQkFBbUIsVUFBVSxDQUFDO1VBQzVFO1FBQ0Y7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQixFQUFFLG9CQUFvQjtRQUU3RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNyRCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLE9BQU8sS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFDM0IsSUFBSTtZQUFFLFVBQVU7VUFBZ0I7UUFDbEM7TUFDRjtFQUNGO0VBQ0EsaUJBQWlCO0lBQ2YseUJBQXlCLElBQU0sQ0FBQztRQUU5QixNQUFNLG1CQUFtQixLQUFLLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxVQUFVLEtBQUssT0FBTyxFQUNoRixHQUFHLENBQUMsS0FBSyxXQUFXLENBQUMsT0FBTyxFQUM1QixNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssT0FBTyxLQUFLO1FBRW5DLFFBQVEsR0FBRyxDQUFDLENBQUMsdUVBQXVFLEVBQUUsaUJBQWlCLE1BQU0sQ0FBQyxZQUFZLEVBQUUsS0FBSyxPQUFPLEVBQUU7UUFFMUksT0FBTyxpQkFBaUIsTUFBTSxHQUFHO01BQ25DO0lBQ0EsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUV6RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLFNBQVMsY0FBYyxDQUFDO1FBRXJFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFlBQVksZUFBZSxRQUFRO1VBQ25DLFFBQVEsZUFBZSxNQUFNO1VBQzdCLElBQUk7WUFBRSxVQUFVO1VBQVM7UUFDM0I7TUFDRjtFQUNGO0VBQ0EsV0FBVztJQUNULDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxRQUFRLEVBQUUsVUFBVSxNQUFNLENBQUMsVUFBVSxDQUFDO1FBQ2hGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsQ0FBQztRQUMvQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUVwRSxNQUFNLFVBQVU7VUFDZCxRQUFRLEdBQUcsQ0FBQyxDQUFDLG9DQUFvQyxDQUFDO1VBQ2xELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQUUsVUFBVSxlQUFlLFFBQVE7WUFBRSxPQUFPO1VBQUU7VUFFckcsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDL0UsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxDQUFDLGFBQWEsQ0FBQztZQUN2QixVQUFVLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1lBQzdGLE9BQU87VUFDVDtVQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1lBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUM7WUFDaEQ7VUFDRjtVQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMsNEJBQTRCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxNQUFNLENBQUM7VUFFekUsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7WUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUTtZQUNWO1VBQ0Y7UUFDRjtRQUVBLE1BQU0sYUFBYSxlQUFlLEtBQUssQ0FBQyxVQUFVO1FBRWxELE1BQU07UUFFTixNQUFNLE9BQU8sZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUNyRSxrQkFBa0IsTUFBTSxnQkFBZ0I7VUFDdEMsSUFBSSxDQUFDLFFBQVEsRUFBRSxlQUFlLE1BQU0sQ0FBQyxVQUFVLENBQUM7VUFDaEQsY0FBYztVQUNkLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxZQUFZLE9BQU87WUFDakUsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFDNUUsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU07WUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQztZQUNoRCxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUNwRCxRQUFRLEtBQUssRUFBRTtjQUNmLElBQUk7Z0JBQUUsVUFBVTtjQUFXO1lBQzdCO1lBQ0EsTUFBTTtVQUNSO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsYUFBYTtJQUNYLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxXQUFXLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLE1BQU07UUFFekUsUUFBUSxHQUFHLENBQUMsQ0FBQywwQkFBMEIsRUFBRSxTQUFTLGNBQWMsQ0FBQztRQUVqRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNyRCxZQUFZLGVBQWUsUUFBUTtVQUNuQyxRQUFRLGVBQWUsTUFBTTtVQUM3QixJQUFJO1lBQUUsVUFBVTtVQUFTO1FBQzNCO1FBRUEsZUFBZSxlQUFlLENBQUMsd0JBQXdCLENBQUMsU0FBUyxFQUFFLEVBQUUsY0FBYztVQUNqRixVQUFVLGVBQWUsUUFBUTtVQUNqQyxNQUFNO1VBQ04sWUFBWTtVQUNaLHdCQUF3QjtVQUN4QixXQUFXLE9BQU07WUFDZixJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEtBQUssZUFBZSxRQUFRLEVBQUUsT0FBTztZQUM1RSxNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNO1lBQ3RGLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxjQUFjLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxZQUFZO2NBQUUsVUFBVSxlQUFlLFFBQVE7WUFBQztZQUM5RyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLEtBQUssTUFBTSxJQUFJLEtBQUssTUFBTSxJQUFJLENBQUMsR0FBRyxPQUFPO1lBQ3JFLE9BQU87VUFDVDtVQUNBLG1CQUFtQixPQUFNO1lBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLEVBQUUsU0FBUyxhQUFhLENBQUM7WUFFckUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNO1lBRXRGLE1BQU0sU0FBUyxjQUFjLFNBQVMsQ0FBQztjQUNyQztnQkFBRSxVQUFVO2tCQUFDO2tCQUFlO2lCQUFnQjtjQUFDO2NBQzdDO2dCQUFFLFVBQVUsV0FBVyxPQUFPO2NBQUM7YUFDaEM7WUFFRCxJQUFJLENBQUMsT0FBTyxNQUFNLEVBQUU7Y0FDbEIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsRUFBRSxXQUFXLFVBQVUsQ0FBQztjQUMxRTtZQUNGO1lBRUEsTUFBTSxhQUFhLE9BQU8sS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFFdEMsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxZQUFZO1lBRTFELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO2NBQ3JELFVBQVUsZUFBZSxRQUFRO2NBQ2pDLFFBQVEsV0FBVyxFQUFFO2NBQ3JCLElBQUk7Z0JBQUUsVUFBVTtjQUFnQjtZQUNsQztVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsWUFBWTtJQUNWLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsTUFBTSxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07VUFDdEQsTUFBTSxtQkFBbUIsTUFBTSxZQUFZLE1BQU07UUFDbkQ7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHNEQUFzRCxDQUFDO1FBQ3BFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7VUFBRSxPQUFPO1FBQUU7UUFDckcsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLFlBQVksQ0FBQztVQUN0QixVQUFVLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRO1VBQzdGLE9BQU87UUFDVDtRQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1VBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0NBQWtDLENBQUM7VUFDaEQ7UUFDRjtRQUVBLE1BQU0sZ0JBQWdCLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUUzRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGVBQWU7UUFFM0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7VUFDeEQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxjQUFjLEVBQUU7UUFDMUI7TUFDRjtFQUNGO0VBQ0EsUUFBUTtJQUNOLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxLQUFLLEVBQUUsVUFBVSxNQUFNLENBQUMsVUFBVSxDQUFDO1FBQzdFO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtVQUFFLE9BQU87UUFBRTtRQUVyRyxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7UUFFaEcsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLGVBQWUsQ0FBQztVQUN6QixVQUFVO1VBQ1YsT0FBTztZQUNMLE1BQU07WUFDTixPQUFPLEtBQUssR0FBRyxDQUFDLEdBQUcsS0FBSyxNQUFNO1VBQ2hDO1VBQ0EsVUFBVTtRQUNaO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsQ0FBQztVQUM3QztRQUNGO1FBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyx3QkFBd0IsRUFBRSxnQkFBZ0IsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUVyRSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxZQUFZLGVBQWUsUUFBUTtZQUNuQyxRQUFRO1lBQ1IsSUFBSTtjQUFFLFVBQVU7WUFBWTtVQUM5QjtRQUNGO1FBRUEsTUFBTSxhQUFhLGVBQWUsS0FBSyxDQUFDLFVBQVU7UUFFbEQsTUFBTSxXQUFXLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLE1BQU07UUFFekUsa0JBQWtCLFVBQVUsZ0JBQWdCO1VBQzFDLElBQUksQ0FBQyxLQUFLLEVBQUUsZUFBZSxNQUFNLENBQUMsVUFBVSxDQUFDO1VBQzdDLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLGNBQWM7VUFDZCxNQUFNO1VBQ04sd0JBQXdCO1VBQ3hCLFlBQVk7VUFDWixXQUFXLE9BQU07WUFDZixJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEtBQUssZUFBZSxRQUFRLEVBQUUsT0FBTztZQUM1RSxJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLEtBQUssWUFBWSxPQUFPO1lBQ2pFLE9BQU87VUFDVDtVQUNBLG1CQUFtQixPQUFNO1lBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsK0JBQStCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFFOUUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtjQUM1QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtnQkFDckQsWUFBWSxlQUFlLFFBQVE7Z0JBQ25DLFFBQVE7Z0JBQ1IsSUFBSTtrQkFBRSxVQUFVO2dCQUFhO2NBQy9CO1lBQ0Y7VUFDRjtRQUNGO01BQ0Y7RUFDRjtFQUNBLFNBQVM7SUFDUCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsbURBQW1ELENBQUM7UUFDakUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBQzNGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBRXBFLE1BQU0sV0FBVyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1FBRXpFLFFBQVEsR0FBRyxDQUFDLENBQUMsc0JBQXNCLEVBQUUsU0FBUyxjQUFjLENBQUM7UUFFN0QsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFDckQsWUFBWSxlQUFlLFFBQVE7VUFDbkMsUUFBUSxlQUFlLE1BQU07VUFDN0IsSUFBSTtZQUFFLFVBQVU7VUFBUztRQUMzQjtRQUVBLGVBQWUsZUFBZSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsRUFBRSxFQUFFLGFBQWE7VUFDaEYsVUFBVSxlQUFlLFFBQVE7VUFDakMsTUFBTTtVQUNOLFlBQVk7VUFDWix3QkFBd0I7VUFDeEIsV0FBVyxPQUFNO1lBQ2YsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFDNUUsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU07WUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxpQ0FBaUMsRUFBRSxTQUFTLFlBQVksQ0FBQztZQUV0RSxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUNwRCxRQUFRLFNBQVMsRUFBRTtjQUNuQixJQUFJO2dCQUFFLFVBQVU7Y0FBVztZQUM3QjtZQUVBLE1BQU0sT0FBTyxjQUFjLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtZQUUvRixRQUFRLEdBQUcsQ0FBQyxDQUFDLHdDQUF3QyxDQUFDO1lBRXRELEtBQUssTUFBTSxVQUFVO2lCQUFJO2FBQUssQ0FBRTtjQUM5QixNQUFNLGNBQWMscUJBQXFCLENBQUMsZUFBZTtnQkFBRSxVQUFVLGVBQWUsUUFBUTtnQkFBRTtjQUFPO1lBQ3ZHO1lBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyx3Q0FBd0MsQ0FBQztZQUV0RCxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUFFLFVBQVUsZUFBZSxRQUFRO2NBQUUsT0FBTztZQUFFO1VBQ3RHO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsaUJBQWlCO0lBQ2YsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLGNBQWMsRUFBRSxVQUFVLE1BQU0sQ0FBQyxVQUFVLENBQUM7VUFDcEYsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxjQUFjLEVBQUUsVUFBVSxNQUFNLENBQUMsV0FBVyxDQUFDO1FBQ3ZGO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsTUFBTSxhQUFhLGVBQWUsS0FBSyxDQUFDLFVBQVU7UUFFbEQsZUFBZSxlQUFlLENBQUMsd0JBQXdCLENBQUM7VUFDdEQsSUFBSSxDQUFDLGNBQWMsRUFBRSxlQUFlLE1BQU0sQ0FBQyxXQUFXLENBQUM7VUFDdkQsY0FBYztVQUNkLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLElBQUksQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU87WUFDL0MsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU07WUFDdkIsTUFBTSxxQkFBcUIsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFDOUQsUUFBUSxHQUFHLENBQUMsQ0FBQyx5Q0FBeUMsRUFBRSxtQkFBbUIsaUNBQWlDLENBQUM7WUFDN0csTUFBTSxPQUFPLGNBQWMsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7WUFDeEUsTUFBTSxTQUFTLE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3JFLFVBQVU7Y0FDVixRQUFRO2NBQ1IsZUFBZTtnQkFBQztrQkFBRSxPQUFPO2tCQUFRLFFBQVE7Z0JBQUU7ZUFBRTtjQUM3QyxTQUFTO2dCQUNQLE1BQU07Z0JBQ04sU0FBUztjQUNYO1lBQ0Y7WUFFQSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO2NBQ3pCLFFBQVEsSUFBSSxDQUFDLENBQUMscURBQXFELENBQUM7Y0FDcEU7WUFDRjtZQUVBLFFBQVEsSUFBSSxDQUFDLENBQUMseUNBQXlDLEVBQUUsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztZQUU3RixLQUFLLE1BQU0sVUFBVSxPQUFPLE1BQU0sQ0FBRTtjQUNsQyxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtnQkFDcEQsWUFBWTtnQkFDWjtnQkFDQSxJQUFJO2tCQUFFLFVBQVU7Z0JBQWE7Y0FDL0I7WUFDRjtVQUNGO1FBQ0Y7UUFFQSxNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUN6RSxrQkFBa0IsVUFBVSxnQkFBZ0I7VUFDMUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxlQUFlLE1BQU0sQ0FBQyxVQUFVLENBQUM7VUFDdEQsY0FBYztVQUNkLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxZQUFZLE9BQU87WUFDakUsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU07WUFDdkIsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxjQUFjLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLGNBQWMsRUFBRSxlQUFlLE1BQU0sQ0FBQyxXQUFXLENBQUM7WUFDbkcsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FBRSxVQUFVLGVBQWUsUUFBUTtjQUFFLE9BQU87WUFBRTtVQUN0RztRQUNGO01BQ0Y7RUFDRjtFQUNBLFFBQVE7SUFDTiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1VBQ3RELE1BQU0sbUJBQW1CLE1BQU0sWUFBWSxNQUFNO1FBQ25EO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztRQUM5QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1VBQUUsT0FBTztRQUFFO1FBRXRFLE1BQU0sZ0JBQWdCLGVBQWUsU0FBUyxDQUFDO1VBQzdDO1lBQUUsVUFBVTtjQUFDO2NBQWU7YUFBZ0I7VUFBQztVQUM3QztZQUFFLFVBQVU7VUFBVztTQUN4QjtRQUVELElBQUksQ0FBQyxjQUFjLE1BQU0sRUFBRTtVQUN6QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1VBQ3ZEO1FBQ0Y7UUFFQSxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUMvRSxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRLENBQUMsYUFBYSxDQUFDO1VBQ3ZCLFVBQVUsY0FBYyxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtVQUMzQyxPQUFPO1FBQ1Q7UUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtVQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLDhCQUE4QixDQUFDO1VBQzdDO1FBQ0Y7UUFFQSxNQUFNLHFCQUFxQixlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFFaEYsUUFBUSxHQUFHLENBQUMsQ0FBQyxzQkFBc0IsRUFBRSxvQkFBb0I7UUFFekQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFDckQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxtQkFBbUIsRUFBRTtVQUM3QixJQUFJO1lBQUUsVUFBVTtVQUFnQjtRQUNsQztNQUNGO0VBQ0Y7RUFDQSxZQUFZO0lBQ1YsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixLQUFLLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFNBQVMsRUFBRSxVQUFVLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDakY7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUV6RSxrQkFBa0IsVUFBVSxnQkFBZ0I7VUFDMUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxVQUFVLENBQUM7VUFDdkMsY0FBYztVQUNkLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxjQUFjLEtBQUssQ0FBQyxVQUFVLEVBQUUsT0FBTztZQUNyRixPQUFPO1VBQ1Q7VUFDQSxtQkFBbUIsT0FBTTtZQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDBDQUEwQyxDQUFDO1lBQ3hELE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxZQUFZO2NBQUUsVUFBVSxlQUFlLFFBQVE7WUFBQztVQUM1RjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGFBQWE7SUFDWCwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLFVBQVUsT0FBTyxNQUFNO1VBQ3JCLE1BQU0sa0JBQWtCLG1CQUFtQjtZQUN6QyxPQUFPLEtBQUssS0FBSztZQUNqQixXQUFXO1lBQ1gsa0JBQWtCLFVBQVUsUUFBUTtVQUN0QztVQUVBLEtBQUssTUFBTSxrQkFBa0IsZ0JBQWlCO1lBQzVDLFFBQVEsR0FBRyxDQUFDLENBQUMsNEJBQTRCLEVBQUUsZUFBZSxlQUFlLENBQUM7WUFDMUUsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFlBQVk7Y0FBRSxVQUFVO1lBQWU7VUFDMUU7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7VUFBRSxPQUFPO1FBQUU7UUFDckcsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7TUFDdEU7RUFDRjtFQUNBLFVBQVU7SUFDUixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsZ0RBQWdELENBQUM7UUFDOUQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7VUFBRSxVQUFVLGVBQWUsUUFBUTtRQUFDO1FBQzNGLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBRXBFLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUVoRyxJQUFJLEtBQUssTUFBTSxFQUFFO1VBQ2YsUUFBUSxHQUFHLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztVQUM5RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUFFLFVBQVUsZUFBZSxRQUFRO1VBQUM7VUFFOUYsSUFBSSxDQUFDLEtBQUssTUFBTSxFQUFFO1lBQ2hCLFFBQVEsR0FBRyxDQUFDLENBQUMsMERBQTBELENBQUM7WUFDeEU7VUFDRjtRQUNGO1FBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBRXpFLFFBQVEsR0FBRyxDQUFDLENBQUMsMEJBQTBCLEVBQUUsY0FBYztRQUV2RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUN2RCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxRQUFRO1VBQ1IsZ0JBQWdCO1FBQ2xCO1FBRUEsSUFBSSxhQUFhLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYTtVQUMxQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLCtEQUErRCxDQUFDO1VBRTdFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFlBQVksZUFBZSxRQUFRO1lBQ25DLFFBQVEsYUFBYSxFQUFFO1lBQ3ZCLElBQUk7Y0FBRSxVQUFVO1lBQWE7VUFDL0I7UUFDRixPQUNLLElBQUksYUFBYSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsSUFBSztZQUFDO1lBQVU7V0FBVSxDQUFDLFFBQVEsQ0FBQyxLQUFLO1VBQ3ZFLFFBQVEsR0FBRyxDQUFDLENBQUMsMERBQTBELENBQUM7VUFFeEUsTUFBTSxjQUFjLGVBQWUsU0FBUyxDQUFDO1lBQzNDO2NBQUUsVUFBVTtZQUFnQjtZQUM1QjtjQUFFLFVBQVU7WUFBUztXQUN0QjtVQUVELElBQUksQ0FBQyxZQUFZLE1BQU0sRUFBRTtZQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1lBQ3ZEO1VBQ0Y7VUFFQSxNQUFNLGVBQWUsWUFBWSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtVQUU3QyxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLGNBQWM7VUFFckQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxhQUFhLEVBQUU7WUFDdkIsSUFBSTtjQUFFLFVBQVU7WUFBZ0I7VUFDbEM7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxhQUFhO0lBQ1gsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixVQUFVLE9BQU8sTUFBTTtVQUNyQixNQUFNLFFBQVEsS0FBSyxLQUFLLENBQUMsS0FBSztVQUM5QixJQUFJLE1BQU0sV0FBVyxFQUFFLENBQUMsVUFBVSxNQUFNLENBQUMsRUFBRSxjQUFjLE9BQU87WUFDOUQ7VUFDRjtVQUVBLE1BQU0sOEJBQ0osTUFBTSxpQkFBaUIsRUFBRSxDQUFDLEtBQUssS0FBSyxDQUFDLFVBQVUsQ0FBQyxFQUM1QyxPQUFPLENBQUEsU0FBVSxNQUFNLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLFVBQVUsUUFBUSxJQUFJLE1BQU0sV0FBVyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssUUFDdEgsVUFBVTtVQUVoQixJQUFJLGdDQUFnQyxHQUFHO1lBQ3JDLFFBQVEsR0FBRyxDQUFDLENBQUMsbUNBQW1DLEVBQUUsVUFBVSxRQUFRLENBQUMscUNBQXFDLENBQUM7WUFDM0c7VUFDRjtVQUVBLE1BQU0sa0JBQWtCLE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxjQUFjO1lBQ3JFLFVBQVUsVUFBVSxRQUFRO1lBQzVCLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDbkIsVUFBVTtjQUFDO2dCQUFFLFVBQVU7a0JBQUM7a0JBQWU7aUJBQWdCO2NBQUM7Y0FBRztnQkFDekQsTUFBTTtnQkFDTixVQUFVLFVBQVUsUUFBUTtnQkFDNUIsUUFBUTtrQkFBRSxVQUFVO2dCQUFFO2NBQ3hCO2FBQUU7WUFDRixPQUFPO1VBQ1Q7VUFFQSxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLElBQUksQ0FBQyxDQUFDLDRDQUE0QyxDQUFDO1lBQzNEO1VBQ0Y7VUFFQSxNQUFNLGVBQWUsS0FBSyxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1VBRWhFLFFBQVEsR0FBRyxDQUFDLENBQUMscUNBQXFDLEVBQUUsY0FBYztVQUVsRSxNQUFNLFNBQVMsS0FBSyxTQUFTLENBQUM7WUFDNUI7Y0FBRSxVQUFVO2dCQUFDO2dCQUFlO2VBQWdCO1lBQUM7WUFDN0M7Y0FBRSxVQUFVLGFBQWEsT0FBTztZQUFDO1dBQ2xDO1VBRUQsTUFBTSxrQkFBa0IsbUJBQW1CO1lBQ3pDLE9BQU8sS0FBSyxLQUFLO1lBQ2pCLFdBQVc7WUFDWCxrQkFBa0IsVUFBVSxRQUFRO1VBQ3RDO1VBRUEsZ0JBQWdCLE1BQU0sR0FBRyxLQUFLLEdBQUcsQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFLE9BQU8sTUFBTTtVQUV2RSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksZ0JBQWdCLE1BQU0sRUFBRSxJQUFLO1lBQy9DLFFBQVEsR0FBRyxDQUFDLENBQUMsb0NBQW9DLEVBQUUsT0FBTyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxFQUFFLEVBQUU7WUFDckcsTUFBTSxLQUFLLHFCQUFxQixDQUFDLFlBQVk7Y0FDM0MsVUFBVSxlQUFlLENBQUMsRUFBRTtjQUM1QixRQUFRLE9BQU8sS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Y0FDbEMsSUFBSTtnQkFBRSxVQUFVO2NBQWdCO1lBQ2xDO1VBQ0Y7UUFDRjtNQUNGLENBQUM7SUFDRCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsbURBQW1ELENBQUM7UUFDakUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFdBQVc7VUFBRSxPQUFPO1FBQUU7UUFDakUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUV0RSxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDdEUsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUTtVQUNSLGVBQWU7WUFDYjtjQUFFLE9BQU87Y0FBVSxRQUFRO1lBQUU7WUFDN0I7Y0FBRSxPQUFPO2NBQWtCLFFBQVE7WUFBRTtXQUN0QztRQUNIO1FBRUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxHQUFHO1VBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsaUNBQWlDLENBQUM7VUFDL0M7UUFDRixPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyw0Q0FBNEMsQ0FBQztVQUMxRCxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7VUFFaEcsS0FBSyxNQUFNLFVBQVU7ZUFBSTtXQUFLLENBQUU7WUFDOUIsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7Y0FDckQsWUFBWSxlQUFlLFFBQVE7Y0FDbkM7Y0FDQSxJQUFJO2dCQUFFLFVBQVU7Y0FBZ0I7WUFDbEM7VUFDRjtRQUNGO01BQ0Y7RUFDRjtFQUNBLFNBQVM7SUFDUCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sMkJBQTJCLGVBQWUsU0FBUyxDQUFDO1VBQ3hEO1lBQUUsVUFBVTtZQUFVLFVBQVUsZUFBZSxRQUFRO1VBQUM7VUFDeEQ7WUFBRSxVQUFVO1VBQVM7U0FDdEI7UUFHRCxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDdEUsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUTtVQUNSLGVBQWU7WUFDYjtjQUFFLE9BQU87Y0FBd0IsUUFBUTtZQUFFO1lBQzNDO2NBQUUsT0FBTyxDQUFDLENBQUMsRUFBRSx5QkFBeUIsTUFBTSxDQUFDLFNBQVMsQ0FBQztjQUFFLFFBQVE7WUFBRTtXQUNwRTtRQUNIO1FBRUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxHQUFHO1VBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsdUNBQXVDLENBQUM7VUFDckQsTUFBTSxnQkFBZ0IsZUFBZSxTQUFTLENBQUM7WUFDN0M7Y0FBRSxVQUFVO2NBQWMsVUFBVSxlQUFlLFFBQVE7WUFBQztZQUM1RDtjQUFFLFVBQVU7WUFBUztXQUN0QjtVQUVELElBQUksQ0FBQyxjQUFjLE1BQU0sRUFBRTtZQUN6QixRQUFRLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1lBQy9DO1VBQ0Y7VUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLGFBQWEsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDO1VBRWpFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1lBQ3JELFlBQVksZUFBZSxRQUFRO1lBQ25DLFFBQVEsYUFBYSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQzNCLElBQUk7Y0FBRSxVQUFVO1lBQVM7VUFDM0I7UUFDRixPQUNLO1VBQ0gsUUFBUSxHQUFHLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSx5QkFBeUIsTUFBTSxDQUFDLFNBQVMsQ0FBQztVQUNoRixNQUFNLGVBQWUscUJBQXFCLENBQUMsZ0JBQWdCO1lBQUUsT0FBTyx5QkFBeUIsTUFBTTtVQUFDO1FBQ3RHO01BQ0Y7RUFDRjtFQUNBLFFBQVE7SUFDTiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1VBQ3RELE1BQU0sbUJBQW1CLE1BQU0sbUJBQW1CLE1BQU07UUFDMUQ7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO1FBQzVELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7UUFBQztRQUMzRixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtNQUN0RTtFQUNGO0VBQ0EsV0FBVztJQUNULDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsTUFBTSxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07VUFDdEQsTUFBTSxtQkFBbUIsTUFBTSxXQUFXLE1BQU07UUFDbEQ7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDhDQUE4QyxDQUFDO1FBQzVELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxXQUFXO1VBQUUsT0FBTztRQUFFO1FBQ2pFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7TUFDeEU7RUFDRjtFQUNBLFFBQVE7SUFDTiwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLFVBQVUsT0FBTyxNQUFNO1VBQ3JCLE1BQU0sWUFBWSxLQUFLLFNBQVMsQ0FBQztZQUMvQjtjQUFFLFVBQVU7WUFBZ0I7WUFDNUI7Y0FBRSxVQUFVO1lBQU87V0FDcEI7VUFFRCxJQUFJLENBQUMsVUFBVSxNQUFNLEVBQUU7WUFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztZQUM1RDtVQUNGO1VBRUEsTUFBTSxhQUFhLFVBQVUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFFekMsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxZQUFZO1VBRTFELE1BQU0sS0FBSyxxQkFBcUIsQ0FBQyxZQUFZO1lBQzNDLFVBQVUsVUFBVSxRQUFRO1lBQzVCLFFBQVEsV0FBVyxFQUFFO1lBQ3JCLElBQUk7Y0FBRSxVQUFVO1lBQWdCO1VBQ2xDLEdBQUc7WUFBRSxtQkFBbUI7Y0FBRSxRQUFRO2dCQUFDO2VBQVc7WUFBQztVQUFFO1FBQ25EO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyw4Q0FBOEMsQ0FBQztRQUM1RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFDM0YsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7TUFDdEU7RUFDRjtFQUNBLFFBQVE7SUFDTixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsOEJBQThCLENBQUM7UUFDNUMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDL0UsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxDQUFDLFlBQVksQ0FBQztVQUN0QixVQUFVLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWMsZUFBZSxRQUFRLEVBQzFGLE1BQU0sQ0FBQyxlQUFlLE1BQU07VUFDL0IsT0FBTztRQUNUO1FBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7VUFDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQyw4QkFBOEIsQ0FBQztVQUM3QztRQUNGO1FBRUEsTUFBTSxlQUFlLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtRQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHVCQUF1QixFQUFFLGNBQWM7UUFFcEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGFBQWE7VUFDdEQsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUSxhQUFhLEVBQUU7UUFDekI7UUFFQSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBZSxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsY0FBYztVQUFFLFVBQVUsZUFBZSxRQUFRO1FBQUM7UUFFakgsTUFBTSxjQUFjLEtBQUssUUFBUTtRQUVqQyxJQUFJLGdCQUFnQixHQUFHO1VBQ3JCLFFBQVEsR0FBRyxDQUFDLENBQUMsNENBQTRDLENBQUM7VUFDMUQ7UUFDRjtRQUVBLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjLGVBQWUsUUFBUTtRQUVoRyxJQUFJLEtBQUssTUFBTSxLQUFLLEdBQUc7VUFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQywyQ0FBMkMsQ0FBQztVQUN6RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsZUFBZTtZQUFFLFVBQVUsZUFBZSxRQUFRO1VBQUM7VUFFOUYsSUFBSSxLQUFLLE1BQU0sS0FBSyxHQUFHO1lBQ3JCLFFBQVEsR0FBRyxDQUFDLENBQUMsOENBQThDLENBQUM7WUFDNUQ7VUFDRjtRQUNGO1FBRUEsTUFBTSxpQkFBeUIsRUFBRTtRQUVqQyxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksYUFBYSxJQUFLO1VBQ3BDLE1BQU0sZUFBZSxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFO1VBRTdFLFFBQVEsR0FBRyxDQUFDLENBQUMseUJBQXlCLEVBQUUsY0FBYztVQUV0RCxlQUFlLElBQUksQ0FBQztVQUVwQixNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxZQUFZLGVBQWUsUUFBUTtZQUNuQyxRQUFRLGFBQWEsRUFBRTtZQUN2QixJQUFJO2NBQUUsVUFBVTtZQUFZO1VBQzlCO1FBQ0Y7UUFFQSxNQUFNLFNBQVMsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFDdEUsVUFBVSxlQUFlLFFBQVE7VUFDakMsUUFBUTtVQUNSLGVBQWU7WUFDYjtjQUFFLE9BQU87Y0FBUSxRQUFRO1lBQUU7V0FDNUI7VUFDRCxTQUFTO1lBQ1AsTUFBTTtZQUNOLFNBQVMsZUFBZSxHQUFHLENBQUMsQ0FBQSxPQUFRLEtBQUssRUFBRTtZQUMzQyxhQUFhO1VBQ2Y7UUFDRjtRQUVBLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7VUFDekIsUUFBUSxJQUFJLENBQUMsQ0FBQyw4QkFBOEIsQ0FBQztVQUM3QztRQUNGO1FBRUEsTUFBTSwwQkFBMEIsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sTUFBTSxDQUFDLEVBQUU7UUFFbkYsUUFBUSxHQUFHLENBQUMsQ0FBQyxzQkFBc0IsRUFBRSx3QkFBd0IsUUFBUSxDQUFDO1FBRXRFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFlBQVksZUFBZSxRQUFRO1VBQ25DLFFBQVEsd0JBQXdCLEVBQUU7VUFDbEMsSUFBSTtZQUFFLFVBQVU7VUFBYTtRQUMvQjtRQUVBLFFBQVEsR0FBRyxDQUFDLENBQUMseUJBQXlCLEVBQUUsZUFBZSxNQUFNLEdBQUcsRUFBRSxNQUFNLENBQUM7UUFFekUsS0FBSyxNQUFNLGlCQUFpQixlQUFnQjtVQUMxQyxJQUFJLGNBQWMsRUFBRSxLQUFLLHdCQUF3QixFQUFFLEVBQUU7VUFDckQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7WUFDeEQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxjQUFjLEVBQUU7VUFDMUI7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxjQUFjO0lBQ1osaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLG9EQUFvRCxDQUFDO1FBQ2xFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7UUFBQztRQUMzRixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUVwRSxNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUV6RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDJCQUEyQixFQUFFLFNBQVMsYUFBYSxDQUFDO1FBRWpFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFlBQVksZUFBZSxRQUFRO1VBQ25DLFFBQVEsZUFBZSxNQUFNO1VBQzdCLElBQUk7WUFBRSxVQUFVO1VBQVM7UUFDM0I7UUFFQSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxhQUFhO1VBQ2hGLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLE9BQU87VUFDVDtVQUNBLG1CQUFtQixPQUFNO1lBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLEVBQUUsU0FBUyxZQUFZLENBQUM7WUFFM0UsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxNQUFNLGtCQUFrQixNQUFNLGNBQWMscUJBQXFCLENBQUMsY0FBYztjQUM5RSxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLENBQUMsVUFBVSxDQUFDO2NBQ3BCLFVBQVUsY0FBYyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7Y0FDNUYsT0FBTztZQUNUO1lBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7Y0FDM0IsUUFBUSxHQUFHLENBQUMsQ0FBQywrQ0FBK0MsQ0FBQztjQUM3RDtZQUNGO1lBRUEsTUFBTSxlQUFlLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtZQUV6RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHVDQUF1QyxFQUFFLGNBQWM7WUFFcEUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLGFBQWE7Y0FDckQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxhQUFhLEVBQUU7WUFDekI7VUFDRjtRQUNGO01BQ0Y7RUFDRjtFQUNBLGtCQUFrQjtJQUNoQixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsd0NBQXdDLENBQUM7UUFDdEQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7VUFBRSxPQUFPO1FBQUU7UUFFcEUsTUFBTSxXQUFXLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLE1BQU07UUFFekUsUUFBUSxHQUFHLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxTQUFTLFVBQVUsQ0FBQztRQUVsRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUNyRCxZQUFZLGVBQWUsUUFBUTtVQUNuQyxRQUFRLGVBQWUsTUFBTTtVQUM3QixJQUFJO1lBQUUsVUFBVTtVQUFTO1FBQzNCO1FBRUEsZUFBZSxlQUFlLENBQUMsd0JBQXdCLENBQUMsU0FBUyxFQUFFLEVBQUUsbUJBQW1CO1VBQ3RGLE1BQU07VUFDTixZQUFZO1VBQ1osd0JBQXdCO1VBQ3hCLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLFdBQVcsT0FBTTtZQUNmLE1BQU0sYUFBYSxjQUFjLFdBQVcsQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU07WUFDdEYsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLE9BQU87WUFDaEQsSUFBSSxDQUFDLGVBQWUsY0FBYyxTQUFTLEVBQUUsUUFBUSxDQUFDLGFBQWEsT0FBTztZQUMxRSxPQUFPO1VBQ1Q7VUFDQSxtQkFBbUIsT0FBTTtZQUN2QixNQUFNLGFBQWEsY0FBYyxXQUFXLENBQUMsT0FBTyxDQUFDLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNO1lBRXRGLFFBQVEsR0FBRyxDQUFDLENBQUMsZ0RBQWdELEVBQUUsU0FBUyxZQUFZLENBQUM7WUFFckYsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLG1EQUFtRCxFQUFFLFlBQVk7WUFFOUUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxXQUFXLEVBQUU7Y0FDckIsV0FBVztnQkFDVCxZQUFZO2NBQ2Q7WUFDRjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsV0FBVztJQUNULDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsTUFBTSxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07VUFDdEQsTUFBTSxtQkFBbUIsTUFBTSxZQUFZLE1BQU07UUFDbkQ7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDO1FBQ2pELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFdEUsTUFBTSxnQkFBZ0IsZUFBZSxlQUFlLFNBQVMsRUFDMUQsTUFBTSxDQUFDLENBQUEsT0FBUSxLQUFLLEtBQUssS0FBSyxlQUFlLFFBQVEsSUFBSSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUM7UUFFL0UsSUFBSSxjQUFjLE1BQU0sR0FBRyxHQUFHO1VBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxNQUFNLENBQUMsNENBQTRDLENBQUM7VUFDbEcsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtZQUFFLE9BQU8sY0FBYyxNQUFNO1VBQUM7UUFDM0Y7UUFFQSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQTtVQUNSLE1BQU0sT0FBTyxlQUFlLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxjQUFjO1VBQ3pFLE9BQU8sZUFBZSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVyxjQUFjLEtBQUssTUFBTSxJQUFJO1FBQzdGO1FBRUEsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxPQUFPLGVBQWUsb0JBQW9CLENBQUMsU0FBUyxDQUFDLGNBQWM7VUFFekUsTUFBTSxrQkFBa0IsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGNBQWM7WUFDL0UsVUFBVTtZQUNWLFFBQVEsQ0FBQyxZQUFZLENBQUM7WUFDdEIsVUFBVTtZQUNWLE9BQU87VUFDVDtVQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1lBQzNCLFFBQVEsSUFBSSxDQUFDLENBQUMsaUNBQWlDLENBQUM7WUFDaEQ7VUFDRjtVQUVBLE1BQU0sZ0JBQWdCLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtVQUUzRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLGVBQWUsWUFBWSxFQUFFLGVBQWU7VUFFbkYsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7WUFDeEQsVUFBVTtZQUNWLFFBQVEsY0FBYyxFQUFFO1VBQzFCO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsZUFBZTtJQUNiLGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQztRQUNuRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztVQUFFLE9BQU87UUFBRTtRQUVwRSxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7UUFDaEcsSUFBSSxrQkFBa0IsS0FDbkIsR0FBRyxDQUFDLGVBQWUsV0FBVyxDQUFDLE9BQU8sRUFDdEMsTUFBTSxDQUFDLENBQUEsT0FBUSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUM7UUFFckMsTUFBTSxhQUFhLEtBQUssR0FBRyxDQUFDLEdBQUcsZ0JBQWdCLE1BQU07UUFFckQsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFlBQVksSUFBSztVQUNuQyxrQkFBa0IsS0FDZixHQUFHLENBQUMsZUFBZSxXQUFXLENBQUMsT0FBTyxFQUN0QyxNQUFNLENBQUMsQ0FBQSxPQUFRLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQztVQUVyQyxJQUFJLENBQUMsZ0JBQWdCLE1BQU0sRUFBRTtZQUMzQixRQUFRLEdBQUcsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDO1lBQ3ZEO1VBQ0Y7VUFFQSxNQUFNLGtCQUFrQixNQUFNLGVBQWUscUJBQXFCLENBQUMsY0FBYztZQUMvRSxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDbEQsVUFBVSxnQkFBZ0IsR0FBRyxDQUFDLENBQUEsT0FBUSxLQUFLLEVBQUU7WUFDN0MsT0FBTztZQUNQLFVBQVU7VUFDWjtVQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO1lBQzNCLFFBQVEsR0FBRyxDQUFDLENBQUMseUNBQXlDLENBQUM7WUFDdkQ7VUFDRjtVQUVBLE1BQU0saUJBQWlCLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtVQUU1RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGdCQUFnQjtVQUU1RCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxRQUFRLGVBQWUsQ0FBQyxFQUFFO1lBQzFCLFVBQVUsZUFBZSxRQUFRO1VBQ25DO1FBQ0Y7UUFFQSxRQUFRLEdBQUcsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDO1FBQ2pELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQUUsVUFBVSxlQUFlLFFBQVE7UUFBQztRQUUzRixNQUFNLGlCQUFpQixlQUFlLEtBQUssQ0FBQyxjQUFjO1FBRTFELElBQUksbUJBQW1CLEdBQUc7VUFDeEIsUUFBUSxHQUFHLENBQUMsQ0FBQywrREFBK0QsQ0FBQztVQUM3RTtRQUNGO1FBRUEsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU8sQ0FBQztRQUFlLEdBQUc7VUFBRSxnQkFBZ0I7WUFBRSxVQUFVO1VBQUs7UUFBRTtRQUU1SCxRQUFRLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QixFQUFFLGVBQWUsTUFBTSxDQUFDO1FBRWxFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE9BQU87UUFDVDtNQUNGO0VBQ0Y7RUFDQSxhQUFhO0lBQ1gsMEJBQTBCLElBQU0sQ0FBQztRQUMvQixhQUFhLE9BQU8sTUFBTTtVQUN4QixNQUFNLFdBQVcsS0FBSyxXQUFXLENBQUMsT0FBTyxDQUFDLFVBQVUsTUFBTTtVQUMxRCxLQUFLLE1BQU0sVUFBVSxLQUFLLEtBQUssQ0FBQyxPQUFPLENBQUU7WUFDdkMsS0FBSyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxFQUFFO1VBQzNGO1FBQ0Y7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUV6RSxNQUFNLE1BQWdCLEVBQUU7UUFFeEIsa0JBQWtCLFVBQVUsZ0JBQWdCO1VBQzFDLElBQUksQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUMsVUFBVSxDQUFDO1VBQ3hDLGNBQWM7VUFDZCxVQUFVLGVBQWUsUUFBUTtVQUNqQyxNQUFNO1VBQ04sWUFBWTtVQUNaLHdCQUF3QjtVQUN4QixXQUFXLE9BQU07WUFDZixJQUFJLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLEtBQUssY0FBYyxLQUFLLENBQUMsVUFBVSxFQUFFLE9BQU87WUFDckYsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGVBQWUsUUFBUSxFQUFFLE9BQU87WUFDNUUsT0FBTztVQUNUO1VBQ0EsbUJBQW1CLE9BQU07WUFDdkIsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxLQUFLLE1BQU0sTUFBTSxJQUFLO2NBQ3BCLGNBQWMsZUFBZSxDQUFDLGlCQUFpQixDQUFDO1lBQ2xEO1lBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQywrQ0FBK0MsQ0FBQztZQUM3RCxNQUFNLGNBQWMscUJBQXFCLENBQUMsZ0JBQWdCO2NBQUUsT0FBTztZQUFFO1VBQ3ZFO1FBQ0Y7UUFFQSxNQUFNLGtCQUFrQixtQkFBbUI7VUFDekMsT0FBTyxlQUFlLEtBQUs7VUFDM0IsV0FBVztVQUNYLGtCQUFrQixlQUFlLFFBQVE7UUFDM0MsR0FBRyxNQUFNLENBQUMsQ0FBQSxXQUFZLGVBQWUsZUFBZSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVc7UUFFN0UsS0FBSyxNQUFNLGtCQUFrQixnQkFBaUI7VUFDNUMsTUFBTSxLQUFLLENBQUMsVUFBVSxFQUFFLFNBQVMsRUFBRSxDQUFDLFlBQVksRUFBRSxnQkFBZ0I7VUFDbEUsSUFBSSxJQUFJLENBQUM7VUFDVCxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQztZQUN0RDtZQUNBLGNBQWM7WUFDZCxVQUFVO1lBQ1YsTUFBTTtZQUNOLHdCQUF3QjtZQUN4QixZQUFZO1lBQ1osV0FBVyxPQUFNO2NBQ2YsSUFBSSxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxLQUFLLGdCQUFnQixPQUFPO2NBQ25FLElBQUksQ0FBQyxjQUFjLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU87Y0FDL0MsT0FBTztZQUNUO1lBQ0EsbUJBQW1CLE9BQU07Y0FDdkIsTUFBTSxhQUFhLGNBQWMsU0FBUyxDQUFDO2dCQUN6QztrQkFBRSxVQUFVO2dCQUFjO2dCQUMxQjtrQkFBRSxVQUFVO2dCQUFRO2VBQ3JCO2NBRUQsSUFBSSxDQUFDLFdBQVcsTUFBTSxFQUFFO2dCQUN0QixRQUFRLEdBQUcsQ0FBQyxDQUFDLHNEQUFzRCxDQUFDO2dCQUNwRTtjQUNGO2NBRUEsUUFBUSxHQUFHLENBQUMsQ0FBQyxxQ0FBcUMsRUFBRSxlQUFlLFNBQVMsRUFBRSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Y0FFdkcsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Z0JBQ3BELFVBQVU7Z0JBQ1YsUUFBUSxXQUFXLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDbEMsSUFBSTtrQkFBRSxVQUFVO2dCQUFnQjtjQUNsQztZQUNGO1VBQ0Y7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxnQkFBZ0I7SUFDZCxpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBRXBFLE1BQU0sV0FBVyxlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxNQUFNO1FBRXpFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFlBQVksZUFBZSxRQUFRO1VBQ25DLFFBQVEsU0FBUyxFQUFFO1VBQ25CLElBQUk7WUFBRSxVQUFVO1VBQVM7UUFDM0I7UUFFQSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxhQUFhO1VBQ2hGLFVBQVUsZUFBZSxRQUFRO1VBQ2pDLE1BQU07VUFDTix3QkFBd0I7VUFDeEIsWUFBWTtVQUNaLFdBQVcsT0FBTTtZQUNmLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLE9BQU87VUFDVDtVQUNBLG1CQUFtQixPQUFNO1lBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsd0NBQXdDLEVBQUUsU0FBUyxZQUFZLENBQUM7WUFFN0UsTUFBTSxjQUFjLHFCQUFxQixDQUFDLFlBQVk7Y0FDcEQsUUFBUSxTQUFTLEVBQUU7Y0FDbkIsSUFBSTtnQkFBRSxVQUFVO2NBQVc7WUFDN0I7WUFFQSxNQUFNLE9BQU8sY0FBYyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxlQUFlLFFBQVE7WUFFL0YsSUFBSSxrQkFBa0IsTUFBTSxjQUFjLHFCQUFxQixDQUFDLGNBQWM7Y0FDNUUsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxDQUFDLFVBQVUsQ0FBQztjQUNwQixVQUFVO2NBQ1YsT0FBTztZQUNUO1lBRUEsSUFBSSxDQUFDLGdCQUFnQixNQUFNLEVBQUU7Y0FDM0IsUUFBUSxJQUFJLENBQUMsQ0FBQyxnREFBZ0QsQ0FBQztjQUMvRDtZQUNGO1lBRUEsTUFBTSxjQUFjLGNBQWMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRTtZQUV4RSxNQUFNLGNBQWMscUJBQXFCLENBQUMsYUFBYTtjQUNyRCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLFlBQVksRUFBRTtZQUN4QjtZQUVBLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxjQUFjLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxhQUFhO2NBQUUsVUFBVSxlQUFlLFFBQVE7WUFBQztZQUUvRyxNQUFNLFFBQVEsY0FBYyxTQUFTLENBQUM7Y0FDcEM7Z0JBQUUsVUFBVTtrQkFBQztrQkFBZTtpQkFBZ0I7Y0FBQztjQUM3QztnQkFDRSxNQUFNO2dCQUNOLFVBQVUsZUFBZSxRQUFRO2dCQUNqQyxRQUFRO2tCQUFFLFVBQVUsS0FBSyxRQUFRLEdBQUc7a0JBQUcsUUFBUSxLQUFLLE1BQU07Z0JBQUM7Y0FDN0Q7YUFDRDtZQUVELElBQUksQ0FBQyxNQUFNLE1BQU0sRUFBRTtjQUNqQixRQUFRLEdBQUcsQ0FBQyxDQUFDLDJEQUEyRCxFQUFFLEtBQUssUUFBUSxHQUFHLEVBQUUsY0FBYyxFQUFFLEtBQUssTUFBTSxDQUFDLFFBQVEsQ0FBQztjQUNqSTtZQUNGO1lBRUEsa0JBQWtCLE1BQU0sY0FBYyxxQkFBcUIsQ0FBQyxjQUFjO2NBQ3hFLFVBQVUsZUFBZSxRQUFRO2NBQ2pDLFFBQVEsQ0FBQyxTQUFTLENBQUM7Y0FDbkIsVUFBVSxNQUFNLEdBQUcsQ0FBQyxDQUFBLE9BQVEsS0FBSyxFQUFFO2NBQ25DLE9BQU87WUFDVDtZQUVBLElBQUksQ0FBQyxnQkFBZ0IsTUFBTSxFQUFFO2NBQzNCLFFBQVEsSUFBSSxDQUFDLENBQUMseURBQXlELENBQUM7Y0FDeEU7WUFDRjtZQUVBLE1BQU0sYUFBYSxjQUFjLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUU7WUFFdkUsUUFBUSxJQUFJLENBQUMsQ0FBQyx3Q0FBd0MsRUFBRSxXQUFXLFFBQVEsQ0FBQztZQUU1RSxNQUFNLGNBQWMscUJBQXFCLENBQUMsWUFBWTtjQUNwRCxVQUFVLGVBQWUsUUFBUTtjQUNqQyxRQUFRLFdBQVcsRUFBRTtjQUNyQixJQUFJO2dCQUFFLFVBQVU7Y0FBYTtZQUMvQjtVQUNGO1FBQ0Y7TUFDRjtFQUNGO0VBQ0EsbUJBQW1CO0lBQ2pCLDBCQUEwQixJQUFNLENBQUM7UUFDL0IsYUFBYSxPQUFPLE1BQU07VUFDeEIsTUFBTSxPQUFPLEtBQUssV0FBVyxDQUFDLE9BQU8sQ0FBQyxVQUFVLE1BQU07VUFDdEQsTUFBTSxtQkFBbUIsTUFBTSxXQUFXLE1BQU07UUFDbEQ7TUFDRixDQUFDO0lBQ0QsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDZEQUE2RCxDQUFDO1FBQzNFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxjQUFjO1VBQUUsT0FBTztRQUFFO1FBQ3BFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFdEUsTUFBTSxjQUFjLGVBQWUsU0FBUyxDQUFDO1VBQzNDO1lBQUUsVUFBVTtVQUFjO1VBQzFCO1lBQUUsVUFBVTtVQUFTO1NBQ3RCO1FBRUQsSUFBSSxDQUFDLFlBQVksTUFBTSxFQUFFO1VBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsa0RBQWtELENBQUM7VUFDaEU7UUFDRjtRQUVBLE1BQU0sY0FBYyxzQkFBc0I7VUFDeEMsY0FBYyxlQUFlLEtBQUssQ0FBQyxzQkFBc0I7VUFDekQsT0FBTyxlQUFlLEtBQUs7VUFDM0IsVUFBVSxDQUFDO1FBQ2I7UUFFQSxNQUFNLGNBQWMsZUFBZSxLQUFLLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLENBQUMsZUFBZSxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQy9GLElBQUksZUFBZSxXQUFXLENBQUMsT0FBTyxHQUN0QyxPQUFPLENBQUEsT0FBUSxLQUFLLEtBQUssS0FBSyxZQUFZLEVBQUUsS0FBSyxFQUFFO1FBRXZELE1BQU0sWUFBWSxLQUFLLEdBQUcsQ0FBQyxZQUFZLE1BQU0sRUFBRSxZQUFZLE1BQU07UUFFakUsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLFdBQVcsSUFBSztVQUNsQyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLFlBQVksS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7WUFDdkMsSUFBSTtjQUFFLFVBQVU7WUFBZ0I7VUFDbEM7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxrQkFBa0I7SUFDaEIsaUJBQWlCLElBQU0sT0FBTztRQUM1QixRQUFRLEdBQUcsQ0FBQyxDQUFDLDBDQUEwQyxDQUFDO1FBQ3hELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxnQkFBZ0I7VUFBRSxPQUFPO1FBQUU7UUFFdEUsTUFBTSxxQkFBcUIsZUFBZSxTQUFTLENBQUM7VUFDbEQ7WUFBRSxVQUFVO1VBQWM7VUFDMUI7WUFBRSxVQUFVO2NBQUM7Y0FBUTthQUFTO1VBQUM7U0FDaEM7UUFFRCxNQUFNLENBQUMsV0FBVyxZQUFZLEdBQUcsbUJBQW1CLE1BQU0sQ0FBQyxDQUFDLEtBQUs7VUFDL0QsSUFBSSxTQUFTLE9BQU8sS0FBSyxRQUFRO1lBQy9CLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO1VBQ2QsT0FDSztZQUNILEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO1VBQ2Q7VUFDQSxPQUFPO1FBQ1QsR0FBRztVQUFDLEVBQUU7VUFBRSxFQUFFO1NBQUM7UUFFWCxJQUFJLENBQUMsVUFBVSxNQUFNLEVBQUU7VUFDckIsUUFBUSxHQUFHLENBQUMsQ0FBQywrQ0FBK0MsQ0FBQztRQUMvRCxPQUNLO1VBQ0gsTUFBTSxpQkFBaUIsVUFBVSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtVQUM3QyxRQUFRLEdBQUcsQ0FBQyxDQUFDLGdDQUFnQyxFQUFFLGdCQUFnQjtVQUMvRCxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtZQUNyRCxVQUFVLGVBQWUsUUFBUTtZQUNqQyxRQUFRLGVBQWUsRUFBRTtZQUN6QixJQUFJO2NBQUUsVUFBVTtZQUFnQjtVQUNsQztRQUNGO1FBRUEsSUFBSSxDQUFDLFlBQVksTUFBTSxFQUFFO1VBQ3ZCLFFBQVEsR0FBRyxDQUFDLENBQUMsaURBQWlELENBQUM7UUFDakUsT0FDSztVQUNILE1BQU0sbUJBQW1CLFlBQVksS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFDakQsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsRUFBRSxrQkFBa0I7VUFDakUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLFlBQVk7WUFDckQsVUFBVSxlQUFlLFFBQVE7WUFDakMsUUFBUSxpQkFBaUIsRUFBRTtZQUMzQixJQUFJO2NBQUUsVUFBVTtZQUFnQjtVQUNsQztRQUNGO01BRUY7RUFDRjtFQUNBLFdBQVc7SUFDVCwwQkFBMEIsSUFBTSxDQUFDO1FBQy9CLGFBQWEsT0FBTyxNQUFNO1VBQ3hCLE1BQU0sT0FBTyxLQUFLLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxNQUFNO1VBQ3RELE1BQU0sbUJBQW1CLE1BQU0sUUFBUSxNQUFNO1FBQy9DO01BQ0YsQ0FBQztJQUNELGlCQUFpQixJQUFNLE9BQU87UUFDNUIsUUFBUSxHQUFHLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQztRQUM5QyxNQUFNLGVBQWUscUJBQXFCLENBQUMsWUFBWTtVQUFFLFVBQVUsZUFBZSxRQUFRO1VBQUUsT0FBTztRQUFFO1FBRXJHLE1BQU0sbUJBQW1CLGVBQWUsZUFBZSxTQUFTLEVBQzdELE1BQU0sQ0FBQyxDQUFBLE9BQVEsS0FBSyxLQUFLLEtBQUssZUFBZSxRQUFRLElBQUksS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBRS9FLElBQUksQ0FBQyxpQkFBaUIsTUFBTSxFQUFFO1VBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsc0NBQXNDLENBQUM7VUFDcEQ7UUFDRjtRQUVBLE1BQU0sa0JBQWtCLG1CQUFtQjtVQUN6QyxPQUFPLGVBQWUsS0FBSztVQUMzQixXQUFXO1VBQ1gsa0JBQWtCLGVBQWUsUUFBUTtRQUMzQyxHQUFHLE1BQU0sQ0FBQyxDQUFBLFdBQVksZUFBZSxlQUFlLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVztRQUU3RSxLQUFLLE1BQU0sa0JBQWtCLGdCQUFpQjtVQUM1QyxNQUFNLE9BQU8sZUFBZSxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsY0FBYztVQUV6RSxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksaUJBQWlCLE1BQU0sRUFBRSxJQUFLO1lBQ2hELElBQUksS0FBSyxNQUFNLEtBQUssR0FBRztjQUNyQixRQUFRLEdBQUcsQ0FBQyxDQUFDLDRDQUE0QyxDQUFDO2NBRTFELE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxlQUFlO2dCQUFFLFVBQVUsZUFBZSxRQUFRO2NBQUM7Y0FFOUYsSUFBSSxLQUFLLE1BQU0sS0FBSyxHQUFHO2dCQUNyQixRQUFRLEdBQUcsQ0FBQyxDQUFDLGlEQUFpRCxDQUFDO2dCQUMvRDtjQUNGO1lBQ0Y7WUFFQSxNQUFNLGdCQUFnQixlQUFlLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUUxRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDRCQUE0QixFQUFFLGVBQWU7WUFFMUQsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGVBQWU7Y0FDeEQsVUFBVTtjQUNWLFFBQVEsY0FBYyxFQUFFO1lBQzFCO1lBRUEsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLGVBQWUsbUJBQW1CLENBQUMsVUFBVSxDQUFDLGVBQWU7Y0FBRSxVQUFVLGVBQWUsUUFBUTtZQUFDO1lBRWxILElBQUksS0FBSyxRQUFRLEtBQUssS0FBSyxLQUFLLFFBQVEsS0FBSyxHQUFHO2NBQzlDLFFBQVEsR0FBRyxDQUFDLENBQUMsNkNBQTZDLEVBQUUsZUFBZTtjQUUzRSxNQUFNLGVBQWUscUJBQXFCLENBQUMsYUFBYTtnQkFDdEQsVUFBVTtnQkFDVixRQUFRLGNBQWMsRUFBRTtjQUMxQjtZQUNGO1VBQ0Y7UUFDRjtNQUNGO0VBQ0Y7RUFDQSxpQkFBaUI7SUFDZixpQkFBaUIsSUFBTSxPQUFPO1FBQzVCLFFBQVEsR0FBRyxDQUFDLENBQUMsb0RBQW9ELENBQUM7UUFFbEUsTUFBTSxlQUFlLHFCQUFxQixDQUFDLGdCQUFnQjtVQUFFLE9BQU87UUFBRTtRQUN0RSxNQUFNLGVBQWUscUJBQXFCLENBQUMsV0FBVztVQUFFLE9BQU87UUFBRTtRQUVqRSxNQUFNLFdBQVcsZUFBZSxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsTUFBTTtRQUV6RSxRQUFRLEdBQUcsQ0FBQyxDQUFDLDhCQUE4QixFQUFFLFNBQVMsVUFBVSxDQUFDO1FBRWpFLE1BQU0sZUFBZSxxQkFBcUIsQ0FBQyxZQUFZO1VBQ3JELFlBQVksZUFBZSxRQUFRO1VBQ25DLFFBQVEsU0FBUyxFQUFFO1VBQ25CLElBQUk7WUFBRSxVQUFVO1VBQVM7UUFDM0I7UUFFQSxlQUFlLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQyxTQUFTLEVBQUUsRUFBRSxnQkFBZ0I7VUFDbkYsVUFBVSxlQUFlLFFBQVE7VUFDakMsTUFBTTtVQUNOLFlBQVk7VUFDWix3QkFBd0I7VUFDeEIsV0FBVyxPQUFNO1lBQ2YsSUFBSSxhQUFhLGNBQWMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQU0sT0FBTyxPQUFPO1lBQzFFLElBQUksY0FBYyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxlQUFlLFFBQVEsRUFBRSxPQUFPO1lBQzVFLElBQUksY0FBYyxLQUFLLENBQUMsY0FBYyxHQUFHLEdBQUcsT0FBTztZQUNuRCxPQUFPO1VBQ1Q7VUFDQSxtQkFBbUIsT0FBTTtZQUN2QixRQUFRLEdBQUcsQ0FBQyxDQUFDLCtDQUErQyxFQUFFLFVBQVU7WUFFeEUsTUFBTSxjQUFjLHFCQUFxQixDQUFDLGVBQWU7Y0FDdkQsVUFBVSxlQUFlLFFBQVE7Y0FDakMsUUFBUSxTQUFTLEVBQUU7WUFDckI7VUFDRjtRQUNGO01BQ0Y7RUFDRjtBQUNGO0FBRUEsZUFBZSxVQUFVIn0=
// denoCacheMetadata=14271327957767821885,5996565567358393753