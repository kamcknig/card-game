import { atom, map } from 'nanostores';

export type PileSelectionOverlayState = {
  visible: boolean;
  prompt: string;
  optional: boolean;
  submitEnabled: boolean;
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
});

export const pileSelectionOverlayActionStore = atom<PileSelectionOverlayAction | null>(null);
