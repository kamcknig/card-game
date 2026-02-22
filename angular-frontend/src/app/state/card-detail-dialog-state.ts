import { atom } from 'nanostores';

export type CardDetailDialogState = {
  detailImagePaths: string[];
};

// Tracks the active card detail image shown by the global card detail dialog.
export const cardDetailDialogStore = atom<CardDetailDialogState>({
  detailImagePaths: [],
});

// Opens the global card detail dialog for one or more image paths.
export const openCardDetailDialog = (detailImagePaths: string | string[]) => {
  const paths = Array.isArray(detailImagePaths) ? detailImagePaths : [detailImagePaths];
  cardDetailDialogStore.set({ detailImagePaths: [...new Set(paths.filter((path) => path.trim().length > 0))] });
};

// Closes the global card detail dialog.
export const closeCardDetailDialog = () => {
  cardDetailDialogStore.set({ detailImagePaths: [] });
};

(globalThis as any).cardDetailDialogStore = cardDetailDialogStore;
