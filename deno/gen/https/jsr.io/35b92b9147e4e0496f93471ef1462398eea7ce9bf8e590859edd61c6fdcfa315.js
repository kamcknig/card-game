/**
 * Checks if a given value is a number.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `number`.
 *
 * @param {unknown} value The value to check if it is a number.
 * @returns {value is number} Returns `true` if `value` is a number, else `false`.
 *
 * @example
 * const value1 = 123;
 * const value2 = 'abc';
 * const value3 = true;
 *
 * console.log(isNumber(value1)); // true
 * console.log(isNumber(value2)); // false
 * console.log(isNumber(value3)); // false
 */ export function isNumber(value) {
  return typeof value === 'number' || value instanceof Number;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzTnVtYmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgYSBudW1iZXIuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYG51bWJlcmAuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2sgaWYgaXQgaXMgYSBudW1iZXIuXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgbnVtYmVyfSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgbnVtYmVyLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IDEyMztcbiAqIGNvbnN0IHZhbHVlMiA9ICdhYmMnO1xuICogY29uc3QgdmFsdWUzID0gdHJ1ZTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc051bWJlcih2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNOdW1iZXIodmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc051bWJlcih2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTnVtYmVyKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIG51bWJlciB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHZhbHVlIGluc3RhbmNlb2YgTnVtYmVyO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsS0FBZTtFQUN0QyxPQUFPLE9BQU8sVUFBVSxZQUFZLGlCQUFpQjtBQUN2RCJ9
// denoCacheMetadata=11015103953057665008,7544702178344324839