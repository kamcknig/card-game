import { Injectable, OnInit } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import * as crypto from 'node:crypto';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnInit {
  private _socket: Socket | undefined;

  constructor() {

  }

  ngOnInit(): void {
    const sessionId = localStorage.getItem('sessionId') || crypto.randomUUID();

    localStorage.setItem(sessionId, sessionId);

    this._socket = io(environment.wsHost, {
      transports: ['websocket', 'polling'],
      timeout: environment.wsTimeout,
      requestTimeout: environment.wsRequestTimeout,
      query: { sessionId }
    });

    this._socket.on('connect_error', this.onConnectError);
    this._socket.on('disconnect', this.onDisconnect);
  }

  private onConnectError = (error: any) => {
    console.log('socket failed to connect');
    console.error(error);
  }

  private onDisconnect = () => {
    console.log('socket disconnected');
  }
}
