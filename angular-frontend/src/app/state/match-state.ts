import { atom } from 'nanostores';
import { Match, MatchStats, MatchSummary, PlayerId } from 'shared/shared-types';

export const matchStore = atom<Match | null>(null);
(globalThis as any).matchStore = matchStore;

export const lobbyMatchConfigurationStore = atom<string[]>([]);
(globalThis as any).matchStartedStore = lobbyMatchConfigurationStore;

export const matchStartedStore = atom<boolean>(false);
(globalThis as any).matchStartedStore = matchStartedStore;

export const matchSummaryStore = atom<MatchSummary | undefined>(undefined);
(globalThis as any).matchSummaryStore = matchSummaryStore;

export const selfPlayerIdStore = atom<PlayerId | undefined>();
(globalThis as any).selfPlayerIdStore = selfPlayerIdStore;

export const matchStatsStore = atom<MatchStats | undefined>();
(globalThis as any).matchStatsStore = matchStatsStore;

