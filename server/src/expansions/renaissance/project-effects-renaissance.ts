import {CardExpansionModule} from '../../types.ts';
import {CardId, Match, PlayerId, Project} from 'shared/shared-types';
import {getCurrentPlayer} from '../../utils/get-current-player.ts';
import {getTurnPhase} from '../../utils/get-turn-phase.ts';

// Checks whether a player has a cube placed on the given project.
function isProjectOwned(match: Match, playerId: PlayerId, project: Project) {
  return Object.values(match.tokens ?? {}).some(token =>
    token.tokenId === 'cube-token' &&
    token.ownerId === playerId &&
    token.location.type === 'cardLike' &&
    token.location.cardLikeId === project.id
  );
}

const effectMap: CardExpansionModule = {
  'academy': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[academy project] project card not found');
        return;
      }

      console.info(`[academy project] registering gain trigger for player ${cardEffectArgs.playerId}`);
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const projectOwned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);

          if (!projectOwned) {
            // Log ownership failures to help trace missing cube issues.
            console.debug(`[academy project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          // Log the gained card check for action filtering.
          console.debug(`[academy project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('ACTION');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Log the Villager grant before applying it.
          console.debug(`[academy project] granting +1 Villager to player ${cardEffectArgs.playerId} on turn ${triggeredArgs.match.turnNumber}`);
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Villager',
          });

          await triggeredArgs.runGameActionDelegate('gainVillager', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'barracks': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[barracks project] project card not found');
        return;
      }

      console.info(`[barracks project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          // Log ownership checks to aid debugging missing cubes.
          if (!owned) {
            console.debug(`[barracks project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Log the timing for the Barracks bonus.
          console.debug(`[barracks project] granting +1 Action to player ${cardEffectArgs.playerId} on turn ${triggeredArgs.match.turnNumber}`);
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Action',
          });

          await triggeredArgs.runGameActionDelegate('gainAction', { count: 1 });
        },
      });
    },
  },
  'canal': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[canal project] project card not found');
        return;
      }

      console.info(`[canal project] registering cost rules for player ${cardEffectArgs.playerId}`);

      let ruleUnsubs: (() => void)[] = [];

      // Apply the per-card cost rules for this player's turn.
      const registerRules = () => {
        if (ruleUnsubs.length > 0) {
          ruleUnsubs.forEach(unsub => unsub());
          ruleUnsubs = [];
        }

        const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();
        // Log the rule registration count once per start-of-turn.
        console.debug(`[canal project] registering cost rules for ${allCards.length} cards`);

        for (const card of allCards) {
          const unsub = cardEffectArgs.cardPriceController.registerRule(card, (_targetCard, context) => {
            if (context.playerId !== cardEffectArgs.playerId) {
              return { restricted: false, cost: { treasure: 0 } };
            }

            const currentPlayer = context.match.players[context.match.currentPlayerTurnIndex];
            if (currentPlayer?.id !== cardEffectArgs.playerId) {
              return { restricted: false, cost: { treasure: 0 } };
            }

            const projectOwned = isProjectOwned(context.match, cardEffectArgs.playerId, project);

            if (!projectOwned) {
              return { restricted: false, cost: { treasure: 0 } };
            }

            return { restricted: false, cost: { treasure: -1 } };
          });

          ruleUnsubs.push(unsub);
        }
      };

      // Remove all cost rule subscriptions after the turn ends.
      const clearRules = () => {
        if (!ruleUnsubs.length) return;
        console.debug(`[canal project] clearing ${ruleUnsubs.length} cost rules`);
        ruleUnsubs.forEach(unsub => unsub());
        ruleUnsubs = [];
      };

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          // Log ownership failures to avoid silent skips.
          if (!owned) {
            console.debug(`[canal project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async () => {
          console.debug(`[canal project] applying cost reduction for player ${cardEffectArgs.playerId}`);
          registerRules();
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => conditionArgs.trigger.args.playerId === cardEffectArgs.playerId,
        triggeredEffectFn: async () => {
          console.debug(`[canal project] removing cost reduction for player ${cardEffectArgs.playerId}`);
          clearRules();
        },
      });
    },
  },
  'cathedral': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[cathedral project] project card not found');
        return;
      }

      console.info(`[cathedral project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      // Cathedral forces a trash at the start of each of the owner's turns.
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          // Log missing cube ownership for Cathedral.
          if (!owned) {
            console.debug(`[cathedral project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[cathedral project] no cards in hand to trash');
            return;
          }

          // Log the mandatory trash prompt for tracing turn start effects.
          console.debug(`[cathedral project] prompting player ${cardEffectArgs.playerId} to trash from ${hand.length} card(s)`);
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Trash a card',
          });

          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Trash a card',
            restrict: hand,
            count: 1,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.warn('[cathedral project] no card selected to trash');
            return;
          }

          // Log the selected card id before trashing.
          console.debug(`[cathedral project] trashing ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
          });
        },
      });
    },
  },
  'citadel': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[citadel project] project card not found');
        return;
      }

      console.info(`[citadel project] registering replay trigger for player ${cardEffectArgs.playerId}`);

      // Citadel replays the first Action card played each turn.
      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'afterCardPlayed', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const currentPlayer = conditionArgs.match.players[conditionArgs.match.currentPlayerTurnIndex];
          if (currentPlayer?.id !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[citadel project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }

          const playedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          if (!playedCard.type.includes('ACTION')) {
            // Log non-action plays that skip Citadel.
            console.debug(`[citadel project] skipping non-action ${playedCard}`);
            return false;
          }

          const turnNumber = conditionArgs.match.turnNumber;
          const playedThisTurn = conditionArgs.match.stats.playedCardsByTurn[turnNumber] ?? [];
          const actionPlaysThisTurn = playedThisTurn.filter(cardId => {
            const playStats = conditionArgs.match.stats.playedCards[cardId];
            if (playStats?.playerId !== cardEffectArgs.playerId) {
              return false;
            }
            const card = conditionArgs.cardLibrary.getCard(cardId);
            return card.type.includes('ACTION');
          });
          const isFirstAction = actionPlaysThisTurn.length === 1;
          if (!isFirstAction) {
            console.debug(`[citadel project] action count for player ${cardEffectArgs.playerId} this turn is ${actionPlaysThisTurn.length}`);
          }
          return isFirstAction;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const replayCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          // Log the replay before executing it.
          console.debug(`[citadel project] replaying ${replayCard}`);
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Replay Action',
          });

          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: replayCard.id,
            overrides: {
              actionCost: 0,
              moveCard: false,
            },
          });
        },
      });
    },
  },
  'city-gate': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[city-gate project] project card not found');
        return;
      }

      console.info(`[city-gate project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[city-gate project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          // Draw first, then topdeck a card from hand.
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Card',
          });

          console.debug(`[city-gate project] drawing 1 card for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });

          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[city-gate project] no cards in hand to topdeck');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Topdeck a card',
          });

          console.debug(`[city-gate project] prompting to topdeck from ${hand.length} card(s)`);
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Put a card from your hand onto your deck',
            restrict: hand,
            count: 1,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.warn('[city-gate project] no card selected to topdeck');
            return;
          }

          console.debug(`[city-gate project] topdecking ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('moveCard', {
            cardId: selectedCardIds[0],
            toPlayerId: cardEffectArgs.playerId,
            to: { location: 'playerDeck' },
          });
        },
      });
    },
  },
  'crop-rotation': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[crop-rotation project] project card not found');
        return;
      }

      console.info(`[crop-rotation project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[crop-rotation project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const victoryCards = triggeredArgs.findCards([
            { location: 'playerHand', playerId: cardEffectArgs.playerId },
            { cardType: ['VICTORY'] },
          ]);

          if (!victoryCards.length) {
            console.debug('[crop-rotation project] no Victory cards in hand to discard');
            return;
          }

          console.debug(`[crop-rotation project] prompting discard from ${victoryCards.length} Victory card(s)`);
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Discard a Victory card for +2 Cards?',
            restrict: victoryCards.map(card => card.id),
            count: 1,
            optional: true,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.debug('[crop-rotation project] player declined to discard a Victory card');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Discard a Victory card',
          });

          console.debug(`[crop-rotation project] discarding ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('discardCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
          });

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+2 Cards',
          });

          console.debug(`[crop-rotation project] drawing 2 cards for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 2,
          });
        },
      });
    },
  },
  'exploration': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[exploration project] project card not found');
        return;
      }

      console.info(`[exploration project] registering buy-phase triggers for player ${cardEffectArgs.playerId}`);

      let gainedDuringBuyPhase = false;

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }
          if (getCurrentPlayer(conditionArgs.match).id !== cardEffectArgs.playerId) {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[exploration project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async () => {
          gainedDuringBuyPhase = false;
          console.debug(`[exploration project] reset buy-phase gain tracking for player ${cardEffectArgs.playerId}`);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          if (getTurnPhase(conditionArgs.match.turnPhaseIndex) !== 'buy') {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);

          if (!owned) {
            return false;
          }

          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          if (gainedDuringBuyPhase) {
            console.debug('[exploration project] already recorded a gain this buy phase');
            return;
          }
          gainedDuringBuyPhase = true;
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          console.debug(`[exploration project] recorded gain of ${gainedCard} during buy phase`);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }

          if (gainedDuringBuyPhase) {
            console.debug('[exploration project] player gained a card during buy phase, skipping reward');
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[exploration project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }
          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Coffer, +1 Villager',
          });

          console.debug(`[exploration project] granting +1 Coffer and +1 Villager to player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
          await triggeredArgs.runGameActionDelegate('gainVillager', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'fair': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[fair project] project card not found');
        return;
      }

      console.info(`[fair project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[fair project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Buy',
          });

          console.debug(`[fair project] granting +1 Buy to player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('gainBuy', { count: 1 });
        },
      });
    },
  },
  'guildhall': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[guildhall project] project card not found');
        return;
      }

      console.info(`[guildhall project] registering treasure-gain trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[guildhall project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          console.debug(`[guildhall project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('TREASURE');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Coffer',
          });

          console.debug(`[guildhall project] granting +1 Coffer to player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'innovation': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[innovation project] project card not found');
        return;
      }

      console.info(`[innovation project] registering gain trigger for player ${cardEffectArgs.playerId}`);

      let usedThisTurn = false;

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[innovation project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async () => {
          usedThisTurn = false;
          console.debug(`[innovation project] reset usage for player ${cardEffectArgs.playerId}`);
        },
      });

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: false,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            return false;
          }

          if (usedThisTurn) {
            console.debug('[innovation project] already used this turn, skipping');
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          console.debug(`[innovation project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('ACTION');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const gainedCard = triggeredArgs.cardLibrary.getCard(triggeredArgs.trigger.args.cardId);
          console.debug(`[innovation project] prompting to play gained card ${gainedCard}`);

          const promptResult = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: `Play ${gainedCard.cardName}?`,
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
            content: {
              type: 'display-cards',
              cardIds: [gainedCard.id],
            },
          }) as { action: number };

          if (promptResult.action !== 2) {
            console.debug('[innovation project] player declined to play gained card');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Play gained Action',
          });

          console.debug(`[innovation project] playing ${gainedCard}`);
          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: gainedCard.id,
            overrides: {
              actionCost: 0,
            },
          });

          usedThisTurn = true;
        },
      });
    },
  },
  'pageant': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[pageant project] project card not found');
        return;
      }

      console.info(`[pageant project] registering end buy phase trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'endTurnPhase', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }
          if (getTurnPhase(conditionArgs.trigger.args.phaseIndex) !== 'buy') {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[pageant project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          if (triggeredArgs.match.playerTreasure < 1) {
            console.debug('[pageant project] no treasure available to pay $1');
            return;
          }

          const result = await triggeredArgs.runGameActionDelegate('userPrompt', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Pay $1 for +1 Coffers? (Pageant)',
            actionButtons: [
              { label: 'NO', action: 1 },
              { label: 'YES', action: 2 },
            ],
          }) as { action: number };

          if (result.action !== 2) {
            console.debug('[pageant project] player declined to pay $1');
            return;
          }

          if (triggeredArgs.match.playerTreasure < 1) {
            console.debug('[pageant project] player no longer has $1 to pay');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Pay $1 for +1 Coffer',
          });

          console.debug('[pageant project] paying $1 and granting +1 Coffer');
          await triggeredArgs.runGameActionDelegate('gainTreasure', { count: -1 });
          await triggeredArgs.runGameActionDelegate('gainCoffer', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'piazza': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[piazza project] project card not found');
        return;
      }

      console.info(`[piazza project] registering start turn trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'startTurn', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[piazza project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
          }
          return owned;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          let deck = triggeredArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);

          if (!deck.length) {
            console.debug('[piazza project] deck empty, shuffling');
            await triggeredArgs.runGameActionDelegate('shuffleDeck', { playerId: cardEffectArgs.playerId });
            deck = triggeredArgs.cardSourceController.getSource('playerDeck', cardEffectArgs.playerId);
          }

          if (!deck.length) {
            console.debug('[piazza project] no cards to reveal after shuffling');
            return;
          }

          const topCardId = deck.slice(-1)[0];
          const topCard = triggeredArgs.cardLibrary.getCard(topCardId);
          console.debug(`[piazza project] revealing ${topCard}`);

          await triggeredArgs.runGameActionDelegate('revealCard', {
            playerId: cardEffectArgs.playerId,
            cardId: topCardId,
          });

          if (!topCard.type.includes('ACTION')) {
            console.debug('[piazza project] revealed card is not an Action, leaving on top');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Play top Action',
          });

          console.debug(`[piazza project] playing ${topCard}`);
          await triggeredArgs.runGameActionDelegate('playCard', {
            playerId: cardEffectArgs.playerId,
            cardId: topCardId,
          });
        },
      });
    },
  },
  'road-network': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[road-network project] project card not found');
        return;
      }

      console.info(`[road-network project] registering victory gain trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardGained', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: false,
        compulsory: true,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId === cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[road-network project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          console.debug(`[road-network project] evaluating gained card ${gainedCard}`);
          return gainedCard.type.includes('VICTORY');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Card',
          });

          console.debug(`[road-network project] drawing 1 card for player ${cardEffectArgs.playerId}`);
          await triggeredArgs.runGameActionDelegate('drawCard', {
            playerId: cardEffectArgs.playerId,
            count: 1,
          });
        },
      });
    },
  },
  'sewers': {
    registerEffects: () => async (cardEffectArgs) => {
      const project = cardEffectArgs.match.projects?.find(candidate => candidate.id === cardEffectArgs.cardId);
      if (!project) {
        console.warn('[sewers project] project card not found');
        return;
      }

      console.info(`[sewers project] registering trash trigger for player ${cardEffectArgs.playerId}`);

      cardEffectArgs.reactionManager.registerSystemTemplate(project, 'cardTrashed', {
        playerId: cardEffectArgs.playerId,
        once: false,
        allowMultipleInstances: true,
        compulsory: false,
        condition: (conditionArgs) => {
          if (conditionArgs.trigger.args.playerId !== cardEffectArgs.playerId) {
            return false;
          }

          const owned = isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
          if (!owned) {
            console.debug(`[sewers project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }

          const hand = conditionArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[sewers project] no cards in hand to trash');
            return false;
          }

          return true;
        },
        triggeredEffectFn: async (triggeredArgs) => {
          const hand = triggeredArgs.cardSourceController.getSource('playerHand', cardEffectArgs.playerId);
          if (!hand.length) {
            console.debug('[sewers project] no cards in hand to trash');
            return;
          }

          console.debug(`[sewers project] prompting to trash from ${hand.length} card(s)`);
          const selectedCardIds = await triggeredArgs.runGameActionDelegate('selectCard', {
            playerId: cardEffectArgs.playerId,
            prompt: 'Trash a card from your hand',
            restrict: hand,
            count: 1,
            optional: true,
          }) as CardId[];

          if (!selectedCardIds.length) {
            console.debug('[sewers project] player declined to trash');
            return;
          }

          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: 'Trash a card',
          });

          console.debug(`[sewers project] trashing ${selectedCardIds[0]}`);
          await triggeredArgs.runGameActionDelegate('trashCard', {
            playerId: cardEffectArgs.playerId,
            cardId: selectedCardIds[0],
          });
        },
      });
    },
  },
};

export default effectMap;
