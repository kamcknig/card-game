import type {
  Ally,
  Artifact,
  Boon,
  CardLikeId,
  Event as MatchEvent,
  Hex,
  Landmark,
  Match,
  Prophecy,
  Project,
  State,
  Trait,
  Way,
} from './shared-types.ts';

// Card-like kinds that can be resolved from match state.
export type MatchCardLikeKind =
  | 'event'
  | 'ally'
  | 'trait'
  | 'landmark'
  | 'project'
  | 'way'
  | 'prophecy'
  | 'boon'
  | 'hex'
  | 'state'
  | 'artifact';

// Union of card-like instances stored on match state.
export type MatchCardLike =
  | MatchEvent
  | Ally
  | Trait
  | Landmark
  | Project
  | Way
  | Prophecy
  | Boon
  | Hex
  | State
  | Artifact;

// Card-like instance mapping by kind for strongly typed lookups.
export type MatchCardLikeByKind = {
  event: MatchEvent;
  ally: Ally;
  trait: Trait;
  landmark: Landmark;
  project: Project;
  way: Way;
  prophecy: Prophecy;
  boon: Boon;
  hex: Hex;
  state: State;
  artifact: Artifact;
};

// Replaces unknown metadata with caller-provided metadata shape.
type CardLikeWithMetadata<TCardLike, M> = Omit<TCardLike, 'metadata'> & {
  metadata: M;
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
    { kind: 'ally', cards: match.allies ?? [] },
    { kind: 'trait', cards: match.traits ?? [] },
    { kind: 'landmark', cards: match.landmarks ?? [] },
    { kind: 'project', cards: match.projects ?? [] },
    { kind: 'way', cards: match.ways ?? [] },
    { kind: 'prophecy', cards: match.prophecies ?? [] },
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
    case 'ally':
      return (match.allies ?? []) as MatchCardLikeByKind[K][];
    case 'trait':
      return (match.traits ?? []) as MatchCardLikeByKind[K][];
    case 'landmark':
      return (match.landmarks ?? []) as MatchCardLikeByKind[K][];
    case 'project':
      return (match.projects ?? []) as MatchCardLikeByKind[K][];
    case 'way':
      return (match.ways ?? []) as MatchCardLikeByKind[K][];
    case 'prophecy':
      return (match.prophecies ?? []) as MatchCardLikeByKind[K][];
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

// Finds a card-like by id restricted to a specific kind with metadata typing.
export const findCardLikeByKindInMatchWithMetadata = <K extends MatchCardLikeKind, M = unknown>(
  match: Match | null | undefined,
  cardLikeId: CardLikeId,
  kind: K,
): CardLikeWithMetadata<MatchCardLikeByKind[K], M> | undefined => {
  const cardLike = findCardLikeByKindInMatch(match, cardLikeId, kind);
  return cardLike as CardLikeWithMetadata<MatchCardLikeByKind[K], M> | undefined;
};

// Convenience wrappers for specific card-like kinds.
export const findEventInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'event', M>(match, cardLikeId, 'event');

export const findLandmarkInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'landmark', M>(match, cardLikeId, 'landmark');

export const findAllyInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'ally', M>(match, cardLikeId, 'ally');

export const findTraitInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'trait', M>(match, cardLikeId, 'trait');

export const findProjectInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'project', M>(match, cardLikeId, 'project');

export const findProphecyInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'prophecy', M>(match, cardLikeId, 'prophecy');

export const findWayInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'way', M>(match, cardLikeId, 'way');

export const findBoonInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'boon', M>(match, cardLikeId, 'boon');

export const findHexInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'hex', M>(match, cardLikeId, 'hex');

export const findStateInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'state', M>(match, cardLikeId, 'state');

export const findArtifactInMatch = <M = unknown>(match: Match | null | undefined, cardLikeId: CardLikeId) =>
  findCardLikeByKindInMatchWithMetadata<'artifact', M>(match, cardLikeId, 'artifact');
