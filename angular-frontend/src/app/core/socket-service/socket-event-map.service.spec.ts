import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SocketEventMapService } from './socket-event-map.service';
import { SocketService } from './socket.service';

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
  navigate = jest.fn();
}

describe('SocketEventMapService', () => {
  let service: SocketEventMapService;
  let socket: SocketServiceStub;

  beforeEach(() => {
    socket = new SocketServiceStub();
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: SocketService, useValue: socket },
        { provide: Router, useValue: new RouterStub() },
      ],
    });
    service = TestBed.inject(SocketEventMapService);
  });

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
});
