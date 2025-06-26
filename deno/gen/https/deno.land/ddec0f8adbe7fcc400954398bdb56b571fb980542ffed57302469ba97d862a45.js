import { PacketType } from "../../socket.io-parser/mod.ts";
import { getLogger } from "../../../deps.ts";
import { EventEmitter } from "../../event-emitter/mod.ts";
import { generateId } from "../../engine.io/mod.ts";
import { BroadcastOperator } from "./broadcast-operator.ts";
export const RESERVED_EVENTS = new Set([
  "connect",
  "connect_error",
  "disconnect",
  "disconnecting",
  "newListener",
  "removeListener"
]);
function noop() {}
/**
 * This is the main object for interacting with a client.
 *
 * A Socket belongs to a given {@link Namespace} and uses an underlying {@link Client} to communicate.
 *
 * Within each {@link Namespace}, you can also define arbitrary channels (called "rooms") that the {@link Socket} can
 * join and leave. That provides a convenient way to broadcast to a group of socket instances.
 *
 * @example
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
 *   // join the room named "room1"
 *   socket.join("room1");
 *
 *   // broadcast to everyone in the room named "room1"
 *   io.to("room1").emit("hello");
 *
 *   // upon disconnection
 *   socket.on("disconnect", (reason) => {
 *     console.log(`socket ${socket.id} disconnected due to ${reason}`);
 *   });
 * });
 */ export class Socket extends EventEmitter {
  /**
   * An unique identifier for the session.
   */ id;
  /**
   * The handshake details.
   */ handshake;
  /**
   * Additional information that can be attached to the Socket instance and which will be used in the
   * {@link Server.fetchSockets()} method.
   */ data = {};
  /**
   * Whether the socket is currently connected or not.
   *
   * @example
   * io.use(async (socket) => {
   *   console.log(socket.connected); // false
   * });
   *
   * io.on("connection", (socket) => {
   *   console.log(socket.connected); // true
   * });
   */ connected = false;
  nsp;
  adapter;
  /* private */ _acks = new Map();
  flags = {};
  #anyIncomingListeners;
  #anyOutgoingListeners;
  #preConnectBuffer = [];
  /* private */ client;
  constructor(nsp, client, handshake){
    super();
    this.nsp = nsp;
    this.id = generateId();
    this.client = client;
    this.adapter = nsp.adapter;
    this.handshake = handshake;
  }
  /**
   * Emits to this client.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.emit("hello", "world");
   *
   *   // all serializable datastructures are supported (no need to call JSON.stringify)
   *   socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
   *
   *   // with an acknowledgement from the client
   *   socket.emit("hello", "world", (val) => {
   *     // ...
   *   });
   * });
   *
   * @return Always returns `true`.
   */ emit(ev, ...args) {
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }
    const data = [
      ev,
      ...args
    ];
    const packet = {
      nsp: this.nsp.name,
      type: PacketType.EVENT,
      data: data
    };
    // access last argument to see if it's an ACK callback
    if (typeof data[data.length - 1] === "function") {
      const id = this.nsp._ids++;
      getLogger("socket.io").debug(`[socket] emitting packet with ack id ${id}`);
      this.registerAckCallback(id, data.pop());
      packet.id = id;
    }
    const flags = Object.assign({}, this.flags);
    this.flags = {};
    if (this.connected) {
      this._notifyOutgoingListeners(packet.data);
      this.packet(packet, flags);
    } else {
      this.#preConnectBuffer.push(packet);
    }
    return true;
  }
  /**
   * @private
   */ registerAckCallback(id, ack) {
    const timeout = this.flags.timeout;
    if (timeout === undefined) {
      this._acks.set(id, ack);
      return;
    }
    const timerId = setTimeout(()=>{
      getLogger("socket.io").debug(`[socket] event with ack id ${id} has timed out after ${timeout} ms`);
      this._acks.delete(id);
      ack.call(this, new Error("operation has timed out"));
    }, timeout);
    this._acks.set(id, (...args)=>{
      clearTimeout(timerId);
      ack.apply(this, [
        null,
        ...args
      ]);
    });
  }
  /**
   * Targets a room when broadcasting.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the “foo” event will be broadcast to all connected clients in the “room-101” room, except this socket
   *   socket.to("room-101").emit("foo", "bar");
   *
   *   // the code above is equivalent to:
   *   io.to("room-101").except(socket.id).emit("foo", "bar");
   *
   *   // with an array of rooms (a client will be notified at most once)
   *   socket.to(["room-101", "room-102"]).emit("foo", "bar");
   *
   *   // with multiple chained calls
   *   socket.to("room-101").to("room-102").emit("foo", "bar");
   * });
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ to(room) {
    return this.newBroadcastOperator().to(room);
  }
  /**
   * Targets a room when broadcasting. Similar to `to()`, but might feel clearer in some cases:
   *
   * @example
   * io.on("connection", (socket) => {
   *   // disconnect all clients in the "room-101" room, except this socket
   *   socket.in("room-101").disconnectSockets();
   * });
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ in(room) {
    return this.newBroadcastOperator().in(room);
  }
  /**
   * Excludes a room when broadcasting.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the "foo" event will be broadcast to all connected clients, except the ones that are in the "room-101" room
   *   // and this socket
   *   socket.except("room-101").emit("foo", "bar");
   *
   *   // with an array of rooms
   *   socket.except(["room-101", "room-102"]).emit("foo", "bar");
   *
   *   // with multiple chained calls
   *   socket.except("room-101").except("room-102").emit("foo", "bar");
   * });
   *
   * @param room - a room, or an array of rooms
   * @return a new {@link BroadcastOperator} instance for chaining
   */ except(room) {
    return this.newBroadcastOperator().except(room);
  }
  /**
   * @param packet
   *
   * @private
   */ /* private */ _onpacket(packet) {
    if (!this.connected) {
      return;
    }
    getLogger("socket.io").debug(`[socket] got packet type ${packet.type}`);
    switch(packet.type){
      case PacketType.EVENT:
      case PacketType.BINARY_EVENT:
        this.onevent(packet);
        break;
      case PacketType.ACK:
      case PacketType.BINARY_ACK:
        this.onack(packet);
        break;
      case PacketType.DISCONNECT:
        this.ondisconnect();
        break;
    }
  }
  /**
   * Called upon event packet.
   *
   * @param {Packet} packet - packet object
   * @private
   */ onevent(packet) {
    const args = packet.data || [];
    getLogger("socket.io").debug(`[socket] emitting event ${args}`);
    if (null != packet.id) {
      getLogger("socket.io").debug("[socket] attaching ack callback to event");
      args.push(this.ack(packet.id));
    }
    this.#notifyIncomingListeners(args);
    if (this.connected) {
      super.emit.apply(this, args);
    }
  }
  /**
   * Produces an ack callback to emit with an event.
   *
   * @param {Number} id - packet id
   * @private
   */ ack(id) {
    let sent = false;
    return (...args)=>{
      // prevent double callbacks
      if (sent) return;
      getLogger("socket.io").debug(`[socket] sending ack ${id}`);
      this.packet({
        id: id,
        type: PacketType.ACK,
        data: args
      });
      sent = true;
    };
  }
  /**
   * Called upon ack packet.
   *
   * @private
   */ onack(packet) {
    const ack = this._acks.get(packet.id);
    if ("function" == typeof ack) {
      getLogger("socket.io").debug(`[socket] calling ack ${packet.id}`);
      ack.apply(this, packet.data);
      this._acks.delete(packet.id);
    } else {
      getLogger("socket.io").debug(`[socket] bad ack ${packet.id}`);
    }
  }
  /**
   * Called upon client disconnect packet.
   *
   * @private
   */ ondisconnect() {
    getLogger("socket.io").debug("[socket] got disconnect packet");
    this._onclose("client namespace disconnect");
  }
  /**
   * Called upon closing. Called by `Client`.
   *
   * @param {String} reason
   * @throw {Error} optional error object
   *
   * @private
   */ /* private */ _onclose(reason) {
    if (!this.connected) return this;
    getLogger("socket.io").debug(`[socket] closing socket - reason ${reason}`);
    this.emitReserved("disconnecting", reason);
    this._cleanup();
    this.nsp._remove(this);
    this.client._remove(this);
    this.connected = false;
    this.emitReserved("disconnect", reason);
    return;
  }
  /**
   * Makes the socket leave all the rooms it was part of and prevents it from joining any other room
   *
   * @private
   */ /* private */ _cleanup() {
    this.leaveAll();
    this.join = noop;
  }
  /**
   * Notify the listeners for each packet sent (emit or broadcast)
   *
   * @param packet
   *
   * @private
   */ /* private */ _notifyOutgoingListeners(args) {
    if (this.#anyOutgoingListeners) {
      for (const listener of this.#anyOutgoingListeners){
        listener.apply(this, args);
      }
    }
  }
  /**
   * Sends a `message` event.
   *
   * This method mimics the WebSocket.send() method.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.send("hello");
   *
   *   // this is equivalent to
   *   socket.emit("message", "hello");
   * });
   *
   * @return self
   */ send(...args) {
    this.emit("message", ...args);
    return this;
  }
  /**
   * Writes a packet.
   *
   * @param {Object} packet - packet object
   * @param {Object} opts - options
   * @private
   */ packet(packet, opts = {}) {
    packet.nsp = this.nsp.name;
    this.client._packet(packet, opts);
  }
  /**
   * Joins a room.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // join a single room
   *   socket.join("room1");
   *
   *   // join multiple rooms
   *   socket.join(["room1", "room2"]);
   * });
   *
   * @param {String|Array} rooms - room or array of rooms
   * @return a Promise or nothing, depending on the adapter
   */ join(rooms) {
    getLogger("socket.io").debug(`[socket] join room ${rooms}`);
    return this.adapter.addAll(this.id, new Set(Array.isArray(rooms) ? rooms : [
      rooms
    ]));
  }
  /**
   * Leaves a room.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // leave a single room
   *   socket.leave("room1");
   *
   *   // leave multiple rooms
   *   socket.leave("room1").leave("room2");
   * });
   *
   * @param {String} room
   * @return a Promise or nothing, depending on the adapter
   */ leave(room) {
    getLogger("socket.io").debug("[socket] leave room %s", room);
    return this.adapter.del(this.id, room);
  }
  /**
   * Leave all rooms.
   *
   * @private
   */ leaveAll() {
    this.adapter.delAll(this.id);
  }
  /**
   * Called by `Namespace` upon successful
   * middleware execution (ie: authorization).
   * Socket is added to namespace array before
   * call to join, so adapters can access it.
   *
   * @private
   */ /* private */ _onconnect() {
    getLogger("socket.io").debug("[socket] socket connected - writing packet");
    this.connected = true;
    this.join(this.id);
    this.packet({
      type: PacketType.CONNECT,
      data: {
        sid: this.id
      }
    });
    this.#preConnectBuffer.forEach((packet)=>{
      this._notifyOutgoingListeners(packet.data);
      this.packet(packet);
    });
    this.#preConnectBuffer = [];
  }
  /**
   * Produces an `error` packet.
   *
   * @param err - error object
   *
   * @private
   */ /* private */ _error(err) {
    this.packet({
      type: PacketType.CONNECT_ERROR,
      data: err
    });
  }
  /**
   * Disconnects this client.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // disconnect this socket (the connection might be kept alive for other namespaces)
   *   socket.disconnect();
   *
   *   // disconnect this socket and close the underlying connection
   *   socket.disconnect(true);
   * })
   *
   * @param {Boolean} close - if `true`, closes the underlying connection
   * @return self
   */ disconnect(close = false) {
    if (!this.connected) return this;
    if (close) {
      this.client._disconnect();
    } else {
      this.packet({
        type: PacketType.DISCONNECT
      });
      this._onclose("server namespace disconnect");
    }
    return this;
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.volatile.emit("hello"); // the client may or may not receive it
   * });
   *
   * @return self
   */ get volatile() {
    this.flags.volatile = true;
    return this;
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to every sockets but the
   * sender.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the “foo” event will be broadcast to all connected clients, except this socket
   *   socket.broadcast.emit("foo", "bar");
   * });
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */ get broadcast() {
    return this.newBroadcastOperator();
  }
  /**
   * Sets a modifier for a subsequent event emission that the event data will only be broadcast to the current node.
   *
   * @example
   * io.on("connection", (socket) => {
   *   // the “foo” event will be broadcast to all connected clients on this node, except this socket
   *   socket.local.emit("foo", "bar");
   * });
   *
   * @return a new {@link BroadcastOperator} instance for chaining
   */ get local() {
    return this.newBroadcastOperator().local;
  }
  /**
   * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
   * given number of milliseconds have elapsed without an acknowledgement from the client:
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.timeout(5000).emit("my-event", (err) => {
   *     if (err) {
   *       // the client did not acknowledge the event in the given delay
   *     }
   *   });
   * });
   *
   * @returns self
   */ timeout(timeout) {
    this.flags.timeout = timeout;
    return this;
  }
  /**
   * Returns the rooms the socket is currently in.
   *
   * @example
   * io.on("connection", (socket) => {
   *   console.log(socket.rooms); // Set { <socket.id> }
   *
   *   socket.join("room1");
   *
   *   console.log(socket.rooms); // Set { <socket.id>, "room1" }
   * });
   */ get rooms() {
    return this.adapter.socketRooms(this.id) || new Set();
  }
  newBroadcastOperator() {
    const flags = Object.assign({}, this.flags);
    this.flags = {};
    return new BroadcastOperator(this.adapter, new Set(), new Set([
      this.id
    ]), flags);
  }
  #notifyIncomingListeners(args) {
    if (this.#anyIncomingListeners) {
      for (const listener of this.#anyIncomingListeners){
        listener.apply(this, args);
      }
    }
  }
  /**
   * Adds a listener that will be fired when any event is received. The event name is passed as the first argument to
   * the callback.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.onAnyIncoming((event, ...args) => {
   *     console.log(`got event ${event}`);
   *   });
   * });
   *
   * @param listener
   */ onAnyIncoming(listener) {
    this.#anyIncomingListeners = this.#anyIncomingListeners || [];
    this.#anyIncomingListeners.push(listener);
    return this;
  }
  /**
   * Removes the listener that will be fired when any event is received.
   *
   * @example
   * io.on("connection", (socket) => {
   *   const catchAllListener = (event, ...args) => {
   *     console.log(`got event ${event}`);
   *   }
   *
   *   socket.onAnyIncoming(catchAllListener);
   *
   *   // remove a specific listener
   *   socket.offAnyIncoming(catchAllListener);
   *
   *   // or remove all listeners
   *   socket.offAnyIncoming();
   * });
   *
   * @param listener
   */ offAnyIncoming(listener) {
    if (this.#anyIncomingListeners && listener) {
      const i = this.#anyIncomingListeners.indexOf(listener);
      if (i !== -1) {
        this.#anyIncomingListeners.splice(i, 1);
      }
    } else {
      this.#anyIncomingListeners = [];
    }
    return this;
  }
  /**
   * Adds a listener that will be fired when any event is sent. The event name is passed as the first argument to
   * the callback.
   *
   * @example
   * io.on("connection", (socket) => {
   *   socket.onAnyOutgoing((event, ...args) => {
   *     console.log(`sent event ${event}`);
   *   });
   * });
   *
   * @param listener
   */ onAnyOutgoing(listener) {
    this.#anyOutgoingListeners = this.#anyOutgoingListeners || [];
    this.#anyOutgoingListeners.push(listener);
    return this;
  }
  /**
   * Removes the listener that will be fired when any event is sent.
   *
   * @example
   * io.on("connection", (socket) => {
   *   const catchAllListener = (event, ...args) => {
   *     console.log(`sent event ${event}`);
   *   }
   *
   *   socket.onAnyOutgoing(catchAllListener);
   *
   *   // remove a specific listener
   *   socket.offAnyOutgoing(catchAllListener);
   *
   *   // or remove all listeners
   *   socket.offAnyOutgoing();
   * });
   *
   * @param listener - the catch-all listener
   */ offAnyOutgoing(listener) {
    if (this.#anyOutgoingListeners && listener) {
      const i = this.#anyOutgoingListeners.indexOf(listener);
      if (i !== -1) {
        this.#anyOutgoingListeners.splice(i, 1);
      }
    } else {
      this.#anyOutgoingListeners = [];
    }
    return this;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL3NvY2tldC5pby9saWIvc29ja2V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBhY2tldCwgUGFja2V0VHlwZSB9IGZyb20gXCIuLi8uLi9zb2NrZXQuaW8tcGFyc2VyL21vZC50c1wiO1xuaW1wb3J0IHsgZ2V0TG9nZ2VyIH0gZnJvbSBcIi4uLy4uLy4uL2RlcHMudHNcIjtcbmltcG9ydCB7XG4gIERlZmF1bHRFdmVudHNNYXAsXG4gIEV2ZW50RW1pdHRlcixcbiAgRXZlbnROYW1lcyxcbiAgRXZlbnRQYXJhbXMsXG4gIEV2ZW50c01hcCxcbn0gZnJvbSBcIi4uLy4uL2V2ZW50LWVtaXR0ZXIvbW9kLnRzXCI7XG5pbXBvcnQgeyBBZGFwdGVyLCBCcm9hZGNhc3RGbGFncywgUm9vbSwgU29ja2V0SWQgfSBmcm9tIFwiLi9hZGFwdGVyLnRzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZUlkIH0gZnJvbSBcIi4uLy4uL2VuZ2luZS5pby9tb2QudHNcIjtcbmltcG9ydCB7IE5hbWVzcGFjZSB9IGZyb20gXCIuL25hbWVzcGFjZS50c1wiO1xuaW1wb3J0IHsgQ2xpZW50IH0gZnJvbSBcIi4vY2xpZW50LnRzXCI7XG5pbXBvcnQgeyBCcm9hZGNhc3RPcGVyYXRvciB9IGZyb20gXCIuL2Jyb2FkY2FzdC1vcGVyYXRvci50c1wiO1xuXG50eXBlIENsaWVudFJlc2VydmVkRXZlbnRzID0gXCJjb25uZWN0XCIgfCBcImNvbm5lY3RfZXJyb3JcIjtcblxudHlwZSBEaXNjb25uZWN0UmVhc29uID1cbiAgLy8gRW5naW5lLklPIGNsb3NlIHJlYXNvbnNcbiAgfCBcInRyYW5zcG9ydCBlcnJvclwiXG4gIHwgXCJ0cmFuc3BvcnQgY2xvc2VcIlxuICB8IFwiZm9yY2VkIGNsb3NlXCJcbiAgfCBcInBpbmcgdGltZW91dFwiXG4gIHwgXCJwYXJzZSBlcnJvclwiXG4gIC8vIFNvY2tldC5JTyBkaXNjb25uZWN0IHJlYXNvbnNcbiAgfCBcImNsaWVudCBuYW1lc3BhY2UgZGlzY29ubmVjdFwiXG4gIHwgXCJzZXJ2ZXIgbmFtZXNwYWNlIGRpc2Nvbm5lY3RcIjtcblxuZXhwb3J0IGludGVyZmFjZSBTb2NrZXRSZXNlcnZlZEV2ZW50cyB7XG4gIGRpc2Nvbm5lY3Q6IChyZWFzb246IERpc2Nvbm5lY3RSZWFzb24pID0+IHZvaWQ7XG4gIGRpc2Nvbm5lY3Rpbmc6IChyZWFzb246IERpc2Nvbm5lY3RSZWFzb24pID0+IHZvaWQ7XG59XG5cbi8vIEV2ZW50RW1pdHRlciByZXNlcnZlZCBldmVudHM6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvZXZlbnRzLmh0bWwjZXZlbnRzX2V2ZW50X25ld2xpc3RlbmVyXG5leHBvcnQgaW50ZXJmYWNlIEV2ZW50RW1pdHRlclJlc2VydmVkRXZlbnRzIHtcbiAgbmV3TGlzdGVuZXI6IChcbiAgICBldmVudE5hbWU6IHN0cmluZyB8IHN5bWJvbCxcbiAgICBsaXN0ZW5lcjogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdm9pZCxcbiAgKSA9PiB2b2lkO1xuICByZW1vdmVMaXN0ZW5lcjogKFxuICAgIGV2ZW50TmFtZTogc3RyaW5nIHwgc3ltYm9sLFxuICAgIGxpc3RlbmVyOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkLFxuICApID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjb25zdCBSRVNFUlZFRF9FVkVOVFM6IFJlYWRvbmx5U2V0PHN0cmluZyB8IHN5bWJvbD4gPSBuZXcgU2V0PFxuICB8IENsaWVudFJlc2VydmVkRXZlbnRzXG4gIHwga2V5b2YgU29ja2V0UmVzZXJ2ZWRFdmVudHNcbiAgfCBrZXlvZiBFdmVudEVtaXR0ZXJSZXNlcnZlZEV2ZW50c1xuPihcbiAgW1xuICAgIFwiY29ubmVjdFwiLFxuICAgIFwiY29ubmVjdF9lcnJvclwiLFxuICAgIFwiZGlzY29ubmVjdFwiLFxuICAgIFwiZGlzY29ubmVjdGluZ1wiLFxuICAgIFwibmV3TGlzdGVuZXJcIixcbiAgICBcInJlbW92ZUxpc3RlbmVyXCIsXG4gIF0gYXMgY29uc3QsXG4pO1xuXG4vKipcbiAqIFRoZSBoYW5kc2hha2UgZGV0YWlsc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIEhhbmRzaGFrZSB7XG4gIC8qKlxuICAgKiBUaGUgaGVhZGVycyBzZW50IGFzIHBhcnQgb2YgdGhlIGhhbmRzaGFrZVxuICAgKi9cbiAgaGVhZGVyczogSGVhZGVycztcblxuICAvKipcbiAgICogVGhlIGRhdGUgb2YgY3JlYXRpb24gKGFzIHN0cmluZylcbiAgICovXG4gIHRpbWU6IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIGlwIG9mIHRoZSBjbGllbnRcbiAgICovXG4gIGFkZHJlc3M6IHN0cmluZztcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgY29ubmVjdGlvbiBpcyBjcm9zcy1kb21haW5cbiAgICovXG4gIHhkb21haW46IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIGNvbm5lY3Rpb24gaXMgc2VjdXJlXG4gICAqL1xuICBzZWN1cmU6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFRoZSBkYXRlIG9mIGNyZWF0aW9uIChhcyB1bml4IHRpbWVzdGFtcClcbiAgICovXG4gIGlzc3VlZDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBUaGUgcmVxdWVzdCBVUkwgc3RyaW5nXG4gICAqL1xuICB1cmw6IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIHF1ZXJ5IG9iamVjdFxuICAgKi9cbiAgcXVlcnk6IFVSTFNlYXJjaFBhcmFtcztcblxuICAvKipcbiAgICogVGhlIGF1dGggb2JqZWN0XG4gICAqL1xuICBhdXRoOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbn1cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmV4cG9ydCB0eXBlIEV2ZW50ID0gW3N0cmluZywgLi4udW5rbm93bltdXTtcblxuLyoqXG4gKiBUaGlzIGlzIHRoZSBtYWluIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCBhIGNsaWVudC5cbiAqXG4gKiBBIFNvY2tldCBiZWxvbmdzIHRvIGEgZ2l2ZW4ge0BsaW5rIE5hbWVzcGFjZX0gYW5kIHVzZXMgYW4gdW5kZXJseWluZyB7QGxpbmsgQ2xpZW50fSB0byBjb21tdW5pY2F0ZS5cbiAqXG4gKiBXaXRoaW4gZWFjaCB7QGxpbmsgTmFtZXNwYWNlfSwgeW91IGNhbiBhbHNvIGRlZmluZSBhcmJpdHJhcnkgY2hhbm5lbHMgKGNhbGxlZCBcInJvb21zXCIpIHRoYXQgdGhlIHtAbGluayBTb2NrZXR9IGNhblxuICogam9pbiBhbmQgbGVhdmUuIFRoYXQgcHJvdmlkZXMgYSBjb252ZW5pZW50IHdheSB0byBicm9hZGNhc3QgdG8gYSBncm91cCBvZiBzb2NrZXQgaW5zdGFuY2VzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICogICBjb25zb2xlLmxvZyhgc29ja2V0ICR7c29ja2V0LmlkfSBjb25uZWN0ZWRgKTtcbiAqXG4gKiAgIC8vIHNlbmQgYW4gZXZlbnQgdG8gdGhlIGNsaWVudFxuICogICBzb2NrZXQuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAqXG4gKiAgIHNvY2tldC5vbihcImZvb2JhclwiLCAoKSA9PiB7XG4gKiAgICAgLy8gYW4gZXZlbnQgd2FzIHJlY2VpdmVkIGZyb20gdGhlIGNsaWVudFxuICogICB9KTtcbiAqXG4gKiAgIC8vIGpvaW4gdGhlIHJvb20gbmFtZWQgXCJyb29tMVwiXG4gKiAgIHNvY2tldC5qb2luKFwicm9vbTFcIik7XG4gKlxuICogICAvLyBicm9hZGNhc3QgdG8gZXZlcnlvbmUgaW4gdGhlIHJvb20gbmFtZWQgXCJyb29tMVwiXG4gKiAgIGlvLnRvKFwicm9vbTFcIikuZW1pdChcImhlbGxvXCIpO1xuICpcbiAqICAgLy8gdXBvbiBkaXNjb25uZWN0aW9uXG4gKiAgIHNvY2tldC5vbihcImRpc2Nvbm5lY3RcIiwgKHJlYXNvbikgPT4ge1xuICogICAgIGNvbnNvbGUubG9nKGBzb2NrZXQgJHtzb2NrZXQuaWR9IGRpc2Nvbm5lY3RlZCBkdWUgdG8gJHtyZWFzb259YCk7XG4gKiAgIH0pO1xuICogfSk7XG4gKi9cbmV4cG9ydCBjbGFzcyBTb2NrZXQ8XG4gIExpc3RlbkV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCA9IERlZmF1bHRFdmVudHNNYXAsXG4gIEVtaXRFdmVudHMgZXh0ZW5kcyBFdmVudHNNYXAgPSBEZWZhdWx0RXZlbnRzTWFwLFxuICBTZXJ2ZXJTaWRlRXZlbnRzIGV4dGVuZHMgRXZlbnRzTWFwID0gRGVmYXVsdEV2ZW50c01hcCxcbiAgU29ja2V0RGF0YSA9IHVua25vd24sXG4+IGV4dGVuZHMgRXZlbnRFbWl0dGVyPFxuICBMaXN0ZW5FdmVudHMsXG4gIEVtaXRFdmVudHMsXG4gIFNvY2tldFJlc2VydmVkRXZlbnRzXG4+IHtcbiAgLyoqXG4gICAqIEFuIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgc2Vzc2lvbi5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBpZDogU29ja2V0SWQ7XG4gIC8qKlxuICAgKiBUaGUgaGFuZHNoYWtlIGRldGFpbHMuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaGFuZHNoYWtlOiBIYW5kc2hha2U7XG4gIC8qKlxuICAgKiBBZGRpdGlvbmFsIGluZm9ybWF0aW9uIHRoYXQgY2FuIGJlIGF0dGFjaGVkIHRvIHRoZSBTb2NrZXQgaW5zdGFuY2UgYW5kIHdoaWNoIHdpbGwgYmUgdXNlZCBpbiB0aGVcbiAgICoge0BsaW5rIFNlcnZlci5mZXRjaFNvY2tldHMoKX0gbWV0aG9kLlxuICAgKi9cbiAgcHVibGljIGRhdGE6IFBhcnRpYWw8U29ja2V0RGF0YT4gPSB7fTtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgc29ja2V0IGlzIGN1cnJlbnRseSBjb25uZWN0ZWQgb3Igbm90LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby51c2UoYXN5bmMgKHNvY2tldCkgPT4ge1xuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5jb25uZWN0ZWQpOyAvLyBmYWxzZVxuICAgKiB9KTtcbiAgICpcbiAgICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAgICogICBjb25zb2xlLmxvZyhzb2NrZXQuY29ubmVjdGVkKTsgLy8gdHJ1ZVxuICAgKiB9KTtcbiAgICovXG4gIHB1YmxpYyBjb25uZWN0ZWQgPSBmYWxzZTtcblxuICBwdWJsaWMgcmVhZG9ubHkgbnNwOiBOYW1lc3BhY2U8XG4gICAgTGlzdGVuRXZlbnRzLFxuICAgIEVtaXRFdmVudHMsXG4gICAgU2VydmVyU2lkZUV2ZW50cyxcbiAgICBTb2NrZXREYXRhXG4gID47XG4gIHByaXZhdGUgcmVhZG9ubHkgYWRhcHRlcjogQWRhcHRlcjtcblxuICAvKiBwcml2YXRlICovIF9hY2tzOiBNYXA8bnVtYmVyLCAoKSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBmbGFnczogQnJvYWRjYXN0RmxhZ3MgPSB7fTtcbiAgI2FueUluY29taW5nTGlzdGVuZXJzPzogQXJyYXk8KC4uLmFyZ3M6IEV2ZW50KSA9PiB2b2lkPjtcbiAgI2FueU91dGdvaW5nTGlzdGVuZXJzPzogQXJyYXk8KC4uLmFyZ3M6IEV2ZW50KSA9PiB2b2lkPjtcblxuICAjcHJlQ29ubmVjdEJ1ZmZlcjogUGFja2V0W10gPSBbXTtcblxuICAvKiBwcml2YXRlICovIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50PFxuICAgIExpc3RlbkV2ZW50cyxcbiAgICBFbWl0RXZlbnRzLFxuICAgIFNlcnZlclNpZGVFdmVudHMsXG4gICAgU29ja2V0RGF0YVxuICA+O1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIG5zcDogTmFtZXNwYWNlPExpc3RlbkV2ZW50cywgRW1pdEV2ZW50cywgU2VydmVyU2lkZUV2ZW50cywgU29ja2V0RGF0YT4sXG4gICAgY2xpZW50OiBDbGllbnQ8TGlzdGVuRXZlbnRzLCBFbWl0RXZlbnRzLCBTZXJ2ZXJTaWRlRXZlbnRzLCBTb2NrZXREYXRhPixcbiAgICBoYW5kc2hha2U6IEhhbmRzaGFrZSxcbiAgKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm5zcCA9IG5zcDtcbiAgICB0aGlzLmlkID0gZ2VuZXJhdGVJZCgpO1xuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xuICAgIHRoaXMuYWRhcHRlciA9IG5zcC5hZGFwdGVyO1xuICAgIHRoaXMuaGFuZHNoYWtlID0gaGFuZHNoYWtlO1xuICB9XG5cbiAgLyoqXG4gICAqIEVtaXRzIHRvIHRoaXMgY2xpZW50LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICAgKiAgIHNvY2tldC5lbWl0KFwiaGVsbG9cIiwgXCJ3b3JsZFwiKTtcbiAgICpcbiAgICogICAvLyBhbGwgc2VyaWFsaXphYmxlIGRhdGFzdHJ1Y3R1cmVzIGFyZSBzdXBwb3J0ZWQgKG5vIG5lZWQgdG8gY2FsbCBKU09OLnN0cmluZ2lmeSlcbiAgICogICBzb2NrZXQuZW1pdChcImhlbGxvXCIsIDEsIFwiMlwiLCB7IDM6IFtcIjRcIl0sIDU6IFVpbnQ4QXJyYXkuZnJvbShbNl0pIH0pO1xuICAgKlxuICAgKiAgIC8vIHdpdGggYW4gYWNrbm93bGVkZ2VtZW50IGZyb20gdGhlIGNsaWVudFxuICAgKiAgIHNvY2tldC5lbWl0KFwiaGVsbG9cIiwgXCJ3b3JsZFwiLCAodmFsKSA9PiB7XG4gICAqICAgICAvLyAuLi5cbiAgICogICB9KTtcbiAgICogfSk7XG4gICAqXG4gICAqIEByZXR1cm4gQWx3YXlzIHJldHVybnMgYHRydWVgLlxuICAgKi9cbiAgb3ZlcnJpZGUgZW1pdDxFdiBleHRlbmRzIEV2ZW50TmFtZXM8RW1pdEV2ZW50cz4+KFxuICAgIGV2OiBFdixcbiAgICAuLi5hcmdzOiBFdmVudFBhcmFtczxFbWl0RXZlbnRzLCBFdj5cbiAgKTogYm9vbGVhbiB7XG4gICAgaWYgKFJFU0VSVkVEX0VWRU5UUy5oYXMoZXYpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiJHtTdHJpbmcoZXYpfVwiIGlzIGEgcmVzZXJ2ZWQgZXZlbnQgbmFtZWApO1xuICAgIH1cbiAgICBjb25zdCBkYXRhOiB1bmtub3duW10gPSBbZXYsIC4uLmFyZ3NdO1xuICAgIGNvbnN0IHBhY2tldDogUGFja2V0ID0ge1xuICAgICAgbnNwOiB0aGlzLm5zcC5uYW1lLFxuICAgICAgdHlwZTogUGFja2V0VHlwZS5FVkVOVCxcbiAgICAgIGRhdGE6IGRhdGEsXG4gICAgfTtcblxuICAgIC8vIGFjY2VzcyBsYXN0IGFyZ3VtZW50IHRvIHNlZSBpZiBpdCdzIGFuIEFDSyBjYWxsYmFja1xuICAgIGlmICh0eXBlb2YgZGF0YVtkYXRhLmxlbmd0aCAtIDFdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNvbnN0IGlkID0gdGhpcy5uc3AuX2lkcysrO1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICBgW3NvY2tldF0gZW1pdHRpbmcgcGFja2V0IHdpdGggYWNrIGlkICR7aWR9YCxcbiAgICAgICk7XG5cbiAgICAgIHRoaXMucmVnaXN0ZXJBY2tDYWxsYmFjayhpZCwgZGF0YS5wb3AoKSBhcyAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkKTtcbiAgICAgIHBhY2tldC5pZCA9IGlkO1xuICAgIH1cblxuICAgIGNvbnN0IGZsYWdzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5mbGFncyk7XG4gICAgdGhpcy5mbGFncyA9IHt9O1xuXG4gICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG4gICAgICB0aGlzLl9ub3RpZnlPdXRnb2luZ0xpc3RlbmVycyhwYWNrZXQuZGF0YSk7XG4gICAgICB0aGlzLnBhY2tldChwYWNrZXQsIGZsYWdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4jcHJlQ29ubmVjdEJ1ZmZlci5wdXNoKHBhY2tldCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgcmVnaXN0ZXJBY2tDYWxsYmFjayhpZDogbnVtYmVyLCBhY2s6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQpIHtcbiAgICBjb25zdCB0aW1lb3V0ID0gdGhpcy5mbGFncy50aW1lb3V0O1xuICAgIGlmICh0aW1lb3V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuX2Fja3Muc2V0KGlkLCBhY2spO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWVySWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgYFtzb2NrZXRdIGV2ZW50IHdpdGggYWNrIGlkICR7aWR9IGhhcyB0aW1lZCBvdXQgYWZ0ZXIgJHt0aW1lb3V0fSBtc2AsXG4gICAgICApO1xuICAgICAgdGhpcy5fYWNrcy5kZWxldGUoaWQpO1xuICAgICAgYWNrLmNhbGwodGhpcywgbmV3IEVycm9yKFwib3BlcmF0aW9uIGhhcyB0aW1lZCBvdXRcIikpO1xuICAgIH0sIHRpbWVvdXQpO1xuXG4gICAgdGhpcy5fYWNrcy5zZXQoaWQsICguLi5hcmdzKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZXJJZCk7XG4gICAgICBhY2suYXBwbHkodGhpcywgW251bGwsIC4uLmFyZ3NdKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUYXJnZXRzIGEgcm9vbSB3aGVuIGJyb2FkY2FzdGluZy5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAgICogICAvLyB0aGUg4oCcZm9v4oCdIGV2ZW50IHdpbGwgYmUgYnJvYWRjYXN0IHRvIGFsbCBjb25uZWN0ZWQgY2xpZW50cyBpbiB0aGUg4oCccm9vbS0xMDHigJ0gcm9vbSwgZXhjZXB0IHRoaXMgc29ja2V0XG4gICAqICAgc29ja2V0LnRvKFwicm9vbS0xMDFcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogICAvLyB0aGUgY29kZSBhYm92ZSBpcyBlcXVpdmFsZW50IHRvOlxuICAgKiAgIGlvLnRvKFwicm9vbS0xMDFcIikuZXhjZXB0KHNvY2tldC5pZCkuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogICAvLyB3aXRoIGFuIGFycmF5IG9mIHJvb21zIChhIGNsaWVudCB3aWxsIGJlIG5vdGlmaWVkIGF0IG1vc3Qgb25jZSlcbiAgICogICBzb2NrZXQudG8oW1wicm9vbS0xMDFcIiwgXCJyb29tLTEwMlwiXSkuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogICAvLyB3aXRoIG11bHRpcGxlIGNoYWluZWQgY2FsbHNcbiAgICogICBzb2NrZXQudG8oXCJyb29tLTEwMVwiKS50byhcInJvb20tMTAyXCIpLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqIH0pO1xuICAgKlxuICAgKiBAcGFyYW0gcm9vbSAtIGEgcm9vbSwgb3IgYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIHRvKHJvb206IFJvb20gfCBSb29tW10pOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMubmV3QnJvYWRjYXN0T3BlcmF0b3IoKS50byhyb29tKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUYXJnZXRzIGEgcm9vbSB3aGVuIGJyb2FkY2FzdGluZy4gU2ltaWxhciB0byBgdG8oKWAsIGJ1dCBtaWdodCBmZWVsIGNsZWFyZXIgaW4gc29tZSBjYXNlczpcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAgICogICAvLyBkaXNjb25uZWN0IGFsbCBjbGllbnRzIGluIHRoZSBcInJvb20tMTAxXCIgcm9vbSwgZXhjZXB0IHRoaXMgc29ja2V0XG4gICAqICAgc29ja2V0LmluKFwicm9vbS0xMDFcIikuZGlzY29ubmVjdFNvY2tldHMoKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSByb29tIC0gYSByb29tLCBvciBhbiBhcnJheSBvZiByb29tc1xuICAgKiBAcmV0dXJuIGEgbmV3IHtAbGluayBCcm9hZGNhc3RPcGVyYXRvcn0gaW5zdGFuY2UgZm9yIGNoYWluaW5nXG4gICAqL1xuICBwdWJsaWMgaW4ocm9vbTogUm9vbSB8IFJvb21bXSk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5uZXdCcm9hZGNhc3RPcGVyYXRvcigpLmluKHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4Y2x1ZGVzIGEgcm9vbSB3aGVuIGJyb2FkY2FzdGluZy5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAgICogICAvLyB0aGUgXCJmb29cIiBldmVudCB3aWxsIGJlIGJyb2FkY2FzdCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMsIGV4Y2VwdCB0aGUgb25lcyB0aGF0IGFyZSBpbiB0aGUgXCJyb29tLTEwMVwiIHJvb21cbiAgICogICAvLyBhbmQgdGhpcyBzb2NrZXRcbiAgICogICBzb2NrZXQuZXhjZXB0KFwicm9vbS0xMDFcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogICAvLyB3aXRoIGFuIGFycmF5IG9mIHJvb21zXG4gICAqICAgc29ja2V0LmV4Y2VwdChbXCJyb29tLTEwMVwiLCBcInJvb20tMTAyXCJdKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKlxuICAgKiAgIC8vIHdpdGggbXVsdGlwbGUgY2hhaW5lZCBjYWxsc1xuICAgKiAgIHNvY2tldC5leGNlcHQoXCJyb29tLTEwMVwiKS5leGNlcHQoXCJyb29tLTEwMlwiKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqIEByZXR1cm4gYSBuZXcge0BsaW5rIEJyb2FkY2FzdE9wZXJhdG9yfSBpbnN0YW5jZSBmb3IgY2hhaW5pbmdcbiAgICovXG4gIHB1YmxpYyBleGNlcHQoXG4gICAgcm9vbTogUm9vbSB8IFJvb21bXSxcbiAgKTogQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cywgU29ja2V0RGF0YT4ge1xuICAgIHJldHVybiB0aGlzLm5ld0Jyb2FkY2FzdE9wZXJhdG9yKCkuZXhjZXB0KHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBwYWNrZXRcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIC8qIHByaXZhdGUgKi8gX29ucGFja2V0KHBhY2tldDogUGFja2V0KSB7XG4gICAgaWYgKCF0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhgW3NvY2tldF0gZ290IHBhY2tldCB0eXBlICR7cGFja2V0LnR5cGV9YCk7XG4gICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuICAgICAgY2FzZSBQYWNrZXRUeXBlLkVWRU5UOlxuICAgICAgY2FzZSBQYWNrZXRUeXBlLkJJTkFSWV9FVkVOVDpcbiAgICAgICAgdGhpcy5vbmV2ZW50KHBhY2tldCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFBhY2tldFR5cGUuQUNLOlxuICAgICAgY2FzZSBQYWNrZXRUeXBlLkJJTkFSWV9BQ0s6XG4gICAgICAgIHRoaXMub25hY2socGFja2V0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgUGFja2V0VHlwZS5ESVNDT05ORUNUOlxuICAgICAgICB0aGlzLm9uZGlzY29ubmVjdCgpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHVwb24gZXZlbnQgcGFja2V0LlxuICAgKlxuICAgKiBAcGFyYW0ge1BhY2tldH0gcGFja2V0IC0gcGFja2V0IG9iamVjdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBvbmV2ZW50KHBhY2tldDogUGFja2V0KTogdm9pZCB7XG4gICAgY29uc3QgYXJncyA9IHBhY2tldC5kYXRhIHx8IFtdO1xuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhgW3NvY2tldF0gZW1pdHRpbmcgZXZlbnQgJHthcmdzfWApO1xuXG4gICAgaWYgKG51bGwgIT0gcGFja2V0LmlkKSB7XG4gICAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXCJbc29ja2V0XSBhdHRhY2hpbmcgYWNrIGNhbGxiYWNrIHRvIGV2ZW50XCIpO1xuICAgICAgYXJncy5wdXNoKHRoaXMuYWNrKHBhY2tldC5pZCkpO1xuICAgIH1cblxuICAgIHRoaXMuI25vdGlmeUluY29taW5nTGlzdGVuZXJzKGFyZ3MpO1xuXG4gICAgaWYgKHRoaXMuY29ubmVjdGVkKSB7XG4gICAgICBzdXBlci5lbWl0LmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9kdWNlcyBhbiBhY2sgY2FsbGJhY2sgdG8gZW1pdCB3aXRoIGFuIGV2ZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gaWQgLSBwYWNrZXQgaWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgYWNrKGlkOiBudW1iZXIpOiAoKSA9PiB2b2lkIHtcbiAgICBsZXQgc2VudCA9IGZhbHNlO1xuICAgIHJldHVybiAoLi4uYXJncykgPT4ge1xuICAgICAgLy8gcHJldmVudCBkb3VibGUgY2FsbGJhY2tzXG4gICAgICBpZiAoc2VudCkgcmV0dXJuO1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKGBbc29ja2V0XSBzZW5kaW5nIGFjayAke2lkfWApO1xuXG4gICAgICB0aGlzLnBhY2tldCh7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgdHlwZTogUGFja2V0VHlwZS5BQ0ssXG4gICAgICAgIGRhdGE6IGFyZ3MsXG4gICAgICB9KTtcblxuICAgICAgc2VudCA9IHRydWU7XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgdXBvbiBhY2sgcGFja2V0LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBvbmFjayhwYWNrZXQ6IFBhY2tldCk6IHZvaWQge1xuICAgIGNvbnN0IGFjayA9IHRoaXMuX2Fja3MuZ2V0KHBhY2tldC5pZCEpO1xuICAgIGlmIChcImZ1bmN0aW9uXCIgPT0gdHlwZW9mIGFjaykge1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICBgW3NvY2tldF0gY2FsbGluZyBhY2sgJHtwYWNrZXQuaWR9YCxcbiAgICAgICk7XG4gICAgICBhY2suYXBwbHkodGhpcywgcGFja2V0LmRhdGEpO1xuICAgICAgdGhpcy5fYWNrcy5kZWxldGUocGFja2V0LmlkISk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhgW3NvY2tldF0gYmFkIGFjayAke3BhY2tldC5pZH1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHVwb24gY2xpZW50IGRpc2Nvbm5lY3QgcGFja2V0LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBvbmRpc2Nvbm5lY3QoKTogdm9pZCB7XG4gICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFwiW3NvY2tldF0gZ290IGRpc2Nvbm5lY3QgcGFja2V0XCIpO1xuICAgIHRoaXMuX29uY2xvc2UoXCJjbGllbnQgbmFtZXNwYWNlIGRpc2Nvbm5lY3RcIik7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHVwb24gY2xvc2luZy4gQ2FsbGVkIGJ5IGBDbGllbnRgLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uXG4gICAqIEB0aHJvdyB7RXJyb3J9IG9wdGlvbmFsIGVycm9yIG9iamVjdFxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgLyogcHJpdmF0ZSAqLyBfb25jbG9zZShyZWFzb246IERpc2Nvbm5lY3RSZWFzb24pOiB0aGlzIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXRoaXMuY29ubmVjdGVkKSByZXR1cm4gdGhpcztcbiAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoYFtzb2NrZXRdIGNsb3Npbmcgc29ja2V0IC0gcmVhc29uICR7cmVhc29ufWApO1xuICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiZGlzY29ubmVjdGluZ1wiLCByZWFzb24pO1xuICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICB0aGlzLm5zcC5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMuY2xpZW50Ll9yZW1vdmUodGhpcyk7XG4gICAgdGhpcy5jb25uZWN0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXRSZXNlcnZlZChcImRpc2Nvbm5lY3RcIiwgcmVhc29uKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvKipcbiAgICogTWFrZXMgdGhlIHNvY2tldCBsZWF2ZSBhbGwgdGhlIHJvb21zIGl0IHdhcyBwYXJ0IG9mIGFuZCBwcmV2ZW50cyBpdCBmcm9tIGpvaW5pbmcgYW55IG90aGVyIHJvb21cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIC8qIHByaXZhdGUgKi8gX2NsZWFudXAoKSB7XG4gICAgdGhpcy5sZWF2ZUFsbCgpO1xuICAgIHRoaXMuam9pbiA9IG5vb3A7XG4gIH1cblxuICAvKipcbiAgICogTm90aWZ5IHRoZSBsaXN0ZW5lcnMgZm9yIGVhY2ggcGFja2V0IHNlbnQgKGVtaXQgb3IgYnJvYWRjYXN0KVxuICAgKlxuICAgKiBAcGFyYW0gcGFja2V0XG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAvKiBwcml2YXRlICovIF9ub3RpZnlPdXRnb2luZ0xpc3RlbmVycyhhcmdzOiBFdmVudCkge1xuICAgIGlmICh0aGlzLiNhbnlPdXRnb2luZ0xpc3RlbmVycykge1xuICAgICAgZm9yIChjb25zdCBsaXN0ZW5lciBvZiB0aGlzLiNhbnlPdXRnb2luZ0xpc3RlbmVycykge1xuICAgICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VuZHMgYSBgbWVzc2FnZWAgZXZlbnQuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIG1pbWljcyB0aGUgV2ViU29ja2V0LnNlbmQoKSBtZXRob2QuXG4gICAqXG4gICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYlNvY2tldC9zZW5kXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgc29ja2V0LnNlbmQoXCJoZWxsb1wiKTtcbiAgICpcbiAgICogICAvLyB0aGlzIGlzIGVxdWl2YWxlbnQgdG9cbiAgICogICBzb2NrZXQuZW1pdChcIm1lc3NhZ2VcIiwgXCJoZWxsb1wiKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEByZXR1cm4gc2VsZlxuICAgKi9cbiAgcHVibGljIHNlbmQoLi4uYXJnczogRXZlbnRQYXJhbXM8RW1pdEV2ZW50cywgXCJtZXNzYWdlXCI+KTogdGhpcyB7XG4gICAgdGhpcy5lbWl0KFwibWVzc2FnZVwiLCAuLi5hcmdzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgYSBwYWNrZXQuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQgLSBwYWNrZXQgb2JqZWN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzIC0gb3B0aW9uc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBwYWNrZXQoXG4gICAgcGFja2V0OiBPbWl0PFBhY2tldCwgXCJuc3BcIj4gJiBQYXJ0aWFsPFBpY2s8UGFja2V0LCBcIm5zcFwiPj4sXG4gICAgb3B0cyA9IHt9LFxuICApOiB2b2lkIHtcbiAgICBwYWNrZXQubnNwID0gdGhpcy5uc3AubmFtZTtcbiAgICB0aGlzLmNsaWVudC5fcGFja2V0KHBhY2tldCBhcyBQYWNrZXQsIG9wdHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEpvaW5zIGEgcm9vbS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAgICogICAvLyBqb2luIGEgc2luZ2xlIHJvb21cbiAgICogICBzb2NrZXQuam9pbihcInJvb20xXCIpO1xuICAgKlxuICAgKiAgIC8vIGpvaW4gbXVsdGlwbGUgcm9vbXNcbiAgICogICBzb2NrZXQuam9pbihbXCJyb29tMVwiLCBcInJvb20yXCJdKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fSByb29tcyAtIHJvb20gb3IgYXJyYXkgb2Ygcm9vbXNcbiAgICogQHJldHVybiBhIFByb21pc2Ugb3Igbm90aGluZywgZGVwZW5kaW5nIG9uIHRoZSBhZGFwdGVyXG4gICAqL1xuICBwdWJsaWMgam9pbihyb29tczogUm9vbSB8IEFycmF5PFJvb20+KTogUHJvbWlzZTx2b2lkPiB8IHZvaWQge1xuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhgW3NvY2tldF0gam9pbiByb29tICR7cm9vbXN9YCk7XG5cbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmFkZEFsbChcbiAgICAgIHRoaXMuaWQsXG4gICAgICBuZXcgU2V0KEFycmF5LmlzQXJyYXkocm9vbXMpID8gcm9vbXMgOiBbcm9vbXNdKSxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIExlYXZlcyBhIHJvb20uXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgLy8gbGVhdmUgYSBzaW5nbGUgcm9vbVxuICAgKiAgIHNvY2tldC5sZWF2ZShcInJvb20xXCIpO1xuICAgKlxuICAgKiAgIC8vIGxlYXZlIG11bHRpcGxlIHJvb21zXG4gICAqICAgc29ja2V0LmxlYXZlKFwicm9vbTFcIikubGVhdmUoXCJyb29tMlwiKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSByb29tXG4gICAqIEByZXR1cm4gYSBQcm9taXNlIG9yIG5vdGhpbmcsIGRlcGVuZGluZyBvbiB0aGUgYWRhcHRlclxuICAgKi9cbiAgcHVibGljIGxlYXZlKHJvb206IFJvb20pOiBQcm9taXNlPHZvaWQ+IHwgdm9pZCB7XG4gICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFwiW3NvY2tldF0gbGVhdmUgcm9vbSAlc1wiLCByb29tKTtcblxuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZGVsKHRoaXMuaWQsIHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIExlYXZlIGFsbCByb29tcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgbGVhdmVBbGwoKTogdm9pZCB7XG4gICAgdGhpcy5hZGFwdGVyLmRlbEFsbCh0aGlzLmlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgYnkgYE5hbWVzcGFjZWAgdXBvbiBzdWNjZXNzZnVsXG4gICAqIG1pZGRsZXdhcmUgZXhlY3V0aW9uIChpZTogYXV0aG9yaXphdGlvbikuXG4gICAqIFNvY2tldCBpcyBhZGRlZCB0byBuYW1lc3BhY2UgYXJyYXkgYmVmb3JlXG4gICAqIGNhbGwgdG8gam9pbiwgc28gYWRhcHRlcnMgY2FuIGFjY2VzcyBpdC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIC8qIHByaXZhdGUgKi8gX29uY29ubmVjdCgpOiB2b2lkIHtcbiAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXCJbc29ja2V0XSBzb2NrZXQgY29ubmVjdGVkIC0gd3JpdGluZyBwYWNrZXRcIik7XG4gICAgdGhpcy5jb25uZWN0ZWQgPSB0cnVlO1xuICAgIHRoaXMuam9pbih0aGlzLmlkKTtcbiAgICB0aGlzLnBhY2tldCh7IHR5cGU6IFBhY2tldFR5cGUuQ09OTkVDVCwgZGF0YTogeyBzaWQ6IHRoaXMuaWQgfSB9KTtcbiAgICB0aGlzLiNwcmVDb25uZWN0QnVmZmVyLmZvckVhY2goKHBhY2tldCkgPT4ge1xuICAgICAgdGhpcy5fbm90aWZ5T3V0Z29pbmdMaXN0ZW5lcnMocGFja2V0LmRhdGEpO1xuICAgICAgdGhpcy5wYWNrZXQocGFja2V0KTtcbiAgICB9KTtcbiAgICB0aGlzLiNwcmVDb25uZWN0QnVmZmVyID0gW107XG4gIH1cblxuICAvKipcbiAgICogUHJvZHVjZXMgYW4gYGVycm9yYCBwYWNrZXQuXG4gICAqXG4gICAqIEBwYXJhbSBlcnIgLSBlcnJvciBvYmplY3RcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIC8qIHByaXZhdGUgKi8gX2Vycm9yKGVycjogeyBtZXNzYWdlOiBzdHJpbmc7IGRhdGE6IHVua25vd24gfSkge1xuICAgIHRoaXMucGFja2V0KHsgdHlwZTogUGFja2V0VHlwZS5DT05ORUNUX0VSUk9SLCBkYXRhOiBlcnIgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGlzY29ubmVjdHMgdGhpcyBjbGllbnQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgLy8gZGlzY29ubmVjdCB0aGlzIHNvY2tldCAodGhlIGNvbm5lY3Rpb24gbWlnaHQgYmUga2VwdCBhbGl2ZSBmb3Igb3RoZXIgbmFtZXNwYWNlcylcbiAgICogICBzb2NrZXQuZGlzY29ubmVjdCgpO1xuICAgKlxuICAgKiAgIC8vIGRpc2Nvbm5lY3QgdGhpcyBzb2NrZXQgYW5kIGNsb3NlIHRoZSB1bmRlcmx5aW5nIGNvbm5lY3Rpb25cbiAgICogICBzb2NrZXQuZGlzY29ubmVjdCh0cnVlKTtcbiAgICogfSlcbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFufSBjbG9zZSAtIGlmIGB0cnVlYCwgY2xvc2VzIHRoZSB1bmRlcmx5aW5nIGNvbm5lY3Rpb25cbiAgICogQHJldHVybiBzZWxmXG4gICAqL1xuICBwdWJsaWMgZGlzY29ubmVjdChjbG9zZSA9IGZhbHNlKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmNvbm5lY3RlZCkgcmV0dXJuIHRoaXM7XG4gICAgaWYgKGNsb3NlKSB7XG4gICAgICB0aGlzLmNsaWVudC5fZGlzY29ubmVjdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhY2tldCh7IHR5cGU6IFBhY2tldFR5cGUuRElTQ09OTkVDVCB9KTtcbiAgICAgIHRoaXMuX29uY2xvc2UoXCJzZXJ2ZXIgbmFtZXNwYWNlIGRpc2Nvbm5lY3RcIik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtb2RpZmllciBmb3IgYSBzdWJzZXF1ZW50IGV2ZW50IGVtaXNzaW9uIHRoYXQgdGhlIGV2ZW50IGRhdGEgbWF5IGJlIGxvc3QgaWYgdGhlIGNsaWVudCBpcyBub3QgcmVhZHkgdG9cbiAgICogcmVjZWl2ZSBtZXNzYWdlcyAoYmVjYXVzZSBvZiBuZXR3b3JrIHNsb3duZXNzIG9yIG90aGVyIGlzc3Vlcywgb3IgYmVjYXVzZSB0aGV54oCZcmUgY29ubmVjdGVkIHRocm91Z2ggbG9uZyBwb2xsaW5nXG4gICAqIGFuZCBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgcmVxdWVzdC1yZXNwb25zZSBjeWNsZSkuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgc29ja2V0LnZvbGF0aWxlLmVtaXQoXCJoZWxsb1wiKTsgLy8gdGhlIGNsaWVudCBtYXkgb3IgbWF5IG5vdCByZWNlaXZlIGl0XG4gICAqIH0pO1xuICAgKlxuICAgKiBAcmV0dXJuIHNlbGZcbiAgICovXG4gIHB1YmxpYyBnZXQgdm9sYXRpbGUoKTogdGhpcyB7XG4gICAgdGhpcy5mbGFncy52b2xhdGlsZSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBhIG1vZGlmaWVyIGZvciBhIHN1YnNlcXVlbnQgZXZlbnQgZW1pc3Npb24gdGhhdCB0aGUgZXZlbnQgZGF0YSB3aWxsIG9ubHkgYmUgYnJvYWRjYXN0IHRvIGV2ZXJ5IHNvY2tldHMgYnV0IHRoZVxuICAgKiBzZW5kZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgLy8gdGhlIOKAnGZvb+KAnSBldmVudCB3aWxsIGJlIGJyb2FkY2FzdCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMsIGV4Y2VwdCB0aGlzIHNvY2tldFxuICAgKiAgIHNvY2tldC5icm9hZGNhc3QuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEByZXR1cm4gYSBuZXcge0BsaW5rIEJyb2FkY2FzdE9wZXJhdG9yfSBpbnN0YW5jZSBmb3IgY2hhaW5pbmdcbiAgICovXG4gIHB1YmxpYyBnZXQgYnJvYWRjYXN0KCk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5uZXdCcm9hZGNhc3RPcGVyYXRvcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtb2RpZmllciBmb3IgYSBzdWJzZXF1ZW50IGV2ZW50IGVtaXNzaW9uIHRoYXQgdGhlIGV2ZW50IGRhdGEgd2lsbCBvbmx5IGJlIGJyb2FkY2FzdCB0byB0aGUgY3VycmVudCBub2RlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICAgKiAgIC8vIHRoZSDigJxmb2/igJ0gZXZlbnQgd2lsbCBiZSBicm9hZGNhc3QgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzIG9uIHRoaXMgbm9kZSwgZXhjZXB0IHRoaXMgc29ja2V0XG4gICAqICAgc29ja2V0LmxvY2FsLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqIH0pO1xuICAgKlxuICAgKiBAcmV0dXJuIGEgbmV3IHtAbGluayBCcm9hZGNhc3RPcGVyYXRvcn0gaW5zdGFuY2UgZm9yIGNoYWluaW5nXG4gICAqL1xuICBwdWJsaWMgZ2V0IGxvY2FsKCk6IEJyb2FkY2FzdE9wZXJhdG9yPEVtaXRFdmVudHMsIFNvY2tldERhdGE+IHtcbiAgICByZXR1cm4gdGhpcy5uZXdCcm9hZGNhc3RPcGVyYXRvcigpLmxvY2FsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtb2RpZmllciBmb3IgYSBzdWJzZXF1ZW50IGV2ZW50IGVtaXNzaW9uIHRoYXQgdGhlIGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIHdpdGggYW4gZXJyb3Igd2hlbiB0aGVcbiAgICogZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBoYXZlIGVsYXBzZWQgd2l0aG91dCBhbiBhY2tub3dsZWRnZW1lbnQgZnJvbSB0aGUgY2xpZW50OlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICAgKiAgIHNvY2tldC50aW1lb3V0KDUwMDApLmVtaXQoXCJteS1ldmVudFwiLCAoZXJyKSA9PiB7XG4gICAqICAgICBpZiAoZXJyKSB7XG4gICAqICAgICAgIC8vIHRoZSBjbGllbnQgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgICB9XG4gICAqICAgfSk7XG4gICAqIH0pO1xuICAgKlxuICAgKiBAcmV0dXJucyBzZWxmXG4gICAqL1xuICBwdWJsaWMgdGltZW91dCh0aW1lb3V0OiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmZsYWdzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHJvb21zIHRoZSBzb2NrZXQgaXMgY3VycmVudGx5IGluLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5yb29tcyk7IC8vIFNldCB7IDxzb2NrZXQuaWQ+IH1cbiAgICpcbiAgICogICBzb2NrZXQuam9pbihcInJvb20xXCIpO1xuICAgKlxuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5yb29tcyk7IC8vIFNldCB7IDxzb2NrZXQuaWQ+LCBcInJvb20xXCIgfVxuICAgKiB9KTtcbiAgICovXG4gIHB1YmxpYyBnZXQgcm9vbXMoKTogU2V0PFJvb20+IHtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLnNvY2tldFJvb21zKHRoaXMuaWQpIHx8IG5ldyBTZXQoKTtcbiAgfVxuXG4gIHByaXZhdGUgbmV3QnJvYWRjYXN0T3BlcmF0b3IoKTogQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cywgU29ja2V0RGF0YT4ge1xuICAgIGNvbnN0IGZsYWdzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5mbGFncyk7XG4gICAgdGhpcy5mbGFncyA9IHt9O1xuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IoXG4gICAgICB0aGlzLmFkYXB0ZXIsXG4gICAgICBuZXcgU2V0PFJvb20+KCksXG4gICAgICBuZXcgU2V0PFJvb20+KFt0aGlzLmlkXSksXG4gICAgICBmbGFncyxcbiAgICApO1xuICB9XG5cbiAgI25vdGlmeUluY29taW5nTGlzdGVuZXJzKGFyZ3M6IEV2ZW50KSB7XG4gICAgaWYgKHRoaXMuI2FueUluY29taW5nTGlzdGVuZXJzKSB7XG4gICAgICBmb3IgKGNvbnN0IGxpc3RlbmVyIG9mIHRoaXMuI2FueUluY29taW5nTGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGZpcmVkIHdoZW4gYW55IGV2ZW50IGlzIHJlY2VpdmVkLiBUaGUgZXZlbnQgbmFtZSBpcyBwYXNzZWQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvXG4gICAqIHRoZSBjYWxsYmFjay5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8ub24oXCJjb25uZWN0aW9uXCIsIChzb2NrZXQpID0+IHtcbiAgICogICBzb2NrZXQub25BbnlJbmNvbWluZygoZXZlbnQsIC4uLmFyZ3MpID0+IHtcbiAgICogICAgIGNvbnNvbGUubG9nKGBnb3QgZXZlbnQgJHtldmVudH1gKTtcbiAgICogICB9KTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSBsaXN0ZW5lclxuICAgKi9cbiAgcHVibGljIG9uQW55SW5jb21pbmcobGlzdGVuZXI6ICguLi5hcmdzOiBFdmVudCkgPT4gdm9pZCk6IHRoaXMge1xuICAgIHRoaXMuI2FueUluY29taW5nTGlzdGVuZXJzID0gdGhpcy4jYW55SW5jb21pbmdMaXN0ZW5lcnMgfHwgW107XG4gICAgdGhpcy4jYW55SW5jb21pbmdMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGZpcmVkIHdoZW4gYW55IGV2ZW50IGlzIHJlY2VpdmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICAgKiAgIGNvbnN0IGNhdGNoQWxsTGlzdGVuZXIgPSAoZXZlbnQsIC4uLmFyZ3MpID0+IHtcbiAgICogICAgIGNvbnNvbGUubG9nKGBnb3QgZXZlbnQgJHtldmVudH1gKTtcbiAgICogICB9XG4gICAqXG4gICAqICAgc29ja2V0Lm9uQW55SW5jb21pbmcoY2F0Y2hBbGxMaXN0ZW5lcik7XG4gICAqXG4gICAqICAgLy8gcmVtb3ZlIGEgc3BlY2lmaWMgbGlzdGVuZXJcbiAgICogICBzb2NrZXQub2ZmQW55SW5jb21pbmcoY2F0Y2hBbGxMaXN0ZW5lcik7XG4gICAqXG4gICAqICAgLy8gb3IgcmVtb3ZlIGFsbCBsaXN0ZW5lcnNcbiAgICogICBzb2NrZXQub2ZmQW55SW5jb21pbmcoKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSBsaXN0ZW5lclxuICAgKi9cbiAgcHVibGljIG9mZkFueUluY29taW5nKGxpc3RlbmVyPzogKC4uLmFyZ3M6IEV2ZW50KSA9PiB2b2lkKTogdGhpcyB7XG4gICAgaWYgKHRoaXMuI2FueUluY29taW5nTGlzdGVuZXJzICYmIGxpc3RlbmVyKSB7XG4gICAgICBjb25zdCBpID0gdGhpcy4jYW55SW5jb21pbmdMaXN0ZW5lcnMuaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgICBpZiAoaSAhPT0gLTEpIHtcbiAgICAgICAgdGhpcy4jYW55SW5jb21pbmdMaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNhbnlJbmNvbWluZ0xpc3RlbmVycyA9IFtdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGZpcmVkIHdoZW4gYW55IGV2ZW50IGlzIHNlbnQuIFRoZSBldmVudCBuYW1lIGlzIHBhc3NlZCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG9cbiAgICogdGhlIGNhbGxiYWNrLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBpby5vbihcImNvbm5lY3Rpb25cIiwgKHNvY2tldCkgPT4ge1xuICAgKiAgIHNvY2tldC5vbkFueU91dGdvaW5nKChldmVudCwgLi4uYXJncykgPT4ge1xuICAgKiAgICAgY29uc29sZS5sb2coYHNlbnQgZXZlbnQgJHtldmVudH1gKTtcbiAgICogICB9KTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSBsaXN0ZW5lclxuICAgKi9cbiAgcHVibGljIG9uQW55T3V0Z29pbmcobGlzdGVuZXI6ICguLi5hcmdzOiBFdmVudCkgPT4gdm9pZCk6IHRoaXMge1xuICAgIHRoaXMuI2FueU91dGdvaW5nTGlzdGVuZXJzID0gdGhpcy4jYW55T3V0Z29pbmdMaXN0ZW5lcnMgfHwgW107XG4gICAgdGhpcy4jYW55T3V0Z29pbmdMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGUgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGZpcmVkIHdoZW4gYW55IGV2ZW50IGlzIHNlbnQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGlvLm9uKFwiY29ubmVjdGlvblwiLCAoc29ja2V0KSA9PiB7XG4gICAqICAgY29uc3QgY2F0Y2hBbGxMaXN0ZW5lciA9IChldmVudCwgLi4uYXJncykgPT4ge1xuICAgKiAgICAgY29uc29sZS5sb2coYHNlbnQgZXZlbnQgJHtldmVudH1gKTtcbiAgICogICB9XG4gICAqXG4gICAqICAgc29ja2V0Lm9uQW55T3V0Z29pbmcoY2F0Y2hBbGxMaXN0ZW5lcik7XG4gICAqXG4gICAqICAgLy8gcmVtb3ZlIGEgc3BlY2lmaWMgbGlzdGVuZXJcbiAgICogICBzb2NrZXQub2ZmQW55T3V0Z29pbmcoY2F0Y2hBbGxMaXN0ZW5lcik7XG4gICAqXG4gICAqICAgLy8gb3IgcmVtb3ZlIGFsbCBsaXN0ZW5lcnNcbiAgICogICBzb2NrZXQub2ZmQW55T3V0Z29pbmcoKTtcbiAgICogfSk7XG4gICAqXG4gICAqIEBwYXJhbSBsaXN0ZW5lciAtIHRoZSBjYXRjaC1hbGwgbGlzdGVuZXJcbiAgICovXG4gIHB1YmxpYyBvZmZBbnlPdXRnb2luZyhsaXN0ZW5lcj86ICguLi5hcmdzOiBFdmVudCkgPT4gdm9pZCk6IHRoaXMge1xuICAgIGlmICh0aGlzLiNhbnlPdXRnb2luZ0xpc3RlbmVycyAmJiBsaXN0ZW5lcikge1xuICAgICAgY29uc3QgaSA9IHRoaXMuI2FueU91dGdvaW5nTGlzdGVuZXJzLmluZGV4T2YobGlzdGVuZXIpO1xuICAgICAgaWYgKGkgIT09IC0xKSB7XG4gICAgICAgIHRoaXMuI2FueU91dGdvaW5nTGlzdGVuZXJzLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4jYW55T3V0Z29pbmdMaXN0ZW5lcnMgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFpQixVQUFVLFFBQVEsZ0NBQWdDO0FBQ25FLFNBQVMsU0FBUyxRQUFRLG1CQUFtQjtBQUM3QyxTQUVFLFlBQVksUUFJUCw2QkFBNkI7QUFFcEMsU0FBUyxVQUFVLFFBQVEseUJBQXlCO0FBR3BELFNBQVMsaUJBQWlCLFFBQVEsMEJBQTBCO0FBZ0M1RCxPQUFPLE1BQU0sa0JBQWdELElBQUksSUFLL0Q7RUFDRTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7Q0FDRCxFQUNEO0FBb0RGLFNBQVMsUUFBUTtBQUlqQjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBOEJDLEdBQ0QsT0FBTyxNQUFNLGVBS0g7RUFLUjs7R0FFQyxHQUNELEFBQWdCLEdBQWE7RUFDN0I7O0dBRUMsR0FDRCxBQUFnQixVQUFxQjtFQUNyQzs7O0dBR0MsR0FDRCxBQUFPLE9BQTRCLENBQUMsRUFBRTtFQUV0Qzs7Ozs7Ozs7Ozs7R0FXQyxHQUNELEFBQU8sWUFBWSxNQUFNO0VBRVQsSUFLZDtFQUNlLFFBQWlCO0VBRWxDLFdBQVcsR0FBRyxRQUFpQyxJQUFJLE1BQU07RUFDakQsUUFBd0IsQ0FBQyxFQUFFO0VBQ25DLENBQUEsb0JBQXFCLENBQW1DO0VBQ3hELENBQUEsb0JBQXFCLENBQW1DO0VBRXhELENBQUEsZ0JBQWlCLEdBQWEsRUFBRSxDQUFDO0VBRWpDLFdBQVcsR0FBRyxBQUFTLE9BS3JCO0VBRUYsWUFDRSxHQUFzRSxFQUN0RSxNQUFzRSxFQUN0RSxTQUFvQixDQUNwQjtJQUNBLEtBQUs7SUFDTCxJQUFJLENBQUMsR0FBRyxHQUFHO0lBQ1gsSUFBSSxDQUFDLEVBQUUs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
// denoCacheMetadata=8879290835278684965,6016116647083184700