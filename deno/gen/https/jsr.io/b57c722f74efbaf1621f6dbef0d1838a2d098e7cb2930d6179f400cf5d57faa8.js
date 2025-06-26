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
  return typeof value === 'string';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNTdHJpbmcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBzdHJpbmcuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYHN0cmluZ2AuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2sgaWYgaXQgaXMgc3RyaW5nLlxuICogQHJldHVybnMge3ZhbHVlIGlzIHN0cmluZ30gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHN0cmluZywgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSAnYWJjJztcbiAqIGNvbnN0IHZhbHVlMiA9IDEyMztcbiAqIGNvbnN0IHZhbHVlMyA9IHRydWU7XG4gKlxuICogY29uc29sZS5sb2coaXNTdHJpbmcodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzU3RyaW5nKHZhbHVlMikpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNTdHJpbmcodmFsdWUzKSk7IC8vIGZhbHNlXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU3RyaW5nKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZyc7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FFRCxPQUFPLFNBQVMsU0FBUyxLQUFjO0VBQ3JDLE9BQU8sT0FBTyxVQUFVO0FBQzFCIn0=
// denoCacheMetadata=17235886588817490808,8479495249250530417