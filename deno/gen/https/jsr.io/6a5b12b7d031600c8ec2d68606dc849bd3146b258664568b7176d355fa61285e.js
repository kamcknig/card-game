import { AbortError } from '../error/AbortError.ts';
/**
 * Delays the execution of code for a specified number of milliseconds.
 *
 * This function returns a Promise that resolves after the specified delay, allowing you to use it
 * with async/await to pause execution.
 *
 * @param {number} ms - The number of milliseconds to delay.
 * @param {DelayOptions} options - The options object.
 * @param {AbortSignal} options.signal - An optional AbortSignal to cancel the delay.
 * @returns {Promise<void>} A Promise that resolves after the specified delay.
 *
 * @example
 * async function foo() {
 *   console.log('Start');
 *   await delay(1000); // Delays execution for 1 second
 *   console.log('End');
 * }
 *
 * foo();
 *
 * // With AbortSignal
 * const controller = new AbortController();
 * const { signal } = controller;
 *
 * setTimeout(() => controller.abort(), 50); // Will cancel the delay after 50ms
 * try {
 *   await delay(100, { signal });
 *  } catch (error) {
 *   console.error(error); // Will log 'AbortError'
 *  }
 * }
 */ export function delay(ms, { signal } = {}) {
  return new Promise((resolve, reject)=>{
    const abortError = ()=>{
      reject(new AbortError());
    };
    const abortHandler = ()=>{
      clearTimeout(timeoutId);
      abortError();
    };
    if (signal?.aborted) {
      return abortError();
    }
    const timeoutId = setTimeout(()=>{
      signal?.removeEventListener('abort', abortHandler);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abortHandler, {
      once: true
    });
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcm9taXNlL2RlbGF5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFib3J0RXJyb3IgfSBmcm9tICcuLi9lcnJvci9BYm9ydEVycm9yLnRzJztcblxuaW50ZXJmYWNlIERlbGF5T3B0aW9ucyB7XG4gIHNpZ25hbD86IEFib3J0U2lnbmFsO1xufVxuXG4vKipcbiAqIERlbGF5cyB0aGUgZXhlY3V0aW9uIG9mIGNvZGUgZm9yIGEgc3BlY2lmaWVkIG51bWJlciBvZiBtaWxsaXNlY29uZHMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiByZXR1cm5zIGEgUHJvbWlzZSB0aGF0IHJlc29sdmVzIGFmdGVyIHRoZSBzcGVjaWZpZWQgZGVsYXksIGFsbG93aW5nIHlvdSB0byB1c2UgaXRcbiAqIHdpdGggYXN5bmMvYXdhaXQgdG8gcGF1c2UgZXhlY3V0aW9uLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyfSBtcyAtIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIGRlbGF5LlxuICogQHBhcmFtIHtEZWxheU9wdGlvbnN9IG9wdGlvbnMgLSBUaGUgb3B0aW9ucyBvYmplY3QuXG4gKiBAcGFyYW0ge0Fib3J0U2lnbmFsfSBvcHRpb25zLnNpZ25hbCAtIEFuIG9wdGlvbmFsIEFib3J0U2lnbmFsIHRvIGNhbmNlbCB0aGUgZGVsYXkuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn0gQSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgYWZ0ZXIgdGhlIHNwZWNpZmllZCBkZWxheS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYXN5bmMgZnVuY3Rpb24gZm9vKCkge1xuICogICBjb25zb2xlLmxvZygnU3RhcnQnKTtcbiAqICAgYXdhaXQgZGVsYXkoMTAwMCk7IC8vIERlbGF5cyBleGVjdXRpb24gZm9yIDEgc2Vjb25kXG4gKiAgIGNvbnNvbGUubG9nKCdFbmQnKTtcbiAqIH1cbiAqXG4gKiBmb28oKTtcbiAqXG4gKiAvLyBXaXRoIEFib3J0U2lnbmFsXG4gKiBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICogY29uc3QgeyBzaWduYWwgfSA9IGNvbnRyb2xsZXI7XG4gKlxuICogc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDUwKTsgLy8gV2lsbCBjYW5jZWwgdGhlIGRlbGF5IGFmdGVyIDUwbXNcbiAqIHRyeSB7XG4gKiAgIGF3YWl0IGRlbGF5KDEwMCwgeyBzaWduYWwgfSk7XG4gKiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgY29uc29sZS5lcnJvcihlcnJvcik7IC8vIFdpbGwgbG9nICdBYm9ydEVycm9yJ1xuICogIH1cbiAqIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIsIHsgc2lnbmFsIH06IERlbGF5T3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29uc3QgYWJvcnRFcnJvciA9ICgpID0+IHtcbiAgICAgIHJlamVjdChuZXcgQWJvcnRFcnJvcigpKTtcbiAgICB9O1xuXG4gICAgY29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICBhYm9ydEVycm9yKCk7XG4gICAgfTtcblxuICAgIGlmIChzaWduYWw/LmFib3J0ZWQpIHtcbiAgICAgIHJldHVybiBhYm9ydEVycm9yKCk7XG4gICAgfVxuXG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBzaWduYWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgYWJvcnRIYW5kbGVyKTtcbiAgICAgIHJlc29sdmUoKTtcbiAgICB9LCBtcyk7XG5cbiAgICBzaWduYWw/LmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgYWJvcnRIYW5kbGVyLCB7IG9uY2U6IHRydWUgfSk7XG4gIH0pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsVUFBVSxRQUFRLHlCQUF5QjtBQU1wRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQStCQyxHQUNELE9BQU8sU0FBUyxNQUFNLEVBQVUsRUFBRSxFQUFFLE1BQU0sRUFBZ0IsR0FBRyxDQUFDLENBQUM7RUFDN0QsT0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTO0lBQzNCLE1BQU0sYUFBYTtNQUNqQixPQUFPLElBQUk7SUFDYjtJQUVBLE1BQU0sZUFBZTtNQUNuQixhQUFhO01BQ2I7SUFDRjtJQUVBLElBQUksUUFBUSxTQUFTO01BQ25CLE9BQU87SUFDVDtJQUVBLE1BQU0sWUFBWSxXQUFXO01BQzNCLFFBQVEsb0JBQW9CLFNBQVM7TUFDckM7SUFDRixHQUFHO0lBRUgsUUFBUSxpQkFBaUIsU0FBUyxjQUFjO01BQUUsTUFBTTtJQUFLO0VBQy9EO0FBQ0YifQ==
// denoCacheMetadata=6876348946652024581,15942919578009325182