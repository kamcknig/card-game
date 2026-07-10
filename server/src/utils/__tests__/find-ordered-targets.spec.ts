import { assertEquals } from '@std/assert';
import type { EffectTarget, Match } from 'shared/types/index.ts';
import { createInitialMatchState } from '../../core/match-state-factory.ts';
import { createTestLogger } from '../../testing/create-test-logger.ts';
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

// --- Tests with loggerService to exercise optional chaining branches ---

Deno.test('findOrderedTargets ALL with loggerService logs target info', () => {
  const match = createMatchWithPlayers();
  const { entries, loggerService } = createTestLogger();

  findOrderedTargets({
    match,
    startingPlayerId: 1,
    appliesTo: 'ALL',
    loggerService,
  });

  assertEquals(entries.some(e => e.level === 'info'), true);
});

Deno.test('findOrderedTargets ALL_OTHER with loggerService logs target info', () => {
  const match = createMatchWithPlayers();
  const { entries, loggerService } = createTestLogger();

  findOrderedTargets({
    match,
    startingPlayerId: 2,
    appliesTo: 'ALL_OTHER',
    loggerService,
  });

  assertEquals(entries.some(e => e.level === 'info'), true);
});

Deno.test('findOrderedTargets logs error for unsupported target expressions', () => {
  const match = createMatchWithPlayers();
  const { entries, loggerService } = createTestLogger();

  findOrderedTargets({
    match,
    startingPlayerId: 1,
    appliesTo: 'NOT_A_TARGET' as EffectTarget,
    loggerService,
  });

  assertEquals(entries.some(e => e.level === 'error'), true);
});

Deno.test('findOrderedTargets resolves ALL_OTHER with startingPlayerId not in the player list preserves order from index 0', () => {
  const match = createMatchWithPlayers();

  // findIndex returns -1 for an unrecognized id; normalizeIndex must wrap
  // that into a valid starting index rather than indexing negatively.
  const result = findOrderedTargets({
    match,
    startingPlayerId: 999,
    appliesTo: 'ALL_OTHER',
  });

  assertEquals(result, [1, 2]);
});
