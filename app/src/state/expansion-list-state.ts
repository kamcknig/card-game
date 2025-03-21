import { atom } from 'nanostores';

export const $expansionList = atom([]);

export const $selectedExpansions = atom<string[]>([]);
