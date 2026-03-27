import { assertEquals } from '@std/assert';
import { getTurnPhase } from '../get-turn-phase.ts';

Deno.test('getTurnPhase resolves known phase indices', () => {
  assertEquals(getTurnPhase(0), 'action');
  assertEquals(getTurnPhase(1), 'buy');
  assertEquals(getTurnPhase(2), 'night');
  assertEquals(getTurnPhase(3), 'cleanup');
});

Deno.test('getTurnPhase returns undefined for out-of-range indices', () => {
  assertEquals(getTurnPhase(4), undefined);
  assertEquals(getTurnPhase(-1), undefined);
});
