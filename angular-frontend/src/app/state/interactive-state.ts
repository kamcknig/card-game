import { atom } from 'nanostores';

export const selectableCardStore = atom<number[]>([]);

export const selectedCardStore = atom<number[]>([]);

export const cardActionsInProgressStore = atom(false);
