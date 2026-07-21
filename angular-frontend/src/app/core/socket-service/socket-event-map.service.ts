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
import { gameOwnerIdStore, removalVoteStateStore, removedMatchPlayersStore } from '../../state/game-state';
import { expansionListStore } from '../../state/expansion-list-state';
import { cardStore } from '../../state/card-state';
import { tokenDefinitionStore } from '../../state/token-definition-state';
import { applyPatch, Operation } from 'fast-json-patch';
import { logManager, resetLogRenderTracking } from '../log-manager';
import { cardSourceStore, cardSourceTagMapStore } from '../../state/card-source-store';
import { basicSupplies, kingdomSupplies } from '../../state/match-logic';
import {
  activeLobbyGameIdStore,
  lobbyGamesStore,
  lobbyJoinRejectedStore,
  lobbyStatusMessageStore,
} from '../../state/lobby-state';
import { debugRuntimeContextStore } from '../../state/debug-runtime-state';
import { serverVersionStore } from '../../state/server-version-state';
import { selectableSearchCatalogStore } from '../../state/selectable-search-state';
import { waitingOnPlayerIdStore } from '../../state/match-ui-overlay-state';
import { logEntryIdsStore, logStore } from '../../state/log-state';
import { undoAvailableStore, undoCompletedSignalStore, undoInFlightStore, undoVoteRequestStore } from '../../state/undo-state';
import { SocketEventMap, SocketService } from './socket.service';
import { PromptDialogCoordinatorService } from '../prompt-dialog/prompt-dialog-coordinator.service';

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
  private readonly _promptDialogCoordinator = inject(PromptDialogCoordinatorService);

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
    removalVoteStateStore.set([]);
    removedMatchPlayersStore.set([]);
    // A prompt dialog open when the match ends or the player leaves
    // (resign, kick, ban, game over) must not survive onto the lobby or
    // summary screen. Clear without resolving — the server side of that
    // prompt is gone (or about to be), so no response should be emitted.
    this._promptDialogCoordinator.clearActivePrompt();
  }

  /** Builds and returns the full server-to-client socket event handler map. */
  private _buildMap(): SocketEventMap {
    const map = {} as SocketEventMap;

    map['addLogEntry'] = (logEntries: LogEntry[]) => {
      for (const logEntry of logEntries) {
        logManager.addLogEntry(logEntry);
      }
    };

    // Replaces the client's log state wholesale with the server-supplied history.
    // Used after an undo restore so the client log no longer shows entries from
    // actions that were rewound. Clears the stores then re-formats every entry
    // using the same path as addLogEntry so display parity is guaranteed.
    map['setLog'] = (history: LogEntry[]) => {
      logEntryIdsStore.set([]);
      logStore.set({});
      // Render-time parent tracking must restart with the replay so
      // suppression decisions match a fresh render.
      resetLogRenderTracking();
      for (const entry of history) {
        logManager.addLogEntry(entry);
      }
    };

    // Populate the server version store as soon as the server identifies
    // itself, so the scene banner and in-match version readouts have data
    // available before any feature event fires.
    map['serverHello'] = ({ version }) => {
      serverVersionStore.set(version);
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
    };

    map['joinedLobbyGame'] = (gameId, matchInProgress) => {
      // Set the store before navigating so that the noActiveMatchGuard on
      // /configuration sees activeLobbyGameIdStore populated synchronously.
      activeLobbyGameIdStore.set(gameId);
      lobbyStatusMessageStore.set(undefined);

      // Reconnecting into an already-started match: the match-scene events
      // (matchReady) own navigation to /match, and they arrive just before this
      // event. Navigating to /configuration here would tear down the match
      // scene — emitting `leftMatch` and bouncing the player out of their
      // in-progress game — so mark the match started and route to /match.
      if (matchInProgress) {
        matchStartedStore.set(true);
        void this._router.navigate(['/match']);
        return;
      }

      // Enter configuration route when a lobby game is actively joined pre-match.
      void this._router.navigate(['/configuration']);
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
      // lobbySnapshot can arrive either as a redirect signal from the server (when the
      // game ended/aborted) or as a response to requestLobbySnapshot from LobbyComponent.
      // Only clear transient game state and redirect when the client is currently on a
      // game-phase route. When already at /lobby (e.g. after pressing Back from /match),
      // the player may still be logically in an active game — do not reset matchStartedStore
      // or activeLobbyGameIdStore, as those drives the still-in-game dialog correctly.
      this._clearMatchUiOverlays();
      debugRuntimeContextStore.set(undefined);
      const topLevel = '/' + (this._router.url.split('?')[0].split('/')[1] ?? '');
      if (topLevel === '/match' || topLevel === '/configuration' || topLevel === '/game-summary') {
        activeLobbyGameIdStore.set(undefined);
        matchStartedStore.set(false);
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
      matchStartedStore.set(false);
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
      matchStartedStore.set(false);
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
      // Render-time parent tracking must restart clean so the new match's log
      // does not inherit parent subjects from the previous match's chains.
      resetLogRenderTracking();
      // activeLobbyGameIdStore is intentionally NOT cleared here. The store now
      // remains set throughout the active match phase so Phase 3 (MatchComponent
      // lifecycle) and Phase 4 (still-in-game dialog) can read it as a sentinel.
      // The auto-leave gate that used to rely on the cleared value has been moved
      // into MatchConfigurationComponent._matchStarting (see Phase 2).
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

    // Server-authoritative removal-vote snapshot; replaces client state
    // wholesale so Kick/Undo-kick buttons stay in sync across reconnects.
    map['removalVoteState'] = entries => {
      removalVoteStateStore.set(entries);
    };

    // A player was permanently removed (voted out or resigned) while the
    // disconnect dialog is relevant; recorded so the dialog can render
    // "<name> (removed)" even after setPlayerList erases them.
    map['playerRemovedFromMatch'] = payload => {
      const current = removedMatchPlayersStore.get();
      // Dedupe: re-broadcasts must not duplicate a removed row.
      if (current.some(entry => entry.playerId === payload.playerId)) return;
      removedMatchPlayersStore.set([...current, payload]);
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

    // Keeps the undo button enabled/disabled state in sync with the server
    // snapshot stack. Emitted after every top-level action and after every
    // undo restore.
    map['undoAvailable'] = (canUndo: boolean) => {
      undoAvailableStore.set(canUndo);
    };

    // Sets undoVoteRequestStore so UndoVoteCoordinatorService can mirror
    // the originator id into its local signal and show the voter dialog.
    map['undoVoteRequested'] = originatorId => {
      undoVoteRequestStore.set(originatorId);
    };

    // Clears the in-flight flag and signals components subscribed to
    // undoCompletedSignalStore. Also clears undoVoteRequestStore so any
    // open voter dialog closes even if UndoVoteCoordinatorService hasn't
    // had a chance to process the undoCompleted signal yet. The signal
    // is reset to null on the next microtask so every subscriber gets
    // exactly one delivery per outcome.
    map['undoCompleted'] = payload => {
      undoInFlightStore.set(false);
      undoVoteRequestStore.set(null);
      undoCompletedSignalStore.set(payload);
      queueMicrotask(() => undoCompletedSignalStore.set(null));
    };

    return map;
  }
}
