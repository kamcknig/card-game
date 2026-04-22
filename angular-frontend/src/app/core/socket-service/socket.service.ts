import { Injectable, signal } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { environment } from "../../../environments/environment";
import { v4 as uuidV4 } from "uuid";
import { ServerEmitEvents, ServerListenEvents } from "shared/types";
import { ClientListenEventNames, ClientListenEvents } from "../../../types";
import { ServerEmitEventNames } from "../../../types";

/** Map of server-to-client socket event names to their handler functions. */
export type SocketEventMap = Partial<{ [p in ClientListenEventNames]: ClientListenEvents[p] }>;

@Injectable({
  providedIn: "root",
})
export class SocketService {
  private _socket: Socket<ServerListenEvents, ServerEmitEvents>;
  private _socketEventMap: SocketEventMap | undefined;

  /** Reactive signal — true when the socket is connected, false when disconnected or reconnecting. */
  readonly connected = signal(false);

  constructor() {
    let sessionId = localStorage.getItem("sessionId");

    if (!sessionId) {
      sessionId = uuidV4();
    }

    localStorage.setItem("sessionId", sessionId);

    this._socket = io(environment.wsHost, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      // Defer connection until handlers are registered to avoid missing early events.
      autoConnect: false,
      timeout: environment.wsTimeout,
      requestTimeout: environment.wsRequestTimeout,
      query: { sessionId },
      // Use a callback so the token is read from localStorage at connection time,
      // not at construction time (when the user may not yet be authenticated).
      auth: (cb: (data: Record<string, string>) => void) => {
        const token = localStorage.getItem("authToken");
        cb(token ? { authToken: token } : {});
      },
    }) as unknown as Socket<ServerListenEvents, ServerEmitEvents>;

    this._socket.on("connect", this.onConnect);
    this._socket.on("connect_error", this.onConnectError);
    this._socket.on("disconnect", this.onDisconnect);
  }

  private registerMappedEvent<K extends ServerEmitEventNames>(
    eventName: K,
    handler: ServerEmitEvents[K],
  ) {
    (this._socket as unknown as Socket).on(
      eventName as string,
      (...args: unknown[]) => {
        console.debug(`[socket service] received event ${eventName}`);
        // Cast for Angular compiler; ServerEmitEvents carries tuple types, but runtime args are untyped.
        (handler as (...handlerArgs: unknown[]) => void)(...args);
      },
    );
  }

  public setEventMap(map: SocketEventMap) {
    this._socketEventMap = map;
    (Object.keys(this._socketEventMap) as ServerEmitEventNames[]).forEach(
      (eventName) => {
        const handler = this._socketEventMap![eventName];
        if (!handler) return;
        this.registerMappedEvent(eventName, handler);
      },
    );
    // Connect after handlers are wired to prevent missed rehydration events.
    if (!this._socket.connected) {
      this._socket.connect();
    }
  }

  private onConnect = () => {
    this.connected.set(true);
  };

  private onConnectError = (error: any) => {
    this.connected.set(false);
    console.warn("socket failed to connect");
    console.error(error);
  };

  private onDisconnect = () => {
    this.connected.set(false);
    console.info("socket disconnected");
  };

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

  /**
   * Returns true if the socket is currently connected to the server.
   */
  public isConnected(): boolean {
    return this._socket.connected;
  }

  /**
   * Disconnects the socket from the server.
   */
  public disconnect(): void {
    this._socket.disconnect();
  }
}
