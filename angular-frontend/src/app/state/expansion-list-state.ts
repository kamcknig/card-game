import { atom } from 'nanostores';
import { ExpansionListElement } from 'shared/types';

export const expansionListStore = atom<ExpansionListElement[]>([]);
(globalThis as any).expansionListStore = expansionListStore;
