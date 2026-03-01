import { assertEquals } from '@std/assert';
import type { EffectTarget, Match } from 'shared/types/index.ts';
import { createInitialMatchState } from '../../core/match-state-factory.ts';
import { createTestPlayer } from '../../testing/create-test-player.ts';
import { findOrderedTargets } from '../find-ordered-targets.ts';

// Builds a match with a deterministic player order for target-resolution tests.
const createMatchWithPlayers = (): Match => {
  const match = createInitialMatchState();
  match.players = [
    createTestPlayer({ id: 1, name: 'One' }),
    createTestPlayer({ id: 2, name: 'Two' }),
    createTestPlayer({ id: 3, name: 'Three' }),
  ];
  return match;
};

Deno.test('findOrderedTargets resolves ALL starting from current player id', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 2,
    appliesTo: 'ALL',
  });

  assertEquals(result, [2, 3, 1]);
});

Deno.test('findOrderedTargets resolves ALL_OTHER excluding current player id', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 2,
    appliesTo: 'ALL_OTHER',
  });

  assertEquals(result, [3, 1]);
});

Deno.test('findOrderedTargets returns fallback ANY behavior currently implemented', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 2,
    appliesTo: 'ANY',
  });

  assertEquals(result, [1]);
});

Deno.test('findOrderedTargets returns empty list for unsupported target expressions', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 2,
    appliesTo: 'NOT_A_TARGET' as EffectTarget,
  });

  assertEquals(result, []);
});

Deno.test('findOrderedTargets resolves ALL_OTHER starting from first player excludes only that player', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 1,
    appliesTo: 'ALL_OTHER',
  });

  assertEquals(result, [2, 3]);
});

Deno.test('findOrderedTargets resolves ALL_OTHER with startingPlayerId not in the player list', () => {
  const match = createMatchWithPlayers();

  // When the player is not found, findIndex returns -1; the rotation still
  // produces a deterministic ordering starting from the end of the array.
  const result = findOrderedTargets({
    match,
    startingPlayerId: 999,
    appliesTo: 'ALL_OTHER',
  });

  assertEquals(result.length, 2);
});

Deno.test('findOrderedTargets resolves ALL with a single player', () => {
  const match = createInitialMatchState();
  match.players = [createTestPlayer({ id: 1, name: 'Solo' })];

  const result = findOrderedTargets({
    match,
    startingPlayerId: 1,
    appliesTo: 'ALL',
  });

  assertEquals(result, [1]);
});

Deno.test('findOrderedTargets resolves ALL_OTHER with a single player returns empty', () => {
  const match = createInitialMatchState();
  match.players = [createTestPlayer({ id: 1, name: 'Solo' })];

  const result = findOrderedTargets({
    match,
    startingPlayerId: 1,
    appliesTo: 'ALL_OTHER',
  });

  assertEquals(result, []);
});

Deno.test('findOrderedTargets resolves X_OTHER pattern and returns empty (not implemented)', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 2,
    appliesTo: '2_OTHER' as EffectTarget,
  });

  assertEquals(result, []);
});

Deno.test('findOrderedTargets resolves ALL with startingPlayerId as the first player', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 1,
    appliesTo: 'ALL',
  });

  assertEquals(result, [1, 2, 3]);
});

Deno.test('findOrderedTargets resolves ALL with startingPlayerId as the last player', () => {
  const match = createMatchWithPlayers();

  const result = findOrderedTargets({
    match,
    startingPlayerId: 3,
    appliesTo: 'ALL',
  });

  assertEquals(result, [3, 1, 2]);
});
