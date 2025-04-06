import { atom, WritableAtom } from 'nanostores';
import { Player, PlayerID } from 'shared/shared-types';

export const selfPlayerIdStore = atom<PlayerID | undefined>();

export const playerIdStore = atom<number[]>([]);

const playerStoreCache: Record<PlayerID, WritableAtom<Player | undefined>> = {};
export const playerStore = (id: PlayerID) => (playerStoreCache[id] ??= atom<Player | undefined>());

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
