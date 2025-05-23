import { atom, computed, ReadableAtom } from 'nanostores';
import { Card, CardId, CardKey, CardNoId, Mats } from 'shared/shared-types';
import { matchStore } from './match-state';
import { cardStore } from './card-state';
import { selfPlayerIdStore } from './player-state';
import { cardSourceStore } from './card-source-store';

export const basicSupplyStore =
  computed(cardSourceStore, m => m['basicSupply'] ?? []);

export const nonSupplyStore =
  computed(cardSourceStore, match => match['nonSupplyCards'] ?? []);

export const rewardsStore: ReadableAtom<{
  startingCards: CardNoId[]; cards: Card[]
} | undefined> = computed(
  [nonSupplyStore, cardStore, matchStore],
  (nonSupply, cards, match) => {
    const cardsInSupply = nonSupply
      .map(id => cards[id])
      .filter(card => card.type.includes('REWARD'))

    const startingCards = match?.config.nonSupplyCards?.filter(card => card.type.includes('REWARD')) ?? [];
    if (!cardsInSupply.length || !startingCards.length) {
      return undefined;
    }

    return {
      startingCards: startingCards,
      cards: cardsInSupply
    }
  }
);

export const supplyCardKeyStore = atom<[CardKey[], CardKey[]]>([[], []]);

export const kingdomCardKeyStore = atom<CardKey[]>([]);

export const kingdomSupplyStore =
  computed(cardSourceStore, m => m['kingdomSupply'] ?? []);

export const trashStore =
  computed(cardSourceStore, m => m['trash'] ?? []);

export const playAreaStore =
  computed([cardSourceStore, cardStore], (match, cards) => match['playArea']?.map(cardId => cards[cardId]) ?? []);

type MatStoreType = Record<Mats, CardId[]>;
export const selfPlayerMatStore = computed(
  [selfPlayerIdStore, matchStore],
  (selfId, match): MatStoreType => {
    return match?.mats?.[selfId!] ?? {} as MatStoreType
  }
);

export const setAsideStore = computed(
  [matchStore],
  (match) => Object.keys(match?.mats ?? {}).reduce((acc, nextPlayerId) => {
    return [...acc, ...(match?.mats?.[+nextPlayerId]?.['set-aside'] ?? [])];
  }, [] as CardId[])
);

export const activeDurationCardStore =
  computed([cardSourceStore, cardStore], (match, cards) => match['activeDurationCards']?.map(cardId => cards[cardId]) ?? []);

(globalThis as any).supplyStore = basicSupplyStore;
(globalThis as any).kingdomStore = kingdomSupplyStore;
(globalThis as any).trashStore = trashStore;
(globalThis as any).playAreaStore = playAreaStore;
(globalThis as any).matStore = selfPlayerMatStore;
(globalThis as any).nonSupplyStore = nonSupplyStore;
(globalThis as any).activeDurationCardStore = activeDurationCardStore;
(globalThis as any).rewardsStore = rewardsStore;
(globalThis as any).setAsideStore = setAsideStore;
