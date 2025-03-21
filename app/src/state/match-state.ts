import {atom, PreinitializedWritableAtom} from "nanostores";
import {CardLocation, Match} from "shared/types";

export const $supplyStore = atom<number[]>([]);

export const $kingdomStore = atom<number[]>([]);

export const $trashStore = atom<number[]>([]);

export const $playAreaStore = atom<number[]>([]);

const zoneStores: Partial<Record<CardLocation, PreinitializedWritableAtom<number[]>>> = {};

export const $getCardLocationStore = (location: CardLocation) => {
    zoneStores[location] ??= atom<number[]>([]);
    return zoneStores[location];
}
