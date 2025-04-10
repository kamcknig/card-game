import { TurnPhaseOrderValues } from "shared/shared-types.ts";

export const getTurnPhase = (phaseIndex: number) => {
  return TurnPhaseOrderValues[phaseIndex];
}