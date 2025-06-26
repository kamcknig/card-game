/**
 * Reverses the elements of an array in place.
 *
 * This function takes an array and reverses its elements in place, modifying the original array.
 * If the input is `null` or `undefined`, it returns the input as is.
 *
 * @template T - The type of elements in the array.
 * @param {T[] | null | undefined} array - The array to reverse. If `null` or `undefined`, the input is returned as is.
 * @returns {T[] | null | undefined} The reversed array, or `null`/`undefined` if the input was `null`/`undefined`.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const reversedArray = reverse(array);
 * // reversedArray is [5, 4, 3, 2, 1], and array is also modified to [5, 4, 3, 2, 1].
 *
 * const emptyArray = reverse([]);
 * // emptyArray is [].
 *
 * const nullArray = reverse(null);
 * // nullArray is null.
 */ export function reverse(array) {
  if (array == null) {
    return array;
  }
  return array.reverse();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvcmV2ZXJzZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldmVyc2VzIHRoZSBlbGVtZW50cyBvZiBhbiBhcnJheSBpbiBwbGFjZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGFycmF5IGFuZCByZXZlcnNlcyBpdHMgZWxlbWVudHMgaW4gcGxhY2UsIG1vZGlmeWluZyB0aGUgb3JpZ2luYWwgYXJyYXkuXG4gKiBJZiB0aGUgaW5wdXQgaXMgYG51bGxgIG9yIGB1bmRlZmluZWRgLCBpdCByZXR1cm5zIHRoZSBpbnB1dCBhcyBpcy5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdIHwgbnVsbCB8IHVuZGVmaW5lZH0gYXJyYXkgLSBUaGUgYXJyYXkgdG8gcmV2ZXJzZS4gSWYgYG51bGxgIG9yIGB1bmRlZmluZWRgLCB0aGUgaW5wdXQgaXMgcmV0dXJuZWQgYXMgaXMuXG4gKiBAcmV0dXJucyB7VFtdIHwgbnVsbCB8IHVuZGVmaW5lZH0gVGhlIHJldmVyc2VkIGFycmF5LCBvciBgbnVsbGAvYHVuZGVmaW5lZGAgaWYgdGhlIGlucHV0IHdhcyBgbnVsbGAvYHVuZGVmaW5lZGAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5ID0gWzEsIDIsIDMsIDQsIDVdO1xuICogY29uc3QgcmV2ZXJzZWRBcnJheSA9IHJldmVyc2UoYXJyYXkpO1xuICogLy8gcmV2ZXJzZWRBcnJheSBpcyBbNSwgNCwgMywgMiwgMV0sIGFuZCBhcnJheSBpcyBhbHNvIG1vZGlmaWVkIHRvIFs1LCA0LCAzLCAyLCAxXS5cbiAqXG4gKiBjb25zdCBlbXB0eUFycmF5ID0gcmV2ZXJzZShbXSk7XG4gKiAvLyBlbXB0eUFycmF5IGlzIFtdLlxuICpcbiAqIGNvbnN0IG51bGxBcnJheSA9IHJldmVyc2UobnVsbCk7XG4gKiAvLyBudWxsQXJyYXkgaXMgbnVsbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJldmVyc2U8VD4oYXJyYXk6IFRbXSB8IG51bGwgfCB1bmRlZmluZWQpOiBUW10gfCBudWxsIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGFycmF5ID09IG51bGwpIHtcbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cblxuICByZXR1cm4gYXJyYXkucmV2ZXJzZSgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW9CQyxHQUNELE9BQU8sU0FBUyxRQUFXLEtBQTZCO0VBQ3RELElBQUksU0FBUyxNQUFNO0lBQ2pCLE9BQU87RUFDVDtFQUVBLE9BQU8sTUFBTSxPQUFPO0FBQ3RCIn0=
// denoCacheMetadata=8123634379495247439,5217276364731845105