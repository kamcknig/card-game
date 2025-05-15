import { atom } from 'nanostores'
import { CardId } from 'shared/shared-types';
import { serverSelectableCardsStore } from './interactive-logic';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);

export const selectedCardStore = atom<CardId[]>([]);

export const awaitingServerLockReleaseStore = atom<boolean>(false);


(globalThis as any).awaitingServerLockReleaseStore = awaitingServerLockReleaseStore;
(globalThis as any).selectedCardStore = selectedCardStore;
(globalThis as any).clientSelectableCardsOverrideStore = clientSelectableCardsOverrideStore;
