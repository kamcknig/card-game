import { computed, ReadableAtom } from 'nanostores';
import { matchStore } from './match-state';
import { PlayerId } from 'shared/shared-types';

export const cofferStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any).coffers ?? {});
