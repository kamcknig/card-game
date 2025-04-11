import { LogEntry } from 'shared/shared-types';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../state/player-state';
import {
  lobbyMatchConfigurationStore,
  matchStartedStore,
  matchStore,
  matchSummaryStore
} from '../../state/match-state';
import { gameOwnerIdStore, gamePausedStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardOverrideStore, cardStore } from '../../state/card-state';
import { Assets } from 'pixi.js';
import { type SocketService } from './socket.service';
import { applyPatch, Operation } from 'fast-json-patch';
import { ClientListenEventNames, ClientListenEvents } from '../../../types';
import { selectableCardStore, selectedCardStore } from '../../state/interactive-state';

export type SocketEventMap = Partial<{ [p in ClientListenEventNames]: ClientListenEvents[p] }>;

export const socketToGameEventMap = (socketService: SocketService): SocketEventMap => {
  const map: SocketEventMap = {
    addLogEntry: (logEntry: LogEntry) => {
      /*logManager.addLogEntry(logEntry);*/
    },
    matchConfigurationUpdated: config => {
      lobbyMatchConfigurationStore.set(config.expansions);
    },
    expansionList: val => {
      expansionListStore.set(val);
    },
    gameOver: async summary => {
      try {
        const s = new Audio('./assets/sounds/game-over.mp3');
        await s?.play();
      } catch (error) {
        console.error('error playing game over sound');
        console.error(error);
      }

      matchSummaryStore.set(summary);
      sceneStore.set('gameSummary');
    },
    gameOwnerUpdated: playerId => {
      gameOwnerIdStore.set(playerId);
    },
    setCardLibrary: cards => {
      cardStore.set(cards);
    },
    setCardDataOverrides: overrides => {
      cardOverrideStore.set(overrides ?? {});
    },
    matchReady: async match => {
      matchStore.set(match);

      if (!cardStore.get()) throw new Error('missing card library');
      const cardsById = cardStore.get();
      Assets.addBundle('cardLibrary', Object.values(cardsById).reduce((prev, c) => {
        prev[`${c.cardKey}-detail`] ??= c.detailImagePath;
        prev[`${c.cardKey}-full`] ??= c.fullImagePath;
        prev[`${c.cardKey}-half`] ??= c.halfImagePath;
        return prev;
      }, {
        'card-back-full': `/assets/card-images/base-supply/full-size/card-back.jpg`,
        'card-back-detail': `/assets/card-images/base-supply/detail/card-back.jpg`,
        'card-back-half': `/assets/card-images/base-supply/half-size/card-back.jpg`,
        'treasure-bg': '/assets/ui-icons/treasure-bg.png',
      } as Record<string, string>));

      sceneStore.set('match');
    },
    matchStarted: () => {
      matchStartedStore.set(true);
    },
    matchPatch: (patch: Operation[]) => {
      const current = structuredClone(matchStore.get());
      if (!current) return;
      applyPatch(current, patch);
      matchStore.set(current);
    },
    playerConnected: (player) => {
      playerStore(player.id).set(player);

      if (!playerIdStore.get().includes(player.id)) {
        playerIdStore.set([...playerIdStore.get(), player.id]);
      }

      if (matchStartedStore.get()) {
        gamePausedStore.set(false);
      }
    },
    setPlayerList: players => {
      for (const player of players) {
        playerStore(player.id).set(player);
      }
      playerIdStore.set(players.map(player => player.id));
    },
    playerDisconnected: (player) => {
      playerStore(player.id).set(player);

      if (matchStartedStore.get()) {
        gamePausedStore.set(true);
      }
    },
    playerNameUpdated: (playerId: number, name: string) => {
      const current = playerStore(playerId).get();
      if (!current) return;
      playerStore(playerId).set({
        ...current,
        name
      });
    },
    playerReady: (playerId, ready) => {
      const current = playerStore(playerId).get();
      if (!current) return;

      playerStore(playerId).set({
        ...current,
        ready
      });
    },
    setPlayer: player => {
      selfPlayerIdStore.set(player.id);
    },
    searchCardResponse: results => {
      console.log(results);
    }
  }

  return map;
};
