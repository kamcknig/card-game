/**
 * Checks if `value` is a safe integer (between -(2^53 – 1) and (2^53 – 1), inclusive).
 *
 * A safe integer is an integer that can be precisely represented as a `number` in JavaScript,
 * without any other integer being rounded to it.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `number`.
 *
 * @param {unknown} value - The value to check
 * @returns {boolean} `true` if `value` is an integer and between the safe values, otherwise `false`
 *
 * @example
 * isSafeInteger(3); // Returns: true
 * isSafeInteger(Number.MIN_SAFE_INTEGER - 1); // Returns: false
 * isSafeInteger(1n); // Returns: false
 * isSafeInteger('1'); // Returns: false
 */ export function isSafeInteger(value) {
  return Number.isSafeInteger(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzU2FmZUludGVnZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHNhZmUgaW50ZWdlciAoYmV0d2VlbiAtKDJeNTMg4oCTIDEpIGFuZCAoMl41MyDigJMgMSksIGluY2x1c2l2ZSkuXG4gKlxuICogQSBzYWZlIGludGVnZXIgaXMgYW4gaW50ZWdlciB0aGF0IGNhbiBiZSBwcmVjaXNlbHkgcmVwcmVzZW50ZWQgYXMgYSBgbnVtYmVyYCBpbiBKYXZhU2NyaXB0LFxuICogd2l0aG91dCBhbnkgb3RoZXIgaW50ZWdlciBiZWluZyByb3VuZGVkIHRvIGl0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBudW1iZXJgLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBpbnRlZ2VyIGFuZCBiZXR3ZWVuIHRoZSBzYWZlIHZhbHVlcywgb3RoZXJ3aXNlIGBmYWxzZWBcbiAqXG4gKiBAZXhhbXBsZVxuICogaXNTYWZlSW50ZWdlcigzKTsgLy8gUmV0dXJuczogdHJ1ZVxuICogaXNTYWZlSW50ZWdlcihOdW1iZXIuTUlOX1NBRkVfSU5URUdFUiAtIDEpOyAvLyBSZXR1cm5zOiBmYWxzZVxuICogaXNTYWZlSW50ZWdlcigxbik7IC8vIFJldHVybnM6IGZhbHNlXG4gKiBpc1NhZmVJbnRlZ2VyKCcxJyk7IC8vIFJldHVybnM6IGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NhZmVJbnRlZ2VyKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIG51bWJlciB7XG4gIHJldHVybiBOdW1iZXIuaXNTYWZlSW50ZWdlcih2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsY0FBYyxLQUFlO0VBQzNDLE9BQU8sT0FBTyxhQUFhLENBQUM7QUFDOUIifQ==
// denoCacheMetadata=8760373745847444928,3855641404407671891