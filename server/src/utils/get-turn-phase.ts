import { Match, TurnPhaseOrderValues } from 'shared/types.ts';

export const getTurnPhase = (match: Match) => {
  return TurnPhaseOrderValues[(match.turnPhaseIndex) % TurnPhaseOrderValues.length];
}
