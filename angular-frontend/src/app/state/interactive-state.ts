import { atom } from 'nanostores'
import { CardId, CardKey } from 'shared/types';
import { serverSelectableCardsStore } from './interactive-logic';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);
export const clientSelectablePilesOverrideStore = atom<CardKey[] | null>(null);

export const selectedCardStore = atom<CardId[]>([]);
export const selectedPileStore = atom<CardKey[]>([]);
// Optional override for prompts that allow selecting a hand Action to play as a Way.
export const promptWaySelectableCardsOverrideStore = atom<CardId[] | null>(null);

export const awaitingServerLockReleaseStore = atom<boolean>(false);
// Tracks whether the UI is currently handling a client prompt (select-card/select-pile/user-prompt).
export const promptInteractionLockStore = atom<boolean>(false);


(globalThis as any).awaitingServerLockReleaseStore = awaitingServerLockReleaseStore;
(globalThis as any).promptInteractionLockStore = promptInteractionLockStore;
(globalThis as any).selectedCardStore = selectedCardStore;
(globalThis as any).clientSelectableCardsOverrideStore = clientSelectableCardsOverrideStore;
(globalThis as any).promptWaySelectableCardsOverrideStore = promptWaySelectableCardsOverrideStore;
(globalThis as any).selectedPileStore = selectedPileStore;
(globalThis as any).clientSelectablePilesOverrideStore = clientSelectablePilesOverrideStore;
