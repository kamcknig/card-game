import { ComputedMatchConfiguration, Match } from 'shared/types/index.ts';

// Builds a fresh in-memory match state used for a new match lifecycle.
export function createInitialMatchState(): Match {
  return {
    cardOverrides: {},
    cardSources: {},
    cardSourceTagMap: {},
    coffers: {},
    // Per-player Villagers tokens for Renaissance.
    villagers: {},
    // Per-player debt tokens for Empires-style costs.
    debt: {},
    config: {} as ComputedMatchConfiguration,
    currentPlayerTurnIndex: 0,
    events: [],
    // Active landmark landscapes in the match.
    landmarks: [],
    // Active project landscapes in the match.
    projects: [],
    // Active way landscapes in the match.
    ways: [],
    // Boon deck state for Fate cards.
    boons: {
      cards: [],
      deck: [],
      discard: [],
      setAside: [],
    },
    extraTurnQueue: [],
    // Fleet round scheduler state for endgame extra-round handling.
    fleetRound: {
      active: false,
      completed: false,
      eligiblePlayerIdsInOrder: [],
      nextFleetPlayerIndex: 0,
    },
    // Hex deck state for Doom cards.
    hexes: {
      cards: [],
      deck: [],
      discard: [],
    },
    // State instances and ownership tracking.
    states: {
      cards: [],
      byPlayer: {},
    },
    // Artifact instances and ownership tracking.
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
    // Token instances placed in the match.
    tokens: {},
    // Monotonic counter for deterministic token instance IDs.
    tokenInstanceCounter: 0,
    turnNumber: 0,
    turnPhaseIndex: 0,
  };
}
