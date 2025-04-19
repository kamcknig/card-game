import { LogEntry, Match, MatchStats } from 'shared/shared-types';
import { playerIdStore, playerStore } from '../../state/player-state';
import {
  lobbyMatchConfigurationStore,
  matchStartedStore,
  matchStatsStore,
  matchStore,
  matchSummaryStore,
  selfPlayerIdStore
} from '../../state/match-state';
import { gameOwnerIdStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardOverrideStore, cardStore } from '../../state/card-state';
import { Assets } from 'pixi.js';
import { applyPatch, Operation } from 'fast-json-patch';
import { ClientListenEventNames, ClientListenEvents } from '../../../types';
import { logManager } from '../log-manager';

export type SocketEventMap = Partial<{ [p in ClientListenEventNames]: ClientListenEvents[p] }>;

export const socketToGameEventMap = (): SocketEventMap => {
  const map: SocketEventMap = {};

  map.addLogEntry = (logEntry: LogEntry) => {
    logManager.addLogEntry(logEntry);
  };

  map.matchConfigurationUpdated = config => {
    lobbyMatchConfigurationStore.set(config.expansions);
  };

  map.expansionList = val => {
    expansionListStore.set(val);
  };

  map.gameOver = async summary => {
    try {
      const s = new Audio('./assets/sounds/game-over.mp3');
      await s?.play();
    } catch (error) {
      console.error('error playing game over sound');
      console.error(error);
    }

    matchSummaryStore.set(summary);
    sceneStore.set('gameSummary');
  };

  map.gameOwnerUpdated = playerId => {
    gameOwnerIdStore.set(playerId);
  };

  map.setCardLibrary = cards => {
    cardStore.set(cards);
  };

  map.setCardDataOverrides = overrides => {
    cardOverrideStore.set(overrides ?? {});
  };

  map.matchReady = async match => {
    if (!cardStore.get()) throw new Error('missing card library');

    matchStore.set(match);

    const playerId = selfPlayerIdStore.get();
    if (!playerId) throw new Error('missing self playerId');

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
  };

  map.matchStarted = () => {
    matchStartedStore.set(true);
  };

  map.patchCardLibrary = patch => {
    const current = structuredClone(cardStore.get()) ?? {};
    applyPatch(current, patch);
    cardStore.set(current);
  };

  map.patchUpdate = (patchMatch, patchCardLibrary, patchMatchStats) => {
    if (patchMatch?.length) map.patchMatch?.(patchMatch);
    if (patchCardLibrary?.length) map.patchCardLibrary?.(patchCardLibrary);
    if (patchMatchStats?.length) map.patchMatchStats?.(patchMatchStats);
  };

  map.patchMatch = (patch: Operation[]) => {
    const current = structuredClone(matchStore.get()) ?? {} as Match;
    applyPatch(current, patch);
    matchStore.set(current);
  };

  map.patchMatchStats = patch => {
    const current = structuredClone(matchStatsStore.get()) ?? {} as MatchStats;
    applyPatch(current, patch);
    matchStatsStore.set(current);
  };

  map.playerConnected = (player) => {
    playerStore(player.id).set(player);

    if (!playerIdStore.get().includes(player.id)) {
      playerIdStore.set([...playerIdStore.get(), player.id]);
    }
  };

  map.setPlayerList = players => {
    for (const player of players) {
      playerStore(player.id).set(player);
    }
    playerIdStore.set(players.map(player => player.id));
  };

  map.playerDisconnected = (player) => {
    playerStore(player.id).set(player);
  };

  map.playerNameUpdated = (playerId: number, name: string) => {
    const current = playerStore(playerId).get();
    if (!current) return;
    playerStore(playerId).set({
      ...current,
      name
    });
  };

  map.playerReady = (playerId, ready) => {
    const current = playerStore(playerId).get();
    if (!current) return;

    playerStore(playerId).set({
      ...current,
      ready
    });
  };

  map.setPlayer = player => {
    selfPlayerIdStore.set(player.id);
  }
  return map;
}
