/**
 * Check whether a value is a symbol.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `symbol`.
 *
 * @param {unknown} value The value to check.
 * @returns {value is symbol} Returns `true` if `value` is a symbol, else `false`.
 * @example
 * isSymbol(Symbol.iterator);
 * // => true
 *
 * isSymbol('abc');
 * // => false
 */ export function isSymbol(value) {
  return typeof value === 'symbol' || value instanceof Symbol;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzU3ltYm9sLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2sgd2hldGhlciBhIHZhbHVlIGlzIGEgc3ltYm9sLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBzeW1ib2xgLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge3ZhbHVlIGlzIHN5bWJvbH0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHN5bWJvbCwgZWxzZSBgZmFsc2VgLlxuICogQGV4YW1wbGVcbiAqIGlzU3ltYm9sKFN5bWJvbC5pdGVyYXRvcik7XG4gKiAvLyA9PiB0cnVlXG4gKlxuICogaXNTeW1ib2woJ2FiYycpO1xuICogLy8gPT4gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU3ltYm9sKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIHN5bWJvbCB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnIHx8IHZhbHVlIGluc3RhbmNlb2YgU3ltYm9sO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsU0FBUyxLQUFlO0VBQ3RDLE9BQU8sT0FBTyxVQUFVLFlBQVksaUJBQWlCO0FBQ3ZEIn0=
// denoCacheMetadata=10806301396922762642,1577172636791365399