import { toInteger } from '../util/toInteger.ts';
/**
 * Creates a function that invokes `func`, with the `this` binding and arguments
 * of the created function, while it's called less than `n` times. Subsequent
 * calls to the created function return the result of the last `func` invocation.
 *
 * @template F - The type of the function to be invoked.
 * @param {number} n - The number of times the returned function is allowed to call `func` before stopping.
 * - If `n` is 0, `func` will never be called.
 * - If `n` is a positive integer, `func` will be called up to `n-1` times.
 * @param {F} func - The function to be called with the limit applied.
 * @returns {(...args: Parameters<F>) => ReturnType<F> } - A new function that:
 * - Tracks the number of calls.
 * - Invokes `func` until the `n-1`-th call.
 * - Returns last result of `func`, if `n` is reached.
 * @throws {TypeError} - If `func` is not a function.
 * @example
 * let count = 0;
 * const before3 = before(3, () => ++count);
 *
 * before3(); // => 1
 * before3(); // => 2
 * before3(); // => 2
 */ export function before(n, func) {
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }
  let result;
  n = toInteger(n);
  return function(...args) {
    if (--n > 0) {
      result = func.apply(this, args);
    }
    if (n <= 1 && func) {
      // for garbage collection
      func = undefined;
    }
    return result;
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vYmVmb3JlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRvSW50ZWdlciB9IGZyb20gJy4uL3V0aWwvdG9JbnRlZ2VyLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGBmdW5jYCwgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgYW5kIGFyZ3VtZW50c1xuICogb2YgdGhlIGNyZWF0ZWQgZnVuY3Rpb24sIHdoaWxlIGl0J3MgY2FsbGVkIGxlc3MgdGhhbiBgbmAgdGltZXMuIFN1YnNlcXVlbnRcbiAqIGNhbGxzIHRvIHRoZSBjcmVhdGVkIGZ1bmN0aW9uIHJldHVybiB0aGUgcmVzdWx0IG9mIHRoZSBsYXN0IGBmdW5jYCBpbnZvY2F0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gbiAtIFRoZSBudW1iZXIgb2YgdGltZXMgdGhlIHJldHVybmVkIGZ1bmN0aW9uIGlzIGFsbG93ZWQgdG8gY2FsbCBgZnVuY2AgYmVmb3JlIHN0b3BwaW5nLlxuICogLSBJZiBgbmAgaXMgMCwgYGZ1bmNgIHdpbGwgbmV2ZXIgYmUgY2FsbGVkLlxuICogLSBJZiBgbmAgaXMgYSBwb3NpdGl2ZSBpbnRlZ2VyLCBgZnVuY2Agd2lsbCBiZSBjYWxsZWQgdXAgdG8gYG4tMWAgdGltZXMuXG4gKiBAcGFyYW0ge0Z9IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdpdGggdGhlIGxpbWl0IGFwcGxpZWQuXG4gKiBAcmV0dXJucyB7KC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pID0+IFJldHVyblR5cGU8Rj4gfSAtIEEgbmV3IGZ1bmN0aW9uIHRoYXQ6XG4gKiAtIFRyYWNrcyB0aGUgbnVtYmVyIG9mIGNhbGxzLlxuICogLSBJbnZva2VzIGBmdW5jYCB1bnRpbCB0aGUgYG4tMWAtdGggY2FsbC5cbiAqIC0gUmV0dXJucyBsYXN0IHJlc3VsdCBvZiBgZnVuY2AsIGlmIGBuYCBpcyByZWFjaGVkLlxuICogQHRocm93cyB7VHlwZUVycm9yfSAtIElmIGBmdW5jYCBpcyBub3QgYSBmdW5jdGlvbi5cbiAqIEBleGFtcGxlXG4gKiBsZXQgY291bnQgPSAwO1xuICogY29uc3QgYmVmb3JlMyA9IGJlZm9yZSgzLCAoKSA9PiArK2NvdW50KTtcbiAqXG4gKiBiZWZvcmUzKCk7IC8vID0+IDFcbiAqIGJlZm9yZTMoKTsgLy8gPT4gMlxuICogYmVmb3JlMygpOyAvLyA9PiAyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiZWZvcmU8RiBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihcbiAgbjogbnVtYmVyLFxuICBmdW5jOiBGXG4pOiAoLi4uYXJnczogUGFyYW1ldGVyczxGPikgPT4gUmV0dXJuVHlwZTxGPiB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgZnVuY3Rpb24nKTtcbiAgfVxuXG4gIGxldCByZXN1bHQ6IFJldHVyblR5cGU8Rj47XG4gIG4gPSB0b0ludGVnZXIobik7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICh0aGlzOiB1bmtub3duLCAuLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KSB7XG4gICAgaWYgKC0tbiA+IDApIHtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuXG4gICAgaWYgKG4gPD0gMSAmJiBmdW5jKSB7XG4gICAgICAvLyBmb3IgZ2FyYmFnZSBjb2xsZWN0aW9uXG4gICAgICBmdW5jID0gdW5kZWZpbmVkIGFzIGFueTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUVqRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNCQyxHQUNELE9BQU8sU0FBUyxPQUNkLENBQVMsRUFDVCxJQUFPO0VBRVAsSUFBSSxPQUFPLFNBQVMsWUFBWTtJQUM5QixNQUFNLElBQUksVUFBVTtFQUN0QjtFQUVBLElBQUk7RUFDSixJQUFJLFVBQVU7RUFFZCxPQUFPLFNBQXlCLEdBQUcsSUFBbUI7SUFDcEQsSUFBSSxFQUFFLElBQUksR0FBRztNQUNYLFNBQVMsS0FBSyxLQUFLLENBQUMsSUFBSSxFQUFFO0lBQzVCO0lBRUEsSUFBSSxLQUFLLEtBQUssTUFBTTtNQUNsQix5QkFBeUI7TUFDekIsT0FBTztJQUNUO0lBRUEsT0FBTztFQUNUO0FBQ0YifQ==
// denoCacheMetadata=12414537453304616274,15087006253424559291