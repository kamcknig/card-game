import { assertEquals } from '@std/assert';
import { getCurrentTurnHistoryIndex } from '../get-current-turn-history-index.ts';

Deno.test('getCurrentTurnHistoryIndex returns zero by default when there is no turn history', () => {
  const result = getCurrentTurnHistoryIndex({ match: { stats: { turns: [] } } });

  assertEquals(result, 0);
});

Deno.test('getCurrentTurnHistoryIndex returns undefined when fallback is explicitly disabled', () => {
  const result = getCurrentTurnHistoryIndex(
    { match: { stats: { turns: [] } } },
    { fallbackToZero: false },
  );

  assertEquals(result, undefined);
});

Deno.test('getCurrentTurnHistoryIndex returns the last turn-history index', () => {
  const result = getCurrentTurnHistoryIndex({ match: { stats: { turns: [{}, {}, {}] } } });

  assertEquals(result, 2);
});
