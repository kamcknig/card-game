import { assertEquals } from '@std/assert';
import { isCardStillAtGainedLocation } from '../is-card-still-at-gained-location.ts';

Deno.test('isCardStillAtGainedLocation returns true when no gained location is provided', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => {
        throw new Error('unused');
      },
    },
    1,
  );

  assertEquals(result, true);
});

Deno.test('isCardStillAtGainedLocation returns true when source key and player still match', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerDiscard', playerId: 2 }),
    },
    5,
    { location: 'playerDiscard', playerId: 2 },
  );

  assertEquals(result, true);
});

Deno.test('isCardStillAtGainedLocation returns false when source no longer matches', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerHand', playerId: 2 }),
    },
    5,
    { location: 'playerDiscard', playerId: 2 },
  );

  assertEquals(result, false);
});

Deno.test('isCardStillAtGainedLocation returns false when source lookup throws', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => {
        throw new Error('missing card');
      },
    },
    5,
    { location: 'playerDiscard', playerId: 2 },
  );

  assertEquals(result, false);
});
