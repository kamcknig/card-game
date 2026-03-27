import { assertEquals } from '@std/assert';
import type { CardLocation } from 'shared/types/index.ts';
import { resolvePileDestinationForCardKey } from '../resolve-pile-destination-for-card-key.ts';

Deno.test('resolvePileDestinationForCardKey checks locations in priority order', () => {
  const calls: CardLocation[] = [];

  const result = resolvePileDestinationForCardKey({
    cardKey: 'village',
    findCardService: {
      findCards: filter => {
        const location = (filter as { all: Array<{ location: CardLocation }> }).all[0].location;
        calls.push(location);
        if (location === 'basicSupply') {
          return [{}] as never[];
        }
        return [];
      },
    },
  });

  assertEquals(result, 'basicSupply');
  assertEquals(calls, ['kingdomSupply', 'basicSupply']);
});

Deno.test('resolvePileDestinationForCardKey returns null when card key is not found', () => {
  const result = resolvePileDestinationForCardKey({
    cardKey: 'missing-card',
    findCardService: {
      findCards: () => [],
    },
  });

  assertEquals(result, null);
});
