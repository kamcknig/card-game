import { atom } from 'nanostores';
import { CardKey } from 'shared/shared-types';

export const supplyCardKeyStore = atom<[CardKey[], CardKey[]]>([[], []]);

export const kingdomCardKeyStore = atom<CardKey[]>([]);


