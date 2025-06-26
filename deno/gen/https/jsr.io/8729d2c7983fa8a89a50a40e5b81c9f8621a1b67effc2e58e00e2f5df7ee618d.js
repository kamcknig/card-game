/**
 * Checks if the given value is an array.
 *
 * This function tests whether the provided value is an array or not.
 * It returns `true` if the value is an array, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to an array.
 *
 * @param {unknown} value - The value to test if it is an array.
 * @returns {value is any[]} `true` if the value is an array, `false` otherwise.
 *
 * @example
 * const value1 = [1, 2, 3];
 * const value2 = 'abc';
 * const value3 = () => {};
 *
 * console.log(isArray(value1)); // true
 * console.log(isArray(value2)); // false
 * console.log(isArray(value3)); // false
 */ export function isArray(value) {
  return Array.isArray(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQXJyYXkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgdGhlIGdpdmVuIHZhbHVlIGlzIGFuIGFycmF5LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGVzdHMgd2hldGhlciB0aGUgcHJvdmlkZWQgdmFsdWUgaXMgYW4gYXJyYXkgb3Igbm90LlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGFuIGFycmF5LCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYW4gYXJyYXkuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byB0ZXN0IGlmIGl0IGlzIGFuIGFycmF5LlxuICogQHJldHVybnMge3ZhbHVlIGlzIGFueVtdfSBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGFuIGFycmF5LCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gWzEsIDIsIDNdO1xuICogY29uc3QgdmFsdWUyID0gJ2FiYyc7XG4gKiBjb25zdCB2YWx1ZTMgPSAoKSA9PiB7fTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc0FycmF5KHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0FycmF5KHZhbHVlMikpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNBcnJheSh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXkodmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgYW55W10ge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsUUFBUSxLQUFlO0VBQ3JDLE9BQU8sTUFBTSxPQUFPLENBQUM7QUFDdkIifQ==
// denoCacheMetadata=6778996403522821234,7858356419001589840