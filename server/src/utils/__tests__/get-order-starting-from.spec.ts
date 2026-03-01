import { assertEquals } from '@std/assert';
import { getOrderStartingFrom } from '../get-order-starting-from.ts';

Deno.test('getOrderStartingFrom rotates list order from the requested starting index', () => {
  const result = getOrderStartingFrom([1, 2, 3, 4], 2);

  assertEquals(result, [3, 4, 1, 2]);
});

Deno.test('getOrderStartingFrom supports start indices larger than array length', () => {
  const result = getOrderStartingFrom(['a', 'b', 'c'], 5);

  assertEquals(result, ['c', 'a', 'b']);
});

Deno.test('getOrderStartingFrom returns an empty list when provided an empty list', () => {
  const result = getOrderStartingFrom([], 3);

  assertEquals(result, []);
});
