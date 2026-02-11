import {CardExpansionModule} from '../../types.ts';
import {CardId, Match, PlayerId, Project} from 'shared/shared-types';

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
};

export default effectMap;
