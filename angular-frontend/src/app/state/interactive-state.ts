import { atom } from 'nanostores'
import { CardId } from 'shared/shared-types';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);
(globalThis as any).clientSelectableCardsOverrideStore = clientSelectableCardsOverrideStore;

export const selectedCardStore = atom<CardId[]>([]);
(globalThis as any).selectedCardStore = selectedCardStore;

export const awaitingServerLockReleaseStore = atom<boolean>(false);
(globalThis as any).awaitingServerLockReleaseStore = awaitingServerLockReleaseStore;
