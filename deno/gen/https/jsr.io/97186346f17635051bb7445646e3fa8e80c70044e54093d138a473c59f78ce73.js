/**
 * Returns the default value for `null`, `undefined`, and `NaN`.
 *
 * @param {T | null | undefined} value - The value to check.
 * @param {T} [defaultValue] - The default value to return if the first value is null, undefined, or NaN.
 * @returns {T} Returns either the first value or the default value.
 *
 * @example
 * defaultTo(null, 'default') // returns 'default'
 * defaultTo(undefined, 42) // returns 42
 * defaultTo(NaN, 0) // returns 0
 * defaultTo('actual', 'default') // returns 'actual'
 * defaultTo(123, 0) // returns 123
 */ /**
 * Returns the default value for `null`, `undefined`, and `NaN`.
 *
 * @param {unknown} value - The value to check.
 * @param {unknown} defaultValue - The default value to return if the first value is null, undefined, or NaN.
 * @returns {any} Returns either the first value or the default value.
 *
 * @example
 * defaultTo(null, 'default') // returns 'default'
 * defaultTo(undefined, 42) // returns 42
 * defaultTo(NaN, 0) // returns 0
 * defaultTo('actual', 'default') // returns 'actual'
 * defaultTo(123, 0) // returns 123
 */ export function defaultTo(value, defaultValue) {
  if (value == null || Number.isNaN(value)) {
    return defaultValue;
  }
  return value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9kZWZhdWx0VG8udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXR1cm5zIHRoZSBkZWZhdWx0IHZhbHVlIGZvciBgbnVsbGAsIGB1bmRlZmluZWRgLCBhbmQgYE5hTmAuXG4gKlxuICogQHBhcmFtIHtUIHwgbnVsbCB8IHVuZGVmaW5lZH0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0ge1R9IFtkZWZhdWx0VmFsdWVdIC0gVGhlIGRlZmF1bHQgdmFsdWUgdG8gcmV0dXJuIGlmIHRoZSBmaXJzdCB2YWx1ZSBpcyBudWxsLCB1bmRlZmluZWQsIG9yIE5hTi5cbiAqIEByZXR1cm5zIHtUfSBSZXR1cm5zIGVpdGhlciB0aGUgZmlyc3QgdmFsdWUgb3IgdGhlIGRlZmF1bHQgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGRlZmF1bHRUbyhudWxsLCAnZGVmYXVsdCcpIC8vIHJldHVybnMgJ2RlZmF1bHQnXG4gKiBkZWZhdWx0VG8odW5kZWZpbmVkLCA0MikgLy8gcmV0dXJucyA0MlxuICogZGVmYXVsdFRvKE5hTiwgMCkgLy8gcmV0dXJucyAwXG4gKiBkZWZhdWx0VG8oJ2FjdHVhbCcsICdkZWZhdWx0JykgLy8gcmV0dXJucyAnYWN0dWFsJ1xuICogZGVmYXVsdFRvKDEyMywgMCkgLy8gcmV0dXJucyAxMjNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRUbzxUPih2YWx1ZTogVCB8IG51bGwgfCB1bmRlZmluZWQsIGRlZmF1bHRWYWx1ZT86IFQpOiBUO1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGRlZmF1bHQgdmFsdWUgZm9yIGBudWxsYCwgYHVuZGVmaW5lZGAsIGFuZCBgTmFOYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIC0gVGhlIHZhbHVlIHRvIGNoZWNrLlxuICogQHBhcmFtIHt1bmtub3dufSBkZWZhdWx0VmFsdWUgLSBUaGUgZGVmYXVsdCB2YWx1ZSB0byByZXR1cm4gaWYgdGhlIGZpcnN0IHZhbHVlIGlzIG51bGwsIHVuZGVmaW5lZCwgb3IgTmFOLlxuICogQHJldHVybnMge2FueX0gUmV0dXJucyBlaXRoZXIgdGhlIGZpcnN0IHZhbHVlIG9yIHRoZSBkZWZhdWx0IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBkZWZhdWx0VG8obnVsbCwgJ2RlZmF1bHQnKSAvLyByZXR1cm5zICdkZWZhdWx0J1xuICogZGVmYXVsdFRvKHVuZGVmaW5lZCwgNDIpIC8vIHJldHVybnMgNDJcbiAqIGRlZmF1bHRUbyhOYU4sIDApIC8vIHJldHVybnMgMFxuICogZGVmYXVsdFRvKCdhY3R1YWwnLCAnZGVmYXVsdCcpIC8vIHJldHVybnMgJ2FjdHVhbCdcbiAqIGRlZmF1bHRUbygxMjMsIDApIC8vIHJldHVybnMgMTIzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZhdWx0VG8odmFsdWU/OiB1bmtub3duLCBkZWZhdWx0VmFsdWU/OiB1bmtub3duKTogYW55IHtcbiAgaWYgKHZhbHVlID09IG51bGwgfHwgTnVtYmVyLmlzTmFOKHZhbHVlKSkge1xuICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gIH1cblxuICByZXR1cm4gdmFsdWU7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Q0FhQyxHQUdEOzs7Ozs7Ozs7Ozs7O0NBYUMsR0FDRCxPQUFPLFNBQVMsVUFBVSxLQUFlLEVBQUUsWUFBc0I7RUFDL0QsSUFBSSxTQUFTLFFBQVEsT0FBTyxLQUFLLENBQUMsUUFBUTtJQUN4QyxPQUFPO0VBQ1Q7RUFFQSxPQUFPO0FBQ1QifQ==
// denoCacheMetadata=646124129899144900,10122322743689619661