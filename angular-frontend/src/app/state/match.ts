import { atom } from 'nanostores';
import { Match } from 'shared/shared-types';

export const matchStore = atom<Match | null>(null);
