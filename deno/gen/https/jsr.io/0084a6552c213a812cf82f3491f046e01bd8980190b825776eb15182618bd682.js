/**
 * Checks if the given value is undefined.
 *
 * This function tests whether the provided value is strictly equal to `undefined`.
 * It returns `true` if the value is `undefined`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `undefined`.
 *
 * @param {unknown} x - The value to test if it is undefined.
 * @returns {x is undefined} true if the value is undefined, false otherwise.
 *
 * @example
 * const value1 = undefined;
 * const value2 = null;
 * const value3 = 42;
 *
 * console.log(isUndefined(value1)); // true
 * console.log(isUndefined(value2)); // false
 * console.log(isUndefined(value3)); // false
 */ export function isUndefined(x) {
  return x === undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNVbmRlZmluZWQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgdGhlIGdpdmVuIHZhbHVlIGlzIHVuZGVmaW5lZC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIHN0cmljdGx5IGVxdWFsIHRvIGB1bmRlZmluZWRgLlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGB1bmRlZmluZWRgLCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYHVuZGVmaW5lZGAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB4IC0gVGhlIHZhbHVlIHRvIHRlc3QgaWYgaXQgaXMgdW5kZWZpbmVkLlxuICogQHJldHVybnMge3ggaXMgdW5kZWZpbmVkfSB0cnVlIGlmIHRoZSB2YWx1ZSBpcyB1bmRlZmluZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gdW5kZWZpbmVkO1xuICogY29uc3QgdmFsdWUyID0gbnVsbDtcbiAqIGNvbnN0IHZhbHVlMyA9IDQyO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzVW5kZWZpbmVkKHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc1VuZGVmaW5lZCh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzVW5kZWZpbmVkKHZhbHVlMykpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNVbmRlZmluZWQoeDogdW5rbm93bik6IHggaXMgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIHggPT09IHVuZGVmaW5lZDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW1CQyxHQUNELE9BQU8sU0FBUyxZQUFZLENBQVU7RUFDcEMsT0FBTyxNQUFNO0FBQ2YifQ==
// denoCacheMetadata=548175084699801028,9404411900651248559