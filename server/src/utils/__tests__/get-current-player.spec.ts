import { assertEquals, assertStrictEquals } from '@std/assert';
import { createInitialMatchState } from '../../core/match-state-factory.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { getCurrentPlayer } from '../get-current-player.ts';

Deno.test('getCurrentPlayer returns player at currentPlayerTurnIndex', () => {
  const playerOne = createTestPlayer({ id: 1, name: 'One' });
  const playerTwo = createTestPlayer({ id: 2, name: 'Two' });
  const match = createInitialMatchState();
  match.players = [playerOne, playerTwo];
  match.currentPlayerTurnIndex = 1;

  const result = getCurrentPlayer(match);

  assertStrictEquals(result, playerTwo);
  assertEquals(result?.name, 'Two');
});
