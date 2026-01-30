import { computed } from 'nanostores';
import { clientSelectablePilesOverrideStore } from './interactive-state';

// Final store that components should subscribe to for selectable piles.
export const selectablePileStore = computed(
  [clientSelectablePilesOverrideStore],
  (clientOverride) => clientOverride ?? []
);

(globalThis as any).selectablePileStore = selectablePileStore;
