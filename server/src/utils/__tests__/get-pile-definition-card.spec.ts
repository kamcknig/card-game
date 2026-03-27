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

Deno.test('getPileDefinitionCard returns card without overrides when randomizerData has no cost or type', () => {
  const card = createTestCard({
    cardKey: 'split-bottom',
    cost: { treasure: 3 },
    type: ['ACTION'],
    randomizerData: { randomizer: 'split-pile' },
  });

  const result = getPileDefinitionCard([card], 'split-pile');

  // Cost and type stay at original values since randomizerData has no overrides.
  assertEquals(result?.cost, { treasure: 3 });
  assertEquals(result?.type, ['ACTION']);
});

Deno.test('getPileDefinitionCard matches by cardKey when card has no randomizerData', () => {
  const card = createTestCard({ cardKey: 'village', cost: { treasure: 3 }, type: ['ACTION'] });

  const result = getPileDefinitionCard([card], 'village');

  assertStrictEquals(result, card);
});

Deno.test('getPileDefinitionCard applies only cost override when type is absent in randomizerData', () => {
  const card = createTestCard({
    cardKey: 'split-card',
    cost: { treasure: 2 },
    type: ['TREASURE'],
    randomizerData: { randomizer: 'pile', cost: { treasure: 5 } },
  });

  const result = getPileDefinitionCard([card], 'pile');

  assertEquals(result?.cost, { treasure: 5 });
  assertEquals(result?.type, ['TREASURE']);
});

Deno.test('getPileDefinitionCard applies only type override when cost is absent in randomizerData', () => {
  const card = createTestCard({
    cardKey: 'split-card',
    cost: { treasure: 2 },
    type: ['TREASURE'],
    randomizerData: { randomizer: 'pile', type: ['ACTION', 'VICTORY'] },
  });

  const result = getPileDefinitionCard([card], 'pile');

  assertEquals(result?.cost, { treasure: 2 });
  assertEquals(result?.type, ['ACTION', 'VICTORY']);
});
