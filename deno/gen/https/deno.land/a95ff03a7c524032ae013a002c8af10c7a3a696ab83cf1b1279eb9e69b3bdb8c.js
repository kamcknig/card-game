import { getLogger } from "../../../../deps.ts";
import { Transport } from "../transport.ts";
import { Parser } from "../../../engine.io-parser/mod.ts";
export class Polling extends Transport {
  pollingPromise;
  get name() {
    return "polling";
  }
  get upgradesTo() {
    return [
      "websocket"
    ];
  }
  onRequest(req, responseHeaders) {
    if (req.method === "GET") {
      return this.onPollRequest(req, responseHeaders);
    } else if (req.method === "POST") {
      return this.onDataRequest(req, responseHeaders);
    }
    return Promise.resolve(new Response(null, {
      status: 400,
      headers: responseHeaders
    }));
  }
  /**
   * The client sends a long-polling request awaiting the server to send data.
   *
   * @param req
   * @param responseHeaders
   * @private
   */ onPollRequest(_req, responseHeaders) {
    if (this.pollingPromise) {
      getLogger("engine.io").debug("[polling] request overlap");
      this.onError("overlap from client");
      return Promise.resolve(new Response(null, {
        status: 400,
        headers: responseHeaders
      }));
    }
    getLogger("engine.io").debug("[polling] new polling request");
    return new Promise((resolve, reject)=>{
      this.pollingPromise = {
        resolve,
        reject,
        responseHeaders
      };
      getLogger("engine.io").debug("[polling] transport is now writable");
      this.writable = true;
      this.emitReserved("drain");
    });
  }
  /**
   * The client sends a request with data.
   *
   * @param req
   * @param responseHeaders
   */ async onDataRequest(req, responseHeaders) {
    getLogger("engine.io").debug("[polling] new data request");
    const data = await req.text();
    if (data.length > this.opts.maxHttpBufferSize) {
      this.onError("payload too large");
      return Promise.resolve(new Response(null, {
        status: 413,
        headers: responseHeaders
      }));
    }
    const packets = Parser.decodePayload(data);
    getLogger("engine.io").debug(`[polling] decoded ${packets.length} packet(s)`);
    for (const packet of packets){
      this.onPacket(packet);
    }
    return Promise.resolve(new Response("ok", {
      status: 200,
      headers: responseHeaders
    }));
  }
  send(packets) {
    this.writable = false;
    Parser.encodePayload(packets, (data)=>this.write(data));
  }
  /**
   * Writes data as response to long-polling request
   *
   * @param data
   * @private
   */ write(data) {
    getLogger("engine.io").debug(`[polling] writing ${data}`);
    if (!this.pollingPromise) {
      return;
    }
    const headers = this.pollingPromise.responseHeaders;
    headers.set("Content-Type", "text/plain; charset=UTF-8");
    // note: the HTTP server automatically handles the compression
    // see https://deno.land/manual@v1.24.3/runtime/http_server_apis#automatic-body-compression
    this.pollingPromise.resolve(new Response(data, {
      status: 200,
      headers
    }));
    this.pollingPromise = undefined;
  }
  doClose() {
    if (this.writable) {
      getLogger("engine.io").debug("[polling] transport writable - closing right away");
      // if we have received a "close" packet from the client, then we can just send a "noop" packet back
      this.send([
        {
          type: this.readyState === "closing" ? "close" : "noop"
        }
      ]);
    }
    this.onClose();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL2VuZ2luZS5pby9saWIvdHJhbnNwb3J0cy9wb2xsaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldExvZ2dlciB9IGZyb20gXCIuLi8uLi8uLi8uLi9kZXBzLnRzXCI7XG5pbXBvcnQgeyBUcmFuc3BvcnQgfSBmcm9tIFwiLi4vdHJhbnNwb3J0LnRzXCI7XG5pbXBvcnQgeyBQYWNrZXQsIFBhcnNlciB9IGZyb20gXCIuLi8uLi8uLi9lbmdpbmUuaW8tcGFyc2VyL21vZC50c1wiO1xuXG5leHBvcnQgY2xhc3MgUG9sbGluZyBleHRlbmRzIFRyYW5zcG9ydCB7XG4gIHByaXZhdGUgcG9sbGluZ1Byb21pc2U/OiB7XG4gICAgcmVzb2x2ZTogKHJlczogUmVzcG9uc2UpID0+IHZvaWQ7XG4gICAgcmVqZWN0OiAoKSA9PiB2b2lkO1xuICAgIHJlc3BvbnNlSGVhZGVyczogSGVhZGVycztcbiAgfTtcblxuICBwdWJsaWMgZ2V0IG5hbWUoKSB7XG4gICAgcmV0dXJuIFwicG9sbGluZ1wiO1xuICB9XG5cbiAgcHVibGljIGdldCB1cGdyYWRlc1RvKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1wid2Vic29ja2V0XCJdO1xuICB9XG5cbiAgcHVibGljIG9uUmVxdWVzdChyZXE6IFJlcXVlc3QsIHJlc3BvbnNlSGVhZGVyczogSGVhZGVycyk6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgICBpZiAocmVxLm1ldGhvZCA9PT0gXCJHRVRcIikge1xuICAgICAgcmV0dXJuIHRoaXMub25Qb2xsUmVxdWVzdChyZXEsIHJlc3BvbnNlSGVhZGVycyk7XG4gICAgfSBlbHNlIGlmIChyZXEubWV0aG9kID09PSBcIlBPU1RcIikge1xuICAgICAgcmV0dXJuIHRoaXMub25EYXRhUmVxdWVzdChyZXEsIHJlc3BvbnNlSGVhZGVycyk7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoXG4gICAgICBuZXcgUmVzcG9uc2UobnVsbCwgeyBzdGF0dXM6IDQwMCwgaGVhZGVyczogcmVzcG9uc2VIZWFkZXJzIH0pLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGNsaWVudCBzZW5kcyBhIGxvbmctcG9sbGluZyByZXF1ZXN0IGF3YWl0aW5nIHRoZSBzZXJ2ZXIgdG8gc2VuZCBkYXRhLlxuICAgKlxuICAgKiBAcGFyYW0gcmVxXG4gICAqIEBwYXJhbSByZXNwb25zZUhlYWRlcnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgb25Qb2xsUmVxdWVzdChcbiAgICBfcmVxOiBSZXF1ZXN0LFxuICAgIHJlc3BvbnNlSGVhZGVyczogSGVhZGVycyxcbiAgKTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgIGlmICh0aGlzLnBvbGxpbmdQcm9taXNlKSB7XG4gICAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXCJbcG9sbGluZ10gcmVxdWVzdCBvdmVybGFwXCIpO1xuICAgICAgdGhpcy5vbkVycm9yKFwib3ZlcmxhcCBmcm9tIGNsaWVudFwiKTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoXG4gICAgICAgIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1czogNDAwLCBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgIFwiW3BvbGxpbmddIG5ldyBwb2xsaW5nIHJlcXVlc3RcIixcbiAgICApO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFJlc3BvbnNlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICB0aGlzLnBvbGxpbmdQcm9taXNlID0geyByZXNvbHZlLCByZWplY3QsIHJlc3BvbnNlSGVhZGVycyB9O1xuXG4gICAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXCJbcG9sbGluZ10gdHJhbnNwb3J0IGlzIG5vdyB3cml0YWJsZVwiKTtcbiAgICAgIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJkcmFpblwiKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgY2xpZW50IHNlbmRzIGEgcmVxdWVzdCB3aXRoIGRhdGEuXG4gICAqXG4gICAqIEBwYXJhbSByZXFcbiAgICogQHBhcmFtIHJlc3BvbnNlSGVhZGVyc1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBvbkRhdGFSZXF1ZXN0KFxuICAgIHJlcTogUmVxdWVzdCxcbiAgICByZXNwb25zZUhlYWRlcnM6IEhlYWRlcnMsXG4gICk6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXG4gICAgICBcIltwb2xsaW5nXSBuZXcgZGF0YSByZXF1ZXN0XCIsXG4gICAgKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXEudGV4dCgpO1xuXG4gICAgaWYgKGRhdGEubGVuZ3RoID4gdGhpcy5vcHRzLm1heEh0dHBCdWZmZXJTaXplKSB7XG4gICAgICB0aGlzLm9uRXJyb3IoXCJwYXlsb2FkIHRvbyBsYXJnZVwiKTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoXG4gICAgICAgIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1czogNDEzLCBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IHBhY2tldHMgPSBQYXJzZXIuZGVjb2RlUGF5bG9hZChkYXRhKTtcblxuICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgIGBbcG9sbGluZ10gZGVjb2RlZCAke3BhY2tldHMubGVuZ3RofSBwYWNrZXQocylgLFxuICAgICk7XG5cbiAgICBmb3IgKGNvbnN0IHBhY2tldCBvZiBwYWNrZXRzKSB7XG4gICAgICB0aGlzLm9uUGFja2V0KHBhY2tldCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShcbiAgICAgIG5ldyBSZXNwb25zZShcIm9rXCIsIHtcbiAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlSGVhZGVycyxcbiAgICAgIH0pLFxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgc2VuZChwYWNrZXRzOiBQYWNrZXRbXSkge1xuICAgIHRoaXMud3JpdGFibGUgPSBmYWxzZTtcbiAgICBQYXJzZXIuZW5jb2RlUGF5bG9hZChwYWNrZXRzLCAoZGF0YTogc3RyaW5nKSA9PiB0aGlzLndyaXRlKGRhdGEpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXcml0ZXMgZGF0YSBhcyByZXNwb25zZSB0byBsb25nLXBvbGxpbmcgcmVxdWVzdFxuICAgKlxuICAgKiBAcGFyYW0gZGF0YVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSB3cml0ZShkYXRhOiBzdHJpbmcpIHtcbiAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoYFtwb2xsaW5nXSB3cml0aW5nICR7ZGF0YX1gKTtcblxuICAgIGlmICghdGhpcy5wb2xsaW5nUHJvbWlzZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGhlYWRlcnMgPSB0aGlzLnBvbGxpbmdQcm9taXNlLnJlc3BvbnNlSGVhZGVycztcbiAgICBoZWFkZXJzLnNldChcIkNvbnRlbnQtVHlwZVwiLCBcInRleHQvcGxhaW47IGNoYXJzZXQ9VVRGLThcIik7XG5cbiAgICAvLyBub3RlOiB0aGUgSFRUUCBzZXJ2ZXIgYXV0b21hdGljYWxseSBoYW5kbGVzIHRoZSBjb21wcmVzc2lvblxuICAgIC8vIHNlZSBodHRwczovL2Rlbm8ubGFuZC9tYW51YWxAdjEuMjQuMy9ydW50aW1lL2h0dHBfc2VydmVyX2FwaXMjYXV0b21hdGljLWJvZHktY29tcHJlc3Npb25cbiAgICB0aGlzLnBvbGxpbmdQcm9taXNlLnJlc29sdmUoXG4gICAgICBuZXcgUmVzcG9uc2UoZGF0YSwge1xuICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnBvbGxpbmdQcm9taXNlID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcHJvdGVjdGVkIGRvQ2xvc2UoKSB7XG4gICAgaWYgKHRoaXMud3JpdGFibGUpIHtcbiAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgXCJbcG9sbGluZ10gdHJhbnNwb3J0IHdyaXRhYmxlIC0gY2xvc2luZyByaWdodCBhd2F5XCIsXG4gICAgICApO1xuICAgICAgLy8gaWYgd2UgaGF2ZSByZWNlaXZlZCBhIFwiY2xvc2VcIiBwYWNrZXQgZnJvbSB0aGUgY2xpZW50LCB0aGVuIHdlIGNhbiBqdXN0IHNlbmQgYSBcIm5vb3BcIiBwYWNrZXQgYmFja1xuICAgICAgdGhpcy5zZW5kKFt7IHR5cGU6IHRoaXMucmVhZHlTdGF0ZSA9PT0gXCJjbG9zaW5nXCIgPyBcImNsb3NlXCIgOiBcIm5vb3BcIiB9XSk7XG4gICAgfVxuXG4gICAgdGhpcy5vbkNsb3NlKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSxzQkFBc0I7QUFDaEQsU0FBUyxTQUFTLFFBQVEsa0JBQWtCO0FBQzVDLFNBQWlCLE1BQU0sUUFBUSxtQ0FBbUM7QUFFbEUsT0FBTyxNQUFNLGdCQUFnQjtFQUNuQixlQUlOO0VBRUYsSUFBVyxPQUFPO0lBQ2hCLE9BQU87RUFDVDtFQUVBLElBQVcsYUFBdUI7SUFDaEMsT0FBTztNQUFDO0tBQVk7RUFDdEI7RUFFTyxVQUFVLEdBQVksRUFBRSxlQUF3QixFQUFxQjtJQUMxRSxJQUFJLElBQUksTUFBTSxLQUFLLE9BQU87TUFDeEIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUs7SUFDakMsT0FBTyxJQUFJLElBQUksTUFBTSxLQUFLLFFBQVE7TUFDaEMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUs7SUFD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
// denoCacheMetadata=11956085980912762347,8852971154756058473