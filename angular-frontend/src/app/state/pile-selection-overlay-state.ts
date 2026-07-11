import { atom, map } from 'nanostores';

export type PileSelectionOverlayState = {
  visible: boolean;
  prompt: string;
  optional: boolean;
  submitEnabled: boolean;
  // True when the prompt's count spec is exactly 1 — board pile clicks
  // replace the current selection instead of toggling additively, so the
  // player can never highlight more piles than the prompt allows.
  singleSelection: boolean;
  // What a board click should record while the overlay is up:
  // 'pile' — select-pile prompts write pile keys to selectedPileStore;
  // 'card' — select-card (gain) prompts write top-card ids to
  // selectedCardStore.
  selectionKind: 'pile' | 'card';
};

export type PileSelectionOverlayAction = {
  action: 'submit' | 'cancel';
  nonce: number;
};

export const pileSelectionOverlayStore = map<PileSelectionOverlayState>({
  visible: false,
  prompt: 'Select pile',
  optional: false,
  submitEnabled: false,
  singleSelection: false,
  selectionKind: 'pile',
});

export const pileSelectionOverlayActionStore = atom<PileSelectionOverlayAction | null>(null);
