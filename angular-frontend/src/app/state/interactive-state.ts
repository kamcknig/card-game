import { atom } from 'nanostores'
import { CardId, CardKey } from 'shared/types/index.ts';
import { serverSelectableCardsStore } from './interactive-logic';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);
export const clientSelectablePilesOverrideStore = atom<CardKey[] | null>(null);

export const selectedCardStore = atom<CardId[]>([]);
export const selectedPileStore = atom<CardKey[]>([]);

export const awaitingServerLockReleaseStore = atom<boolean>(false);


(globalThis as any).awaitingServerLockReleaseStore = awaitingServerLockReleaseStore;
(globalThis as any).selectedCardStore = selectedCardStore;
(globalThis as any).clientSelectableCardsOverrideStore = clientSelectableCardsOverrideStore;
(globalThis as any).selectedPileStore = selectedPileStore;
(globalThis as any).clientSelectablePilesOverrideStore = clientSelectablePilesOverrideStore;
