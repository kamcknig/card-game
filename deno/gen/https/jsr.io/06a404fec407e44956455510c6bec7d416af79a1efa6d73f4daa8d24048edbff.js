import { delay } from './delay.ts';
import { TimeoutError } from '../error/TimeoutError.ts';
/**
 * Returns a promise that rejects with a `TimeoutError` after a specified delay.
 *
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise<never>} A promise that rejects with a `TimeoutError` after the specified delay.
 * @throws {TimeoutError} Throws a `TimeoutError` after the specified delay.
 *
 * @example
 * try {
 *   await timeout(1000); // Timeout exception after 1 second
 * } catch (error) {
 *   console.error(error); // Will log 'The operation was timed out'
 * }
 */ export async function timeout(ms) {
  await delay(ms);
  throw new TimeoutError();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcm9taXNlL3RpbWVvdXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVsYXkgfSBmcm9tICcuL2RlbGF5LnRzJztcbmltcG9ydCB7IFRpbWVvdXRFcnJvciB9IGZyb20gJy4uL2Vycm9yL1RpbWVvdXRFcnJvci50cyc7XG5cbi8qKlxuICogUmV0dXJucyBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpdGggYSBgVGltZW91dEVycm9yYCBhZnRlciBhIHNwZWNpZmllZCBkZWxheS5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gbXMgLSBUaGUgZGVsYXkgZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzLlxuICogQHJldHVybnMge1Byb21pc2U8bmV2ZXI+fSBBIHByb21pc2UgdGhhdCByZWplY3RzIHdpdGggYSBgVGltZW91dEVycm9yYCBhZnRlciB0aGUgc3BlY2lmaWVkIGRlbGF5LlxuICogQHRocm93cyB7VGltZW91dEVycm9yfSBUaHJvd3MgYSBgVGltZW91dEVycm9yYCBhZnRlciB0aGUgc3BlY2lmaWVkIGRlbGF5LlxuICpcbiAqIEBleGFtcGxlXG4gKiB0cnkge1xuICogICBhd2FpdCB0aW1lb3V0KDEwMDApOyAvLyBUaW1lb3V0IGV4Y2VwdGlvbiBhZnRlciAxIHNlY29uZFxuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgY29uc29sZS5lcnJvcihlcnJvcik7IC8vIFdpbGwgbG9nICdUaGUgb3BlcmF0aW9uIHdhcyB0aW1lZCBvdXQnXG4gKiB9XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0aW1lb3V0KG1zOiBudW1iZXIpOiBQcm9taXNlPG5ldmVyPiB7XG4gIGF3YWl0IGRlbGF5KG1zKTtcbiAgdGhyb3cgbmV3IFRpbWVvdXRFcnJvcigpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsS0FBSyxRQUFRLGFBQWE7QUFDbkMsU0FBUyxZQUFZLFFBQVEsMkJBQTJCO0FBRXhEOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLGVBQWUsUUFBUSxFQUFVO0VBQ3RDLE1BQU0sTUFBTTtFQUNaLE1BQU0sSUFBSTtBQUNaIn0=
// denoCacheMetadata=7052089455561669917,12921082598497981646