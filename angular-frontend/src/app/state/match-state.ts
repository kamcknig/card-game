import { atom } from 'nanostores';
import { Match, MatchConfiguration, MatchSummary, PlayerId } from 'shared/shared-types';

export const matchStore = atom<Match | null>(null);
(globalThis as any).matchStore = matchStore;

export const matchConfigurationStore = atom<MatchConfiguration | null>(null);
(globalThis as any).matchConfigurationStore = matchConfigurationStore;

export const matchStartedStore = atom<boolean>(false);
(globalThis as any).matchStartedStore = matchStartedStore;

export const matchSummaryStore = atom<MatchSummary | undefined>(undefined);
(globalThis as any).matchSummaryStore = matchSummaryStore;
