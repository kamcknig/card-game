import { TurnPhaseOrderValues } from 'shared/shared-types.ts';

export const getTurnPhase = (match: { turnPhaseIndex: number }) => {
  return TurnPhaseOrderValues[match.turnPhaseIndex];
}
