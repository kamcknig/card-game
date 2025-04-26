import { computed } from 'nanostores';
import { CardId, Mats } from 'shared/shared-types';
import { matchConfigurationStore, matchStore, selfPlayerIdStore } from './match-state';
import { cardStore } from './card-state';

export const supplyStore =
  computed(matchStore, m => m?.supply ?? []);
(globalThis as any).supplyStore = supplyStore;

export const supplyCardKeyStore =
  computed(matchConfigurationStore, matchConfig => matchConfig?.supplyCards?.map(card => card.cardKey) ?? []);

export const kingdomStore =
  computed(matchStore, m => m?.kingdom ?? []);
(globalThis as any).kingdomStore = kingdomStore;

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
