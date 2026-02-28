import { CardKey, LogEntry, Match } from 'shared/types';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../state/player-state';
import {
  matchConfigurationStore,
  matchStartedStore,
  matchStore,
  matchSummaryStore,
} from '../../state/match-state';
import { gameOwnerIdStore, sceneStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardStore } from '../../state/card-state';
import { tokenDefinitionStore } from '../../state/token-definition-state';
import { applyPatch, Operation } from 'fast-json-patch';
import { ClientListenEventNames, ClientListenEvents } from '../../../types';
import { logManager } from '../log-manager';
import { cardSourceStore, cardSourceTagMapStore } from '../../state/card-source-store';
import { basicSupplies, kingdomSupplies } from '../../state/match-logic';
import {
  activeLobbyGameIdStore,
  lobbyGamesStore,
  lobbyJoinRejectedStore,
  lobbyStatusMessageStore,
} from '../../state/lobby-state';
import { debugRuntimeContextStore } from '../../state/debug-runtime-state';
import { selectableSearchCatalogStore } from '../../state/selectable-search-state';
import { waitingOnPlayerIdStore } from '../../state/match-ui-overlay-state';

export type SocketEventMap = Partial<{ [p in ClientListenEventNames]: ClientListenEvents[p] }>;

export const socketToGameEventMap = (): SocketEventMap => {
  const map = {} as SocketEventMap;
  // Clears transient HUD overlays when leaving match-scoped flows.
  const clearMatchUiOverlays = () => {
    waitingOnPlayerIdStore.set(null);
  };

  map['addLogEntry'] = (logEntries: LogEntry[]) => {
    for (const logEntry of logEntries) {
      logManager.addLogEntry(logEntry);
    }
  };

  map['matchConfigurationUpdated'] = config => {
    matchConfigurationStore.set(config);
    clearMatchUiOverlays();
    // Enter configuration scene when one lobby game is actively joined.
    sceneStore.set('configuration');
  };

  map['joinedLobbyGame'] = gameId => {
    activeLobbyGameIdStore.set(gameId);
    lobbyStatusMessageStore.set(undefined);
  };

  map['debugRuntimeContext'] = payload => {
    debugRuntimeContextStore.set(payload);
  };

  map['expansionList'] = val => {
    expansionListStore.set(val);
  };

  map['setSelectableSearchCatalog'] = catalog => {
    selectableSearchCatalogStore.set(catalog);
  };

  map['gameOver'] = async summary => {
    const s = new Audio('./assets/sounds/game-over.mp3');
    // Autoplay is blocked without user interaction, so guard and swallow the error.
    if (navigator.userActivation?.hasBeenActive) {
      void s.play().catch(() => null);
    }

    clearMatchUiOverlays();
    matchSummaryStore.set(summary);
    sceneStore.set('gameSummary');
  };

  map['gameOwnerUpdated'] = playerId => {
    gameOwnerIdStore.set(playerId);
  };

  map['lobbySnapshot'] = games => {
    lobbyGamesStore.set(games);
    // Keep lobby as default scene while no active game is tracked.
    if (!activeLobbyGameIdStore.get()) {
      clearMatchUiOverlays();
      debugRuntimeContextStore.set(undefined);
      sceneStore.set('lobby');
    }
  };

  map['lobbyGameUpdated'] = game => {
    const currentGames = lobbyGamesStore.get();
    const updatedGames = currentGames.filter((currentGame) => currentGame.gameId !== game.gameId);
    updatedGames.push(game);
    updatedGames.sort((a, b) => a.gameName.localeCompare(b.gameName));
    lobbyGamesStore.set(updatedGames);
  };

  map['lobbyGameRemoved'] = gameId => {
    const currentGames = lobbyGamesStore.get();
    lobbyGamesStore.set(currentGames.filter((game) => game.gameId !== gameId));
  };

  map['joinLobbyRejected'] = payload => {
    const activeGameId = activeLobbyGameIdStore.get();
    if (payload.gameId && activeGameId === payload.gameId && payload.reason !== 'alreadyInGame') {
      activeLobbyGameIdStore.set(undefined);
    }
    clearMatchUiOverlays();
    debugRuntimeContextStore.set(undefined);
    lobbyJoinRejectedStore.set(payload);
    lobbyStatusMessageStore.set(payload.message);
    sceneStore.set('lobby');
  };

  map['kickedFromGame'] = payload => {
    activeLobbyGameIdStore.set(undefined);
    clearMatchUiOverlays();
    debugRuntimeContextStore.set(undefined);
    lobbyStatusMessageStore.set(payload.message);
    sceneStore.set('lobby');
  };

  map['bannedFromGame'] = payload => {
    activeLobbyGameIdStore.set(undefined);
    clearMatchUiOverlays();
    debugRuntimeContextStore.set(undefined);
    lobbyStatusMessageStore.set(payload.message);
    sceneStore.set('lobby');
  };

  map['setCardLibrary'] = cards => {
    cardStore.set(cards);
  };

  map['setTokenDefinitions'] = definitions => {
    tokenDefinitionStore.set(definitions);
  };

  map['matchReady'] = async () => {
    clearMatchUiOverlays();
    const cardsById = cardStore.get();
    if (!cardsById || Object.keys(cardsById).length === 0) {
      console.warn('missing card library on matchReady, skipping setup');
      return;
    }

    const playerId = selfPlayerIdStore.get();
    if (!playerId) throw new Error('missing self playerId');

    const cardSource = cardSourceStore.get();
    if (!cardSource?.['basicSupply'] || !cardSource?.['kingdomSupply']) {
      console.warn('missing card source on matchReady, skipping setup');
      return;
    }

    let basics = cardSource['basicSupply'].reduce((prev, nextCard) => {
      const card = cardsById[nextCard];
      if (!card) return prev;

      if (card.type.includes(('VICTORY'))) {
        if (prev[0].includes(card.kingdom)) return prev;
        prev[0].push(card.kingdom);
        return prev;
      }
      else if (card.type.includes(('TREASURE'))) {
        if (prev[1].includes(card.kingdom)) return prev;
        prev[1].push(card.kingdom);
        return prev;
      }

      return prev;
    }, [[], []] as [CardKey[], CardKey[]]);
    basicSupplies.set(basics ?? [[], []]);

    const kingdoms = cardSource['kingdomSupply'].reduce((prev, nextCard) => {
      const card = cardsById[nextCard];
      if (prev.includes(card.kingdom)) return prev;
      prev.push(card.kingdom);
      return prev;
    }, [] as CardKey[]);
    kingdomSupplies.set(kingdoms ?? []);

    sceneStore.set('match');
  };

  map['matchStarted'] = () => {
    matchStartedStore.set(true);
  };

  map['patchCardLibrary'] = patch => {
    const current = structuredClone(cardStore.get()) ?? {};
    try {
      applyPatch(current, patch);
      cardStore.set(current);
    } catch (error) {
      // Guard against out-of-order/stale patches so one bad patch does not break client event processing.
      console.warn('[socket event map] failed to apply card library patch');
      console.debug(error);
    }
  };

  map['patchUpdate'] = (patchMatch, patchCardLibrary) => {
    if (patchCardLibrary?.length) map['patchCardLibrary']?.(patchCardLibrary);
    if (patchMatch?.length) map['patchMatch']?.(patchMatch);
  };

  map['patchMatch'] = (patch: Operation[]) => {
    const current = structuredClone(matchStore.get()) ?? {} as Match;
    try {
      applyPatch(current, patch);
      cardSourceStore.set(current.cardSources);
      cardSourceTagMapStore.set(current.cardSourceTagMap);
      matchStore.set(current);
    } catch (error) {
      // Guard against out-of-order/stale patches so one bad patch does not break client event processing.
      console.warn('[socket event map] failed to apply match patch');
      console.debug(error);
    }
  };

  map['playerConnected'] = (player) => {
    playerStore(player.id).set(player);

    if (!playerIdStore.get().includes(player.id)) {
      playerIdStore.set([...playerIdStore.get(), player.id]);
    }
  };

  map['setPlayerList'] = players => {
    for (const player of players) {
      playerStore(player.id).set(player);
    }
    playerIdStore.set(players.map(player => player.id));
  };

  map['playerDisconnected'] = (player) => {
    playerStore(player.id).set(player);
  };

  map['playerNameUpdated'] = (playerId: number, name: string) => {
    const current = playerStore(playerId).get();
    if (!current) return;
    playerStore(playerId).set({
      ...current,
      name
    });
  };

  map['playerReady'] = (playerId, ready) => {
    const current = playerStore(playerId).get();
    if (!current) return;

    playerStore(playerId).set({
      ...current,
      ready
    });
  };

  map['setPlayer'] = player => {
    selfPlayerIdStore.set(player.id);
  };

  // Drives Angular "waiting" HUD overlay from server wait-state events.
  map['waitingForPlayer'] = (playerId) => {
    waitingOnPlayerIdStore.set(playerId);
  };

  // Clears "waiting" HUD overlay when matching wait-state completes.
  map['doneWaitingForPlayer'] = (playerId) => {
    const currentWaitingPlayerId = waitingOnPlayerIdStore.get();
    if (playerId === undefined || currentWaitingPlayerId === playerId) {
      waitingOnPlayerIdStore.set(null);
    }
  };

  return map;
}
