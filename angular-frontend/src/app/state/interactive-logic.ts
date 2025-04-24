import { clientSelectableCardsOverrideStore } from './interactive-state';
import { computed } from 'nanostores';
import { matchStore, selfPlayerIdStore } from './match-state';

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
