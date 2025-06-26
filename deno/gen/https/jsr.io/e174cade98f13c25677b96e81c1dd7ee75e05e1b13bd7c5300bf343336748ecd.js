/**
 * Checks if the given value is not null nor undefined.
 *
 * The main use of this function is to be used with TypeScript as a type predicate.
 *
 * @template T - The type of value.
 * @param {T | null | undefined} x - The value to test if it is not null nor undefined.
 * @returns {x is T} True if the value is not null nor undefined, false otherwise.
 *
 * @example
 * // Here the type of `arr` is (number | undefined)[]
 * const arr = [1, undefined, 3];
 * // Here the type of `result` is number[]
 * const result = arr.filter(isNotNil);
 * // result will be [1, 3]
 */ export function isNotNil(x) {
  return x != null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNOb3ROaWwudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgdGhlIGdpdmVuIHZhbHVlIGlzIG5vdCBudWxsIG5vciB1bmRlZmluZWQuXG4gKlxuICogVGhlIG1haW4gdXNlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gYmUgdXNlZCB3aXRoIFR5cGVTY3JpcHQgYXMgYSB0eXBlIHByZWRpY2F0ZS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIHZhbHVlLlxuICogQHBhcmFtIHtUIHwgbnVsbCB8IHVuZGVmaW5lZH0geCAtIFRoZSB2YWx1ZSB0byB0ZXN0IGlmIGl0IGlzIG5vdCBudWxsIG5vciB1bmRlZmluZWQuXG4gKiBAcmV0dXJucyB7eCBpcyBUfSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyBub3QgbnVsbCBub3IgdW5kZWZpbmVkLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEhlcmUgdGhlIHR5cGUgb2YgYGFycmAgaXMgKG51bWJlciB8IHVuZGVmaW5lZClbXVxuICogY29uc3QgYXJyID0gWzEsIHVuZGVmaW5lZCwgM107XG4gKiAvLyBIZXJlIHRoZSB0eXBlIG9mIGByZXN1bHRgIGlzIG51bWJlcltdXG4gKiBjb25zdCByZXN1bHQgPSBhcnIuZmlsdGVyKGlzTm90TmlsKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIFsxLCAzXVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOb3ROaWw8VD4oeDogVCB8IG51bGwgfCB1bmRlZmluZWQpOiB4IGlzIFQge1xuICByZXR1cm4geCAhPSBudWxsO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Q0FlQyxHQUNELE9BQU8sU0FBUyxTQUFZLENBQXVCO0VBQ2pELE9BQU8sS0FBSztBQUNkIn0=
// denoCacheMetadata=7382322345792263354,2064847250565811428