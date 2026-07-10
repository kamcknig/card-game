import { computed, ReadableAtom } from 'nanostores';
import { matchStore } from './match-state';
import { cardStore } from './card-state';
import { Card, CardId, Match, PlayerId } from 'shared/types';

export const cofferStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any)?.coffers ?? {});
// Tracks per-player Villagers tokens for UI rendering.
export const villagerStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any)?.villagers ?? {});
// Tracks per-player debt tokens for UI rendering.
export const debtStore: ReadableAtom<Record<PlayerId, number>> = computed(matchStore, store => (store as any)?.debt ?? {});

// Resolves whether any content minted into the match can grant the given
// resource: provider cards carry a matching entry in Card.tags (set in the
// expansion card-library JSONs), and provider projects carry Project.tags.
// Scanning minted cards (rather than the selected kingdom) also covers
// piles added dynamically at setup (Young Witch bane, Ferryman).
const matchUsesResource = (tag: 'coffers' | 'villagers', cards: Record<CardId, Card>, match: Match | null): boolean => {
  if (Object.values(cards ?? {}).some((card) => card.tags?.includes(tag))) {
    return true;
  }
  return (match?.projects ?? []).some((project) => project.tags?.includes(tag));
};

// True when the match contains at least one Coffers provider — the only case
// where the Coffers HUD readout should render (even at 0).
export const matchUsesCoffersStore: ReadableAtom<boolean> = computed(
  [cardStore, matchStore],
  (cards, match) => matchUsesResource('coffers', cards, match),
);

// True when the match contains at least one Villagers provider — gates the
// Villagers HUD readout alongside the existing own-action-phase check.
export const matchUsesVillagersStore: ReadableAtom<boolean> = computed(
  [cardStore, matchStore],
  (cards, match) => matchUsesResource('villagers', cards, match),
);
