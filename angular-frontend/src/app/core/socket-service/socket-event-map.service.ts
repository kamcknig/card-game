import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CardKey, LogEntry, Match } from 'shared/types';
import { AuthService } from '../auth/auth.service';
import { playerIdStore, playerStore, selfPlayerIdStore } from '../../state/player-state';
import {
  matchConfigurationStore,
  matchStartedStore,
  matchStore,
  matchSummaryStore,
} from '../../state/match-state';
import { gameOwnerIdStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardStore } from '../../state/card-state';
import { tokenDefinitionStore } from '../../state/token-definition-state';
import { applyPatch, Operation } from 'fast-json-patch';
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
import { logEntryIdsStore, logStore } from '../../state/log-state';
import { SocketEventMap, SocketService } from './socket.service';

/**
 * Owns the full socket connection lifecycle: builds the server-to-store event handler map,
 * registers all handlers with SocketService, and emits the initial catalog warmup event.
 *
 * Call connect() once after auth is confirmed. Subsequent calls are no-ops (double-init guard).
 * Replaces the plain socketToGameEventMap() factory and the connectSocket() helper in main.ts.
 */
@Injectable({ providedIn: 'root' })
export class SocketEventMapService {
  private readonly _router = inject(Router);
  private readonly _socketService = inject(SocketService);
  private readonly _authService = inject(AuthService);

  /**
   * Tracks whether server-to-client event handlers have been registered.
   * Handler registration is one-shot — registering twice would cause every
   * server event to fire its handler N times. Connection state, by contrast,
   * is per-call: a logout/re-login cycle disconnects then needs to reconnect.
   */
  private _handlersRegistered = false;

  /**
   * Registers all socket event handlers (one-shot) and ensures the socket is
   * connected. Safe to call repeatedly — handlers are only registered on the
   * first call, but each call (re)opens the socket if it is currently
   * disconnected. Should be called after the auth token is confirmed valid;
   * the SocketService auth callback re-reads the token from localStorage on
   * every connect, so post-login calls automatically use the new token.
   */
  connect(): void {
    if (!this._handlersRegistered) {
      this._handlersRegistered = true;
      this._socketService.setEventMap(this._buildMap());
      // Warm searchable landscape data on startup so configuration search can filter locally.
      this._socketService.emit('requestSelectableSearchCatalog');
      return;
    }
    // Handlers already registered — just ensure the socket is connected so a
    // post-logout re-login reconnects with the new token.
    this._socketService.connect();
  }

  /**
   * Closes the socket connection. Leaves event handlers registered so a
   * subsequent connect() reuses them. Called from the auth subscription
   * when the token clears (logout, or external invalidation from another
   * tab) so the server-side connection is released cleanly with the
   * now-revoked token rather than relying on transport-level timeouts.
   */
  disconnect(): void {
    this._socketService.disconnect();
  }

  /** Clears transient HUD overlays when leaving match-scoped flows. */
  private _clearMatchUiOverlays(): void {
    waitingOnPlayerIdStore.set(null);
  }

  /** Builds and returns the full server-to-client socket event handler map. */
  private _buildMap(): SocketEventMap {
    const map = {} as SocketEventMap;

    map['addLogEntry'] = (logEntries: LogEntry[]) => {
      for (const logEntry of logEntries) {
        logManager.addLogEntry(logEntry);
      }
    };

    // Server-initiated forced logout: a newer socket has authenticated for
    // this user and the server is about to disconnect us. Clear only the
    // in-memory atoms (NOT localStorage) so authGuard sees the cleared
    // token on the next navigation, but the new winning tab — which
    // shares localStorage with us — does not get clobbered by a `storage`
    // event that would also bounce it to /login. The follow-up disconnect
    // event will fire after this handler returns.
    map['sessionTakenOver'] = () => {
      this._authService.clearLocalAuthState();
      void this._router.navigate(['/login']);
    };

    map['matchConfigurationUpdated'] = config => {
      matchConfigurationStore.set(config);
      this._clearMatchUiOverlays();
      // Enter configuration route when one lobby game is actively joined.
      void this._router.navigate(['/configuration']);
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

      this._clearMatchUiOverlays();
      // Reset match stores so a potential restart starts patching from a clean slate.
      // Without this, the second match's initial patchMatch is applied on top of the
      // first match's state, which can cause applyPatch to throw and silently drop the
      // patch — leaving matchStore, cardSourceStore, and derived state stale.
      matchStore.set(null);
      cardSourceStore.set({});
      cardSourceTagMapStore.set({});
      matchSummaryStore.set(summary);
      void this._router.navigate(['/game-summary']);
    };

    map['gameOwnerUpdated'] = playerId => {
      gameOwnerIdStore.set(playerId);
    };

    map['lobbySnapshot'] = games => {
      lobbyGamesStore.set(games);
      // The server only sends lobbySnapshot when the session is not in any active game
      // (i.e. the match ended or was aborted — determined server-side based on whether
      // human players remain and whether the config ends the game on no-humans).
      // This event is authoritative: clear transient match state and redirect to lobby
      // if the current route is a game-phase route (/match, /configuration, /game-summary).
      // /lobby, /profile, and /login are left untouched.
      this._clearMatchUiOverlays();
      debugRuntimeContextStore.set(undefined);
      const topLevel = '/' + (this._router.url.split('?')[0].split('/')[1] ?? '');
      if (topLevel === '/match' || topLevel === '/configuration' || topLevel === '/game-summary') {
        activeLobbyGameIdStore.set(undefined);
        void this._router.navigate(['/lobby']);
      }
    };

    map['lobbyGameUpdated'] = game => {
      const currentGames = lobbyGamesStore.get();
      const updatedGames = currentGames.filter(g => g.gameId !== game.gameId);
      updatedGames.push(game);
      updatedGames.sort((a, b) => a.gameName.localeCompare(b.gameName));
      lobbyGamesStore.set(updatedGames);
    };

    map['lobbyGameRemoved'] = gameId => {
      const currentGames = lobbyGamesStore.get();
      lobbyGamesStore.set(currentGames.filter(g => g.gameId !== gameId));
    };

    map['joinLobbyRejected'] = payload => {
      const activeGameId = activeLobbyGameIdStore.get();
      if (payload.gameId && activeGameId === payload.gameId && payload.reason !== 'alreadyInGame') {
        activeLobbyGameIdStore.set(undefined);
      }
      this._clearMatchUiOverlays();
      debugRuntimeContextStore.set(undefined);
      lobbyJoinRejectedStore.set(payload);
      lobbyStatusMessageStore.set(payload.message);
      void this._router.navigate(['/lobby']);
    };

    map['kickedFromGame'] = payload => {
      activeLobbyGameIdStore.set(undefined);
      this._clearMatchUiOverlays();
      debugRuntimeContextStore.set(undefined);
      // Returning to the lobby from the game summary is a voluntary action; suppress
      // the status banner so the lobby doesn't show a redundant "returned" message.
      const topLevel = '/' + (this._router.url.split('?')[0].split('/')[1] ?? '');
      if (topLevel !== '/game-summary') {
        lobbyStatusMessageStore.set(payload.message);
      }
      void this._router.navigate(['/lobby']);
    };

    map['bannedFromGame'] = payload => {
      activeLobbyGameIdStore.set(undefined);
      this._clearMatchUiOverlays();
      debugRuntimeContextStore.set(undefined);
      lobbyStatusMessageStore.set(payload.message);
      void this._router.navigate(['/lobby']);
    };

    map['setCardLibrary'] = cards => {
      cardStore.set(cards);
    };

    map['setTokenDefinitions'] = definitions => {
      tokenDefinitionStore.set(definitions);
    };

    map['matchReady'] = async () => {
      // Clear first-match log entries so the second match starts with an empty log.
      logEntryIdsStore.set([]);
      logStore.set({});
      // No longer in the lobby game phase once the match starts; clear so that
      // MatchConfigurationComponent.ngOnDestroy does not emit leaveLobbyGame.
      activeLobbyGameIdStore.set(undefined);
      this._clearMatchUiOverlays();
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

      const basics = cardSource['basicSupply'].reduce((prev, nextCard) => {
        const card = cardsById[nextCard];
        if (!card) return prev;

        if (card.type.includes('VICTORY')) {
          if (prev[0].includes(card.kingdom)) return prev;
          prev[0].push(card.kingdom);
          return prev;
        } else if (card.type.includes('TREASURE')) {
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

      void this._router.navigate(['/match']);
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

    map['playerConnected'] = player => {
      playerStore(player.id).set(player);
      if (!playerIdStore.get().includes(player.id)) {
        playerIdStore.set([...playerIdStore.get(), player.id]);
      }
    };

    map['setPlayerList'] = players => {
      for (const player of players) {
        playerStore(player.id).set(player);
      }
      playerIdStore.set(players.map(p => p.id));
    };

    map['playerDisconnected'] = player => {
      playerStore(player.id).set(player);
    };

    map['playerNameUpdated'] = (playerId: number, name: string) => {
      const current = playerStore(playerId).get();
      if (!current) return;
      playerStore(playerId).set({ ...current, name });
    };

    map['playerReady'] = (playerId, ready) => {
      const current = playerStore(playerId).get();
      if (!current) return;
      playerStore(playerId).set({ ...current, ready });
    };

    map['setPlayer'] = player => {
      selfPlayerIdStore.set(player.id);
    };

    // Drives Angular "waiting" HUD overlay from server wait-state events.
    map['waitingForPlayer'] = playerId => {
      waitingOnPlayerIdStore.set(playerId);
    };

    // Clears "waiting" HUD overlay when matching wait-state completes.
    map['doneWaitingForPlayer'] = playerId => {
      const currentWaitingPlayerId = waitingOnPlayerIdStore.get();
      if (playerId === undefined || currentWaitingPlayerId === playerId) {
        waitingOnPlayerIdStore.set(null);
      }
    };

    return map;
  }
}
