import { assertEquals } from '@std/assert';
import { isLocationInPlay } from '../is-in-play.ts';

Deno.test('isLocationInPlay returns true for in-play locations', () => {
  assertEquals(isLocationInPlay('playArea'), true);
  assertEquals(isLocationInPlay('activeDuration'), true);
});

Deno.test('isLocationInPlay returns false for non-play locations', () => {
  assertEquals(isLocationInPlay('playerHand'), false);
  assertEquals(isLocationInPlay(undefined), false);
});
