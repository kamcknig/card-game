import { atom, computed } from 'nanostores';
import { Match, MatchConfiguration } from 'shared/shared-types';
import { matchStore } from './match';
import { clientSelectableCardsOverrideStore } from './interactive-state';

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

export const matchConfigurationStore =
  computed<MatchConfiguration | null, typeof matchStore>(matchStore, m => m?.config ?? null);
(globalThis as any).matchConfigurationStore = matchConfigurationStore;

export const lobbyMatchConfigurationStore = atom<string[]>([]);
(globalThis as any).matchStartedStore = lobbyMatchConfigurationStore;

export const matchStartedStore = atom<boolean>(false);
(globalThis as any).matchStartedStore = matchStartedStore;
