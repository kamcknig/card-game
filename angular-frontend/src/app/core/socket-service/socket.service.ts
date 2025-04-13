import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { v4 as uuidV4 } from 'uuid';
import { SocketEventMap } from './socket-event-map';
import { ClientEmitEvents, ServerEmitEvents, ServerListenEvents } from 'shared/shared-types';
import { Container } from 'pixi.js';
import { ServerEmitEventNames } from '../../../types';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private _socket: Socket<ServerListenEvents, ServerEmitEvents>;
  private _socketEventMap: SocketEventMap | undefined

  constructor() {
    let sessionId = localStorage.getItem('sessionId');

    if (!sessionId) {
      sessionId = uuidV4();
    }

    localStorage.setItem('sessionId', sessionId);

    this._socket = io(environment.wsHost, {
      transports: ['websocket', 'polling'],
      timeout: environment.wsTimeout,
      requestTimeout: environment.wsRequestTimeout,
      query: { sessionId }
    }) as unknown as Socket<ServerListenEvents, ServerEmitEvents>;

    this._socket.on('connect_error', this.onConnectError);
    this._socket.on('disconnect', this.onDisconnect);
  }

  public setEventMap(map: SocketEventMap) {
    this._socketEventMap = map;
    (Object.keys(this._socketEventMap) as ServerEmitEventNames[]).forEach(eventName => {
      const handler = this._socketEventMap![eventName];
      if (!handler) return;
      (this._socket as unknown as Socket).on(eventName as string, handler);
    });
  }

  private onConnectError = (error: any) => {
    // todo show error screen
    console.log('socket failed to connect');
    console.error(error);
  }

  private onDisconnect = () => {
    console.log('socket disconnected');
  }

  public off<K extends keyof ServerEmitEvents>(
    eventName: K,
    handler?: (...args: Parameters<ServerEmitEvents[K]>) => void,
  ) {
    // Cast to avoid conflict with reserved events
    if (handler) {
      (this._socket as unknown as Socket).off(eventName as string, handler);
    } else {
      (this._socket as unknown as Socket).off(eventName as string);
    }
  }

  public on<K extends keyof ServerEmitEvents>(
    eventName: K,
    handler: (...args: Parameters<ServerEmitEvents[K]>) => void,
  ) {
    // Cast to avoid conflict with reserved events
    (this._socket as unknown as Socket).on(eventName as string, handler);
  }

  public emit<K extends keyof ServerListenEvents>(
    eventName: K,
    ...args: Parameters<ServerListenEvents[K]>
  ): void {
    // Bypass the incorrect type inference by SocketIO’s type declaration
    (this._socket as unknown as Socket).emit(eventName as string, ...args);
  }
}
