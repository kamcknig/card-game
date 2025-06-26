import { timeout } from './timeout.ts';
/**
 * Executes an async function and enforces a timeout.
 *
 * If the promise does not resolve within the specified time,
 * the timeout will trigger and the returned promise will be rejected.
 *
 *
 * @template T
 * @param {() => Promise<T>} run - A function that returns a promise to be executed.
 * @param {number} ms - The timeout duration in milliseconds.
 * @returns {Promise<T>} A promise that resolves with the result of the `run` function or rejects if the timeout is reached.
 *
 * @example
 * async function fetchData() {
 *   const response = await fetch('https://example.com/data');
 *   return response.json();
 * }
 *
 * try {
 *   const data = await withTimeout(fetchData, 1000);
 *   console.log(data); // Logs the fetched data if `fetchData` is resolved within 1 second.
 * } catch (error) {
 *   console.error(error); // Will log 'TimeoutError' if `fetchData` is not resolved within 1 second.
 * }
 */ export async function withTimeout(run, ms) {
  return Promise.race([
    run(),
    timeout(ms)
  ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcm9taXNlL3dpdGhUaW1lb3V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuL3RpbWVvdXQudHMnO1xuXG4vKipcbiAqIEV4ZWN1dGVzIGFuIGFzeW5jIGZ1bmN0aW9uIGFuZCBlbmZvcmNlcyBhIHRpbWVvdXQuXG4gKlxuICogSWYgdGhlIHByb21pc2UgZG9lcyBub3QgcmVzb2x2ZSB3aXRoaW4gdGhlIHNwZWNpZmllZCB0aW1lLFxuICogdGhlIHRpbWVvdXQgd2lsbCB0cmlnZ2VyIGFuZCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkLlxuICpcbiAqXG4gKiBAdGVtcGxhdGUgVFxuICogQHBhcmFtIHsoKSA9PiBQcm9taXNlPFQ+fSBydW4gLSBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2UgdG8gYmUgZXhlY3V0ZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gbXMgLSBUaGUgdGltZW91dCBkdXJhdGlvbiBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxUPn0gQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgcmVzdWx0IG9mIHRoZSBgcnVuYCBmdW5jdGlvbiBvciByZWplY3RzIGlmIHRoZSB0aW1lb3V0IGlzIHJlYWNoZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGFzeW5jIGZ1bmN0aW9uIGZldGNoRGF0YSgpIHtcbiAqICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9leGFtcGxlLmNvbS9kYXRhJyk7XG4gKiAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XG4gKiB9XG4gKlxuICogdHJ5IHtcbiAqICAgY29uc3QgZGF0YSA9IGF3YWl0IHdpdGhUaW1lb3V0KGZldGNoRGF0YSwgMTAwMCk7XG4gKiAgIGNvbnNvbGUubG9nKGRhdGEpOyAvLyBMb2dzIHRoZSBmZXRjaGVkIGRhdGEgaWYgYGZldGNoRGF0YWAgaXMgcmVzb2x2ZWQgd2l0aGluIDEgc2Vjb25kLlxuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgY29uc29sZS5lcnJvcihlcnJvcik7IC8vIFdpbGwgbG9nICdUaW1lb3V0RXJyb3InIGlmIGBmZXRjaERhdGFgIGlzIG5vdCByZXNvbHZlZCB3aXRoaW4gMSBzZWNvbmQuXG4gKiB9XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoVGltZW91dDxUPihydW46ICgpID0+IFByb21pc2U8VD4sIG1zOiBudW1iZXIpOiBQcm9taXNlPFQ+IHtcbiAgcmV0dXJuIFByb21pc2UucmFjZShbcnVuKCksIHRpbWVvdXQobXMpXSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxPQUFPLFFBQVEsZUFBZTtBQUV2Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBd0JDLEdBQ0QsT0FBTyxlQUFlLFlBQWUsR0FBcUIsRUFBRSxFQUFVO0VBQ3BFLE9BQU8sUUFBUSxJQUFJLENBQUM7SUFBQztJQUFPLFFBQVE7R0FBSTtBQUMxQyJ9
// denoCacheMetadata=16671438849403898626,4393173584427767347