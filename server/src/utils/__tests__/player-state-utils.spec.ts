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
