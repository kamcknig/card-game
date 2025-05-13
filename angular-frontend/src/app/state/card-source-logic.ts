import { computed, ReadableAtom } from 'nanostores';
import { Card, CardNoId } from 'shared/shared-types';
import { getCardSourceStore } from './card-source-store';
import { cardStore } from './card-state';
import { matchStore } from './match-state';

export const nonSupplyKingdomMapStore = computed(
  [getCardSourceStore('nonSupplyKingdomMap'), cardStore, matchStore],
  (nonSupplyKingdomMap, cards, match) => {
    const kingdomMap = nonSupplyKingdomMap.reduce((prev, cardId) => {
      const card = cards[cardId];
      if (!card) {
        return prev;
      }

      const startingCards = match?.config.nonSupply
        ?.filter(supply => supply.name === 'rewards')
        ?.map(supply => supply.cards).flat() ?? [];

      prev[card.kingdom] ||= {
        startingCards: startingCards,
        cards: [],
      };
      prev[card.kingdom].cards.push(card);
      return prev;
    }, {} as Record<string, {startingCards: CardNoId[], cards: Card[]}>)
    return kingdomMap;
  }
);


export const rewardsStore: ReadableAtom<{
  startingCards: CardNoId[]; cards: Card[]
} | undefined> = computed(
  [getCardSourceStore('nonSupplyCards'), cardStore, matchStore],
  (nonSupply, cards, match) => {
    const cardsInSupply = nonSupply
      .map(id => cards[id])
      .filter(card => card.type.includes('REWARD'))

    const startingCards = match?.config.nonSupply
      ?.filter(supply => supply.name === 'rewards')
      ?.map(supply => supply.cards).flat() ?? [];

    if (!cardsInSupply.length || !startingCards.length) {
      return undefined;
    }

    return {
      startingCards: startingCards,
      cards: cardsInSupply
    }
  }
);

export const spoilsStore = computed(
  [getCardSourceStore('nonSupplyCards'), cardStore],
  (cards, cardStore) =>
    cards.map(cardId => cardStore[cardId])
      .filter(card => card.tags?.includes('spoils'))
      .map(card => card.id) ?? []
);

export const playAreaStore =
  computed(
    [getCardSourceStore('playArea'), cardStore],
    (playAreaCardIds, cardsById) => playAreaCardIds?.map(cardId => cardsById[cardId]) ?? []
  );


(globalThis as any).rewardsStore = rewardsStore;
(globalThis as any).playAreaStore = playAreaStore;
(globalThis as any).spoilsStore = spoilsStore;
