import { Server as Engine } from "../../engine.io/mod.ts";
import { EventEmitter } from "../../event-emitter/mod.ts";
import { getLogger } from "../../../deps.ts";
import { Client } from "./client.ts";
import { Decoder, Encoder } from "../../socket.io-parser/mod.ts";
import { Namespace } from "./namespace.ts";
import { ParentNamespace } from "./parent-namespace.ts";
import { InMemoryAdapter } from "./adapter.ts";
/**
 * Represents a Socket.IO server.
 *
 * @example
 * import { Server } from "https://deno.land/x/socket_io@x.y.z/mod.ts";
 *
 * const io = new Server();
 *
 * io.on("connection", (socket) => {
 *   console.log(`socket ${socket.id} connected`);
 *
 *   // send an event to the client
 *   socket.emit("foo", "bar");
 *
 *   socket.on("foobar", () => {
 *     // an event was received from the client
 *   });
 *
 *   // upon disconnection
 *   socket.on("disconnect", (reason) => {
 *     console.log(`socket ${socket.id} disconnected due to ${reason}`);
 *   });
 * });
 *
 * Deno.serve({
 *   handler: io.handler(),
 *   port: 3000,
 * });
 */ export class Server extends EventEmitter {
  engine;
  mainNamespace;
  opts;
  /* private */ _encoder;
  /* private */ _nsps = new Map();
  parentNsps = new Map();
  constructor(opts = {}){
    super();
    this.opts = Object.assign({
      path: "/socket.io/",
      connectTimeout: 45_000,
      parser: {
        createEncoder () {
          return new Encoder();
        },
        createDecoder () {
          return new Decoder();
        }
      },
      adapter: (nsp)=>new InMemoryAdapter(nsp)
    }, opts);
    this.engine = new Engine(this.opts);
    this.engine.on("connection", (conn, req, connInfo)=>{
      getLogger("socket.io").debug(`[server] incoming connection with id ${conn.id}`);
      new Client(this, this.opts.parser.createDecoder(), conn, req, connInfo);
    });
    this._encoder = this.opts.parser.createEncoder();
    const mainNamespace = this.of("/");
    [
      "on",
      "once",
      "off",
      "listeners"
    ].forEach((method)=>{
      // @ts-ignore FIXME proper typing
      this[method] = function() {
        // @ts-ignore FIXME proper typing
        return mainNamespace[method].apply(mainNamespace, arguments);
      };
    });
    this.mainNamespace = mainNamespace;
  }
  /**
   * Returns a request handler.
   *
   * @example
   * import { Server } from "https://deno.land/x/socket_io@x.y.z/mod.ts";
   *
   * const io = new Server();
   *
   * Deno.serve({
   *   handler: io.handler(),
   *   port: 3000,
   * });
   *
   * @param additionalHandler - another handler which will receive the request if the path does not match
   */ handler(additionalHandler) {
    return this.engine.handler(additionalHandler);
  }
  /**
   * Executes the middleware for an incoming namespace not already created on the server.
   *
   * @param name - name of incoming namespace
   * @param auth - the auth parameters
   * @param fn - callback
   *
   * @private
   */ /* private */ async _checkNamespace(name, auth) {
    if (this.parentNsps.size === 0) return Promise.reject();
    for (const [isValid, parentNsp] of this.parentNsps){
      try {
        await isValid(name, auth);
      } catch (_) {
        continue;
      }
      if (this._nsps.has(name)) {
        // the namespace was created in the meantime
        getLogger("socket.io").debug(`[server] dynamic namespace ${name} already exists`);
      } else {
        const namespace = parentNsp._createChild(name);
        getLogger("socket.io").debug(`[server] dynamic namespace ${name} was created`);
        this.emitReserved("new_namespace", namespace);
      }
      return Promise.resolve();
    }
    return Promise.reject();
  }
  /**
   * Looks up a namespace.
   *
   * @example
   * // with a simple string
   * const myNamespace = io.of("/my-namespace");
   *
   * // with a regex
   * const dynamicNsp = io.of(/^\/dynamic-\d+$/).on("connection", (socket) => {
   *   const namespace = socket.nsp; // newNamespace.name === "/dynamic-101"
   *
   *   // broadcast to all clients in the given sub-namespace
   *   namespace.emit("hello");
   * });
   *
   * @param name - nsp name
   */ of(name) {
    if (typeof name === "function" || name instanceof RegExp) {
      const parentNsp = new ParentNamespace(this);
      getLogger("socket.io").debug(`[server] initializing parent namespace ${parentNsp.name}`);
      if (typeof name === "function") {
        this.parentNsps.set(name, parentNsp);
      } else {
        this.parentNsps.set((nsp)=>name.test(nsp) ? Promise.resolve() : Promise.reject(), parentNsp);
      }
      return parentNsp;
    }
    if (String(name)[0] !== "/") name = "/" + name;
    let nsp = this._nsps.get(name);
    if (!nsp) {
      getLogger("socket.io").debug(`[server] initializing namespace ${name}`);
      nsp = new Namespace(this, name);
      this._nsps.set(name, nsp);
      if (name !== "/") {
        this.emitReserved("new_namespace", nsp);
      }
    }
    return nsp;
  }
  /**
   * Closes the server.
   *
   * @example
   * import { Server } from "https://deno.land/x/socket_io@x.y.z/mod.ts";
   *
   * const io = new Server();
   * const abortController = new AbortController();
   *
   * Deno.serve({
   *   handler: io.handler(),
   *   port: 3000,
   *   signal: abortController.signal,
   *   onListen: () => {
   *     setTimeout(() => {
   *       // close the HTTP server
   *       abortController.abort();
   *       // close the Socket.IO server
   *       io.close();
   *     }, 10000);
   *   }
   * });
   */ close() {
    this.engine.close();
  }
  /**
   * Registers a middleware, which is a function that gets executed for every incoming {@link Socket}.
   *
   * @example
   * io.use(async (socket) => {
   *   // ...
   * });
   *
   * @param fn - the middleware function
   */ use(fn) {
    this.mainNamespace.use(fn);
    return this;
  }
  /**
   * Targets a room when emitting.
   *
   * @example
   * // the “foo” event will be broadcast to all connected clients in the “room-101” room
   * io.to("room-101").emit("foo", "bar");
   *
   * // with an array of rooms (a client will be notified at most once)
   * io.to(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * io.to("room-101").to("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ to(room) {
    return this.mainNamespace.to(room);
  }
  /**
   * Targets a room when emitting. Similar to `to()`, but might feel clearer in some cases:
   *
   * @example
   * // disconnect all clients in the "room-101" room
   * io.in("room-101").disconnectSockets();
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ in(room) {
    return this.mainNamespace.in(room);
  }
  /**
   * Excludes a room when emitting.
   *
   * @example
   * // the "foo" event will be broadcast to all connected clients, except the ones that are in the "room-101" room
   * io.except("room-101").emit("foo", "bar");
   *
   * // with an array of rooms
   * io.except(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * io.except("room-101").except("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ except(room) {
    return this.mainNamespace.except(room);
  }
  /**
   * Emits to all connected clients.
   *
   * @example
   * io.emit("hello", "world");
   *
   * // all serializable datastructures are supported (no need to call JSON.stringify)
   * io.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
   *
   * // with an acknowledgement from the clients
   * io.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @return Always true
   */ emit(ev, ...args) {
    return this.mainNamespace.emit(ev, ...args);
  }
  /**
   * Sends a `message` event to all clients.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * io.send("hello");
   *
   * // this is equivalent to
   * io.emit("message", "hello");
   *
   * @return self
   */ send(...args) {
    this.mainNamespace.emit("message", ...args);
    return this;
  }
  /**
   * Sends a message to the other Socket.IO servers of the cluster.
   *
   * @example
   * io.serverSideEmit("hello", "world");
   *
   * io.on("hello", (arg1) => {
   *   console.log(arg1); // prints "world"
   * });
   *
   * // acknowledgements (without binary content) are supported too:
   * io.serverSideEmit("ping", (err, responses) => {
   *  if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * io.on("ping", (cb) => {
   *   cb("pong");
   * });
   *
   * @param ev - the event name
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   */ serverSideEmit(ev, ...args) {
    return this.mainNamespace.serverSideEmit(ev, ...args);
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @example
   * io.volatile.emit("hello"); // the clients may or may not receive it
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */ get volatile() {
    return this.mainNamespace.volatile;
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @example
   * // the “foo” event will be broadcast to all connected clients on this node
   * io.local.emit("foo", "bar");
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */ get local() {
    return this.mainNamespace.local;
  }
  /**
   * Adds a timeout in milliseconds for the next operation.
   *
   * @example
   * io.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @param timeout
   */ timeout(timeout) {
    return this.mainNamespace.timeout(timeout);
  }
  /**
   * Returns the matching socket instances.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * // return all Socket instances
   * const sockets = await io.fetchSockets();
   *
   * // return all Socket instances in the "room1" room
   * const sockets = await io.in("room1").fetchSockets();
   *
   * for (const socket of sockets) {
   *   console.log(socket.id);
   *   console.log(socket.handshake);
   *   console.log(socket.rooms);
   *   console.log(socket.data);
   *
   *   socket.emit("hello");
   *   socket.join("room1");
   *   socket.leave("room2");
   *   socket.disconnect();
   * }
   */ fetchSockets() {
    return this.mainNamespace.fetchSockets();
  }
  /**
   * Makes the matching socket instances join the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   *
   * // make all socket instances join the "room1" room
   * io.socketsJoin("room1");
   *
   * // make all socket instances in the "room1" room join the "room2" and "room3" rooms
   * io.in("room1").socketsJoin(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */ socketsJoin(room) {
    return this.mainNamespace.socketsJoin(room);
  }
  /**
   * Makes the matching socket instances leave the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * // make all socket instances leave the "room1" room
   * io.socketsLeave("room1");
   *
   * // make all socket instances in the "room1" room leave the "room2" and "room3" rooms
   * io.in("room1").socketsLeave(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */ socketsLeave(room) {
    return this.mainNamespace.socketsLeave(room);
  }
  /**
   * Makes the matching socket instances disconnect.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * // make all socket instances disconnect (the connections might be kept alive for other namespaces)
   * io.disconnectSockets();
   *
   * // make all socket instances in the "room1" room disconnect and close the underlying connections
   * io.in("room1").disconnectSockets(true);
   *
   * @param close - whether to close the underlying connection
   */ disconnectSockets(close = false) {
    return this.mainNamespace.disconnectSockets(close);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL3NvY2tldC5pby9saWIvc2VydmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIFNlcnZlciBhcyBFbmdpbmUsXG4gIFNlcnZlck9wdGlvbnMgYXMgRW5naW5lT3B0aW9ucyxcbn0gZnJvbSBcIi4uLy4uL2VuZ2luZS5pby9tb2QudHNcIjtcbmltcG9ydCB7XG4gIERlZmF1bHRFdmVudHNNYXAsXG4gIEV2ZW50RW1pdHRlcixcbiAgRXZlbnROYW1lcyxcbiAgRXZlbnRQYXJhbXMsXG4gIEV2ZW50c01hcCxcbn0gZnJvbSBcIi4uLy4uL2V2ZW50LWVtaXR0ZXIvbW9kLnRzXCI7XG5pbXBvcnQgeyBnZXRMb2dnZXIgfSBmcm9tIFwiLi4vLi4vLi4vZGVwcy50c1wiO1xuaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4vY2xpZW50LnRzXCI7XG5pbXBvcnQgeyBEZWNvZGVyLCBFbmNvZGVyIH0gZnJvbSBcIi4uLy4uL3NvY2tldC5pby1wYXJzZXIvbW9kLnRzXCI7XG5pbXBvcnQgeyBOYW1lc3BhY2UsIE5hbWVzcGFjZVJlc2VydmVkRXZlbnRzIH0gZnJvbSBcIi4vbmFtZXNwYWNlLnRzXCI7XG5pbXBvcnQgeyBQYXJlbnROYW1lc3BhY2UgfSBmcm9tIFwiLi9wYXJlbnQtbmFtZXNwYWNlLnRzXCI7XG5pbXBvcnQgeyBTb2NrZXQgfSBmcm9tIFwiLi9zb2NrZXQudHNcIjtcbmltcG9ydCB7IEFkYXB0ZXIsIEluTWVtb3J5QWRhcHRlciwgUm9vbSB9IGZyb20gXCIuL2FkYXB0ZXIudHNcIjtcbmltcG9ydCB7IEJyb2FkY2FzdE9wZXJhdG9yLCBSZW1vdGVTb2NrZXQgfSBmcm9tIFwiLi9icm9hZGNhc3Qtb3BlcmF0b3IudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTZXJ2ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIHJlcXVlc3QgcGF0aCB0byBoYW5kbGVcbiAgICogQGRlZmF1bHQgXCIvc29ja2V0LmlvL1wiXG4gICAqL1xuICBwYXRoOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBEdXJhdGlvbiBpbiBtaWxsaXNlY29uZHMgYmVmb3JlIGEgY2xpZW50IHdpdGhvdXQgbmFtZXNwYWNlIGlzIGNsb3NlZFxuICAgKiBAZGVmYXVsdCA0NTAwMFxuICAgKi9cbiAgY29ubmVjdFRpbWVvdXQ6IG51bWJlcjtcbiAgLyoqXG4gICAqIFRoZSBwYXJzZXIgdG8gdXNlIHRvIGVuY29kZSBhbmQgZGVjb2RlIHBhY2tldHNcbiAgICovXG4gIHBhcnNlcjoge1xuICAgIGNyZWF0ZUVuY29kZXIoKTogRW5jb2RlcjtcbiAgICBjcmVhdGVEZWNvZGVyKCk6IERlY29kZXI7XG4gIH07XG4gIC8qKlxuICAgKiBUaGUgYWRhcHRlciB0byB1c2UgdG8gZm9yd2FyZCBwYWNrZXRzIGJldHdlZW4gc2V2ZXJhbCBTb2NrZXQuSU8gc2VydmVyc1xuICAgKi9cbiAgYWRhcHRlcjogKFxuICAgIG5zcDogTmFtZXNwYWNlLFxuICApID0+IEFkYXB0ZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VydmVyUmVzZXJ2ZWRFdmVudHM8XG4gIExpc3RlbkV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCxcbiAgRW1pdEV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCxcbiAgU2VydmVyU2lkZUV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCxcbiAgU29ja2V0RGF0YSxcbj4gZXh0ZW5kc1xuICBOYW1lc3BhY2VSZXNlcnZlZEV2ZW50czxcbiAgICBMaXN0ZW5FdmVudHMsXG4gICAgRW1pdEV2ZW50cyxcbiAgICBTZXJ2ZXJTaWRlRXZlbnRzLFxuICAgIFNvY2tldERhdGFcbiAgPiB7XG4gIG5ld19uYW1lc3BhY2U6IChcbiAgICBuYW1lc3BhY2U6IE5hbWVzcGFjZTxcbiAgICAgIExpc3RlbkV2ZW50cyxcbiAgICAgIEVtaXRFdmVudHMsXG4gICAgICBTZXJ2ZXJTaWRlRXZlbnRzLFxuICAgICAgU29ja2V0RGF0YVxuICAgID4sXG4gICkgPT4gdm9pZDtcbn1cblxudHlwZSBQYXJlbnROc3BOYW1lTWF0Y2hGbiA9IChcbiAgbmFtZTogc3RyaW5nLFxuICBhdXRoOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbikgPT4gUHJvbWlzZTx2b2lkPjtcblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgU29ja2V0LklPIHNlcnZlci5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgU2VydmVyIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQHgueS56L21vZC50c1wiO1xuICpcbiAqIGNvbnN0IGlvID0gbmV3IFNlcnZlcigpO1xuICpcbiAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gKiAgIGNvbnNvbGUubG9nKGBzb2NrZXQgJHtzb2NrZXQuaWR9IGNvbm5lY3RlZGApO1xuICpcbiAqICAgLy8gc2VuZCBhbiBldmVudCB0byB0aGUgY2xpZW50XG4gKiAgIHNvY2tldC5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICpcbiAqICAgc29ja2V0Lm9uKFwiZm9vYmFyXCIsICgpID0+IHtcbiAqICAgICAvLyBhbiBldmVudCB3YXMgcmVjZWl2ZWQgZnJvbSB0aGUgY2xpZW50XG4gKiAgIH0pO1xuICpcbiAqICAgLy8gdXBvbiBkaXNjb25uZWN0aW9uXG4gKiAgIHNvY2tldC5vbihcImRpc2Nvbm5lY3RcIiwgKHJlYXNvbikgPT4ge1xuICogICAgIGNvbnNvbGUubG9nKGBzb2NrZXQgJHtzb2NrZXQuaWR9IGRpc2Nvbm5lY3RlZCBkdWUgdG8gJHtyZWFzb259YCk7XG4gKiAgIH0pO1xuICogfSk7XG4gKlxuICogRGVuby5zZXJ2ZSh7XG4gKiAgIGhhbmRsZXI6IGlvLmhhbmRsZXIoKSxcbiAqICAgcG9ydDogMzAwMCxcbiAqIH0pO1xuICovXG5leHBvcnQgY2xhc3MgU2VydmVyPFxuICBMaXN0ZW5FdmVudHMgZXh0ZW5kcyBFdmVudHNNYXAgPSBEZWZhdWx0RXZlbnRzTWFwLFxuICBFbWl0RXZlbnRzIGV4dGVuZHMgRXZlbnRzTWFwID0gTGlzdGVuRXZlbnRzLFxuICBTZXJ2ZXJTaWRlRXZlbnRzIGV4dGVuZHMgRXZlbnRzTWFwID0gRGVmYXVsdEV2ZW50c01hcCxcbiAgU29ja2V0RGF0YSA9IHVua25vd24sXG4+IGV4dGVuZHMgRXZlbnRFbWl0dGVyPFxuICBMaXN0ZW5FdmVudHMsXG4gIEVtaXRFdmVudHMsXG4gIFNlcnZlclJlc2VydmVkRXZlbnRzPFxuICAgIExpc3RlbkV2ZW50cyxcbiAgICBFbWl0RXZlbnRzLFxuICAgIFNlcnZlclNpZGVFdmVudHMsXG4gICAgU29ja2V0RGF0YVxuICA+XG4+IHtcbiAgcHVibGljIHJlYWRvbmx5IGVuZ2luZTogRW5naW5lO1xuICBwdWJsaWMgcmVhZG9ubHkgbWFpbk5hbWVzcGFjZTogTmFtZXNwYWNlPFxuICAgIExpc3RlbkV2ZW50cyxcbiAgICBFbWl0RXZlbnRzLFxuICAgIFNlcnZlclNpZGVFdmVudHMsXG4gICAgU29ja2V0RGF0YVxuICA+O1xuICBwdWJsaWMgcmVhZG9ubHkgb3B0czogU2VydmVyT3B0aW9ucztcblxuICAvKiBwcml2YXRlICovIHJlYWRvbmx5IF9lbmNvZGVyOiBFbmNvZGVyO1xuXG4gIC8qIHByaXZhdGUgKi8gX25zcHM6IE1hcDxcbiAgICBzdHJpbmcsXG4gICAgTmFtZXNwYWNlPExpc3RlbkV2ZW50cywgRW1pdEV2ZW50cywgU2VydmVyU2lkZUV2ZW50cywgU29ja2V0RGF0YT5cbiAgPiA9IG5ldyBNYXAoKTtcblxuICBwcml2YXRlIHBhcmVudE5zcHM6IE1hcDxcbiAgICBQYXJlbnROc3BOYW1lTWF0Y2hGbixcbiAgICBQYXJlbnROYW1lc3BhY2U8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPlxuICA+ID0gbmV3IE1hcCgpO1xuXG4gIGNvbnN0cnVjdG9yKG9wdHM6IFBhcnRpYWw8U2VydmVyT3B0aW9ucyAmIEVuZ2luZU9wdGlvbnM+ID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7XG4gICAgICBwYXRoOiBcIi9zb2NrZXQuaW8vXCIsXG4gICAgICBjb25uZWN0VGltZW91dDogNDVfMDAwLFxuICAgICAgcGFyc2VyOiB7XG4gICAgICAgIGNyZWF0ZUVuY29kZXIoKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBFbmNvZGVyKCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNyZWF0ZURlY29kZXIoKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBEZWNvZGVyKCk7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYWRhcHRlcjogKFxuICAgICAgICBuc3A6IE5hbWVzcGFjZSxcbiAgICAgICkgPT4gbmV3IEluTWVtb3J5QWRhcHRlcihuc3ApLFxuICAgIH0sIG9wdHMpO1xuXG4gICAgdGhpcy5lbmdpbmUgPSBuZXcgRW5naW5lKHRoaXMub3B0cyk7XG5cbiAgICB0aGlzLmVuZ2luZS5vbihcImNvbm5lY3Rpb25cIiwgKGNvbm4sIHJlcSwgY29ubkluZm8pID0+IHtcbiAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgYFtzZXJ2ZXJdIGluY29taW5nIGNvbm5lY3Rpb24gd2l0aCBpZCAke2Nvbm4uaWR9YCxcbiAgICAgICk7XG4gICAgICBuZXcgQ2xpZW50KHRoaXMsIHRoaXMub3B0cy5wYXJzZXIuY3JlYXRlRGVjb2RlcigpLCBjb25uLCByZXEsIGNvbm5JbmZvKTtcbiAgICB9KTtcblxuICAgIHRoaXMuX2VuY29kZXIgPSB0aGlzLm9wdHMucGFyc2VyLmNyZWF0ZUVuY29kZXIoKTtcblxuICAgIGNvbnN0IG1haW5OYW1lc3BhY2UgPSB0aGlzLm9mKFwiL1wiKTtcblxuICAgIFtcIm9uXCIsIFwib25jZVwiLCBcIm9mZlwiLCBcImxpc3RlbmVyc1wiXS5mb3JFYWNoKChtZXRob2QpID0+IHtcbiAgICAgIC8vIEB0cy1pZ25vcmUgRklYTUUgcHJvcGVyIHR5cGluZ1xuICAgICAgdGhpc1ttZXRob2RdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBAdHMtaWdub3JlIEZJWE1FIHByb3BlciB0eXBpbmdcbiAgICAgICAgcmV0dXJuIG1haW5OYW1lc3BhY2VbbWV0aG9kXS5hcHBseShtYWluTmFtZXNwYWNlLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcblxuICAgIHRoaXMubWFpbk5hbWVzcGFjZSA9IG1haW5OYW1lc3BhY2U7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhIHJlcXVlc3QgaGFuZGxlci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW1wb3J0IHsgU2VydmVyIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQHgueS56L21vZC50c1wiO1xuICAgKlxuICAgKiBjb25zdCBpbyA9IG5ldyBTZXJ2ZXIoKTtcbiAgICpcbiAgICogRGVuby5zZXJ2ZSh7XG4gICAqICAgaGFuZGxlcjogaW8uaGFuZGxlcigpLFxuICAgKiAgIHBvcnQ6IDMwMDAsXG4gICAqIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gYWRkaXRpb25hbEhhbmRsZXIgLSBhbm90aGVyIGhhbmRsZXIgd2hpY2ggd2lsbCByZWNlaXZlIHRoZSByZXF1ZXN0IGlmIHRoZSBwYXRoIGRvZXMgbm90IG1hdGNoXG4gICAqL1xuICBwdWJsaWMgaGFuZGxlcihhZGRpdGlvbmFsSGFuZGxlcj86IERlbm8uU2VydmVIYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuZW5naW5lLmhhbmRsZXIoYWRkaXRpb25hbEhhbmRsZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGVzIHRoZSBtaWRkbGV3YXJlIGZvciBhbiBpbmNvbWluZyBuYW1lc3BhY2Ugbm90IGFscmVhZHkgY3JlYXRlZCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSAtIG5hbWUgb2YgaW5jb21pbmcgbmFtZXNwYWNlXG4gICAqIEBwYXJhbSBhdXRoIC0gdGhlIGF1dGggcGFyYW1ldGVyc1xuICAgKiBAcGFyYW0gZm4gLSBjYWxsYmFja1xuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgLyogcHJpdmF0ZSAqLyBhc3luYyBfY2hlY2tOYW1lc3BhY2UoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGF1dGg6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5wYXJlbnROc3BzLnNpemUgPT09IDApIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xuXG4gICAgZm9yIChjb25zdCBbaXNWYWxpZCwgcGFyZW50TnNwXSBvZiB0aGlzLnBhcmVudE5zcHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGlzVmFsaWQobmFtZSwgYXV0aCk7XG4gICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fbnNwcy5oYXMobmFtZSkpIHtcbiAgICAgICAgLy8gdGhlIG5hbWVzcGFjZSB3YXMgY3JlYXRlZCBpbiB0aGUgbWVhbnRpbWVcbiAgICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICAgIGBbc2VydmVyXSBkeW5hbWljIG5hbWVzcGFjZSAke25hbWV9IGFscmVhZHkgZXhpc3RzYCxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5hbWVzcGFjZSA9IHBhcmVudE5zcC5fY3JlYXRlQ2hpbGQobmFtZSk7XG4gICAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgICBgW3NlcnZlcl0gZHluYW1pYyBuYW1lc3BhY2UgJHtuYW1lfSB3YXMgY3JlYXRlZGAsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwibmV3X25hbWVzcGFjZVwiLCBuYW1lc3BhY2UpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gIH1cblxuICAvKipcbiAgICogTG9va3MgdXAgYSBuYW1lc3BhY2UuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHdpdGggYSBzaW1wbGUgc3RyaW5nXG4gICAqIGNvbnN0IG15TmFtZXNwYWNlID0gaW8ub2YoXCIvbXktbmFtZXNwYWNlXCIpO1xuICAgKlxuICAgKiAvLyB3aXRoIGEgcmVnZXhcbiAgICogY29uc3QgZHluYW1pY05zcCA9IGlvLm9mKC9eXFwvZHluYW1pYy1cXGQrJC8pLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgY29uc3QgbmFtZXNwYWNlID0gc29ja2V0Lm5zcDsgLy8gbmV3TmFtZXNwYWNlLm5hbWUgPT09IFwiL2R5bmFtaWMtMTAxXCJcbiAgICpcbiAgICogICAvLyBicm9hZGNhc3QgdG8gYWxsIGNsaWVudHMgaW4gdGhlIGdpdmVuIHN1Yi1uYW1lc3BhY2VcbiAgICogICBuYW1lc3BhY2UuZW1pdChcImhlbGxvXCIpO1xuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIG5hbWUgLSBuc3AgbmFtZVxuICAgKi9cbiAgcHVibGljIG9mKFxuICAgIG5hbWU6IHN0cmluZyB8IFJlZ0V4cCB8IFBhcmVudE5zcE5hbWVNYXRjaEZuLFxuICApOiBOYW1lc3BhY2U8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSBcImZ1bmN0aW9uXCIgfHwgbmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgY29uc3QgcGFyZW50TnNwID0gbmV3IFBhcmVudE5hbWVzcGFjZSh0aGlzKTtcbiAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgYFtzZXJ2ZXJdIGluaXRpYWxpemluZyBwYXJlbnQgbmFtZXNwYWNlICR7cGFyZW50TnNwLm5hbWV9YCxcbiAgICAgICk7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aGlzLnBhcmVudE5zcHMuc2V0KG5hbWUsIHBhcmVudE5zcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnBhcmVudE5zcHMuc2V0KFxuICAgICAgICAgIChuc3A6IHN0cmluZykgPT5cbiAgICAgICAgICAgIChuYW1lIGFzIFJlZ0V4cCkudGVzdChuc3ApID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBQcm9taXNlLnJlamVjdCgpLFxuICAgICAgICAgIHBhcmVudE5zcCxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmVudE5zcDtcbiAgICB9XG5cbiAgICBpZiAoU3RyaW5nKG5hbWUpWzBdICE9PSBcIi9cIikgbmFtZSA9IFwiL1wiICsgbmFtZTtcblxuICAgIGxldCBuc3AgPSB0aGlzLl9uc3BzLmdldChuYW1lKTtcbiAgICBpZiAoIW5zcCkge1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKGBbc2VydmVyXSBpbml0aWFsaXppbmcgbmFtZXNwYWNlICR7bmFtZX1gKTtcbiAgICAgIG5zcCA9IG5ldyBOYW1lc3BhY2UodGhpcywgbmFtZSk7XG4gICAgICB0aGlzLl9uc3BzLnNldChuYW1lLCBuc3ApO1xuICAgICAgaWYgKG5hbWUgIT09IFwiL1wiKSB7XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwibmV3X25hbWVzcGFjZVwiLCBuc3ApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuc3A7XG4gIH1cblxuICAvKipcbiAgICogQ2xvc2VzIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGltcG9ydCB7IFNlcnZlciB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L3NvY2tldF9pb0B4Lnkuei9tb2QudHNcIjtcbiAgICpcbiAgICogY29uc3QgaW8gPSBuZXcgU2VydmVyKCk7XG4gICAqIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICpcbiAgICogRGVuby5zZXJ2ZSh7XG4gICAqICAgaGFuZGxlcjogaW8uaGFuZGxlcigpLFxuICAgKiAgIHBvcnQ6IDMwMDAsXG4gICAqICAgc2lnbmFsOiBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLFxuICAgKiAgIG9uTGlzdGVuOiAoKSA9PiB7XG4gICAqICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICogICAgICAgLy8gY2xvc2UgdGhlIEhUVFAgc2VydmVyXG4gICAqICAgICAgIGFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xuICAgKiAgICAgICAvLyBjbG9zZSB0aGUgU29ja2V0LklPIHNlcnZlclxuICAgKiAgICAgICBpby5jbG9zZSgpO1xuICAgKiAgICAgfSwgMTAwMDApO1xuICAgKiAgIH1cbiAgICogfSk7XG4gICAqL1xuICBwdWJsaWMgY2xvc2UoKSB7XG4gICAgdGhpcy5lbmdpbmUuY2xvc2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBtaWRkbGV3YXJlLCB3aGljaCBpcyBhIGZ1bmN0aW9uIHRoYXQgZ2V0cyBleGVjdXRlZCBmb3IgZXZlcnkgaW5jb21pbmcge0BsaW5rIFNvY2tldH0uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLnVzZShhc3luYyAoc29ja2V0KSA9PiB7XG4gICAqICAgLy8gLi4uXG4gICAqIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gZm4gLSB0aGUgbWlkZGxld2FyZSBmdW5jdGlvblxuICAgKi9cbiAgcHVibGljIHVzZShcbiAgICBmbjogKFxuICAgICAgc29ja2V0OiBTb2NrZXQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPixcbiAgICApID0+IFByb21pc2U8dm9pZD4sXG4gICk6IHRoaXMge1xuICAgIHRoaXMubWFpbk5hbWVzcGFjZS51c2UoZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFRhcmdldHMgYSByb29tIHdoZW4gZW1pdHRpbmcuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHRoZSDigJxmb2/igJ0gZXZlbnQgd2lsbCBiZSBicm9hZGNhc3QgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzIGluIHRoZSDigJxyb29tLTEwMeKAnSByb29tXG4gICAqIGlvLnRvKFwicm9vbS0xMDFcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogLy8gd2l0aCBhbiBhcnJheSBvZiByb29tcyAoYSBjbGllbnQgd2lsbCBiZSBub3RpZmllZCBhdCBtb3N0IG9uY2UpXG4gICAqIGlvLnRvKFtcInJvb20tMTAxXCIsIFwicm9vbS0xMDJcIl0pLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqXG4gICAqIC8vIHdpdGggbXVsdGlwbGUgY2hhaW5lZCBjYWxsc1xuICAgKiBpby50byhcInJvb20tMTAxXCIpLnRvKFwicm9vbS0xMDJcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqIEByZXR1cm4gYSBuZXcge0BsaW5rIEJyb2FkY2FzdE9wZXJhdG9yfSBpbnN0YW5jZSBmb3IgY2hhaW5pbmdcbiAgICovXG4gIHB1YmxpYyB0byhyb29tOiBSb29tIHwgUm9vbVtdKTogQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cywgU29ja2V0RGF0YT4ge1xuICAgIHJldHVybiB0aGlzLm1haW5OYW1lc3BhY2UudG8ocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogVGFyZ2V0cyBhIHJvb20gd2hlbiBlbWl0dGluZy4gU2ltaWxhciB0byBgdG8oKWAsIGJ1dCBtaWdodCBmZWVsIGNsZWFyZXIgaW4gc29tZSBjYXNlczpcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gZGlzY29ubmVjdCBhbGwgY2xpZW50cyBpbiB0aGUgXCJyb29tLTEwMVwiIHJvb21cbiAgICogaW8uaW4oXCJyb29tLTEwMVwiKS5kaXNjb25uZWN0U29ja2V0cygpO1xuICAgKlxuICAgKiBAcGFyYW0gcm9vbSAtIGEgcm9vbSwgb3IgYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIGluKHJvb206IFJvb20gfCBSb29tW10pOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMubWFpbk5hbWVzcGFjZS5pbihyb29tKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGNsdWRlcyBhIHJvb20gd2hlbiBlbWl0dGluZy5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gdGhlIFwiZm9vXCIgZXZlbnQgd2lsbCBiZSBicm9hZGNhc3QgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzLCBleGNlcHQgdGhlIG9uZXMgdGhhdCBhcmUgaW4gdGhlIFwicm9vbS0xMDFcIiByb29tXG4gICAqIGlvLmV4Y2VwdChcInJvb20tMTAxXCIpLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqXG4gICAqIC8vIHdpdGggYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICogaW8uZXhjZXB0KFtcInJvb20tMTAxXCIsIFwicm9vbS0xMDJcIl0pLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqXG4gICAqIC8vIHdpdGggbXVsdGlwbGUgY2hhaW5lZCBjYWxsc1xuICAgKiBpby5leGNlcHQoXCJyb29tLTEwMVwiKS5leGNlcHQoXCJyb29tLTEwMlwiKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKlxuICAgKiBAcGFyYW0gcm9vbSAtIGEgcm9vbSwgb3IgYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIGV4Y2VwdChcbiAgICByb29tOiBSb29tIHwgUm9vbVtdLFxuICApOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMubWFpbk5hbWVzcGFjZS5leGNlcHQocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogRW1pdHMgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5lbWl0KFwiaGVsbG9cIiwgXCJ3b3JsZFwiKTtcbiAgICpcbiAgICogLy8gYWxsIHNlcmlhbGl6YWJsZSBkYXRhc3RydWN0dXJlcyBhcmUgc3VwcG9ydGVkIChubyBuZWVkIHRvIGNhbGwgSlNPTi5zdHJpbmdpZnkpXG4gICAqIGlvLmVtaXQoXCJoZWxsb1wiLCAxLCBcIjJcIiwgeyAzOiBbXCI0XCJdLCA1OiBVaW50OEFycmF5LmZyb20oWzZdKSB9KTtcbiAgICpcbiAgICogLy8gd2l0aCBhbiBhY2tub3dsZWRnZW1lbnQgZnJvbSB0aGUgY2xpZW50c1xuICAgKiBpby50aW1lb3V0KDEwMDApLmVtaXQoXCJzb21lLWV2ZW50XCIsIChlcnIsIHJlc3BvbnNlcykgPT4ge1xuICAgKiAgIGlmIChlcnIpIHtcbiAgICogICAgIC8vIHNvbWUgY2xpZW50cyBkaWQgbm90IGFja25vd2xlZGdlIHRoZSBldmVudCBpbiB0aGUgZ2l2ZW4gZGVsYXlcbiAgICogICB9IGVsc2Uge1xuICAgKiAgICAgY29uc29sZS5sb2cocmVzcG9uc2VzKTsgLy8gb25lIHJlc3BvbnNlIHBlciBjbGllbnRcbiAgICogICB9XG4gICAqIH0pO1xuICAgKlxuICAgKiBAcmV0dXJuIEFsd2F5cyB0cnVlXG4gICAqL1xuICBvdmVycmlkZSBlbWl0PEV2IGV4dGVuZHMgRXZlbnROYW1lczxFbWl0RXZlbnRzPj4oXG4gICAgZXY6IEV2LFxuICAgIC4uLmFyZ3M6IEV2ZW50UGFyYW1zPEVtaXRFdmVudHMsIEV2PlxuICApOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tYWluTmFtZXNwYWNlLmVtaXQoZXYsIC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmRzIGEgYG1lc3NhZ2VgIGV2ZW50IHRvIGFsbCBjbGllbnRzLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBtaW1pY3MgdGhlIFdlYlNvY2tldC5zZW5kKCkgbWV0aG9kLlxuICAgKlxuICAgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XZWJTb2NrZXQvc2VuZFxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5zZW5kKFwiaGVsbG9cIik7XG4gICAqXG4gICAqIC8vIHRoaXMgaXMgZXF1aXZhbGVudCB0b1xuICAgKiBpby5lbWl0KFwibWVzc2FnZVwiLCBcImhlbGxvXCIpO1xuICAgKlxuICAgKiBAcmV0dXJuIHNlbGZcbiAgICovXG4gIHB1YmxpYyBzZW5kKC4uLmFyZ3M6IEV2ZW50UGFyYW1zPEVtaXRFdmVudHMsIFwibWVzc2FnZVwiPik6IHRoaXMge1xuICAgIHRoaXMubWFpbk5hbWVzcGFjZS5lbWl0KFwibWVzc2FnZVwiLCAuLi5hcmdzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kcyBhIG1lc3NhZ2UgdG8gdGhlIG90aGVyIFNvY2tldC5JTyBzZXJ2ZXJzIG9mIHRoZSBjbHVzdGVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5zZXJ2ZXJTaWRlRW1pdChcImhlbGxvXCIsIFwid29ybGRcIik7XG4gICAqXG4gICAqIGlvLm9uKFwiaGVsbG9cIiwgKGFyZzEpID0+IHtcbiAgICogICBjb25zb2xlLmxvZyhhcmcxKTsgLy8gcHJpbnRzIFwid29ybGRcIlxuICAgKiB9KTtcbiAgICpcbiAgICogLy8gYWNrbm93bGVkZ2VtZW50cyAod2l0aG91dCBiaW5hcnkgY29udGVudCkgYXJlIHN1cHBvcnRlZCB0b286XG4gICAqIGlvLnNlcnZlclNpZGVFbWl0KFwicGluZ1wiLCAoZXJyLCByZXNwb25zZXMpID0+IHtcbiAgICogIGlmIChlcnIpIHtcbiAgICogICAgIC8vIHNvbWUgY2xpZW50cyBkaWQgbm90IGFja25vd2xlZGdlIHRoZSBldmVudCBpbiB0aGUgZ2l2ZW4gZGVsYXlcbiAgICogICB9IGVsc2Uge1xuICAgKiAgICAgY29uc29sZS5sb2cocmVzcG9uc2VzKTsgLy8gb25lIHJlc3BvbnNlIHBlciBjbGllbnRcbiAgICogICB9XG4gICAqIH0pO1xuICAgKlxuICAgKiBpby5vbihcInBpbmdcIiwgKGNiKSA9PiB7XG4gICAqICAgY2IoXCJwb25nXCIpO1xuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIGV2IC0gdGhlIGV2ZW50IG5hbWVcbiAgICogQHBhcmFtIGFyZ3MgLSBhbiBhcnJheSBvZiBhcmd1bWVudHMsIHdoaWNoIG1heSBpbmNsdWRlIGFuIGFja25vd2xlZGdlbWVudCBjYWxsYmFjayBhdCB0aGUgZW5kXG4gICAqL1xuICBwdWJsaWMgc2VydmVyU2lkZUVtaXQ8RXYgZXh0ZW5kcyBFdmVudE5hbWVzPFNlcnZlclNpZGVFdmVudHM+PihcbiAgICBldjogRXYsXG4gICAgLi4uYXJnczogRXZlbnRQYXJhbXM8U2VydmVyU2lkZUV2ZW50cywgRXY+XG4gICk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm1haW5OYW1lc3BhY2Uuc2VydmVyU2lkZUVtaXQoZXYsIC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtb2RpZmllciBmb3IgYSBzdWJzZXF1ZW50IGV2ZW50IGVtaXNzaW9uIHRoYXQgdGhlIGV2ZW50IGRhdGEgbWF5IGJlIGxvc3QgaWYgdGhlIGNsaWVudCBpcyBub3QgcmVhZHkgdG9cbiAgICogcmVjZWl2ZSBtZXNzYWdlcyAoYmVjYXVzZSBvZiBuZXR3b3JrIHNsb3duZXNzIG9yIG90aGVyIGlzc3Vlcywgb3IgYmVjYXVzZSB0aGV54oCZcmUgY29ubmVjdGVkIHRocm91Z2ggbG9uZyBwb2xsaW5nXG4gICAqIGFuZCBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgcmVxdWVzdC1yZXNwb25zZSBjeWNsZSkuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLnZvbGF0aWxlLmVtaXQoXCJoZWxsb1wiKTsgLy8gdGhlIGNsaWVudHMgbWF5IG9yIG1heSBub3QgcmVjZWl2ZSBpdFxuICAgKlxuICAgKiBAcmV0dXJuIGEgbmV3IHtAbGluayBCcm9hZGNhc3RPcGVyYXRvcn0gaW5zdGFuY2UgZm9yIGNoYWluaW5nXG4gICAqL1xuICBwdWJsaWMgZ2V0IHZvbGF0aWxlKCk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5tYWluTmFtZXNwYWNlLnZvbGF0aWxlO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtb2RpZmllciBmb3IgYSBzdWJzZXF1ZW50IGV2ZW50IGVtaXNzaW9uIHRoYXQgdGhlIGV2ZW50IGRhdGEgd2lsbCBvbmx5IGJlIGJyb2FkY2FzdCB0byB0aGUgY3VycmVudCBub2RlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAvLyB0aGUg4oCcZm9v4oCdIGV2ZW50IHdpbGwgYmUgYnJvYWRjYXN0IHRvIGFsbCBjb25uZWN0ZWQgY2xpZW50cyBvbiB0aGlzIG5vZGVcbiAgICogaW8ubG9jYWwuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIGdldCBsb2NhbCgpOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMubWFpbk5hbWVzcGFjZS5sb2NhbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSBuZXh0IG9wZXJhdGlvbi5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8udGltZW91dCgxMDAwKS5lbWl0KFwic29tZS1ldmVudFwiLCAoZXJyLCByZXNwb25zZXMpID0+IHtcbiAgICogICBpZiAoZXJyKSB7XG4gICAqICAgICAvLyBzb21lIGNsaWVudHMgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7IC8vIG9uZSByZXNwb25zZSBwZXIgY2xpZW50XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIHRpbWVvdXRcbiAgICovXG4gIHB1YmxpYyB0aW1lb3V0KHRpbWVvdXQ6IG51bWJlcik6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5tYWluTmFtZXNwYWNlLnRpbWVvdXQodGltZW91dCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlcy5cbiAgICpcbiAgICogTm90ZTogdGhpcyBtZXRob2QgYWxzbyB3b3JrcyB3aXRoaW4gYSBjbHVzdGVyIG9mIG11bHRpcGxlIFNvY2tldC5JTyBzZXJ2ZXJzLCB3aXRoIGEgY29tcGF0aWJsZSB7QGxpbmsgQWRhcHRlcn0uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHJldHVybiBhbGwgU29ja2V0IGluc3RhbmNlc1xuICAgKiBjb25zdCBzb2NrZXRzID0gYXdhaXQgaW8uZmV0Y2hTb2NrZXRzKCk7XG4gICAqXG4gICAqIC8vIHJldHVybiBhbGwgU29ja2V0IGluc3RhbmNlcyBpbiB0aGUgXCJyb29tMVwiIHJvb21cbiAgICogY29uc3Qgc29ja2V0cyA9IGF3YWl0IGlvLmluKFwicm9vbTFcIikuZmV0Y2hTb2NrZXRzKCk7XG4gICAqXG4gICAqIGZvciAoY29uc3Qgc29ja2V0IG9mIHNvY2tldHMpIHtcbiAgICogICBjb25zb2xlLmxvZyhzb2NrZXQuaWQpO1xuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5oYW5kc2hha2UpO1xuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5yb29tcyk7XG4gICAqICAgY29uc29sZS5sb2coc29ja2V0LmRhdGEpO1xuICAgKlxuICAgKiAgIHNvY2tldC5lbWl0KFwiaGVsbG9cIik7XG4gICAqICAgc29ja2V0LmpvaW4oXCJyb29tMVwiKTtcbiAgICogICBzb2NrZXQubGVhdmUoXCJyb29tMlwiKTtcbiAgICogICBzb2NrZXQuZGlzY29ubmVjdCgpO1xuICAgKiB9XG4gICAqL1xuICBwdWJsaWMgZmV0Y2hTb2NrZXRzKCk6IFByb21pc2U8UmVtb3RlU29ja2V0PEVtaXRFdmVudHMsIFNvY2tldERhdGE+W10+IHtcbiAgICByZXR1cm4gdGhpcy5tYWluTmFtZXNwYWNlLmZldGNoU29ja2V0cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1ha2VzIHRoZSBtYXRjaGluZyBzb2NrZXQgaW5zdGFuY2VzIGpvaW4gdGhlIHNwZWNpZmllZCByb29tcy5cbiAgICpcbiAgICogTm90ZTogdGhpcyBtZXRob2QgYWxzbyB3b3JrcyB3aXRoaW4gYSBjbHVzdGVyIG9mIG11bHRpcGxlIFNvY2tldC5JTyBzZXJ2ZXJzLCB3aXRoIGEgY29tcGF0aWJsZSB7QGxpbmsgQWRhcHRlcn0uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgam9pbiB0aGUgXCJyb29tMVwiIHJvb21cbiAgICogaW8uc29ja2V0c0pvaW4oXCJyb29tMVwiKTtcbiAgICpcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBpbiB0aGUgXCJyb29tMVwiIHJvb20gam9pbiB0aGUgXCJyb29tMlwiIGFuZCBcInJvb20zXCIgcm9vbXNcbiAgICogaW8uaW4oXCJyb29tMVwiKS5zb2NrZXRzSm9pbihbXCJyb29tMlwiLCBcInJvb20zXCJdKTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqL1xuICBwdWJsaWMgc29ja2V0c0pvaW4ocm9vbTogUm9vbSB8IFJvb21bXSk6IHZvaWQge1xuICAgIHJldHVybiB0aGlzLm1haW5OYW1lc3BhY2Uuc29ja2V0c0pvaW4ocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogTWFrZXMgdGhlIG1hdGNoaW5nIHNvY2tldCBpbnN0YW5jZXMgbGVhdmUgdGhlIHNwZWNpZmllZCByb29tcy5cbiAgICpcbiAgICogTm90ZTogdGhpcyBtZXRob2QgYWxzbyB3b3JrcyB3aXRoaW4gYSBjbHVzdGVyIG9mIG11bHRpcGxlIFNvY2tldC5JTyBzZXJ2ZXJzLCB3aXRoIGEgY29tcGF0aWJsZSB7QGxpbmsgQWRhcHRlcn0uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgbGVhdmUgdGhlIFwicm9vbTFcIiByb29tXG4gICAqIGlvLnNvY2tldHNMZWF2ZShcInJvb20xXCIpO1xuICAgKlxuICAgKiAvLyBtYWtlIGFsbCBzb2NrZXQgaW5zdGFuY2VzIGluIHRoZSBcInJvb20xXCIgcm9vbSBsZWF2ZSB0aGUgXCJyb29tMlwiIGFuZCBcInJvb20zXCIgcm9vbXNcbiAgICogaW8uaW4oXCJyb29tMVwiKS5zb2NrZXRzTGVhdmUoW1wicm9vbTJcIiwgXCJyb29tM1wiXSk7XG4gICAqXG4gICAqIEBwYXJhbSByb29tIC0gYSByb29tLCBvciBhbiBhcnJheSBvZiByb29tc1xuICAgKi9cbiAgcHVibGljIHNvY2tldHNMZWF2ZShyb29tOiBSb29tIHwgUm9vbVtdKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMubWFpbk5hbWVzcGFjZS5zb2NrZXRzTGVhdmUocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogTWFrZXMgdGhlIG1hdGNoaW5nIHNvY2tldCBpbnN0YW5jZXMgZGlzY29ubmVjdC5cbiAgICpcbiAgICogTm90ZTogdGhpcyBtZXRob2QgYWxzbyB3b3JrcyB3aXRoaW4gYSBjbHVzdGVyIG9mIG11bHRpcGxlIFNvY2tldC5JTyBzZXJ2ZXJzLCB3aXRoIGEgY29tcGF0aWJsZSB7QGxpbmsgQWRhcHRlcn0uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgZGlzY29ubmVjdCAodGhlIGNvbm5lY3Rpb25zIG1pZ2h0IGJlIGtlcHQgYWxpdmUgZm9yIG90aGVyIG5hbWVzcGFjZXMpXG4gICAqIGlvLmRpc2Nvbm5lY3RTb2NrZXRzKCk7XG4gICAqXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgaW4gdGhlIFwicm9vbTFcIiByb29tIGRpc2Nvbm5lY3QgYW5kIGNsb3NlIHRoZSB1bmRlcmx5aW5nIGNvbm5lY3Rpb25zXG4gICAqIGlvLmluKFwicm9vbTFcIikuZGlzY29ubmVjdFNvY2tldHModHJ1ZSk7XG4gICAqXG4gICAqIEBwYXJhbSBjbG9zZSAtIHdoZXRoZXIgdG8gY2xvc2UgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvblxuICAgKi9cbiAgcHVibGljIGRpc2Nvbm5lY3RTb2NrZXRzKGNsb3NlID0gZmFsc2UpOiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5tYWluTmFtZXNwYWNlLmRpc2Nvbm5lY3RTb2NrZXRzKGNsb3NlKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQ0UsVUFBVSxNQUFNLFFBRVgseUJBQXlCO0FBQ2hDLFNBRUUsWUFBWSxRQUlQLDZCQUE2QjtBQUNwQyxTQUFTLFNBQVMsUUFBUSxtQkFBbUI7QUFDN0MsU0FBUyxNQUFNLFFBQVEsY0FBYztBQUNyQyxTQUFTLE9BQU8sRUFBRSxPQUFPLFFBQVEsZ0NBQWdDO0FBQ2pFLFNBQVMsU0FBUyxRQUFpQyxpQkFBaUI7QUFDcEUsU0FBUyxlQUFlLFFBQVEsd0JBQXdCO0FBRXhELFNBQWtCLGVBQWUsUUFBYyxlQUFlO0FBd0Q5RDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTRCQyxHQUNELE9BQU8sTUFBTSxlQUtIO0VBVVEsT0FBZTtFQUNmLGNBS2Q7RUFDYyxLQUFvQjtFQUVwQyxXQUFXLEdBQUcsQUFBUyxTQUFrQjtFQUV6QyxXQUFXLEdBQUcsUUFHVixJQUFJLE1BQU07RUFFTixhQUdKLElBQUksTUFBTTtFQUVkLFlBQVksT0FBK0MsQ0FBQyxDQUFDLENBQUU7SUFDN0QsS0FBSztJQUVMLElBQUksQ0FBQyxJQUFJLEdBQUcsT0FBTyxNQUFNLENBQUM7TUFDeEIsTUFBTTtNQUNOLGdCQUFnQjtNQUNoQixRQUFRO1FBQ047VUFDRSxPQUFPLElBQUk7UUFDYjtRQUNBO1VBQ0UsT0FBTyxJQUFJO1FBQ2I7TUFDRjtNQUNBLFNBQVMsQ0FDUCxNQUNHLElBQUksZ0JBQWdCO0lBQzNCLEdBQUc7SUFFSCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSTtJQUVsQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsTUFBTSxLQUFLO01BQ3ZDLFVBQVUsYUFBYSxLQUFLLENBQzFCLENBQUMscUNBQXFDLEVBQUUsS0FBSyxFQUFFLEVBQUU7TUFFbkQsSUFBSSxPQUFPLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUksTUFBTSxLQUFLO0lBQ2hFO0lBRUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhO0lBRTlDLE1BQU0sZ0JBQWdCLElBQUksQ0FBQyxFQUFFLENBQUM7SUFFOUI7TUFBQztNQUFNO01BQVE7TUFBTztLQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7TUFDMUMsaUNBQWlDO01BQ2pDLElBQUksQ0FBQyxPQUFPLEdBQUc7UUFDYixpQ0FBaUM7UUFDakMsT0FBTyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxlQUFlO01BQ3BEO0lBQ0Y7SUFFQSxJQUFJLENBQUMsYUFBYSxHQUFHO0VBQ3ZCO0VBRUE7Ozs7Ozs7Ozs7Ozs7O0dBY0MsR0FDRCxBQUFPLFFBQVEsaUJBQXFDLEVBQUU7SUFDcEQsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztFQUM3QjtFQUVBOzs7Ozs7OztHQVFDLEdBQ0QsV0FBVyxHQUFHLE1BQU0sZ0JBQ2xCLElBQVksRUFDWixJQUE2QixFQUNkO0lBQ2YsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxHQUFHLE9BQU8sUUFBUSxNQUFNO0lBRXJELEtBQUssTUFBTSxDQUFDLFNBQVMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUU7TUFDbEQsSUFBSTtRQUNGLE1BQU0sUUFBUSxNQUFNO01BQ3RCLEVBQUUsT0FBTyxHQUFHO1FBQ1Y7TUFDRjtNQUVBLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTztRQUN4Qiw0Q0FBNEM7UUFDNUMsVUFBVSxhQUFhLEtBQUssQ0FDMUIsQ0FBQywyQkFBMkIsRUFBRSxLQUFLLGVBQWUsQ0FBQztNQUV2RCxPQUFPO1FBQ0wsTUFBTSxZQUFZLFVBQVUsWUFBWSxDQUFDO1FBQ3pDLFVBQVUsYUFBYSxLQUFLLENBQzFCLENBQUMsMkJBQTJCLEVBQUUsS0FBSyxZQUFZLENBQUM7UUFFbEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxpQkFBaUI7TUFDckM7TUFFQSxPQUFPLFFBQVEsT0FBTztJQUN4QjtJQUVBLE9BQU8sUUFBUSxNQUFNO0VBQ3ZCO0VBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkMsR0FDRCxBQUFPLEdBQ0wsSUFBNEMsRUFDdUI7SUFDbkUsSUFBSSxPQUFPLFNBQVMsY0FBYyxnQkFBZ0IsUUFBUTtNQUN4RCxNQUFNLFlBQVksSUFBSSxnQkFBZ0IsSUFBSTtNQUMxQyxVQUFVLGFBQWEsS0FBSyxDQUMxQixDQUFDLHVDQUF1QyxFQUFFLFVBQVUsSUFBSSxFQUFFO01BRTVELElBQUksT0FBTyxTQUFTLFlBQVk7UUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTTtNQUM1QixPQUFPO1FBQ0wsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQ2pCLENBQUMsTUFDQyxBQUFDLEtBQWdCLElBQUksQ0FBQyxPQUFPLFFBQVEsT0FBTyxLQUFLLFFBQVEsTUFBTSxJQUNqRTtNQUVKO01BRUEsT0FBTztJQUNUO0lBRUEsSUFBSSxPQUFPLEtBQUssQ0FBQyxFQUFFLEtBQUssS0FBSyxPQUFPLE1BQU07SUFFMUMsSUFBSSxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ3pCLElBQUksQ0FBQyxLQUFLO01BQ1IsVUFBVSxhQUFhLEtBQUssQ0FBQyxDQUFDLGdDQUFnQyxFQUFFLE1BQU07TUFDdEUsTUFBTSxJQUFJLFVBQVUsSUFBSSxFQUFFO01BQzFCLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU07TUFDckIsSUFBSSxTQUFTLEtBQUs7UUFDaEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxpQkFBaUI7TUFDckM7SUFDRjtJQUVBLE9BQU87RUFDVDtFQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBc0JDLEdBQ0QsQUFBTyxRQUFRO0lBQ2IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLO0VBQ25CO0VBRUE7Ozs7Ozs7OztHQVNDLEdBQ0QsQUFBTyxJQUNMLEVBRWtCLEVBQ1o7SUFDTixJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztJQUN2QixPQUFPLElBQUk7RUFDYjtFQUVBOzs7Ozs7Ozs7Ozs7Ozs7R0FlQyxHQUNELEFBQU8sR0FBRyxJQUFtQixFQUE2QztJQUN4RSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO0VBQy9CO0VBRUE7Ozs7Ozs7OztHQVNDLEdBQ0QsQUFBTyxHQUFHLElBQW1CLEVBQTZDO0lBQ3hFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7RUFDL0I7RUFFQTs7Ozs7Ozs7Ozs7Ozs7O0dBZUMsR0FDRCxBQUFPLE9BQ0wsSUFBbUIsRUFDd0I7SUFDM0MsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQztFQUNuQztFQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJDLEdBQ0QsQUFBUyxLQUNQLEVBQU0sRUFDTixHQUFHLElBQWlDLEVBQzNCO0lBQ1QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPO0VBQ3hDO0VBRUE7Ozs7Ozs7Ozs7Ozs7O0dBY0MsR0FDRCxBQUFPLEtBQUssR0FBRyxJQUF3QyxFQUFRO0lBQzdELElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGNBQWM7SUFDdEMsT0FBTyxJQUFJO0VBQ2I7RUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXlCQyxHQUNELEFBQU8sZUFDTCxFQUFNLEVBQ04sR0FBRyxJQUF1QyxFQUNqQztJQUNULE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsT0FBTztFQUNsRDtFQUVBOzs7Ozs7Ozs7R0FTQyxHQUNELElBQVcsV0FBc0Q7SUFDL0QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7RUFDcEM7RUFFQTs7Ozs7Ozs7R0FRQyxHQUNELElBQVcsUUFBbUQ7SUFDNUQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUs7RUFDakM7RUFFQTs7Ozs7Ozs7Ozs7OztHQWFDLEdBQ0QsQUFBTyxRQUFRLE9BQWUsRUFBNkM7SUFDekUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztFQUNwQztFQUVBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXVCQyxHQUNELEFBQU8sZUFBZ0U7SUFDckUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVk7RUFDeEM7RUFFQTs7Ozs7Ozs7Ozs7Ozs7R0FjQyxHQUNELEFBQU8sWUFBWSxJQUFtQixFQUFRO0lBQzVDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUM7RUFDeEM7RUFFQTs7Ozs7Ozs7Ozs7OztHQWFDLEdBQ0QsQUFBTyxhQUFhLElBQW1CLEVBQVE7SUFDN0MsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQztFQUN6QztFQUVBOzs7Ozs7Ozs7Ozs7O0dBYUMsR0FDRCxBQUFPLGtCQUFrQixRQUFRLEtBQUssRUFBUTtJQUM1QyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUM7RUFDOUM7QUFDRiJ9
// denoCacheMetadata=15776591538933581232,11280416232070403376