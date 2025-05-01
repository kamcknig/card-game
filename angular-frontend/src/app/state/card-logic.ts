import { computed } from 'nanostores';
import { matchStore, selfPlayerIdStore } from './match-state';

export const cardOverrideStore = computed(
  [matchStore, selfPlayerIdStore],
  (match, selfId) => selfId && match ? match.cardOverrides[selfId] ?? {} : {}
)
