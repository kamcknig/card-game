import { assertEquals, assertNotStrictEquals, assertStrictEquals } from '@std/assert';
import { createTestCard } from '../../testing/create-test-card.ts';
import { getPileDefinitionCard } from '../get-pile-definition-card.ts';

Deno.test('getPileDefinitionCard selects matching randomizer pile and applies randomizer overrides', () => {
  const baseCard = createTestCard({ cardKey: 'split-top', cost: { treasure: 4 }, type: ['ACTION'] });
  const pileCard = createTestCard({
    cardKey: 'split-bottom',
    cost: { treasure: 3 },
    type: ['TREASURE'],
    randomizerData: {
      randomizer: 'split-pile',
      cost: { treasure: 6 },
      type: ['ACTION', 'VICTORY'],
    },
  });

  const result = getPileDefinitionCard([baseCard, pileCard], 'split-pile');

  assertNotStrictEquals(result, pileCard);
  assertEquals(result?.cost, { treasure: 6 });
  assertEquals(result?.type, ['ACTION', 'VICTORY']);
});

Deno.test('getPileDefinitionCard falls back to first card when no randomizer match exists', () => {
  const firstCard = createTestCard({ cardKey: 'first-card' });
  const secondCard = createTestCard({ cardKey: 'second-card' });

  const result = getPileDefinitionCard([firstCard, secondCard], 'missing-pile');

  assertStrictEquals(result, firstCard);
});

Deno.test('getPileDefinitionCard returns undefined when pile has no cards', () => {
  const result = getPileDefinitionCard([], 'any-pile');

  assertEquals(result, undefined);
});
