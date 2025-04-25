import { atom } from 'nanostores';

export const expansionListStore = atom<{
  title: string;
  name: string;
  order: number;
}[]>([]);
(globalThis as any).expansionListStore = expansionListStore;
