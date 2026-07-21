import { assertEquals } from '@std/assert';
import { buildGainedLocationExpectedFrom, isCardStillAtGainedLocation } from '../is-card-still-at-gained-location.ts';

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
      findCardSource: () => ({ sourceKey: 'playerHand', playerId: 2, source: [5], index: 0 }),
    },
    5,
    { location: 'playerHand', playerId: 2 },
  );

  assertEquals(result, true);
});

Deno.test('isCardStillAtGainedLocation returns false when source no longer matches', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerHand', playerId: 2, source: [5], index: 0 }),
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

Deno.test('isCardStillAtGainedLocation returns false when card is buried in playerDiscard', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerDiscard', playerId: 2, source: [5, 9], index: 0 }),
    },
    5,
    { location: 'playerDiscard', playerId: 2 },
  );

  assertEquals(result, false);
});

Deno.test('isCardStillAtGainedLocation returns true when card is on top of playerDiscard', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerDiscard', playerId: 2, source: [9, 5], index: 1 }),
    },
    5,
    { location: 'playerDiscard', playerId: 2 },
  );

  assertEquals(result, true);
});

Deno.test('isCardStillAtGainedLocation returns false when card is buried in playerDeck', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerDeck', playerId: 2, source: [5, 9], index: 0 }),
    },
    5,
    { location: 'playerDeck', playerId: 2 },
  );

  assertEquals(result, false);
});

Deno.test('isCardStillAtGainedLocation returns true when card is buried in a non-covering zone (exile)', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'exile', playerId: 2, source: [5, 9], index: 0 }),
    },
    5,
    { location: 'exile', playerId: 2 },
  );

  assertEquals(result, true);
});

Deno.test('isCardStillAtGainedLocation returns true when card is buried in a non-covering zone (playerHand)', () => {
  const result = isCardStillAtGainedLocation(
    {
      findCardSource: () => ({ sourceKey: 'playerHand', playerId: 2, source: [5, 9], index: 0 }),
    },
    5,
    { location: 'playerHand', playerId: 2 },
  );

  assertEquals(result, true);
});

Deno.test('buildGainedLocationExpectedFrom returns undefined when no gained location is provided', () => {
  const result = buildGainedLocationExpectedFrom(undefined);
  assertEquals(result, undefined);
});

Deno.test('buildGainedLocationExpectedFrom includes requireTop for playerDiscard', () => {
  const result = buildGainedLocationExpectedFrom({ location: 'playerDiscard', playerId: 2 });
  assertEquals(result, { location: 'playerDiscard', playerId: 2, requireTop: true });
});

Deno.test('buildGainedLocationExpectedFrom includes requireTop for playerDeck', () => {
  const result = buildGainedLocationExpectedFrom({ location: 'playerDeck', playerId: 2 });
  assertEquals(result, { location: 'playerDeck', playerId: 2, requireTop: true });
});

Deno.test('buildGainedLocationExpectedFrom omits requireTop for non-covering zones', () => {
  const result = buildGainedLocationExpectedFrom({ location: 'playerHand', playerId: 2 });
  assertEquals(result, { location: 'playerHand', playerId: 2 });
});
