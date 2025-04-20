import { atom, WritableAtom } from 'nanostores';
import { Player, PlayerId } from 'shared/shared-types';

export const playerIdStore = atom<number[]>([]);
(globalThis as any).playerIdStore = playerIdStore;

const playerStoreCache: Record<PlayerId, WritableAtom<Player | undefined>> = {};
export const playerStore = (id: PlayerId) => (playerStoreCache[id] ??= atom<Player | undefined>());
(globalThis as any).playerStore = playerStore;
