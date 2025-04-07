import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { v4 as uuidV4 } from 'uuid';
import { SocketEventMap } from './socket-event-map';
import { ClientEmitEvents, ServerEmitEventNames, ServerEmitEvents, ServerListenEvents } from 'shared/shared-types';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private _socket: Socket<ServerListenEvents, ServerEmitEvents>;
  private _socketEventMap: SocketEventMap | undefined

  constructor() {
    console.log('Socket service created');
    let sessionId = localStorage.getItem('sessionId') || uuidV4();

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
      console.log('creating socket handler for event', eventName);
      const handler = this._socketEventMap![eventName];
      (this._socket as unknown as Socket).on(eventName as string, this.wrapHandler(eventName, handler));
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

  private wrapHandler = <F extends (this: null, ...args: any[]) => any>(
    eventName: string,
    handler: F
  ): F => {
    const wrapped = function (this: null, ...args: Parameters<F>): ReturnType<F> {
      console.log(`Socket event '${eventName}' invoked with arguments:`);
      for (const arg of args) {
        console.log(JSON.parse(JSON.stringify(arg)));
      }
      return handler.apply(null, args);
    };
    // First cast to unknown, then to F.
    return wrapped as unknown as F;
  };

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
