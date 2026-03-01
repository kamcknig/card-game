import { assertEquals } from '@std/assert';
import type { Match } from 'shared/types/index.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { getStartingSupplyCount } from '../get-starting-supply-count.ts';

// Builds a minimal match object for supply-count selector tests.
const createMatch = (args: {
  basicNames: string[];
  kingdomNames: string[];
}): Match => {
  return {
    config: {
      basicSupply: args.basicNames.map(name => ({
        name,
        cards: [createTestCard({ cardKey: name })],
      })),
      kingdomSupply: args.kingdomNames.map(name => ({
        name,
        cards: [createTestCard({ cardKey: name })],
      })),
    },
  } as Match;
};

Deno.test('getStartingSupplyCount counts unique configured supply piles', () => {
  const match = createMatch({
    basicNames: ['copper', 'silver', 'copper'],
    kingdomNames: ['village', 'silver', 'market'],
  });

  const result = getStartingSupplyCount(match);

  assertEquals(result, 4);
});

Deno.test('getStartingSupplyCount returns zero when no supply piles are configured', () => {
  const match = createMatch({ basicNames: [], kingdomNames: [] });

  const result = getStartingSupplyCount(match);

  assertEquals(result, 0);
});
