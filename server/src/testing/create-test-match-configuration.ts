import { MatchConfiguration } from 'shared/types/index.ts';
import { createTestPlayer } from './create-test-player.ts';

// Builds a complete MatchConfiguration fixture that tests can override by field.
export const createTestMatchConfiguration = (overrides: Partial<MatchConfiguration> = {}): MatchConfiguration => {
  return {
    players: [createTestPlayer({ id: 1 }), createTestPlayer({ id: 2 })],
    expansions: [],
    bannedKingdoms: [],
    preselectedKingdoms: [],
    basicSupply: [],
    kingdomSupply: [],
    playerStartingHand: {},
    events: [],
    landmarks: [],
    projects: [],
    ways: [],
    traits: [],
    allies: [],
    prophecies: [],
    boons: [],
    hexes: [],
    states: [],
    artifacts: [],
    ...overrides,
  };
};
