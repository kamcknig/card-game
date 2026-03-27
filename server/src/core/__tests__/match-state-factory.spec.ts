import { assertEquals, assertNotStrictEquals } from '@std/assert';
import type { ComputedMatchConfiguration, Match } from 'shared/types/index.ts';
import { createInitialMatchState } from '../match-state-factory.ts';

// Creates the canonical empty match state used for exact deep-equality assertions.
const createExpectedInitialMatchState = (): Match => {
  return {
    cardOverrides: {},
    cardSources: {},
    cardSourceTagMap: {},
    setAsideSourceById: {},
    coffers: {},
    villagers: {},
    debt: {},
    skippedTurns: {},
    config: {} as ComputedMatchConfiguration,
    currentPlayerTurnIndex: 0,
    events: [],
    landmarks: [],
    projects: [],
    ways: [],
    traits: [],
    allies: [],
    prophecies: [],
    boons: {
      cards: [],
      deck: [],
      discard: [],
      setAside: [],
    },
    extraTurnQueue: [],
    fleetRound: {
      active: false,
      completed: false,
      eligiblePlayerIdsInOrder: [],
      nextFleetPlayerIndex: 0,
    },
    hexes: {
      cards: [],
      deck: [],
      discard: [],
    },
    states: {
      cards: [],
      byPlayer: {},
    },
    artifacts: {
      cards: [],
      byPlayer: {},
    },
    mats: {},
    playerActions: 0,
    playerBuys: 0,
    players: [],
    playerPotions: 0,
    playerTreasure: 0,
    roundNumber: 0,
    scores: {},
    selectableCards: {},
    stats: {
      turns: [],
      playedCardsByTurn: {},
      cardsGainedByTurn: {},
      playedCards: {},
      cardsGained: {},
      trashedCards: {},
      trashedCardsByTurn: {},
      cardsBought: {},
      cardsBoughtByTurn: {},
      cardLikesBought: {},
      cardLikesBoughtByTurn: {},
    },
    tokens: {},
    tokenInstanceCounter: 0,
    turnNumber: 0,
    turnPhaseIndex: 0,
  };
};

Deno.test('createInitialMatchState initializes core deterministic defaults', () => {
  const match = createInitialMatchState();

  // Exact deep-equality ensures any extra/missing property fails this test.
  assertEquals(match, createExpectedInitialMatchState());
});

Deno.test('createInitialMatchState returns independent objects for each call', () => {
  const matchA = createInitialMatchState();
  const matchB = createInitialMatchState();

  assertNotStrictEquals(matchA, matchB);
  assertNotStrictEquals(matchA.stats, matchB.stats);
  assertNotStrictEquals(matchA.fleetRound, matchB.fleetRound);

  matchA.fleetRound.active = true;
  matchA.stats.turns.push({ playerId: 1, turnNumber: 1 });

  assertEquals(matchB.fleetRound.active, false);
  assertEquals(matchB.stats.turns.length, 0);
});
