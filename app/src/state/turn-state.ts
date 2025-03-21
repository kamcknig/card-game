import {atom, computed} from "nanostores";
import {$players} from "./player-state";
import {TurnPhase} from "shared/types";

export const $playerTreasure = atom<number>(0);

export const $playerBuys = atom<number>(0);

export const $playerActions = atom<number>(0);

export const $currentPlayerTurnIndexActual = atom<number>(0);

export const $playerTurnOrder = atom<number[]>([]);

export const $currentPlayerTurnIndex =
    computed([$currentPlayerTurnIndexActual, $playerTurnOrder], (actual, turnOrder) => actual % turnOrder.length);

export const $currentPlayerTurnId =
    computed([$currentPlayerTurnIndexActual, $playerTurnOrder], (turnIndex, turnOrder) => turnOrder[turnIndex % turnOrder.length]);

export const $nextPlayerTurnId =
    computed([$currentPlayerTurnIndexActual, $playerTurnOrder], (turnIndex, turnOrder) => (turnIndex + 1) % turnOrder.length);

export const $turnNumber = atom<number>(0);

export const $turnPhase = atom<TurnPhase | undefined>();

export const $currentTurnPlayer = computed([$currentPlayerTurnId, $players], (turnId, players) => players[turnId]);
