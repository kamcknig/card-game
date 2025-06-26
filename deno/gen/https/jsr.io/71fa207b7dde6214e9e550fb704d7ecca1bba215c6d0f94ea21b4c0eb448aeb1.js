import { isRegExp as isRegExpToolkit } from '../../predicate/isRegExp.ts';
/**
 * Checks if `value` is a RegExp.
 *
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a RegExp, `false` otherwise.
 *
 * @example
 * const value1 = /abc/;
 * const value2 = '/abc/';
 *
 * console.log(isRegExp(value1)); // true
 * console.log(isRegExp(value2)); // false
 */ export function isRegExp(value) {
  return isRegExpToolkit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzUmVnRXhwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzUmVnRXhwIGFzIGlzUmVnRXhwVG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc1JlZ0V4cC50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBSZWdFeHAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIFJlZ0V4cCwgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IC9hYmMvO1xuICogY29uc3QgdmFsdWUyID0gJy9hYmMvJztcbiAqXG4gKiBjb25zb2xlLmxvZyhpc1JlZ0V4cCh2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNSZWdFeHAodmFsdWUyKSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlZ0V4cCh2YWx1ZT86IHVua25vd24pOiB2YWx1ZSBpcyBSZWdFeHAge1xuICByZXR1cm4gaXNSZWdFeHBUb29sa2l0KHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFlBQVksZUFBZSxRQUFRLDhCQUE4QjtBQUUxRTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsU0FBUyxLQUFlO0VBQ3RDLE9BQU8sZ0JBQWdCO0FBQ3pCIn0=
// denoCacheMetadata=15075811420814417200,406903431629963901