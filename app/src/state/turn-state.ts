import { atom, computed } from "nanostores";
import { Player, TurnPhase } from "shared/shared-types";

export const $playerTreasure = atom<number>(0);

export const $playerBuys = atom<number>(0);

export const $playerActions = atom<number>(0);

export const $playerTurnOrder = atom<Player[]>([]);

export const $currentPlayerTurnIndex = atom<number>();

export const $currentPlayerTurnId =
  computed([$currentPlayerTurnIndex, $playerTurnOrder], (turnIndex, turnOrder) => turnOrder[turnIndex]?.id);

export const $turnNumber = atom<number>(0);

export const $turnPhase = atom<TurnPhase | undefined>();
