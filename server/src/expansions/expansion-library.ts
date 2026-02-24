import {
  AllyNoId,
  ArtifactNoId,
  BoonNoId,
  CardKey,
  CardNoId,
  EventNoId,
  HexNoId,
  LandmarkNoId,
  ProphecyNoId,
  ProjectNoId,
  TraitNoId,
  StateNoId,
  WayNoId,
} from 'shared/types/index.ts';

export type ExpansionCardData = {
  basicSupply: Record<CardKey, CardNoId>;
  kingdomSupply: Record<CardKey, CardNoId>;
};

export type ExpansionData = {
  title: string;
  name: string;
  cardData: ExpansionCardData;
  events: Record<CardKey, EventNoId>;
  // Allies are stored separately from events.
  allies: Record<CardKey, AllyNoId>;
  // Landmarks are stored separately from events.
  landmarks: Record<CardKey, LandmarkNoId>;
  // Boons are stored separately from supply cards.
  boons: Record<CardKey, BoonNoId>;
  // Hexes are stored separately from supply cards.
  hexes: Record<CardKey, HexNoId>;
  // States are stored separately from supply cards.
  states: Record<CardKey, StateNoId>;
  // Artifacts are stored separately from supply cards.
  artifacts: Record<CardKey, ArtifactNoId>;
  // Projects are stored separately from supply cards.
  projects: Record<CardKey, ProjectNoId>;
  // Ways are stored separately from supply cards.
  ways: Record<CardKey, WayNoId>;
  // Traits are stored separately from supply cards.
  traits: Record<CardKey, TraitNoId>;
  // Prophecies are stored separately from other landscapes.
  prophecies: Record<CardKey, ProphecyNoId>;
  mutuallyExclusive?: string[];
};

export type ExpansionDataLibrary = Record<string, ExpansionData>;

// Creates empty expansion data storage for one expansion.
export const createEmptyExpansionData = (expansionName: string): ExpansionData => {
  return {
    title: expansionName,
    name: expansionName,
    cardData: {
      basicSupply: {},
      kingdomSupply: {},
    },
    events: {},
    // Allies live alongside events as setup-only landscapes.
    allies: {},
    // Landmarks live alongside events as landscapes.
    landmarks: {},
    // Boons live alongside other non-supply landscapes.
    boons: {},
    // Hexes live alongside boons as non-supply landscapes.
    hexes: {},
    // States live alongside other non-supply landscapes.
    states: {},
    // Artifacts live alongside other non-supply landscapes.
    artifacts: {},
    // Projects live alongside other non-supply landscapes.
    projects: {},
    // Ways live alongside other non-supply landscapes.
    ways: {},
    // Traits live alongside other non-supply landscapes.
    traits: {},
    // Prophecies live alongside other non-supply landscapes.
    prophecies: {},
  };
};
