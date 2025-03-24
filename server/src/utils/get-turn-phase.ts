import { TurnPhaseOrderValues } from 'shared/types.ts';

export const getTurnPhase = (match: { turnPhaseIndex: number }) => {
  return TurnPhaseOrderValues[match.turnPhaseIndex];
}
