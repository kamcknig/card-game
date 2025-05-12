import { atom } from 'nanostores';
import { CardKey } from 'shared/shared-types';

export const basicSupplies = atom<[CardKey[], CardKey[]]>([[], []]);

export const kingdomSupplies = atom<CardKey[]>([]);


