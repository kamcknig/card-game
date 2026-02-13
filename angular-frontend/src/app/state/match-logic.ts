import { atom, computed } from 'nanostores';
import { CardKey, Match } from 'shared/types/index.ts';
import { matchStore } from './match-state';

export const basicSupplies = atom<[CardKey[], CardKey[]]>([[], []]);

export const kingdomSupplies = atom<CardKey[]>([]);

export const events = computed(
  matchStore,
  match => match?.events ?? []
);

// Expose landmarks from the current match state for UI rendering.
export const landmarks = computed(
  matchStore,
  match => match?.landmarks ?? []
);

// Expose projects from the current match state for UI rendering.
export const projects = computed(
  matchStore,
  match => match?.projects ?? []
);
