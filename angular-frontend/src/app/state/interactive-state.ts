import { atom, computed } from 'nanostores';
import { matchStore } from './match';
import { selfPlayerIdStore } from './player-state';
import { CardId } from 'shared/shared-types';

// Tracks client override if one exists
export const clientSelectableCardsOverrideStore = atom<CardId[] | null>(null);

// Derived directly from server match state
export const serverSelectableCardsStore = computed([matchStore, selfPlayerIdStore], (match, selfPlayerId) => {
  if (!match || selfPlayerId == null) return [];
  return match.selectableCards?.[selfPlayerId] ?? [];
});

// Final store that components should subscribe to
export const selectableCardStore = computed(
  [clientSelectableCardsOverrideStore, serverSelectableCardsStore],
  (clientOverride, serverCards) => clientOverride ?? serverCards
);

export const selectedCardStore = atom<number[]>([]);

export const cardActionsInProgressStore = atom(false);
