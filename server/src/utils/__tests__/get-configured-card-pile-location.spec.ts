import { assertEquals } from '@std/assert';
import type { Card, Match } from 'shared/types/index.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { getConfiguredCardPileLocation } from '../get-configured-card-pile-location.ts';

// Builds a minimal Card with only fields required by pile-location resolution logic.
const createRuntimeCard = (args: { id: number; cardKey: string; kingdom?: string; randomizer?: string }): Card => {
  return {
    id: args.id,
    cardKey: args.cardKey,
    kingdom: args.kingdom ?? args.cardKey,
    randomizerData: args.randomizer ? { randomizer: args.randomizer } : undefined,
  } as Card;
};

Deno.test('getConfiguredCardPileLocation resolves basic supply by pile key', () => {
  const match = {
    config: {
      basicSupply: [{ name: 'copper', cards: [createTestCard({ cardKey: 'copper' })] }],
      kingdomSupply: [],
      nonSupply: [],
    },
  } as unknown as Match;

  const result = getConfiguredCardPileLocation(match, createRuntimeCard({ id: 1, cardKey: 'copper' }));

  assertEquals(result, { location: 'basicSupply', pileName: 'copper' });
});

Deno.test('getConfiguredCardPileLocation resolves kingdoms supply by randomizer pile key', () => {
  const match = {
    config: {
      basicSupply: [],
      kingdomSupply: [
        {
          name: 'castles',
          cards: [createTestCard({ cardKey: 'small-castle', randomizerData: { randomizer: 'castles' } })],
        },
      ],
      nonSupply: [],
    },
  } as unknown as Match;

  const card = createRuntimeCard({ id: 2, cardKey: 'opulent-castle', randomizer: 'castles' });
  const result = getConfiguredCardPileLocation(match, card);

  assertEquals(result, { location: 'kingdomSupply', pileName: 'castles' });
});

Deno.test('getConfiguredCardPileLocation resolves non-supply by kingdoms pile name', () => {
  const match = {
    config: {
      basicSupply: [],
      kingdomSupply: [],
      nonSupply: [{ name: 'prizes', cards: [createTestCard({ cardKey: 'followers', kingdom: 'prizes' })] }],
    },
  } as unknown as Match;

  const result = getConfiguredCardPileLocation(match, createRuntimeCard({ id: 3, cardKey: 'followers', kingdom: 'prizes' }));

  assertEquals(result, { location: 'nonSupplyCards', pileName: 'prizes' });
});

Deno.test('getConfiguredCardPileLocation returns undefined when no configured pile is found', () => {
  const match = {
    config: {
      basicSupply: [],
      kingdomSupply: [],
      nonSupply: [],
    },
  } as unknown as Match;

  const result = getConfiguredCardPileLocation(match, createRuntimeCard({ id: 4, cardKey: 'missing-card' }));

  assertEquals(result, undefined);
});
