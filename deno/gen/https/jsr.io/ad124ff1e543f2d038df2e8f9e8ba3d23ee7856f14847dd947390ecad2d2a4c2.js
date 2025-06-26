/**
 * Performs a `SameValueZero` comparison between two values to determine if they are equivalent.
 *
 * @param {unknown} value - The value to compare.
 * @param {unknown} other - The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 *
 * @example
 * eq(1, 1); // true
 * eq(0, -0); // true
 * eq(NaN, NaN); // true
 * eq('a', Object('a')); // false
 */ export function eq(value, other) {
  return value === other || Number.isNaN(value) && Number.isNaN(other);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9lcS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFBlcmZvcm1zIGEgYFNhbWVWYWx1ZVplcm9gIGNvbXBhcmlzb24gYmV0d2VlbiB0d28gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZSBlcXVpdmFsZW50LlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7dW5rbm93bn0gb3RoZXIgLSBUaGUgb3RoZXIgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGVxKDEsIDEpOyAvLyB0cnVlXG4gKiBlcSgwLCAtMCk7IC8vIHRydWVcbiAqIGVxKE5hTiwgTmFOKTsgLy8gdHJ1ZVxuICogZXEoJ2EnLCBPYmplY3QoJ2EnKSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlcSh2YWx1ZT86IHVua25vd24sIG90aGVyPzogdW5rbm93bik6IGJvb2xlYW4ge1xuICByZXR1cm4gdmFsdWUgPT09IG90aGVyIHx8IChOdW1iZXIuaXNOYU4odmFsdWUpICYmIE51bWJlci5pc05hTihvdGhlcikpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxHQUFHLEtBQWUsRUFBRSxLQUFlO0VBQ2pELE9BQU8sVUFBVSxTQUFVLE9BQU8sS0FBSyxDQUFDLFVBQVUsT0FBTyxLQUFLLENBQUM7QUFDakUifQ==
// denoCacheMetadata=9760642926845860256,4559947341364828245