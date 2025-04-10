import { atom } from 'nanostores';

export const expansionListStore = atom<any[]>([]);
(globalThis as any).expansionListStore = expansionListStore;
