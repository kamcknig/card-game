/**
 * Returns a new array containing the first `count` elements from the input array `arr`.
 * If `count` is greater than the length of `arr`, the entire array is returned.
 *
 * @template T - Type of elements in the input array.
 *
 * @param {T[]} arr - The array to take elements from.
 * @param {number} count - The number of elements to take.
 * @returns {T[]} A new array containing the first `count` elements from `arr`.
 *
 * @example
 * // Returns [1, 2, 3]
 * take([1, 2, 3, 4, 5], 3);
 *
 * @example
 * // Returns ['a', 'b']
 * take(['a', 'b', 'c'], 2);
 *
 * @example
 * // Returns [1, 2, 3]
 * take([1, 2, 3], 5);
 */ export function take(arr, count) {
  return arr.slice(0, count);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS90YWtlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBmaXJzdCBgY291bnRgIGVsZW1lbnRzIGZyb20gdGhlIGlucHV0IGFycmF5IGBhcnJgLlxuICogSWYgYGNvdW50YCBpcyBncmVhdGVyIHRoYW4gdGhlIGxlbmd0aCBvZiBgYXJyYCwgdGhlIGVudGlyZSBhcnJheSBpcyByZXR1cm5lZC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGlucHV0IGFycmF5LlxuICpcbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gdGFrZSBlbGVtZW50cyBmcm9tLlxuICogQHBhcmFtIHtudW1iZXJ9IGNvdW50IC0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byB0YWtlLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgZmlyc3QgYGNvdW50YCBlbGVtZW50cyBmcm9tIGBhcnJgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFsxLCAyLCAzXVxuICogdGFrZShbMSwgMiwgMywgNCwgNV0sIDMpO1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFsnYScsICdiJ11cbiAqIHRha2UoWydhJywgJ2InLCAnYyddLCAyKTtcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbMSwgMiwgM11cbiAqIHRha2UoWzEsIDIsIDNdLCA1KTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRha2U8VD4oYXJyOiByZWFkb25seSBUW10sIGNvdW50OiBudW1iZXIpOiBUW10ge1xuICByZXR1cm4gYXJyLnNsaWNlKDAsIGNvdW50KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBcUJDLEdBQ0QsT0FBTyxTQUFTLEtBQVEsR0FBaUIsRUFBRSxLQUFhO0VBQ3RELE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRztBQUN0QiJ9
// denoCacheMetadata=1151027122877391459,1416434112603411607