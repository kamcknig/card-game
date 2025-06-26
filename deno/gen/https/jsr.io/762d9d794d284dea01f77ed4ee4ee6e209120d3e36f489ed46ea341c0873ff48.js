/**
 * Checks if `value` is a RegExp.
 *
 * @param {unknown} value The value to check.
 * @returns {value is RegExp} Returns `true` if `value` is a RegExp, `false` otherwise.
 *
 * @example
 * const value1 = /abc/;
 * const value2 = '/abc/';
 *
 * console.log(isRegExp(value1)); // true
 * console.log(isRegExp(value2)); // false
 */ export function isRegExp(value) {
  return value instanceof RegExp;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNSZWdFeHAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIFJlZ0V4cC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBSZWdFeHB9IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBSZWdFeHAsIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSAvYWJjLztcbiAqIGNvbnN0IHZhbHVlMiA9ICcvYWJjLyc7XG4gKlxuICogY29uc29sZS5sb2coaXNSZWdFeHAodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzUmVnRXhwKHZhbHVlMikpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNSZWdFeHAodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSZWdFeHAge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBSZWdFeHA7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsS0FBYztFQUNyQyxPQUFPLGlCQUFpQjtBQUMxQiJ9
// denoCacheMetadata=11778034986115330416,37062363591938052