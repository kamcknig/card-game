import { atom } from 'nanostores';

export type CardDetailDialogState = {
  detailImagePath: string | null;
};

// Tracks the active card detail image shown by the global card detail dialog.
export const cardDetailDialogStore = atom<CardDetailDialogState>({
  detailImagePath: null,
});

// Opens the global card detail dialog for a specific image path.
export const openCardDetailDialog = (detailImagePath: string) => {
  cardDetailDialogStore.set({ detailImagePath });
};

// Closes the global card detail dialog.
export const closeCardDetailDialog = () => {
  cardDetailDialogStore.set({ detailImagePath: null });
};

(globalThis as any).cardDetailDialogStore = cardDetailDialogStore;
