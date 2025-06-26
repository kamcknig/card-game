/**
 * Returns a new array containing the last `count` elements from the input array `arr`.
 * If `count` is greater than the length of `arr`, the entire array is returned.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to take elements from.
 * @param {number} [count=1] - The number of elements to take.
 * @returns {T[]} A new array containing the last `count` elements from `arr`.
 *
 * @example
 * // Returns [4, 5]
 * takeRight([1, 2, 3, 4, 5], 2);
 *
 * @example
 * // Returns ['b', 'c']
 * takeRight(['a', 'b', 'c'], 2);
 *
 * @example
 * // Returns [1, 2, 3]
 * takeRight([1, 2, 3], 5);
 */ export function takeRight(arr, count = 1) {
  if (count <= 0) {
    return [];
  }
  return arr.slice(-count);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS90YWtlUmlnaHQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXR1cm5zIGEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGxhc3QgYGNvdW50YCBlbGVtZW50cyBmcm9tIHRoZSBpbnB1dCBhcnJheSBgYXJyYC5cbiAqIElmIGBjb3VudGAgaXMgZ3JlYXRlciB0aGFuIHRoZSBsZW5ndGggb2YgYGFycmAsIHRoZSBlbnRpcmUgYXJyYXkgaXMgcmV0dXJuZWQuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIHRha2UgZWxlbWVudHMgZnJvbS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbY291bnQ9MV0gLSBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIHRha2UuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBsYXN0IGBjb3VudGAgZWxlbWVudHMgZnJvbSBgYXJyYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbNCwgNV1cbiAqIHRha2VSaWdodChbMSwgMiwgMywgNCwgNV0sIDIpO1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFsnYicsICdjJ11cbiAqIHRha2VSaWdodChbJ2EnLCAnYicsICdjJ10sIDIpO1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFsxLCAyLCAzXVxuICogdGFrZVJpZ2h0KFsxLCAyLCAzXSwgNSk7XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0YWtlUmlnaHQ8VD4oYXJyOiByZWFkb25seSBUW10sIGNvdW50ID0gMSk6IFRbXSB7XG4gIGlmIChjb3VudCA8PSAwKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIGFyci5zbGljZSgtY291bnQpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW9CQyxHQUNELE9BQU8sU0FBUyxVQUFhLEdBQWlCLEVBQUUsUUFBUSxDQUFDO0VBQ3ZELElBQUksU0FBUyxHQUFHO0lBQ2QsT0FBTyxFQUFFO0VBQ1g7RUFFQSxPQUFPLElBQUksS0FBSyxDQUFDLENBQUM7QUFDcEIifQ==
// denoCacheMetadata=3789045058146739938,9726715680066896683