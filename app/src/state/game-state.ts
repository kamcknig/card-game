import {atom} from "nanostores";

export const $gamePaused = atom<boolean>(false);

export const $gameOwner = atom<number | undefined>();
