import { atom } from 'nanostores';
import { Match, MatchConfiguration, MatchSummary, PlayerId } from 'shared/shared-types';

export const matchStore = atom<Match | null>(null);
export const matchConfigurationStore = atom<MatchConfiguration | null>(null);
export const matchStartedStore = atom<boolean>(false);
export const matchSummaryStore = atom<MatchSummary | undefined>(undefined);


(globalThis as any).matchStore = matchStore;
(globalThis as any).matchConfigurationStore = matchConfigurationStore;
(globalThis as any).matchStartedStore = matchStartedStore;
(globalThis as any).matchSummaryStore = matchSummaryStore;
