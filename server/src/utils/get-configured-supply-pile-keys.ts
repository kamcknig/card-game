import { CardKey, Match } from 'shared/types/index.ts';

// Returns unique configured Supply pile keys in deterministic config order.
export const getConfiguredSupplyPileKeys = (match: Match): CardKey[] => {
  const pileKeys: CardKey[] = [];
  const seen = new Set<CardKey>();
  const configuredSupply = [...(match.config.basicSupply ?? []), ...(match.config.kingdomSupply ?? [])];

  for (const supply of configuredSupply) {
    if (seen.has(supply.name)) {
      continue;
    }
    seen.add(supply.name);
    pileKeys.push(supply.name);
  }

  return pileKeys;
};
