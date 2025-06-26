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
 * @throws {Error} - Throws an error if `n` is negative.
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
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`n must be a non-negative integer.`);
  }
  let counter = 0;
  return (...args)=>{
    if (++counter >= n) {
      return func(...args);
    }
    return undefined;
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9hZnRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IG9ubHkgZXhlY3V0ZXMgc3RhcnRpbmcgZnJvbSB0aGUgYG5gLXRoIGNhbGwuXG4gKiBUaGUgcHJvdmlkZWQgZnVuY3Rpb24gd2lsbCBiZSBpbnZva2VkIHN0YXJ0aW5nIGZyb20gdGhlIGBuYC10aCBjYWxsLlxuICpcbiAqIFRoaXMgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCBmb3Igc2NlbmFyaW9zIGludm9sdmluZyBldmVudHMgb3IgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAqIHdoZXJlIGFuIGFjdGlvbiBzaG91bGQgb2NjdXIgb25seSBhZnRlciBhIGNlcnRhaW4gbnVtYmVyIG9mIGludm9jYXRpb25zLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gbiAtIFRoZSBudW1iZXIgb2YgY2FsbHMgcmVxdWlyZWQgZm9yIGBmdW5jYCB0byBleGVjdXRlLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIGJlIGludm9rZWQuXG4gKiBAcmV0dXJucyB7KC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pID0+IFJldHVyblR5cGU8Rj4gfCB1bmRlZmluZWR9IC0gQSBuZXcgZnVuY3Rpb24gdGhhdDpcbiAqIC0gVHJhY2tzIHRoZSBudW1iZXIgb2YgY2FsbHMuXG4gKiAtIEludm9rZXMgYGZ1bmNgIHN0YXJ0aW5nIGZyb20gdGhlIGBuYC10aCBjYWxsLlxuICogLSBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIGZld2VyIHRoYW4gYG5gIGNhbGxzIGhhdmUgYmVlbiBtYWRlLlxuICogQHRocm93cyB7RXJyb3J9IC0gVGhyb3dzIGFuIGVycm9yIGlmIGBuYCBpcyBuZWdhdGl2ZS5cbiAqIEBleGFtcGxlXG4gKlxuICogY29uc3QgYWZ0ZXJGbiA9IGFmdGVyKDMsICgpID0+IHtcbiAqICBjb25zb2xlLmxvZyhcImNhbGxlZFwiKVxuICogfSk7XG4gKlxuICogLy8gV2lsbCBub3QgbG9nIGFueXRoaW5nLlxuICogYWZ0ZXJGbigpXG4gKiAvLyBXaWxsIG5vdCBsb2cgYW55dGhpbmcuXG4gKiBhZnRlckZuKClcbiAqIC8vIFdpbGwgbG9nICdjYWxsZWQnLlxuICogYWZ0ZXJGbigpXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGFmdGVyPEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oXG4gIG46IG51bWJlcixcbiAgZnVuYzogRlxuKTogKC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pID0+IFJldHVyblR5cGU8Rj4gfCB1bmRlZmluZWQge1xuICBpZiAoIU51bWJlci5pc0ludGVnZXIobikgfHwgbiA8IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYG4gbXVzdCBiZSBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyLmApO1xuICB9XG5cbiAgbGV0IGNvdW50ZXIgPSAwO1xuICByZXR1cm4gKC4uLmFyZ3M6IFBhcmFtZXRlcnM8Rj4pID0+IHtcbiAgICBpZiAoKytjb3VudGVyID49IG4pIHtcbiAgICAgIHJldHVybiBmdW5jKC4uLmFyZ3MpO1xuICAgIH1cbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EyQkMsR0FFRCxPQUFPLFNBQVMsTUFDZCxDQUFTLEVBQ1QsSUFBTztFQUVQLElBQUksQ0FBQyxPQUFPLFNBQVMsQ0FBQyxNQUFNLElBQUksR0FBRztJQUNqQyxNQUFNLElBQUksTUFBTSxDQUFDLGlDQUFpQyxDQUFDO0VBQ3JEO0VBRUEsSUFBSSxVQUFVO0VBQ2QsT0FBTyxDQUFDLEdBQUc7SUFDVCxJQUFJLEVBQUUsV0FBVyxHQUFHO01BQ2xCLE9BQU8sUUFBUTtJQUNqQjtJQUNBLE9BQU87RUFDVDtBQUNGIn0=
// denoCacheMetadata=1601504996916194243,3217284751988111505