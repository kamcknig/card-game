/**
 * Checks if a given value is `Set`.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `Set`.
 *
 * @param {unknown} value The value to check if it is a `Set`.
 * @returns {value is Set<any>} Returns `true` if `value` is a `Set`, else `false`.
 *
 * @example
 * const value1 = new Set();
 * const value2 = new Map();
 * const value3 = new WeakSet();
 *
 * console.log(isSet(value1)); // true
 * console.log(isSet(value2)); // false
 * console.log(isSet(value3)); // false
 */ export function isSet(value) {
  return value instanceof Set;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNTZXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBgU2V0YC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBhbHNvIHNlcnZlIGFzIGEgdHlwZSBwcmVkaWNhdGUgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBgU2V0YC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhIGBTZXRgLlxuICogQHJldHVybnMge3ZhbHVlIGlzIFNldDxhbnk+fSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgYFNldGAsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IFNldCgpO1xuICogY29uc3QgdmFsdWUyID0gbmV3IE1hcCgpO1xuICogY29uc3QgdmFsdWUzID0gbmV3IFdlYWtTZXQoKTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc1NldCh2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNTZXQodmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc1NldCh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gaXNTZXQodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBTZXQ8YW55PiB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFNldDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUVELE9BQU8sU0FBUyxNQUFNLEtBQWM7RUFDbEMsT0FBTyxpQkFBaUI7QUFDMUIifQ==
// denoCacheMetadata=7954926334585061008,11203966962308756111