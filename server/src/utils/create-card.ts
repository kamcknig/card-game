import {
  Artifact,
  ArtifactNoId,
  Boon,
  BoonNoId,
  Card,
  CardKey,
  CardNoId,
  Event,
  EventNoId,
  Hex,
  HexNoId,
  Landmark,
  LandmarkNoId,
  Project,
  ProjectNoId,
  State,
  StateNoId,
} from 'shared/types/index.ts';
import { rawCardLibrary } from '@expansions/expansion-library.ts';
import { formatCardName } from './format-card-name.ts';

let CARD_COUNT: number = 0;

export const createCard = (cardKey: CardKey, card?: Partial<CardNoId>): Card => {
  const baseCardData = rawCardLibrary[cardKey] ?? {};
  const c = new Card({
    ...baseCardData,
    cardKey: cardKey,
    // Default card names follow the standard format rules unless overridden by card data.
    cardName: baseCardData.cardName ?? formatCardName(cardKey),
    ...card ?? {},
    id: ++CARD_COUNT,
  });
  return c;
};

export const createEvent = (event: EventNoId): Event => {
  return new Event({
    ...event,
    id: ++CARD_COUNT,
  });
};

// Boons are card-like objects that live outside the supply and are drawn from a shared deck.
export const createBoon = (boon: BoonNoId): Boon => {
  return new Boon({
    ...boon,
    id: ++CARD_COUNT,
  });
};

// Hexes are card-like objects that live outside the supply and are drawn from a shared deck.
export const createHex = (hex: HexNoId): Hex => {
  return new Hex({
    ...hex,
    id: ++CARD_COUNT,
  });
};

// Landmarks are card-like objects that live alongside events in the match.
export const createLandmark = (landmark: LandmarkNoId): Landmark => {
  return new Landmark({
    ...landmark,
    id: ++CARD_COUNT,
  });
};

// Projects are card-like objects that grant permanent abilities.
export const createProject = (project: ProjectNoId): Project => {
  return new Project({
    ...project,
    id: ++CARD_COUNT,
  });
};

// States are card-like objects that track persistent player effects.
export const createState = (state: StateNoId): State => {
  return new State({
    ...state,
    id: ++CARD_COUNT,
  });
};

// Artifacts are card-like objects that track persistent player effects.
export const createArtifact = (artifact: ArtifactNoId): Artifact => {
  return new Artifact({
    ...artifact,
    id: ++CARD_COUNT,
  });
};
