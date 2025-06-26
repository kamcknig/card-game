/**
 * Checks if a given value is null or undefined.
 *
 * This function tests whether the provided value is either `null` or `undefined`.
 * It returns `true` if the value is `null` or `undefined`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `null` or `undefined`.
 *
 * @param {unknown} x - The value to test for null or undefined.
 * @returns {boolean} `true` if the value is null or undefined, `false` otherwise.
 *
 * @example
 * const value1 = null;
 * const value2 = undefined;
 * const value3 = 42;
 * const result1 = isNil(value1); // true
 * const result2 = isNil(value2); // true
 * const result3 = isNil(value3); // false
 */ export function isNil(x) {
  return x == null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzTmlsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgbnVsbCBvciB1bmRlZmluZWQuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0ZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCB2YWx1ZSBpcyBlaXRoZXIgYG51bGxgIG9yIGB1bmRlZmluZWRgLlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGBudWxsYCBvciBgdW5kZWZpbmVkYCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBudWxsYCBvciBgdW5kZWZpbmVkYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHggLSBUaGUgdmFsdWUgdG8gdGVzdCBmb3IgbnVsbCBvciB1bmRlZmluZWQuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBudWxsIG9yIHVuZGVmaW5lZCwgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IG51bGw7XG4gKiBjb25zdCB2YWx1ZTIgPSB1bmRlZmluZWQ7XG4gKiBjb25zdCB2YWx1ZTMgPSA0MjtcbiAqIGNvbnN0IHJlc3VsdDEgPSBpc05pbCh2YWx1ZTEpOyAvLyB0cnVlXG4gKiBjb25zdCByZXN1bHQyID0gaXNOaWwodmFsdWUyKTsgLy8gdHJ1ZVxuICogY29uc3QgcmVzdWx0MyA9IGlzTmlsKHZhbHVlMyk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc05pbCh4PzogdW5rbm93bik6IHggaXMgbnVsbCB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiB4ID09IG51bGw7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxNQUFNLENBQVc7RUFDL0IsT0FBTyxLQUFLO0FBQ2QifQ==
// denoCacheMetadata=7679900744030346821,12772749046499760258