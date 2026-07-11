import { CardId } from 'shared/types';
import { cardStore } from '../../../../state/card-state';
import { matchStore } from '../../../../state/match-state';
import { CardDetailDialogEntry, openCardDetailDialog } from '../../../../state/card-detail-dialog-state';

// `cardId` is present only for real in-play cards (resolved via cardStore),
// enabling live split-pile sibling lookup. Card-likes/traits/landscapes and
// pre-match catalog entries omit it and get no sibling column.
type CardDetailArg =
  | number
  | { detailImagePath: string; kingdom?: string; cardId?: CardId };

// Opens the global card detail dialog for a single card (by cardId or an
// explicit detail-image path). Resolves live split-pile siblings via
// cardStore when the primary is a real in-play card belonging to a pile,
// and appends any attached trait's art as a non-swappable extra image.
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

  const siblings = pileKey ? findLivePileSiblings(pileKey, primary.cardId) : [];

  const extras: CardDetailDialogEntry[] = [];
  if (pileKey) {
    const traitDetailImagePath = matchStore.get()?.traits?.find((trait) => trait.pileKey === pileKey)?.detailImagePath;
    if (traitDetailImagePath) {
      extras.push({ detailImagePath: traitDetailImagePath });
    }
  }

  openCardDetailDialog({ primary, siblings, extras });
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
