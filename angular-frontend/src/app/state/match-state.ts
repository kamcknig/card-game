import { atom, computed } from 'nanostores';
import { Match, MatchConfiguration } from 'shared/shared-types';
import { matchStore } from './match';

export const supplyStore =
  computed(matchStore, m => m?.supply ?? []);

export const kingdomStore =
  computed(matchStore, m => m?.kingdom ?? []);

export const trashStore =
  computed(matchStore, m => m?.trash ?? []);

export const playAreaStore =
  computed(matchStore, m => m?.playArea ?? []);

export const matchConfigurationStore =
  computed<MatchConfiguration['expansions'], typeof matchStore>(matchStore, m => m?.config?.expansions ?? []);

export const matchStartedStore = atom<boolean>(false);
