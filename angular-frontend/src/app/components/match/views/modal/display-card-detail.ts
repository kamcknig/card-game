import { CardId } from 'shared/types';
import { cardStore } from '../../../../state/card-state';
import { matchStore } from '../../../../state/match-state';
import { CardDetailDialogEntry, openCardDetailDialog } from '../../../../state/card-detail-dialog-state';

// `cardId` is present only for real in-play cards (resolved via cardStore),
// enabling live split-pile sibling lookup. Card-likes/traits/landscapes and
// pre-match catalog entries omit it and get no sibling column.
// `expansionName`/`pileMembers` are present when the primary comes from the
// lobby/match-configuration search catalog (a CardNoId) — there is no live
// cardStore entry in that context, so pile membership must be carried
// directly on the call-site payload (see Phase 1's catalog `pileMembers`
// field) instead of resolved from cardStore.
type CardDetailArg =
  | number
  | {
      detailImagePath: string;
      kingdom?: string;
      cardId?: CardId;
      expansionName?: string;
      pileMembers?: { cardKey: string; cardName: string }[];
    };

// Opens the global card detail dialog for a single card (by cardId or an
// explicit detail-image path). Resolves live split-pile siblings via
// cardStore when the primary is a real in-play card belonging to a pile,
// falls back to catalog-sourced `pileMembers` siblings when the primary has
// no live cardId (lobby/match-configuration context), and appends any
// attached trait's art as a non-swappable extra image.
export async function displayCardDetail(arg: CardDetailArg) {
  let primary: CardDetailDialogEntry;
  let pileKey: string | undefined;

  if (typeof arg === 'number') {
    const card = cardStore.get()[arg];
    if (!card?.detailImagePath) return;
    primary = { detailImagePath: card.detailImagePath, cardId: arg };
    pileKey = card.kingdom;
  } else {
    if (!arg.detailImagePath?.trim()) return;
    primary = { detailImagePath: arg.detailImagePath, cardId: arg.cardId };
    pileKey = arg.kingdom;
  }

  // Live siblings require a resolvable cardId (real in-play card); with no
  // cardId (lobby/match-configuration catalog entries) fall back to the
  // catalog's own pileMembers list instead.
  const siblings = primary.cardId !== undefined && pileKey
    ? [...findLivePileSiblings(pileKey, primary.cardId), ...findLinkedSiblings(pileKey, primary.cardId)]
    : resolveCatalogPileSiblings(arg);

  const extras: CardDetailDialogEntry[] = [];
  if (pileKey) {
    const traitDetailImagePath = matchStore.get()?.traits?.find((trait) => trait.pileKey === pileKey)?.detailImagePath;
    if (traitDetailImagePath) {
      extras.push({ detailImagePath: traitDetailImagePath });
    }
  }

  openCardDetailDialog({ primary, siblings, extras });
}

// Resolves sibling detail-image entries from catalog `pileMembers` data
// (match-configuration/lobby context — no live cardStore entry exists yet
// for a not-yet-placed kingdom selection). Each member's own detail image
// path is derived the same way CardComponent.onContextMenu derives the
// primary's — expansionName + cardKey — since individual pile members never
// carry an imageKeyOverride (that's only ever set on the pile's own
// representative entry).
function resolveCatalogPileSiblings(arg: CardDetailArg): CardDetailDialogEntry[] {
  if (typeof arg === 'number' || !arg.pileMembers?.length || !arg.expansionName) {
    return [];
  }
  return arg.pileMembers.map((member) => ({
    detailImagePath: `/assets/card-images/${arg.expansionName}/${member.cardKey}-detail.jpg`,
  }));
}

// Finds one representative live Card per distinct sibling cardKey sharing
// the given pile (kingdom), excluding the primary's own cardKey. cardStore
// holds every card the server has ever created for the match (by id,
// regardless of current zone), so every split-pile member's own Card
// object — and its precomputed detailImagePath — is already available
// client-side with no extra server round-trip.
function findLivePileSiblings(pileKey: string, excludeCardId?: CardId): CardDetailDialogEntry[] {
  const cardsById = cardStore.get();
  const excludeCardKey = excludeCardId !== undefined ? cardsById[excludeCardId]?.cardKey : undefined;
  const seenCardKeys = new Set<string>(excludeCardKey ? [excludeCardKey] : []);
  const entries: CardDetailDialogEntry[] = [];
  for (const card of Object.values(cardsById)) {
    if (card.kingdom !== pileKey || seenCardKeys.has(card.cardKey)) continue;
    seenCardKeys.add(card.cardKey);
    entries.push({ cardId: card.id, detailImagePath: card.detailImagePath });
  }
  return entries.sort((a, b) => a.detailImagePath.localeCompare(b.detailImagePath));
}

// Finds "caused by" siblings in both directions:
// - If the primary card is a TRIGGER (its own linkedPileKey is set),
//   include a representative of the target pile it causes to exist (e.g.
//   Young Witch -> its chosen Bane card).
// - If the primary card belongs to a TARGET pile, include every TRIGGER
//   currently in the kingdom whose linkedPileKey points at this pile
//   (naturally covers many:1 — e.g. every Looter present when viewing
//   Ruins).
function findLinkedSiblings(pileKey: string, excludeCardId?: CardId): CardDetailDialogEntry[] {
  const cardsById = cardStore.get();
  const primaryCard = excludeCardId !== undefined ? cardsById[excludeCardId] : undefined;
  const seenCardKeys = new Set<string>(primaryCard ? [primaryCard.cardKey] : []);
  const entries: CardDetailDialogEntry[] = [];

  const addRepresentative = (targetPileKey: string) => {
    for (const card of Object.values(cardsById)) {
      if (card.kingdom !== targetPileKey || seenCardKeys.has(card.cardKey)) continue;
      seenCardKeys.add(card.cardKey);
      entries.push({ cardId: card.id, detailImagePath: card.detailImagePath });
      return;
    }
  };

  // Forward: I am a trigger — show my target.
  if (primaryCard?.linkedPileKey) {
    addRepresentative(primaryCard.linkedPileKey);
  }

  // Reverse: I belong to a target pile — show every trigger pointing at me.
  for (const card of Object.values(cardsById)) {
    if (card.linkedPileKey !== pileKey || seenCardKeys.has(card.cardKey)) continue;
    seenCardKeys.add(card.cardKey);
    entries.push({ cardId: card.id, detailImagePath: card.detailImagePath });
  }

  return entries;
}
