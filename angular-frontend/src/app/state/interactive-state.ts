import { atom, computed } from 'nanostores'
import { CardId } from 'shared/shared-types';
import { matchStore, selfPlayerIdStore } from './match-state';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);
(globalThis as any).clientSelectableCardsOverrideStore = clientSelectableCardsOverrideStore;

export const selectedCardStore = atom<CardId[]>([]);
(globalThis as any).selectedCardStore = selectedCardStore;

export const awaitingServerLockReleaseStore = atom<boolean>(false);
(globalThis as any).awaitingServerLockReleaseStore = awaitingServerLockReleaseStore;
