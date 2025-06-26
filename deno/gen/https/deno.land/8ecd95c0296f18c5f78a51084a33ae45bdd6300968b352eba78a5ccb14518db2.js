import { EventEmitter } from "../../event-emitter/mod.ts";
import { Socket } from "./socket.ts";
import { getLogger } from "../../../deps.ts";
import { BroadcastOperator } from "./broadcast-operator.ts";
export const RESERVED_EVENTS = new Set([
  "connection",
  "new_namespace"
]);
/**
 * A Namespace is a communication channel that allows you to split the logic of your application over a single shared
 * connection.
 *
 * Each namespace has its own:
 *
 * - event handlers
 *
 * ```
 * io.of("/orders").on("connection", (socket) => {
 *   socket.on("order:list", () => {});
 *   socket.on("order:create", () => {});
 * });
 *
 * io.of("/users").on("connection", (socket) => {
 *   socket.on("user:list", () => {});
 * });
 * ```
 *
 * - rooms
 *
 * ```
 * const orderNamespace = io.of("/orders");
 *
 * orderNamespace.on("connection", (socket) => {
 *   socket.join("room1");
 *   orderNamespace.to("room1").emit("hello");
 * });
 *
 * const userNamespace = io.of("/users");
 *
 * userNamespace.on("connection", (socket) => {
 *   socket.join("room1"); // distinct from the room in the "orders" namespace
 *   userNamespace.to("room1").emit("holà");
 * });
 * ```
 *
 * - middlewares
 *
 * ```
 * const orderNamespace = io.of("/orders");
 *
 * orderNamespace.use(async (socket) => {
 *   // ensure the socket has access to the "orders" namespace
 * });
 *
 * const userNamespace = io.of("/users");
 *
 * userNamespace.use(async (socket) => {
 *   // ensure the socket has access to the "users" namespace
 * });
 * ```
 */ export class Namespace extends EventEmitter {
  name;
  sockets = new Map();
  adapter;
  /* private */ _server;
  /* private */ _fns = [];
  /* private */ _ids = 0;
  constructor(server, name){
    super();
    this._server = server;
    this.name = name;
    this.adapter = server.opts.adapter(this);
  }
  /**
   * Registers a middleware, which is a function that gets executed for every incoming {@link Socket}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.use(async (socket) => {
   *   // ...
   * });
   *
   * @param fn - the middleware function
   */ use(fn) {
    this._fns.push(fn);
    return this;
  }
  /**
   * Executes the middleware for an incoming client.
   *
   * @param socket - the socket that will get added
   * @private
   */ async run(socket) {
    switch(this._fns.length){
      case 0:
        return;
      case 1:
        return this._fns[0](socket);
      default:
        for (const fn of this._fns.slice()){
          await fn(socket);
        }
    }
  }
  /**
   * Targets a room when emitting.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // the “foo” event will be broadcast to all connected clients in the “room-101” room
   * myNamespace.to("room-101").emit("foo", "bar");
   *
   * // with an array of rooms (a client will be notified at most once)
   * myNamespace.to(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * myNamespace.to("room-101").to("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ to(room) {
    return new BroadcastOperator(this.adapter).to(room);
  }
  /**
   * Targets a room when emitting. Similar to `to()`, but might feel clearer in some cases:
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // disconnect all clients in the "room-101" room
   * myNamespace.in("room-101").disconnectSockets();
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ in(room) {
    return new BroadcastOperator(this.adapter).in(room);
  }
  /**
   * Excludes a room when emitting.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // the "foo" event will be broadcast to all connected clients, except the ones that are in the "room-101" room
   * myNamespace.except("room-101").emit("foo", "bar");
   *
   * // with an array of rooms
   * myNamespace.except(["room-101", "room-102"]).emit("foo", "bar");
   *
   * // with multiple chained calls
   * myNamespace.except("room-101").except("room-102").emit("foo", "bar");
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ except(room) {
    return new BroadcastOperator(this.adapter).except(room);
  }
  /**
   * Adds a new client
   *
   * @param client - the client
   * @param handshake - the handshake
   * @private
   */ /* private */ async _add(client, handshake, callback) {
    getLogger("socket.io").debug(`[namespace] adding socket to nsp ${this.name}`);
    const socket = new Socket(this, client, handshake);
    try {
      await this.run(socket);
    } catch (err) {
      const e = err;
      getLogger("socket.io").debug("[namespace] middleware error, sending CONNECT_ERROR packet to the client");
      socket._cleanup();
      return socket._error({
        message: e.message || err,
        data: e.data
      });
    }
    if (client.conn.readyState !== "open") {
      getLogger("socket.io").debug("[namespace] next called after client was closed - ignoring socket");
      socket._cleanup();
      return;
    }
    // track socket
    this.sockets.set(socket.id, socket);
    // it's paramount that the internal `onconnect` logic
    // fires before user-set events to prevent state order
    // violations (such as a disconnection before the connection
    // logic is complete)
    socket._onconnect();
    callback(socket);
    // fire user-set events
    this.emitReserved("connection", socket);
  }
  /**
   * Removes a client. Called by each `Socket`.
   *
   * @private
   */ /* private */ _remove(socket) {
    this.sockets.delete(socket.id);
  }
  /**
   * Emits to all connected clients.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.emit("hello", "world");
   *
   * // all serializable datastructures are supported (no need to call JSON.stringify)
   * myNamespace.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
   *
   * // with an acknowledgement from the clients
   * myNamespace.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @return Always true
   */ emit(ev, ...args) {
    return new BroadcastOperator(this.adapter).emit(ev, ...args);
  }
  /**
   * Sends a `message` event to all clients.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.send("hello");
   *
   * // this is equivalent to
   * myNamespace.emit("message", "hello");
   *
   * @return self
   */ send(...args) {
    this.emit("message", ...args);
    return this;
  }
  /**
   * Sends a message to the other Socket.IO servers of the cluster.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.serverSideEmit("hello", "world");
   *
   * myNamespace.on("hello", (arg1) => {
   *   console.log(arg1); // prints "world"
   * });
   *
   * // acknowledgements (without binary content) are supported too:
   * myNamespace.serverSideEmit("ping", (err, responses) => {
   *  if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * myNamespace.on("ping", (cb) => {
   *   cb("pong");
   * });
   *
   * @param ev - the event name
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   */ serverSideEmit(ev, ...args) {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }
    args.unshift(ev);
    this.adapter.serverSideEmit(args);
    return true;
  }
  /**
   * Called when a packet is received from another Socket.IO server
   *
   * @param args - an array of arguments, which may include an acknowledgement callback at the end
   *
   * @private
   */ /* private */ _onServerSideEmit(args) {
    // @ts-ignore FIXME
    super.emit.apply(this, args);
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.volatile.emit("hello"); // the clients may or may not receive it
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */ get volatile() {
    return new BroadcastOperator(this.adapter).volatile;
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // the “foo” event will be broadcast to all connected clients on this node
   * myNamespace.local.emit("foo", "bar");
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */ get local() {
    return new BroadcastOperator(this.adapter).local;
  }
  /**
   * Adds a timeout in milliseconds for the next operation.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * myNamespace.timeout(1000).emit("some-event", (err, responses) => {
   *   if (err) {
   *     // some clients did not acknowledge the event in the given delay
   *   } else {
   *     console.log(responses); // one response per client
   *   }
   * });
   *
   * @param timeout
   */ timeout(timeout) {
    return new BroadcastOperator(this.adapter).timeout(timeout);
  }
  /**
   * Returns the matching socket instances.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // return all Socket instances
   * const sockets = await myNamespace.fetchSockets();
   *
   * // return all Socket instances in the "room1" room
   * const sockets = await myNamespace.in("room1").fetchSockets();
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
    return new BroadcastOperator(this.adapter).fetchSockets();
  }
  /**
   * Makes the matching socket instances join the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // make all socket instances join the "room1" room
   * myNamespace.socketsJoin("room1");
   *
   * // make all socket instances in the "room1" room join the "room2" and "room3" rooms
   * myNamespace.in("room1").socketsJoin(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */ socketsJoin(room) {
    return new BroadcastOperator(this.adapter).socketsJoin(room);
  }
  /**
   * Makes the matching socket instances leave the specified rooms.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // make all socket instances leave the "room1" room
   * myNamespace.socketsLeave("room1");
   *
   * // make all socket instances in the "room1" room leave the "room2" and "room3" rooms
   * myNamespace.in("room1").socketsLeave(["room2", "room3"]);
   *
   * @param room - a room, or an array of rooms
   */ socketsLeave(room) {
    return new BroadcastOperator(this.adapter).socketsLeave(room);
  }
  /**
   * Makes the matching socket instances disconnect.
   *
   * Note: this method also works within a cluster of multiple Socket.IO servers, with a compatible {@link Adapter}.
   *
   * @example
   * const myNamespace = io.of("/my-namespace");
   *
   * // make all socket instances disconnect (the connections might be kept alive for other namespaces)
   * myNamespace.disconnectSockets();
   *
   * // make all socket instances in the "room1" room disconnect and close the underlying connections
   * myNamespace.in("room1").disconnectSockets(true);
   *
   * @param close - whether to close the underlying connection
   */ disconnectSockets(close = false) {
    return new BroadcastOperator(this.adapter).disconnectSockets(close);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL3NvY2tldC5pby9saWIvbmFtZXNwYWNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIERlZmF1bHRFdmVudHNNYXAsXG4gIEV2ZW50RW1pdHRlcixcbiAgRXZlbnROYW1lcyxcbiAgRXZlbnRQYXJhbXMsXG4gIEV2ZW50c01hcCxcbn0gZnJvbSBcIi4uLy4uL2V2ZW50LWVtaXR0ZXIvbW9kLnRzXCI7XG5pbXBvcnQgeyBIYW5kc2hha2UsIFNvY2tldCB9IGZyb20gXCIuL3NvY2tldC50c1wiO1xuaW1wb3J0IHsgU2VydmVyLCBTZXJ2ZXJSZXNlcnZlZEV2ZW50cyB9IGZyb20gXCIuL3NlcnZlci50c1wiO1xuaW1wb3J0IHsgQWRhcHRlciwgUm9vbSwgU29ja2V0SWQgfSBmcm9tIFwiLi9hZGFwdGVyLnRzXCI7XG5pbXBvcnQgeyBDbGllbnQgfSBmcm9tIFwiLi9jbGllbnQudHNcIjtcbmltcG9ydCB7IGdldExvZ2dlciB9IGZyb20gXCIuLi8uLi8uLi9kZXBzLnRzXCI7XG5pbXBvcnQgeyBCcm9hZGNhc3RPcGVyYXRvciwgUmVtb3RlU29ja2V0IH0gZnJvbSBcIi4vYnJvYWRjYXN0LW9wZXJhdG9yLnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmFtZXNwYWNlUmVzZXJ2ZWRFdmVudHM8XG4gIExpc3RlbkV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCxcbiAgRW1pdEV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCxcbiAgU2VydmVyU2lkZUV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCxcbiAgU29ja2V0RGF0YSxcbj4ge1xuICBjb25uZWN0aW9uOiAoXG4gICAgc29ja2V0OiBTb2NrZXQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPixcbiAgKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgUkVTRVJWRURfRVZFTlRTOiBSZWFkb25seVNldDxzdHJpbmcgfCBzeW1ib2w+ID0gbmV3IFNldDxcbiAga2V5b2YgU2VydmVyUmVzZXJ2ZWRFdmVudHM8bmV2ZXIsIG5ldmVyLCBuZXZlciwgbmV2ZXI+XG4+KFtcImNvbm5lY3Rpb25cIiwgXCJuZXdfbmFtZXNwYWNlXCJdIGFzIGNvbnN0KTtcblxuLyoqXG4gKiBBIE5hbWVzcGFjZSBpcyBhIGNvbW11bmljYXRpb24gY2hhbm5lbCB0aGF0IGFsbG93cyB5b3UgdG8gc3BsaXQgdGhlIGxvZ2ljIG9mIHlvdXIgYXBwbGljYXRpb24gb3ZlciBhIHNpbmdsZSBzaGFyZWRcbiAqIGNvbm5lY3Rpb24uXG4gKlxuICogRWFjaCBuYW1lc3BhY2UgaGFzIGl0cyBvd246XG4gKlxuICogLSBldmVudCBoYW5kbGVyc1xuICpcbiAqIGBgYFxuICogaW8ub2YoXCIvb3JkZXJzXCIpLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gKiAgIHNvY2tldC5vbihcIm9yZGVyOmxpc3RcIiwgKCkgPT4ge30pO1xuICogICBzb2NrZXQub24oXCJvcmRlcjpjcmVhdGVcIiwgKCkgPT4ge30pO1xuICogfSk7XG4gKlxuICogaW8ub2YoXCIvdXNlcnNcIikub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAqICAgc29ja2V0Lm9uKFwidXNlcjpsaXN0XCIsICgpID0+IHt9KTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogLSByb29tc1xuICpcbiAqIGBgYFxuICogY29uc3Qgb3JkZXJOYW1lc3BhY2UgPSBpby5vZihcIi9vcmRlcnNcIik7XG4gKlxuICogb3JkZXJOYW1lc3BhY2Uub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAqICAgc29ja2V0LmpvaW4oXCJyb29tMVwiKTtcbiAqICAgb3JkZXJOYW1lc3BhY2UudG8oXCJyb29tMVwiKS5lbWl0KFwiaGVsbG9cIik7XG4gKiB9KTtcbiAqXG4gKiBjb25zdCB1c2VyTmFtZXNwYWNlID0gaW8ub2YoXCIvdXNlcnNcIik7XG4gKlxuICogdXNlck5hbWVzcGFjZS5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICogICBzb2NrZXQuam9pbihcInJvb20xXCIpOyAvLyBkaXN0aW5jdCBmcm9tIHRoZSByb29tIGluIHRoZSBcIm9yZGVyc1wiIG5hbWVzcGFjZVxuICogICB1c2VyTmFtZXNwYWNlLnRvKFwicm9vbTFcIikuZW1pdChcImhvbMOgXCIpO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiAtIG1pZGRsZXdhcmVzXG4gKlxuICogYGBgXG4gKiBjb25zdCBvcmRlck5hbWVzcGFjZSA9IGlvLm9mKFwiL29yZGVyc1wiKTtcbiAqXG4gKiBvcmRlck5hbWVzcGFjZS51c2UoYXN5bmMgKHNvY2tldCkgPT4ge1xuICogICAvLyBlbnN1cmUgdGhlIHNvY2tldCBoYXMgYWNjZXNzIHRvIHRoZSBcIm9yZGVyc1wiIG5hbWVzcGFjZVxuICogfSk7XG4gKlxuICogY29uc3QgdXNlck5hbWVzcGFjZSA9IGlvLm9mKFwiL3VzZXJzXCIpO1xuICpcbiAqIHVzZXJOYW1lc3BhY2UudXNlKGFzeW5jIChzb2NrZXQpID0+IHtcbiAqICAgLy8gZW5zdXJlIHRoZSBzb2NrZXQgaGFzIGFjY2VzcyB0byB0aGUgXCJ1c2Vyc1wiIG5hbWVzcGFjZVxuICogfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIE5hbWVzcGFjZTxcbiAgTGlzdGVuRXZlbnRzIGV4dGVuZHMgRXZlbnRzTWFwID0gRGVmYXVsdEV2ZW50c01hcCxcbiAgRW1pdEV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCA9IERlZmF1bHRFdmVudHNNYXAsXG4gIFNlcnZlclNpZGVFdmVudHMgZXh0ZW5kcyBFdmVudHNNYXAgPSBEZWZhdWx0RXZlbnRzTWFwLFxuICBTb2NrZXREYXRhID0gdW5rbm93bixcbj4gZXh0ZW5kcyBFdmVudEVtaXR0ZXI8XG4gIFNlcnZlclNpZGVFdmVudHMsXG4gIEVtaXRFdmVudHMsXG4gIE5hbWVzcGFjZVJlc2VydmVkRXZlbnRzPFxuICAgIExpc3RlbkV2ZW50cyxcbiAgICBFbWl0RXZlbnRzLFxuICAgIFNlcnZlclNpZGVFdmVudHMsXG4gICAgU29ja2V0RGF0YVxuICA+XG4+IHtcbiAgcHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IHNvY2tldHM6IE1hcDxcbiAgICBTb2NrZXRJZCxcbiAgICBTb2NrZXQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPlxuICA+ID0gbmV3IE1hcCgpO1xuICBwdWJsaWMgYWRhcHRlcjogQWRhcHRlcjtcblxuICAvKiBwcml2YXRlICovIHJlYWRvbmx5IF9zZXJ2ZXI6IFNlcnZlcjxcbiAgICBMaXN0ZW5FdmVudHMsXG4gICAgRW1pdEV2ZW50cyxcbiAgICBTZXJ2ZXJTaWRlRXZlbnRzLFxuICAgIFNvY2tldERhdGFcbiAgPjtcblxuICAvKiBwcml2YXRlICovIF9mbnM6IEFycmF5PFxuICAgIChcbiAgICAgIHNvY2tldDogU29ja2V0PExpc3RlbkV2ZW50cywgRW1pdEV2ZW50cywgU2VydmVyU2lkZUV2ZW50cywgU29ja2V0RGF0YT4sXG4gICAgKSA9PiBQcm9taXNlPHZvaWQ+XG4gID4gPSBbXTtcblxuICAvKiBwcml2YXRlICovIF9pZHMgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHNlcnZlcjogU2VydmVyPExpc3RlbkV2ZW50cywgRW1pdEV2ZW50cywgU2VydmVyU2lkZUV2ZW50cywgU29ja2V0RGF0YT4sXG4gICAgbmFtZTogc3RyaW5nLFxuICApIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX3NlcnZlciA9IHNlcnZlcjtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYWRhcHRlciA9IHNlcnZlci5vcHRzLmFkYXB0ZXIodGhpcyBhcyBOYW1lc3BhY2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVycyBhIG1pZGRsZXdhcmUsIHdoaWNoIGlzIGEgZnVuY3Rpb24gdGhhdCBnZXRzIGV4ZWN1dGVkIGZvciBldmVyeSBpbmNvbWluZyB7QGxpbmsgU29ja2V0fS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgbXlOYW1lc3BhY2UgPSBpby5vZihcIi9teS1uYW1lc3BhY2VcIik7XG4gICAqXG4gICAqIG15TmFtZXNwYWNlLnVzZShhc3luYyAoc29ja2V0KSA9PiB7XG4gICAqICAgLy8gLi4uXG4gICAqIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gZm4gLSB0aGUgbWlkZGxld2FyZSBmdW5jdGlvblxuICAgKi9cbiAgcHVibGljIHVzZShcbiAgICBmbjogKFxuICAgICAgc29ja2V0OiBTb2NrZXQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPixcbiAgICApID0+IFByb21pc2U8dm9pZD4sXG4gICk6IHRoaXMge1xuICAgIHRoaXMuX2Zucy5wdXNoKGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlcyB0aGUgbWlkZGxld2FyZSBmb3IgYW4gaW5jb21pbmcgY2xpZW50LlxuICAgKlxuICAgKiBAcGFyYW0gc29ja2V0IC0gdGhlIHNvY2tldCB0aGF0IHdpbGwgZ2V0IGFkZGVkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHJ1bihcbiAgICBzb2NrZXQ6IFNvY2tldDxMaXN0ZW5FdmVudHMsIEVtaXRFdmVudHMsIFNlcnZlclNpZGVFdmVudHMsIFNvY2tldERhdGE+LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBzd2l0Y2ggKHRoaXMuX2Zucy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMDpcbiAgICAgICAgcmV0dXJuO1xuICAgICAgY2FzZSAxOlxuICAgICAgICByZXR1cm4gdGhpcy5fZm5zWzBdKHNvY2tldCk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBmb3IgKGNvbnN0IGZuIG9mIHRoaXMuX2Zucy5zbGljZSgpKSB7XG4gICAgICAgICAgYXdhaXQgZm4oc29ja2V0KTtcbiAgICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUYXJnZXRzIGEgcm9vbSB3aGVuIGVtaXR0aW5nLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogLy8gdGhlIOKAnGZvb+KAnSBldmVudCB3aWxsIGJlIGJyb2FkY2FzdCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMgaW4gdGhlIOKAnHJvb20tMTAx4oCdIHJvb21cbiAgICogbXlOYW1lc3BhY2UudG8oXCJyb29tLTEwMVwiKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKlxuICAgKiAvLyB3aXRoIGFuIGFycmF5IG9mIHJvb21zIChhIGNsaWVudCB3aWxsIGJlIG5vdGlmaWVkIGF0IG1vc3Qgb25jZSlcbiAgICogbXlOYW1lc3BhY2UudG8oW1wicm9vbS0xMDFcIiwgXCJyb29tLTEwMlwiXSkuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogLy8gd2l0aCBtdWx0aXBsZSBjaGFpbmVkIGNhbGxzXG4gICAqIG15TmFtZXNwYWNlLnRvKFwicm9vbS0xMDFcIikudG8oXCJyb29tLTEwMlwiKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKlxuICAgKiBAcGFyYW0gcm9vbSAtIGEgcm9vbSwgb3IgYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIHRvKHJvb206IFJvb20gfCBSb29tW10pOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIG5ldyBCcm9hZGNhc3RPcGVyYXRvcih0aGlzLmFkYXB0ZXIpLnRvKHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRhcmdldHMgYSByb29tIHdoZW4gZW1pdHRpbmcuIFNpbWlsYXIgdG8gYHRvKClgLCBidXQgbWlnaHQgZmVlbCBjbGVhcmVyIGluIHNvbWUgY2FzZXM6XG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IG15TmFtZXNwYWNlID0gaW8ub2YoXCIvbXktbmFtZXNwYWNlXCIpO1xuICAgKlxuICAgKiAvLyBkaXNjb25uZWN0IGFsbCBjbGllbnRzIGluIHRoZSBcInJvb20tMTAxXCIgcm9vbVxuICAgKiBteU5hbWVzcGFjZS5pbihcInJvb20tMTAxXCIpLmRpc2Nvbm5lY3RTb2NrZXRzKCk7XG4gICAqXG4gICAqIEBwYXJhbSByb29tIC0gYSByb29tLCBvciBhbiBhcnJheSBvZiByb29tc1xuICAgKiBAcmV0dXJuIGEgbmV3IHtAbGluayBCcm9hZGNhc3RPcGVyYXRvcn0gaW5zdGFuY2UgZm9yIGNoYWluaW5nXG4gICAqL1xuICBwdWJsaWMgaW4ocm9vbTogUm9vbSB8IFJvb21bXSk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gbmV3IEJyb2FkY2FzdE9wZXJhdG9yKHRoaXMuYWRhcHRlcikuaW4ocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogRXhjbHVkZXMgYSByb29tIHdoZW4gZW1pdHRpbmcuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IG15TmFtZXNwYWNlID0gaW8ub2YoXCIvbXktbmFtZXNwYWNlXCIpO1xuICAgKlxuICAgKiAvLyB0aGUgXCJmb29cIiBldmVudCB3aWxsIGJlIGJyb2FkY2FzdCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMsIGV4Y2VwdCB0aGUgb25lcyB0aGF0IGFyZSBpbiB0aGUgXCJyb29tLTEwMVwiIHJvb21cbiAgICogbXlOYW1lc3BhY2UuZXhjZXB0KFwicm9vbS0xMDFcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogLy8gd2l0aCBhbiBhcnJheSBvZiByb29tc1xuICAgKiBteU5hbWVzcGFjZS5leGNlcHQoW1wicm9vbS0xMDFcIiwgXCJyb29tLTEwMlwiXSkuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogLy8gd2l0aCBtdWx0aXBsZSBjaGFpbmVkIGNhbGxzXG4gICAqIG15TmFtZXNwYWNlLmV4Y2VwdChcInJvb20tMTAxXCIpLmV4Y2VwdChcInJvb20tMTAyXCIpLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqXG4gICAqIEBwYXJhbSByb29tIC0gYSByb29tLCBvciBhbiBhcnJheSBvZiByb29tc1xuICAgKiBAcmV0dXJuIGEgbmV3IHtAbGluayBCcm9hZGNhc3RPcGVyYXRvcn0gaW5zdGFuY2UgZm9yIGNoYWluaW5nXG4gICAqL1xuICBwdWJsaWMgZXhjZXB0KFxuICAgIHJvb206IFJvb20gfCBSb29tW10sXG4gICk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gbmV3IEJyb2FkY2FzdE9wZXJhdG9yKHRoaXMuYWRhcHRlcikuZXhjZXB0KHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBuZXcgY2xpZW50XG4gICAqXG4gICAqIEBwYXJhbSBjbGllbnQgLSB0aGUgY2xpZW50XG4gICAqIEBwYXJhbSBoYW5kc2hha2UgLSB0aGUgaGFuZHNoYWtlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAvKiBwcml2YXRlICovIGFzeW5jIF9hZGQoXG4gICAgY2xpZW50OiBDbGllbnQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPixcbiAgICBoYW5kc2hha2U6IEhhbmRzaGFrZSxcbiAgICBjYWxsYmFjazogKFxuICAgICAgc29ja2V0OiBTb2NrZXQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPixcbiAgICApID0+IHZvaWQsXG4gICkge1xuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbbmFtZXNwYWNlXSBhZGRpbmcgc29ja2V0IHRvIG5zcCAke3RoaXMubmFtZX1gLFxuICAgICk7XG4gICAgY29uc3Qgc29ja2V0ID0gbmV3IFNvY2tldDxcbiAgICAgIExpc3RlbkV2ZW50cyxcbiAgICAgIEVtaXRFdmVudHMsXG4gICAgICBTZXJ2ZXJTaWRlRXZlbnRzLFxuICAgICAgU29ja2V0RGF0YVxuICAgID4odGhpcywgY2xpZW50LCBoYW5kc2hha2UpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMucnVuKHNvY2tldCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBlID0gZXJyIGFzIEVycm9yICYgeyBkYXRhOiBzdHJpbmcgfTtcbiAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgXCJbbmFtZXNwYWNlXSBtaWRkbGV3YXJlIGVycm9yLCBzZW5kaW5nIENPTk5FQ1RfRVJST1IgcGFja2V0IHRvIHRoZSBjbGllbnRcIixcbiAgICAgICk7XG4gICAgICBzb2NrZXQuX2NsZWFudXAoKTtcbiAgICAgIHJldHVybiBzb2NrZXQuX2Vycm9yKHtcbiAgICAgICAgbWVzc2FnZTogZS5tZXNzYWdlIHx8IGVyciBhcyBzdHJpbmcsXG4gICAgICAgIGRhdGE6IGUuZGF0YSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChjbGllbnQuY29ubi5yZWFkeVN0YXRlICE9PSBcIm9wZW5cIikge1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICBcIltuYW1lc3BhY2VdIG5leHQgY2FsbGVkIGFmdGVyIGNsaWVudCB3YXMgY2xvc2VkIC0gaWdub3Jpbmcgc29ja2V0XCIsXG4gICAgICApO1xuICAgICAgc29ja2V0Ll9jbGVhbnVwKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gdHJhY2sgc29ja2V0XG4gICAgdGhpcy5zb2NrZXRzLnNldChzb2NrZXQuaWQsIHNvY2tldCk7XG5cbiAgICAvLyBpdCdzIHBhcmFtb3VudCB0aGF0IHRoZSBpbnRlcm5hbCBgb25jb25uZWN0YCBsb2dpY1xuICAgIC8vIGZpcmVzIGJlZm9yZSB1c2VyLXNldCBldmVudHMgdG8gcHJldmVudCBzdGF0ZSBvcmRlclxuICAgIC8vIHZpb2xhdGlvbnMgKHN1Y2ggYXMgYSBkaXNjb25uZWN0aW9uIGJlZm9yZSB0aGUgY29ubmVjdGlvblxuICAgIC8vIGxvZ2ljIGlzIGNvbXBsZXRlKVxuICAgIHNvY2tldC5fb25jb25uZWN0KCk7XG5cbiAgICBjYWxsYmFjayhzb2NrZXQpO1xuXG4gICAgLy8gZmlyZSB1c2VyLXNldCBldmVudHNcbiAgICB0aGlzLmVtaXRSZXNlcnZlZChcImNvbm5lY3Rpb25cIiwgc29ja2V0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgY2xpZW50LiBDYWxsZWQgYnkgZWFjaCBgU29ja2V0YC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIC8qIHByaXZhdGUgKi8gX3JlbW92ZShcbiAgICBzb2NrZXQ6IFNvY2tldDxMaXN0ZW5FdmVudHMsIEVtaXRFdmVudHMsIFNlcnZlclNpZGVFdmVudHMsIFNvY2tldERhdGE+LFxuICApOiB2b2lkIHtcbiAgICB0aGlzLnNvY2tldHMuZGVsZXRlKHNvY2tldC5pZCk7XG4gIH1cblxuICAvKipcbiAgICogRW1pdHMgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogbXlOYW1lc3BhY2UuZW1pdChcImhlbGxvXCIsIFwid29ybGRcIik7XG4gICAqXG4gICAqIC8vIGFsbCBzZXJpYWxpemFibGUgZGF0YXN0cnVjdHVyZXMgYXJlIHN1cHBvcnRlZCAobm8gbmVlZCB0byBjYWxsIEpTT04uc3RyaW5naWZ5KVxuICAgKiBteU5hbWVzcGFjZS5lbWl0KFwiaGVsbG9cIiwgMSwgXCIyXCIsIHsgMzogW1wiNFwiXSwgNTogVWludDhBcnJheS5mcm9tKFs2XSkgfSk7XG4gICAqXG4gICAqIC8vIHdpdGggYW4gYWNrbm93bGVkZ2VtZW50IGZyb20gdGhlIGNsaWVudHNcbiAgICogbXlOYW1lc3BhY2UudGltZW91dCgxMDAwKS5lbWl0KFwic29tZS1ldmVudFwiLCAoZXJyLCByZXNwb25zZXMpID0+IHtcbiAgICogICBpZiAoZXJyKSB7XG4gICAqICAgICAvLyBzb21lIGNsaWVudHMgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7IC8vIG9uZSByZXNwb25zZSBwZXIgY2xpZW50XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogQHJldHVybiBBbHdheXMgdHJ1ZVxuICAgKi9cbiAgb3ZlcnJpZGUgZW1pdDxFdiBleHRlbmRzIEV2ZW50TmFtZXM8RW1pdEV2ZW50cz4+KFxuICAgIGV2OiBFdixcbiAgICAuLi5hcmdzOiBFdmVudFBhcmFtczxFbWl0RXZlbnRzLCBFdj5cbiAgKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIG5ldyBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPih0aGlzLmFkYXB0ZXIpLmVtaXQoXG4gICAgICBldixcbiAgICAgIC4uLmFyZ3MsXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kcyBhIGBtZXNzYWdlYCBldmVudCB0byBhbGwgY2xpZW50cy5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgbWltaWNzIHRoZSBXZWJTb2NrZXQuc2VuZCgpIG1ldGhvZC5cbiAgICpcbiAgICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2ViU29ja2V0L3NlbmRcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgbXlOYW1lc3BhY2UgPSBpby5vZihcIi9teS1uYW1lc3BhY2VcIik7XG4gICAqXG4gICAqIG15TmFtZXNwYWNlLnNlbmQoXCJoZWxsb1wiKTtcbiAgICpcbiAgICogLy8gdGhpcyBpcyBlcXVpdmFsZW50IHRvXG4gICAqIG15TmFtZXNwYWNlLmVtaXQoXCJtZXNzYWdlXCIsIFwiaGVsbG9cIik7XG4gICAqXG4gICAqIEByZXR1cm4gc2VsZlxuICAgKi9cbiAgcHVibGljIHNlbmQoLi4uYXJnczogRXZlbnRQYXJhbXM8RW1pdEV2ZW50cywgXCJtZXNzYWdlXCI+KTogdGhpcyB7XG4gICAgdGhpcy5lbWl0KFwibWVzc2FnZVwiLCAuLi5hcmdzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kcyBhIG1lc3NhZ2UgdG8gdGhlIG90aGVyIFNvY2tldC5JTyBzZXJ2ZXJzIG9mIHRoZSBjbHVzdGVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogbXlOYW1lc3BhY2Uuc2VydmVyU2lkZUVtaXQoXCJoZWxsb1wiLCBcIndvcmxkXCIpO1xuICAgKlxuICAgKiBteU5hbWVzcGFjZS5vbihcImhlbGxvXCIsIChhcmcxKSA9PiB7XG4gICAqICAgY29uc29sZS5sb2coYXJnMSk7IC8vIHByaW50cyBcIndvcmxkXCJcbiAgICogfSk7XG4gICAqXG4gICAqIC8vIGFja25vd2xlZGdlbWVudHMgKHdpdGhvdXQgYmluYXJ5IGNvbnRlbnQpIGFyZSBzdXBwb3J0ZWQgdG9vOlxuICAgKiBteU5hbWVzcGFjZS5zZXJ2ZXJTaWRlRW1pdChcInBpbmdcIiwgKGVyciwgcmVzcG9uc2VzKSA9PiB7XG4gICAqICBpZiAoZXJyKSB7XG4gICAqICAgICAvLyBzb21lIGNsaWVudHMgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7IC8vIG9uZSByZXNwb25zZSBwZXIgY2xpZW50XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogbXlOYW1lc3BhY2Uub24oXCJwaW5nXCIsIChjYikgPT4ge1xuICAgKiAgIGNiKFwicG9uZ1wiKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSBldiAtIHRoZSBldmVudCBuYW1lXG4gICAqIEBwYXJhbSBhcmdzIC0gYW4gYXJyYXkgb2YgYXJndW1lbnRzLCB3aGljaCBtYXkgaW5jbHVkZSBhbiBhY2tub3dsZWRnZW1lbnQgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgKi9cbiAgcHVibGljIHNlcnZlclNpZGVFbWl0PEV2IGV4dGVuZHMgRXZlbnROYW1lczxTZXJ2ZXJTaWRlRXZlbnRzPj4oXG4gICAgZXY6IEV2LFxuICAgIC4uLmFyZ3M6IEV2ZW50UGFyYW1zPFNlcnZlclNpZGVFdmVudHMsIEV2PlxuICApOiBib29sZWFuIHtcbiAgICBpZiAoUkVTRVJWRURfRVZFTlRTLmhhcyhldikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgXCIke1N0cmluZyhldil9XCIgaXMgYSByZXNlcnZlZCBldmVudCBuYW1lYCk7XG4gICAgfVxuICAgIGFyZ3MudW5zaGlmdChldik7XG4gICAgdGhpcy5hZGFwdGVyLnNlcnZlclNpZGVFbWl0KGFyZ3MpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIGEgcGFja2V0IGlzIHJlY2VpdmVkIGZyb20gYW5vdGhlciBTb2NrZXQuSU8gc2VydmVyXG4gICAqXG4gICAqIEBwYXJhbSBhcmdzIC0gYW4gYXJyYXkgb2YgYXJndW1lbnRzLCB3aGljaCBtYXkgaW5jbHVkZSBhbiBhY2tub3dsZWRnZW1lbnQgY2FsbGJhY2sgYXQgdGhlIGVuZFxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgLyogcHJpdmF0ZSAqLyBfb25TZXJ2ZXJTaWRlRW1pdChhcmdzOiBbc3RyaW5nLCAuLi51bmtub3duW11dKSB7XG4gICAgLy8gQHRzLWlnbm9yZSBGSVhNRVxuICAgIHN1cGVyLmVtaXQuYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBhIG1vZGlmaWVyIGZvciBhIHN1YnNlcXVlbnQgZXZlbnQgZW1pc3Npb24gdGhhdCB0aGUgZXZlbnQgZGF0YSBtYXkgYmUgbG9zdCBpZiB0aGUgY2xpZW50IGlzIG5vdCByZWFkeSB0b1xuICAgKiByZWNlaXZlIG1lc3NhZ2VzIChiZWNhdXNlIG9mIG5ldHdvcmsgc2xvd25lc3Mgb3Igb3RoZXIgaXNzdWVzLCBvciBiZWNhdXNlIHRoZXnigJlyZSBjb25uZWN0ZWQgdGhyb3VnaCBsb25nIHBvbGxpbmdcbiAgICogYW5kIGlzIGluIHRoZSBtaWRkbGUgb2YgYSByZXF1ZXN0LXJlc3BvbnNlIGN5Y2xlKS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgbXlOYW1lc3BhY2UgPSBpby5vZihcIi9teS1uYW1lc3BhY2VcIik7XG4gICAqXG4gICAqIG15TmFtZXNwYWNlLnZvbGF0aWxlLmVtaXQoXCJoZWxsb1wiKTsgLy8gdGhlIGNsaWVudHMgbWF5IG9yIG1heSBub3QgcmVjZWl2ZSBpdFxuICAgKlxuICAgKiBAcmV0dXJuIGEgbmV3IHtAbGluayBCcm9hZGNhc3RPcGVyYXRvcn0gaW5zdGFuY2UgZm9yIGNoYWluaW5nXG4gICAqL1xuICBwdWJsaWMgZ2V0IHZvbGF0aWxlKCk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gbmV3IEJyb2FkY2FzdE9wZXJhdG9yKHRoaXMuYWRhcHRlcikudm9sYXRpbGU7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBhIG1vZGlmaWVyIGZvciBhIHN1YnNlcXVlbnQgZXZlbnQgZW1pc3Npb24gdGhhdCB0aGUgZXZlbnQgZGF0YSB3aWxsIG9ubHkgYmUgYnJvYWRjYXN0IHRvIHRoZSBjdXJyZW50IG5vZGUuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IG15TmFtZXNwYWNlID0gaW8ub2YoXCIvbXktbmFtZXNwYWNlXCIpO1xuICAgKlxuICAgKiAvLyB0aGUg4oCcZm9v4oCdIGV2ZW50IHdpbGwgYmUgYnJvYWRjYXN0IHRvIGFsbCBjb25uZWN0ZWQgY2xpZW50cyBvbiB0aGlzIG5vZGVcbiAgICogbXlOYW1lc3BhY2UubG9jYWwuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIGdldCBsb2NhbCgpOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIG5ldyBCcm9hZGNhc3RPcGVyYXRvcih0aGlzLmFkYXB0ZXIpLmxvY2FsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSB0aW1lb3V0IGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIG5leHQgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogbXlOYW1lc3BhY2UudGltZW91dCgxMDAwKS5lbWl0KFwic29tZS1ldmVudFwiLCAoZXJyLCByZXNwb25zZXMpID0+IHtcbiAgICogICBpZiAoZXJyKSB7XG4gICAqICAgICAvLyBzb21lIGNsaWVudHMgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7IC8vIG9uZSByZXNwb25zZSBwZXIgY2xpZW50XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIHRpbWVvdXRcbiAgICovXG4gIHB1YmxpYyB0aW1lb3V0KHRpbWVvdXQ6IG51bWJlcikge1xuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IodGhpcy5hZGFwdGVyKS50aW1lb3V0KHRpbWVvdXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG1hdGNoaW5nIHNvY2tldCBpbnN0YW5jZXMuXG4gICAqXG4gICAqIE5vdGU6IHRoaXMgbWV0aG9kIGFsc28gd29ya3Mgd2l0aGluIGEgY2x1c3RlciBvZiBtdWx0aXBsZSBTb2NrZXQuSU8gc2VydmVycywgd2l0aCBhIGNvbXBhdGlibGUge0BsaW5rIEFkYXB0ZXJ9LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogLy8gcmV0dXJuIGFsbCBTb2NrZXQgaW5zdGFuY2VzXG4gICAqIGNvbnN0IHNvY2tldHMgPSBhd2FpdCBteU5hbWVzcGFjZS5mZXRjaFNvY2tldHMoKTtcbiAgICpcbiAgICogLy8gcmV0dXJuIGFsbCBTb2NrZXQgaW5zdGFuY2VzIGluIHRoZSBcInJvb20xXCIgcm9vbVxuICAgKiBjb25zdCBzb2NrZXRzID0gYXdhaXQgbXlOYW1lc3BhY2UuaW4oXCJyb29tMVwiKS5mZXRjaFNvY2tldHMoKTtcbiAgICpcbiAgICogZm9yIChjb25zdCBzb2NrZXQgb2Ygc29ja2V0cykge1xuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5pZCk7XG4gICAqICAgY29uc29sZS5sb2coc29ja2V0LmhhbmRzaGFrZSk7XG4gICAqICAgY29uc29sZS5sb2coc29ja2V0LnJvb21zKTtcbiAgICogICBjb25zb2xlLmxvZyhzb2NrZXQuZGF0YSk7XG4gICAqXG4gICAqICAgc29ja2V0LmVtaXQoXCJoZWxsb1wiKTtcbiAgICogICBzb2NrZXQuam9pbihcInJvb20xXCIpO1xuICAgKiAgIHNvY2tldC5sZWF2ZShcInJvb20yXCIpO1xuICAgKiAgIHNvY2tldC5kaXNjb25uZWN0KCk7XG4gICAqIH1cbiAgICovXG4gIHB1YmxpYyBmZXRjaFNvY2tldHMoKTogUHJvbWlzZTxSZW1vdGVTb2NrZXQ8RW1pdEV2ZW50cywgU29ja2V0RGF0YT5bXT4ge1xuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IodGhpcy5hZGFwdGVyKS5mZXRjaFNvY2tldHMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlcyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlcyBqb2luIHRoZSBzcGVjaWZpZWQgcm9vbXMuXG4gICAqXG4gICAqIE5vdGU6IHRoaXMgbWV0aG9kIGFsc28gd29ya3Mgd2l0aGluIGEgY2x1c3RlciBvZiBtdWx0aXBsZSBTb2NrZXQuSU8gc2VydmVycywgd2l0aCBhIGNvbXBhdGlibGUge0BsaW5rIEFkYXB0ZXJ9LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBqb2luIHRoZSBcInJvb20xXCIgcm9vbVxuICAgKiBteU5hbWVzcGFjZS5zb2NrZXRzSm9pbihcInJvb20xXCIpO1xuICAgKlxuICAgKiAvLyBtYWtlIGFsbCBzb2NrZXQgaW5zdGFuY2VzIGluIHRoZSBcInJvb20xXCIgcm9vbSBqb2luIHRoZSBcInJvb20yXCIgYW5kIFwicm9vbTNcIiByb29tc1xuICAgKiBteU5hbWVzcGFjZS5pbihcInJvb20xXCIpLnNvY2tldHNKb2luKFtcInJvb20yXCIsIFwicm9vbTNcIl0pO1xuICAgKlxuICAgKiBAcGFyYW0gcm9vbSAtIGEgcm9vbSwgb3IgYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICovXG4gIHB1YmxpYyBzb2NrZXRzSm9pbihyb29tOiBSb29tIHwgUm9vbVtdKTogdm9pZCB7XG4gICAgcmV0dXJuIG5ldyBCcm9hZGNhc3RPcGVyYXRvcih0aGlzLmFkYXB0ZXIpLnNvY2tldHNKb2luKHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIE1ha2VzIHRoZSBtYXRjaGluZyBzb2NrZXQgaW5zdGFuY2VzIGxlYXZlIHRoZSBzcGVjaWZpZWQgcm9vbXMuXG4gICAqXG4gICAqIE5vdGU6IHRoaXMgbWV0aG9kIGFsc28gd29ya3Mgd2l0aGluIGEgY2x1c3RlciBvZiBtdWx0aXBsZSBTb2NrZXQuSU8gc2VydmVycywgd2l0aCBhIGNvbXBhdGlibGUge0BsaW5rIEFkYXB0ZXJ9LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBsZWF2ZSB0aGUgXCJyb29tMVwiIHJvb21cbiAgICogbXlOYW1lc3BhY2Uuc29ja2V0c0xlYXZlKFwicm9vbTFcIik7XG4gICAqXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgaW4gdGhlIFwicm9vbTFcIiByb29tIGxlYXZlIHRoZSBcInJvb20yXCIgYW5kIFwicm9vbTNcIiByb29tc1xuICAgKiBteU5hbWVzcGFjZS5pbihcInJvb20xXCIpLnNvY2tldHNMZWF2ZShbXCJyb29tMlwiLCBcInJvb20zXCJdKTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqL1xuICBwdWJsaWMgc29ja2V0c0xlYXZlKHJvb206IFJvb20gfCBSb29tW10pOiB2b2lkIHtcbiAgICByZXR1cm4gbmV3IEJyb2FkY2FzdE9wZXJhdG9yKHRoaXMuYWRhcHRlcikuc29ja2V0c0xlYXZlKHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIE1ha2VzIHRoZSBtYXRjaGluZyBzb2NrZXQgaW5zdGFuY2VzIGRpc2Nvbm5lY3QuXG4gICAqXG4gICAqIE5vdGU6IHRoaXMgbWV0aG9kIGFsc28gd29ya3Mgd2l0aGluIGEgY2x1c3RlciBvZiBtdWx0aXBsZSBTb2NrZXQuSU8gc2VydmVycywgd2l0aCBhIGNvbXBhdGlibGUge0BsaW5rIEFkYXB0ZXJ9LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBteU5hbWVzcGFjZSA9IGlvLm9mKFwiL215LW5hbWVzcGFjZVwiKTtcbiAgICpcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBkaXNjb25uZWN0ICh0aGUgY29ubmVjdGlvbnMgbWlnaHQgYmUga2VwdCBhbGl2ZSBmb3Igb3RoZXIgbmFtZXNwYWNlcylcbiAgICogbXlOYW1lc3BhY2UuZGlzY29ubmVjdFNvY2tldHMoKTtcbiAgICpcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBpbiB0aGUgXCJyb29tMVwiIHJvb20gZGlzY29ubmVjdCBhbmQgY2xvc2UgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbnNcbiAgICogbXlOYW1lc3BhY2UuaW4oXCJyb29tMVwiKS5kaXNjb25uZWN0U29ja2V0cyh0cnVlKTtcbiAgICpcbiAgICogQHBhcmFtIGNsb3NlIC0gd2hldGhlciB0byBjbG9zZSB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uXG4gICAqL1xuICBwdWJsaWMgZGlzY29ubmVjdFNvY2tldHMoY2xvc2UgPSBmYWxzZSk6IHZvaWQge1xuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IodGhpcy5hZGFwdGVyKS5kaXNjb25uZWN0U29ja2V0cyhjbG9zZSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUVFLFlBQVksUUFJUCw2QkFBNkI7QUFDcEMsU0FBb0IsTUFBTSxRQUFRLGNBQWM7QUFJaEQsU0FBUyxTQUFTLFFBQVEsbUJBQW1CO0FBQzdDLFNBQVMsaUJBQWlCLFFBQXNCLDBCQUEwQjtBQWExRSxPQUFPLE1BQU0sa0JBQWdELElBQUksSUFFL0Q7RUFBQztFQUFjO0NBQWdCLEVBQVc7QUFFNUM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FvREMsR0FDRCxPQUFPLE1BQU0sa0JBS0g7RUFVUSxLQUFhO0VBQ2IsVUFHWixJQUFJLE1BQU07RUFD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
// denoCacheMetadata=1560488229119885432,3296779324881313243