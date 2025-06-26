import { isWeakSet as isWeakSetToolkit } from '../../predicate/isWeakSet.ts';
/**
 * Checks if the given value is a `WeakSet`.
 *
 * This function tests whether the provided value is an instance of `WeakSet`.
 * It returns `true` if the value is a `WeakSet`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `WeakSet`.
 *
 * @param {unknown} value - The value to test if it is a `WeakSet`.
 * @returns {value is WeakSet<WeakKey>} true if the value is a `WeakSet`, false otherwise.
 *
 * @example
 * const value1 = new WeakSet();
 * const value2 = new Map();
 * const value3 = new Set();
 *
 * console.log(isWeakSet(value1)); // true
 * console.log(isWeakSet(value2)); // false
 * console.log(isWeakSet(value3)); // false
 */ export function isWeakSet(value) {
  return isWeakSetToolkit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzV2Vha1NldC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1dlYWtTZXQgYXMgaXNXZWFrU2V0VG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc1dlYWtTZXQudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgYSBgV2Vha1NldGAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0ZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCB2YWx1ZSBpcyBhbiBpbnN0YW5jZSBvZiBgV2Vha1NldGAuXG4gKiBJdCByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYSBgV2Vha1NldGAsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBhbHNvIHNlcnZlIGFzIGEgdHlwZSBwcmVkaWNhdGUgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBgV2Vha1NldGAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byB0ZXN0IGlmIGl0IGlzIGEgYFdlYWtTZXRgLlxuICogQHJldHVybnMge3ZhbHVlIGlzIFdlYWtTZXQ8V2Vha0tleT59IHRydWUgaWYgdGhlIHZhbHVlIGlzIGEgYFdlYWtTZXRgLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IG5ldyBXZWFrU2V0KCk7XG4gKiBjb25zdCB2YWx1ZTIgPSBuZXcgTWFwKCk7XG4gKiBjb25zdCB2YWx1ZTMgPSBuZXcgU2V0KCk7XG4gKlxuICogY29uc29sZS5sb2coaXNXZWFrU2V0KHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc1dlYWtTZXQodmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc1dlYWtTZXQodmFsdWUzKSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1dlYWtTZXQodmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgV2Vha1NldDxXZWFrS2V5PiB7XG4gIHJldHVybiBpc1dlYWtTZXRUb29sa2l0KHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLGFBQWEsZ0JBQWdCLFFBQVEsK0JBQStCO0FBRTdFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJDLEdBQ0QsT0FBTyxTQUFTLFVBQVUsS0FBZTtFQUN2QyxPQUFPLGlCQUFpQjtBQUMxQiJ9
// denoCacheMetadata=2920576421029843918,15902457377673190877