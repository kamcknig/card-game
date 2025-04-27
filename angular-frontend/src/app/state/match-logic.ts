import { atom, computed } from 'nanostores';
import { CardId, CardKey, Mats } from 'shared/shared-types';
import { matchConfigurationStore, matchStore, selfPlayerIdStore } from './match-state';
import { cardStore } from './card-state';

export const basicSupplyStore =
  computed(matchStore, m => m?.basicSupply ?? []);
(globalThis as any).supplyStore = basicSupplyStore;

export const supplyCardKeyStore = atom<[CardKey[], CardKey[]]>([[], []]);

export const kingdomCardKeyStore = atom<CardKey[]>([]);

export const kingdomSupplyStore =
  computed(matchStore, m => m?.kingdomSupply ?? []);
(globalThis as any).kingdomStore = kingdomSupplyStore;

export const trashStore =
  computed(matchStore, m => m?.trash ?? []);
(globalThis as any).trashStore = trashStore;

export const playAreaStore =
  computed([matchStore, cardStore], (match, cards) => match?.playArea?.map(cardId => cards[cardId]) ?? []);
(globalThis as any).playAreaStore = playAreaStore;

type MatStoreType = Record<Mats, CardId[]>;
export const matStore = computed(
  [selfPlayerIdStore, matchStore],
  (id, match): MatStoreType => {
    return match?.mats?.[id!] ?? {} as MatStoreType
  }
);
(globalThis as any).matStore = matStore;

export const activeDurationCardStore =
  computed([matchStore, cardStore], (match, cards) => match?.activeDurationCards?.map(cardId => cards[cardId]) ?? []);
