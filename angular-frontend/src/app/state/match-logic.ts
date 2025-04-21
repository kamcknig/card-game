import { computed } from 'nanostores';
import { Card, CardId, Mats } from 'shared/shared-types';
import { currentPlayerTurnIndexStore, turnNumberStore } from './turn-state';
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
  [playAreaStore, matchStore, matchStatsStore, currentPlayerTurnIndexStore, turnNumberStore, cardStore],
  (playArea, match, matchStats, currentTurnPlayerIndex, turnNumber, allCards) => {
    const result: Card[] = [];

    if (!match || !matchStats?.playedCardsInfo || !matchStats.cardsPlayedByTurn) return result;

    for (const card of playArea.map(id => allCards[id])) {
      if (!card.type.includes('DURATION')) continue;

      const info = matchStats.playedCardsInfo[card.id];
      if (!info) continue;

      const playedTurn = info.turnNumber;

      // Only show if it's after the turn it was played
      if (turnNumber > playedTurn) {
        result.push(card);
      }
      else if (turnNumber === playedTurn) {
        const turnMap = matchStats.cardsPlayedByTurn[playedTurn];
        const playedTurnIds = Object.keys(turnMap).map(Number);
        const playedTurnPlayerIndex = playedTurnIds.findIndex(id => turnMap[id].includes(card.id));

        // If we're in the same turn number but it's no longer that player's turn
        if (playedTurnPlayerIndex !== currentTurnPlayerIndex) {
          result.push(card);
        }
      }
    }

    return result;
  }
);

export const playedCardStore = computed(
  [playAreaStore, matchStatsStore, turnNumberStore, cardStore, matchStore, currentPlayerTurnIndexStore],
  (cardIds, matchStats, turnNumber, allCards, match, currentTurnPlayerIndex) => {
    if (!matchStats?.playedCardsInfo || !matchStats.cardsPlayedByTurn || !match) return cardIds.map(id => allCards[id]);

    return cardIds
      .map(id => allCards[id])
      .filter(card => {
        if (!card.type.includes('DURATION')) return true;

        const info = matchStats.playedCardsInfo[card.id];
        if (!info) return true;

        const playedTurn = info.turnNumber;
        const playedPlayerId = info.playerId;

        if (playedTurn !== turnNumber) return false;

        const turnMap = matchStats.cardsPlayedByTurn[playedTurn];
        const playedTurnIds = Object.keys(turnMap);
        const playedTurnPlayerIndex = playedTurnIds.findIndex(id => parseInt(id) === playedPlayerId);

        return playedTurnPlayerIndex === currentTurnPlayerIndex && turnMap[playedPlayerId]?.includes(card.id);
      });
  }
);

