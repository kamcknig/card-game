import { atom, computed, ReadableAtom } from 'nanostores';
import { Card, CardKey, CardNoId } from 'shared/shared-types';
import { matchStore } from './match-state';
import { cardStore } from './card-state';
import { getCardSourceStore } from './card-source-store';

export const rewardsStore: ReadableAtom<{
  startingCards: CardNoId[]; cards: Card[]
} | undefined> = computed(
  [getCardSourceStore('nonSupplyCards'), cardStore, matchStore],
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

export const playAreaStore =
  computed([getCardSourceStore('playArea'), cardStore], (playAreaCardIds, cardsById) => playAreaCardIds?.map(cardId => cardsById[cardId]) ?? []);

(globalThis as any).playAreaStore = playAreaStore;
(globalThis as any).rewardsStore = rewardsStore;
