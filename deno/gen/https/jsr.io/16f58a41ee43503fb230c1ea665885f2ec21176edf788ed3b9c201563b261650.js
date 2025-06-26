import { isWeakMap as isWeakMapToolkit } from '../../predicate/isWeakMap.ts';
/**
 * Checks if the given value is a `WeakMap`.
 *
 * This function tests whether the provided value is an instance of `WeakMap`.
 * It returns `true` if the value is a `WeakMap`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `WeakMap`.
 *
 * @param {unknown} value - The value to test if it is a `WeakMap`.
 * @returns {value is WeakMap<WeakKey, any>} true if the value is a `WeakMap`, false otherwise.
 *
 * @example
 * const value1 = new WeakMap();
 * const value2 = new Map();
 * const value3 = new Set();
 *
 * console.log(isWeakMap(value1)); // true
 * console.log(isWeakMap(value2)); // false
 * console.log(isWeakMap(value3)); // false
 */ export function isWeakMap(value) {
  return isWeakMapToolkit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzV2Vha01hcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1dlYWtNYXAgYXMgaXNXZWFrTWFwVG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc1dlYWtNYXAudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgYSBgV2Vha01hcGAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0ZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCB2YWx1ZSBpcyBhbiBpbnN0YW5jZSBvZiBgV2Vha01hcGAuXG4gKiBJdCByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYSBgV2Vha01hcGAsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGNhbiBhbHNvIHNlcnZlIGFzIGEgdHlwZSBwcmVkaWNhdGUgaW4gVHlwZVNjcmlwdCwgbmFycm93aW5nIHRoZSB0eXBlIG9mIHRoZSBhcmd1bWVudCB0byBgV2Vha01hcGAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byB0ZXN0IGlmIGl0IGlzIGEgYFdlYWtNYXBgLlxuICogQHJldHVybnMge3ZhbHVlIGlzIFdlYWtNYXA8V2Vha0tleSwgYW55Pn0gdHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYSBgV2Vha01hcGAsIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IFdlYWtNYXAoKTtcbiAqIGNvbnN0IHZhbHVlMiA9IG5ldyBNYXAoKTtcbiAqIGNvbnN0IHZhbHVlMyA9IG5ldyBTZXQoKTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc1dlYWtNYXAodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzV2Vha01hcCh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzV2Vha01hcCh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzV2Vha01hcCh2YWx1ZT86IHVua25vd24pOiB2YWx1ZSBpcyBXZWFrTWFwPFdlYWtLZXksIGFueT4ge1xuICByZXR1cm4gaXNXZWFrTWFwVG9vbGtpdCh2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxhQUFhLGdCQUFnQixRQUFRLCtCQUErQjtBQUU3RTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW1CQyxHQUNELE9BQU8sU0FBUyxVQUFVLEtBQWU7RUFDdkMsT0FBTyxpQkFBaUI7QUFDMUIifQ==
// denoCacheMetadata=12085860860196622380,1677810156083963769