import { assertEquals } from '@std/assert';
import type { CardId, CardLocation, PlayerId } from 'shared/types/index.ts';
import { getPlayerSourceSafe } from '../get-player-source-safe.ts';

Deno.test('getPlayerSourceSafe returns source cards when cardSourceController succeeds', () => {
  const response = [1, 2, 3] as CardId[];

  const result = getPlayerSourceSafe(
    {
      cardSourceController: {
        getSource: (_source: CardLocation, _playerId?: PlayerId): CardId[] => response,
      },
    },
    'playerHand',
    1,
  );

  assertEquals(result, response);
});

Deno.test('getPlayerSourceSafe returns an empty list when cardSourceController throws', () => {
  const result = getPlayerSourceSafe(
    {
      cardSourceController: {
        getSource: (_source: CardLocation, _playerId?: PlayerId): CardId[] => {
          throw new Error('source missing');
        },
      },
    },
    'playerHand',
    1,
  );

  assertEquals(result, []);
});
