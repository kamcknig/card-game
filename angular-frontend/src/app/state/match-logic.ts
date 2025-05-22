import { atom, computed } from 'nanostores';
import { CardKey, Match } from 'shared/shared-types';
import { matchStore } from './match-state';

export const basicSupplies = atom<[CardKey[], CardKey[]]>([[], []]);

export const kingdomSupplies = atom<CardKey[]>([]);

export const events = computed(
  matchStore,
  match => match?.events ?? []
);
