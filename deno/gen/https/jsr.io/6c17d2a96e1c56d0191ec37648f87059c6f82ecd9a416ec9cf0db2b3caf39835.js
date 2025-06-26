import { takeRight as takeRightToolkit } from '../../array/takeRight.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { toInteger } from '../util/toInteger.ts';
/**
 * Returns a new array containing the last `count` elements from the input array `arr`.
 * If `count` is greater than the length of `arr`, the entire array is returned.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} arr - The array to take elements from.
 * @param {number} [count=1] - The number of elements to take.
 * @param {unknown} [guard] - Enables use as an iteratee for methods like `_.map`.
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
 */ export function takeRight(arr, count = 1, guard) {
  count = guard ? 1 : toInteger(count);
  if (count <= 0 || !isArrayLike(arr)) {
    return [];
  }
  return takeRightToolkit(toArray(arr), count);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvdGFrZVJpZ2h0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRha2VSaWdodCBhcyB0YWtlUmlnaHRUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvdGFrZVJpZ2h0LnRzJztcbmltcG9ydCB7IHRvQXJyYXkgfSBmcm9tICcuLi9faW50ZXJuYWwvdG9BcnJheS50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5pbXBvcnQgeyB0b0ludGVnZXIgfSBmcm9tICcuLi91dGlsL3RvSW50ZWdlci50cyc7XG5cbi8qKlxuICogUmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBsYXN0IGBjb3VudGAgZWxlbWVudHMgZnJvbSB0aGUgaW5wdXQgYXJyYXkgYGFycmAuXG4gKiBJZiBgY291bnRgIGlzIGdyZWF0ZXIgdGhhbiB0aGUgbGVuZ3RoIG9mIGBhcnJgLCB0aGUgZW50aXJlIGFycmF5IGlzIHJldHVybmVkLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkfSBhcnIgLSBUaGUgYXJyYXkgdG8gdGFrZSBlbGVtZW50cyBmcm9tLlxuICogQHBhcmFtIHtudW1iZXJ9IFtjb3VudD0xXSAtIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gdGFrZS5cbiAqIEBwYXJhbSB7dW5rbm93bn0gW2d1YXJkXSAtIEVuYWJsZXMgdXNlIGFzIGFuIGl0ZXJhdGVlIGZvciBtZXRob2RzIGxpa2UgYF8ubWFwYC5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIGxhc3QgYGNvdW50YCBlbGVtZW50cyBmcm9tIGBhcnJgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFs0LCA1XVxuICogdGFrZVJpZ2h0KFsxLCAyLCAzLCA0LCA1XSwgMik7XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgWydiJywgJ2MnXVxuICogdGFrZVJpZ2h0KFsnYScsICdiJywgJ2MnXSwgMik7XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgWzEsIDIsIDNdXG4gKiB0YWtlUmlnaHQoWzEsIDIsIDNdLCA1KTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRha2VSaWdodDxUPihhcnI6IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsIGNvdW50ID0gMSwgZ3VhcmQ/OiB1bmtub3duKTogVFtdIHtcbiAgY291bnQgPSBndWFyZCA/IDEgOiB0b0ludGVnZXIoY291bnQpO1xuICBpZiAoY291bnQgPD0gMCB8fCAhaXNBcnJheUxpa2UoYXJyKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiB0YWtlUmlnaHRUb29sa2l0KHRvQXJyYXkoYXJyKSwgY291bnQpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxnQkFBZ0IsUUFBUSwyQkFBMkI7QUFDekUsU0FBUyxPQUFPLFFBQVEsMEJBQTBCO0FBQ2xELFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUMxRCxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXFCQyxHQUNELE9BQU8sU0FBUyxVQUFhLEdBQW9DLEVBQUUsUUFBUSxDQUFDLEVBQUUsS0FBZTtFQUMzRixRQUFRLFFBQVEsSUFBSSxVQUFVO0VBQzlCLElBQUksU0FBUyxLQUFLLENBQUMsWUFBWSxNQUFNO0lBQ25DLE9BQU8sRUFBRTtFQUNYO0VBRUEsT0FBTyxpQkFBaUIsUUFBUSxNQUFNO0FBQ3hDIn0=
// denoCacheMetadata=12063197455584008923,17548671291327237676