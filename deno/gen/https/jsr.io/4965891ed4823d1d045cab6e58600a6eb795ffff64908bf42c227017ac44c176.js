/**
 * Checks if `value` is a finite number.
 *
 * @param {unknown} value The value to check.
 * @returns {value is number} Returns `true` if `value` is a finite number, `false` otherwise.
 *
 * @example
 * ```typescript
 * const value1 = 100;
 * const value2 = Infinity;
 * const value3 = '100';
 *
 * console.log(isFinite(value1)); // true
 * console.log(isFinite(value2)); // false
 * console.log(isFinite(value3)); // false
 * ```
 */ export function isFinite(value) {
  return Number.isFinite(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzRmluaXRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBmaW5pdGUgbnVtYmVyLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHJldHVybnMge3ZhbHVlIGlzIG51bWJlcn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIGZpbml0ZSBudW1iZXIsIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zdCB2YWx1ZTEgPSAxMDA7XG4gKiBjb25zdCB2YWx1ZTIgPSBJbmZpbml0eTtcbiAqIGNvbnN0IHZhbHVlMyA9ICcxMDAnO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzRmluaXRlKHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0Zpbml0ZSh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzRmluaXRlKHZhbHVlMykpOyAvLyBmYWxzZVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Zpbml0ZSh2YWx1ZT86IHVua25vd24pOiB2YWx1ZSBpcyBudW1iZXIge1xuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxTQUFTLEtBQWU7RUFDdEMsT0FBTyxPQUFPLFFBQVEsQ0FBQztBQUN6QiJ9
// denoCacheMetadata=9310563559857578023,4501579492131787788