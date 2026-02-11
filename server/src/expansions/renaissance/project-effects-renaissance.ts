import {CardExpansionModule} from '../../types.ts';
import {Match, PlayerId, Project} from 'shared/shared-types';

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
            console.debug(`[academy project] player ${cardEffectArgs.playerId} does not own cube for project ${project.id}`);
            return false;
          }

          const gainedCard = conditionArgs.cardLibrary.getCard(conditionArgs.trigger.args.cardId);
          return gainedCard.type.includes('ACTION');
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Villager',
          });

          console.debug(`[academy project] granting +1 Villager to player ${cardEffectArgs.playerId}`);
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

          return isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
        },
        triggeredEffectFn: async (triggeredArgs) => {
          triggeredArgs.logManager.addLogEntry({
            type: 'cardLikeEffect',
            playerId: cardEffectArgs.playerId,
            cardLikeId: project.id,
            effectText: '+1 Action',
          });

          console.debug(`[barracks project] granting +1 Action to player ${cardEffectArgs.playerId}`);
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

      const registerRules = () => {
        if (ruleUnsubs.length > 0) {
          ruleUnsubs.forEach(unsub => unsub());
          ruleUnsubs = [];
        }

        const allCards = cardEffectArgs.cardLibrary.getAllCardsAsArray();

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

      const clearRules = () => {
        if (!ruleUnsubs.length) return;
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
          return isProjectOwned(conditionArgs.match, cardEffectArgs.playerId, project);
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
};

export default effectMap;
