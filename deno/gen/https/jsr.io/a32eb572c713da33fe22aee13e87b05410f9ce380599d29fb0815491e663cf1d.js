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
  return value instanceof Map;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNNYXAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBgTWFwYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBhbHNvIHNlcnZlIGFzIGEgdHlwZSBwcmVkaWNhdGUgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBgTWFwYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhIGBNYXBgLlxuICogQHJldHVybnMge3ZhbHVlIGlzIE1hcDxhbnksIGFueT59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBgTWFwYCwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSBuZXcgTWFwKCk7XG4gKiBjb25zdCB2YWx1ZTIgPSBuZXcgU2V0KCk7XG4gKiBjb25zdCB2YWx1ZTMgPSBuZXcgV2Vha01hcCgpO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzTWFwKHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc01hcCh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzTWFwKHZhbHVlMykpOyAvLyBmYWxzZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpc01hcCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIE1hcDxhbnksIGFueT4ge1xuICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBNYXA7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FFRCxPQUFPLFNBQVMsTUFBTSxLQUFjO0VBQ2xDLE9BQU8saUJBQWlCO0FBQzFCIn0=
// denoCacheMetadata=8606832425459254211,813508497629643060