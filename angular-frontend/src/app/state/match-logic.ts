import { computed } from 'nanostores';
import { Card, CardId, Mats } from 'shared/shared-types';
import { currentPlayerTurnIdStore } from './turn-state';
import { cardStore } from './card-state';
import { matchStore, selfPlayerIdStore } from './match-state';
import { getDistanceToPlayer } from '../shared/get-player-position-utils';

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
  [playAreaStore, matchStore, cardStore, currentPlayerTurnIdStore],
  (playArea, match, allCards, currentPlayerTurnId) => {
    const result: Card[] = [];

    const matchStats = match?.stats;

    if (!match || !matchStats?.playedCardsInfo) return result;

    for (const card of playArea.map(id => allCards[id])) {
      if (!card.type.includes('DURATION')) continue;

      const info = matchStats.playedCardsInfo[card.id];
      if (!info) continue;

      const turnsSincePlayed = getDistanceToPlayer({
        match,
        startPlayerId: info.turnPlayerId,
        targetPlayerId: currentPlayerTurnId,
        direction: 'forward'
      });

      if (turnsSincePlayed > 0 && turnsSincePlayed < match.players.length) {
        result.push(card);
      }
    }

    return result;
  }
);

export const playedCardStore = computed(
  [playAreaStore, cardStore, matchStore, currentPlayerTurnIdStore],
  (cardIds, allCards, match, currentPlayerTurnId) => {
    const matchStats = match?.stats;
    if (!matchStats?.playedCardsInfo || !match) return cardIds.map(id => allCards[id]);

    return cardIds
      .map(id => allCards[id])
      .filter(card => {
        if (!card.type.includes('DURATION')) return true;

        const info = matchStats.playedCardsInfo[card.id];
        if (!info) return true;

        const turnsSincePlayed = getDistanceToPlayer({
          match,
          startPlayerId: info.turnPlayerId,
          targetPlayerId: currentPlayerTurnId,
          direction: 'forward'
        });

        return turnsSincePlayed === 0;
      });
  }
);

