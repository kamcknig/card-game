/**
 * Checks if the given value is boolean.
 *
 * This function tests whether the provided value is strictly `boolean`.
 * It returns `true` if the value is `boolean`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `boolean`.
 *
 * @param {unknown} x - The Value to test if it is boolean.
 * @returns {x is boolean} True if the value is boolean, false otherwise.
 *
 * @example
 *
 * const value1 = true;
 * const value2 = 0;
 * const value3 = 'abc';
 *
 * console.log(isBoolean(value1)); // true
 * console.log(isBoolean(value2)); // false
 * console.log(isBoolean(value3)); // false
 *
 */ export function isBoolean(x) {
  return typeof x === 'boolean';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNCb29sZWFuLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBib29sZWFuLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGVzdHMgd2hldGhlciB0aGUgcHJvdmlkZWQgdmFsdWUgaXMgc3RyaWN0bHkgYGJvb2xlYW5gLlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGBib29sZWFuYCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBib29sZWFuYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHggLSBUaGUgVmFsdWUgdG8gdGVzdCBpZiBpdCBpcyBib29sZWFuLlxuICogQHJldHVybnMge3ggaXMgYm9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYm9vbGVhbiwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKlxuICogY29uc3QgdmFsdWUxID0gdHJ1ZTtcbiAqIGNvbnN0IHZhbHVlMiA9IDA7XG4gKiBjb25zdCB2YWx1ZTMgPSAnYWJjJztcbiAqXG4gKiBjb25zb2xlLmxvZyhpc0Jvb2xlYW4odmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzQm9vbGVhbih2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzQm9vbGVhbih2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Jvb2xlYW4oeDogdW5rbm93bik6IHggaXMgYm9vbGVhbiB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Jvb2xlYW4nO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsVUFBVSxDQUFVO0VBQ2xDLE9BQU8sT0FBTyxNQUFNO0FBQ3RCIn0=
// denoCacheMetadata=3958983745677804161,3718191594840519360