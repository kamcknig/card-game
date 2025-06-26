/**
 * Creates a function that negates the result of the predicate function.
 *
 * @template F - The type of the function to negate.
 * @param {F} func - The function to negate.
 * @returns {F} The new negated function, which negates the boolean result of `func`.
 *
 * @example
 * const array = [1, 2, 3, 4, 5, 6];
 * const isEven = (n: number) => n % 2 === 0;
 * const result = array.filter(negate(isEven));
 * // result will be [1, 3, 5]
 */ export function negate(func) {
  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }
  return function(...args) {
    return !func.apply(this, args);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vbmVnYXRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgbmVnYXRlcyB0aGUgcmVzdWx0IG9mIHRoZSBwcmVkaWNhdGUgZnVuY3Rpb24uXG4gKlxuICogQHRlbXBsYXRlIEYgLSBUaGUgdHlwZSBvZiB0aGUgZnVuY3Rpb24gdG8gbmVnYXRlLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIG5lZ2F0ZS5cbiAqIEByZXR1cm5zIHtGfSBUaGUgbmV3IG5lZ2F0ZWQgZnVuY3Rpb24sIHdoaWNoIG5lZ2F0ZXMgdGhlIGJvb2xlYW4gcmVzdWx0IG9mIGBmdW5jYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNSwgNl07XG4gKiBjb25zdCBpc0V2ZW4gPSAobjogbnVtYmVyKSA9PiBuICUgMiA9PT0gMDtcbiAqIGNvbnN0IHJlc3VsdCA9IGFycmF5LmZpbHRlcihuZWdhdGUoaXNFdmVuKSk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMSwgMywgNV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5lZ2F0ZTxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBib29sZWFuPihmdW5jOiBGKTogRiB7XG4gIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgZnVuY3Rpb24nKTtcbiAgfVxuICByZXR1cm4gZnVuY3Rpb24gKHRoaXM6IGFueSwgLi4uYXJnczogYW55W10pIHtcbiAgICByZXR1cm4gIWZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gIH0gYXMgRjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsT0FBOEMsSUFBTztFQUNuRSxJQUFJLE9BQU8sU0FBUyxZQUFZO0lBQzlCLE1BQU0sSUFBSSxVQUFVO0VBQ3RCO0VBQ0EsT0FBTyxTQUFxQixHQUFHLElBQVc7SUFDeEMsT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTtFQUMzQjtBQUNGIn0=
// denoCacheMetadata=2502727114359223304,7174803872201788834