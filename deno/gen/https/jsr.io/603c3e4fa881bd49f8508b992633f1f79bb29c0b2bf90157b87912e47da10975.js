import { toInteger } from '../util/toInteger.ts';
/**
 * Creates a function that only executes starting from the `n`-th call.
 * The provided function will be invoked starting from the `n`-th call.
 *
 * This is particularly useful for scenarios involving events or asynchronous operations
 * where an action should occur only after a certain number of invocations.
 *
 * @template F - The type of the function to be invoked.
 * @param {number} n - The number of calls required for `func` to execute.
 * @param {F} func - The function to be invoked.
 * @returns {(...args: Parameters<F>) => ReturnType<F> | undefined} - A new function that:
 * - Tracks the number of calls.
 * - Invokes `func` starting from the `n`-th call.
 * - Returns `undefined` if fewer than `n` calls have been made.
 * @throws {TypeError} - If `func` is not a function.
 * @example
 *
 * const afterFn = after(3, () => {
 *  console.log("called")
 * });
 *
 * // Will not log anything.
 * afterFn()
 * // Will not log anything.
 * afterFn()
 * // Will log 'called'.
 * afterFn()
 */ export function after(n, func) {
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }
  n = toInteger(n);
  return function(...args) {
    if (--n < 1) {
      return func.apply(this, args);
    }
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vYWZ0ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9JbnRlZ2VyIH0gZnJvbSAnLi4vdXRpbC90b0ludGVnZXIudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IG9ubHkgZXhlY3V0ZXMgc3RhcnRpbmcgZnJvbSB0aGUgYG5gLXRoIGNhbGwuXG4gKiBUaGUgcHJvdmlkZWQgZnVuY3Rpb24gd2lsbCBiZSBpbnZva2VkIHN0YXJ0aW5nIGZyb20gdGhlIGBuYC10aCBjYWxsLlxuICpcbiAqIFRoaXMgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCBmb3Igc2NlbmFyaW9zIGludm9sdmluZyBldmVudHMgb3IgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAqIHdoZXJlIGFuIGFjdGlvbiBzaG91bGQgb2NjdXIgb25seSBhZnRlciBhIGNlcnRhaW4gbnVtYmVyIG9mIGludm9jYXRpb25zLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gbiAtIFRoZSBudW1iZXIgb2YgY2FsbHMgcmVxdWlyZWQgZm9yIGBmdW5jYCB0byBleGVjdXRlLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQuXG4gKiBAcmV0dXJucyB7KC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pID0+IFJldHVyblR5cGU8Rj4gfCB1bmRlZmluZWR9IC0gQSBuZXcgZnVuY3Rpb24gdGhhdDpcbiAqIC0gVHJhY2tzIHRoZSBudW1iZXIgb2YgY2FsbHMuXG4gKiAtIEludm9rZXMgYGZ1bmNgIHN0YXJ0aW5nIGZyb20gdGhlIGBuYC10aCBjYWxsLlxuICogLSBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIGZld2VyIHRoYW4gYG5gIGNhbGxzIGhhdmUgYmVlbiBtYWRlLlxuICogQHRocm93cyB7VHlwZUVycm9yfSAtIElmIGBmdW5jYCBpcyBub3QgYSBmdW5jdGlvbi5cbiAqIEBleGFtcGxlXG4gKlxuICogY29uc3QgYWZ0ZXJGbiA9IGFmdGVyKDMsICgpID0+IHtcbiAqICBjb25zb2xlLmxvZyhcImNhbGxlZFwiKVxuICogfSk7XG4gKlxuICogLy8gV2lsbCBub3QgbG9nIGFueXRoaW5nLlxuICogYWZ0ZXJGbigpXG4gKiAvLyBXaWxsIG5vdCBsb2cgYW55dGhpbmcuXG4gKiBhZnRlckZuKClcbiAqIC8vIFdpbGwgbG9nICdjYWxsZWQnLlxuICogYWZ0ZXJGbigpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZnRlcjxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KFxuICBuOiBudW1iZXIsXG4gIGZ1bmM6IEZcbik6ICguLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KSA9PiBSZXR1cm5UeXBlPEY+IHwgdW5kZWZpbmVkIHtcbiAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgYSBmdW5jdGlvbicpO1xuICB9XG4gIG4gPSB0b0ludGVnZXIobik7XG4gIHJldHVybiBmdW5jdGlvbiAodGhpczogYW55LCAuLi5hcmdzOiBQYXJhbWV0ZXJzPEY+KSB7XG4gICAgaWYgKC0tbiA8IDEpIHtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTJCQyxHQUNELE9BQU8sU0FBUyxNQUNkLENBQVMsRUFDVCxJQUFPO0VBRVAsSUFBSSxPQUFPLFNBQVMsWUFBWTtJQUM5QixNQUFNLElBQUksVUFBVTtFQUN0QjtFQUNBLElBQUksVUFBVTtFQUNkLE9BQU8sU0FBcUIsR0FBRyxJQUFtQjtJQUNoRCxJQUFJLEVBQUUsSUFBSSxHQUFHO01BQ1gsT0FBTyxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUU7SUFDMUI7RUFDRjtBQUNGIn0=
// denoCacheMetadata=186981994341263042,352218850263186213