import { difference } from './difference.ts';
/**
 * Creates an array that excludes all specified values.
 *
 * It correctly excludes `NaN`, as it compares values using [SameValueZero](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-samevaluezero).
 *
 * @template T The type of elements in the array.
 * @param {T[]} array - The array to filter.
 * @param {...T[]} values - The values to exclude.
 * @returns {T[]} A new array without the specified values.
 *
 * @example
 * // Removes the specified values from the array
 * without([1, 2, 3, 4, 5], 2, 4);
 * // Returns: [1, 3, 5]
 *
 * @example
 * // Removes specified string values from the array
 * without(['a', 'b', 'c', 'a'], 'a');
 * // Returns: ['b', 'c']
 */ export function without(array, ...values) {
  return difference(array, values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS93aXRob3V0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRpZmZlcmVuY2UgfSBmcm9tICcuL2RpZmZlcmVuY2UudHMnO1xuXG4vKipcbiAqIENyZWF0ZXMgYW4gYXJyYXkgdGhhdCBleGNsdWRlcyBhbGwgc3BlY2lmaWVkIHZhbHVlcy5cbiAqXG4gKiBJdCBjb3JyZWN0bHkgZXhjbHVkZXMgYE5hTmAsIGFzIGl0IGNvbXBhcmVzIHZhbHVlcyB1c2luZyBbU2FtZVZhbHVlWmVyb10oaHR0cHM6Ly90YzM5LmVzL2VjbWEyNjIvbXVsdGlwYWdlL2Fic3RyYWN0LW9wZXJhdGlvbnMuaHRtbCNzZWMtc2FtZXZhbHVlemVybykuXG4gKlxuICogQHRlbXBsYXRlIFQgVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFycmF5IC0gVGhlIGFycmF5IHRvIGZpbHRlci5cbiAqIEBwYXJhbSB7Li4uVFtdfSB2YWx1ZXMgLSBUaGUgdmFsdWVzIHRvIGV4Y2x1ZGUuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSB3aXRob3V0IHRoZSBzcGVjaWZpZWQgdmFsdWVzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZW1vdmVzIHRoZSBzcGVjaWZpZWQgdmFsdWVzIGZyb20gdGhlIGFycmF5XG4gKiB3aXRob3V0KFsxLCAyLCAzLCA0LCA1XSwgMiwgNCk7XG4gKiAvLyBSZXR1cm5zOiBbMSwgMywgNV1cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmVtb3ZlcyBzcGVjaWZpZWQgc3RyaW5nIHZhbHVlcyBmcm9tIHRoZSBhcnJheVxuICogd2l0aG91dChbJ2EnLCAnYicsICdjJywgJ2EnXSwgJ2EnKTtcbiAqIC8vIFJldHVybnM6IFsnYicsICdjJ11cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpdGhvdXQ8VD4oYXJyYXk6IHJlYWRvbmx5IFRbXSwgLi4udmFsdWVzOiBUW10pOiBUW10ge1xuICByZXR1cm4gZGlmZmVyZW5jZShhcnJheSwgdmFsdWVzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFVBQVUsUUFBUSxrQkFBa0I7QUFFN0M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsUUFBVyxLQUFtQixFQUFFLEdBQUcsTUFBVztFQUM1RCxPQUFPLFdBQVcsT0FBTztBQUMzQiJ9
// denoCacheMetadata=16653753720052730237,519534297191921007