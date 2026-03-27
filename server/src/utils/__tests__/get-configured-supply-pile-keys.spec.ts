import { assertEquals } from '@std/assert';
import type { Match } from 'shared/types/index.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { getConfiguredSupplyPileKeys } from '../get-configured-supply-pile-keys.ts';

// Builds a minimal match object for configured-supply selector tests.
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

Deno.test('getConfiguredSupplyPileKeys returns unique pile keys in deterministic config order', () => {
  const match = createMatch({
    basicNames: ['copper', 'silver', 'copper'],
    kingdomNames: ['village', 'silver', 'market'],
  });

  const result = getConfiguredSupplyPileKeys(match);

  assertEquals(result, ['copper', 'silver', 'village', 'market']);
});

Deno.test('getConfiguredSupplyPileKeys returns an empty list when no supply is configured', () => {
  const match = createMatch({ basicNames: [], kingdomNames: [] });

  const result = getConfiguredSupplyPileKeys(match);

  assertEquals(result, []);
});

Deno.test('getConfiguredSupplyPileKeys handles undefined basicSupply', () => {
  const match = { config: { kingdomSupply: [{ name: 'village', cards: [] }] } } as unknown as Match;

  const result = getConfiguredSupplyPileKeys(match);

  assertEquals(result, ['village']);
});

Deno.test('getConfiguredSupplyPileKeys handles undefined kingdomSupply', () => {
  const match = { config: { basicSupply: [{ name: 'copper', cards: [] }] } } as unknown as Match;

  const result = getConfiguredSupplyPileKeys(match);

  assertEquals(result, ['copper']);
});

Deno.test('getConfiguredSupplyPileKeys preserves basic-before-kingdom ordering', () => {
  const match = createMatch({
    basicNames: ['copper', 'silver', 'gold'],
    kingdomNames: ['village', 'market'],
  });

  const result = getConfiguredSupplyPileKeys(match);

  assertEquals(result, ['copper', 'silver', 'gold', 'village', 'market']);
});
