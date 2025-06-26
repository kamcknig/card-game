import { take as takeToolkit } from '../../array/take.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { toInteger } from '../util/toInteger.ts';
/**
 * Returns a new array containing the first `count` elements from the input array `arr`.
 * If `count` is greater than the length of `arr`, the entire array is returned.
 *
 * @template T - Type of elements in the input array.
 *
 * @param {ArrayLike<T> | null | undefined} arr - The array to take elements from.
 * @param {number} [count=1] - The number of elements to take.
 * @param {unknown} [guard] - Enables use as an iteratee for methods like `_.map`.
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
 */ export function take(arr, count = 1, guard) {
  count = guard ? 1 : toInteger(count);
  if (count < 1 || !isArrayLike(arr)) {
    return [];
  }
  return takeToolkit(toArray(arr), count);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvdGFrZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0YWtlIGFzIHRha2VUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvdGFrZS50cyc7XG5pbXBvcnQgeyB0b0FycmF5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvQXJyYXkudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuaW1wb3J0IHsgdG9JbnRlZ2VyIH0gZnJvbSAnLi4vdXRpbC90b0ludGVnZXIudHMnO1xuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgZmlyc3QgYGNvdW50YCBlbGVtZW50cyBmcm9tIHRoZSBpbnB1dCBhcnJheSBgYXJyYC5cbiAqIElmIGBjb3VudGAgaXMgZ3JlYXRlciB0aGFuIHRoZSBsZW5ndGggb2YgYGFycmAsIHRoZSBlbnRpcmUgYXJyYXkgaXMgcmV0dXJuZWQuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUeXBlIG9mIGVsZW1lbnRzIGluIHRoZSBpbnB1dCBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IGFyciAtIFRoZSBhcnJheSB0byB0YWtlIGVsZW1lbnRzIGZyb20uXG4gKiBAcGFyYW0ge251bWJlcn0gW2NvdW50PTFdIC0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byB0YWtlLlxuICogQHBhcmFtIHt1bmtub3dufSBbZ3VhcmRdIC0gRW5hYmxlcyB1c2UgYXMgYW4gaXRlcmF0ZWUgZm9yIG1ldGhvZHMgbGlrZSBgXy5tYXBgLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgZmlyc3QgYGNvdW50YCBlbGVtZW50cyBmcm9tIGBhcnJgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFsxLCAyLCAzXVxuICogdGFrZShbMSwgMiwgMywgNCwgNV0sIDMpO1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFsnYScsICdiJ11cbiAqIHRha2UoWydhJywgJ2InLCAnYyddLCAyKTtcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbMSwgMiwgM11cbiAqIHRha2UoWzEsIDIsIDNdLCA1KTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRha2U8VD4oYXJyOiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCBjb3VudCA9IDEsIGd1YXJkPzogdW5rbm93bik6IFRbXSB7XG4gIGNvdW50ID0gZ3VhcmQgPyAxIDogdG9JbnRlZ2VyKGNvdW50KTtcbiAgaWYgKGNvdW50IDwgMSB8fCAhaXNBcnJheUxpa2UoYXJyKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiB0YWtlVG9vbGtpdCh0b0FycmF5KGFyciksIGNvdW50KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsV0FBVyxRQUFRLHNCQUFzQjtBQUMxRCxTQUFTLE9BQU8sUUFBUSwwQkFBMEI7QUFDbEQsU0FBUyxXQUFXLFFBQVEsOEJBQThCO0FBQzFELFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUVqRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNCQyxHQUNELE9BQU8sU0FBUyxLQUFRLEdBQW9DLEVBQUUsUUFBUSxDQUFDLEVBQUUsS0FBZTtFQUN0RixRQUFRLFFBQVEsSUFBSSxVQUFVO0VBQzlCLElBQUksUUFBUSxLQUFLLENBQUMsWUFBWSxNQUFNO0lBQ2xDLE9BQU8sRUFBRTtFQUNYO0VBRUEsT0FBTyxZQUFZLFFBQVEsTUFBTTtBQUNuQyJ9
// denoCacheMetadata=11883131781611028303,7967112797008765375