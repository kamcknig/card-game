import { computed } from 'nanostores';
import { matchStore } from './match-state';
import { selfPlayerIdStore } from './player-state';

export const cardOverrideStore = computed(
  [matchStore, selfPlayerIdStore],
  (match, selfId) => selfId && match ? match.cardOverrides[selfId] ?? {} : {}
)
