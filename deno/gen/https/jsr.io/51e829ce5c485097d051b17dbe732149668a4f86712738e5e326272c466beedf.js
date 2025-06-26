import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Finds the index of the first occurrence of a value in an array.
 *
 * This method is similar to `Array.prototype.indexOf`, but it also finds `NaN` values.
 * It uses strict equality (`===`) to compare elements.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} array - The array to search.
 * @param {T} searchElement - The value to search for.
 * @param {number} [fromIndex] - The index to start the search at.
 * @returns {number} The index (zero-based) of the first occurrence of the value in the array, or `-1` if the value is not found.
 *
 * @example
 * const array = [1, 2, 3, NaN];
 * indexOf(array, 3); // => 2
 * indexOf(array, NaN); // => 3
 */ export function indexOf(array, searchElement, fromIndex) {
  if (!isArrayLike(array)) {
    return -1;
  }
  // `Array.prototype.indexOf` doesn't find `NaN` values, so we need to handle that case separately.
  if (Number.isNaN(searchElement)) {
    fromIndex = fromIndex ?? 0;
    if (fromIndex < 0) {
      fromIndex = Math.max(0, array.length + fromIndex);
    }
    for(let i = fromIndex; i < array.length; i++){
      if (Number.isNaN(array[i])) {
        return i;
      }
    }
    return -1;
  }
  // Array.prototype.indexOf already handles `fromIndex < -array.length`, `fromIndex >= array.length` and converts `fromIndex` to an integer, so we don't need to handle those cases here.
  // And it uses strict equality (===) to compare elements like `lodash/indexOf` does.
  return Array.from(array).indexOf(searchElement, fromIndex);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvaW5kZXhPZi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5cbi8qKlxuICogRmluZHMgdGhlIGluZGV4IG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGEgdmFsdWUgaW4gYW4gYXJyYXkuXG4gKlxuICogVGhpcyBtZXRob2QgaXMgc2ltaWxhciB0byBgQXJyYXkucHJvdG90eXBlLmluZGV4T2ZgLCBidXQgaXQgYWxzbyBmaW5kcyBgTmFOYCB2YWx1ZXMuXG4gKiBJdCB1c2VzIHN0cmljdCBlcXVhbGl0eSAoYD09PWApIHRvIGNvbXBhcmUgZWxlbWVudHMuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IGFycmF5IC0gVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAqIEBwYXJhbSB7VH0gc2VhcmNoRWxlbWVudCAtIFRoZSB2YWx1ZSB0byBzZWFyY2ggZm9yLlxuICogQHBhcmFtIHtudW1iZXJ9IFtmcm9tSW5kZXhdIC0gVGhlIGluZGV4IHRvIHN0YXJ0IHRoZSBzZWFyY2ggYXQuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgaW5kZXggKHplcm8tYmFzZWQpIG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIHRoZSB2YWx1ZSBpbiB0aGUgYXJyYXksIG9yIGAtMWAgaWYgdGhlIHZhbHVlIGlzIG5vdCBmb3VuZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgTmFOXTtcbiAqIGluZGV4T2YoYXJyYXksIDMpOyAvLyA9PiAyXG4gKiBpbmRleE9mKGFycmF5LCBOYU4pOyAvLyA9PiAzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmRleE9mPFQ+KGFycmF5OiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCBzZWFyY2hFbGVtZW50OiBULCBmcm9tSW5kZXg/OiBudW1iZXIpOiBudW1iZXIge1xuICBpZiAoIWlzQXJyYXlMaWtlKGFycmF5KSkge1xuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIC8vIGBBcnJheS5wcm90b3R5cGUuaW5kZXhPZmAgZG9lc24ndCBmaW5kIGBOYU5gIHZhbHVlcywgc28gd2UgbmVlZCB0byBoYW5kbGUgdGhhdCBjYXNlIHNlcGFyYXRlbHkuXG4gIGlmIChOdW1iZXIuaXNOYU4oc2VhcmNoRWxlbWVudCkpIHtcbiAgICBmcm9tSW5kZXggPSBmcm9tSW5kZXggPz8gMDtcblxuICAgIGlmIChmcm9tSW5kZXggPCAwKSB7XG4gICAgICBmcm9tSW5kZXggPSBNYXRoLm1heCgwLCBhcnJheS5sZW5ndGggKyBmcm9tSW5kZXgpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSBmcm9tSW5kZXg7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKE51bWJlci5pc05hTihhcnJheVtpXSkpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgLy8gQXJyYXkucHJvdG90eXBlLmluZGV4T2YgYWxyZWFkeSBoYW5kbGVzIGBmcm9tSW5kZXggPCAtYXJyYXkubGVuZ3RoYCwgYGZyb21JbmRleCA+PSBhcnJheS5sZW5ndGhgIGFuZCBjb252ZXJ0cyBgZnJvbUluZGV4YCB0byBhbiBpbnRlZ2VyLCBzbyB3ZSBkb24ndCBuZWVkIHRvIGhhbmRsZSB0aG9zZSBjYXNlcyBoZXJlLlxuICAvLyBBbmQgaXQgdXNlcyBzdHJpY3QgZXF1YWxpdHkgKD09PSkgdG8gY29tcGFyZSBlbGVtZW50cyBsaWtlIGBsb2Rhc2gvaW5kZXhPZmAgZG9lcy5cbiAgcmV0dXJuIEFycmF5LmZyb20oYXJyYXkpLmluZGV4T2Yoc2VhcmNoRWxlbWVudCwgZnJvbUluZGV4KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsUUFBVyxLQUFzQyxFQUFFLGFBQWdCLEVBQUUsU0FBa0I7RUFDckcsSUFBSSxDQUFDLFlBQVksUUFBUTtJQUN2QixPQUFPLENBQUM7RUFDVjtFQUVBLGtHQUFrRztFQUNsRyxJQUFJLE9BQU8sS0FBSyxDQUFDLGdCQUFnQjtJQUMvQixZQUFZLGFBQWE7SUFFekIsSUFBSSxZQUFZLEdBQUc7TUFDakIsWUFBWSxLQUFLLEdBQUcsQ0FBQyxHQUFHLE1BQU0sTUFBTSxHQUFHO0lBQ3pDO0lBRUEsSUFBSyxJQUFJLElBQUksV0FBVyxJQUFJLE1BQU0sTUFBTSxFQUFFLElBQUs7TUFDN0MsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHO1FBQzFCLE9BQU87TUFDVDtJQUNGO0lBRUEsT0FBTyxDQUFDO0VBQ1Y7RUFFQSx3TEFBd0w7RUFDeEwsb0ZBQW9GO0VBQ3BGLE9BQU8sTUFBTSxJQUFJLENBQUMsT0FBTyxPQUFPLENBQUMsZUFBZTtBQUNsRCJ9
// denoCacheMetadata=14065294732301186446,5041223384386053488