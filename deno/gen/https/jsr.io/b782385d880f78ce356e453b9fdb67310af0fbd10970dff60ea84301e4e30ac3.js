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
  return (...args)=>!func(...args);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9uZWdhdGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBuZWdhdGVzIHRoZSByZXN1bHQgb2YgdGhlIHByZWRpY2F0ZSBmdW5jdGlvbi5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIHRoZSBmdW5jdGlvbiB0byBuZWdhdGUuXG4gKiBAcGFyYW0ge0Z9IGZ1bmMgLSBUaGUgZnVuY3Rpb24gdG8gbmVnYXRlLlxuICogQHJldHVybnMge0Z9IFRoZSBuZXcgbmVnYXRlZCBmdW5jdGlvbiwgd2hpY2ggbmVnYXRlcyB0aGUgYm9vbGVhbiByZXN1bHQgb2YgYGZ1bmNgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheSA9IFsxLCAyLCAzLCA0LCA1LCA2XTtcbiAqIGNvbnN0IGlzRXZlbiA9IChuOiBudW1iZXIpID0+IG4gJSAyID09PSAwO1xuICogY29uc3QgcmVzdWx0ID0gYXJyYXkuZmlsdGVyKG5lZ2F0ZShpc0V2ZW4pKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIFsxLCAzLCA1XVxuICovXG5leHBvcnQgZnVuY3Rpb24gbmVnYXRlPEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGJvb2xlYW4+KGZ1bmM6IEYpOiBGIHtcbiAgcmV0dXJuICgoLi4uYXJnczogYW55W10pID0+ICFmdW5jKC4uLmFyZ3MpKSBhcyBGO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxPQUE4QyxJQUFPO0VBQ25FLE9BQVEsQ0FBQyxHQUFHLE9BQWdCLENBQUMsUUFBUTtBQUN2QyJ9
// denoCacheMetadata=6559798431283271062,15615041393542020019