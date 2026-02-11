import { CardExpansionModule } from '../../types.ts';

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

          const ownedCube = Object.values(conditionArgs.match.tokens ?? {}).some(token =>
            token.tokenId === 'cube-token' &&
            token.ownerId === cardEffectArgs.playerId &&
            token.location.type === 'cardLike' &&
            token.location.cardLikeId === project.id
          );
          if (!ownedCube) {
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

          const ownedCube = Object.values(conditionArgs.match.tokens ?? {}).some(token =>
            token.tokenId === 'cube-token' &&
            token.ownerId === cardEffectArgs.playerId &&
            token.location.type === 'cardLike' &&
            token.location.cardLikeId === project.id
          );
          return ownedCube;
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
};

export default effectMap;
