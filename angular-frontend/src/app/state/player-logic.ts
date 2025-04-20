import { computed } from 'nanostores';
import { matchStore } from './match-state';

export const playerHandStore = (playerId: number) =>
  computed(matchStore, m => m?.playerHands[playerId] ?? []);
(globalThis as any).playerHandStore = playerHandStore;

export const playerDeckStore = (playerId: number) =>
  computed(matchStore, m => m?.playerDecks[playerId] ?? []);
(globalThis as any).playerDeckStore = playerDeckStore;

export const playerDiscardStore = (playerId: number) =>
  computed(matchStore, m => m?.playerDiscards[playerId] ?? []);
(globalThis as any).playerDiscardStore = playerDiscardStore;

export const playerScoreStore = (playerId: number) =>
  computed(matchStore, m => m?.scores[playerId] ?? 0);
(globalThis as any).playerScoreStore = playerScoreStore;
