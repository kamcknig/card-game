import {atom, computed, map, PreinitializedWritableAtom} from "nanostores";
import { Player, PlayerID } from 'shared/shared-types';

export const $selfPlayerId = atom<number>();

export const $playerIds = atom<number[]>([]);

const playerStoreCache: Record<PlayerID, PreinitializedWritableAtom<Player>> = {};
export const $player = (id: PlayerID) => (playerStoreCache[id] ??= atom<Player>());

const playerHandStores: Record<number,  PreinitializedWritableAtom<number[]>> = {};
export const $playerHandStore = (playerId: number) => {
    playerHandStores[playerId] ??= atom<number[]>([]);
    return playerHandStores[playerId];
}

const playerDeckStores: Record<number, PreinitializedWritableAtom<number[]>> = {};
export const $playerDeckStore = (playerId: number) => {
    playerDeckStores[playerId] ??= atom<number[]>([]);
    return playerDeckStores[playerId];
}

const playerDiscardStore: Record<number, PreinitializedWritableAtom<number[]>> = {};
export const $playerDiscardStore = (playerId: number) => {
    playerDiscardStore[playerId] ??= atom<number[]>([]);
    return playerDiscardStore[playerId];
}

const playerScoreStore: Record<number, PreinitializedWritableAtom<number>> = {};
export const $playerScoreStore = (playerId: number) => {
    playerScoreStore[playerId] ??= atom<number>(0);
    return playerScoreStore[playerId];
}
