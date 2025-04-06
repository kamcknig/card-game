import { atom, computed, WritableAtom } from 'nanostores';
import { Player, PlayerId } from 'shared/shared-types';
import { matchStore } from './match';

export const selfPlayerIdStore = atom<PlayerId | undefined>();

export const playerIdStore = atom<number[]>([]);

const playerStoreCache: Record<PlayerId, WritableAtom<Player | undefined>> = {};
export const playerStore = (id: PlayerId) => (playerStoreCache[id] ??= atom<Player | undefined>());

export const playerHandStore = (playerId: number) =>
  computed(matchStore, m => m?.playerHands[playerId] ?? []);

export const playerDeckStore = (playerId: number) =>
  computed(matchStore, m => m?.playerHands[playerId] ?? []);

export const playerDiscardStore = (playerId: number) =>
  computed(matchStore, m => m?.playerDiscards[playerId] ?? []);

export const playerScoreStore = (playerId: number) =>
  computed(matchStore, m => m?.scores[playerId] ?? 0);
