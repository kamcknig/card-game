import { isMap as isMapToolKit } from '../../predicate/isMap.ts';
/**
 * Checks if a given value is `Map`.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `Map`.
 *
 * @param {unknown} value The value to check if it is a `Map`.
 * @returns {value is Map<any, any>} Returns `true` if `value` is a `Map`, else `false`.
 *
 * @example
 * const value1 = new Map();
 * const value2 = new Set();
 * const value3 = new WeakMap();
 *
 * console.log(isMap(value1)); // true
 * console.log(isMap(value2)); // false
 * console.log(isMap(value3)); // false
 */ export function isMap(value) {
  return isMapToolKit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzTWFwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzTWFwIGFzIGlzTWFwVG9vbEtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc01hcC50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgYE1hcGAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYE1hcGAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2sgaWYgaXQgaXMgYSBgTWFwYC5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBNYXA8YW55LCBhbnk+fSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgYE1hcGAsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IE1hcCgpO1xuICogY29uc3QgdmFsdWUyID0gbmV3IFNldCgpO1xuICogY29uc3QgdmFsdWUzID0gbmV3IFdlYWtNYXAoKTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc01hcCh2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNNYXAodmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc01hcCh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gaXNNYXAodmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgTWFwPGFueSwgYW55PiB7XG4gIHJldHVybiBpc01hcFRvb2xLaXQodmFsdWUpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxZQUFZLFFBQVEsMkJBQTJCO0FBRWpFOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBRUQsT0FBTyxTQUFTLE1BQU0sS0FBZTtFQUNuQyxPQUFPLGFBQWE7QUFDdEIifQ==
// denoCacheMetadata=7869570227222238829,14098150779912655538