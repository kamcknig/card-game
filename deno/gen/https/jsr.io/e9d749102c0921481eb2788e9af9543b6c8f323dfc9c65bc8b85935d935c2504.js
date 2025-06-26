/**
 * Attempts to execute a function with the provided arguments.
 * If the function throws an error, it catches the error and returns it.
 * If the caught error is not an instance of Error, it wraps it in a new Error.
 *
 * @param {F} func - The function to be executed.
 * @param {...Parameters<F>} args - The arguments to pass to the function.
 * @returns {ReturnType<F> | Error} The return value of the function if successful, or an Error if an exception is thrown.
 *
 * @template F - The type of the function being attempted.
 *
 * @example
 * // Example 1: Successful execution
 * const result = attempt((x, y) => x + y, 2, 3);
 * console.log(result); // Output: 5
 *
 * @example
 * // Example 2: Function throws an error
 * const errorResult = attempt(() => {
 *   throw new Error("Something went wrong");
 * });
 * console.log(errorResult); // Output: Error: Something went wrong
 *
 * @example
 * // Example 3: Non-Error thrown
 * const nonErrorResult = attempt(() => {
 *   throw "This is a string error";
 * });
 * console.log(nonErrorResult); // Output: Error: This is a string error
 */ export function attempt(func, ...args) {
  try {
    return func(...args);
  } catch (e) {
    return e instanceof Error ? e : new Error(e);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vYXR0ZW1wdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEF0dGVtcHRzIHRvIGV4ZWN1dGUgYSBmdW5jdGlvbiB3aXRoIHRoZSBwcm92aWRlZCBhcmd1bWVudHMuXG4gKiBJZiB0aGUgZnVuY3Rpb24gdGhyb3dzIGFuIGVycm9yLCBpdCBjYXRjaGVzIHRoZSBlcnJvciBhbmQgcmV0dXJucyBpdC5cbiAqIElmIHRoZSBjYXVnaHQgZXJyb3IgaXMgbm90IGFuIGluc3RhbmNlIG9mIEVycm9yLCBpdCB3cmFwcyBpdCBpbiBhIG5ldyBFcnJvci5cbiAqXG4gKiBAcGFyYW0ge0Z9IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gYmUgZXhlY3V0ZWQuXG4gKiBAcGFyYW0gey4uLlBhcmFtZXRlcnM8Rj59IGFyZ3MgLSBUaGUgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIGZ1bmN0aW9uLlxuICogQHJldHVybnMge1JldHVyblR5cGU8Rj4gfCBFcnJvcn0gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gaWYgc3VjY2Vzc2Z1bCwgb3IgYW4gRXJyb3IgaWYgYW4gZXhjZXB0aW9uIGlzIHRocm93bi5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIHRoZSBmdW5jdGlvbiBiZWluZyBhdHRlbXB0ZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEV4YW1wbGUgMTogU3VjY2Vzc2Z1bCBleGVjdXRpb25cbiAqIGNvbnN0IHJlc3VsdCA9IGF0dGVtcHQoKHgsIHkpID0+IHggKyB5LCAyLCAzKTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdCk7IC8vIE91dHB1dDogNVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBFeGFtcGxlIDI6IEZ1bmN0aW9uIHRocm93cyBhbiBlcnJvclxuICogY29uc3QgZXJyb3JSZXN1bHQgPSBhdHRlbXB0KCgpID0+IHtcbiAqICAgdGhyb3cgbmV3IEVycm9yKFwiU29tZXRoaW5nIHdlbnQgd3JvbmdcIik7XG4gKiB9KTtcbiAqIGNvbnNvbGUubG9nKGVycm9yUmVzdWx0KTsgLy8gT3V0cHV0OiBFcnJvcjogU29tZXRoaW5nIHdlbnQgd3JvbmdcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRXhhbXBsZSAzOiBOb24tRXJyb3IgdGhyb3duXG4gKiBjb25zdCBub25FcnJvclJlc3VsdCA9IGF0dGVtcHQoKCkgPT4ge1xuICogICB0aHJvdyBcIlRoaXMgaXMgYSBzdHJpbmcgZXJyb3JcIjtcbiAqIH0pO1xuICogY29uc29sZS5sb2cobm9uRXJyb3JSZXN1bHQpOyAvLyBPdXRwdXQ6IEVycm9yOiBUaGlzIGlzIGEgc3RyaW5nIGVycm9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhdHRlbXB0PEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oZnVuYzogRiwgLi4uYXJnczogUGFyYW1ldGVyczxGPik6IFJldHVyblR5cGU8Rj4gfCBFcnJvciB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGZ1bmMoLi4uYXJncyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHJldHVybiBlIGluc3RhbmNlb2YgRXJyb3IgPyBlIDogbmV3IEVycm9yKGUpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJDLEdBQ0QsT0FBTyxTQUFTLFFBQTJDLElBQU8sRUFBRSxHQUFHLElBQW1CO0VBQ3hGLElBQUk7SUFDRixPQUFPLFFBQVE7RUFDakIsRUFBRSxPQUFPLEdBQVE7SUFDZixPQUFPLGFBQWEsUUFBUSxJQUFJLElBQUksTUFBTTtFQUM1QztBQUNGIn0=
// denoCacheMetadata=8150719086868002257,10478058023984599760