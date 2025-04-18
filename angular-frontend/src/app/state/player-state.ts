import { atom, computed, WritableAtom } from 'nanostores';
import { Player, PlayerId } from 'shared/shared-types';

import { matchStore } from './match-state';

export const playerIdStore = atom<number[]>([]);
(globalThis as any).playerIdStore = playerIdStore;

const playerStoreCache: Record<PlayerId, WritableAtom<Player | undefined>> = {};
export const playerStore = (id: PlayerId) => (playerStoreCache[id] ??= atom<Player | undefined>());
(globalThis as any).playerStore = playerStore;

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
