import { atom, computed } from 'nanostores';
import { matchStore } from './match';
import { selfPlayerIdStore } from './player-state';
import { CardId } from 'shared/shared-types';
import { pixiInstance } from '../core/pixi-application.factory';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);

(globalThis as any).clientSelectableCardsOverrideStore = clientSelectableCardsOverrideStore;

// Derived directly from server match state
export const serverSelectableCardsStore = computed([matchStore, selfPlayerIdStore], (match, selfPlayerId) => {
  if (!match || selfPlayerId == null) return [];
  return match.selectableCards?.[selfPlayerId] ?? [];
});

(globalThis as any).clientSelectableCardsOverrideStore = serverSelectableCardsStore;

// Final store that components should subscribe to
export const selectableCardStore = computed(
  [clientSelectableCardsOverrideStore, serverSelectableCardsStore],
  (clientOverride, serverCards) => clientOverride ?? serverCards
);

(globalThis as any).selectableCardStore = selectableCardStore;

export const selectedCardStore = atom<CardId[]>([]);

(globalThis as any).selectedCardStore = selectedCardStore;

export const awaitingServerLockReleaseStore = atom<boolean>(false);
