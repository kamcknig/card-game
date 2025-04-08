import { atom, computed } from 'nanostores';
import { Player, TurnPhaseOrderValues } from 'shared/shared-types';
import { matchStore } from './match';
import { TurnPhase } from '../../types';

export const playerTreasureStore =
  computed(matchStore, m => m?.playerTreasure ?? 0);

export const playerBuysStore =
  computed(matchStore, m => m?.playerBuys ?? 0);

export const playerActionsStore =
  computed(matchStore, m => m?.playerActions ?? 0);

export const playerTurnOrder =
  computed(matchStore, m => m?.players ?? []);

export const currentPlayerTurnIndexStore =
  computed(matchStore, m => m?.currentPlayerTurnIndex ?? 0);

export const currentPlayerTurnIdStore =
  computed([currentPlayerTurnIndexStore, playerTurnOrder], (turnIndex, turnOrder) => turnOrder[turnIndex]?.id);

export const turnNumberStore =
  computed(matchStore, m => m?.turnNumber ?? 0);

export const turnPhaseStore =
  computed(matchStore, m => TurnPhaseOrderValues[m?.turnPhaseIndex ?? 0]);
