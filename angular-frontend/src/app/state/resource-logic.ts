import { computed, ReadableAtom } from 'nanostores';
import { matchStore } from './match-state';
import { PlayerId } from 'shared/types';

export const cofferStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any)?.coffers ?? {});
// Tracks per-player Villagers tokens for UI rendering.
export const villagerStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any)?.villagers ?? {});
// Tracks per-player debt tokens for UI rendering.
export const debtStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any)?.debt ?? {});
