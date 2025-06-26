import { getLogger } from "../../test_deps.ts";
import { Adapter } from "../socket.io/mod.ts";
import { decode, encode } from "../msgpack/mod.ts";
import { RequestType } from "../socket.io/lib/adapter.ts";
export function createAdapter(pubClient, subClient, opts) {
  const options = Object.assign({
    key: "socket.io"
  }, opts);
  return function(nsp) {
    return new RedisAdapter(nsp, pubClient, subClient, options);
  };
}
const TEXT_DECODER = new TextDecoder();
class RedisAdapter extends Adapter {
  pubClient;
  subClient;
  opts;
  broadcastChannel;
  requestChannel;
  responseChannel;
  constructor(nsp, pubClient, subClient, opts){
    super(nsp);
    this.pubClient = pubClient;
    this.subClient = subClient;
    this.opts = opts;
    this.broadcastChannel = `${opts.key}#${nsp.name}#`;
    this.requestChannel = `${opts.key}-request#${nsp.name}#`;
    this.responseChannel = `${opts.key}-response#${nsp.name}#${this.uid}#`;
    getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] subscribing to ${this.broadcastChannel + "*"}, ${this.requestChannel} and ${this.responseChannel}`);
    this.subClient.psubscribe(this.broadcastChannel + "*").then(async (sub)=>{
      await sub.subscribe(this.requestChannel, this.responseChannel);
      for await (const { channel, message } of sub.receiveBinary()){
        if (channel === this.requestChannel) {
          await this.#onRawRequest(message);
        } else if (channel === this.responseChannel) {
          this.#onRawResponse(message);
        } else if (channel.startsWith(this.broadcastChannel)) {
          this.#onBroadcastMessage(channel, message);
        } else {
          getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] ignoring message for channel: ${channel}`);
          return;
        }
      }
    }).catch((err)=>{
      this.emitReserved("error", err);
    });
  }
  publishRequest(request) {
    const [channel, payload] = this.#encodeRequest(request);
    getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] sending request type ${request.type} to channel ${channel}`);
    this.pubClient.publish(channel, payload).catch((err)=>{
      this.emitReserved("error", err);
    });
  }
  /**
   * Encode the request payload to match the format of the Node.js implementation
   *
   * @param request
   * @private
   */ #encodeRequest(request) {
    switch(request.type){
      case RequestType.BROADCAST:
        {
          const withAck = request.data.requestId !== undefined;
          if (withAck) {
            const payload = new Uint8Array(encode({
              uid: request.uid,
              type: 7,
              requestId: request.data.requestId,
              packet: request.data.packet,
              opts: request.data.opts
            }));
            return [
              this.requestChannel,
              payload
            ];
          } else {
            const opts = request.data.opts;
            let channel = this.broadcastChannel;
            if (opts.rooms && opts.rooms.length === 1) {
              channel += opts.rooms[0] + "#";
            }
            const payload = new Uint8Array(encode([
              request.uid,
              request.data.packet,
              opts
            ]));
            return [
              channel,
              payload
            ];
          }
        }
      case RequestType.SOCKETS_JOIN:
        {
          const payload = JSON.stringify({
            uid: request.uid,
            type: 2,
            opts: request.data.opts,
            rooms: request.data.rooms
          });
          return [
            this.requestChannel,
            payload
          ];
        }
      case RequestType.SOCKETS_LEAVE:
        {
          const payload = JSON.stringify({
            uid: request.uid,
            type: 3,
            opts: request.data.opts,
            rooms: request.data.rooms
          });
          return [
            this.requestChannel,
            payload
          ];
        }
      case RequestType.DISCONNECT_SOCKETS:
        {
          const payload = JSON.stringify({
            uid: request.uid,
            type: 4,
            opts: request.data.opts,
            close: request.data.close
          });
          return [
            this.requestChannel,
            payload
          ];
        }
      case RequestType.FETCH_SOCKETS:
        {
          const payload = JSON.stringify({
            uid: request.uid,
            requestId: request.data.requestId,
            type: 5,
            opts: request.data.opts
          });
          return [
            this.requestChannel,
            payload
          ];
        }
      case RequestType.SERVER_SIDE_EMIT:
        {
          const payload = JSON.stringify({
            uid: request.uid,
            type: 6,
            data: request.data.packet,
            requestId: request.data.requestId
          });
          return [
            this.requestChannel,
            payload
          ];
        }
      default:
        throw "should not happen";
    }
  }
  publishResponse(requesterUid, response) {
    // matches the behavior of the Node.js implementation with publishOnSpecificResponseChannel: true
    const channel = `${this.opts.key}-response#${this.nsp.name}#${requesterUid}#`;
    const payload = RedisAdapter.#encodeResponse(response);
    getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] sending response type ${response.type} to channel ${channel}`);
    this.pubClient.publish(channel, payload).catch((err)=>{
      this.emitReserved("error", err);
    });
  }
  /**
   * Encode the response payload to match the format of the Node.js implementation
   *
   * @param response
   * @private
   */ static #encodeResponse(response) {
    switch(response.type){
      case RequestType.FETCH_SOCKETS_RESPONSE:
        {
          return JSON.stringify({
            requestId: response.data.requestId,
            sockets: response.data.sockets
          });
        }
      case RequestType.SERVER_SIDE_EMIT_RESPONSE:
        {
          return JSON.stringify({
            type: 6,
            requestId: response.data.requestId,
            data: response.data.packet
          });
        }
      case RequestType.BROADCAST_CLIENT_COUNT:
        {
          return JSON.stringify({
            type: 8,
            requestId: response.data.requestId,
            clientCount: response.data.clientCount
          });
        }
      case RequestType.BROADCAST_ACK:
        {
          return new Uint8Array(encode({
            type: 9,
            requestId: response.data.requestId,
            packet: response.data.packet
          }));
        }
      default:
        throw "should not happen";
    }
  }
  /**
   * Called with a subscription message
   *
   * @private
   */ #onBroadcastMessage(channel, msg) {
    const room = channel.slice(this.broadcastChannel.length, -1);
    if (room !== "" && !this.#hasRoom(room)) {
      return getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] ignore unknown room ${room}`);
    }
    const [uid, packet, opts] = decode(msg);
    return this.onRequest({
      uid,
      type: RequestType.BROADCAST,
      data: {
        packet,
        opts
      }
    });
  }
  /**
   * Checks whether the room exists (as it is encoded to a string in the broadcast method)
   *
   * @param room
   * @private
   */ #hasRoom(room) {
    const numericRoom = parseFloat(room);
    const hasNumericRoom = !isNaN(numericRoom) && this.rooms.has(numericRoom);
    return hasNumericRoom || this.rooms.has(room);
  }
  /**
   * Called on request from another node
   *
   * @private
   */ #onRawRequest(msg) {
    let rawRequest;
    try {
      // if the buffer starts with a "{" character
      if (msg[0] === 0x7b) {
        rawRequest = JSON.parse(TEXT_DECODER.decode(msg));
      } else {
        rawRequest = decode(msg);
      }
    } catch (_) {
      getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] ignoring malformed request`);
      return;
    }
    const request = RedisAdapter.#decodeRequest(rawRequest);
    if (request) {
      return this.onRequest(request);
    }
  }
  /**
   * Decode request payload
   *
   * @param rawRequest
   * @private
   */ static #decodeRequest(rawRequest) {
    switch(rawRequest.type){
      case 2:
        return {
          uid: rawRequest.uid,
          type: RequestType.SOCKETS_JOIN,
          data: {
            opts: rawRequest.opts,
            rooms: rawRequest.rooms
          }
        };
      case 3:
        return {
          uid: rawRequest.uid,
          type: RequestType.SOCKETS_LEAVE,
          data: {
            opts: rawRequest.opts,
            rooms: rawRequest.rooms
          }
        };
      case 4:
        return {
          uid: rawRequest.uid,
          type: RequestType.DISCONNECT_SOCKETS,
          data: {
            opts: rawRequest.opts,
            close: rawRequest.close
          }
        };
      case 5:
        return {
          uid: rawRequest.uid,
          type: RequestType.FETCH_SOCKETS,
          data: {
            requestId: rawRequest.requestId,
            opts: rawRequest.opts
          }
        };
      case 6:
        return {
          uid: rawRequest.uid,
          type: RequestType.SERVER_SIDE_EMIT,
          data: {
            requestId: rawRequest.requestId,
            packet: rawRequest.data
          }
        };
      case 7:
        return {
          uid: rawRequest.uid,
          type: RequestType.BROADCAST,
          data: {
            opts: rawRequest.opts,
            requestId: rawRequest.requestId,
            packet: rawRequest.packet
          }
        };
      default:
        return null;
    }
  }
  /**
   * Called on request from another node
   *
   * @private
   */ #onRawResponse(msg) {
    let rawResponse;
    try {
      // if the buffer starts with a "{" character
      if (msg[0] === 0x7b) {
        rawResponse = JSON.parse(TEXT_DECODER.decode(msg));
      } else {
        rawResponse = decode(msg);
      }
    } catch (_) {
      getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] ignoring malformed response`);
      return;
    }
    const response = RedisAdapter.#decodeResponse(rawResponse);
    if (response) {
      this.onResponse(response);
    }
  }
  static #decodeResponse(rawResponse) {
    // the Node.js implementation of fetchSockets() does not include the type of the request
    // reference: https://github.com/socketio/socket.io-redis-adapter/blob/b4215cdbc00af96eac37a0b9cc0fbcb793384b53/lib/index.ts#L349-L361
    const responseType = rawResponse.type || RequestType.FETCH_SOCKETS;
    switch(responseType){
      case RequestType.FETCH_SOCKETS:
        return {
          type: RequestType.FETCH_SOCKETS_RESPONSE,
          data: {
            requestId: rawResponse.requestId,
            sockets: rawResponse.sockets
          }
        };
      case RequestType.SERVER_SIDE_EMIT:
        return {
          type: RequestType.SERVER_SIDE_EMIT_RESPONSE,
          data: {
            requestId: rawResponse.requestId,
            packet: rawResponse.data
          }
        };
      case 8:
        return {
          type: RequestType.BROADCAST_CLIENT_COUNT,
          data: {
            requestId: rawResponse.requestId,
            clientCount: rawResponse.clientCount
          }
        };
      case 9:
        return {
          type: RequestType.BROADCAST_ACK,
          data: {
            requestId: rawResponse.requestId,
            packet: rawResponse.packet
          }
        };
      default:
        return null;
    }
  }
  async serverCount() {
    // TODO NUMSUB within a Redis cluster
    const [_, value] = await this.pubClient.pubsubNumsub(this.requestChannel);
    getLogger("socket.io").debug(`[redis-adapter] [${this.uid}] there are ${value} server(s) in the cluster`);
    return value;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL3NvY2tldC5pby1yZWRpcy1hZGFwdGVyL21vZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBnZXRMb2dnZXIgfSBmcm9tIFwiLi4vLi4vdGVzdF9kZXBzLnRzXCI7XG5pbXBvcnQgeyB0eXBlIFJlZGlzIH0gZnJvbSBcIi4uLy4uL3ZlbmRvci9kZW5vLmxhbmQveC9yZWRpc0B2MC4yNy4xL21vZC50c1wiO1xuaW1wb3J0IHtcbiAgQWRhcHRlcixcbiAgdHlwZSBCcm9hZGNhc3RPcHRpb25zLFxuICB0eXBlIE5hbWVzcGFjZSxcbn0gZnJvbSBcIi4uL3NvY2tldC5pby9tb2QudHNcIjtcbmltcG9ydCB7IHR5cGUgUGFja2V0IH0gZnJvbSBcIi4uL3NvY2tldC5pby1wYXJzZXIvbW9kLnRzXCI7XG5pbXBvcnQgeyBkZWNvZGUsIGVuY29kZSB9IGZyb20gXCIuLi9tc2dwYWNrL21vZC50c1wiO1xuaW1wb3J0IHtcbiAgQ2x1c3RlclJlcXVlc3QsXG4gIENsdXN0ZXJSZXNwb25zZSxcbiAgUmVxdWVzdFR5cGUsXG59IGZyb20gXCIuLi9zb2NrZXQuaW8vbGliL2FkYXB0ZXIudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBSZWRpc0FkYXB0ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBrZXkgdG8gcHViL3N1YiBldmVudHMgb24gYXMgcHJlZml4XG4gICAqIEBkZWZhdWx0IFwic29ja2V0LmlvXCJcbiAgICovXG4gIGtleTogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWRhcHRlcjxcbiAgTGlzdGVuRXZlbnRzLFxuICBFbWl0RXZlbnRzLFxuICBTZXJ2ZXJTaWRlRXZlbnRzLFxuICBTb2NrZXREYXRhLFxuPihcbiAgcHViQ2xpZW50OiBSZWRpcyxcbiAgc3ViQ2xpZW50OiBSZWRpcyxcbiAgb3B0cz86IFBhcnRpYWw8UmVkaXNBZGFwdGVyT3B0aW9ucz4sXG4pIHtcbiAgY29uc3Qgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGtleTogXCJzb2NrZXQuaW9cIixcbiAgfSwgb3B0cyk7XG4gIHJldHVybiBmdW5jdGlvbiAoXG4gICAgbnNwOiBOYW1lc3BhY2UsXG4gICkge1xuICAgIHJldHVybiBuZXcgUmVkaXNBZGFwdGVyKG5zcCwgcHViQ2xpZW50LCBzdWJDbGllbnQsIG9wdGlvbnMpO1xuICB9O1xufVxuXG5jb25zdCBURVhUX0RFQ09ERVIgPSBuZXcgVGV4dERlY29kZXIoKTtcblxuY2xhc3MgUmVkaXNBZGFwdGVyIGV4dGVuZHMgQWRhcHRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcHViQ2xpZW50OiBSZWRpcztcbiAgcHJpdmF0ZSByZWFkb25seSBzdWJDbGllbnQ6IFJlZGlzO1xuICBwcml2YXRlIHJlYWRvbmx5IG9wdHM6IFJlZGlzQWRhcHRlck9wdGlvbnM7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBicm9hZGNhc3RDaGFubmVsOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdENoYW5uZWw6IHN0cmluZztcbiAgcHJpdmF0ZSByZWFkb25seSByZXNwb25zZUNoYW5uZWw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBuc3A6IE5hbWVzcGFjZSxcbiAgICBwdWJDbGllbnQ6IFJlZGlzLFxuICAgIHN1YkNsaWVudDogUmVkaXMsXG4gICAgb3B0czogUmVkaXNBZGFwdGVyT3B0aW9ucyxcbiAgKSB7XG4gICAgc3VwZXIobnNwKTtcbiAgICB0aGlzLnB1YkNsaWVudCA9IHB1YkNsaWVudDtcbiAgICB0aGlzLnN1YkNsaWVudCA9IHN1YkNsaWVudDtcbiAgICB0aGlzLm9wdHMgPSBvcHRzO1xuXG4gICAgdGhpcy5icm9hZGNhc3RDaGFubmVsID0gYCR7b3B0cy5rZXl9IyR7bnNwLm5hbWV9I2A7XG4gICAgdGhpcy5yZXF1ZXN0Q2hhbm5lbCA9IGAke29wdHMua2V5fS1yZXF1ZXN0IyR7bnNwLm5hbWV9I2A7XG4gICAgdGhpcy5yZXNwb25zZUNoYW5uZWwgPSBgJHtvcHRzLmtleX0tcmVzcG9uc2UjJHtuc3AubmFtZX0jJHt0aGlzLnVpZH0jYDtcblxuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbcmVkaXMtYWRhcHRlcl0gWyR7dGhpcy51aWR9XSBzdWJzY3JpYmluZyB0byAke1xuICAgICAgICB0aGlzLmJyb2FkY2FzdENoYW5uZWwgKyBcIipcIlxuICAgICAgfSwgJHt0aGlzLnJlcXVlc3RDaGFubmVsfSBhbmQgJHt0aGlzLnJlc3BvbnNlQ2hhbm5lbH1gLFxuICAgICk7XG4gICAgdGhpcy5zdWJDbGllbnQucHN1YnNjcmliZTxVaW50OEFycmF5Pih0aGlzLmJyb2FkY2FzdENoYW5uZWwgKyBcIipcIikudGhlbihcbiAgICAgIGFzeW5jIChzdWIpID0+IHtcbiAgICAgICAgYXdhaXQgc3ViLnN1YnNjcmliZSh0aGlzLnJlcXVlc3RDaGFubmVsLCB0aGlzLnJlc3BvbnNlQ2hhbm5lbCk7XG5cbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IGNoYW5uZWwsIG1lc3NhZ2UgfSBvZiBzdWIucmVjZWl2ZUJpbmFyeSgpKSB7XG4gICAgICAgICAgaWYgKGNoYW5uZWwgPT09IHRoaXMucmVxdWVzdENoYW5uZWwpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuI29uUmF3UmVxdWVzdChtZXNzYWdlKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYW5uZWwgPT09IHRoaXMucmVzcG9uc2VDaGFubmVsKSB7XG4gICAgICAgICAgICB0aGlzLiNvblJhd1Jlc3BvbnNlKG1lc3NhZ2UpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhbm5lbC5zdGFydHNXaXRoKHRoaXMuYnJvYWRjYXN0Q2hhbm5lbCkpIHtcbiAgICAgICAgICAgIHRoaXMuI29uQnJvYWRjYXN0TWVzc2FnZShjaGFubmVsLCBtZXNzYWdlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICAgICAgICBgW3JlZGlzLWFkYXB0ZXJdIFske3RoaXMudWlkfV0gaWdub3JpbmcgbWVzc2FnZSBmb3IgY2hhbm5lbDogJHtjaGFubmVsfWAsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApLmNhdGNoKChlcnIpID0+IHtcbiAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiZXJyb3JcIiwgZXJyKTtcbiAgICB9KTtcbiAgfVxuXG4gIG92ZXJyaWRlIHB1Ymxpc2hSZXF1ZXN0KHJlcXVlc3Q6IENsdXN0ZXJSZXF1ZXN0KSB7XG4gICAgY29uc3QgW2NoYW5uZWwsIHBheWxvYWRdID0gdGhpcy4jZW5jb2RlUmVxdWVzdChyZXF1ZXN0KTtcblxuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbcmVkaXMtYWRhcHRlcl0gWyR7dGhpcy51aWR9XSBzZW5kaW5nIHJlcXVlc3QgdHlwZSAke3JlcXVlc3QudHlwZX0gdG8gY2hhbm5lbCAke2NoYW5uZWx9YCxcbiAgICApO1xuXG4gICAgdGhpcy5wdWJDbGllbnQucHVibGlzaChjaGFubmVsLCBwYXlsb2FkKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImVycm9yXCIsIGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRW5jb2RlIHRoZSByZXF1ZXN0IHBheWxvYWQgdG8gbWF0Y2ggdGhlIGZvcm1hdCBvZiB0aGUgTm9kZS5qcyBpbXBsZW1lbnRhdGlvblxuICAgKlxuICAgKiBAcGFyYW0gcmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgI2VuY29kZVJlcXVlc3QocmVxdWVzdDogQ2x1c3RlclJlcXVlc3QpOiBbc3RyaW5nLCBzdHJpbmcgfCBVaW50OEFycmF5XSB7XG4gICAgc3dpdGNoIChyZXF1ZXN0LnR5cGUpIHtcbiAgICAgIGNhc2UgUmVxdWVzdFR5cGUuQlJPQURDQVNUOiB7XG4gICAgICAgIGNvbnN0IHdpdGhBY2sgPSByZXF1ZXN0LmRhdGEucmVxdWVzdElkICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKHdpdGhBY2spIHtcbiAgICAgICAgICBjb25zdCBwYXlsb2FkID0gbmV3IFVpbnQ4QXJyYXkoZW5jb2RlKHtcbiAgICAgICAgICAgIHVpZDogcmVxdWVzdC51aWQsXG4gICAgICAgICAgICB0eXBlOiA3LFxuICAgICAgICAgICAgcmVxdWVzdElkOiByZXF1ZXN0LmRhdGEucmVxdWVzdElkLFxuICAgICAgICAgICAgcGFja2V0OiByZXF1ZXN0LmRhdGEucGFja2V0LFxuICAgICAgICAgICAgb3B0czogcmVxdWVzdC5kYXRhLm9wdHMsXG4gICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgcmV0dXJuIFt0aGlzLnJlcXVlc3RDaGFubmVsLCBwYXlsb2FkXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBvcHRzID0gcmVxdWVzdC5kYXRhLm9wdHMgYXMgeyByb29tczogc3RyaW5nW10gfTtcbiAgICAgICAgICBsZXQgY2hhbm5lbCA9IHRoaXMuYnJvYWRjYXN0Q2hhbm5lbDtcbiAgICAgICAgICBpZiAob3B0cy5yb29tcyAmJiBvcHRzLnJvb21zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgY2hhbm5lbCArPSBvcHRzLnJvb21zWzBdICsgXCIjXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBuZXcgVWludDhBcnJheShcbiAgICAgICAgICAgIGVuY29kZShbcmVxdWVzdC51aWQsIHJlcXVlc3QuZGF0YS5wYWNrZXQsIG9wdHNdKSxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgcmV0dXJuIFtjaGFubmVsLCBwYXlsb2FkXTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLlNPQ0tFVFNfSk9JTjoge1xuICAgICAgICBjb25zdCBwYXlsb2FkID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHVpZDogcmVxdWVzdC51aWQsXG4gICAgICAgICAgdHlwZTogMixcbiAgICAgICAgICBvcHRzOiByZXF1ZXN0LmRhdGEub3B0cyxcbiAgICAgICAgICByb29tczogcmVxdWVzdC5kYXRhLnJvb21zLFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gW3RoaXMucmVxdWVzdENoYW5uZWwsIHBheWxvYWRdO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLlNPQ0tFVFNfTEVBVkU6IHtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB1aWQ6IHJlcXVlc3QudWlkLFxuICAgICAgICAgIHR5cGU6IDMsXG4gICAgICAgICAgb3B0czogcmVxdWVzdC5kYXRhLm9wdHMsXG4gICAgICAgICAgcm9vbXM6IHJlcXVlc3QuZGF0YS5yb29tcyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIFt0aGlzLnJlcXVlc3RDaGFubmVsLCBwYXlsb2FkXTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5ESVNDT05ORUNUX1NPQ0tFVFM6IHtcbiAgICAgICAgY29uc3QgcGF5bG9hZCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB1aWQ6IHJlcXVlc3QudWlkLFxuICAgICAgICAgIHR5cGU6IDQsXG4gICAgICAgICAgb3B0czogcmVxdWVzdC5kYXRhLm9wdHMsXG4gICAgICAgICAgY2xvc2U6IHJlcXVlc3QuZGF0YS5jbG9zZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIFt0aGlzLnJlcXVlc3RDaGFubmVsLCBwYXlsb2FkXTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5GRVRDSF9TT0NLRVRTOiB7XG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdWlkOiByZXF1ZXN0LnVpZCxcbiAgICAgICAgICByZXF1ZXN0SWQ6IHJlcXVlc3QuZGF0YS5yZXF1ZXN0SWQsXG4gICAgICAgICAgdHlwZTogNSxcbiAgICAgICAgICBvcHRzOiByZXF1ZXN0LmRhdGEub3B0cyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIFt0aGlzLnJlcXVlc3RDaGFubmVsLCBwYXlsb2FkXTtcbiAgICAgIH1cblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5TRVJWRVJfU0lERV9FTUlUOiB7XG4gICAgICAgIGNvbnN0IHBheWxvYWQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdWlkOiByZXF1ZXN0LnVpZCxcbiAgICAgICAgICB0eXBlOiA2LFxuICAgICAgICAgIGRhdGE6IHJlcXVlc3QuZGF0YS5wYWNrZXQsXG4gICAgICAgICAgcmVxdWVzdElkOiByZXF1ZXN0LmRhdGEucmVxdWVzdElkLFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gW3RoaXMucmVxdWVzdENoYW5uZWwsIHBheWxvYWRdO1xuICAgICAgfVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBcInNob3VsZCBub3QgaGFwcGVuXCI7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgcHVibGlzaFJlc3BvbnNlKHJlcXVlc3RlclVpZDogc3RyaW5nLCByZXNwb25zZTogQ2x1c3RlclJlc3BvbnNlKSB7XG4gICAgLy8gbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlIE5vZGUuanMgaW1wbGVtZW50YXRpb24gd2l0aCBwdWJsaXNoT25TcGVjaWZpY1Jlc3BvbnNlQ2hhbm5lbDogdHJ1ZVxuICAgIGNvbnN0IGNoYW5uZWwgPVxuICAgICAgYCR7dGhpcy5vcHRzLmtleX0tcmVzcG9uc2UjJHt0aGlzLm5zcC5uYW1lfSMke3JlcXVlc3RlclVpZH0jYDtcbiAgICBjb25zdCBwYXlsb2FkID0gUmVkaXNBZGFwdGVyLiNlbmNvZGVSZXNwb25zZShyZXNwb25zZSk7XG5cbiAgICBnZXRMb2dnZXIoXCJzb2NrZXQuaW9cIikuZGVidWcoXG4gICAgICBgW3JlZGlzLWFkYXB0ZXJdIFske3RoaXMudWlkfV0gc2VuZGluZyByZXNwb25zZSB0eXBlICR7cmVzcG9uc2UudHlwZX0gdG8gY2hhbm5lbCAke2NoYW5uZWx9YCxcbiAgICApO1xuXG4gICAgdGhpcy5wdWJDbGllbnQucHVibGlzaChjaGFubmVsLCBwYXlsb2FkKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImVycm9yXCIsIGVycik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRW5jb2RlIHRoZSByZXNwb25zZSBwYXlsb2FkIHRvIG1hdGNoIHRoZSBmb3JtYXQgb2YgdGhlIE5vZGUuanMgaW1wbGVtZW50YXRpb25cbiAgICpcbiAgICogQHBhcmFtIHJlc3BvbnNlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBzdGF0aWMgI2VuY29kZVJlc3BvbnNlKFxuICAgIHJlc3BvbnNlOiBDbHVzdGVyUmVzcG9uc2UsXG4gICk6IHN0cmluZyB8IFVpbnQ4QXJyYXkge1xuICAgIHN3aXRjaCAocmVzcG9uc2UudHlwZSkge1xuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5GRVRDSF9TT0NLRVRTX1JFU1BPTlNFOiB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgcmVxdWVzdElkOiByZXNwb25zZS5kYXRhLnJlcXVlc3RJZCxcbiAgICAgICAgICBzb2NrZXRzOiByZXNwb25zZS5kYXRhLnNvY2tldHMsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLlNFUlZFUl9TSURFX0VNSVRfUkVTUE9OU0U6IHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0eXBlOiA2LFxuICAgICAgICAgIHJlcXVlc3RJZDogcmVzcG9uc2UuZGF0YS5yZXF1ZXN0SWQsXG4gICAgICAgICAgZGF0YTogcmVzcG9uc2UuZGF0YS5wYWNrZXQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLkJST0FEQ0FTVF9DTElFTlRfQ09VTlQ6IHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICB0eXBlOiA4LFxuICAgICAgICAgIHJlcXVlc3RJZDogcmVzcG9uc2UuZGF0YS5yZXF1ZXN0SWQsXG4gICAgICAgICAgY2xpZW50Q291bnQ6IHJlc3BvbnNlLmRhdGEuY2xpZW50Q291bnQsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFJlcXVlc3RUeXBlLkJST0FEQ0FTVF9BQ0s6IHtcbiAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGVuY29kZSh7XG4gICAgICAgICAgdHlwZTogOSxcbiAgICAgICAgICByZXF1ZXN0SWQ6IHJlc3BvbnNlLmRhdGEucmVxdWVzdElkLFxuICAgICAgICAgIHBhY2tldDogcmVzcG9uc2UuZGF0YS5wYWNrZXQsXG4gICAgICAgIH0pKTtcbiAgICAgIH1cblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgXCJzaG91bGQgbm90IGhhcHBlblwiO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgd2l0aCBhIHN1YnNjcmlwdGlvbiBtZXNzYWdlXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAjb25Ccm9hZGNhc3RNZXNzYWdlKGNoYW5uZWw6IHN0cmluZywgbXNnOiBVaW50OEFycmF5KSB7XG4gICAgY29uc3Qgcm9vbSA9IGNoYW5uZWwuc2xpY2UodGhpcy5icm9hZGNhc3RDaGFubmVsLmxlbmd0aCwgLTEpO1xuICAgIGlmIChyb29tICE9PSBcIlwiICYmICF0aGlzLiNoYXNSb29tKHJvb20pKSB7XG4gICAgICByZXR1cm4gZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICBgW3JlZGlzLWFkYXB0ZXJdIFske3RoaXMudWlkfV0gaWdub3JlIHVua25vd24gcm9vbSAke3Jvb219YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgW3VpZCwgcGFja2V0LCBvcHRzXSA9IGRlY29kZShtc2cpIGFzIFtcbiAgICAgIHN0cmluZyxcbiAgICAgIFBhY2tldCxcbiAgICAgIEJyb2FkY2FzdE9wdGlvbnMsXG4gICAgXTtcblxuICAgIHJldHVybiB0aGlzLm9uUmVxdWVzdCh7XG4gICAgICB1aWQsXG4gICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5CUk9BRENBU1QsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIHBhY2tldCxcbiAgICAgICAgb3B0cyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIHJvb20gZXhpc3RzIChhcyBpdCBpcyBlbmNvZGVkIHRvIGEgc3RyaW5nIGluIHRoZSBicm9hZGNhc3QgbWV0aG9kKVxuICAgKlxuICAgKiBAcGFyYW0gcm9vbVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgI2hhc1Jvb20ocm9vbTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgbnVtZXJpY1Jvb20gPSBwYXJzZUZsb2F0KHJvb20pO1xuICAgIGNvbnN0IGhhc051bWVyaWNSb29tID0gIWlzTmFOKG51bWVyaWNSb29tKSAmJiB0aGlzLnJvb21zLmhhcyhudW1lcmljUm9vbSk7XG4gICAgcmV0dXJuIGhhc051bWVyaWNSb29tIHx8IHRoaXMucm9vbXMuaGFzKHJvb20pO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBvbiByZXF1ZXN0IGZyb20gYW5vdGhlciBub2RlXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAjb25SYXdSZXF1ZXN0KG1zZzogVWludDhBcnJheSkge1xuICAgIGxldCByYXdSZXF1ZXN0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblxuICAgIHRyeSB7XG4gICAgICAvLyBpZiB0aGUgYnVmZmVyIHN0YXJ0cyB3aXRoIGEgXCJ7XCIgY2hhcmFjdGVyXG4gICAgICBpZiAobXNnWzBdID09PSAweDdiKSB7XG4gICAgICAgIHJhd1JlcXVlc3QgPSBKU09OLnBhcnNlKFRFWFRfREVDT0RFUi5kZWNvZGUobXNnKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByYXdSZXF1ZXN0ID0gZGVjb2RlKG1zZykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICB9XG4gICAgfSBjYXRjaCAoXykge1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICBgW3JlZGlzLWFkYXB0ZXJdIFske3RoaXMudWlkfV0gaWdub3JpbmcgbWFsZm9ybWVkIHJlcXVlc3RgLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCByZXF1ZXN0ID0gUmVkaXNBZGFwdGVyLiNkZWNvZGVSZXF1ZXN0KHJhd1JlcXVlc3QpO1xuXG4gICAgaWYgKHJlcXVlc3QpIHtcbiAgICAgIHJldHVybiB0aGlzLm9uUmVxdWVzdChyZXF1ZXN0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVjb2RlIHJlcXVlc3QgcGF5bG9hZFxuICAgKlxuICAgKiBAcGFyYW0gcmF3UmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgc3RhdGljICNkZWNvZGVSZXF1ZXN0KFxuICAgIHJhd1JlcXVlc3Q6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICApOiBDbHVzdGVyUmVxdWVzdCB8IG51bGwge1xuICAgIHN3aXRjaCAocmF3UmVxdWVzdC50eXBlKSB7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdWlkOiByYXdSZXF1ZXN0LnVpZCBhcyBzdHJpbmcsXG4gICAgICAgICAgdHlwZTogUmVxdWVzdFR5cGUuU09DS0VUU19KT0lOLFxuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIG9wdHM6IHJhd1JlcXVlc3Qub3B0cyxcbiAgICAgICAgICAgIHJvb21zOiByYXdSZXF1ZXN0LnJvb21zLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgIGNhc2UgMzpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1aWQ6IHJhd1JlcXVlc3QudWlkIGFzIHN0cmluZyxcbiAgICAgICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5TT0NLRVRTX0xFQVZFLFxuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIG9wdHM6IHJhd1JlcXVlc3Qub3B0cyxcbiAgICAgICAgICAgIHJvb21zOiByYXdSZXF1ZXN0LnJvb21zLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgIGNhc2UgNDpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1aWQ6IHJhd1JlcXVlc3QudWlkIGFzIHN0cmluZyxcbiAgICAgICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5ESVNDT05ORUNUX1NPQ0tFVFMsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgb3B0czogcmF3UmVxdWVzdC5vcHRzLFxuICAgICAgICAgICAgY2xvc2U6IHJhd1JlcXVlc3QuY2xvc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVpZDogcmF3UmVxdWVzdC51aWQgYXMgc3RyaW5nLFxuICAgICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLkZFVENIX1NPQ0tFVFMsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcmVxdWVzdElkOiByYXdSZXF1ZXN0LnJlcXVlc3RJZCxcbiAgICAgICAgICAgIG9wdHM6IHJhd1JlcXVlc3Qub3B0cyxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICBjYXNlIDY6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdWlkOiByYXdSZXF1ZXN0LnVpZCBhcyBzdHJpbmcsXG4gICAgICAgICAgdHlwZTogUmVxdWVzdFR5cGUuU0VSVkVSX1NJREVfRU1JVCxcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICByZXF1ZXN0SWQ6IHJhd1JlcXVlc3QucmVxdWVzdElkLFxuICAgICAgICAgICAgcGFja2V0OiByYXdSZXF1ZXN0LmRhdGEsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgY2FzZSA3OlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHVpZDogcmF3UmVxdWVzdC51aWQgYXMgc3RyaW5nLFxuICAgICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLkJST0FEQ0FTVCxcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBvcHRzOiByYXdSZXF1ZXN0Lm9wdHMsXG4gICAgICAgICAgICByZXF1ZXN0SWQ6IHJhd1JlcXVlc3QucmVxdWVzdElkLFxuICAgICAgICAgICAgcGFja2V0OiByYXdSZXF1ZXN0LnBhY2tldCxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIG9uIHJlcXVlc3QgZnJvbSBhbm90aGVyIG5vZGVcbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gICNvblJhd1Jlc3BvbnNlKG1zZzogVWludDhBcnJheSkge1xuICAgIGxldCByYXdSZXNwb25zZTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbiAgICB0cnkge1xuICAgICAgLy8gaWYgdGhlIGJ1ZmZlciBzdGFydHMgd2l0aCBhIFwie1wiIGNoYXJhY3RlclxuICAgICAgaWYgKG1zZ1swXSA9PT0gMHg3Yikge1xuICAgICAgICByYXdSZXNwb25zZSA9IEpTT04ucGFyc2UoVEVYVF9ERUNPREVSLmRlY29kZShtc2cpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJhd1Jlc3BvbnNlID0gZGVjb2RlKG1zZykgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gICAgICB9XG4gICAgfSBjYXRjaCAoXykge1xuICAgICAgZ2V0TG9nZ2VyKFwic29ja2V0LmlvXCIpLmRlYnVnKFxuICAgICAgICBgW3JlZGlzLWFkYXB0ZXJdIFske3RoaXMudWlkfV0gaWdub3JpbmcgbWFsZm9ybWVkIHJlc3BvbnNlYCxcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBSZWRpc0FkYXB0ZXIuI2RlY29kZVJlc3BvbnNlKHJhd1Jlc3BvbnNlKTtcblxuICAgIGlmIChyZXNwb25zZSkge1xuICAgICAgdGhpcy5vblJlc3BvbnNlKHJlc3BvbnNlKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgI2RlY29kZVJlc3BvbnNlKFxuICAgIHJhd1Jlc3BvbnNlOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbiAgKTogQ2x1c3RlclJlc3BvbnNlIHwgbnVsbCB7XG4gICAgLy8gdGhlIE5vZGUuanMgaW1wbGVtZW50YXRpb24gb2YgZmV0Y2hTb2NrZXRzKCkgZG9lcyBub3QgaW5jbHVkZSB0aGUgdHlwZSBvZiB0aGUgcmVxdWVzdFxuICAgIC8vIHJlZmVyZW5jZTogaHR0cHM6Ly9naXRodWIuY29tL3NvY2tldGlvL3NvY2tldC5pby1yZWRpcy1hZGFwdGVyL2Jsb2IvYjQyMTVjZGJjMDBhZjk2ZWFjMzdhMGI5Y2MwZmJjYjc5MzM4NGI1My9saWIvaW5kZXgudHMjTDM0OS1MMzYxXG4gICAgY29uc3QgcmVzcG9uc2VUeXBlID0gcmF3UmVzcG9uc2UudHlwZSB8fCBSZXF1ZXN0VHlwZS5GRVRDSF9TT0NLRVRTO1xuXG4gICAgc3dpdGNoIChyZXNwb25zZVR5cGUpIHtcbiAgICAgIGNhc2UgUmVxdWVzdFR5cGUuRkVUQ0hfU09DS0VUUzpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5GRVRDSF9TT0NLRVRTX1JFU1BPTlNFLFxuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHJlcXVlc3RJZDogcmF3UmVzcG9uc2UucmVxdWVzdElkIGFzIHN0cmluZyxcbiAgICAgICAgICAgIHNvY2tldHM6IHJhd1Jlc3BvbnNlLnNvY2tldHMsXG4gICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgY2FzZSBSZXF1ZXN0VHlwZS5TRVJWRVJfU0lERV9FTUlUOlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHR5cGU6IFJlcXVlc3RUeXBlLlNFUlZFUl9TSURFX0VNSVRfUkVTUE9OU0UsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgcmVxdWVzdElkOiByYXdSZXNwb25zZS5yZXF1ZXN0SWQgYXMgc3RyaW5nLFxuICAgICAgICAgICAgcGFja2V0OiByYXdSZXNwb25zZS5kYXRhLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgIGNhc2UgODpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0eXBlOiBSZXF1ZXN0VHlwZS5CUk9BRENBU1RfQ0xJRU5UX0NPVU5ULFxuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHJlcXVlc3RJZDogcmF3UmVzcG9uc2UucmVxdWVzdElkIGFzIHN0cmluZyxcbiAgICAgICAgICAgIGNsaWVudENvdW50OiByYXdSZXNwb25zZS5jbGllbnRDb3VudCxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICBjYXNlIDk6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogUmVxdWVzdFR5cGUuQlJPQURDQVNUX0FDSyxcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICByZXF1ZXN0SWQ6IHJhd1Jlc3BvbnNlLnJlcXVlc3RJZCBhcyBzdHJpbmcsXG4gICAgICAgICAgICBwYWNrZXQ6IHJhd1Jlc3BvbnNlLnBhY2tldCxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBzZXJ2ZXJDb3VudCgpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIC8vIFRPRE8gTlVNU1VCIHdpdGhpbiBhIFJlZGlzIGNsdXN0ZXJcbiAgICBjb25zdCBbXywgdmFsdWVdID0gYXdhaXQgdGhpcy5wdWJDbGllbnQucHVic3ViTnVtc3ViKHRoaXMucmVxdWVzdENoYW5uZWwpO1xuICAgIGdldExvZ2dlcihcInNvY2tldC5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbcmVkaXMtYWRhcHRlcl0gWyR7dGhpcy51aWR9XSB0aGVyZSBhcmUgJHt2YWx1ZX0gc2VydmVyKHMpIGluIHRoZSBjbHVzdGVyYCxcbiAgICApO1xuICAgIHJldHVybiB2YWx1ZSBhcyBudW1iZXI7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSxxQkFBcUI7QUFFL0MsU0FDRSxPQUFPLFFBR0Ysc0JBQXNCO0FBRTdCLFNBQVMsTUFBTSxFQUFFLE1BQU0sUUFBUSxvQkFBb0I7QUFDbkQsU0FHRSxXQUFXLFFBQ04sOEJBQThCO0FBVXJDLE9BQU8sU0FBUyxjQU1kLFNBQWdCLEVBQ2hCLFNBQWdCLEVBQ2hCLElBQW1DO0VBRW5DLE1BQU0sVUFBVSxPQUFPLE1BQU0sQ0FBQztJQUM1QixLQUFLO0VBQ1AsR0FBRztFQUNILE9BQU8sU0FDTCxHQUFjO0lBRWQsT0FBTyxJQUFJLGFBQWEsS0FBSyxXQUFXLFdBQVc7RUFDckQ7QUFDRjtBQUVBLE1BQU0sZUFBZSxJQUFJO0FBRXpCLE1BQU0scUJBQXFCO0VBQ1IsVUFBaUI7RUFDakIsVUFBaUI7RUFDakIsS0FBMEI7RUFFMUIsaUJBQXlCO0VBQ3pCLGVBQXVCO0VBQ3ZCLGdCQUF3QjtFQUV6QyxZQUNFLEdBQWMsRUFDZCxTQUFnQixFQUNoQixTQUFnQixFQUNoQixJQUF5QixDQUN6QjtJQUNBLEtBQUssQ0FBQztJQUNOLElBQUksQ0FBQyxTQUFTLEdBQUc7SUFDakIsSUFBSSxDQUFDLFNBQVMsR0FBRztJQUNqQixJQUFJLENBQUMsSUFBSSxHQUFHO0lBRVosSUFBSSxDQUFDLGdCQUFnQixHQUFHLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksSUFBSSxD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
// denoCacheMetadata=4885727344557724262,12193239631662194899