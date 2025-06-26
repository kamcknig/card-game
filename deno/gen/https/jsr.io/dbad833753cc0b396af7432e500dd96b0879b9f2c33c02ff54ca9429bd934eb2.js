import { isDate as isDateToolkit } from '../../predicate/isDate.ts';
/**
 * Checks if `value` is a Date object.
 *
 * @param {unknown} value The value to check.
 * @returns {value is Date} Returns `true` if `value` is a Date object, `false` otherwise.
 *
 * @example
 * const value1 = new Date();
 * const value2 = '2024-01-01';
 *
 * console.log(isDate(value1)); // true
 * console.log(isDate(value2)); // false
 */ export function isDate(value) {
  return isDateToolkit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzRGF0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0RhdGUgYXMgaXNEYXRlVG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc0RhdGUudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgRGF0ZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgRGF0ZX0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIERhdGUgb2JqZWN0LCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IERhdGUoKTtcbiAqIGNvbnN0IHZhbHVlMiA9ICcyMDI0LTAxLTAxJztcbiAqXG4gKiBjb25zb2xlLmxvZyhpc0RhdGUodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzRGF0ZSh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRGF0ZSh2YWx1ZT86IHVua25vd24pOiB2YWx1ZSBpcyBEYXRlIHtcbiAgcmV0dXJuIGlzRGF0ZVRvb2xraXQodmFsdWUpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsVUFBVSxhQUFhLFFBQVEsNEJBQTRCO0FBRXBFOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxPQUFPLEtBQWU7RUFDcEMsT0FBTyxjQUFjO0FBQ3ZCIn0=
// denoCacheMetadata=14768141871953973570,5784539624958783621