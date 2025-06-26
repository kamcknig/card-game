import { EventEmitter } from "../../event-emitter/mod.ts";
import { generateId } from "../../engine.io/mod.ts";
import { getLogger } from "../../../deps.ts";
const DEFAULT_TIMEOUT_MS = 5000;
export class InMemoryAdapter extends EventEmitter {
  nsp;
  rooms = new Map();
  sids = new Map();
  constructor(nsp){
    super();
    this.nsp = nsp;
  }
  /**
   * Returns the number of Socket.IO servers in the cluster
   */ serverCount() {
    return Promise.resolve(1);
  }
  /**
   * Adds a socket to a list of room.
   *
   * @param id - the socket ID
   * @param rooms - a set of rooms
   */ addAll(id, rooms) {
    let roomsForSid = this.sids.get(id);
    if (!roomsForSid) {
      this.sids.set(id, roomsForSid = new Set());
    }
    for (const room of rooms){
      roomsForSid.add(room);
      let sidsForRoom = this.rooms.get(room);
      if (!sidsForRoom) {
        this.rooms.set(room, sidsForRoom = new Set());
        this.emitReserved("create-room", room);
      }
      if (!sidsForRoom.has(id)) {
        sidsForRoom.add(id);
        this.emitReserved("join-room", room, id);
      }
    }
  }
  /**
   * Removes a socket from a room.
   *
   * @param {SocketId} id     the socket id
   * @param {Room}     room   the room name
   */ del(id, room) {
    this.sids.get(id)?.delete(room);
    this.removeSidFromRoom(room, id);
  }
  removeSidFromRoom(room, id) {
    const sids = this.rooms.get(room);
    if (!sids) {
      return;
    }
    const deleted = sids.delete(id);
    if (deleted) {
      this.emitReserved("leave-room", room, id);
    }
    if (sids.size === 0 && this.rooms.delete(room)) {
      this.emitReserved("delete-room", room);
    }
  }
  /**
   * Removes a socket from all rooms it's joined.
   *
   * @param id - the socket ID
   */ delAll(id) {
    const rooms = this.sids.get(id);
    if (!rooms) {
      return;
    }
    for (const room of rooms){
      this.removeSidFromRoom(room, id);
    }
    this.sids.delete(id);
  }
  /**
   * Broadcasts a packet.
   *
   * Options:
   *  - `flags` {Object} flags for this packet
   *  - `except` {Array} sids that should be excluded
   *  - `rooms` {Array} list of rooms to broadcast to
   *
   * @param {Object} packet   the packet object
   * @param {Object} opts     the options
   */ broadcast(packet, opts) {
    // make a copy of the array, since the `encode()` method updates the array in place to gather binary elements
    // note: this won't work with nested binary elements
    const args = packet.data.slice();
    const encodedPackets = this.nsp._server._encoder.encode(packet);
    this.apply(opts, (socket)=>{
      socket._notifyOutgoingListeners(args);
      socket.client._writeToEngine(encodedPackets, {
        volatile: opts.flags && opts.flags.volatile
      });
    });
  }
  /**
   * Broadcasts a packet and expects multiple acknowledgements.
   *
   * Options:
   *  - `flags` {Object} flags for this packet
   *  - `except` {Array} sids that should be excluded
   *  - `rooms` {Array} list of rooms to broadcast to
   *
   * @param {Object} packet   the packet object
   * @param {Object} opts     the options
   * @param clientCountCallback - the number of clients that received the packet
   * @param ack                 - the callback that will be called for each client response
   */ broadcastWithAck(packet, opts, clientCountCallback, ack) {
    const flags = opts.flags || {};
    const packetOpts = {
      preEncoded: true,
      volatile: flags.volatile
    };
    packet.nsp = this.nsp.name;
    // we can use the same id for each packet, since the _ids counter is common (no duplicate)
    packet.id = this.nsp._ids++;
    // make a copy of the array, since the `encode()` method updates the array in place to gather binary elements
    // note: this won't work with nested binary elements
    const args = packet.data.slice();
    const encodedPackets = this.nsp._server._encoder.encode(packet);
    let clientCount = 0;
    this.apply(opts, (socket)=>{
      // track the total number of acknowledgements that are expected
      clientCount++;
      // call the ack callback for each client response
      socket._acks.set(packet.id, ack);
      socket._notifyOutgoingListeners(args);
      socket.client._writeToEngine(encodedPackets, packetOpts);
    });
    clientCountCallback(clientCount);
  }
  /**
   * Gets the list of rooms a given socket has joined.
   *
   * @param {SocketId} id   the socket id
   */ socketRooms(id) {
    return this.sids.get(id);
  }
  /**
   * Returns the matching socket instances
   *
   * @param opts - the filters to apply
   */ fetchSockets(opts) {
    const sockets = [];
    this.apply(opts, (socket)=>{
      sockets.push(socket);
    });
    return Promise.resolve(sockets);
  }
  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param opts - the filters to apply
   * @param rooms - the rooms to join
   */ addSockets(opts, rooms) {
    this.apply(opts, (socket)=>{
      socket.join(rooms);
    });
  }
  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param opts - the filters to apply
   * @param rooms - the rooms to leave
   */ delSockets(opts, rooms) {
    this.apply(opts, (socket)=>{
      rooms.forEach((room)=>socket.leave(room));
    });
  }
  /**
   * Makes the matching socket instances disconnect
   *
   * @param opts - the filters to apply
   * @param close - whether to close the underlying connection
   */ disconnectSockets(opts, close) {
    this.apply(opts, (socket)=>{
      socket.disconnect(close);
    });
  }
  apply(opts, callback) {
    const rooms = opts.rooms;
    const except = this.computeExceptSids(opts.except);
    if (rooms.size) {
      const ids = new Set();
      for (const room of rooms){
        if (!this.rooms.has(room)) continue;
        for (const id of this.rooms.get(room)){
          if (ids.has(id) || except.has(id)) continue;
          const socket = this.nsp.sockets.get(id);
          if (socket) {
            callback(socket);
            ids.add(id);
          }
        }
      }
    } else {
      for (const [id] of this.sids){
        if (except.has(id)) continue;
        const socket = this.nsp.sockets.get(id);
        if (socket) callback(socket);
      }
    }
  }
  computeExceptSids(exceptRooms) {
    const exceptSids = new Set();
    if (exceptRooms && exceptRooms.size > 0) {
      for (const room of exceptRooms){
        this.rooms.get(room)?.forEach((sid)=>exceptSids.add(sid));
      }
    }
    return exceptSids;
  }
  /**
   * Send a packet to the other Socket.IO servers in the cluster
   * @param _packet - an array of arguments, which may include an acknowledgement callback at the end
   */ serverSideEmit(_packet) {
    console.warn("this adapter does not support the serverSideEmit() functionality");
  }
}
export var RequestType = /*#__PURE__*/ function(RequestType) {
  RequestType[RequestType["BROADCAST"] = 0] = "BROADCAST";
  RequestType[RequestType["SOCKETS_JOIN"] = 1] = "SOCKETS_JOIN";
  RequestType[RequestType["SOCKETS_LEAVE"] = 2] = "SOCKETS_LEAVE";
  RequestType[RequestType["DISCONNECT_SOCKETS"] = 3] = "DISCONNECT_SOCKETS";
  RequestType[RequestType["FETCH_SOCKETS"] = 4] = "FETCH_SOCKETS";
  RequestType[RequestType["FETCH_SOCKETS_RESPONSE"] = 5] = "FETCH_SOCKETS_RESPONSE";
  RequestType[RequestType["SERVER_SIDE_EMIT"] = 6] = "SERVER_SIDE_EMIT";
  RequestType[RequestType["SERVER_SIDE_EMIT_RESPONSE"] = 7] = "SERVER_SIDE_EMIT_RESPONSE";
  RequestType[RequestType["BROADCAST_CLIENT_COUNT"] = 8] = "BROADCAST_CLIENT_COUNT";
  RequestType[RequestType["BROADCAST_ACK"] = 9] = "BROADCAST_ACK";
  return RequestType;
}({});
function serializeSocket(socket) {
  return {
    id: socket.id,
    handshake: {
      headers: socket.handshake.headers,
      time: socket.handshake.time,
      address: socket.handshake.address,
      xdomain: socket.handshake.xdomain,
      secure: socket.handshake.secure,
      issued: socket.handshake.issued,
      url: socket.handshake.url,
      query: socket.handshake.query,
      auth: socket.handshake.auth
    },
    rooms: [
      ...socket.rooms
    ],
    data: socket.data
  };
}
export class Adapter extends InMemoryAdapter {
  uid;
  #pendingRequests = new Map();
  #ackRequests = new Map();
  constructor(nsp){
    super(nsp);
    this.uid = generateId();
  }
  addSockets(opts, rooms) {
    super.addSockets(opts, rooms);
    if (opts.flags?.local) {
      return;
    }
    this.publishRequest({
      uid: this.uid,
      type: RequestType.SOCKETS_JOIN,
      data: {
        opts: {
          rooms: [
            ...opts.rooms
          ],
          except: [
            ...opts.except
          ]
        },
        rooms: [
          ...rooms
        ]
      }
    });
  }
  delSockets(opts, rooms) {
    super.delSockets(opts, rooms);
    if (opts.flags?.local) {
      return;
    }
    this.publishRequest({
      uid: this.uid,
      type: RequestType.SOCKETS_LEAVE,
      data: {
        opts: {
          rooms: [
            ...opts.rooms
          ],
          except: [
            ...opts.except
          ]
        },
        rooms: [
          ...rooms
        ]
      }
    });
  }
  disconnectSockets(opts, close) {
    super.disconnectSockets(opts, close);
    if (opts.flags?.local) {
      return;
    }
    this.publishRequest({
      uid: this.uid,
      type: RequestType.DISCONNECT_SOCKETS,
      data: {
        opts: {
          rooms: [
            ...opts.rooms
          ],
          except: [
            ...opts.except
          ]
        },
        close
      }
    });
  }
  async fetchSockets(opts) {
    const localSockets = await super.fetchSockets(opts);
    if (opts.flags?.local) {
      return localSockets;
    }
    const expectedResponseCount = await this.serverCount() - 1;
    if (expectedResponseCount === 0) {
      return localSockets;
    }
    const requestId = generateId();
    return new Promise((resolve, reject)=>{
      const timerId = setTimeout(()=>{
        const storedRequest = this.#pendingRequests.get(requestId);
        if (storedRequest) {
          reject(new Error(`timeout reached: only ${storedRequest.currentCount} responses received out of ${storedRequest.expectedCount}`));
          this.#pendingRequests.delete(requestId);
        }
      }, opts.flags?.timeout || DEFAULT_TIMEOUT_MS);
      const storedRequest = {
        type: RequestType.FETCH_SOCKETS,
        resolve: ()=>{
          return resolve(storedRequest.responses);
        },
        timerId,
        currentCount: 0,
        expectedCount: expectedResponseCount,
        responses: localSockets
      };
      this.#pendingRequests.set(requestId, storedRequest);
      this.publishRequest({
        uid: this.uid,
        type: RequestType.FETCH_SOCKETS,
        data: {
          opts: {
            rooms: [
              ...opts.rooms
            ],
            except: [
              ...opts.except
            ]
          },
          requestId
        }
      });
    });
  }
  serverSideEmit(packet) {
    const withAck = typeof packet[packet.length - 1] === "function";
    if (withAck) {
      this.#serverSideEmitWithAck(packet).catch(()=>{
      // ignore errors
      });
      return;
    }
    this.publishRequest({
      uid: this.uid,
      type: RequestType.SERVER_SIDE_EMIT,
      data: {
        packet
      }
    });
  }
  async #serverSideEmitWithAck(packet) {
    const ack = packet.pop();
    const expectedResponseCount = await this.serverCount() - 1;
    if (expectedResponseCount === 0) {
      return ack(null, []);
    }
    const requestId = generateId();
    const timerId = setTimeout(()=>{
      const storedRequest = this.#pendingRequests.get(requestId);
      if (storedRequest) {
        ack(new Error(`timeout reached: only ${storedRequest.currentCount} responses received out of ${storedRequest.expectedCount}`), storedRequest.responses);
        this.#pendingRequests.delete(requestId);
      }
    }, DEFAULT_TIMEOUT_MS);
    const storedRequest = {
      type: RequestType.SERVER_SIDE_EMIT,
      resolve: ()=>{
        ack(null, storedRequest.responses);
      },
      timerId,
      currentCount: 0,
      expectedCount: expectedResponseCount,
      responses: []
    };
    this.#pendingRequests.set(requestId, storedRequest);
    this.publishRequest({
      uid: this.uid,
      type: RequestType.SERVER_SIDE_EMIT,
      data: {
        requestId,
        packet
      }
    });
  }
  broadcast(packet, opts) {
    const onlyLocal = opts.flags?.local;
    if (!onlyLocal) {
      this.publishRequest({
        uid: this.uid,
        type: RequestType.BROADCAST,
        data: {
          packet,
          opts: {
            rooms: [
              ...opts.rooms
            ],
            except: [
              ...opts.except
            ],
            flags: opts.flags
          }
        }
      });
    }
    setTimeout(()=>{
      super.broadcast(packet, opts);
    }, 0);
  }
  broadcastWithAck(packet, opts, clientCountCallback, ack) {
    const onlyLocal = opts.flags?.local;
    if (!onlyLocal) {
      const requestId = generateId();
      this.publishRequest({
        uid: this.uid,
        type: RequestType.BROADCAST,
        data: {
          packet,
          requestId,
          opts: {
            rooms: [
              ...opts.rooms
            ],
            except: [
              ...opts.except
            ],
            flags: opts.flags
          }
        }
      });
      this.#ackRequests.set(requestId, {
        clientCountCallback,
        ack
      });
      // we have no way to know at this level whether the server has received an acknowledgement from each client, so we
      // will simply clean up the ackRequests map after the given delay
      setTimeout(()=>{
        this.#ackRequests.delete(requestId);
      }, opts.flags.timeout);
    }
    setTimeout(()=>{
      super.broadcastWithAck(packet, opts, clientCountCallback, ack);
    }, 0);
  }
  async onRequest(request) {
    if (request.uid === this.uid) {
      getLogger("socket.io").debug(`[adapter] [${this.uid}] ignore self`);
      return;
    }
    getLogger("socket.io").debug(`[adapter] [${this.uid}] received request ${request.type} from ${request.uid}`);
    switch(request.type){
      case RequestType.BROADCAST:
        {
          const withAck = request.data.requestId !== undefined;
          const packet = request.data.packet;
          const opts = request.data.opts;
          if (withAck) {
            return super.broadcastWithAck(packet, {
              rooms: new Set(opts.rooms),
              except: new Set(opts.except)
            }, (clientCount)=>{
              getLogger("socket.io").debug(`[adapter] waiting for ${clientCount} client acknowledgements`);
              this.publishResponse(request.uid, {
                type: RequestType.BROADCAST_CLIENT_COUNT,
                data: {
                  requestId: request.data.requestId,
                  clientCount
                }
              });
            }, (arg)=>{
              getLogger("socket.io").debug(`[adapter] received one acknowledgement`);
              this.publishResponse(request.uid, {
                type: RequestType.BROADCAST_ACK,
                data: {
                  requestId: request.data.requestId,
                  packet: arg
                }
              });
            });
          } else {
            return super.broadcast(packet, {
              rooms: new Set(opts.rooms),
              except: new Set(opts.except)
            });
          }
        }
      case RequestType.SOCKETS_JOIN:
        {
          const opts = request.data.opts;
          const rooms = request.data.rooms;
          getLogger("socket.io").debug(`[adapter] calling socketsJoin ${rooms} in ${opts.rooms} except ${opts.except}`);
          return super.addSockets({
            rooms: new Set(opts.rooms),
            except: new Set(opts.except)
          }, rooms);
        }
      case RequestType.SOCKETS_LEAVE:
        {
          const opts = request.data.opts;
          const rooms = request.data.rooms;
          getLogger("socket.io").debug(`[adapter] calling socketsLeave ${rooms} in ${opts.rooms} except ${opts.except}`);
          return super.delSockets({
            rooms: new Set(opts.rooms),
            except: new Set(opts.except)
          }, rooms);
        }
      case RequestType.DISCONNECT_SOCKETS:
        {
          const opts = request.data.opts;
          const close = request.data.close;
          getLogger("socket.io").debug(`[adapter] calling disconnectSockets (close? ${close}) in ${opts.rooms} except ${opts.except}`);
          return super.disconnectSockets({
            rooms: new Set(opts.rooms),
            except: new Set(opts.except)
          }, close);
        }
      case RequestType.FETCH_SOCKETS:
        {
          const opts = request.data.opts;
          getLogger("socket.io").debug(`[adapter] calling fetchSockets in [${opts.rooms.join(",")}] except [${opts.except.join(",")}]`);
          const localSockets = await super.fetchSockets({
            rooms: new Set(opts.rooms),
            except: new Set(opts.except)
          });
          getLogger("socket.io").debug(`[adapter] responding to the fetchSockets request with ${localSockets.length} socket(s)`);
          this.publishResponse(request.uid, {
            type: RequestType.FETCH_SOCKETS_RESPONSE,
            data: {
              requestId: request.data.requestId,
              sockets: localSockets.map(serializeSocket)
            }
          });
          break;
        }
      case RequestType.SERVER_SIDE_EMIT:
        {
          const packet = request.data.packet;
          const withAck = request.data.requestId !== undefined;
          if (!withAck) {
            this.nsp._onServerSideEmit(packet);
            return;
          }
          let called = false;
          const callback = (arg)=>{
            // only one argument is expected
            if (called) {
              return;
            }
            called = true;
            this.publishResponse(request.uid, {
              type: RequestType.SERVER_SIDE_EMIT_RESPONSE,
              data: {
                requestId: request.data.requestId,
                packet: arg
              }
            });
          };
          packet.push(callback);
          this.nsp._onServerSideEmit(packet);
          break;
        }
      default:
        getLogger("socket.io").debug(`[adapter] unknown request type: ${request.type}`);
        break;
    }
  }
  onResponse(response) {
    const requestId = response.data.requestId;
    getLogger("socket.io").debug(`[adapter] [${this.uid}] received response ${response.type} to request ${requestId}`);
    switch(response.type){
      case RequestType.FETCH_SOCKETS_RESPONSE:
      case RequestType.SERVER_SIDE_EMIT_RESPONSE:
        {
          const request = this.#pendingRequests.get(requestId);
          if (!request) {
            getLogger("socket.io").debug(`[adapter] unknown request id: ${requestId}`);
            return;
          }
          if (response.type === RequestType.FETCH_SOCKETS_RESPONSE) {
            request.responses.push(...response.data.sockets);
          } else {
            request.responses.push(response.data.packet);
          }
          if (++request.currentCount === request.expectedCount) {
            clearTimeout(request.timerId);
            request.resolve();
            this.#pendingRequests.delete(requestId);
          }
          break;
        }
      case RequestType.BROADCAST_CLIENT_COUNT:
        return this.#ackRequests.get(requestId)?.clientCountCallback(response.data.clientCount);
      case RequestType.BROADCAST_ACK:
        return this.#ackRequests.get(requestId)?.ack(response.data.packet);
      default:
        getLogger("socket.io").debug(`[adapter] unknown response type: ${response.type}`);
        break;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL3NvY2tldC5pby9saWIvYWRhcHRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tIFwiLi4vLi4vZXZlbnQtZW1pdHRlci9tb2QudHNcIjtcbmltcG9ydCB7IHR5cGUgU29ja2V0IH0gZnJvbSBcIi4vc29ja2V0LnRzXCI7XG5pbXBvcnQgeyB0eXBlIE5hbWVzcGFjZSB9IGZyb20gXCIuL25hbWVzcGFjZS50c1wiO1xuaW1wb3J0IHsgdHlwZSBQYWNrZXQgfSBmcm9tIFwiLi4vLi4vc29ja2V0LmlvLXBhcnNlci9tb2QudHNcIjtcbmltcG9ydCB7IGdlbmVyYXRlSWQgfSBmcm9tIFwiLi4vLi4vZW5naW5lLmlvL21vZC50c1wiO1xuaW1wb3J0IHsgZ2V0TG9nZ2VyIH0gZnJvbSBcIi4uLy4uLy4uL2RlcHMudHNcIjtcblxuY29uc3QgREVGQVVMVF9USU1FT1VUX01TID0gNTAwMDtcblxuZXhwb3J0IHR5cGUgU29ja2V0SWQgPSBzdHJpbmc7XG5leHBvcnQgdHlwZSBSb29tID0gc3RyaW5nIHwgbnVtYmVyO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJyb2FkY2FzdE9wdGlvbnMge1xuICByb29tczogU2V0PFJvb20+O1xuICBleGNlcHQ6IFNldDxSb29tPjtcbiAgZmxhZ3M/OiBCcm9hZGNhc3RGbGFncztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCcm9hZGNhc3RGbGFncyB7XG4gIHZvbGF0aWxlPzogYm9vbGVhbjtcbiAgbG9jYWw/OiBib29sZWFuO1xuICBicm9hZGNhc3Q/OiBib29sZWFuO1xuICB0aW1lb3V0PzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgQWRhcHRlckV2ZW50cyB7XG4gIFwiY3JlYXRlLXJvb21cIjogKHJvb206IFJvb20pID0+IHZvaWQ7XG4gIFwiZGVsZXRlLXJvb21cIjogKHJvb206IFJvb20pID0+IHZvaWQ7XG4gIFwiam9pbi1yb29tXCI6IChyb29tOiBSb29tLCBzaWQ6IFNvY2tldElkKSA9PiB2b2lkO1xuICBcImxlYXZlLXJvb21cIjogKHJvb206IFJvb20sIHNpZDogU29ja2V0SWQpID0+IHZvaWQ7XG4gIFwiZXJyb3JcIjogKGVycjogRXJyb3IpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBJbk1lbW9yeUFkYXB0ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXI8XG4gIFJlY29yZDxuZXZlciwgbmV2ZXI+LFxuICBSZWNvcmQ8bmV2ZXIsIG5ldmVyPixcbiAgQWRhcHRlckV2ZW50c1xuPiB7XG4gIHByb3RlY3RlZCByZWFkb25seSBuc3A6IE5hbWVzcGFjZTtcblxuICBwcm90ZWN0ZWQgcm9vbXM6IE1hcDxSb29tLCBTZXQ8U29ja2V0SWQ+PiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBzaWRzOiBNYXA8U29ja2V0SWQsIFNldDxSb29tPj4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IobnNwOiBOYW1lc3BhY2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubnNwID0gbnNwO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIG51bWJlciBvZiBTb2NrZXQuSU8gc2VydmVycyBpbiB0aGUgY2x1c3RlclxuICAgKi9cbiAgcHVibGljIHNlcnZlckNvdW50KCk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgxKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgc29ja2V0IHRvIGEgbGlzdCBvZiByb29tLlxuICAgKlxuICAgKiBAcGFyYW0gaWQgLSB0aGUgc29ja2V0IElEXG4gICAqIEBwYXJhbSByb29tcyAtIGEgc2V0IG9mIHJvb21zXG4gICAqL1xuICBwdWJsaWMgYWRkQWxsKGlkOiBTb2NrZXRJZCwgcm9vbXM6IFNldDxSb29tPik6IFByb21pc2U8dm9pZD4gfCB2b2lkIHtcbiAgICBsZXQgcm9vbXNGb3JTaWQgPSB0aGlzLnNpZHMuZ2V0KGlkKTtcbiAgICBpZiAoIXJvb21zRm9yU2lkKSB7XG4gICAgICB0aGlzLnNpZHMuc2V0KGlkLCByb29tc0ZvclNpZCA9IG5ldyBTZXQoKSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XG4gICAgICByb29tc0ZvclNpZC5hZGQocm9vbSk7XG5cbiAgICAgIGxldCBzaWRzRm9yUm9vbSA9IHRoaXMucm9vbXMuZ2V0KHJvb20pO1xuXG4gICAgICBpZiAoIXNpZHNGb3JSb29tKSB7XG4gICAgICAgIHRoaXMucm9vbXMuc2V0KHJvb20sIHNpZHNGb3JSb29tID0gbmV3IFNldCgpKTtcbiAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJjcmVhdGUtcm9vbVwiLCByb29tKTtcbiAgICAgIH1cbiAgICAgIGlmICghc2lkc0ZvclJvb20uaGFzKGlkKSkge1xuICAgICAgICBzaWRzRm9yUm9vbS5hZGQoaWQpO1xuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImpvaW4tcm9vbVwiLCByb29tLCBpZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBzb2NrZXQgZnJvbSBhIHJvb20uXG4gICAqXG4gICAqIEBwYXJhbSB7U29ja2V0SWR9IGlkICAgICB0aGUgc29ja2V0IGlkXG4gICAqIEBwYXJhbSB7Um9vbX0gICAgIHJvb20gICB0aGUgcm9vbSBuYW1lXG4gICAqL1xuICBwdWJsaWMgZGVsKGlkOiBTb2NrZXRJZCwgcm9vbTogUm9vbSk6IFByb21pc2U8dm9pZD4gfCB2b2lkIHtcbiAgICB0aGlzLnNpZHMuZ2V0KGlkKT8uZGVsZXRlKHJvb20pO1xuICAgIHRoaXMucmVtb3ZlU2lkRnJvbVJvb20ocm9vbSwgaWQpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVTaWRGcm9tUm9vbShyb29tOiBSb29tLCBpZDogU29ja2V0SWQpIHtcbiAgICBjb25zdCBzaWRzID0gdGhpcy5yb29tcy5nZXQocm9vbSk7XG5cbiAgICBpZiAoIXNpZHMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkZWxldGVkID0gc2lkcy5kZWxldGUoaWQpO1xuICAgIGlmIChkZWxldGVkKSB7XG4gICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImxlYXZlLXJvb21cIiwgcm9vbSwgaWQpO1xuICAgIH1cbiAgICBpZiAoc2lkcy5zaXplID09PSAwICYmIHRoaXMucm9vbXMuZGVsZXRlKHJvb20pKSB7XG4gICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImRlbGV0ZS1yb29tXCIsIHJvb20pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgc29ja2V0IGZyb20gYWxsIHJvb21zIGl0J3Mgam9pbmVkLlxuICAgKlxuICAgKiBAcGFyYW0gaWQgLSB0aGUgc29ja2V0IElEXG4gICAqL1xuICBwdWJsaWMgZGVsQWxsKGlkOiBTb2NrZXRJZCk6IHZvaWQge1xuICAgIGNvbnN0IHJvb21zID0gdGhpcy5zaWRzLmdldChpZCk7XG5cbiAgICBpZiAoIXJvb21zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XG4gICAgICB0aGlzLnJlbW92ZVNpZEZyb21Sb29tKHJvb20sIGlkKTtcbiAgICB9XG5cbiAgICB0aGlzLnNpZHMuZGVsZXRlKGlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBCcm9hZGNhc3RzIGEgcGFja2V0LlxuICAgKlxuICAgKiBPcHRpb25zOlxuICAgKiAgLSBgZmxhZ3NgIHtPYmplY3R9IGZsYWdzIGZvciB0aGlzIHBhY2tldFxuICAgKiAgLSBgZXhjZXB0YCB7QXJyYXl9IHNpZHMgdGhhdCBzaG91bGQgYmUgZXhjbHVkZWRcbiAgICogIC0gYHJvb21zYCB7QXJyYXl9IGxpc3Qgb2Ygcm9vbXMgdG8gYnJvYWRjYXN0IHRvXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXQgICB0aGUgcGFja2V0IG9iamVjdFxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0cyAgICAgdGhlIG9wdGlvbnNcbiAgICovXG4gIHB1YmxpYyBicm9hZGNhc3QocGFja2V0OiBQYWNrZXQsIG9wdHM6IEJyb2FkY2FzdE9wdGlvbnMpOiB2b2lkIHtcbiAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYXJyYXksIHNpbmNlIHRoZSBgZW5jb2RlKClgIG1ldGhvZCB1cGRhdGVzIHRoZSBhcnJheSBpbiBwbGFjZSB0byBnYXRoZXIgYmluYXJ5IGVsZW1lbnRzXG4gICAgLy8gbm90ZTogdGhpcyB3b24ndCB3b3JrIHdpdGggbmVzdGVkIGJpbmFyeSBlbGVtZW50c1xuICAgIGNvbnN0IGFyZ3MgPSBwYWNrZXQuZGF0YS5zbGljZSgpO1xuICAgIGNvbnN0IGVuY29kZWRQYWNrZXRzID0gdGhpcy5uc3AuX3NlcnZlci5fZW5jb2Rlci5lbmNvZGUocGFja2V0KTtcblxuICAgIHRoaXMuYXBwbHkob3B0cywgKHNvY2tldCkgPT4ge1xuICAgICAgc29ja2V0Ll9ub3RpZnlPdXRnb2luZ0xpc3RlbmVycyhhcmdzKTtcbiAgICAgIHNvY2tldC5jbGllbnQuX3dyaXRlVG9FbmdpbmUoZW5jb2RlZFBhY2tldHMsIHtcbiAgICAgICAgdm9sYXRpbGU6IG9wdHMuZmxhZ3MgJiYgb3B0cy5mbGFncy52b2xhdGlsZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEJyb2FkY2FzdHMgYSBwYWNrZXQgYW5kIGV4cGVjdHMgbXVsdGlwbGUgYWNrbm93bGVkZ2VtZW50cy5cbiAgICpcbiAgICogT3B0aW9uczpcbiAgICogIC0gYGZsYWdzYCB7T2JqZWN0fSBmbGFncyBmb3IgdGhpcyBwYWNrZXRcbiAgICogIC0gYGV4Y2VwdGAge0FycmF5fSBzaWRzIHRoYXQgc2hvdWxkIGJlIGV4Y2x1ZGVkXG4gICAqICAtIGByb29tc2Age0FycmF5fSBsaXN0IG9mIHJvb21zIHRvIGJyb2FkY2FzdCB0b1xuICAgKlxuICAgKiBAcGFyYW0ge09iamVjdH0gcGFja2V0ICAgdGhlIHBhY2tldCBvYmplY3RcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHMgICAgIHRoZSBvcHRpb25zXG4gICAqIEBwYXJhbSBjbGllbnRDb3VudENhbGxiYWNrIC0gdGhlIG51bWJlciBvZiBjbGllbnRzIHRoYXQgcmVjZWl2ZWQgdGhlIHBhY2tldFxuICAgKiBAcGFyYW0gYWNrICAgICAgICAgICAgICAgICAtIHRoZSBjYWxsYmFjayB0aGF0IHdpbGwgYmUgY2FsbGVkIGZvciBlYWNoIGNsaWVudCByZXNwb25zZVxuICAgKi9cbiAgcHVibGljIGJyb2FkY2FzdFdpdGhBY2soXG4gICAgcGFja2V0OiBQYWNrZXQsXG4gICAgb3B0czogQnJvYWRjYXN0T3B0aW9ucyxcbiAgICBjbGllbnRDb3VudENhbGxiYWNrOiAoY2xpZW50Q291bnQ6IG51bWJlcikgPT4gdm9pZCxcbiAgICBhY2s6ICguLi5hcmdzOiB1bmtub3duW10pID0+IHZvaWQsXG4gICkge1xuICAgIGNvbnN0IGZsYWdzID0gb3B0cy5mbGFncyB8fCB7fTtcbiAgICBjb25zdCBwYWNrZXRPcHRzID0ge1xuICAgICAgcHJlRW5jb2RlZDogdHJ1ZSxcbiAgICAgIHZvbGF0aWxlOiBmbGFncy52b2xhdGlsZSxcbiAgICB9O1xuXG4gICAgcGFja2V0Lm5zcCA9IHRoaXMubnNwLm5hbWU7XG4gICAgLy8gd2UgY2FuIHVzZSB0aGUgc2FtZSBpZCBmb3IgZWFjaCBwYWNrZXQsIHNpbmNlIHRoZSBfaWRzIGNvdW50ZXIgaXMgY29tbW9uIChubyBkdXBsaWNhdGUpXG4gICAgcGFja2V0LmlkID0gdGhpcy5uc3AuX2lkcysrO1xuXG4gICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGFycmF5LCBzaW5jZSB0aGUgYGVuY29kZSgpYCBtZXRob2QgdXBkYXRlcyB0aGUgYXJyYXkgaW4gcGxhY2UgdG8gZ2F0aGVyIGJpbmFyeSBlbGVtZW50c1xuICAgIC8vIG5vdGU6IHRoaXMgd29uJ3Qgd29yayB3aXRoIG5lc3RlZCBiaW5hcnkgZWxlbWVudHNcbiAgICBjb25zdCBhcmdzID0gcGFja2V0LmRhdGEuc2xpY2UoKTtcbiAgICBjb25zdCBlbmNvZGVkUGFja2V0cyA9IHRoaXMubnNwLl9zZXJ2ZXIuX2VuY29kZXIuZW5jb2RlKHBhY2tldCk7XG5cbiAgICBsZXQgY2xpZW50Q291bnQgPSAwO1xuXG4gICAgdGhpcy5hcHBseShvcHRzLCAoc29ja2V0KSA9PiB7XG4gICAgICAvLyB0cmFjayB0aGUgdG90YWwgbnVtYmVyIG9mIGFja25vd2xlZGdlbWVudHMgdGhhdCBhcmUgZXhwZWN0ZWRcbiAgICAgIGNsaWVudENvdW50Kys7XG4gICAgICAvLyBjYWxsIHRoZSBhY2sgY2FsbGJhY2sgZm9yIGVhY2ggY2xpZW50IHJlc3BvbnNlXG4gICAgICBzb2NrZXQuX2Fja3Muc2V0KHBhY2tldC5pZCEsIGFjayk7XG5cbiAgICAgIHNvY2tldC5fbm90aWZ5T3V0Z29pbmdMaXN0ZW5lcnMoYXJncyk7XG4gICAgICBzb2NrZXQuY2xpZW50Ll93cml0ZVRvRW5naW5lKGVuY29kZWRQYWNrZXRzLCBwYWNrZXRPcHRzKTtcbiAgICB9KTtcblxuICAgIGNsaWVudENvdW50Q2FsbGJhY2soY2xpZW50Q291bnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIGxpc3Qgb2Ygcm9vbXMgYSBnaXZlbiBzb2NrZXQgaGFzIGpvaW5lZC5cbiAgICpcbiAgICogQHBhcmFtIHtTb2NrZXRJZH0gaWQgICB0aGUgc29ja2V0IGlkXG4gICAqL1xuICBwdWJsaWMgc29ja2V0Um9vbXMoaWQ6IFNvY2tldElkKTogU2V0PFJvb20+IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5zaWRzLmdldChpZCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlc1xuICAgKlxuICAgKiBAcGFyYW0gb3B0cyAtIHRoZSBmaWx0ZXJzIHRvIGFwcGx5XG4gICAqL1xuICBwdWJsaWMgZmV0Y2hTb2NrZXRzKG9wdHM6IEJyb2FkY2FzdE9wdGlvbnMpOiBQcm9taXNlPFNvY2tldFtdPiB7XG4gICAgY29uc3Qgc29ja2V0czogU29ja2V0W10gPSBbXTtcblxuICAgIHRoaXMuYXBwbHkob3B0cywgKHNvY2tldCkgPT4ge1xuICAgICAgc29ja2V0cy5wdXNoKHNvY2tldCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNvY2tldHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1ha2VzIHRoZSBtYXRjaGluZyBzb2NrZXQgaW5zdGFuY2VzIGpvaW4gdGhlIHNwZWNpZmllZCByb29tc1xuICAgKlxuICAgKiBAcGFyYW0gb3B0cyAtIHRoZSBmaWx0ZXJzIHRvIGFwcGx5XG4gICAqIEBwYXJhbSByb29tcyAtIHRoZSByb29tcyB0byBqb2luXG4gICAqL1xuICBwdWJsaWMgYWRkU29ja2V0cyhvcHRzOiBCcm9hZGNhc3RPcHRpb25zLCByb29tczogUm9vbVtdKTogdm9pZCB7XG4gICAgdGhpcy5hcHBseShvcHRzLCAoc29ja2V0KSA9PiB7XG4gICAgICBzb2NrZXQuam9pbihyb29tcyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTWFrZXMgdGhlIG1hdGNoaW5nIHNvY2tldCBpbnN0YW5jZXMgbGVhdmUgdGhlIHNwZWNpZmllZCByb29tc1xuICAgKlxuICAgKiBAcGFyYW0gb3B0cyAtIHRoZSBmaWx0ZXJzIHRvIGFwcGx5XG4gICAqIEBwYXJhbSByb29tcyAtIHRoZSByb29tcyB0byBsZWF2ZVxuICAgKi9cbiAgcHVibGljIGRlbFNvY2tldHMob3B0czogQnJvYWRjYXN0T3B0aW9ucywgcm9vbXM6IFJvb21bXSk6IHZvaWQge1xuICAgIHRoaXMuYXBwbHkob3B0cywgKHNvY2tldCkgPT4ge1xuICAgICAgcm9vbXMuZm9yRWFjaCgocm9vbSkgPT4gc29ja2V0LmxlYXZlKHJvb20pKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlcyB0aGUgbWF0Y2hpbmcgc29ja2V0IGluc3RhbmNlcyBkaXNjb25uZWN0XG4gICAqXG4gICAqIEBwYXJhbSBvcHRzIC0gdGhlIGZpbHRlcnMgdG8gYXBwbHlcbiAgICogQHBhcmFtIGNsb3NlIC0gd2hldGhlciB0byBjbG9zZSB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uXG4gICAqL1xuICBwdWJsaWMgZGlzY29ubmVjdFNvY2tldHMob3B0czogQnJvYWRjYXN0T3B0aW9ucywgY2xvc2U6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLmFwcGx5KG9wdHMsIChzb2NrZXQpID0+IHtcbiAgICAgIHNvY2tldC5kaXNjb25uZWN0KGNsb3NlKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXBwbHkoXG4gICAgb3B0czogQnJvYWRjYXN0T3B0aW9ucyxcbiAgICBjYWxsYmFjazogKHNvY2tldDogU29ja2V0KSA9PiB2b2lkLFxuICApOiB2b2lkIHtcbiAgICBjb25zdCByb29tcyA9IG9wdHMucm9vbXM7XG4gICAgY29uc3QgZXhjZXB0ID0gdGhpcy5jb21wdXRlRXhjZXB0U2lkcyhvcHRzLmV4Y2VwdCk7XG5cbiAgICBpZiAocm9vbXMuc2l6ZSkge1xuICAgICAgY29uc3QgaWRzID0gbmV3IFNldCgpO1xuICAgICAgZm9yIChjb25zdCByb29tIG9mIHJvb21zKSB7XG4gICAgICAgIGlmICghdGhpcy5yb29tcy5oYXMocm9vbSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5yb29tcy5nZXQocm9vbSkhKSB7XG4gICAgICAgICAgaWYgKGlkcy5oYXMoaWQpIHx8IGV4Y2VwdC5oYXMoaWQpKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBzb2NrZXQgPSB0aGlzLm5zcC5zb2NrZXRzLmdldChpZCk7XG4gICAgICAgICAgaWYgKHNvY2tldCkge1xuICAgICAgICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICAgICAgICAgIGlkcy5hZGQoaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGNvbnN0IFtpZF0gb2YgdGhpcy5zaWRzKSB7XG4gICAgICAgIGlmIChleGNlcHQuaGFzKGlkKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IHNvY2tldCA9IHRoaXMubnNwLnNvY2tldHMuZ2V0KGlkKTtcbiAgICAgICAgaWYgKHNvY2tldCkgY2FsbGJhY2soc29ja2V0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNvbXB1dGVFeGNlcHRTaWRzKGV4Y2VwdFJvb21zPzogU2V0PFJvb20+KSB7XG4gICAgY29uc3QgZXhjZXB0U2lkcyA9IG5ldyBTZXQoKTtcbiAgICBpZiAoZXhjZXB0Um9vbXMgJiYgZXhjZXB0Um9vbXMuc2l6ZSA+IDApIHtcbiAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiBleGNlcHRSb29tcykge1xuICAgICAgICB0aGlzLnJvb21zLmdldChyb29tKT8uZm9yRWFjaCgoc2lkKSA9PiBleGNlcHRTaWRzLmFkZChzaWQpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGV4Y2VwdFNpZHM7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHBhY2tldCB0byB0aGUgb3RoZXIgU29ja2V0LklPIHNlcnZlcnMgaW4gdGhlIGNsdXN0ZXJcbiAgICogQHBhcmFtIF9wYWNrZXQgLSBhbiBhcnJheSBvZiBhcmd1bWVudHMsIHdoaWNoIG1heSBpbmNsdWRlIGFuIGFja25vd2xlZGdlbWVudCBjYWxsYmFjayBhdCB0aGUgZW5kXG4gICAqL1xuICBwdWJsaWMgc2VydmVyU2lkZUVtaXQoX3BhY2tldDogdW5rbm93bltdKTogdm9pZCB7XG4gICAgY29uc29sZS53YXJuKFxuICAgICAgXCJ0aGlzIGFkYXB0ZXIgZG9lcyBub3Qgc3VwcG9ydCB0aGUgc2VydmVyU2lkZUVtaXQoKSBmdW5jdGlvbmFsaXR5XCIsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZW51bSBSZXF1ZXN0VHlwZSB7XG4gIEJST0FEQ0FTVCxcbiAgU09DS0VUU19KT0lOLFxuICBTT0NLRVRTX0xFQVZFLFxuICBESVNDT05ORUNUX1NPQ0tFVFMsXG4gIEZFVENIX1NPQ0tFVFMsXG4gIEZFVENIX1NPQ0tFVFNfUkVTUE9OU0UsXG4gIFNFUlZFUl9TSURFX0VNSVQsXG4gIFNFUlZFUl9TSURFX0VNSVRfUkVTUE9OU0UsXG4gIEJST0FEQ0FTVF9DTElFTlRfQ09VTlQsXG4gIEJST0FEQ0FTVF9BQ0ssXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlclJlcXVlc3Qge1xuICAvKipcbiAgICogVGhlIFVJRCBvZiB0aGUgc2VydmVyIHRoYXQgc2VuZHMgdGhlIHJlcXVlc3RcbiAgICovXG4gIHVpZDogc3RyaW5nO1xuICB0eXBlOiBSZXF1ZXN0VHlwZTtcbiAgZGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2x1c3RlclJlc3BvbnNlIHtcbiAgdHlwZTogUmVxdWVzdFR5cGU7XG4gIGRhdGE6IHtcbiAgICByZXF1ZXN0SWQ6IHN0cmluZztcbiAgICBba2V5OiBzdHJpbmddOiB1bmtub3duO1xuICB9O1xufVxuXG5pbnRlcmZhY2UgUGVuZGluZ1JlcXVlc3Qge1xuICB0eXBlOiBSZXF1ZXN0VHlwZTtcbiAgcmVzb2x2ZTogKCkgPT4gdm9pZDtcbiAgdGltZXJJZDogbnVtYmVyO1xuICBleHBlY3RlZENvdW50OiBudW1iZXI7XG4gIGN1cnJlbnRDb3VudDogbnVtYmVyO1xuICByZXNwb25zZXM6IHVua25vd25bXTtcbn1cblxuaW50ZXJmYWNlIEFja1JlcXVlc3Qge1xuICBjbGllbnRDb3VudENhbGxiYWNrOiAoY2xpZW50Q291bnQ6IG51bWJlcikgPT4gdm9pZDtcbiAgYWNrOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkO1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVTb2NrZXQoc29ja2V0OiBTb2NrZXQpIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogc29ja2V0LmlkLFxuICAgIGhhbmRzaGFrZToge1xuICAgICAgaGVhZGVyczogc29ja2V0LmhhbmRzaGFrZS5oZWFkZXJzLFxuICAgICAgdGltZTogc29ja2V0LmhhbmRzaGFrZS50aW1lLFxuICAgICAgYWRkcmVzczogc29ja2V0LmhhbmRzaGFrZS5hZGRyZXNzLFxuICAgICAgeGRvbWFpbjogc29ja2V0LmhhbmRzaGFrZS54ZG9tYWluLFxuICAgICAgc2VjdXJlOiBzb2NrZXQuaGFuZHNoYWtlLnNlY3VyZSxcbiAgICAgIGlzc3VlZDogc29ja2V0LmhhbmRzaGFrZS5pc3N1ZWQsXG4gICAgICB1cmw6IHNvY2tldC5oYW5kc2hha2UudXJsLFxuICAgICAgcXVlcnk6IHNvY2tldC5oYW5kc2hha2UucXVlcnksXG4gICAgICBhdXRoOiBzb2NrZXQuaGFuZHNoYWtlLmF1dGgsXG4gICAgfSxcbiAgICByb29tczogWy4uLnNvY2tldC5yb29tc10sXG4gICAgZGF0YTogc29ja2V0LmRhdGEsXG4gIH07XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBZGFwdGVyIGV4dGVuZHMgSW5NZW1vcnlBZGFwdGVyIHtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IHVpZDogc3RyaW5nO1xuXG4gICNwZW5kaW5nUmVxdWVzdHMgPSBuZXcgTWFwPFxuICAgIHN0cmluZyxcbiAgICBQZW5kaW5nUmVxdWVzdFxuICA+KCk7XG5cbiAgI2Fja1JlcXVlc3RzID0gbmV3IE1hcDxcbiAgICBzdHJpbmcsXG4gICAgQWNrUmVxdWVzdFxuICA+KCk7XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKG5zcDogTmFtZXNwYWNlKSB7XG4gICAgc3VwZXIobnNwKTtcbiAgICB0aGlzLnVpZCA9IGdlbmVyYXRlSWQoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kcyByZXF1ZXN0IHRvIHRoZSBvdGhlciBTb2NrZXQuSU8gc2VydmVyc1xuICAgKlxuICAgKiBAcGFyYW0gcmVxdWVzdFxuICAgKiBAcHJvdGVjdGVkXG4gICAqL1xuICBwcm90ZWN0ZWQgYWJzdHJhY3QgcHVibGlzaFJlcXVlc3QocmVxdWVzdDogQ2x1c3RlclJlcXVlc3QpOiB2b2lkO1xuXG4gIHByb3RlY3RlZCBhYnN0cmFjdCBwdWJsaXNoUmVzcG9uc2UoXG4gICAgcmVxdWVzdGVyVWlkOiBzdHJpbmcsXG4gICAgcmVzcG9uc2U6IENsdXN0ZXJSZXNwb25zZSxcbiAgKTogdm9pZDtcblxuICBvdmVycmlkZSBhZGRTb2NrZXRzKG9wdHM6IEJyb2FkY2FzdE9wdGlvbnMsIHJvb21zOiBSb29tW10pIHtcbiAgICBzdXBlci5hZGRTb2NrZXRzKG9wdHMsIHJvb21zKTtcblxuICAgIGlmIChvcHRzLmZsYWdzPy5sb2NhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucHVibGlzaFJlcXVlc3Qoe1xuICAgICAgdWlkOiB0aGlzLnVpZCxcbiAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLlNPQ0tFVFNfSk9JTixcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgb3B0czoge1xuICAgICAgICAgIHJvb21zOiBbLi4ub3B0cy5yb29tc10sXG4gICAgICAgICAgZXhjZXB0OiBbLi4ub3B0cy5leGNlcHRdLFxuICAgICAgICB9LFxuICAgICAgICByb29tczogWy4uLnJvb21zXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBvdmVycmlkZSBkZWxTb2NrZXRzKG9wdHM6IEJyb2FkY2FzdE9wdGlvbnMsIHJvb21zOiBSb29tW10pIHtcbiAgICBzdXBlci5kZWxTb2NrZXRzKG9wdHMsIHJvb21zKTtcblxuICAgIGlmIChvcHRzLmZsYWdzPy5sb2NhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucHVibGlzaFJlcXVlc3Qoe1xuICAgICAgdWlkOiB0aGlzLnVpZCxcbiAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLlNPQ0tFVFNfTEVBVkUsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIG9wdHM6IHtcbiAgICAgICAgICByb29tczogWy4uLm9wdHMucm9vbXNdLFxuICAgICAgICAgIGV4Y2VwdDogWy4uLm9wdHMuZXhjZXB0XSxcbiAgICAgICAgfSxcbiAgICAgICAgcm9vbXM6IFsuLi5yb29tc10sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgZGlzY29ubmVjdFNvY2tldHMob3B0czogQnJvYWRjYXN0T3B0aW9ucywgY2xvc2U6IGJvb2xlYW4pIHtcbiAgICBzdXBlci5kaXNjb25uZWN0U29ja2V0cyhvcHRzLCBjbG9zZSk7XG5cbiAgICBpZiAob3B0cy5mbGFncz8ubG9jYWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnB1Ymxpc2hSZXF1ZXN0KHtcbiAgICAgIHVpZDogdGhpcy51aWQsXG4gICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5ESVNDT05ORUNUX1NPQ0tFVFMsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIG9wdHM6IHtcbiAgICAgICAgICByb29tczogWy4uLm9wdHMucm9vbXNdLFxuICAgICAgICAgIGV4Y2VwdDogWy4uLm9wdHMuZXhjZXB0XSxcbiAgICAgICAgfSxcbiAgICAgICAgY2xvc2UsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZmV0Y2hTb2NrZXRzKG9wdHM6IEJyb2FkY2FzdE9wdGlvbnMpOiBQcm9taXNlPFNvY2tldFtdPiB7XG4gICAgY29uc3QgbG9jYWxTb2NrZXRzID0gYXdhaXQgc3VwZXIuZmV0Y2hTb2NrZXRzKG9wdHMpO1xuXG4gICAgaWYgKG9wdHMuZmxhZ3M/LmxvY2FsKSB7XG4gICAgICByZXR1cm4gbG9jYWxTb2NrZXRzO1xuICAgIH1cblxuICAgIGNvbnN0IGV4cGVjdGVkUmVzcG9uc2VDb3VudCA9IGF3YWl0IHRoaXMuc2VydmVyQ291bnQoKSAtIDE7XG5cbiAgICBpZiAoZXhwZWN0ZWRSZXNwb25zZUNvdW50ID09PSAwKSB7XG4gICAgICByZXR1cm4gbG9jYWxTb2NrZXRzO1xuICAgIH1cblxuICAgIGNvbnN0IHJlcXVlc3RJZCA9IGdlbmVyYXRlSWQoKTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB0aW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0b3JlZFJlcXVlc3QgPSB0aGlzLiNwZW5kaW5nUmVxdWVzdHMuZ2V0KHJlcXVlc3RJZCk7XG4gICAgICAgIGlmIChzdG9yZWRSZXF1ZXN0KSB7XG4gICAgICAgICAgcmVqZWN0KFxuICAgICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICBgdGltZW91dCByZWFjaGVkOiBvbmx5ICR7c3RvcmVkUmVxdWVzdC5jdXJyZW50Q291bnR9IHJlc3BvbnNlcyByZWNlaXZlZCBvdXQgb2YgJHtzdG9yZWRSZXF1ZXN0LmV4cGVjdGVkQ291bnR9YCxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0aGlzLiNwZW5kaW5nUmVxdWVzdHMuZGVsZXRlKHJlcXVlc3RJZCk7XG4gICAgICAgIH1cbiAgICAgIH0sIG9wdHMuZmxhZ3M/LnRpbWVvdXQgfHwgREVGQVVMVF9USU1FT1VUX01TKTtcblxuICAgICAgY29uc3Qgc3RvcmVkUmVxdWVzdCA9IHtcbiAgICAgICAgdHlwZTogUmVxdWVzdFR5cGUuRkVUQ0hfU09DS0VUUyxcbiAgICAgICAgcmVzb2x2ZTogKCkgPT4ge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKHN0b3JlZFJlcXVlc3QucmVzcG9uc2VzKTtcbiAgICAgICAgfSxcbiAgICAgICAgdGltZXJJZCxcbiAgICAgICAgY3VycmVudENvdW50OiAwLFxuICAgICAgICBleHBlY3RlZENvdW50OiBleHBlY3RlZFJlc3BvbnNlQ291bnQsXG4gICAgICAgIHJlc3BvbnNlczogbG9jYWxTb2NrZXRzLFxuICAgICAgfTtcbiAgICAgIHRoaXMuI3BlbmRpbmdSZXF1ZXN0cy5zZXQocmVxdWVzdElkLCBzdG9yZWRSZXF1ZXN0KTtcblxuICAgICAgdGhpcy5wdWJsaXNoUmVxdWVzdCh7XG4gICAgICAgIHVpZDogdGhpcy51aWQsXG4gICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLkZFVENIX1NPQ0tFVFMsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBvcHRzOiB7XG4gICAgICAgICAgICByb29tczogWy4uLm9wdHMucm9vbXNdLFxuICAgICAgICAgICAgZXhjZXB0OiBbLi4ub3B0cy5leGNlcHRdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBvdmVycmlkZSBzZXJ2ZXJTaWRlRW1pdChwYWNrZXQ6IHVua25vd25bXSkge1xuICAgIGNvbnN0IHdpdGhBY2sgPSB0eXBlb2YgcGFja2V0W3BhY2tldC5sZW5ndGggLSAxXSA9PT0gXCJmdW5jdGlvblwiO1xuXG4gICAgaWYgKHdpdGhBY2spIHtcbiAgICAgIHRoaXMuI3NlcnZlclNpZGVFbWl0V2l0aEFjayhwYWNrZXQpLmNhdGNoKCgpID0+IHtcbiAgICAgICAgLy8gaWdub3JlIGVycm9yc1xuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wdWJsaXNoUmVxdWVzdCh7XG4gICAgICB1aWQ6IHRoaXMudWlkLFxuICAgICAgdHlwZTogUmVxdWVzdFR5cGUuU0VSVkVSX1NJREVfRU1JVCxcbiAgICAgIGRhdGE6IHtcbiAgICAgICAgcGFja2V0LFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jICNzZXJ2ZXJTaWRlRW1pdFdpdGhBY2socGFja2V0OiB1bmtub3duW10pIHtcbiAgICBjb25zdCBhY2sgPSBwYWNrZXQucG9wKCkgYXMgKFxuICAgICAgZXJyOiBFcnJvciB8IG51bGwsXG4gICAgICByZXNwb25zZTogdW5rbm93bltdLFxuICAgICkgPT4gdm9pZDtcbiAgICBjb25zdCBleHBlY3RlZFJlc3BvbnNlQ291bnQgPSBhd2FpdCB0aGlzLnNlcnZlckNvdW50KCkgLSAxO1xuXG4gICAgaWYgKGV4cGVjdGVkUmVzcG9uc2VDb3VudCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGFjayhudWxsLCBbXSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVxdWVzdElkID0gZ2VuZXJhdGVJZCgpO1xuXG4gICAgY29uc3QgdGltZXJJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgY29uc3Qgc3RvcmVkUmVxdWVzdCA9IHRoaXMuI3BlbmRpbmdSZXF1ZXN0cy5nZXQocmVxdWVzdElkKTtcbiAgICAgIGlmIChzdG9yZWRSZXF1ZXN0KSB7XG4gICAgICAgIGFjayhcbiAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgdGltZW91dCByZWFjaGVkOiBvbmx5ICR7c3RvcmVkUmVxdWVzdC5jdXJyZW50Q291bnR9IHJlc3BvbnNlcyByZWNlaXZlZCBvdXQgb2YgJHtzdG9yZWRSZXF1ZXN0LmV4cGVjdGVkQ291bnR9YCxcbiAgICAgICAgICApLFxuICAgICAgICAgIHN0b3JlZFJlcXVlc3QucmVzcG9uc2VzLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLiNwZW5kaW5nUmVxdWVzdHMuZGVsZXRlKHJlcXVlc3RJZCk7XG4gICAgICB9XG4gICAgfSwgREVGQVVMVF9USU1FT1VUX01TKTtcblxuICAgIGNvbnN0IHN0b3JlZFJlcXVlc3QgPSB7XG4gICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5TRVJWRVJfU0lERV9FTUlULFxuICAgICAgcmVzb2x2ZTogKCkgPT4ge1xuICAgICAgICBhY2sobnVsbCwgc3RvcmVkUmVxdWVzdC5yZXNwb25zZXMpO1xuICAgICAgfSxcbiAgICAgIHRpbWVySWQsXG4gICAgICBjdXJyZW50Q291bnQ6IDAsXG4gICAgICBleHBlY3RlZENvdW50OiBleHBlY3RlZFJlc3BvbnNlQ291bnQsXG4gICAgICByZXNwb25zZXM6IFtdLFxuICAgIH07XG5cbiAgICB0aGlzLiNwZW5kaW5nUmVxdWVzdHMuc2V0KHJlcXVlc3RJZCwgc3RvcmVkUmVxdWVzdCk7XG5cbiAgICB0aGlzLnB1Ymxpc2hSZXF1ZXN0KHtcbiAgICAgIHVpZDogdGhpcy51aWQsXG4gICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5TRVJWRVJfU0lERV9FTUlULFxuICAgICAgZGF0YToge1xuICAgICAgICByZXF1ZXN0SWQsIC8vIHRoZSBwcmVzZW5jZSBvZiB0aGlzIGF0dHJpYnV0ZSBkZWZpbmVzIHdoZXRoZXIgYW4gYWNrbm93bGVkZ2VtZW50IGlzIG5lZWRlZFxuICAgICAgICBwYWNrZXQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgb3ZlcnJpZGUgYnJvYWRjYXN0KHBhY2tldDogUGFja2V0LCBvcHRzOiBCcm9hZGNhc3RPcHRpb25zKSB7XG4gICAgY29uc3Qgb25seUxvY2FsID0gb3B0cy5mbGFncz8ubG9jYWw7XG5cbiAgICBpZiAoIW9ubHlMb2NhbCkge1xuICAgICAgdGhpcy5wdWJsaXNoUmVxdWVzdCh7XG4gICAgICAgIHVpZDogdGhpcy51aWQsXG4gICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLkJST0FEQ0FTVCxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHBhY2tldCxcbiAgICAgICAgICBvcHRzOiB7XG4gICAgICAgICAgICByb29tczogWy4uLm9wdHMucm9vbXNdLFxuICAgICAgICAgICAgZXhjZXB0OiBbLi4ub3B0cy5leGNlcHRdLFxuICAgICAgICAgICAgZmxhZ3M6IG9wdHMuZmxhZ3MsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc3VwZXIuYnJvYWRjYXN0KHBhY2tldCwgb3B0cyk7XG4gICAgfSwgMCk7XG4gIH1cblxuICBvdmVycmlkZSBicm9hZGNhc3RXaXRoQWNrKFxuICAgIHBhY2tldDogUGFja2V0LFxuICAgIG9wdHM6IEJyb2FkY2FzdE9wdGlvbnMsXG4gICAgY2xpZW50Q291bnRDYWxsYmFjazogKGNsaWVudENvdW50OiBudW1iZXIpID0+IHZvaWQsXG4gICAgYWNrOiAoLi4uYXJnczogdW5rbm93bltdKSA9PiB2b2lkLFxuICApIHtcbiAgICBjb25zdCBvbmx5TG9jYWwgPSBvcHRzLmZsYWdzPy5sb2NhbDtcblxuICAgIGlmICghb25seUxvY2FsKSB7XG4gICAgICBjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZUlkKCk7XG5cbiAgICAgIHRoaXMucHVibGlzaFJlcXVlc3Qoe1xuICAgICAgICB1aWQ6IHRoaXMudWlkLFxuICAgICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5CUk9BRENBU1QsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBwYWNrZXQsXG4gICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgIG9wdHM6IHtcbiAgICAgICAgICAgIHJvb21zOiBbLi4ub3B0cy5yb29tc10sXG4gICAgICAgICAgICBleGNlcHQ6IFsuLi5vcHRzLmV4Y2VwdF0sXG4gICAgICAgICAgICBmbGFnczogb3B0cy5mbGFncyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuI2Fja1JlcXVlc3RzLnNldChyZXF1ZXN0SWQsIHtcbiAgICAgICAgY2xpZW50Q291bnRDYWxsYmFjayxcbiAgICAgICAgYWNrLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIHdlIGhhdmUgbm8gd2F5IHRvIGtub3cgYXQgdGhpcyBsZXZlbCB3aGV0aGVyIHRoZSBzZXJ2ZXIgaGFzIHJlY2VpdmVkIGFuIGFja25vd2xlZGdlbWVudCBmcm9tIGVhY2ggY2xpZW50LCBzbyB3ZVxuICAgICAgLy8gd2lsbCBzaW1wbHkgY2xlYW4gdXAgdGhlIGFja1JlcXVlc3RzIG1hcCBhZnRlciB0aGUgZ2l2ZW4gZGVsYXlcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLiNhY2tSZXF1ZXN0cy5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgIH0sIG9wdHMuZmxhZ3MhLnRpbWVvdXQpO1xuICAgIH1cblxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgc3VwZXIuYnJvYWRjYXN0V2l0aEFjayhwYWNrZXQsIG9wdHMsIGNsaWVudENvdW50Q2FsbGJhY2ssIGFjayk7XG4gICAgfSwgMCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgb25SZXF1ZXN0KHJlcXVlc3Q6IENsdXN0ZXJSZXF1ZXN0KSB7XG4gICAgaWYgKHJlcXVlc3QudWlkID09PSB0aGlzLnVpZCkge1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKGBbYWRhcHRlcl0gWyR7dGhpcy51aWR9XSBpZ25vcmUgc2VsZmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbYWRhcHRlcl0gWyR7dGhpcy51aWR9XSByZWNlaXZlZCByZXF1ZXN0ICR7cmVxdWVzdC50eXBlfSBmcm9tICR7cmVxdWVzdC51aWR9YCxcbiAgICApO1xuXG4gICAgc3dpdGNoIChyZXF1ZXN0LnR5cGUpIHtcbiAgICAgIGNhc2UgUmVxdWVzdFR5cGUuQlJPQURDQVNUOiB7XG4gICAgICAgIGNvbnN0IHdpdGhBY2sgPSByZXF1ZXN0LmRhdGEucmVxdWVzdElkICE9PSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHBhY2tldCA9IHJlcXVlc3QuZGF0YS5wYWNrZXQgYXMgUGFja2V0O1xuICAgICAgICBjb25zdCBvcHRzID0gcmVxdWVzdC5kYXRhLm9wdHMgYXMgeyByb29tczogc3RyaW5nW107IGV4Y2VwdDogc3RyaW5nW10gfTtcblxuICAgICAgICBpZiAod2l0aEFjaykge1xuICAgICAgICAgIHJldHVybiBzdXBlci5icm9hZGNhc3RXaXRoQWNrKFxuICAgICAgICAgICAgcGFja2V0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICByb29tczogbmV3IFNldChvcHRzLnJvb21zKSxcbiAgICAgICAgICAgICAgZXhjZXB0OiBuZXcgU2V0KG9wdHMuZXhjZXB0KSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAoY2xpZW50Q291bnQpID0+IHtcbiAgICAgICAgICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICAgICAgICAgIGBbYWRhcHRlcl0gd2FpdGluZyBmb3IgJHtjbGllbnRDb3VudH0gY2xpZW50IGFja25vd2xlZGdlbWVudHNgLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB0aGlzLnB1Ymxpc2hSZXNwb25zZShyZXF1ZXN0LnVpZCwge1xuICAgICAgICAgICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLkJST0FEQ0FTVF9DTElFTlRfQ09VTlQsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgcmVxdWVzdElkOiByZXF1ZXN0LmRhdGEucmVxdWVzdElkIGFzIHN0cmluZyxcbiAgICAgICAgICAgICAgICAgIGNsaWVudENvdW50LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIChhcmcpID0+IHtcbiAgICAgICAgICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICAgICAgICAgIGBbYWRhcHRlcl0gcmVjZWl2ZWQgb25lIGFja25vd2xlZGdlbWVudGAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIHRoaXMucHVibGlzaFJlc3BvbnNlKHJlcXVlc3QudWlkLCB7XG4gICAgICAgICAgICAgICAgdHlwZTogUmVxdWVzdFR5cGUuQlJPQURDQVNUX0FDSyxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICByZXF1ZXN0SWQ6IHJlcXVlc3QuZGF0YS5yZXF1ZXN0SWQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgcGFja2V0OiBhcmcsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN1cGVyLmJyb2FkY2FzdChwYWNrZXQsIHtcbiAgICAgICAgICAgIHJvb21zOiBuZXcgU2V0KG9wdHMucm9vbXMpLFxuICAgICAgICAgICAgZXhjZXB0OiBuZXcgU2V0KG9wdHMuZXhjZXB0KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLlNPQ0tFVFNfSk9JTjoge1xuICAgICAgICBjb25zdCBvcHRzID0gcmVxdWVzdC5kYXRhLm9wdHMgYXMgeyByb29tczogc3RyaW5nW107IGV4Y2VwdDogc3RyaW5nW10gfTtcbiAgICAgICAgY29uc3Qgcm9vbXMgPSByZXF1ZXN0LmRhdGEucm9vbXMgYXMgc3RyaW5nW107XG5cbiAgICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICAgIGBbYWRhcHRlcl0gY2FsbGluZyBzb2NrZXRzSm9pbiAke3Jvb21zfSBpbiAke29wdHMucm9vbXN9IGV4Y2VwdCAke29wdHMuZXhjZXB0fWAsXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHN1cGVyLmFkZFNvY2tldHMoe1xuICAgICAgICAgIHJvb21zOiBuZXcgU2V0KG9wdHMucm9vbXMpLFxuICAgICAgICAgIGV4Y2VwdDogbmV3IFNldChvcHRzLmV4Y2VwdCksXG4gICAgICAgIH0sIHJvb21zKTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5TT0NLRVRTX0xFQVZFOiB7XG4gICAgICAgIGNvbnN0IG9wdHMgPSByZXF1ZXN0LmRhdGEub3B0cyBhcyB7IHJvb21zOiBzdHJpbmdbXTsgZXhjZXB0OiBzdHJpbmdbXSB9O1xuICAgICAgICBjb25zdCByb29tcyA9IHJlcXVlc3QuZGF0YS5yb29tcyBhcyBzdHJpbmdbXTtcblxuICAgICAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXG4gICAgICAgICAgYFthZGFwdGVyXSBjYWxsaW5nIHNvY2tldHNMZWF2ZSAke3Jvb21zfSBpbiAke29wdHMucm9vbXN9IGV4Y2VwdCAke29wdHMuZXhjZXB0fWAsXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHN1cGVyLmRlbFNvY2tldHMoe1xuICAgICAgICAgIHJvb21zOiBuZXcgU2V0KG9wdHMucm9vbXMpLFxuICAgICAgICAgIGV4Y2VwdDogbmV3IFNldChvcHRzLmV4Y2VwdCksXG4gICAgICAgIH0sIHJvb21zKTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5ESVNDT05ORUNUX1NPQ0tFVFM6IHtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHJlcXVlc3QuZGF0YS5vcHRzIGFzIHsgcm9vbXM6IHN0cmluZ1tdOyBleGNlcHQ6IHN0cmluZ1tdIH07XG4gICAgICAgIGNvbnN0IGNsb3NlID0gcmVxdWVzdC5kYXRhLmNsb3NlIGFzIGJvb2xlYW47XG5cbiAgICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICAgIGBbYWRhcHRlcl0gY2FsbGluZyBkaXNjb25uZWN0U29ja2V0cyAoY2xvc2U/ICR7Y2xvc2V9KSBpbiAke29wdHMucm9vbXN9IGV4Y2VwdCAke29wdHMuZXhjZXB0fWAsXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHN1cGVyLmRpc2Nvbm5lY3RTb2NrZXRzKHtcbiAgICAgICAgICByb29tczogbmV3IFNldChvcHRzLnJvb21zKSxcbiAgICAgICAgICBleGNlcHQ6IG5ldyBTZXQob3B0cy5leGNlcHQpLFxuICAgICAgICB9LCBjbG9zZSk7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgUmVxdWVzdFR5cGUuRkVUQ0hfU09DS0VUUzoge1xuICAgICAgICBjb25zdCBvcHRzID0gcmVxdWVzdC5kYXRhLm9wdHMgYXMgeyByb29tczogc3RyaW5nW107IGV4Y2VwdDogc3RyaW5nW10gfTtcblxuICAgICAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXG4gICAgICAgICAgYFthZGFwdGVyXSBjYWxsaW5nIGZldGNoU29ja2V0cyBpbiBbJHtcbiAgICAgICAgICAgIG9wdHMucm9vbXMuam9pbihcIixcIilcbiAgICAgICAgICB9XSBleGNlcHQgWyR7b3B0cy5leGNlcHQuam9pbihcIixcIil9XWAsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgbG9jYWxTb2NrZXRzID0gYXdhaXQgc3VwZXIuZmV0Y2hTb2NrZXRzKHtcbiAgICAgICAgICByb29tczogbmV3IFNldChvcHRzLnJvb21zKSxcbiAgICAgICAgICBleGNlcHQ6IG5ldyBTZXQob3B0cy5leGNlcHQpLFxuICAgICAgICB9KTtcblxuICAgICAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXG4gICAgICAgICAgYFthZGFwdGVyXSByZXNwb25kaW5nIHRvIHRoZSBmZXRjaFNvY2tldHMgcmVxdWVzdCB3aXRoICR7bG9jYWxTb2NrZXRzLmxlbmd0aH0gc29ja2V0KHMpYCxcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLnB1Ymxpc2hSZXNwb25zZShyZXF1ZXN0LnVpZCwge1xuICAgICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLkZFVENIX1NPQ0tFVFNfUkVTUE9OU0UsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcmVxdWVzdElkOiByZXF1ZXN0LmRhdGEucmVxdWVzdElkIGFzIHN0cmluZyxcbiAgICAgICAgICAgIHNvY2tldHM6IGxvY2FsU29ja2V0cy5tYXAoc2VyaWFsaXplU29ja2V0KSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgUmVxdWVzdFR5cGUuU0VSVkVSX1NJREVfRU1JVDoge1xuICAgICAgICBjb25zdCBwYWNrZXQgPSByZXF1ZXN0LmRhdGEucGFja2V0IGFzIFtzdHJpbmcsIC4uLnVua25vd25bXV07XG4gICAgICAgIGNvbnN0IHdpdGhBY2sgPSByZXF1ZXN0LmRhdGEucmVxdWVzdElkICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKCF3aXRoQWNrKSB7XG4gICAgICAgICAgdGhpcy5uc3AuX29uU2VydmVyU2lkZUVtaXQocGFja2V0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY2FsbGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrID0gKGFyZzogdW5rbm93bikgPT4ge1xuICAgICAgICAgIC8vIG9ubHkgb25lIGFyZ3VtZW50IGlzIGV4cGVjdGVkXG4gICAgICAgICAgaWYgKGNhbGxlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjYWxsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgdGhpcy5wdWJsaXNoUmVzcG9uc2UocmVxdWVzdC51aWQsIHtcbiAgICAgICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLlNFUlZFUl9TSURFX0VNSVRfUkVTUE9OU0UsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIHJlcXVlc3RJZDogcmVxdWVzdC5kYXRhLnJlcXVlc3RJZCBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgIHBhY2tldDogYXJnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBwYWNrZXQucHVzaChjYWxsYmFjayk7XG4gICAgICAgIHRoaXMubnNwLl9vblNlcnZlclNpZGVFbWl0KHBhY2tldCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXG4gICAgICAgICAgYFthZGFwdGVyXSB1bmtub3duIHJlcXVlc3QgdHlwZTogJHtyZXF1ZXN0LnR5cGV9YCxcbiAgICAgICAgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIG9uUmVzcG9uc2UocmVzcG9uc2U6IENsdXN0ZXJSZXNwb25zZSkge1xuICAgIGNvbnN0IHJlcXVlc3RJZCA9IHJlc3BvbnNlLmRhdGEucmVxdWVzdElkIGFzIHN0cmluZztcblxuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbYWRhcHRlcl0gWyR7dGhpcy51aWR9XSByZWNlaXZlZCByZXNwb25zZSAke3Jlc3BvbnNlLnR5cGV9IHRvIHJlcXVlc3QgJHtyZXF1ZXN0SWR9YCxcbiAgICApO1xuXG4gICAgc3dpdGNoIChyZXNwb25zZS50eXBlKSB7XG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLkZFVENIX1NPQ0tFVFNfUkVTUE9OU0U6XG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLlNFUlZFUl9TSURFX0VNSVRfUkVTUE9OU0U6IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMuI3BlbmRpbmdSZXF1ZXN0cy5nZXQocmVxdWVzdElkKTtcblxuICAgICAgICBpZiAoIXJlcXVlc3QpIHtcbiAgICAgICAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXG4gICAgICAgICAgICBgW2FkYXB0ZXJdIHVua25vd24gcmVxdWVzdCBpZDogJHtyZXF1ZXN0SWR9YCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXNwb25zZS50eXBlID09PSBSZXF1ZXN0VHlwZS5GRVRDSF9TT0NLRVRTX1JFU1BPTlNFKSB7XG4gICAgICAgICAgcmVxdWVzdC5yZXNwb25zZXMucHVzaCguLi5yZXNwb25zZS5kYXRhLnNvY2tldHMgYXMgU29ja2V0W10pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlcXVlc3QucmVzcG9uc2VzLnB1c2gocmVzcG9uc2UuZGF0YS5wYWNrZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCsrcmVxdWVzdC5jdXJyZW50Q291bnQgPT09IHJlcXVlc3QuZXhwZWN0ZWRDb3VudCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dChyZXF1ZXN0LnRpbWVySWQpO1xuICAgICAgICAgIHJlcXVlc3QucmVzb2x2ZSgpO1xuICAgICAgICAgIHRoaXMuI3BlbmRpbmdSZXF1ZXN0cy5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLkJST0FEQ0FTVF9DTElFTlRfQ09VTlQ6XG4gICAgICAgIHJldHVybiB0aGlzLiNhY2tSZXF1ZXN0cy5nZXQocmVxdWVzdElkKT8uY2xpZW50Q291bnRDYWxsYmFjayhcbiAgICAgICAgICByZXNwb25zZS5kYXRhLmNsaWVudENvdW50IGFzIG51bWJlcixcbiAgICAgICAgKTtcblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5CUk9BRENBU1RfQUNLOlxuICAgICAgICByZXR1cm4gdGhpcy4jYWNrUmVxdWVzdHMuZ2V0KHJlcXVlc3RJZCk/LmFjayhyZXNwb25zZS5kYXRhLnBhY2tldCk7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgICBgW2FkYXB0ZXJdIHVua25vd24gcmVzcG9uc2UgdHlwZTogJHtyZXNwb25zZS50eXBlfWAsXG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsWUFBWSxRQUFRLDZCQUE2QjtBQUkxRCxTQUFTLFVBQVUsUUFBUSx5QkFBeUI7QUFDcEQsU0FBUyxTQUFTLFFBQVEsbUJBQW1CO0FBRTdDLE1BQU0scUJBQXFCO0FBMEIzQixPQUFPLE1BQU0sd0JBQXdCO0VBS2hCLElBQWU7RUFFeEIsUUFBa0MsSUFBSSxNQUFNO0VBQzlDLE9BQWlDLElBQUksTUFBTTtFQUVuRCxZQUFZLEdBQWMsQ0FBRTtJQUMxQixLQUFLO0lBQ0wsSUFBSSxDQUFDLEdBQUcsR0FBRztFQUNiO0VBRUE7O0dBRUMsR0FDRCxBQUFPLGNBQStCO0lBQ3BDLE9BQU8sUUFBUSxPQUFPLENBQUM7RUFDekI7RUFFQTs7Ozs7R0FLQyxHQUNELEFBQU8sT0FBTyxFQUFZLEVBQUUsS0FBZ0IsRUFBd0I7SUFDbEUsSUFBSSxjQUFj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
// denoCacheMetadata=12819346150675328682,5306199164203400602