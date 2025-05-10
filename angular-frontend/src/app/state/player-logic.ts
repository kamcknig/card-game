import { computed } from 'nanostores';
import { matchStore } from './match-state';

export const playerScoreStore = (playerId: number) =>
  computed(matchStore, m => m?.scores[playerId] ?? 0);
(globalThis as any).playerScoreStore = playerScoreStore;
