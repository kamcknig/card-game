import { TurnPhaseOrderValues } from 'shared/types/index.ts';

export const getTurnPhase = (phaseIndex: number) => {
  return TurnPhaseOrderValues[phaseIndex];
};
