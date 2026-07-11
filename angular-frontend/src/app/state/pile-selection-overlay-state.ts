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
});

export const pileSelectionOverlayActionStore = atom<PileSelectionOverlayAction | null>(null);
