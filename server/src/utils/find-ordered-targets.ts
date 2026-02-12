import { EffectTarget, Match, Player, PlayerId } from 'shared/shared-types';
import { isNull } from 'es-toolkit';

type FindTargetsArgs = {
  match: Match;
  startingPlayerId?: PlayerId;
  appliesTo: EffectTarget;
};

export const findOrderedTargets = (args: FindTargetsArgs): number[] => {
  const { startingPlayerId: currentPlayerTurnId, match } = args;
  let { appliesTo: target } = args;
  console.info('findEffectTargetIds current player', currentPlayerTurnId, 'target', target);

  const otherCountRegExResult = /(\d+)_OTHER/.exec(target);
  let otherCount;
  if (!isNull(otherCountRegExResult)) {
    target = 'X_OTHER';
    otherCount = otherCountRegExResult[1];
    console.info('X_OTHER count', otherCount);
  }

  let result: Player[] = [];
  const currentTurnOrder = match.players;

  switch (target) {
    case 'ALL': {
      console.info('find targets for ALL');
      const startIndex = currentTurnOrder.findIndex((player) => player.id === currentPlayerTurnId);
      const l = currentTurnOrder.length;
      for (let i = 0; i < l; i++) {
        const idx = (startIndex + i) % currentTurnOrder.length;
        result.push(currentTurnOrder[idx]);
      }
      console.info('target players in order starting from current player', result);
      break;
    }
    case 'ANY':
      console.error('find targets for ANY not implemented');
      return [1];
    case 'ALL_OTHER': {
      console.info('find targets for ALL_OTHER');
      const currentIndex = currentTurnOrder.findIndex((player) => player.id === currentPlayerTurnId);

      const reordered = [];
      const l = currentTurnOrder.length;
      for (let i = 1; i < l; i++) {
        const idx = (currentIndex + i) % l;
        reordered.push(currentTurnOrder[idx]);
      }

      result = reordered;
      console.info('target players in order (ALL_OTHER)', result);
      break;
    }
    case 'X_OTHER':
      console.error('find targets for X_OTHER not implemented');
      result = [];
      break;
    default:
      result = [];
      break;
  }

  return result.map((player) => player.id);
};
