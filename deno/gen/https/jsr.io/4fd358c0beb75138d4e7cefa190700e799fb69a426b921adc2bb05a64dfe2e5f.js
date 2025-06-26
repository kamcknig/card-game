/**
 * Checks if the given value is null.
 *
 * This function tests whether the provided value is strictly equal to `null`.
 * It returns `true` if the value is `null`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `null`.
 *
 * @param {unknown} x - The value to test if it is null.
 * @returns {x is null} True if the value is null, false otherwise.
 *
 * @example
 * const value1 = null;
 * const value2 = undefined;
 * const value3 = 42;
 *
 * console.log(isNull(value1)); // true
 * console.log(isNull(value2)); // false
 * console.log(isNull(value3)); // false
 */ export function isNull(x) {
  return x === null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNOdWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBudWxsLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGVzdHMgd2hldGhlciB0aGUgcHJvdmlkZWQgdmFsdWUgaXMgc3RyaWN0bHkgZXF1YWwgdG8gYG51bGxgLlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGBudWxsYCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBudWxsYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHggLSBUaGUgdmFsdWUgdG8gdGVzdCBpZiBpdCBpcyBudWxsLlxuICogQHJldHVybnMge3ggaXMgbnVsbH0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgbnVsbCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSBudWxsO1xuICogY29uc3QgdmFsdWUyID0gdW5kZWZpbmVkO1xuICogY29uc3QgdmFsdWUzID0gNDI7XG4gKlxuICogY29uc29sZS5sb2coaXNOdWxsKHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc051bGwodmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc051bGwodmFsdWUzKSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc051bGwoeDogdW5rbm93bik6IHggaXMgbnVsbCB7XG4gIHJldHVybiB4ID09PSBudWxsO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sQ0FBVTtFQUMvQixPQUFPLE1BQU07QUFDZiJ9
// denoCacheMetadata=3940814882532731480,7457286481875320463