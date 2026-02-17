import {
  ArtifactNoId,
  BoonNoId,
  CardKey,
  CardNoId,
  EventNoId,
  HexNoId,
  LandmarkNoId,
  ProjectNoId,
  StateNoId,
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
    // Landmarks live alongside events as landscape card-likes.
    landmarks: {},
    // Boons live alongside other non-supply card-likes.
    boons: {},
    // Hexes live alongside boons as non-supply card-likes.
    hexes: {},
    // States live alongside other non-supply card-likes.
    states: {},
    // Artifacts live alongside other non-supply card-likes.
    artifacts: {},
    // Projects live alongside other non-supply card-likes.
    projects: {},
  };
};
