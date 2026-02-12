import { TurnPhaseOrderValues } from 'shared/shared-types';

export const getTurnPhase = (phaseIndex: number) => {
  return TurnPhaseOrderValues[phaseIndex];
};
