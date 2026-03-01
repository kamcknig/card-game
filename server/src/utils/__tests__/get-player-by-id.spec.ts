import { assertEquals, assertStrictEquals } from '@std/assert';
import { createInitialMatchState } from '../../core/match-state-factory.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { getPlayerById } from '../get-player-by-id.ts';

Deno.test('getPlayerById returns the matching player instance', () => {
  const playerOne = createTestPlayer({ id: 1 });
  const playerTwo = createTestPlayer({ id: 2 });
  const match = createInitialMatchState();
  match.players = [playerOne, playerTwo];

  const result = getPlayerById(match, 2);

  assertStrictEquals(result, playerTwo);
});

Deno.test('getPlayerById returns undefined when player does not exist', () => {
  const match = createInitialMatchState();
  match.players = [createTestPlayer({ id: 1 })];

  const result = getPlayerById(match, 99);

  assertEquals(result, undefined);
});
