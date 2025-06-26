import { RESERVED_EVENTS, Socket } from "./socket.ts";
import { PacketType } from "../../socket.io-parser/mod.ts";
export class BroadcastOperator {
  adapter;
  rooms;
  exceptRooms;
  flags;
  constructor(adapter, rooms = new Set(), exceptRooms = new Set(), flags = {}){
    this.adapter = adapter;
    this.rooms = rooms;
    this.exceptRooms = exceptRooms;
    this.flags = flags;
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
    const rooms = new Set(this.rooms);
    if (Array.isArray(room)) {
      room.forEach((r)=>rooms.add(r));
    } else {
      rooms.add(room);
    }
    return new BroadcastOperator(this.adapter, rooms, this.exceptRooms, this.flags);
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
    return this.to(room);
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
    const exceptRooms = new Set(this.exceptRooms);
    if (Array.isArray(room)) {
      room.forEach((r)=>exceptRooms.add(r));
    } else {
      exceptRooms.add(room);
    }
    return new BroadcastOperator(this.adapter, this.rooms, exceptRooms, this.flags);
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
    const flags = Object.assign({}, this.flags, {
      volatile: true
    });
    return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
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
    const flags = Object.assign({}, this.flags, {
      local: true
    });
    return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
  }
  /**
   * Adds a timeout in milliseconds for the next operation
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
    const flags = Object.assign({}, this.flags, {
      timeout
    });
    return new BroadcastOperator(this.adapter, this.rooms, this.exceptRooms, flags);
  }
  /**
   * Emits to all clients.
   *
   * @example
   * // the “foo” event will be broadcast to all connected clients
   * io.emit("foo", "bar");
   *
   * // the “foo” event will be broadcast to all connected clients in the “room-101” room
   * io.to("room-101").emit("foo", "bar");
   *
   * // with an acknowledgement expected from all connected clients
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
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${String(ev)}" is a reserved event name`);
    }
    // set up packet object
    const data = [
      ev,
      ...args
    ];
    const packet = {
      // @ts-ignore FIXME
      nsp: this.adapter.nsp.name,
      type: PacketType.EVENT,
      data
    };
    const withAck = typeof data[data.length - 1] === "function";
    if (!withAck) {
      this.adapter.broadcast(packet, {
        rooms: this.rooms,
        except: this.exceptRooms,
        flags: this.flags
      });
      return true;
    }
    const ack = data.pop();
    let timedOut = false;
    const responses = [];
    const timer = setTimeout(()=>{
      timedOut = true;
      ack.apply(this, [
        new Error("operation has timed out"),
        responses
      ]);
    }, this.flags.timeout);
    let expectedServerCount = -1;
    let actualServerCount = 0;
    let expectedClientCount = 0;
    const checkCompleteness = ()=>{
      if (!timedOut && expectedServerCount === actualServerCount && responses.length === expectedClientCount) {
        clearTimeout(timer);
        ack.apply(this, [
          null,
          responses
        ]);
      }
    };
    this.adapter.broadcastWithAck(packet, {
      rooms: this.rooms,
      except: this.exceptRooms,
      flags: this.flags
    }, (clientCount)=>{
      // each Socket.IO server in the cluster sends the number of clients that were notified
      expectedClientCount += clientCount;
      actualServerCount++;
      checkCompleteness();
    }, (clientResponse)=>{
      // each client sends an acknowledgement
      responses.push(clientResponse);
      checkCompleteness();
    });
    this.adapter.serverCount().then((serverCount)=>{
      expectedServerCount = serverCount;
      checkCompleteness();
    });
    return true;
  }
  /**
   * Returns the matching socket instances. This method works across a cluster of several Socket.IO servers.
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
    return this.adapter.fetchSockets({
      rooms: this.rooms,
      except: this.exceptRooms,
      flags: this.flags
    }).then((sockets)=>{
      return sockets.map((socket)=>{
        if (socket instanceof Socket) {
          // FIXME the TypeScript compiler complains about missing private properties
          return socket;
        } else {
          return new RemoteSocket(this.adapter, socket);
        }
      });
    });
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
    this.adapter.addSockets({
      rooms: this.rooms,
      except: this.exceptRooms,
      flags: this.flags
    }, Array.isArray(room) ? room : [
      room
    ]);
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
    this.adapter.delSockets({
      rooms: this.rooms,
      except: this.exceptRooms,
      flags: this.flags
    }, Array.isArray(room) ? room : [
      room
    ]);
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
    this.adapter.disconnectSockets({
      rooms: this.rooms,
      except: this.exceptRooms,
      flags: this.flags
    }, close);
  }
}
/**
 * Expose of subset of the attributes and methods of the Socket class
 */ export class RemoteSocket {
  id;
  handshake;
  rooms;
  data;
  operator;
  constructor(adapter, details){
    this.id = details.id;
    this.handshake = details.handshake;
    this.rooms = new Set(details.rooms);
    this.data = details.data;
    this.operator = new BroadcastOperator(adapter, new Set([
      this.id
    ]));
  }
  emit(ev, ...args) {
    return this.operator.emit(ev, ...args);
  }
  /**
   * Joins a room.
   *
   * @param {String|Array} room - room or array of rooms
   */ join(room) {
    return this.operator.socketsJoin(room);
  }
  /**
   * Leaves a room.
   *
   * @param {String} room
   */ leave(room) {
    return this.operator.socketsLeave(room);
  }
  /**
   * Disconnects this client.
   *
   * @param {Boolean} close - if `true`, closes the underlying connection
   * @return {Socket} self
   */ disconnect(close = false) {
    this.operator.disconnectSockets(close);
    return this;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL3NvY2tldC5pby9saWIvYnJvYWRjYXN0LW9wZXJhdG9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFkYXB0ZXIsIEJyb2FkY2FzdEZsYWdzLCBSb29tLCBTb2NrZXRJZCB9IGZyb20gXCIuL2FkYXB0ZXIudHNcIjtcbmltcG9ydCB7IEV2ZW50TmFtZXMsIEV2ZW50UGFyYW1zLCBFdmVudHNNYXAgfSBmcm9tIFwiLi4vLi4vZXZlbnQtZW1pdHRlci9tb2QudHNcIjtcbmltcG9ydCB7IEhhbmRzaGFrZSwgUkVTRVJWRURfRVZFTlRTLCBTb2NrZXQgfSBmcm9tIFwiLi9zb2NrZXQudHNcIjtcbmltcG9ydCB7IFBhY2tldFR5cGUgfSBmcm9tIFwiLi4vLi4vc29ja2V0LmlvLXBhcnNlci9tb2QudHNcIjtcblxuLyoqXG4gKiBJbnRlcmZhY2UgZm9yIGNsYXNzZXMgdGhhdCBhcmVuJ3QgYEV2ZW50RW1pdHRlcmBzLCBidXQgc3RpbGwgZXhwb3NlIGFcbiAqIHN0cmljdGx5IHR5cGVkIGBlbWl0YCBtZXRob2QuXG4gKi9cbmludGVyZmFjZSBUeXBlZEV2ZW50QnJvYWRjYXN0ZXI8RW1pdEV2ZW50cyBleHRlbmRzIEV2ZW50c01hcD4ge1xuICBlbWl0PEV2IGV4dGVuZHMgRXZlbnROYW1lczxFbWl0RXZlbnRzPj4oXG4gICAgZXY6IEV2LFxuICAgIC4uLmFyZ3M6IEV2ZW50UGFyYW1zPEVtaXRFdmVudHMsIEV2PlxuICApOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCwgU29ja2V0RGF0YT5cbiAgaW1wbGVtZW50cyBUeXBlZEV2ZW50QnJvYWRjYXN0ZXI8RW1pdEV2ZW50cz4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGFkYXB0ZXI6IEFkYXB0ZXIsXG4gICAgcHJpdmF0ZSByZWFkb25seSByb29tczogU2V0PFJvb20+ID0gbmV3IFNldDxSb29tPigpLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgZXhjZXB0Um9vbXM6IFNldDxSb29tPiA9IG5ldyBTZXQ8Um9vbT4oKSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGZsYWdzOiBCcm9hZGNhc3RGbGFncyA9IHt9LFxuICApIHt9XG5cbiAgLyoqXG4gICAqIFRhcmdldHMgYSByb29tIHdoZW4gZW1pdHRpbmcuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHRoZSDigJxmb2/igJ0gZXZlbnQgd2lsbCBiZSBicm9hZGNhc3QgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzIGluIHRoZSDigJxyb29tLTEwMeKAnSByb29tXG4gICAqIGlvLnRvKFwicm9vbS0xMDFcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogLy8gd2l0aCBhbiBhcnJheSBvZiByb29tcyAoYSBjbGllbnQgd2lsbCBiZSBub3RpZmllZCBhdCBtb3N0IG9uY2UpXG4gICAqIGlvLnRvKFtcInJvb20tMTAxXCIsIFwicm9vbS0xMDJcIl0pLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqXG4gICAqIC8vIHdpdGggbXVsdGlwbGUgY2hhaW5lZCBjYWxsc1xuICAgKiBpby50byhcInJvb20tMTAxXCIpLnRvKFwicm9vbS0xMDJcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqIEByZXR1cm4gYSBuZXcge0BsaW5rIEJyb2FkY2FzdE9wZXJhdG9yfSBpbnN0YW5jZSBmb3IgY2hhaW5pbmdcbiAgICovXG4gIHB1YmxpYyB0byhyb29tOiBSb29tIHwgUm9vbVtdKTogQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cywgU29ja2V0RGF0YT4ge1xuICAgIGNvbnN0IHJvb21zID0gbmV3IFNldCh0aGlzLnJvb21zKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyb29tKSkge1xuICAgICAgcm9vbS5mb3JFYWNoKChyKSA9PiByb29tcy5hZGQocikpO1xuICAgIH0gZWxzZSB7XG4gICAgICByb29tcy5hZGQocm9vbSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IoXG4gICAgICB0aGlzLmFkYXB0ZXIsXG4gICAgICByb29tcyxcbiAgICAgIHRoaXMuZXhjZXB0Um9vbXMsXG4gICAgICB0aGlzLmZsYWdzLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogVGFyZ2V0cyBhIHJvb20gd2hlbiBlbWl0dGluZy4gU2ltaWxhciB0byBgdG8oKWAsIGJ1dCBtaWdodCBmZWVsIGNsZWFyZXIgaW4gc29tZSBjYXNlczpcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gZGlzY29ubmVjdCBhbGwgY2xpZW50cyBpbiB0aGUgXCJyb29tLTEwMVwiIHJvb21cbiAgICogaW8uaW4oXCJyb29tLTEwMVwiKS5kaXNjb25uZWN0U29ja2V0cygpO1xuICAgKlxuICAgKiBAcGFyYW0gcm9vbSAtIGEgcm9vbSwgb3IgYW4gYXJyYXkgb2Ygcm9vbXNcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIGluKHJvb206IFJvb20gfCBSb29tW10pOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMudG8ocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogRXhjbHVkZXMgYSByb29tIHdoZW4gZW1pdHRpbmcuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHRoZSBcImZvb1wiIGV2ZW50IHdpbGwgYmUgYnJvYWRjYXN0IHRvIGFsbCBjb25uZWN0ZWQgY2xpZW50cywgZXhjZXB0IHRoZSBvbmVzIHRoYXQgYXJlIGluIHRoZSBcInJvb20tMTAxXCIgcm9vbVxuICAgKiBpby5leGNlcHQoXCJyb29tLTEwMVwiKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKlxuICAgKiAvLyB3aXRoIGFuIGFycmF5IG9mIHJvb21zXG4gICAqIGlvLmV4Y2VwdChbXCJyb29tLTEwMVwiLCBcInJvb20tMTAyXCJdKS5lbWl0KFwiZm9vXCIsIFwiYmFyXCIpO1xuICAgKlxuICAgKiAvLyB3aXRoIG11bHRpcGxlIGNoYWluZWQgY2FsbHNcbiAgICogaW8uZXhjZXB0KFwicm9vbS0xMDFcIikuZXhjZXB0KFwicm9vbS0xMDJcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqIEByZXR1cm4gYSBuZXcge0BsaW5rIEJyb2FkY2FzdE9wZXJhdG9yfSBpbnN0YW5jZSBmb3IgY2hhaW5pbmdcbiAgICovXG4gIHB1YmxpYyBleGNlcHQoXG4gICAgcm9vbTogUm9vbSB8IFJvb21bXSxcbiAgKTogQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cywgU29ja2V0RGF0YT4ge1xuICAgIGNvbnN0IGV4Y2VwdFJvb21zID0gbmV3IFNldCh0aGlzLmV4Y2VwdFJvb21zKTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShyb29tKSkge1xuICAgICAgcm9vbS5mb3JFYWNoKChyKSA9PiBleGNlcHRSb29tcy5hZGQocikpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleGNlcHRSb29tcy5hZGQocm9vbSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IoXG4gICAgICB0aGlzLmFkYXB0ZXIsXG4gICAgICB0aGlzLnJvb21zLFxuICAgICAgZXhjZXB0Um9vbXMsXG4gICAgICB0aGlzLmZsYWdzLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyBhIG1vZGlmaWVyIGZvciBhIHN1YnNlcXVlbnQgZXZlbnQgZW1pc3Npb24gdGhhdCB0aGUgZXZlbnQgZGF0YSBtYXkgYmUgbG9zdCBpZiB0aGUgY2xpZW50IGlzIG5vdCByZWFkeSB0b1xuICAgKiByZWNlaXZlIG1lc3NhZ2VzIChiZWNhdXNlIG9mIG5ldHdvcmsgc2xvd25lc3Mgb3Igb3RoZXIgaXNzdWVzLCBvciBiZWNhdXNlIHRoZXnigJlyZSBjb25uZWN0ZWQgdGhyb3VnaCBsb25nIHBvbGxpbmdcbiAgICogYW5kIGlzIGluIHRoZSBtaWRkbGUgb2YgYSByZXF1ZXN0LXJlc3BvbnNlIGN5Y2xlKS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8udm9sYXRpbGUuZW1pdChcImhlbGxvXCIpOyAvLyB0aGUgY2xpZW50cyBtYXkgb3IgbWF5IG5vdCByZWNlaXZlIGl0XG4gICAqXG4gICAqIEByZXR1cm4gYSBuZXcge0BsaW5rIEJyb2FkY2FzdE9wZXJhdG9yfSBpbnN0YW5jZSBmb3IgY2hhaW5pbmdcbiAgICovXG4gIHB1YmxpYyBnZXQgdm9sYXRpbGUoKTogQnJvYWRjYXN0T3BlcmF0b3I8RW1pdEV2ZW50cywgU29ja2V0RGF0YT4ge1xuICAgIGNvbnN0IGZsYWdzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5mbGFncywgeyB2b2xhdGlsZTogdHJ1ZSB9KTtcbiAgICByZXR1cm4gbmV3IEJyb2FkY2FzdE9wZXJhdG9yKFxuICAgICAgdGhpcy5hZGFwdGVyLFxuICAgICAgdGhpcy5yb29tcyxcbiAgICAgIHRoaXMuZXhjZXB0Um9vbXMsXG4gICAgICBmbGFncyxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtb2RpZmllciBmb3IgYSBzdWJzZXF1ZW50IGV2ZW50IGVtaXNzaW9uIHRoYXQgdGhlIGV2ZW50IGRhdGEgd2lsbCBvbmx5IGJlIGJyb2FkY2FzdCB0byB0aGUgY3VycmVudCBub2RlLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAvLyB0aGUg4oCcZm9v4oCdIGV2ZW50IHdpbGwgYmUgYnJvYWRjYXN0IHRvIGFsbCBjb25uZWN0ZWQgY2xpZW50cyBvbiB0aGlzIG5vZGVcbiAgICogaW8ubG9jYWwuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogQHJldHVybiBhIG5ldyB7QGxpbmsgQnJvYWRjYXN0T3BlcmF0b3J9IGluc3RhbmNlIGZvciBjaGFpbmluZ1xuICAgKi9cbiAgcHVibGljIGdldCBsb2NhbCgpOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPiB7XG4gICAgY29uc3QgZmxhZ3MgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmZsYWdzLCB7IGxvY2FsOiB0cnVlIH0pO1xuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IoXG4gICAgICB0aGlzLmFkYXB0ZXIsXG4gICAgICB0aGlzLnJvb21zLFxuICAgICAgdGhpcy5leGNlcHRSb29tcyxcbiAgICAgIGZsYWdzLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgbmV4dCBvcGVyYXRpb25cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogaW8udGltZW91dCgxMDAwKS5lbWl0KFwic29tZS1ldmVudFwiLCAoZXJyLCByZXNwb25zZXMpID0+IHtcbiAgICogICBpZiAoZXJyKSB7XG4gICAqICAgICAvLyBzb21lIGNsaWVudHMgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7IC8vIG9uZSByZXNwb25zZSBwZXIgY2xpZW50XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtIHRpbWVvdXRcbiAgICovXG4gIHB1YmxpYyB0aW1lb3V0KHRpbWVvdXQ6IG51bWJlcikge1xuICAgIGNvbnN0IGZsYWdzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5mbGFncywgeyB0aW1lb3V0IH0pO1xuICAgIHJldHVybiBuZXcgQnJvYWRjYXN0T3BlcmF0b3IoXG4gICAgICB0aGlzLmFkYXB0ZXIsXG4gICAgICB0aGlzLnJvb21zLFxuICAgICAgdGhpcy5leGNlcHRSb29tcyxcbiAgICAgIGZsYWdzLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogRW1pdHMgdG8gYWxsIGNsaWVudHMuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIHRoZSDigJxmb2/igJ0gZXZlbnQgd2lsbCBiZSBicm9hZGNhc3QgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzXG4gICAqIGlvLmVtaXQoXCJmb29cIiwgXCJiYXJcIik7XG4gICAqXG4gICAqIC8vIHRoZSDigJxmb2/igJ0gZXZlbnQgd2lsbCBiZSBicm9hZGNhc3QgdG8gYWxsIGNvbm5lY3RlZCBjbGllbnRzIGluIHRoZSDigJxyb29tLTEwMeKAnSByb29tXG4gICAqIGlvLnRvKFwicm9vbS0xMDFcIikuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAgICpcbiAgICogLy8gd2l0aCBhbiBhY2tub3dsZWRnZW1lbnQgZXhwZWN0ZWQgZnJvbSBhbGwgY29ubmVjdGVkIGNsaWVudHNcbiAgICogaW8udGltZW91dCgxMDAwKS5lbWl0KFwic29tZS1ldmVudFwiLCAoZXJyLCByZXNwb25zZXMpID0+IHtcbiAgICogICBpZiAoZXJyKSB7XG4gICAqICAgICAvLyBzb21lIGNsaWVudHMgZGlkIG5vdCBhY2tub3dsZWRnZSB0aGUgZXZlbnQgaW4gdGhlIGdpdmVuIGRlbGF5XG4gICAqICAgfSBlbHNlIHtcbiAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlcyk7IC8vIG9uZSByZXNwb25zZSBwZXIgY2xpZW50XG4gICAqICAgfVxuICAgKiB9KTtcbiAgICpcbiAgICogQHJldHVybiBBbHdheXMgdHJ1ZVxuICAgKi9cbiAgcHVibGljIGVtaXQ8RXYgZXh0ZW5kcyBFdmVudE5hbWVzPEVtaXRFdmVudHM+PihcbiAgICBldjogRXYsXG4gICAgLi4uYXJnczogRXZlbnRQYXJhbXM8RW1pdEV2ZW50cywgRXY+XG4gICk6IGJvb2xlYW4ge1xuICAgIGlmIChSRVNFUlZFRF9FVkVOVFMuaGFzKGV2KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBcIiR7U3RyaW5nKGV2KX1cIiBpcyBhIHJlc2VydmVkIGV2ZW50IG5hbWVgKTtcbiAgICB9XG4gICAgLy8gc2V0IHVwIHBhY2tldCBvYmplY3RcbiAgICBjb25zdCBkYXRhID0gW2V2LCAuLi5hcmdzXTtcbiAgICBjb25zdCBwYWNrZXQgPSB7XG4gICAgICAvLyBAdHMtaWdub3JlIEZJWE1FXG4gICAgICBuc3A6IHRoaXMuYWRhcHRlci5uc3AubmFtZSxcbiAgICAgIHR5cGU6IFBhY2tldFR5cGUuRVZFTlQsXG4gICAgICBkYXRhLFxuICAgIH07XG5cbiAgICBjb25zdCB3aXRoQWNrID0gdHlwZW9mIGRhdGFbZGF0YS5sZW5ndGggLSAxXSA9PT0gXCJmdW5jdGlvblwiO1xuXG4gICAgaWYgKCF3aXRoQWNrKSB7XG4gICAgICB0aGlzLmFkYXB0ZXIuYnJvYWRjYXN0KHBhY2tldCwge1xuICAgICAgICByb29tczogdGhpcy5yb29tcyxcbiAgICAgICAgZXhjZXB0OiB0aGlzLmV4Y2VwdFJvb21zLFxuICAgICAgICBmbGFnczogdGhpcy5mbGFncyxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCBhY2sgPSBkYXRhLnBvcCgpIGFzICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQ7XG4gICAgbGV0IHRpbWVkT3V0ID0gZmFsc2U7XG4gICAgY29uc3QgcmVzcG9uc2VzOiB1bmtub3duW10gPSBbXTtcblxuICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aW1lZE91dCA9IHRydWU7XG4gICAgICBhY2suYXBwbHkodGhpcywgW25ldyBFcnJvcihcIm9wZXJhdGlvbiBoYXMgdGltZWQgb3V0XCIpLCByZXNwb25zZXNdKTtcbiAgICB9LCB0aGlzLmZsYWdzLnRpbWVvdXQpO1xuXG4gICAgbGV0IGV4cGVjdGVkU2VydmVyQ291bnQgPSAtMTtcbiAgICBsZXQgYWN0dWFsU2VydmVyQ291bnQgPSAwO1xuICAgIGxldCBleHBlY3RlZENsaWVudENvdW50ID0gMDtcblxuICAgIGNvbnN0IGNoZWNrQ29tcGxldGVuZXNzID0gKCkgPT4ge1xuICAgICAgaWYgKFxuICAgICAgICAhdGltZWRPdXQgJiZcbiAgICAgICAgZXhwZWN0ZWRTZXJ2ZXJDb3VudCA9PT0gYWN0dWFsU2VydmVyQ291bnQgJiZcbiAgICAgICAgcmVzcG9uc2VzLmxlbmd0aCA9PT0gZXhwZWN0ZWRDbGllbnRDb3VudFxuICAgICAgKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgIGFjay5hcHBseSh0aGlzLCBbbnVsbCwgcmVzcG9uc2VzXSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHRoaXMuYWRhcHRlci5icm9hZGNhc3RXaXRoQWNrKFxuICAgICAgcGFja2V0LFxuICAgICAge1xuICAgICAgICByb29tczogdGhpcy5yb29tcyxcbiAgICAgICAgZXhjZXB0OiB0aGlzLmV4Y2VwdFJvb21zLFxuICAgICAgICBmbGFnczogdGhpcy5mbGFncyxcbiAgICAgIH0sXG4gICAgICAoY2xpZW50Q291bnQ6IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBlYWNoIFNvY2tldC5JTyBzZXJ2ZXIgaW4gdGhlIGNsdXN0ZXIgc2VuZHMgdGhlIG51bWJlciBvZiBjbGllbnRzIHRoYXQgd2VyZSBub3RpZmllZFxuICAgICAgICBleHBlY3RlZENsaWVudENvdW50ICs9IGNsaWVudENvdW50O1xuICAgICAgICBhY3R1YWxTZXJ2ZXJDb3VudCsrO1xuICAgICAgICBjaGVja0NvbXBsZXRlbmVzcygpO1xuICAgICAgfSxcbiAgICAgIChjbGllbnRSZXNwb25zZTogdW5rbm93bikgPT4ge1xuICAgICAgICAvLyBlYWNoIGNsaWVudCBzZW5kcyBhbiBhY2tub3dsZWRnZW1lbnRcbiAgICAgICAgcmVzcG9uc2VzLnB1c2goY2xpZW50UmVzcG9uc2UpO1xuICAgICAgICBjaGVja0NvbXBsZXRlbmVzcygpO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgdGhpcy5hZGFwdGVyLnNlcnZlckNvdW50KCkudGhlbigoc2VydmVyQ291bnQ6IG51bWJlcikgPT4ge1xuICAgICAgZXhwZWN0ZWRTZXJ2ZXJDb3VudCA9IHNlcnZlckNvdW50O1xuICAgICAgY2hlY2tDb21wbGV0ZW5lc3MoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG1hdGNoaW5nIHNvY2tldCBpbnN0YW5jZXMuIFRoaXMgbWV0aG9kIHdvcmtzIGFjcm9zcyBhIGNsdXN0ZXIgb2Ygc2V2ZXJhbCBTb2NrZXQuSU8gc2VydmVycy5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gcmV0dXJuIGFsbCBTb2NrZXQgaW5zdGFuY2VzXG4gICAqIGNvbnN0IHNvY2tldHMgPSBhd2FpdCBpby5mZXRjaFNvY2tldHMoKTtcbiAgICpcbiAgICogLy8gcmV0dXJuIGFsbCBTb2NrZXQgaW5zdGFuY2VzIGluIHRoZSBcInJvb20xXCIgcm9vbVxuICAgKiBjb25zdCBzb2NrZXRzID0gYXdhaXQgaW8uaW4oXCJyb29tMVwiKS5mZXRjaFNvY2tldHMoKTtcbiAgICpcbiAgICogZm9yIChjb25zdCBzb2NrZXQgb2Ygc29ja2V0cykge1xuICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5pZCk7XG4gICAqICAgY29uc29sZS5sb2coc29ja2V0LmhhbmRzaGFrZSk7XG4gICAqICAgY29uc29sZS5sb2coc29ja2V0LnJvb21zKTtcbiAgICogICBjb25zb2xlLmxvZyhzb2NrZXQuZGF0YSk7XG4gICAqXG4gICAqICAgc29ja2V0LmVtaXQoXCJoZWxsb1wiKTtcbiAgICogICBzb2NrZXQuam9pbihcInJvb20xXCIpO1xuICAgKiAgIHNvY2tldC5sZWF2ZShcInJvb20yXCIpO1xuICAgKiAgIHNvY2tldC5kaXNjb25uZWN0KCk7XG4gICAqIH1cbiAgICovXG4gIHB1YmxpYyBmZXRjaFNvY2tldHM8U29ja2V0RGF0YSA9IHVua25vd24+KCk6IFByb21pc2U8XG4gICAgUmVtb3RlU29ja2V0PEVtaXRFdmVudHMsIFNvY2tldERhdGE+W11cbiAgPiB7XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlclxuICAgICAgLmZldGNoU29ja2V0cyh7XG4gICAgICAgIHJvb21zOiB0aGlzLnJvb21zLFxuICAgICAgICBleGNlcHQ6IHRoaXMuZXhjZXB0Um9vbXMsXG4gICAgICAgIGZsYWdzOiB0aGlzLmZsYWdzLFxuICAgICAgfSlcbiAgICAgIC50aGVuKChzb2NrZXRzOiBTb2NrZXRbXSkgPT4ge1xuICAgICAgICByZXR1cm4gc29ja2V0cy5tYXAoKHNvY2tldCkgPT4ge1xuICAgICAgICAgIGlmIChzb2NrZXQgaW5zdGFuY2VvZiBTb2NrZXQpIHtcbiAgICAgICAgICAgIC8vIEZJWE1FIHRoZSBUeXBlU2NyaXB0IGNvbXBpbGVyIGNvbXBsYWlucyBhYm91dCBtaXNzaW5nIHByaXZhdGUgcHJvcGVydGllc1xuICAgICAgICAgICAgcmV0dXJuIHNvY2tldCBhcyB1bmtub3duIGFzIFJlbW90ZVNvY2tldDxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZW1vdGVTb2NrZXQoXG4gICAgICAgICAgICAgIHRoaXMuYWRhcHRlcixcbiAgICAgICAgICAgICAgc29ja2V0IGFzIFNvY2tldERldGFpbHM8U29ja2V0RGF0YT4sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlcyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlcyBqb2luIHRoZSBzcGVjaWZpZWQgcm9vbXMuXG4gICAqXG4gICAqIE5vdGU6IHRoaXMgbWV0aG9kIGFsc28gd29ya3Mgd2l0aGluIGEgY2x1c3RlciBvZiBtdWx0aXBsZSBTb2NrZXQuSU8gc2VydmVycywgd2l0aCBhIGNvbXBhdGlibGUge0BsaW5rIEFkYXB0ZXJ9LlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKlxuICAgKiAvLyBtYWtlIGFsbCBzb2NrZXQgaW5zdGFuY2VzIGpvaW4gdGhlIFwicm9vbTFcIiByb29tXG4gICAqIGlvLnNvY2tldHNKb2luKFwicm9vbTFcIik7XG4gICAqXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgaW4gdGhlIFwicm9vbTFcIiByb29tIGpvaW4gdGhlIFwicm9vbTJcIiBhbmQgXCJyb29tM1wiIHJvb21zXG4gICAqIGlvLmluKFwicm9vbTFcIikuc29ja2V0c0pvaW4oW1wicm9vbTJcIiwgXCJyb29tM1wiXSk7XG4gICAqXG4gICAqIEBwYXJhbSByb29tIC0gYSByb29tLCBvciBhbiBhcnJheSBvZiByb29tc1xuICAgKi9cbiAgcHVibGljIHNvY2tldHNKb2luKHJvb206IFJvb20gfCBSb29tW10pOiB2b2lkIHtcbiAgICB0aGlzLmFkYXB0ZXIuYWRkU29ja2V0cyhcbiAgICAgIHtcbiAgICAgICAgcm9vbXM6IHRoaXMucm9vbXMsXG4gICAgICAgIGV4Y2VwdDogdGhpcy5leGNlcHRSb29tcyxcbiAgICAgICAgZmxhZ3M6IHRoaXMuZmxhZ3MsXG4gICAgICB9LFxuICAgICAgQXJyYXkuaXNBcnJheShyb29tKSA/IHJvb20gOiBbcm9vbV0sXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlcyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlcyBsZWF2ZSB0aGUgc3BlY2lmaWVkIHJvb21zLlxuICAgKlxuICAgKiBOb3RlOiB0aGlzIG1ldGhvZCBhbHNvIHdvcmtzIHdpdGhpbiBhIGNsdXN0ZXIgb2YgbXVsdGlwbGUgU29ja2V0LklPIHNlcnZlcnMsIHdpdGggYSBjb21wYXRpYmxlIHtAbGluayBBZGFwdGVyfS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBsZWF2ZSB0aGUgXCJyb29tMVwiIHJvb21cbiAgICogaW8uc29ja2V0c0xlYXZlKFwicm9vbTFcIik7XG4gICAqXG4gICAqIC8vIG1ha2UgYWxsIHNvY2tldCBpbnN0YW5jZXMgaW4gdGhlIFwicm9vbTFcIiByb29tIGxlYXZlIHRoZSBcInJvb20yXCIgYW5kIFwicm9vbTNcIiByb29tc1xuICAgKiBpby5pbihcInJvb20xXCIpLnNvY2tldHNMZWF2ZShbXCJyb29tMlwiLCBcInJvb20zXCJdKTtcbiAgICpcbiAgICogQHBhcmFtIHJvb20gLSBhIHJvb20sIG9yIGFuIGFycmF5IG9mIHJvb21zXG4gICAqL1xuICBwdWJsaWMgc29ja2V0c0xlYXZlKHJvb206IFJvb20gfCBSb29tW10pOiB2b2lkIHtcbiAgICB0aGlzLmFkYXB0ZXIuZGVsU29ja2V0cyhcbiAgICAgIHtcbiAgICAgICAgcm9vbXM6IHRoaXMucm9vbXMsXG4gICAgICAgIGV4Y2VwdDogdGhpcy5leGNlcHRSb29tcyxcbiAgICAgICAgZmxhZ3M6IHRoaXMuZmxhZ3MsXG4gICAgICB9LFxuICAgICAgQXJyYXkuaXNBcnJheShyb29tKSA/IHJvb20gOiBbcm9vbV0sXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlcyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlcyBkaXNjb25uZWN0LlxuICAgKlxuICAgKiBOb3RlOiB0aGlzIG1ldGhvZCBhbHNvIHdvcmtzIHdpdGhpbiBhIGNsdXN0ZXIgb2YgbXVsdGlwbGUgU29ja2V0LklPIHNlcnZlcnMsIHdpdGggYSBjb21wYXRpYmxlIHtAbGluayBBZGFwdGVyfS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBkaXNjb25uZWN0ICh0aGUgY29ubmVjdGlvbnMgbWlnaHQgYmUga2VwdCBhbGl2ZSBmb3Igb3RoZXIgbmFtZXNwYWNlcylcbiAgICogaW8uZGlzY29ubmVjdFNvY2tldHMoKTtcbiAgICpcbiAgICogLy8gbWFrZSBhbGwgc29ja2V0IGluc3RhbmNlcyBpbiB0aGUgXCJyb29tMVwiIHJvb20gZGlzY29ubmVjdCBhbmQgY2xvc2UgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbnNcbiAgICogaW8uaW4oXCJyb29tMVwiKS5kaXNjb25uZWN0U29ja2V0cyh0cnVlKTtcbiAgICpcbiAgICogQHBhcmFtIGNsb3NlIC0gd2hldGhlciB0byBjbG9zZSB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uXG4gICAqL1xuICBwdWJsaWMgZGlzY29ubmVjdFNvY2tldHMoY2xvc2UgPSBmYWxzZSk6IHZvaWQge1xuICAgIHRoaXMuYWRhcHRlci5kaXNjb25uZWN0U29ja2V0cyhcbiAgICAgIHtcbiAgICAgICAgcm9vbXM6IHRoaXMucm9vbXMsXG4gICAgICAgIGV4Y2VwdDogdGhpcy5leGNlcHRSb29tcyxcbiAgICAgICAgZmxhZ3M6IHRoaXMuZmxhZ3MsXG4gICAgICB9LFxuICAgICAgY2xvc2UsXG4gICAgKTtcbiAgfVxufVxuXG4vKipcbiAqIEZvcm1hdCBvZiB0aGUgZGF0YSB3aGVuIHRoZSBTb2NrZXQgaW5zdGFuY2UgZXhpc3RzIG9uIGFub3RoZXIgU29ja2V0LklPIHNlcnZlclxuICovXG5pbnRlcmZhY2UgU29ja2V0RGV0YWlsczxTb2NrZXREYXRhPiB7XG4gIGlkOiBTb2NrZXRJZDtcbiAgaGFuZHNoYWtlOiBIYW5kc2hha2U7XG4gIHJvb21zOiBSb29tW107XG4gIGRhdGE6IFNvY2tldERhdGE7XG59XG5cbi8qKlxuICogRXhwb3NlIG9mIHN1YnNldCBvZiB0aGUgYXR0cmlidXRlcyBhbmQgbWV0aG9kcyBvZiB0aGUgU29ja2V0IGNsYXNzXG4gKi9cbmV4cG9ydCBjbGFzcyBSZW1vdGVTb2NrZXQ8RW1pdEV2ZW50cyBleHRlbmRzIEV2ZW50c01hcCwgU29ja2V0RGF0YT5cbiAgaW1wbGVtZW50cyBUeXBlZEV2ZW50QnJvYWRjYXN0ZXI8RW1pdEV2ZW50cz4ge1xuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IFNvY2tldElkO1xuICBwdWJsaWMgcmVhZG9ubHkgaGFuZHNoYWtlOiBIYW5kc2hha2U7XG4gIHB1YmxpYyByZWFkb25seSByb29tczogU2V0PFJvb20+O1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogU29ja2V0RGF0YTtcblxuICBwcml2YXRlIHJlYWRvbmx5IG9wZXJhdG9yOiBCcm9hZGNhc3RPcGVyYXRvcjxFbWl0RXZlbnRzLCBTb2NrZXREYXRhPjtcblxuICBjb25zdHJ1Y3RvcihhZGFwdGVyOiBBZGFwdGVyLCBkZXRhaWxzOiBTb2NrZXREZXRhaWxzPFNvY2tldERhdGE+KSB7XG4gICAgdGhpcy5pZCA9IGRldGFpbHMuaWQ7XG4gICAgdGhpcy5oYW5kc2hha2UgPSBkZXRhaWxzLmhhbmRzaGFrZTtcbiAgICB0aGlzLnJvb21zID0gbmV3IFNldChkZXRhaWxzLnJvb21zKTtcbiAgICB0aGlzLmRhdGEgPSBkZXRhaWxzLmRhdGE7XG4gICAgdGhpcy5vcGVyYXRvciA9IG5ldyBCcm9hZGNhc3RPcGVyYXRvcihhZGFwdGVyLCBuZXcgU2V0KFt0aGlzLmlkXSkpO1xuICB9XG5cbiAgcHVibGljIGVtaXQ8RXYgZXh0ZW5kcyBFdmVudE5hbWVzPEVtaXRFdmVudHM+PihcbiAgICBldjogRXYsXG4gICAgLi4uYXJnczogRXZlbnRQYXJhbXM8RW1pdEV2ZW50cywgRXY+XG4gICk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdG9yLmVtaXQoZXYsIC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEpvaW5zIGEgcm9vbS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXl9IHJvb20gLSByb29tIG9yIGFycmF5IG9mIHJvb21zXG4gICAqL1xuICBwdWJsaWMgam9pbihyb29tOiBSb29tIHwgUm9vbVtdKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0b3Iuc29ja2V0c0pvaW4ocm9vbSk7XG4gIH1cblxuICAvKipcbiAgICogTGVhdmVzIGEgcm9vbS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHJvb21cbiAgICovXG4gIHB1YmxpYyBsZWF2ZShyb29tOiBSb29tKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0b3Iuc29ja2V0c0xlYXZlKHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIERpc2Nvbm5lY3RzIHRoaXMgY2xpZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGNsb3NlIC0gaWYgYHRydWVgLCBjbG9zZXMgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvblxuICAgKiBAcmV0dXJuIHtTb2NrZXR9IHNlbGZcbiAgICovXG4gIHB1YmxpYyBkaXNjb25uZWN0KGNsb3NlID0gZmFsc2UpOiB0aGlzIHtcbiAgICB0aGlzLm9wZXJhdG9yLmRpc2Nvbm5lY3RTb2NrZXRzKGNsb3NlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLFNBQW9CLGVBQWUsRUFBRSxNQUFNLFFBQVEsY0FBYztBQUNqRSxTQUFTLFVBQVUsUUFBUSxnQ0FBZ0M7QUFhM0QsT0FBTyxNQUFNOzs7OztFQUVYLFlBQ0UsQUFBaUIsT0FBZ0IsRUFDakMsQUFBaUIsUUFBbUIsSUFBSSxLQUFXLEVBQ25ELEFBQWlCLGNBQXlCLElBQUksS0FBVyxFQUN6RCxBQUFpQixRQUF3QixDQUFDLENBQUMsQ0FDM0M7U0FKaUIsVUFBQTtTQUNBLFFBQUE7U0FDQSxjQUFBO1NBQ0EsUUFBQTtFQUNoQjtFQUVIOzs7Ozs7Ozs7Ozs7Ozs7R0FlQyxHQUNELEFBQU8sR0FBRyxJQUFtQixFQUE2QztJQUN4RSxNQUFNLFFBQVEsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLO0lBQ2hDLElBQUksTUFBTSxPQUFPLENBQUMsT0FBTztNQUN2QixLQUFLLE9BQU8sQ0FBQyxDQUFDLElBQU0sTUFBTSxHQUFHLENBQUM7SUFDaEMsT0FBTztNQUNMLE1BQU0sR0FBRyxDQUFDO0lBQ1o7SUFDQSxPQUFPLElBQUksa0JBQ1QsSUFBSSxDQUFDLE9BQU8sRUFDWixPQUNBLElBQUksQ0FBQyxXQUFXLEVBQ2hC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
// denoCacheMetadata=12339432280094050755,13542420069244101103