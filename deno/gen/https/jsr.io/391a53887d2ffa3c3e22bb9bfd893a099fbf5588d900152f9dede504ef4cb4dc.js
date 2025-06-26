import { chunk as chunkToolkit } from '../../array/chunk.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Splits an array into smaller arrays of a specified length.
 *
 * This function takes an input array and divides it into multiple smaller arrays,
 * each of a specified length. If the input array cannot be evenly divided,
 * the final sub-array will contain the remaining elements.
 *
 * @template T The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} arr - The array to be chunked into smaller arrays.
 * @param {number} size - The size of each smaller array. Must be a positive integer.
 * @returns {T[][]} A two-dimensional array where each sub-array has a maximum length of `size`.
 *
 * @example
 * // Splits an array of numbers into sub-arrays of length 2
 * chunk([1, 2, 3, 4, 5], 2);
 * // Returns: [[1, 2], [3, 4], [5]]
 *
 * @example
 * // Splits an array of strings into sub-arrays of length 3
 * chunk(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3);
 * // Returns: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g']]
 */ export function chunk(arr, size = 1) {
  size = Math.max(Math.floor(size), 0);
  if (size === 0 || !isArrayLike(arr)) {
    return [];
  }
  return chunkToolkit(toArray(arr), size);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvY2h1bmsudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2h1bmsgYXMgY2h1bmtUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvY2h1bmsudHMnO1xuaW1wb3J0IHsgdG9BcnJheSB9IGZyb20gJy4uL19pbnRlcm5hbC90b0FycmF5LnRzJztcbmltcG9ydCB7IGlzQXJyYXlMaWtlIH0gZnJvbSAnLi4vcHJlZGljYXRlL2lzQXJyYXlMaWtlLnRzJztcblxuLyoqXG4gKiBTcGxpdHMgYW4gYXJyYXkgaW50byBzbWFsbGVyIGFycmF5cyBvZiBhIHNwZWNpZmllZCBsZW5ndGguXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBpbnB1dCBhcnJheSBhbmQgZGl2aWRlcyBpdCBpbnRvIG11bHRpcGxlIHNtYWxsZXIgYXJyYXlzLFxuICogZWFjaCBvZiBhIHNwZWNpZmllZCBsZW5ndGguIElmIHRoZSBpbnB1dCBhcnJheSBjYW5ub3QgYmUgZXZlbmx5IGRpdmlkZWQsXG4gKiB0aGUgZmluYWwgc3ViLWFycmF5IHdpbGwgY29udGFpbiB0aGUgcmVtYWluaW5nIGVsZW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZH0gYXJyIC0gVGhlIGFycmF5IHRvIGJlIGNodW5rZWQgaW50byBzbWFsbGVyIGFycmF5cy5cbiAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIC0gVGhlIHNpemUgb2YgZWFjaCBzbWFsbGVyIGFycmF5LiBNdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlci5cbiAqIEByZXR1cm5zIHtUW11bXX0gQSB0d28tZGltZW5zaW9uYWwgYXJyYXkgd2hlcmUgZWFjaCBzdWItYXJyYXkgaGFzIGEgbWF4aW11bSBsZW5ndGggb2YgYHNpemVgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBTcGxpdHMgYW4gYXJyYXkgb2YgbnVtYmVycyBpbnRvIHN1Yi1hcnJheXMgb2YgbGVuZ3RoIDJcbiAqIGNodW5rKFsxLCAyLCAzLCA0LCA1XSwgMik7XG4gKiAvLyBSZXR1cm5zOiBbWzEsIDJdLCBbMywgNF0sIFs1XV1cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gU3BsaXRzIGFuIGFycmF5IG9mIHN0cmluZ3MgaW50byBzdWItYXJyYXlzIG9mIGxlbmd0aCAzXG4gKiBjaHVuayhbJ2EnLCAnYicsICdjJywgJ2QnLCAnZScsICdmJywgJ2cnXSwgMyk7XG4gKiAvLyBSZXR1cm5zOiBbWydhJywgJ2InLCAnYyddLCBbJ2QnLCAnZScsICdmJ10sIFsnZyddXVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2h1bms8VD4oYXJyOiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCBzaXplID0gMSk6IFRbXVtdIHtcbiAgc2l6ZSA9IE1hdGgubWF4KE1hdGguZmxvb3Ioc2l6ZSksIDApO1xuXG4gIGlmIChzaXplID09PSAwIHx8ICFpc0FycmF5TGlrZShhcnIpKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIGNodW5rVG9vbGtpdCh0b0FycmF5KGFyciksIHNpemUpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxZQUFZLFFBQVEsdUJBQXVCO0FBQzdELFNBQVMsT0FBTyxRQUFRLDBCQUEwQjtBQUNsRCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXFCQyxHQUNELE9BQU8sU0FBUyxNQUFTLEdBQW9DLEVBQUUsT0FBTyxDQUFDO0VBQ3JFLE9BQU8sS0FBSyxHQUFHLENBQUMsS0FBSyxLQUFLLENBQUMsT0FBTztFQUVsQyxJQUFJLFNBQVMsS0FBSyxDQUFDLFlBQVksTUFBTTtJQUNuQyxPQUFPLEVBQUU7RUFDWDtFQUVBLE9BQU8sYUFBYSxRQUFRLE1BQU07QUFDcEMifQ==
// denoCacheMetadata=8583912725187489968,16661284901634401766