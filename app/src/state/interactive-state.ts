import {atom, computed} from "nanostores";

export const $selectableCards = atom<number[]>([]);

export const $selectedCards = atom<number[]>([]);
