import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SocketService } from './socket.service';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // App uses provideExperimentalZonelessChangeDetection; TestBed must match.
      providers: [provideExperimentalZonelessChangeDetection()],
    });
    service = TestBed.inject(SocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('connect()', () => {
    it('opens the underlying socket when not already connected', () => {
      // The constructor builds the socket with autoConnect: false, so a fresh
      // service instance starts in the disconnected state.
      const internalSocket = (service as unknown as { _socket: { connect: jest.Mock; connected: boolean } })._socket;
      const connectSpy = jest.spyOn(internalSocket, 'connect').mockImplementation(() => internalSocket as never);

      service.connect();

      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when the socket is already connected', () => {
      const internalSocket = (service as unknown as { _socket: { connect: jest.Mock; connected: boolean } })._socket;
      const connectSpy = jest.spyOn(internalSocket, 'connect').mockImplementation(() => internalSocket as never);
      // Simulate the post-handshake state.
      Object.defineProperty(internalSocket, 'connected', { value: true, configurable: true });

      service.connect();

      // Avoid redundant Socket.IO connect() calls when already connected;
      // the library would no-op anyway, but we elide the call entirely.
      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  describe('disconnect()', () => {
    it('closes the underlying socket', () => {
      const internalSocket = (service as unknown as { _socket: { disconnect: jest.Mock } })._socket;
      const disconnectSpy = jest.spyOn(internalSocket, 'disconnect').mockImplementation(() => internalSocket as never);

      service.disconnect();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });
});
