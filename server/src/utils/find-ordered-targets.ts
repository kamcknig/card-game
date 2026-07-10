import { EffectTarget, Match, Player, PlayerId } from 'shared/types/index.ts';
import type { LoggerService } from '../core/logger-service.ts';
import { getOrderStartingFrom } from './get-order-starting-from.ts';

type FindTargetsArgs = {
  match: Match;
  startingPlayerId?: PlayerId;
  appliesTo: EffectTarget;
  loggerService?: LoggerService;
};

// Resolves an EffectTarget expression into an ordered list of player ids,
// starting from `startingPlayerId` and following turn order. Only ALL and
// ALL_OTHER are implemented — every real call site in the codebase uses one
// of the two (verified by grep across src/expansions and src/core). The
// previously-present "any single player" branch returned a hardcoded [1] (a
// wrong-answer landmine) and the N-others pattern branch returned an empty
// array; both were dead code and have been removed.
export const findOrderedTargets = (args: FindTargetsArgs): number[] => {
  const { startingPlayerId: currentPlayerTurnId, match, appliesTo: target } = args;
  args.loggerService?.info('findEffectTargetIds current player', currentPlayerTurnId, 'target', target);

  const currentTurnOrder = match.players;
  const l = currentTurnOrder.length;
  if (l === 0) {
    return [];
  }

  // JS `%` preserves the sign of the dividend, so a raw negative index (e.g.
  // findIndex returning -1 for an unrecognized player) must be re-wrapped
  // into [0, l) before indexing via getOrderStartingFrom.
  const normalizeIndex = (idx: number) => ((idx % l) + l) % l;

  let result: Player[] = [];

  switch (target) {
    case 'ALL': {
      args.loggerService?.info('find targets for ALL');
      const startIndex = currentTurnOrder.findIndex(player => player.id === currentPlayerTurnId);
      result = getOrderStartingFrom(currentTurnOrder, normalizeIndex(startIndex));
      args.loggerService?.info('target players in order starting from current player', result);
      break;
    }
    case 'ALL_OTHER': {
      args.loggerService?.info('find targets for ALL_OTHER');
      const currentIndex = currentTurnOrder.findIndex(player => player.id === currentPlayerTurnId);
      // Full rotation starting just after the current player, then drop the
      // wrap-around entry (the current player themself) at the tail.
      result = getOrderStartingFrom(currentTurnOrder, normalizeIndex(currentIndex + 1)).slice(0, l - 1);
      args.loggerService?.info('target players in order (ALL_OTHER)', result);
      break;
    }
    default:
      args.loggerService?.error(`findOrderedTargets: unsupported target expression '${target}'`);
      result = [];
      break;
  }

  return result.map(player => player.id);
};
