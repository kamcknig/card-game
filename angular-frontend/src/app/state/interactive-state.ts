import {atom, computed} from "nanostores";

export const selectableCardStore = atom<number[]>([]);

export const selectedCardStore = atom<number[]>([]);

export const $runningCardActions = atom(false);
