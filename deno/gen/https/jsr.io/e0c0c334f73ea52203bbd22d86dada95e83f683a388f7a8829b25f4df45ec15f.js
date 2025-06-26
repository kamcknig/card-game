import { isArrayLikeObject } from '../predicate/isArrayLikeObject.ts';
import { toInteger } from '../util/toInteger.ts';
/**
 * Gets the element at index `n` of `array`. If `n` is negative, the nth element from the end is returned.
 *
 * @param {ArrayLike<T> | null | undefined} array - The array to query.
 * @param {number} [n=0] - The index of the element to return.
 * @return {T | undefined} Returns the nth element of `array`.
 *
 * @example
 * nth([1, 2, 3], 1); // => 2
 * nth([1, 2, 3], -1); // => 3
 */ export function nth(array, n = 0) {
  if (!isArrayLikeObject(array) || array.length === 0) {
    return undefined;
  }
  n = toInteger(n);
  if (n < 0) {
    n += array.length;
  }
  return array[n];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvbnRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGlzQXJyYXlMaWtlT2JqZWN0IH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzQXJyYXlMaWtlT2JqZWN0LnRzJztcbmltcG9ydCB7IHRvSW50ZWdlciB9IGZyb20gJy4uL3V0aWwvdG9JbnRlZ2VyLnRzJztcblxuLyoqXG4gKiBHZXRzIHRoZSBlbGVtZW50IGF0IGluZGV4IGBuYCBvZiBgYXJyYXlgLiBJZiBgbmAgaXMgbmVnYXRpdmUsIHRoZSBudGggZWxlbWVudCBmcm9tIHRoZSBlbmQgaXMgcmV0dXJuZWQuXG4gKlxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkfSBhcnJheSAtIFRoZSBhcnJheSB0byBxdWVyeS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbj0wXSAtIFRoZSBpbmRleCBvZiB0aGUgZWxlbWVudCB0byByZXR1cm4uXG4gKiBAcmV0dXJuIHtUIHwgdW5kZWZpbmVkfSBSZXR1cm5zIHRoZSBudGggZWxlbWVudCBvZiBgYXJyYXlgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBudGgoWzEsIDIsIDNdLCAxKTsgLy8gPT4gMlxuICogbnRoKFsxLCAyLCAzXSwgLTEpOyAvLyA9PiAzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBudGg8VD4oYXJyYXk6IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsIG46IG51bWJlciA9IDApOiBUIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCFpc0FycmF5TGlrZU9iamVjdChhcnJheSkgfHwgYXJyYXkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIG4gPSB0b0ludGVnZXIobik7XG5cbiAgaWYgKG4gPCAwKSB7XG4gICAgbiArPSBhcnJheS5sZW5ndGg7XG4gIH1cblxuICByZXR1cm4gYXJyYXlbbl07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxpQkFBaUIsUUFBUSxvQ0FBb0M7QUFDdEUsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBRWpEOzs7Ozs7Ozs7O0NBVUMsR0FDRCxPQUFPLFNBQVMsSUFBTyxLQUFzQyxFQUFFLElBQVksQ0FBQztFQUMxRSxJQUFJLENBQUMsa0JBQWtCLFVBQVUsTUFBTSxNQUFNLEtBQUssR0FBRztJQUNuRCxPQUFPO0VBQ1Q7RUFFQSxJQUFJLFVBQVU7RUFFZCxJQUFJLElBQUksR0FBRztJQUNULEtBQUssTUFBTSxNQUFNO0VBQ25CO0VBRUEsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNqQiJ9
// denoCacheMetadata=15852798146207173488,6735109695570853655