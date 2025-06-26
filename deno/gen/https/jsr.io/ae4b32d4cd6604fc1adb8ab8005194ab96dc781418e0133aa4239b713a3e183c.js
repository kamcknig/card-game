import { isSet as isSetToolkit } from '../../predicate/isSet.ts';
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
  return isSetToolkit(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzU2V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzU2V0IGFzIGlzU2V0VG9vbGtpdCB9IGZyb20gJy4uLy4uL3ByZWRpY2F0ZS9pc1NldC50cyc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgYFNldGAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYFNldGAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2sgaWYgaXQgaXMgYSBgU2V0YC5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBTZXQ8YW55Pn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIGBTZXRgLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IG5ldyBTZXQoKTtcbiAqIGNvbnN0IHZhbHVlMiA9IG5ldyBNYXAoKTtcbiAqIGNvbnN0IHZhbHVlMyA9IG5ldyBXZWFrU2V0KCk7XG4gKlxuICogY29uc29sZS5sb2coaXNTZXQodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzU2V0KHZhbHVlMikpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNTZXQodmFsdWUzKSk7IC8vIGZhbHNlXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2V0KHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIFNldDxhbnk+IHtcbiAgcmV0dXJuIGlzU2V0VG9vbGtpdCh2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxTQUFTLFlBQVksUUFBUSwyQkFBMkI7QUFFakU7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FFRCxPQUFPLFNBQVMsTUFBTSxLQUFlO0VBQ25DLE9BQU8sYUFBYTtBQUN0QiJ9
// denoCacheMetadata=18298973356229127700,15012688216266005831