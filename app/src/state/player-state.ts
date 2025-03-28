import {atom, computed, map, PreinitializedWritableAtom} from "nanostores";
import {Player} from "shared/shared-types";

export type PlayerState = Record<number, Player>;

export const $selfPlayerId = atom<number>();

export const $players = map<PlayerState>({});

export const $numberOfPlayers = computed($players, players => Object.keys(players).length);

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
