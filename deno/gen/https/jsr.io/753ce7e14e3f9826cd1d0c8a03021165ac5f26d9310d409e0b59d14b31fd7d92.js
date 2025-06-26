/**
 * Checks if the given value is a `WeakSet`.
 *
 * This function tests whether the provided value is an instance of `WeakSet`.
 * It returns `true` if the value is a `WeakSet`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `WeakSet`.
 *
 * @param {unknown} value - The value to test if it is a `WeakSet`.
 * @returns {value is WeakSet<WeakKey>} true if the value is a `WeakSet`, false otherwise.
 *
 * @example
 * const value1 = new WeakSet();
 * const value2 = new Map();
 * const value3 = new Set();
 *
 * console.log(isWeakSet(value1)); // true
 * console.log(isWeakSet(value2)); // false
 * console.log(isWeakSet(value3)); // false
 */ export function isWeakSet(value) {
  return value instanceof WeakSet;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNXZWFrU2V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIGBXZWFrU2V0YC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGFuIGluc3RhbmNlIG9mIGBXZWFrU2V0YC5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhIGBXZWFrU2V0YCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBXZWFrU2V0YC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHRlc3QgaWYgaXQgaXMgYSBgV2Vha1NldGAuXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgV2Vha1NldDxXZWFrS2V5Pn0gdHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYSBgV2Vha1NldGAsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IFdlYWtTZXQoKTtcbiAqIGNvbnN0IHZhbHVlMiA9IG5ldyBNYXAoKTtcbiAqIGNvbnN0IHZhbHVlMyA9IG5ldyBTZXQoKTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc1dlYWtTZXQodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzV2Vha1NldCh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzV2Vha1NldCh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzV2Vha1NldCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFdlYWtTZXQ8V2Vha0tleT4ge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBXZWFrU2V0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJDLEdBQ0QsT0FBTyxTQUFTLFVBQVUsS0FBYztFQUN0QyxPQUFPLGlCQUFpQjtBQUMxQiJ9
// denoCacheMetadata=11279171827688354370,58588561727553592