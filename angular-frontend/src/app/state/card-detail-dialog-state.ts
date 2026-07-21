import { atom } from 'nanostores';
import { CardId } from 'shared/types';

// A single image entry rendered by the card detail dialog. `cardId` is
// present for real in-play cards (enables promote-on-right-click for
// siblings) and absent for card-likes/traits, which have no split-pile
// concept.
export type CardDetailDialogEntry = {
  detailImagePath: string;
  cardId?: CardId;
};

export type CardDetailDialogState = {
  // The large, primary image. Null closes the dialog.
  primary: CardDetailDialogEntry | null;
  // Other members of the same split pile, shown smaller in a column to the
  // primary's right. Right-clicking one promotes it to primary.
  siblings: CardDetailDialogEntry[];
  // Non-swappable extra images appended after the primary+siblings group
  // (e.g. an attached trait's art) — unaffected by promotion.
  extras: CardDetailDialogEntry[];
};

const CLOSED_STATE: CardDetailDialogState = { primary: null, siblings: [], extras: [] };

// Tracks the active card detail dialog contents (primary card, pile
// siblings, and non-swappable extras like trait art).
export const cardDetailDialogStore = atom<CardDetailDialogState>(CLOSED_STATE);

// Opens the global card detail dialog with a primary image plus optional
// pile siblings and extra (non-swappable) images.
export const openCardDetailDialog = (state: {
  primary: CardDetailDialogEntry;
  siblings?: CardDetailDialogEntry[];
  extras?: CardDetailDialogEntry[];
}) => {
  cardDetailDialogStore.set({
    primary: state.primary,
    siblings: state.siblings ?? [],
    extras: state.extras ?? [],
  });
};

// Closes the global card detail dialog.
export const closeCardDetailDialog = () => {
  cardDetailDialogStore.set(CLOSED_STATE);
};

// Promotes a sibling to primary; the previous primary rejoins the sibling
// list in its place.
export const promoteCardDetailSibling = (entry: CardDetailDialogEntry) => {
  const current = cardDetailDialogStore.get();
  if (!current.primary) return;
  const remaining = current.siblings.filter((sibling) => sibling !== entry);
  cardDetailDialogStore.set({
    primary: entry,
    siblings: [current.primary, ...remaining],
    extras: current.extras,
  });
};

(globalThis as any).cardDetailDialogStore = cardDetailDialogStore;
