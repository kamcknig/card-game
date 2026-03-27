import { Match } from 'shared/types/index.ts';
import { getConfiguredSupplyPileKeys } from './get-configured-supply-pile-keys.ts';

export const getStartingSupplyCount = (match: Match) => {
  return getConfiguredSupplyPileKeys(match).length;
};
