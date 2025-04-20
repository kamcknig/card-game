import { computed } from 'nanostores';
import { CardId, Mats } from 'shared/shared-types';
import { currentPlayerTurnIdStore, turnNumberStore } from './turn-state';
import { cardStore } from './card-state';
import { matchStatsStore, matchStore, selfPlayerIdStore } from './match-state';

export const supplyStore =
  computed(matchStore, m => m?.supply ?? []);
(globalThis as any).supplyStore = supplyStore;

export const kingdomStore =
  computed(matchStore, m => m?.kingdom ?? []);
(globalThis as any).kingdomStore = kingdomStore;

export const trashStore =
  computed(matchStore, m => m?.trash ?? []);
(globalThis as any).trashStore = trashStore;

export const playAreaStore =
  computed(matchStore, m => m?.playArea ?? []);
(globalThis as any).playAreaStore = playAreaStore;

type MatStoreType = Record<Mats, CardId[]>;
export const matStore = computed(
  [selfPlayerIdStore, matchStore],
  (id, match): MatStoreType => {
    return match?.mats?.[id!] ?? {} as MatStoreType
  }
);
(globalThis as any).matStore = matStore;

export const activeDurationCardStore = computed(
  [playAreaStore, matchStatsStore, turnNumberStore, currentPlayerTurnIdStore, cardStore],
  (cardIds, matchStats, turnNumber, currentPlayerTurnId, allCards) => {
    const currentTurnPlays = matchStats?.cardsPlayed?.[turnNumber];

    return cardIds.map(id => allCards[id])
      .filter(nextCard => {
        if (!matchStats || !nextCard.type.includes('DURATION')) return false;
        else if (currentTurnPlays?.[currentPlayerTurnId]?.includes(nextCard.id)) return false;
        return true;
      });
  }
);

export const playedCardStore = computed(
  [playAreaStore, matchStatsStore, turnNumberStore, currentPlayerTurnIdStore, cardStore],
  (cardIds, matchStats, turnNumber, currentPlayerTurnId, allCards) => {
    const currentTurnPlays = matchStats?.cardsPlayed?.[turnNumber];
    return cardIds
      .map(id => allCards[id])
      .filter(card => {
        if (!matchStats) return true;
        if (!card.type.includes('DURATION')) return true;
        return currentTurnPlays?.[currentPlayerTurnId]?.includes(card.id) ?? false;
      });
  }
);
