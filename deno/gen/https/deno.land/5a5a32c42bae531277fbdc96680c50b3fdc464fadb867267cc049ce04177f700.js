import { getLogger } from "../../../../deps.ts";
import { Transport } from "../transport.ts";
import { Parser } from "../../../engine.io-parser/mod.ts";
export class WS extends Transport {
  socket;
  get name() {
    return "websocket";
  }
  get upgradesTo() {
    return [];
  }
  send(packets) {
    for (const packet of packets){
      Parser.encodePacket(packet, true, (data)=>{
        if (this.writable && this.socket?.readyState === WebSocket.OPEN) {
          this.socket?.send(data);
        }
      });
    }
  }
  onRequest(req) {
    const { socket, response } = Deno.upgradeWebSocket(req);
    this.socket = socket;
    socket.onopen = ()=>{
      getLogger("engine.io").debug("[websocket] transport is now writable");
      this.writable = true;
      this.emitReserved("drain");
    };
    socket.onmessage = ({ data })=>{
      // note: we use the length of the string here, which might be different from the number of bytes (up to 4 bytes)
      const byteLength = typeof data === "string" ? data.length : data.byteLength;
      if (byteLength > this.opts.maxHttpBufferSize) {
        return this.onError("payload too large");
      } else {
        this.onData(data);
      }
    };
    socket.onclose = (closeEvent)=>{
      getLogger("engine.io").debug(`[websocket] onclose with code ${closeEvent.code}`);
      this.writable = false;
      this.onClose();
    };
    // note: response.headers is immutable, so it seems we can't add headers here
    return Promise.resolve(response);
  }
  doClose() {
    this.socket?.close();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvc29ja2V0X2lvQDAuMi4xL3BhY2thZ2VzL2VuZ2luZS5pby9saWIvdHJhbnNwb3J0cy93ZWJzb2NrZXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZ2V0TG9nZ2VyIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2RlcHMudHNcIjtcbmltcG9ydCB7IFRyYW5zcG9ydCB9IGZyb20gXCIuLi90cmFuc3BvcnQudHNcIjtcbmltcG9ydCB7IFBhY2tldCwgUGFyc2VyLCBSYXdEYXRhIH0gZnJvbSBcIi4uLy4uLy4uL2VuZ2luZS5pby1wYXJzZXIvbW9kLnRzXCI7XG5cbmV4cG9ydCBjbGFzcyBXUyBleHRlbmRzIFRyYW5zcG9ydCB7XG4gIHByaXZhdGUgc29ja2V0PzogV2ViU29ja2V0O1xuXG4gIHB1YmxpYyBnZXQgbmFtZSgpIHtcbiAgICByZXR1cm4gXCJ3ZWJzb2NrZXRcIjtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgdXBncmFkZXNUbygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcHVibGljIHNlbmQocGFja2V0czogUGFja2V0W10pIHtcbiAgICBmb3IgKGNvbnN0IHBhY2tldCBvZiBwYWNrZXRzKSB7XG4gICAgICBQYXJzZXIuZW5jb2RlUGFja2V0KHBhY2tldCwgdHJ1ZSwgKGRhdGE6IFJhd0RhdGEpID0+IHtcbiAgICAgICAgaWYgKHRoaXMud3JpdGFibGUgJiYgdGhpcy5zb2NrZXQ/LnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XG4gICAgICAgICAgdGhpcy5zb2NrZXQ/LnNlbmQoZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBvblJlcXVlc3QocmVxOiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICAgIGNvbnN0IHsgc29ja2V0LCByZXNwb25zZSB9ID0gRGVuby51cGdyYWRlV2ViU29ja2V0KHJlcSk7XG5cbiAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcblxuICAgIHNvY2tldC5vbm9wZW4gPSAoKSA9PiB7XG4gICAgICBnZXRMb2dnZXIoXCJlbmdpbmUuaW9cIikuZGVidWcoXG4gICAgICAgIFwiW3dlYnNvY2tldF0gdHJhbnNwb3J0IGlzIG5vdyB3cml0YWJsZVwiLFxuICAgICAgKTtcbiAgICAgIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJkcmFpblwiKTtcbiAgICB9O1xuXG4gICAgc29ja2V0Lm9ubWVzc2FnZSA9ICh7IGRhdGEgfSkgPT4ge1xuICAgICAgLy8gbm90ZTogd2UgdXNlIHRoZSBsZW5ndGggb2YgdGhlIHN0cmluZyBoZXJlLCB3aGljaCBtaWdodCBiZSBkaWZmZXJlbnQgZnJvbSB0aGUgbnVtYmVyIG9mIGJ5dGVzICh1cCB0byA0IGJ5dGVzKVxuICAgICAgY29uc3QgYnl0ZUxlbmd0aCA9IHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiXG4gICAgICAgID8gZGF0YS5sZW5ndGhcbiAgICAgICAgOiBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBpZiAoYnl0ZUxlbmd0aCA+IHRoaXMub3B0cy5tYXhIdHRwQnVmZmVyU2l6ZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5vbkVycm9yKFwicGF5bG9hZCB0b28gbGFyZ2VcIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9uRGF0YShkYXRhKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgc29ja2V0Lm9uY2xvc2UgPSAoY2xvc2VFdmVudCkgPT4ge1xuICAgICAgZ2V0TG9nZ2VyKFwiZW5naW5lLmlvXCIpLmRlYnVnKFxuICAgICAgICBgW3dlYnNvY2tldF0gb25jbG9zZSB3aXRoIGNvZGUgJHtjbG9zZUV2ZW50LmNvZGV9YCxcbiAgICAgICk7XG4gICAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG4gICAgICB0aGlzLm9uQ2xvc2UoKTtcbiAgICB9O1xuXG4gICAgLy8gbm90ZTogcmVzcG9uc2UuaGVhZGVycyBpcyBpbW11dGFibGUsIHNvIGl0IHNlZW1zIHdlIGNhbid0IGFkZCBoZWFkZXJzIGhlcmVcblxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGRvQ2xvc2UoKSB7XG4gICAgdGhpcy5zb2NrZXQ/LmNsb3NlKCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSxzQkFBc0I7QUFDaEQsU0FBUyxTQUFTLFFBQVEsa0JBQWtCO0FBQzVDLFNBQWlCLE1BQU0sUUFBaUIsbUNBQW1DO0FBRTNFLE9BQU8sTUFBTSxXQUFXO0VBQ2QsT0FBbUI7RUFFM0IsSUFBVyxPQUFPO0lBQ2hCLE9BQU87RUFDVDtFQUVBLElBQVcsYUFBdUI7SUFDaEMsT0FBTyxFQUFFO0VBQ1g7RUFFTyxLQUFLLE9BQWlCLEVBQUU7SUFDN0IsS0FBSyxNQUFNLFVBQVUsUUFBUztNQUM1QixPQUFPLFlBQVksQ0FBQyxRQUFRLE1BQU0sQ0FBQztRQUNqQyxJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxlQUFlLFVBQVUsSUFBSSxFQUFFO1VBQy9ELElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSztRQUNwQjtNQUNGO0lBQ0Y7RUFDRjtFQUVPLFVBQVUsR0FBWSxFQUFxQjtJQUNoRCxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxHQUFHLEtBQUssZ0JBQWdCLENBQUM7SUFFbkQsSUFBSSxDQUFDLE1BQU0sR0FBRztJQUVkLE9BQU8sTUFBTSxHQUFHO01BQ2QsVUFBVSxhQUFhLEtBQUssQ0FDMUI7TUFFRixJQUFJLENBQUMsUUFBUSxHQUFHO01BQ2hCLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDcEI7SUFFQSxPQUFPLFNBQVMsR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFO01BQzFCLGdIQUFnSDtNQUNoSCxNQUFNLGFBQWEsT0FBTyxTQUFTLFdBQy9CLEtBQUssTUFBTSxHQUNYLEtBQUssVUFBVTtNQUNuQixJQUFJLGFBQWEsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtRQUM1QyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7TUFDdEIsT0FBTztRQUNMLElBQUksQ0FBQyxNQUFNLENBQUM7TUFDZDtJQUNGO0lBRUEsT0FBTyxPQUFPLEdBQUcsQ0FBQztNQUNoQixVQUFVLGFBQWEsS0FBSyxDQUMxQixDQUFDLDhCQUE4QixFQUFFLFdBQVcsSUFBSSxFQUFFO01BRXBELElBQUksQ0FBQyxRQUFRLEdBQUc7TUFDaEIsSUFBSSxDQUFDLE9BQU87SUFDZDtJQUVBLDZFQUE2RTtJQUU3RSxPQUFPLFFBQVEsT0FBTyxDQUFDO0VBQ3pCO0VBRVUsVUFBVTtJQUNsQixJQUFJLENBQUMsTUFBTSxFQUFFO0VBQ2Y7QUFDRiJ9
// denoCacheMetadata=10574485302495976313,2254327890871898395