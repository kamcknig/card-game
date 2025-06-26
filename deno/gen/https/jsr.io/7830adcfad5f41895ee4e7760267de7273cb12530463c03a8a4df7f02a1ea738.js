/**
 * Creates a function that limits the number of times the given function (`func`) can be called.
 *
 * @template F - The type of the function to be invoked.
 * @param {number} n - The number of times the returned function is allowed to call `func` before stopping.
 * - If `n` is 0, `func` will never be called.
 * - If `n` is a positive integer, `func` will be called up to `n-1` times.
 * @param {F} func - The function to be called with the limit applied.
 * @returns {(...args: Parameters<F>) => ReturnType<F> | undefined} - A new function that:
 * - Tracks the number of calls.
 * - Invokes `func` until the `n-1`-th call.
 * - Returns `undefined` if the number of calls reaches or exceeds `n`, stopping further calls.
 * @throws {Error} - Throw an error if `n` is negative.
 * @example
 *
 * const beforeFn = before(3, () => {
 *  console.log("called");
 * })
 *
 * // Will log 'called'.
 * beforeFn();
 *
 * // Will log 'called'.
 * beforeFn();
 *
 * // Will not log anything.
 * beforeFn();
 */ export function before(n, func) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('n must be a non-negative integer.');
  }
  let counter = 0;
  return (...args)=>{
    if (++counter < n) {
      return func(...args);
    }
    return undefined;
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9iZWZvcmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBsaW1pdHMgdGhlIG51bWJlciBvZiB0aW1lcyB0aGUgZ2l2ZW4gZnVuY3Rpb24gKGBmdW5jYCkgY2FuIGJlIGNhbGxlZC5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIHRoZSBmdW5jdGlvbiB0byBiZSBpbnZva2VkLlxuICogQHBhcmFtIHtudW1iZXJ9IG4gLSBUaGUgbnVtYmVyIG9mIHRpbWVzIHRoZSByZXR1cm5lZCBmdW5jdGlvbiBpcyBhbGxvd2VkIHRvIGNhbGwgYGZ1bmNgIGJlZm9yZSBzdG9wcGluZy5cbiAqIC0gSWYgYG5gIGlzIDAsIGBmdW5jYCB3aWxsIG5ldmVyIGJlIGNhbGxlZC5cbiAqIC0gSWYgYG5gIGlzIGEgcG9zaXRpdmUgaW50ZWdlciwgYGZ1bmNgIHdpbGwgYmUgY2FsbGVkIHVwIHRvIGBuLTFgIHRpbWVzLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aXRoIHRoZSBsaW1pdCBhcHBsaWVkLlxuICogQHJldHVybnMgeyguLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KSA9PiBSZXR1cm5UeXBlPEY+IHwgdW5kZWZpbmVkfSAtIEEgbmV3IGZ1bmN0aW9uIHRoYXQ6XG4gKiAtIFRyYWNrcyB0aGUgbnVtYmVyIG9mIGNhbGxzLlxuICogLSBJbnZva2VzIGBmdW5jYCB1bnRpbCB0aGUgYG4tMWAtdGggY2FsbC5cbiAqIC0gUmV0dXJucyBgdW5kZWZpbmVkYCBpZiB0aGUgbnVtYmVyIG9mIGNhbGxzIHJlYWNoZXMgb3IgZXhjZWVkcyBgbmAsIHN0b3BwaW5nIGZ1cnRoZXIgY2FsbHMuXG4gKiBAdGhyb3dzIHtFcnJvcn0gLSBUaHJvdyBhbiBlcnJvciBpZiBgbmAgaXMgbmVnYXRpdmUuXG4gKiBAZXhhbXBsZVxuICpcbiAqIGNvbnN0IGJlZm9yZUZuID0gYmVmb3JlKDMsICgpID0+IHtcbiAqICBjb25zb2xlLmxvZyhcImNhbGxlZFwiKTtcbiAqIH0pXG4gKlxuICogLy8gV2lsbCBsb2cgJ2NhbGxlZCcuXG4gKiBiZWZvcmVGbigpO1xuICpcbiAqIC8vIFdpbGwgbG9nICdjYWxsZWQnLlxuICogYmVmb3JlRm4oKTtcbiAqXG4gKiAvLyBXaWxsIG5vdCBsb2cgYW55dGhpbmcuXG4gKiBiZWZvcmVGbigpO1xuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBiZWZvcmU8RiBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihcbiAgbjogbnVtYmVyLFxuICBmdW5jOiBGXG4pOiAoLi4uYXJnczogUGFyYW1ldGVyczxGPikgPT4gUmV0dXJuVHlwZTxGPiB8IHVuZGVmaW5lZCB7XG4gIGlmICghTnVtYmVyLmlzSW50ZWdlcihuKSB8fCBuIDwgMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignbiBtdXN0IGJlIGEgbm9uLW5lZ2F0aXZlIGludGVnZXIuJyk7XG4gIH1cblxuICBsZXQgY291bnRlciA9IDA7XG5cbiAgcmV0dXJuICguLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KSA9PiB7XG4gICAgaWYgKCsrY291bnRlciA8IG4pIHtcbiAgICAgIHJldHVybiBmdW5jKC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTJCQyxHQUVELE9BQU8sU0FBUyxPQUNkLENBQVMsRUFDVCxJQUFPO0VBRVAsSUFBSSxDQUFDLE9BQU8sU0FBUyxDQUFDLE1BQU0sSUFBSSxHQUFHO0lBQ2pDLE1BQU0sSUFBSSxNQUFNO0VBQ2xCO0VBRUEsSUFBSSxVQUFVO0VBRWQsT0FBTyxDQUFDLEdBQUc7SUFDVCxJQUFJLEVBQUUsVUFBVSxHQUFHO01BQ2pCLE9BQU8sUUFBUTtJQUNqQjtJQUVBLE9BQU87RUFDVDtBQUNGIn0=
// denoCacheMetadata=10163717177396789945,17664324808074554131