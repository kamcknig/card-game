import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NanostoresService } from '@nanostores/angular';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { SocketService } from '../../core/socket-service/socket.service';
import { activeLobbyGameIdStore, lobbyStatusMessageStore } from '../../state/lobby-state';
import { matchStartedStore } from '../../state/match-state';
import { LobbyComponent } from './lobby.component';

/**
 * Stub NanostoresService that skips the real subscription path and returns
 * static observables per store. Used by LobbyComponent (game stores) and
 * SceneBannerComponent (auth username store).
 */
class NanostoresServiceStub {
  useStore = jest.fn().mockImplementation(() => of(undefined));
  ngOnDestroy = () => {};
}

/**
 * Stub SocketService — LobbyComponent calls `emit` on init and on game
 * actions. Tracking the calls is sufficient for assertions.
 */
class SocketServiceStub {
  emit = jest.fn();
  disconnect = jest.fn();
}

class RouterStub {
  navigate = jest.fn().mockResolvedValue(true);
}

describe('LobbyComponent', () => {
  let component: LobbyComponent;
  let fixture: ComponentFixture<LobbyComponent>;
  let socketStub: SocketServiceStub;
  let routerStub: RouterStub;

  beforeEach(async () => {
    socketStub = new SocketServiceStub();
    routerStub = new RouterStub();

    await TestBed.configureTestingModule({
      imports: [LobbyComponent],
      providers: [
        // App uses provideZonelessChangeDetection; TestBed must match.
        provideZonelessChangeDetection(),
        { provide: NanostoresService, useClass: NanostoresServiceStub },
        { provide: SocketService, useValue: socketStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Reset stores between tests so still-in-game dialog assertions start
    // from a clean slate. The component reads these via .get() in _attempt
    // and onStillInGameLeave, not via NanostoresService streams.
    activeLobbyGameIdStore.set(undefined);
    matchStartedStore.set(false);
    lobbyStatusMessageStore.set(undefined);
    socketStub.emit.mockClear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit requests a lobby snapshot', () => {
    // LobbyComponent calls emit('requestLobbySnapshot') at init — the
    // beforeEach detectChanges() already triggered it, but it was cleared
    // in the per-test reset. Recreating the component re-emits it.
    const fresh = TestBed.createComponent(LobbyComponent);
    fresh.detectChanges();
    expect(socketStub.emit).toHaveBeenCalledWith('requestLobbySnapshot');
  });

  describe('createGame() / joinGame()', () => {
    it('emits createLobbyGame directly when not attached to any game', () => {
      activeLobbyGameIdStore.set(undefined);

      component.createGame();

      expect(socketStub.emit).toHaveBeenCalledWith('createLobbyGame');
      expect(component.showStillInGameDialog()).toBe(false);
    });

    it('emits joinLobbyGame directly when not attached to any game', () => {
      activeLobbyGameIdStore.set(undefined);

      component.joinGame('game-42');

      expect(socketStub.emit).toHaveBeenCalledWith('joinLobbyGame', 'game-42');
      expect(component.showStillInGameDialog()).toBe(false);
    });

    it('opens the still-in-game dialog instead of emitting when already attached to a game', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);

      component.createGame();

      // Dialog opens and the create event is deferred until the user picks
      // an action (leave / return / cancel).
      expect(component.showStillInGameDialog()).toBe(true);
      expect(component.stillInGameMatchStarted()).toBe(true);
      expect(socketStub.emit).not.toHaveBeenCalled();
    });

    it('captures match-not-started state on the dialog when in lobby phase', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(false);

      component.joinGame('game-2');

      expect(component.showStillInGameDialog()).toBe(true);
      // Drives the leave-event branch (leaveLobbyGame vs resignMatch) and
      // the return-target route (/configuration vs /match).
      expect(component.stillInGameMatchStarted()).toBe(false);
    });
  });

  describe('onStillInGameLeave()', () => {
    it('emits resignMatch then the original create intent for an active match', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      component.createGame();
      socketStub.emit.mockClear();

      component.onStillInGameLeave();

      // FIFO ordering: leave first, then the deferred create. The server
      // processes resignMatch before createLobbyGame and so the new game
      // is created cleanly without a "still in game" reject.
      expect(socketStub.emit.mock.calls).toEqual([
        ['resignMatch'],
        ['createLobbyGame'],
      ]);
    });

    it('emits leaveLobbyGame then the original join intent in lobby phase', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(false);
      component.joinGame('game-2');
      socketStub.emit.mockClear();

      component.onStillInGameLeave();

      expect(socketStub.emit.mock.calls).toEqual([
        ['leaveLobbyGame', 'game-1'],
        ['joinLobbyGame', 'game-2'],
      ]);
    });

    it('clears local match state up front so noActiveMatchGuard does not bounce the new-game navigation', () => {
      // Without this up-front clear, the joinedLobbyGame response from the
      // server would race with kickedFromGame and the guard for /configuration
      // would still see matchStartedStore=true, redirecting back to /lobby.
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      lobbyStatusMessageStore.set('previous error');
      component.createGame();

      component.onStillInGameLeave();

      expect(activeLobbyGameIdStore.get()).toBeUndefined();
      expect(matchStartedStore.get()).toBe(false);
      expect(lobbyStatusMessageStore.get()).toBeUndefined();
    });

    it('dismisses the dialog and discards the pending intent', () => {
      activeLobbyGameIdStore.set('game-1');
      component.createGame();

      component.onStillInGameLeave();

      expect(component.showStillInGameDialog()).toBe(false);
    });

    it('is a no-op when no active game id is present', () => {
      // Defensive guard: if activeLobbyGameIdStore was cleared between the
      // dialog opening and the user clicking Leave, do nothing rather than
      // emitting a leave for an undefined game id.
      activeLobbyGameIdStore.set(undefined);
      component.onStillInGameLeave();

      expect(socketStub.emit).not.toHaveBeenCalled();
    });
  });

  describe('onStillInGameReturn()', () => {
    it('navigates to /match when returning to an active match', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      component.createGame();

      component.onStillInGameReturn();

      expect(routerStub.navigate).toHaveBeenCalledWith(['/match']);
      expect(component.showStillInGameDialog()).toBe(false);
    });

    it('navigates to /configuration when returning during the lobby phase', () => {
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(false);
      component.createGame();

      component.onStillInGameReturn();

      expect(routerStub.navigate).toHaveBeenCalledWith(['/configuration']);
      expect(component.showStillInGameDialog()).toBe(false);
    });

    it('does not emit any socket traffic', () => {
      activeLobbyGameIdStore.set('game-1');
      component.createGame();
      socketStub.emit.mockClear();

      component.onStillInGameReturn();

      expect(socketStub.emit).not.toHaveBeenCalled();
    });
  });

  describe('onStillInGameCancel()', () => {
    it('dismisses the dialog without emitting or navigating', () => {
      activeLobbyGameIdStore.set('game-1');
      component.createGame();
      socketStub.emit.mockClear();

      component.onStillInGameCancel();

      expect(component.showStillInGameDialog()).toBe(false);
      expect(socketStub.emit).not.toHaveBeenCalled();
      expect(routerStub.navigate).not.toHaveBeenCalled();
    });

    it('preserves the active game id so the user remains attached', () => {
      // Cancel must not trigger any leave-game side effects — the user
      // intends to stay attached to the existing game.
      activeLobbyGameIdStore.set('game-1');
      matchStartedStore.set(true);
      component.createGame();

      component.onStillInGameCancel();

      expect(activeLobbyGameIdStore.get()).toBe('game-1');
      expect(matchStartedStore.get()).toBe(true);
    });
  });
});
