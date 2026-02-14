import type {
  Artifact,
  Boon,
  CardLikeId,
  Event as MatchEvent,
  Hex,
  Landmark,
  Match,
  Project,
  State,
} from './shared-types.ts';

// Card-like kinds that can be resolved from match state.
export type MatchCardLikeKind =
  | 'event'
  | 'landmark'
  | 'project'
  | 'boon'
  | 'hex'
  | 'state'
  | 'artifact';

// Union of card-like instances stored on match state.
export type MatchCardLike =
  | MatchEvent
  | Landmark
  | Project
  | Boon
  | Hex
  | State
  | Artifact;

// Card-like instance mapping by kind for strongly typed lookups.
export type MatchCardLikeByKind = {
  event: MatchEvent;
  landmark: Landmark;
  project: Project;
  boon: Boon;
  hex: Hex;
  state: State;
  artifact: Artifact;
};

// Result shape when callers need both kind and card-like instance.
export type MatchCardLikeEntry = {
  kind: MatchCardLikeKind;
  cardLike: MatchCardLike;
};

// Optional filtering for resolving only selected card-like kinds.
export type FindCardLikeInMatchOptions = {
  includeKinds?: readonly MatchCardLikeKind[];
};

// Returns ordered card-like collections from match state for deterministic lookup.
const getCardLikeCollections = (match: Match): { kind: MatchCardLikeKind; cards: MatchCardLike[] }[] => {
  return [
    { kind: 'event', cards: match.events ?? [] },
    { kind: 'landmark', cards: match.landmarks ?? [] },
    { kind: 'project', cards: match.projects ?? [] },
    { kind: 'boon', cards: match.boons?.cards ?? [] },
    { kind: 'hex', cards: match.hexes?.cards ?? [] },
    { kind: 'state', cards: match.states?.cards ?? [] },
    { kind: 'artifact', cards: match.artifacts?.cards ?? [] },
  ];
};

// Returns the card-like collection for a specific kind.
const getCardLikeCollectionByKind = <K extends MatchCardLikeKind>(
  match: Match,
  kind: K,
): MatchCardLikeByKind[K][] => {
  switch (kind) {
    case 'event':
      return (match.events ?? []) as MatchCardLikeByKind[K][];
    case 'landmark':
      return (match.landmarks ?? []) as MatchCardLikeByKind[K][];
    case 'project':
      return (match.projects ?? []) as MatchCardLikeByKind[K][];
    case 'boon':
      return (match.boons?.cards ?? []) as MatchCardLikeByKind[K][];
    case 'hex':
      return (match.hexes?.cards ?? []) as MatchCardLikeByKind[K][];
    case 'state':
      return (match.states?.cards ?? []) as MatchCardLikeByKind[K][];
    case 'artifact':
      return (match.artifacts?.cards ?? []) as MatchCardLikeByKind[K][];
    default: {
      const unreachableKind: never = kind;
      throw new Error(`[find-card-like-in-match] unsupported kind ${unreachableKind}`);
    }
  }
};

// Finds a card-like entry by id and optionally restricts lookup to specific kinds.
export const findCardLikeEntryInMatch = (
  match: Match | null | undefined,
  cardLikeId: CardLikeId,
  options?: FindCardLikeInMatchOptions,
): MatchCardLikeEntry | undefined => {
  if (!match) return undefined;

  const includeKinds = options?.includeKinds;
  const allowKind = includeKinds ? new Set(includeKinds) : null;

  for (const collection of getCardLikeCollections(match)) {
    if (allowKind && !allowKind.has(collection.kind)) continue;
    const cardLike = collection.cards.find((candidate) => candidate.id === cardLikeId);
    if (cardLike) {
      return { kind: collection.kind, cardLike };
    }
  }

  return undefined;
};

// Finds a card-like instance by id from match state.
export const findCardLikeInMatch = (
  match: Match | null | undefined,
  cardLikeId: CardLikeId,
  options?: FindCardLikeInMatchOptions,
): MatchCardLike | undefined => {
  return findCardLikeEntryInMatch(match, cardLikeId, options)?.cardLike;
};

// Finds a card-like by id restricted to a specific kind.
export const findCardLikeByKindInMatch = <K extends MatchCardLikeKind>(
  match: Match | null | undefined,
  cardLikeId: CardLikeId,
  kind: K,
): MatchCardLikeByKind[K] | undefined => {
  if (!match) return undefined;
  const collection = getCardLikeCollectionByKind(match, kind);
  return collection.find((candidate) => candidate.id === cardLikeId);
};

// Convenience wrappers for specific card-like kinds.
export const findEventInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'event');

export const findLandmarkInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'landmark');

export const findProjectInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'project');

export const findBoonInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'boon');

export const findHexInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'hex');

export const findStateInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'state');

export const findArtifactInMatch = (match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatch(match, cardLikeId, 'artifact');
