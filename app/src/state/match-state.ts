import { atom } from "nanostores";
import { MatchConfiguration } from "shared/types";

export const $supplyStore = atom<number[]>([]);

export const $kingdomStore = atom<number[]>([]);

export const $trashStore = atom<number[]>([]);

export const $playAreaStore = atom<number[]>([]);

export const $matchConfiguration = atom<Pick<MatchConfiguration, 'expansions'>>();
