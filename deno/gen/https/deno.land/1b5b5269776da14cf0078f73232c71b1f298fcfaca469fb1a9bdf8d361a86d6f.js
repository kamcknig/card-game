import { EventEmitter } from "../../event-emitter/mod.ts";
import { getLogger } from "../../../deps.ts";
const FAST_UPGRADE_INTERVAL_MS = 100;
export class Socket extends EventEmitter {
  id;
  readyState = "opening";
  transport;
  opts;
  upgradeState = "not_upgraded";
  writeBuffer = [];
  pingIntervalTimerId;
  pingTimeoutTimerId;
  constructor(id, opts, transport){
    super();
    this.id = id;
    this.opts = opts;
    this.transport = transport;
    this.bindTransport(transport);
    this.onOpen();
  }
  /**
   * Called upon transport considered open.
   *
   * @private
   */ onOpen() {
    this.readyState = "open";
    this.sendPacket("open", JSON.stringify({
      sid: this.id,
      upgrades: this.transport.upgradesTo,
      pingInterval: this.opts.pingInterval,
      pingTimeout: this.opts.pingTimeout,
      maxPayload: this.opts.maxHttpBufferSize
    }));
    this.emitReserved("open");
    this.schedulePing();
  }
  /**
   * Called upon transport packet.
   *
   * @param packet
   * @private
   */ onPacket(packet) {
    if (this.readyState !== "open") {
      getLogger("engine.io").debug("[socket] packet received with closed socket");
      return;
    }
    getLogger("engine.io").debug(`[socket] received packet ${packet.type}`);
    this.emitReserved("packet", packet);
    switch(packet.type){
      case "pong":
        getLogger("engine.io").debug("[socket] got pong");
        clearTimeout(this.pingTimeoutTimerId);
        this.schedulePing();
        this.emitReserved("heartbeat");
        break;
      case "message":
        this.emitReserved("message", packet.data);
        break;
      case "error":
      default:
        this.onClose("parse error");
        break;
    }
  }
  /**
   * Called upon transport error.
   *
   * @param err
   * @private
   */ onError(err) {
    getLogger("engine.io").debug(`[socket] transport error: ${err.message}`);
    this.onClose("transport error");
  }
  /**
   * Pings client every `pingInterval` and expects response
   * within `pingTimeout` or closes connection.
   *
   * @private
   */ schedulePing() {
    this.pingIntervalTimerId = setTimeout(()=>{
      getLogger("engine.io").debug(`[socket] writing ping packet - expecting pong within ${this.opts.pingTimeout} ms`, this.opts.pingTimeout);
      this.sendPacket("ping");
      this.resetPingTimeout();
    }, this.opts.pingInterval);
  }
  /**
   * Resets ping timeout.
   *
   * @private
   */ resetPingTimeout() {
    clearTimeout(this.pingTimeoutTimerId);
    this.pingTimeoutTimerId = setTimeout(()=>{
      if (this.readyState !== "closed") {
        this.onClose("ping timeout");
      }
    }, this.opts.pingTimeout);
  }
  /**
   * Attaches handlers for the given transport.
   *
   * @param transport
   * @private
   */ bindTransport(transport) {
    this.transport = transport;
    this.transport.once("error", (err)=>this.onError(err));
    this.transport.on("packet", (packet)=>this.onPacket(packet));
    this.transport.on("drain", ()=>this.flush());
    this.transport.on("close", ()=>this.onClose("transport close"));
  }
  /**
   * Upgrades socket to the given transport
   *
   * @param transport
   * @private
   */ /* private */ _maybeUpgrade(transport) {
    if (this.upgradeState === "upgrading") {
      getLogger("engine.io").debug("[socket] transport has already been trying to upgrade");
      return transport.close();
    } else if (this.upgradeState === "upgraded") {
      getLogger("engine.io").debug("[socket] transport has already been upgraded");
      return transport.close();
    }
    getLogger("engine.io").debug("[socket] upgrading existing transport");
    this.upgradeState = "upgrading";
    const timeoutId = setTimeout(()=>{
      getLogger("engine.io").debug("[socket] client did not complete upgrade - closing transport");
      transport.close();
    }, this.opts.upgradeTimeout);
    transport.on("close", ()=>{
      clearInterval(fastUpgradeTimerId);
      transport.off();
    });
    let fastUpgradeTimerId;
    // we need to make sure that no packets gets lost during the upgrade, so the client does not cancel the HTTP
    // long-polling request itself, instead the server sends a "noop" packet to cleanly end any ongoing polling request
    const sendNoopPacket = ()=>{
      if (this.transport.name === "polling" && this.transport.writable) {
        getLogger("engine.io").debug("[socket] writing a noop packet to polling for fast upgrade");
        this.transport.send([
          {
            type: "noop"
          }
        ]);
      }
    };
    transport.on("packet", (packet)=>{
      if (packet.type === "ping" && packet.data === "probe") {
        getLogger("engine.io").debug("[socket] got probe ping packet, sending pong");
        transport.send([
          {
            type: "pong",
            data: "probe"
          }
        ]);
        sendNoopPacket();
        fastUpgradeTimerId = setInterval(sendNoopPacket, FAST_UPGRADE_INTERVAL_MS);
        this.emitReserved("upgrading", transport);
      } else if (packet.type === "upgrade" && this.readyState !== "closed") {
        getLogger("engine.io").debug("[socket] got upgrade packet - upgrading");
        this.upgradeState = "upgraded";
        clearTimeout(timeoutId);
        clearInterval(fastUpgradeTimerId);
        transport.off();
        this.closeTransport();
        this.bindTransport(transport);
        this.emitReserved("upgrade", transport);
        this.flush();
      } else {
        getLogger("engine.io").debug("[socket] invalid upgrade packet");
        clearTimeout(timeoutId);
        transport.close();
      }
    });
  }
  /**
   * Called upon transport considered closed.
   *
   * @param reason
   * @private
   */ onClose(reason) {
    if (this.readyState === "closed") {
      return;
    }
    getLogger("engine.io").debug(`[socket] socket closed due to ${reason}`);
    this.readyState = "closed";
    clearTimeout(this.pingIntervalTimerId);
    clearTimeout(this.pingTimeoutTimerId);
    this.closeTransport();
    this.emitReserved("close", reason);
  }
  /**
   * Sends a "message" packet.
   *
   * @param data
   */ send(data) {
    this.sendPacket("message", data);
    return this;
  }
  /**
   * Sends a packet.
   *
   * @param type
   * @param data
   * @private
   */ sendPacket(type, data) {
    if ([
      "closing",
      "closed"
    ].includes(this.readyState)) {
      return;
    }
    getLogger("engine.io").debug(`[socket] sending packet ${type} (${data})`);
    const packet = {
      type,
      data
    };
    this.emitReserved("packetCreate", packet);
    this.writeBuffer.push(packet);
    this.flush();
  }
  /**
   * Attempts to flush the packets buffer.
   *
   * @private
   */ flush() {
    const shouldFlush = this.readyState !== "closed" && this.transport.writable && this.writeBuffer.length > 0;
    if (!shouldFlush) {
      return;
    }
    getLogger("engine.io").debug(`[socket] flushing buffer with ${this.writeBuffer.length} packet(s) to transport`);
    this.emitReserved("flush", this.writeBuffer);
    const buffer = this.writeBuffer;
    this.writeBuffer = [];
    this.transport.send(buffer);
    this.emitReserved("drain");
  }
  /**
   * Closes the socket and underlying transport.
   */ close() {
    if (this.readyState !== "open") {
      return;
    }
    this.readyState = "closing";
    const close = ()=>{
      this.closeTransport();
      this.onClose("forced close");
    };
    if (this.writeBuffer.length) {
      getLogger("engine.io").debug(`[socket] buffer not empty, waiting for the drain event`);
      this.once("drain", close);
    } else {
      close();
    }
  }
  /**
   * Closes the underlying transport.
   *
   * @private
   */ closeTransport() {
    this.transport.off();
    this.transport.close();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL2VuZ2luZS5pby9saWIvc29ja2V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCIuLi8uLi9ldmVudC1lbWl0dGVyL21vZC50c1wiO1xuaW1wb3J0IHsgZ2V0TG9nZ2VyIH0gZnJvbSBcIi4uLy4uLy4uL2RlcHMudHNcIjtcbmltcG9ydCB7IFBhY2tldCwgUGFja2V0VHlwZSwgUmF3RGF0YSB9IGZyb20gXCIuLi8uLi9lbmdpbmUuaW8tcGFyc2VyL21vZC50c1wiO1xuaW1wb3J0IHsgVHJhbnNwb3J0LCBUcmFuc3BvcnRFcnJvciB9IGZyb20gXCIuL3RyYW5zcG9ydC50c1wiO1xuaW1wb3J0IHsgU2VydmVyT3B0aW9ucyB9IGZyb20gXCIuL3NlcnZlci50c1wiO1xuXG50eXBlIFJlYWR5U3RhdGUgPSBcIm9wZW5pbmdcIiB8IFwib3BlblwiIHwgXCJjbG9zaW5nXCIgfCBcImNsb3NlZFwiO1xuXG50eXBlIFVwZ3JhZGVTdGF0ZSA9IFwibm90X3VwZ3JhZGVkXCIgfCBcInVwZ3JhZGluZ1wiIHwgXCJ1cGdyYWRlZFwiO1xuXG5leHBvcnQgdHlwZSBDbG9zZVJlYXNvbiA9XG4gIHwgXCJ0cmFuc3BvcnQgZXJyb3JcIlxuICB8IFwidHJhbnNwb3J0IGNsb3NlXCJcbiAgfCBcImZvcmNlZCBjbG9zZVwiXG4gIHwgXCJwaW5nIHRpbWVvdXRcIlxuICB8IFwicGFyc2UgZXJyb3JcIjtcblxuaW50ZXJmYWNlIFNvY2tldEV2ZW50cyB7XG4gIG9wZW46ICgpID0+IHZvaWQ7XG4gIHBhY2tldDogKHBhY2tldDogUGFja2V0KSA9PiB2b2lkO1xuICBwYWNrZXRDcmVhdGU6IChwYWNrZXQ6IFBhY2tldCkgPT4gdm9pZDtcbiAgbWVzc2FnZTogKG1lc3NhZ2U6IFJhd0RhdGEpID0+IHZvaWQ7XG4gIGZsdXNoOiAod3JpdGVCdWZmZXI6IFBhY2tldFtdKSA9PiB2b2lkO1xuICBkcmFpbjogKCkgPT4gdm9pZDtcbiAgaGVhcnRiZWF0OiAoKSA9PiB2b2lkO1xuICB1cGdyYWRpbmc6ICh0cmFuc3BvcnQ6IFRyYW5zcG9ydCkgPT4gdm9pZDtcbiAgdXBncmFkZTogKHRyYW5zcG9ydDogVHJhbnNwb3J0KSA9PiB2b2lkO1xuICBjbG9zZTogKHJlYXNvbjogQ2xvc2VSZWFzb24pID0+IHZvaWQ7XG59XG5cbmNvbnN0IEZBU1RfVVBHUkFERV9JTlRFUlZBTF9NUyA9IDEwMDtcblxuZXhwb3J0IGNsYXNzIFNvY2tldCBleHRlbmRzIEV2ZW50RW1pdHRlcjxcbiAgUmVjb3JkPG5ldmVyLCBuZXZlcj4sXG4gIFJlY29yZDxuZXZlciwgbmV2ZXI+LFxuICBTb2NrZXRFdmVudHNcbj4ge1xuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcbiAgcHVibGljIHJlYWR5U3RhdGU6IFJlYWR5U3RhdGUgPSBcIm9wZW5pbmdcIjtcbiAgcHVibGljIHRyYW5zcG9ydDogVHJhbnNwb3J0O1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgb3B0czogU2VydmVyT3B0aW9ucztcbiAgcHJpdmF0ZSB1cGdyYWRlU3RhdGU6IFVwZ3JhZGVTdGF0ZSA9IFwibm90X3VwZ3JhZGVkXCI7XG4gIHByaXZhdGUgd3JpdGVCdWZmZXI6IFBhY2tldFtdID0gW107XG4gIHByaXZhdGUgcGluZ0ludGVydmFsVGltZXJJZD86IG51bWJlcjtcbiAgcHJpdmF0ZSBwaW5nVGltZW91dFRpbWVySWQ/OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgb3B0czogU2VydmVyT3B0aW9ucywgdHJhbnNwb3J0OiBUcmFuc3BvcnQpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5pZCA9IGlkO1xuICAgIHRoaXMub3B0cyA9IG9wdHM7XG5cbiAgICB0aGlzLnRyYW5zcG9ydCA9IHRyYW5zcG9ydDtcbiAgICB0aGlzLmJpbmRUcmFuc3BvcnQodHJhbnNwb3J0KTtcbiAgICB0aGlzLm9uT3BlbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBjb25zaWRlcmVkIG9wZW4uXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIG9uT3BlbigpIHtcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBcIm9wZW5cIjtcblxuICAgIHRoaXMuc2VuZFBhY2tldChcbiAgICAgIFwib3BlblwiLFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzaWQ6IHRoaXMuaWQsXG4gICAgICAgIHVwZ3JhZGVzOiB0aGlzLnRyYW5zcG9ydC51cGdyYWRlc1RvLFxuICAgICAgICBwaW5nSW50ZXJ2YWw6IHRoaXMub3B0cy5waW5nSW50ZXJ2YWwsXG4gICAgICAgIHBpbmdUaW1lb3V0OiB0aGlzLm9wdHMucGluZ1RpbWVvdXQsXG4gICAgICAgIG1heFBheWxvYWQ6IHRoaXMub3B0cy5tYXhIdHRwQnVmZmVyU2l6ZSxcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLmVtaXRSZXNlcnZlZChcIm9wZW5cIik7XG4gICAgdGhpcy5zY2hlZHVsZVBpbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsZWQgdXBvbiB0cmFuc3BvcnQgcGFja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gcGFja2V0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIG9uUGFja2V0KHBhY2tldDogUGFja2V0KSB7XG4gICAgaWYgKHRoaXMucmVhZHlTdGF0ZSAhPT0gXCJvcGVuXCIpIHtcbiAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgXCJbc29ja2V0XSBwYWNrZXQgcmVjZWl2ZWQgd2l0aCBjbG9zZWQgc29ja2V0XCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhgW3NvY2tldF0gcmVjZWl2ZWQgcGFja2V0ICR7cGFja2V0LnR5cGV9YCk7XG5cbiAgICB0aGlzLmVtaXRSZXNlcnZlZChcInBhY2tldFwiLCBwYWNrZXQpO1xuXG4gICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuICAgICAgY2FzZSBcInBvbmdcIjpcbiAgICAgICAgZ2V0TG9nZ2VyKFwiZW5naW5lLmlvXCIpLmRlYnVnKFwiW3NvY2tldF0gZ290IHBvbmdcIik7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucGluZ1RpbWVvdXRUaW1lcklkKTtcbiAgICAgICAgdGhpcy5zY2hlZHVsZVBpbmcoKTtcblxuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImhlYXJ0YmVhdFwiKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgXCJtZXNzYWdlXCI6XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwibWVzc2FnZVwiLCBwYWNrZXQuZGF0YSEpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcImVycm9yXCI6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLm9uQ2xvc2UoXCJwYXJzZSBlcnJvclwiKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBlcnJvci5cbiAgICpcbiAgICogQHBhcmFtIGVyclxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBvbkVycm9yKGVycjogVHJhbnNwb3J0RXJyb3IpIHtcbiAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoYFtzb2NrZXRdIHRyYW5zcG9ydCBlcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICB0aGlzLm9uQ2xvc2UoXCJ0cmFuc3BvcnQgZXJyb3JcIik7XG4gIH1cblxuICAvKipcbiAgICogUGluZ3MgY2xpZW50IGV2ZXJ5IGBwaW5nSW50ZXJ2YWxgIGFuZCBleHBlY3RzIHJlc3BvbnNlXG4gICAqIHdpdGhpbiBgcGluZ1RpbWVvdXRgIG9yIGNsb3NlcyBjb25uZWN0aW9uLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBzY2hlZHVsZVBpbmcoKSB7XG4gICAgdGhpcy5waW5nSW50ZXJ2YWxUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXG4gICAgICAgIGBbc29ja2V0XSB3cml0aW5nIHBpbmcgcGFja2V0IC0gZXhwZWN0aW5nIHBvbmcgd2l0aGluICR7dGhpcy5vcHRzLnBpbmdUaW1lb3V0fSBtc2AsXG4gICAgICAgIHRoaXMub3B0cy5waW5nVGltZW91dCxcbiAgICAgICk7XG4gICAgICB0aGlzLnNlbmRQYWNrZXQoXCJwaW5nXCIpO1xuICAgICAgdGhpcy5yZXNldFBpbmdUaW1lb3V0KCk7XG4gICAgfSwgdGhpcy5vcHRzLnBpbmdJbnRlcnZhbCk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXRzIHBpbmcgdGltZW91dC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgcmVzZXRQaW5nVGltZW91dCgpIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5waW5nVGltZW91dFRpbWVySWQpO1xuICAgIHRoaXMucGluZ1RpbWVvdXRUaW1lcklkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5yZWFkeVN0YXRlICE9PSBcImNsb3NlZFwiKSB7XG4gICAgICAgIHRoaXMub25DbG9zZShcInBpbmcgdGltZW91dFwiKTtcbiAgICAgIH1cbiAgICB9LCB0aGlzLm9wdHMucGluZ1RpbWVvdXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGFjaGVzIGhhbmRsZXJzIGZvciB0aGUgZ2l2ZW4gdHJhbnNwb3J0LlxuICAgKlxuICAgKiBAcGFyYW0gdHJhbnNwb3J0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGJpbmRUcmFuc3BvcnQodHJhbnNwb3J0OiBUcmFuc3BvcnQpIHtcbiAgICB0aGlzLnRyYW5zcG9ydCA9IHRyYW5zcG9ydDtcbiAgICB0aGlzLnRyYW5zcG9ydC5vbmNlKFwiZXJyb3JcIiwgKGVycikgPT4gdGhpcy5vbkVycm9yKGVycikpO1xuICAgIHRoaXMudHJhbnNwb3J0Lm9uKFwicGFja2V0XCIsIChwYWNrZXQpID0+IHRoaXMub25QYWNrZXQocGFja2V0KSk7XG4gICAgdGhpcy50cmFuc3BvcnQub24oXCJkcmFpblwiLCAoKSA9PiB0aGlzLmZsdXNoKCkpO1xuICAgIHRoaXMudHJhbnNwb3J0Lm9uKFwiY2xvc2VcIiwgKCkgPT4gdGhpcy5vbkNsb3NlKFwidHJhbnNwb3J0IGNsb3NlXCIpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGdyYWRlcyBzb2NrZXQgdG8gdGhlIGdpdmVuIHRyYW5zcG9ydFxuICAgKlxuICAgKiBAcGFyYW0gdHJhbnNwb3J0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICAvKiBwcml2YXRlICovIF9tYXliZVVwZ3JhZGUodHJhbnNwb3J0OiBUcmFuc3BvcnQpIHtcbiAgICBpZiAodGhpcy51cGdyYWRlU3RhdGUgPT09IFwidXBncmFkaW5nXCIpIHtcbiAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgXCJbc29ja2V0XSB0cmFuc3BvcnQgaGFzIGFscmVhZHkgYmVlbiB0cnlpbmcgdG8gdXBncmFkZVwiLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cmFuc3BvcnQuY2xvc2UoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudXBncmFkZVN0YXRlID09PSBcInVwZ3JhZGVkXCIpIHtcbiAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgXCJbc29ja2V0XSB0cmFuc3BvcnQgaGFzIGFscmVhZHkgYmVlbiB1cGdyYWRlZFwiLFxuICAgICAgKTtcbiAgICAgIHJldHVybiB0cmFuc3BvcnQuY2xvc2UoKTtcbiAgICB9XG5cbiAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXCJbc29ja2V0XSB1cGdyYWRpbmcgZXhpc3RpbmcgdHJhbnNwb3J0XCIpO1xuICAgIHRoaXMudXBncmFkZVN0YXRlID0gXCJ1cGdyYWRpbmdcIjtcblxuICAgIGNvbnN0IHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZ2V0TG9nZ2VyKFwiZW5naW5lLmlvXCIpLmRlYnVnKFxuICAgICAgICBcIltzb2NrZXRdIGNsaWVudCBkaWQgbm90IGNvbXBsZXRlIHVwZ3JhZGUgLSBjbG9zaW5nIHRyYW5zcG9ydFwiLFxuICAgICAgKTtcbiAgICAgIHRyYW5zcG9ydC5jbG9zZSgpO1xuICAgIH0sIHRoaXMub3B0cy51cGdyYWRlVGltZW91dCk7XG5cbiAgICB0cmFuc3BvcnQub24oXCJjbG9zZVwiLCAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKGZhc3RVcGdyYWRlVGltZXJJZCk7XG4gICAgICB0cmFuc3BvcnQub2ZmKCk7XG4gICAgfSk7XG5cbiAgICBsZXQgZmFzdFVwZ3JhZGVUaW1lcklkOiBudW1iZXI7XG5cbiAgICAvLyB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IG5vIHBhY2tldHMgZ2V0cyBsb3N0IGR1cmluZyB0aGUgdXBncmFkZSwgc28gdGhlIGNsaWVudCBkb2VzIG5vdCBjYW5jZWwgdGhlIEhUVFBcbiAgICAvLyBsb25nLXBvbGxpbmcgcmVxdWVzdCBpdHNlbGYsIGluc3RlYWQgdGhlIHNlcnZlciBzZW5kcyBhIFwibm9vcFwiIHBhY2tldCB0byBjbGVhbmx5IGVuZCBhbnkgb25nb2luZyBwb2xsaW5nIHJlcXVlc3RcbiAgICBjb25zdCBzZW5kTm9vcFBhY2tldCA9ICgpID0+IHtcbiAgICAgIGlmICh0aGlzLnRyYW5zcG9ydC5uYW1lID09PSBcInBvbGxpbmdcIiAmJiB0aGlzLnRyYW5zcG9ydC53cml0YWJsZSkge1xuICAgICAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXG4gICAgICAgICAgXCJbc29ja2V0XSB3cml0aW5nIGEgbm9vcCBwYWNrZXQgdG8gcG9sbGluZyBmb3IgZmFzdCB1cGdyYWRlXCIsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMudHJhbnNwb3J0LnNlbmQoW3sgdHlwZTogXCJub29wXCIgfV0pO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0cmFuc3BvcnQub24oXCJwYWNrZXRcIiwgKHBhY2tldCkgPT4ge1xuICAgICAgaWYgKHBhY2tldC50eXBlID09PSBcInBpbmdcIiAmJiBwYWNrZXQuZGF0YSA9PT0gXCJwcm9iZVwiKSB7XG4gICAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgICBcIltzb2NrZXRdIGdvdCBwcm9iZSBwaW5nIHBhY2tldCwgc2VuZGluZyBwb25nXCIsXG4gICAgICAgICk7XG4gICAgICAgIHRyYW5zcG9ydC5zZW5kKFt7IHR5cGU6IFwicG9uZ1wiLCBkYXRhOiBcInByb2JlXCIgfV0pO1xuXG4gICAgICAgIHNlbmROb29wUGFja2V0KCk7XG4gICAgICAgIGZhc3RVcGdyYWRlVGltZXJJZCA9IHNldEludGVydmFsKFxuICAgICAgICAgIHNlbmROb29wUGFja2V0LFxuICAgICAgICAgIEZBU1RfVVBHUkFERV9JTlRFUlZBTF9NUyxcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcInVwZ3JhZGluZ1wiLCB0cmFuc3BvcnQpO1xuICAgICAgfSBlbHNlIGlmIChwYWNrZXQudHlwZSA9PT0gXCJ1cGdyYWRlXCIgJiYgdGhpcy5yZWFkeVN0YXRlICE9PSBcImNsb3NlZFwiKSB7XG4gICAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcIltzb2NrZXRdIGdvdCB1cGdyYWRlIHBhY2tldCAtIHVwZ3JhZGluZ1wiKTtcblxuICAgICAgICB0aGlzLnVwZ3JhZGVTdGF0ZSA9IFwidXBncmFkZWRcIjtcblxuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbChmYXN0VXBncmFkZVRpbWVySWQpO1xuICAgICAgICB0cmFuc3BvcnQub2ZmKCk7XG4gICAgICAgIHRoaXMuY2xvc2VUcmFuc3BvcnQoKTtcbiAgICAgICAgdGhpcy5iaW5kVHJhbnNwb3J0KHRyYW5zcG9ydCk7XG5cbiAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJ1cGdyYWRlXCIsIHRyYW5zcG9ydCk7XG4gICAgICAgIHRoaXMuZmx1c2goKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcIltzb2NrZXRdIGludmFsaWQgdXBncmFkZSBwYWNrZXRcIik7XG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgIHRyYW5zcG9ydC5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBjb25zaWRlcmVkIGNsb3NlZC5cbiAgICpcbiAgICogQHBhcmFtIHJlYXNvblxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBvbkNsb3NlKHJlYXNvbjogQ2xvc2VSZWFzb24pIHtcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSBcImNsb3NlZFwiKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhgW3NvY2tldF0gc29ja2V0IGNsb3NlZCBkdWUgdG8gJHtyZWFzb259YCk7XG5cbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBcImNsb3NlZFwiO1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnBpbmdJbnRlcnZhbFRpbWVySWQpO1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0VGltZXJJZCk7XG5cbiAgICB0aGlzLmNsb3NlVHJhbnNwb3J0KCk7XG4gICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJjbG9zZVwiLCByZWFzb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmRzIGEgXCJtZXNzYWdlXCIgcGFja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gZGF0YVxuICAgKi9cbiAgcHVibGljIHNlbmQoZGF0YTogUmF3RGF0YSk6IFNvY2tldCB7XG4gICAgdGhpcy5zZW5kUGFja2V0KFwibWVzc2FnZVwiLCBkYXRhKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kcyBhIHBhY2tldC5cbiAgICpcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIGRhdGFcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgc2VuZFBhY2tldChcbiAgICB0eXBlOiBQYWNrZXRUeXBlLFxuICAgIGRhdGE/OiBSYXdEYXRhLFxuICApIHtcbiAgICBpZiAoW1wiY2xvc2luZ1wiLCBcImNsb3NlZFwiXS5pbmNsdWRlcyh0aGlzLnJlYWR5U3RhdGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZ2V0TG9nZ2VyKFwiZW5naW5lLmlvXCIpLmRlYnVnKGBbc29ja2V0XSBzZW5kaW5nIHBhY2tldCAke3R5cGV9ICgke2RhdGF9KWApO1xuXG4gICAgY29uc3QgcGFja2V0OiBQYWNrZXQgPSB7XG4gICAgICB0eXBlLFxuICAgICAgZGF0YSxcbiAgICB9O1xuXG4gICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJwYWNrZXRDcmVhdGVcIiwgcGFja2V0KTtcblxuICAgIHRoaXMud3JpdGVCdWZmZXIucHVzaChwYWNrZXQpO1xuXG4gICAgdGhpcy5mbHVzaCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEF0dGVtcHRzIHRvIGZsdXNoIHRoZSBwYWNrZXRzIGJ1ZmZlci5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgZmx1c2goKSB7XG4gICAgY29uc3Qgc2hvdWxkRmx1c2ggPSB0aGlzLnJlYWR5U3RhdGUgIT09IFwiY2xvc2VkXCIgJiZcbiAgICAgIHRoaXMudHJhbnNwb3J0LndyaXRhYmxlICYmXG4gICAgICB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCA+IDA7XG5cbiAgICBpZiAoIXNob3VsZEZsdXNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZ2V0TG9nZ2VyKFwiZW5naW5lLmlvXCIpLmRlYnVnKFxuICAgICAgYFtzb2NrZXRdIGZsdXNoaW5nIGJ1ZmZlciB3aXRoICR7dGhpcy53cml0ZUJ1ZmZlci5sZW5ndGh9IHBhY2tldChzKSB0byB0cmFuc3BvcnRgLFxuICAgICk7XG5cbiAgICB0aGlzLmVtaXRSZXNlcnZlZChcImZsdXNoXCIsIHRoaXMud3JpdGVCdWZmZXIpO1xuXG4gICAgY29uc3QgYnVmZmVyID0gdGhpcy53cml0ZUJ1ZmZlcjtcbiAgICB0aGlzLndyaXRlQnVmZmVyID0gW107XG5cbiAgICB0aGlzLnRyYW5zcG9ydC5zZW5kKGJ1ZmZlcik7XG4gICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJkcmFpblwiKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZXMgdGhlIHNvY2tldCBhbmQgdW5kZXJseWluZyB0cmFuc3BvcnQuXG4gICAqL1xuICBwdWJsaWMgY2xvc2UoKSB7XG4gICAgaWYgKHRoaXMucmVhZHlTdGF0ZSAhPT0gXCJvcGVuXCIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBcImNsb3NpbmdcIjtcblxuICAgIGNvbnN0IGNsb3NlID0gKCkgPT4ge1xuICAgICAgdGhpcy5jbG9zZVRyYW5zcG9ydCgpO1xuICAgICAgdGhpcy5vbkNsb3NlKFwiZm9yY2VkIGNsb3NlXCIpO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgIGdldExvZ2dlcihcImVuZ2luZS5pb1wiKS5kZWJ1ZyhcbiAgICAgICAgYFtzb2NrZXRdIGJ1ZmZlciBub3QgZW1wdHksIHdhaXRpbmcgZm9yIHRoZSBkcmFpbiBldmVudGAsXG4gICAgICApO1xuICAgICAgdGhpcy5vbmNlKFwiZHJhaW5cIiwgY2xvc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjbG9zZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbG9zZXMgdGhlIHVuZGVybHlpbmcgdHJhbnNwb3J0LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBjbG9zZVRyYW5zcG9ydCgpIHtcbiAgICB0aGlzLnRyYW5zcG9ydC5vZmYoKTtcbiAgICB0aGlzLnRyYW5zcG9ydC5jbG9zZSgpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxZQUFZLFFBQVEsNkJBQTZCO0FBQzFELFNBQVMsU0FBUyxRQUFRLG1CQUFtQjtBQTZCN0MsTUFBTSwyQkFBMkI7QUFFakMsT0FBTyxNQUFNLGVBQWU7RUFLVixHQUFXO0VBQ3BCLGFBQXlCLFVBQVU7RUFDbkMsVUFBcUI7RUFFWCxLQUFvQjtFQUM3QixlQUE2QixlQUFlO0VBQzVDLGNBQXdCLEVBQUUsQ0FBQztFQUMzQixvQkFBNkI7RUFDN0IsbUJBQTRCO0VBRXBDLFlBQVksRUFBVSxFQUFFLElBQW1CLEVBQUUsU0FBb0IsQ0FBRTtJQUNqRSxLQUFLO0lBRUwsSUFBSSxDQUFDLEVBQUUsR0FBRztJQUNWLElBQUksQ0FBQyxJQUFJLEdBQUc7SUFFWixJQUFJLENBQUMsU0FBUyxHQUFHO0lBQ2pCLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDbkIsSUFBSSxDQUFDLE1BQU07RUFDYjtFQUVBOzs7O0dBSUMsR0FDRCxBQUFRLFNBQVM7SUFDZixJQUFJLENBQUMsVUFBVSxHQUFHO0lBRWxCLElBQUksQ0FBQyxVQUFVLENBQ2IsUUFDQSxLQUFLLFNBQVMsQ0FBQztNQUNiLEtBQUssSUFBSSxDQUFDLEVBQUU7TUFDWixVQUFVLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVTtNQUNuQyxjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWTtNQUNwQyxhQUFhLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVztNQUNsQyxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0lBQ3pDO0lBR0YsSUFBSSxDQUFDLFlBQVksQ0FBQztJQUNsQixJQUFJLENBQUMsWUFBWTtFQUNuQjtFQUVBOzs7OztHQUtDLEdBQ0QsQUFBUSxTQUFTLE1BQWMsRUFB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
// denoCacheMetadata=3140925045229054832,13815857705490073533