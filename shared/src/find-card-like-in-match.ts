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
