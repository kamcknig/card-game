import { assertEquals } from '@std/assert';
import type { Card, Match } from 'shared/types/index.ts';
import { createTestCard } from '../../testing/create-test-card.ts';
import { getTopSupplyCards } from '../get-top-supply-cards.ts';

// Builds a minimal Card instance for top-supply return assertions.
const createRuntimeCard = (args: { id: number; cardKey: string }): Card => {
  return {
    id: args.id,
    cardKey: args.cardKey,
  } as Card;
};

Deno.test('getTopSupplyCards returns top cards in configured pile order', () => {
  const calls: string[] = [];
  const topByPile: Record<string, Card | undefined> = {
    copper: createRuntimeCard({ id: 1, cardKey: 'copper' }),
    silver: undefined,
    village: createRuntimeCard({ id: 2, cardKey: 'village' }),
  };

  const match = {
    config: {
      basicSupply: [
        { name: 'copper', cards: [createTestCard({ cardKey: 'copper' })] },
        { name: 'silver', cards: [createTestCard({ cardKey: 'silver' })] },
      ],
      kingdomSupply: [{ name: 'village', cards: [createTestCard({ cardKey: 'village' })] }],
    },
  } as Match;

  const result = getTopSupplyCards({
    match,
    findCardService: {
      findTopSupplyCardForPileKey: ({ pileKey }) => {
        calls.push(pileKey);
        return topByPile[pileKey];
      },
    },
  });

  assertEquals(calls, ['copper', 'silver', 'village']);
  assertEquals(result.map(card => card.cardKey), ['copper', 'village']);
});
