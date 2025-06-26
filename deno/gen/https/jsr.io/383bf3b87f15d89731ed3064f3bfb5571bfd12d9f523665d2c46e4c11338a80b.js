/**
 * Checks if the given value is object-like.
 *
 * A value is object-like if its type is object and it is not null.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to an object-like value.
 *
 * @template T - The type of value.
 * @param {T} value - The value to test if it is an object-like.
 * @returns {value is object} `true` if the value is an object-like, `false` otherwise.
 *
 * @example
 * const value1 = { a: 1 };
 * const value2 = [1, 2, 3];
 * const value3 = 'abc';
 * const value4 = () => {};
 * const value5 = null;
 *
 * console.log(isObjectLike(value1)); // true
 * console.log(isObjectLike(value2)); // true
 * console.log(isObjectLike(value3)); // false
 * console.log(isObjectLike(value4)); // false
 * console.log(isObjectLike(value5)); // false
 */ export function isObjectLike(value) {
  return typeof value === 'object' && value !== null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzT2JqZWN0TGlrZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgb2JqZWN0LWxpa2UuXG4gKlxuICogQSB2YWx1ZSBpcyBvYmplY3QtbGlrZSBpZiBpdHMgdHlwZSBpcyBvYmplY3QgYW5kIGl0IGlzIG5vdCBudWxsLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGFuIG9iamVjdC1saWtlIHZhbHVlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgdmFsdWUuXG4gKiBAcGFyYW0ge1R9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHRlc3QgaWYgaXQgaXMgYW4gb2JqZWN0LWxpa2UuXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgb2JqZWN0fSBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGFuIG9iamVjdC1saWtlLCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0geyBhOiAxIH07XG4gKiBjb25zdCB2YWx1ZTIgPSBbMSwgMiwgM107XG4gKiBjb25zdCB2YWx1ZTMgPSAnYWJjJztcbiAqIGNvbnN0IHZhbHVlNCA9ICgpID0+IHt9O1xuICogY29uc3QgdmFsdWU1ID0gbnVsbDtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc09iamVjdExpa2UodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzT2JqZWN0TGlrZSh2YWx1ZTIpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNPYmplY3RMaWtlKHZhbHVlMykpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNPYmplY3RMaWtlKHZhbHVlNCkpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNPYmplY3RMaWtlKHZhbHVlNSkpOyAvLyBmYWxzZVxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpc09iamVjdExpa2UodmFsdWU/OiB1bmtub3duKTogdmFsdWUgaXMgb2JqZWN0IHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGw7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBdUJDLEdBRUQsT0FBTyxTQUFTLGFBQWEsS0FBZTtFQUMxQyxPQUFPLE9BQU8sVUFBVSxZQUFZLFVBQVU7QUFDaEQifQ==
// denoCacheMetadata=15868238070747496545,15856566881208126286