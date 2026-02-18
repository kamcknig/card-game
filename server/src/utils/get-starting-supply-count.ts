import { Match } from 'shared/types/index.ts';

export const getStartingSupplyCount = (match: Match) => {
  const allSupplyCardKeys = match.config.basicSupply.concat(
    match.config.kingdomSupply,
  );
  return allSupplyCardKeys.length;
};
