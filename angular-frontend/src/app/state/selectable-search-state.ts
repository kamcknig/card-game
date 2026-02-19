import { atom } from 'nanostores';
import { SelectableSearchCatalog } from 'shared/types';

// Empty catalog used until server sends initial searchable landscape data.
const EMPTY_SELECTABLE_SEARCH_CATALOG: SelectableSearchCatalog = {
  cards: [],
  events: [],
  landmarks: [],
  artifacts: [],
  projects: [],
  ways: [],
};

// Cached search dataset used by match-configuration landscape selection UI.
export const selectableSearchCatalogStore = atom<SelectableSearchCatalog>(EMPTY_SELECTABLE_SEARCH_CATALOG);

(globalThis as any).selectableSearchCatalogStore = selectableSearchCatalogStore;
