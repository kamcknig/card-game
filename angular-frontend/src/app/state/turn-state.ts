import { computed } from 'nanostores';
import { TurnPhaseOrderValues } from 'shared/shared-types';

import { matchStore } from './match-state';

export const playerTreasureStore =
  computed(matchStore, m => m?.playerTreasure ?? 0);
(globalThis as any).playerTreasureStore = playerTreasureStore;

export const playerBuysStore =
  computed(matchStore, m => m?.playerBuys ?? 0);
(globalThis as any).playerBuysStore = playerBuysStore;

export const playerPotionStore =
  computed(matchStore, m => m?.playerPotions ?? 0);
(globalThis as any).playerPotionStore = playerPotionStore;

export const playerActionsStore =
  computed(matchStore, m => m?.playerActions ?? 0);
(globalThis as any).playerActionsStore = playerActionsStore;

export const playerTurnOrderStore =
  computed(matchStore, m => m?.players ?? []);
(globalThis as any).playerTurnOrderStore = playerTurnOrderStore;

export const currentPlayerTurnIndexStore =
  computed(matchStore, m => m?.currentPlayerTurnIndex ?? 0);
(globalThis as any).currentPlayerTurnIndexStore = currentPlayerTurnIndexStore;

export const currentPlayerStore =
  computed([currentPlayerTurnIndexStore, playerTurnOrderStore], (turnIndex, turnOrder) => turnOrder[turnIndex]);
(globalThis as any).currentPlayerStore = currentPlayerStore;

export const currentPlayerTurnIdStore =
  computed([currentPlayerTurnIndexStore, playerTurnOrderStore], (turnIndex, turnOrder) => turnOrder[turnIndex]?.id);
(globalThis as any).currentPlayerTurnIdStore = currentPlayerTurnIdStore;

export const turnNumberStore =
  computed(matchStore, m => m?.turnNumber ?? 0);
(globalThis as any).turnNumberStore = turnNumberStore;

export const turnPhaseStore =
  computed(matchStore, m => TurnPhaseOrderValues[m?.turnPhaseIndex ?? 0]);
(globalThis as any).turnPhaseStore = turnPhaseStore;
