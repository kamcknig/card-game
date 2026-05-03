import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { activeLobbyGameIdStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { matchStartedStore } from '../../state/match-state';
import { SocketEventMapService } from './socket-event-map.service';
import { SocketService, SocketEventMap } from './socket.service';

/**
 * Lightweight stand-in for SocketService. Only the methods that
 * SocketEventMapService touches are stubbed; everything else is left
 * unset so accidental calls fail loudly.
 */
class SocketServiceStub {
  setEventMap = jest.fn();
  emit = jest.fn();
  connect = jest.fn();
  disconnect = jest.fn();
  isConnected = jest.fn().mockReturnValue(false);
}

class RouterStub {
  navigate = jest.fn().mockResolvedValue(true);
  url = '/lobby';
}

class AuthServiceStub {
  clearAuth = jest.fn();
  clearLocalAuthState = jest.fn();
}

describe('SocketEventMapService', () => {
  let service: SocketEventMapService;
  let socket: SocketServiceStub;
  let router: RouterStub;
  let auth: AuthServiceStub;

  beforeEach(() => {
    socket = new SocketServiceStub();
    router = new RouterStub();
    auth = new AuthServiceStub();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SocketService, useValue: socket },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(SocketEventMapService);

    // Reset shared stores so each test observes only its own writes. These
    // are nanostores atoms exposed at module scope and persist across tests
    // in the same file; without resetting, expectations on .get() leak.
    activeLobbyGameIdStore.set(undefined);
    matchStartedStore.set(false);
    lobbyStatusMessageStore.set(undefined);
  });

  /**
   * Helper that triggers a connect() to register handlers, captures the
   * map passed to SocketService.setEventMap, and returns it so a test can
   * invoke a specific handler directly. The real SocketService dispatches
   * server events through this map; the stub just records it.
   */
  const captureEventMap = (): SocketEventMap => {
    service.connect();
    expect(socket.setEventMap).toHaveBeenCalledTimes(1);
    return socket.setEventMap.mock.calls[0][0] as SocketEventMap;
  };

  describe('connect()', () => {
    it('registers the event map and emits the catalog warmup on the first call', () => {
      service.connect();

      // setEventMap is the one-shot handler-registration step. Calling it
      // twice would result in every server event firing N times — the bug
      // this service guards against via _handlersRegistered.
      expect(socket.setEventMap).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('requestSelectableSearchCatalog');
      // The first call uses setEventMap's internal connect() path, so the
      // public connect() on SocketService is not invoked yet.
      expect(socket.connect).not.toHaveBeenCalled();
    });

    it('does not re-register handlers on subsequent calls', () => {
      service.connect();
      service.connect();
      service.connect();

      // Handler registration must remain one-shot regardless of how many
      // times callers re-invoke connect() (e.g. after a logout/re-login
      // cycle in the same tab).
      expect(socket.setEventMap).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledTimes(1);
    });

    it('delegates to SocketService.connect() on subsequent calls', () => {
      // First call registers handlers via setEventMap; subsequent calls
      // must delegate to SocketService.connect() so the auth callback can
      // re-read the (newly issued) token from localStorage and the socket
      // reconnects after a logout/re-login cycle. The "skip when already
      // connected" decision lives inside SocketService.connect() — it is
      // covered in that service's spec.
      service.connect();
      service.connect();

      expect(socket.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('sessionTakenOver handler', () => {
    it('clears in-memory auth atoms (not localStorage) when the server kicks this tab', () => {
      const map = captureEventMap();
      const handler = map['sessionTakenOver'];
      expect(handler).toBeDefined();

      handler!();

      // Crucial: the kicked tab must NOT call clearAuth() (which writes
      // to localStorage). localStorage is shared with the new winning
      // tab; a write here would fire a `storage` event there and bounce
      // it to /login too. clearLocalAuthState() is the in-memory-only
      // variant designed for this path.
      expect(auth.clearLocalAuthState).toHaveBeenCalledTimes(1);
      expect(auth.clearAuth).not.toHaveBeenCalled();
    });

    it('redirects the kicked tab to /login', () => {
      const map = captureEventMap();
      map['sessionTakenOver']!();

      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('disconnect()', () => {
    it('delegates to SocketService.disconnect()', () => {
      service.disconnect();

      expect(socket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('leaves handler registration intact so a follow-up connect() reuses it', () => {
      service.connect();
      service.disconnect();
      // After a disconnect, isConnected should report false; emulate that.
      socket.isConnected.mockReturnValue(false);

      service.connect();

      // Handlers were registered exactly once across the connect/disconnect/
      // re-connect cycle — the second connect() only reopens the socket.
      expect(socket.setEventMap).toHaveBeenCalledTimes(1);
      expect(socket.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('joinedLobbyGame handler', () => {
    it('sets activeLobbyGameIdStore before navigating so noActiveMatchGuard sees it', () => {
      // The store must be populated synchronously before the navigate call
      // so the /configuration guard reads the new gameId on the next tick.
      // Setting it after navigate() would race against the guard.
      const map = captureEventMap();

      map['joinedLobbyGame']!('game-7');

      expect(activeLobbyGameIdStore.get()).toBe('game-7');
      expect(router.navigate).toHaveBeenCalledWith(['/configuration']);
      // Also clears any leftover lobby status so a previous "kicked"/"resigned"
      // banner doesn't linger over the configuration screen.
      expect(lobbyStatusMessageStore.get()).toBeUndefined();
    });
  });

  describe('lobbySnapshot handler', () => {
    it('does not reset matchStartedStore or activeLobbyGameIdStore when at /lobby', () => {
      // Player pressed Back from /match and arrived at /lobby; ngOnInit
      // emits requestLobbySnapshot. The response must NOT clobber the
      // active-match state, otherwise the still-in-game dialog captures
      // the wrong leave path.
      router.url = '/lobby';
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      const map = captureEventMap();

      map['lobbySnapshot']!([]);

      expect(activeLobbyGameIdStore.get()).toBe('game-1');
      expect(matchStartedStore.get()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('clears match state and redirects to /lobby when received from /match', () => {
      router.url = '/match';
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      const map = captureEventMap();

      map['lobbySnapshot']!([]);

      expect(activeLobbyGameIdStore.get()).toBeUndefined();
      expect(matchStartedStore.get()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/lobby']);
    });

    it('clears match state and redirects when received from /configuration', () => {
      router.url = '/configuration';
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(false);
      const map = captureEventMap();

      map['lobbySnapshot']!([]);

      expect(activeLobbyGameIdStore.get()).toBeUndefined();
      expect(router.navigate).toHaveBeenCalledWith(['/lobby']);
    });

    it('clears match state and redirects when received from /game-summary', () => {
      router.url = '/game-summary';
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      const map = captureEventMap();

      map['lobbySnapshot']!([]);

      expect(activeLobbyGameIdStore.get()).toBeUndefined();
      expect(matchStartedStore.get()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/lobby']);
    });
  });

  describe('kickedFromGame handler', () => {
    it('clears activeLobbyGameIdStore and matchStartedStore', () => {
      // Required so a subsequent Create Game does not re-show the
      // still-in-game dialog with stale active-match state.
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      const map = captureEventMap();

      map['kickedFromGame']!({ gameId: 'game-1', message: 'You were kicked.' });

      expect(activeLobbyGameIdStore.get()).toBeUndefined();
      expect(matchStartedStore.get()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/lobby']);
    });

    it('surfaces the server message in the lobby banner outside /game-summary', () => {
      router.url = '/match';
      const map = captureEventMap();

      map['kickedFromGame']!({ gameId: 'game-1', message: 'kicked by host' });

      expect(lobbyStatusMessageStore.get()).toBe('kicked by host');
    });

    it('suppresses the lobby banner when returning voluntarily from /game-summary', () => {
      // Returning to lobby from the game summary is a voluntary action,
      // not a kick — the banner would be a redundant "you returned" notice.
      router.url = '/game-summary';
      const map = captureEventMap();

      map['kickedFromGame']!({ gameId: 'game-1', message: 'You returned to the lobby.' });

      expect(lobbyStatusMessageStore.get()).toBeUndefined();
    });
  });

  describe('bannedFromGame handler', () => {
    it('clears activeLobbyGameIdStore and matchStartedStore', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      const map = captureEventMap();

      map['bannedFromGame']!({ gameId: 'game-1', message: 'banned' });

      expect(activeLobbyGameIdStore.get()).toBeUndefined();
      expect(matchStartedStore.get()).toBe(false);
      expect(lobbyStatusMessageStore.get()).toBe('banned');
      expect(router.navigate).toHaveBeenCalledWith(['/lobby']);
    });
  });
});
