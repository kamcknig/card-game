import { assertEquals } from '@std/assert';
import type { CardLike } from 'shared/types/index.ts';
import { getCardPileKey } from '../get-card-pile-key.ts';

Deno.test('getCardPileKey returns randomizer key when present', () => {
  const result = getCardPileKey({
    cardKey: 'ruined-market',
    randomizerData: { randomizer: 'ruins' },
  } as Pick<CardLike, 'cardKey' | 'randomizerData'>);

  assertEquals(result, 'ruins');
});

Deno.test('getCardPileKey falls back to card key when no randomizer exists', () => {
  const result = getCardPileKey({
    cardKey: 'village',
    randomizerData: undefined,
  } as Pick<CardLike, 'cardKey' | 'randomizerData'>);

  assertEquals(result, 'village');
});
