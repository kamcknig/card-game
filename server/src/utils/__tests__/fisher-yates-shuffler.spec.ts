import { assertEquals, assertNotStrictEquals, assertStrictEquals } from '@std/assert';
import { fisherYatesShuffle } from '../fisher-yates-shuffler.ts';

Deno.test('fisherYatesShuffle returns a new array when inPlace is false', () => {
  const input = [1, 2, 3, 4];
  const output = fisherYatesShuffle(input, false, () => 0);

  assertNotStrictEquals(output, input);
  assertEquals(output, [2, 3, 4, 1]);
  assertEquals(input, [1, 2, 3, 4]);
});

Deno.test('fisherYatesShuffle mutates the input array when inPlace is true', () => {
  const input = [1, 2, 3, 4];
  const output = fisherYatesShuffle(input, true, () => 0);

  assertStrictEquals(output, input);
  assertEquals(output, [2, 3, 4, 1]);
});
