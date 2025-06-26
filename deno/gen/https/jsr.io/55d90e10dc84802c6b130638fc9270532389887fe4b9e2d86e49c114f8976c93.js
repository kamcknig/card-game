import { invoke } from './invoke.ts';
/**
 * Creates a function that invokes the method at `path` of a given object with the provided arguments.
 *
 * @param {PropertyKey | PropertyKey[]} path - The path of the method to invoke.
 * @param {...any} args - The arguments to invoke the method with.
 * @returns {(object?: unknown) => any} - Returns a new function that takes an object and invokes the method at `path` with `args`.
 *
 * @example
 * const object = {
 *   a: {
 *     b: function (x, y) {
 *       return x + y;
 *     }
 *   }
 * };
 *
 * const add = method('a.b', 1, 2);
 * console.log(add(object)); // => 3
 */ export function method(path, ...args) {
  return function(object) {
    return invoke(object, path, args);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9tZXRob2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaW52b2tlIH0gZnJvbSAnLi9pbnZva2UudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGludm9rZXMgdGhlIG1ldGhvZCBhdCBgcGF0aGAgb2YgYSBnaXZlbiBvYmplY3Qgd2l0aCB0aGUgcHJvdmlkZWQgYXJndW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7UHJvcGVydHlLZXkgfCBQcm9wZXJ0eUtleVtdfSBwYXRoIC0gVGhlIHBhdGggb2YgdGhlIG1ldGhvZCB0byBpbnZva2UuXG4gKiBAcGFyYW0gey4uLmFueX0gYXJncyAtIFRoZSBhcmd1bWVudHMgdG8gaW52b2tlIHRoZSBtZXRob2Qgd2l0aC5cbiAqIEByZXR1cm5zIHsob2JqZWN0PzogdW5rbm93bikgPT4gYW55fSAtIFJldHVybnMgYSBuZXcgZnVuY3Rpb24gdGhhdCB0YWtlcyBhbiBvYmplY3QgYW5kIGludm9rZXMgdGhlIG1ldGhvZCBhdCBgcGF0aGAgd2l0aCBgYXJnc2AuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IG9iamVjdCA9IHtcbiAqICAgYToge1xuICogICAgIGI6IGZ1bmN0aW9uICh4LCB5KSB7XG4gKiAgICAgICByZXR1cm4geCArIHk7XG4gKiAgICAgfVxuICogICB9XG4gKiB9O1xuICpcbiAqIGNvbnN0IGFkZCA9IG1ldGhvZCgnYS5iJywgMSwgMik7XG4gKiBjb25zb2xlLmxvZyhhZGQob2JqZWN0KSk7IC8vID0+IDNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ldGhvZChwYXRoOiBQcm9wZXJ0eUtleSB8IFByb3BlcnR5S2V5W10sIC4uLmFyZ3M6IGFueVtdKTogKG9iamVjdD86IHVua25vd24pID0+IGFueSB7XG4gIHJldHVybiBmdW5jdGlvbiAob2JqZWN0PzogdW5rbm93bikge1xuICAgIHJldHVybiBpbnZva2Uob2JqZWN0LCBwYXRoLCBhcmdzKTtcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE1BQU0sUUFBUSxjQUFjO0FBRXJDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrQkMsR0FDRCxPQUFPLFNBQVMsT0FBTyxJQUFpQyxFQUFFLEdBQUcsSUFBVztFQUN0RSxPQUFPLFNBQVUsTUFBZ0I7SUFDL0IsT0FBTyxPQUFPLFFBQVEsTUFBTTtFQUM5QjtBQUNGIn0=
// denoCacheMetadata=10189880492671048847,3484596848093226818