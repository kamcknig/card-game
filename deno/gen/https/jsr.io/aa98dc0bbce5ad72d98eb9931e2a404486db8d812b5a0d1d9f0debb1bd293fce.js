/**
 * Checks if a given value is string.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `string`.
 *
 * @param {unknown} value The value to check if it is string.
 * @returns {value is string} Returns `true` if `value` is a string, else `false`.
 *
 * @example
 * const value1 = 'abc';
 * const value2 = 123;
 * const value3 = true;
 *
 * console.log(isString(value1)); // true
 * console.log(isString(value2)); // false
 * console.log(isString(value3)); // false
 */ export function isString(value) {
  return typeof value === 'string' || value instanceof String;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzU3RyaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgc3RyaW5nLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBzdHJpbmdgLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrIGlmIGl0IGlzIHN0cmluZy5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBzdHJpbmd9IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBzdHJpbmcsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gJ2FiYyc7XG4gKiBjb25zdCB2YWx1ZTIgPSAxMjM7XG4gKiBjb25zdCB2YWx1ZTMgPSB0cnVlO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzU3RyaW5nKHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc1N0cmluZyh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzU3RyaW5nKHZhbHVlMykpOyAvLyBmYWxzZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZyh2YWx1ZT86IHVua25vd24pOiB2YWx1ZSBpcyBzdHJpbmcge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyB8fCB2YWx1ZSBpbnN0YW5jZW9mIFN0cmluZztcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUVELE9BQU8sU0FBUyxTQUFTLEtBQWU7RUFDdEMsT0FBTyxPQUFPLFVBQVUsWUFBWSxpQkFBaUI7QUFDdkQifQ==
// denoCacheMetadata=15570463945056950415,13337199879042637503