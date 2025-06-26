// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/* Resolves after the given number of milliseconds. */ export function delay(ms, options = {}) {
  const { signal, persistent } = options;
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Delay was aborted.", "AbortError"));
  }
  return new Promise((resolve, reject)=>{
    const abort = ()=>{
      clearTimeout(i);
      reject(new DOMException("Delay was aborted.", "AbortError"));
    };
    const done = ()=>{
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const i = setTimeout(done, ms);
    signal?.addEventListener("abort", abort, {
      once: true
    });
    if (persistent === false) {
      try {
        // @ts-ignore For browser compatibility
        Deno.unrefTimer(i);
      } catch (error) {
        if (!(error instanceof ReferenceError)) {
          throw error;
        }
        console.error("`persistent` option is only available in Deno");
      }
    }
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE1OC4wL2FzeW5jL2RlbGF5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVsYXlPcHRpb25zIHtcbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG4gIC8qKiBJbmRpY2F0ZXMgd2hldGhlciB0aGUgcHJvY2VzcyBzaG91bGQgY29udGludWUgdG8gcnVuIGFzIGxvbmcgYXMgdGhlIHRpbWVyIGV4aXN0cy4gVGhpcyBpcyBgdHJ1ZWAgYnkgZGVmYXVsdC4gKi9cbiAgcGVyc2lzdGVudD86IGJvb2xlYW47XG59XG5cbi8qIFJlc29sdmVzIGFmdGVyIHRoZSBnaXZlbiBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIsIG9wdGlvbnM6IERlbGF5T3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHsgc2lnbmFsLCBwZXJzaXN0ZW50IH0gPSBvcHRpb25zO1xuICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBET01FeGNlcHRpb24oXCJEZWxheSB3YXMgYWJvcnRlZC5cIiwgXCJBYm9ydEVycm9yXCIpKTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGFib3J0ID0gKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KGkpO1xuICAgICAgcmVqZWN0KG5ldyBET01FeGNlcHRpb24oXCJEZWxheSB3YXMgYWJvcnRlZC5cIiwgXCJBYm9ydEVycm9yXCIpKTtcbiAgICB9O1xuICAgIGNvbnN0IGRvbmUgPSAoKSA9PiB7XG4gICAgICBzaWduYWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydCk7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfTtcbiAgICBjb25zdCBpID0gc2V0VGltZW91dChkb25lLCBtcyk7XG4gICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnQsIHsgb25jZTogdHJ1ZSB9KTtcbiAgICBpZiAocGVyc2lzdGVudCA9PT0gZmFsc2UpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmUgRm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eVxuICAgICAgICBEZW5vLnVucmVmVGltZXIoaSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoIShlcnJvciBpbnN0YW5jZW9mIFJlZmVyZW5jZUVycm9yKSkge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJgcGVyc2lzdGVudGAgb3B0aW9uIGlzIG9ubHkgYXZhaWxhYmxlIGluIERlbm9cIik7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBUXJDLG9EQUFvRCxHQUNwRCxPQUFPLFNBQVMsTUFBTSxFQUFVLEVBQUUsVUFBd0IsQ0FBQyxDQUFDO0VBQzFELE1BQU0sRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLEdBQUc7RUFDL0IsSUFBSSxRQUFRLFNBQVM7SUFDbkIsT0FBTyxRQUFRLE1BQU0sQ0FBQyxJQUFJLGFBQWEsc0JBQXNCO0VBQy9EO0VBQ0EsT0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTO0lBQzNCLE1BQU0sUUFBUTtNQUNaLGFBQWE7TUFDYixPQUFPLElBQUksYUFBYSxzQkFBc0I7SUFDaEQ7SUFDQSxNQUFNLE9BQU87TUFDWCxRQUFRLG9CQUFvQixTQUFTO01BQ3JDO0lBQ0Y7SUFDQSxNQUFNLElBQUksV0FBVyxNQUFNO0lBQzNCLFFBQVEsaUJBQWlCLFNBQVMsT0FBTztNQUFFLE1BQU07SUFBSztJQUN0RCxJQUFJLGVBQWUsT0FBTztNQUN4QixJQUFJO1FBQ0YsdUNBQXVDO1FBQ3ZDLEtBQUssVUFBVSxDQUFDO01BQ2xCLEVBQUUsT0FBTyxPQUFPO1FBQ2QsSUFBSSxDQUFDLENBQUMsaUJBQWlCLGNBQWMsR0FBRztVQUN0QyxNQUFNO1FBQ1I7UUFDQSxRQUFRLEtBQUssQ0FBQztNQUNoQjtJQUNGO0VBQ0Y7QUFDRiJ9
// denoCacheMetadata=10274968438927474964,7389425963561153656