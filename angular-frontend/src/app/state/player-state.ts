import { atom, WritableAtom } from 'nanostores';
import { Player, PlayerId } from 'shared/shared-types';

export const selfPlayerIdStore = atom<PlayerId | undefined>();

export const playerIdStore = atom<number[]>([]);

const playerStoreCache: Record<PlayerId, WritableAtom<Player | undefined>> = {};
export const playerStore = (id: PlayerId) => (playerStoreCache[id] ??= atom<Player | undefined>());

const playerHandStoreCache: Record<number,  WritableAtom<number[]>> = {};
export const playerHandStore = (playerId: number) => {
    playerHandStoreCache[playerId] ??= atom<number[]>([]);
    return playerHandStoreCache[playerId];
}

const playerDeckStoreCache: Record<number, WritableAtom<number[]>> = {};
export const playerDeckStore = (playerId: number) => {
    playerDeckStoreCache[playerId] ??= atom<number[]>([]);
    return playerDeckStoreCache[playerId];
}

const playerDiscardStoreCache: Record<number, WritableAtom<number[]>> = {};
export const playerDiscardStore = (playerId: number) => {
    playerDiscardStoreCache[playerId] ??= atom<number[]>([]);
    return playerDiscardStoreCache[playerId];
}

const playerScoreStoreCache: Record<number, WritableAtom<number>> = {};
export const playerScoreStore = (playerId: number) => {
    playerScoreStoreCache[playerId] ??= atom<number>(0);
    return playerScoreStoreCache[playerId];
}
