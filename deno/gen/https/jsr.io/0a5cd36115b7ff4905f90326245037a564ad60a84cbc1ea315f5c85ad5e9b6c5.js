import { flatten } from '../../array/flatten.ts';
/**
 * Concatenates multiple arrays and values into a single array.
 *
 * @template T The type of elements in the array.
 * @param {...(T | T[])} values - The values and/or arrays to concatenate.
 * @returns {T[]} A new array containing all the input values.
 *
 * @example
 * // Concatenate individual values
 * concat(1, 2, 3);
 * // returns [1, 2, 3]
 *
 * @example
 * // Concatenate arrays of values
 * concat([1, 2], [3, 4]);
 * // returns [1, 2, 3, 4]
 *
 * @example
 * // Concatenate a mix of individual values and arrays
 * concat(1, [2, 3], 4);
 * // returns [1, 2, 3, 4]
 *
 * @example
 * // Concatenate nested arrays
 * concat([1, [2, 3]], 4);
 * // returns [1, [2, 3], 4]
 */ export function concat(...values) {
  return flatten(values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvY29uY2F0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZsYXR0ZW4gfSBmcm9tICcuLi8uLi9hcnJheS9mbGF0dGVuLnRzJztcblxuLyoqXG4gKiBDb25jYXRlbmF0ZXMgbXVsdGlwbGUgYXJyYXlzIGFuZCB2YWx1ZXMgaW50byBhIHNpbmdsZSBhcnJheS5cbiAqXG4gKiBAdGVtcGxhdGUgVCBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0gey4uLihUIHwgVFtdKX0gdmFsdWVzIC0gVGhlIHZhbHVlcyBhbmQvb3IgYXJyYXlzIHRvIGNvbmNhdGVuYXRlLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgY29udGFpbmluZyBhbGwgdGhlIGlucHV0IHZhbHVlcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ29uY2F0ZW5hdGUgaW5kaXZpZHVhbCB2YWx1ZXNcbiAqIGNvbmNhdCgxLCAyLCAzKTtcbiAqIC8vIHJldHVybnMgWzEsIDIsIDNdXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENvbmNhdGVuYXRlIGFycmF5cyBvZiB2YWx1ZXNcbiAqIGNvbmNhdChbMSwgMl0sIFszLCA0XSk7XG4gKiAvLyByZXR1cm5zIFsxLCAyLCAzLCA0XVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDb25jYXRlbmF0ZSBhIG1peCBvZiBpbmRpdmlkdWFsIHZhbHVlcyBhbmQgYXJyYXlzXG4gKiBjb25jYXQoMSwgWzIsIDNdLCA0KTtcbiAqIC8vIHJldHVybnMgWzEsIDIsIDMsIDRdXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENvbmNhdGVuYXRlIG5lc3RlZCBhcnJheXNcbiAqIGNvbmNhdChbMSwgWzIsIDNdXSwgNCk7XG4gKiAvLyByZXR1cm5zIFsxLCBbMiwgM10sIDRdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25jYXQ8VD4oLi4udmFsdWVzOiBBcnJheTxUIHwgcmVhZG9ubHkgVFtdPik6IFRbXSB7XG4gIHJldHVybiBmbGF0dGVuKHZhbHVlcykgYXMgVFtdO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsT0FBTyxRQUFRLHlCQUF5QjtBQUVqRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EwQkMsR0FDRCxPQUFPLFNBQVMsT0FBVSxHQUFHLE1BQStCO0VBQzFELE9BQU8sUUFBUTtBQUNqQiJ9
// denoCacheMetadata=14501777836644259765,5836337680491606470