import { atom, computed, map } from 'nanostores';
import { CardId, Match, MatchConfiguration, MatchSummary, Mats } from 'shared/shared-types';

export const matchStore = atom<Match | null>(null);
(globalThis as any).matchStore = matchStore;

export const supplyStore =
  computed(matchStore, m => m?.supply ?? []);
(globalThis as any).supplyStore = supplyStore;

export const kingdomStore =
  computed(matchStore, m => m?.kingdom ?? []);
(globalThis as any).kingdomStore = kingdomStore;

export const trashStore =
  computed(matchStore, m => m?.trash ?? []);
(globalThis as any).trashStore = trashStore;

export const playAreaStore =
  computed(matchStore, m => m?.playArea ?? []);
(globalThis as any).playAreaStore = playAreaStore;

export const lobbyMatchConfigurationStore = atom<string[]>([]);
(globalThis as any).matchStartedStore = lobbyMatchConfigurationStore;

export const matchStartedStore = atom<boolean>(false);
(globalThis as any).matchStartedStore = matchStartedStore;

export const matchSummaryStore = atom<MatchSummary | undefined>(undefined);
(globalThis as any).matchSummaryStore = matchSummaryStore;

export const matStore = map<Record<Mats, CardId[]>>({} as Record<Mats, CardId[]>);
(globalThis as any).matStore = matStore;
