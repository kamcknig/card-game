import { assertEquals, assertStrictEquals } from '@std/assert';
import type { Match, State } from 'shared/types/index.ts';
import { createInitialMatchState } from '../../core/match-state-factory.ts';
import {
  getPlayerStateByKey,
  getPlayerStateIds,
  getPlayerStates,
  playerHasState,
} from '../player-state-utils.ts';

// Builds a minimal runtime state object with the fields used by player-state utility selectors.
const createRuntimeState = (args: { id: number; cardKey: string }): State => {
  return {
    id: args.id,
    cardKey: args.cardKey,
  } as State;
};

Deno.test('player-state utils resolve owned ids and state records for a player', () => {
  const haunting = createRuntimeState({ id: 1001, cardKey: 'haunted' });
  const blessed = createRuntimeState({ id: 1002, cardKey: 'blessed' });
  const match = createInitialMatchState();
  match.states = {
    cards: [haunting, blessed],
    byPlayer: {
      1: [1001],
      2: [1002],
    },
  };

  const stateIds = getPlayerStateIds(match, 1);
  const states = getPlayerStates(match, 1);
  const hasState = playerHasState(match, 1, 'haunted');
  const stateByKey = getPlayerStateByKey(match, 1, 'haunted');

  assertEquals(stateIds, [1001]);
  assertEquals(states.length, 1);
  assertStrictEquals(states[0], haunting);
  assertEquals(hasState, true);
  assertStrictEquals(stateByKey, haunting);
});

Deno.test('player-state utils return empty/false/undefined for missing ownership', () => {
  const match = {
    ...createInitialMatchState(),
    states: {
      cards: [],
      byPlayer: {},
    },
  } as Match;

  assertEquals(getPlayerStateIds(match, 1), []);
  assertEquals(getPlayerStates(match, 1), []);
  assertEquals(playerHasState(match, 1, 'haunted'), false);
  assertEquals(getPlayerStateByKey(match, 1, 'haunted'), undefined);
});

Deno.test('player-state utils handle undefined match.states gracefully', () => {
  const match = createInitialMatchState();
  // match.states is undefined by default from initial state factory.

  assertEquals(getPlayerStateIds(match, 1), []);
  assertEquals(getPlayerStates(match, 1), []);
  assertEquals(playerHasState(match, 1, 'haunted'), false);
  assertEquals(getPlayerStateByKey(match, 1, 'haunted'), undefined);
});

Deno.test('getPlayerStates filters cards to only those owned by the player', () => {
  const haunted = createRuntimeState({ id: 1001, cardKey: 'haunted' });
  const blessed = createRuntimeState({ id: 1002, cardKey: 'blessed' });
  const cursed = createRuntimeState({ id: 1003, cardKey: 'cursed' });
  const match = createInitialMatchState();
  match.states = {
    cards: [haunted, blessed, cursed],
    byPlayer: {
      1: [1001, 1003],
      2: [1002],
    },
  };

  const states = getPlayerStates(match, 1);

  assertEquals(states.length, 2);
  assertStrictEquals(states[0], haunted);
  assertStrictEquals(states[1], cursed);
});

Deno.test('getPlayerStateByKey returns undefined when player has states but not the requested key', () => {
  const haunted = createRuntimeState({ id: 1001, cardKey: 'haunted' });
  const match = createInitialMatchState();
  match.states = {
    cards: [haunted],
    byPlayer: { 1: [1001] },
  };

  assertEquals(getPlayerStateByKey(match, 1, 'blessed'), undefined);
});

Deno.test('playerHasState returns true only for matching card key', () => {
  const haunted = createRuntimeState({ id: 1001, cardKey: 'haunted' });
  const match = createInitialMatchState();
  match.states = {
    cards: [haunted],
    byPlayer: { 1: [1001] },
  };

  assertEquals(playerHasState(match, 1, 'haunted'), true);
  assertEquals(playerHasState(match, 1, 'blessed'), false);
});
