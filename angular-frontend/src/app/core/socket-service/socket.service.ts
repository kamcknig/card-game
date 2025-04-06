import { Inject, Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { v4 as uuidV4 } from 'uuid';
import { SocketEventMap, SOCKET_EVENT_MAP } from './socket-event-map';
import { ClientEmitEvents, ServerEmitEventNames, ServerListenEvents } from 'shared/shared-types';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private _socket: Socket | undefined;

  constructor(@Inject(SOCKET_EVENT_MAP) private _socketEventMap: SocketEventMap) {
    console.log('Socket service created');
    let sessionId = localStorage.getItem('sessionId') || uuidV4();

    localStorage.setItem('sessionId', sessionId);

    this._socket = io(environment.wsHost, {
      transports: ['websocket', 'polling'],
      timeout: environment.wsTimeout,
      requestTimeout: environment.wsRequestTimeout,
      query: { sessionId }
    });

    this._socket.on('connect_error', this.onConnectError);
    this._socket.on('disconnect', this.onDisconnect);

    (Object.keys(this._socketEventMap) as ServerEmitEventNames[]).forEach(eventName => {
      console.log('creating socket handler for event', eventName);
      const handler = this._socketEventMap[eventName];
      this._socket?.on(eventName, this.wrapHandler(eventName, handler));
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

  public emit<K extends keyof ClientEmitEvents>(
    eventName: K,
    ...args: Parameters<ClientEmitEvents[K]>
  ): void {
    this._socket?.emit(eventName, ...args);
  }
}
