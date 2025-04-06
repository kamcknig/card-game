import { atom, computed } from "nanostores";
import { Player, TurnPhase } from "shared/shared-types";

export const playerTreasureStore = atom<number>(0);

export const playerBuysStore = atom<number>(0);

export const playerActionsStore = atom<number>(0);

export const playerTurnOrder = atom<Player[]>([]);

export const currentPlayerTurnIndexStore = atom<number>(0);

export const $currentPlayerTurnId =
  computed([currentPlayerTurnIndexStore, playerTurnOrder], (turnIndex, turnOrder) => turnOrder[turnIndex]?.id);

export const turnNumberStore = atom<number>(0);

export const turnPhaseStore = atom<TurnPhase | undefined>();
