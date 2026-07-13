import { Card, CardCost, CardId } from 'shared/types';
import { compareCardCosts } from 'shared/compare-card-cost';
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
      pileMembers?: { cardKey: string; cardName: string; cost: CardCost }[];
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
    ? [
        ...findLivePileSiblings(pileKey, primary.cardId),
        ...findLinkedSiblings(pileKey, primary.cardId),
        ...findTravellerLineSiblings(primary.cardId),
      ]
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
// representative entry). Sorted by cost ascending, per the sibling-column
// display order used everywhere else in this file.
function resolveCatalogPileSiblings(arg: CardDetailArg): CardDetailDialogEntry[] {
  if (typeof arg === 'number' || !arg.pileMembers?.length || !arg.expansionName) {
    return [];
  }
  return [...arg.pileMembers]
    .sort((a, b) => compareCardCosts(a.cost, b.cost))
    .map((member) => ({
      detailImagePath: `/assets/card-images/${arg.expansionName}/${member.cardKey}-detail.jpg`,
    }));
}

// Finds one representative live Card per distinct sibling cardKey sharing
// the given pile (kingdom), excluding the primary's own cardKey. cardStore
// holds every card the server has ever created for the match (by id,
// regardless of current zone), so every split-pile member's own Card
// object — and its precomputed detailImagePath — is already available
// client-side with no extra server round-trip. Sorted by cost ascending.
function findLivePileSiblings(pileKey: string, excludeCardId?: CardId): CardDetailDialogEntry[] {
  const cardsById = cardStore.get();
  const excludeCardKey = excludeCardId !== undefined ? cardsById[excludeCardId]?.cardKey : undefined;
  const seenCardKeys = new Set<string>(excludeCardKey ? [excludeCardKey] : []);
  const matches: Card[] = [];
  for (const card of Object.values(cardsById)) {
    if (card.kingdom !== pileKey || seenCardKeys.has(card.cardKey)) continue;
    seenCardKeys.add(card.cardKey);
    matches.push(card);
  }
  return matches
    .sort((a, b) => compareCardCosts(a.cost, b.cost))
    .map((card) => ({ cardId: card.id, detailImagePath: card.detailImagePath }));
}

// Adventures traveller lines: each of the two 5-card upgrade chains
// (Page -> Treasure Hunter -> Warrior -> Hero -> Champion; Peasant ->
// Soldier -> Fugitive -> Disciple -> Teacher) is static card-definition
// data, not something derived from live pile/link relationships, so it's
// hardcoded here rather than threaded through the server.
const TRAVELLER_LINES: Record<string, string[]> = {
  page: ['page', 'treasure-hunter', 'warrior', 'hero', 'champion'],
  'treasure-hunter': ['page', 'treasure-hunter', 'warrior', 'hero', 'champion'],
  warrior: ['page', 'treasure-hunter', 'warrior', 'hero', 'champion'],
  hero: ['page', 'treasure-hunter', 'warrior', 'hero', 'champion'],
  champion: ['page', 'treasure-hunter', 'warrior', 'hero', 'champion'],
  peasant: ['peasant', 'soldier', 'fugitive', 'disciple', 'teacher'],
  soldier: ['peasant', 'soldier', 'fugitive', 'disciple', 'teacher'],
  fugitive: ['peasant', 'soldier', 'fugitive', 'disciple', 'teacher'],
  disciple: ['peasant', 'soldier', 'fugitive', 'disciple', 'teacher'],
  teacher: ['peasant', 'soldier', 'fugitive', 'disciple', 'teacher'],
};

// Finds one representative live Card per distinct cardKey in the primary
// card's traveller line (if it belongs to one), excluding the primary's own
// cardKey. Sorted by cost ascending, matching the other resolvers' order.
function findTravellerLineSiblings(excludeCardId?: CardId): CardDetailDialogEntry[] {
  const cardsById = cardStore.get();
  const primaryCard = excludeCardId !== undefined ? cardsById[excludeCardId] : undefined;
  const line = primaryCard ? TRAVELLER_LINES[primaryCard.cardKey] : undefined;
  if (!primaryCard || !line) return [];

  const seenCardKeys = new Set<string>([primaryCard.cardKey]);
  const matches: Card[] = [];
  for (const card of Object.values(cardsById)) {
    if (!line.includes(card.cardKey) || seenCardKeys.has(card.cardKey)) continue;
    seenCardKeys.add(card.cardKey);
    matches.push(card);
  }
  return matches
    .sort((a, b) => compareCardCosts(a.cost, b.cost))
    .map((card) => ({ cardId: card.id, detailImagePath: card.detailImagePath }));
}

// Finds "caused by" siblings in both directions:
// - If the primary card is a TRIGGER (its own linkedPileKey is set),
//   include a representative of the target pile it causes to exist (e.g.
//   Young Witch -> its chosen Bane card).
// - If the primary card belongs to a TARGET pile, include every TRIGGER
//   currently in the kingdom whose linkedPileKey points at this pile
//   (naturally covers many:1 — e.g. every Looter present when viewing
//   Ruins), sorted by cost ascending.
function findLinkedSiblings(pileKey: string, excludeCardId?: CardId): CardDetailDialogEntry[] {
  const cardsById = cardStore.get();
  const primaryCard = excludeCardId !== undefined ? cardsById[excludeCardId] : undefined;
  const seenCardKeys = new Set<string>(primaryCard ? [primaryCard.cardKey] : []);
  const entries: CardDetailDialogEntry[] = [];

  // Forward: I am a trigger — show my target (single representative card).
  if (primaryCard?.linkedPileKey) {
    for (const card of Object.values(cardsById)) {
      if (card.kingdom !== primaryCard.linkedPileKey || seenCardKeys.has(card.cardKey)) continue;
      seenCardKeys.add(card.cardKey);
      entries.push({ cardId: card.id, detailImagePath: card.detailImagePath });
      break;
    }
  }

  // Reverse: I belong to a target pile — show every trigger pointing at me.
  const triggers: Card[] = [];
  for (const card of Object.values(cardsById)) {
    if (card.linkedPileKey !== pileKey || seenCardKeys.has(card.cardKey)) continue;
    seenCardKeys.add(card.cardKey);
    triggers.push(card);
  }
  triggers
    .sort((a, b) => compareCardCosts(a.cost, b.cost))
    .forEach((card) => entries.push({ cardId: card.id, detailImagePath: card.detailImagePath }));

  return entries;
}
