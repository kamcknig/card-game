import { atom } from "nanostores";
import { MatchConfiguration } from "shared/shared-types";

export const supplyStore = atom<number[]>([]);

export const kingdomStore = atom<number[]>([]);

export const $trashStore = atom<number[]>([]);

export const $playAreaStore = atom<number[]>([]);

export const matchConfigurationStore = atom<Pick<MatchConfiguration, 'expansions'> | undefined>();

export const $matchStarted = atom<boolean>(false);
