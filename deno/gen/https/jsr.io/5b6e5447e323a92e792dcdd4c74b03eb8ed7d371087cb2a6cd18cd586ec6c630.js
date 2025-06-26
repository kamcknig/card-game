import { tail as tailToolkit } from '../../array/tail.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Returns a new array with all elements except for the first.
 *
 * This function takes an array and returns a new array containing all the elements
 * except for the first one. If the input array is empty or has only one element,
 * an empty array is returned.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} arr - The array to get the tail of.
 * @returns {T[]} A new array containing all elements of the input array except for the first one.
 *
 * @example
 * const arr1 = [1, 2, 3];
 * const result = tail(arr1);
 * // result will be [2, 3]
 *
 * const arr2 = [1];
 * const result2 = tail(arr2);
 * // result2 will be []
 *
 * const arr3 = [];
 * const result3 = tail(arr3);
 * // result3 will be []
 */ export function tail(arr) {
  if (!isArrayLike(arr)) {
    return [];
  }
  return tailToolkit(toArray(arr));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvdGFpbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0YWlsIGFzIHRhaWxUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvdGFpbC50cyc7XG5pbXBvcnQgeyB0b0FycmF5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvQXJyYXkudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgYXJyYXkgd2l0aCBhbGwgZWxlbWVudHMgZXhjZXB0IGZvciB0aGUgZmlyc3QuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSBjb250YWluaW5nIGFsbCB0aGUgZWxlbWVudHNcbiAqIGV4Y2VwdCBmb3IgdGhlIGZpcnN0IG9uZS4gSWYgdGhlIGlucHV0IGFycmF5IGlzIGVtcHR5IG9yIGhhcyBvbmx5IG9uZSBlbGVtZW50LFxuICogYW4gZW1wdHkgYXJyYXkgaXMgcmV0dXJuZWQuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IGFyciAtIFRoZSBhcnJheSB0byBnZXQgdGhlIHRhaWwgb2YuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIGFsbCBlbGVtZW50cyBvZiB0aGUgaW5wdXQgYXJyYXkgZXhjZXB0IGZvciB0aGUgZmlyc3Qgb25lLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnIxID0gWzEsIDIsIDNdO1xuICogY29uc3QgcmVzdWx0ID0gdGFpbChhcnIxKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIFsyLCAzXVxuICpcbiAqIGNvbnN0IGFycjIgPSBbMV07XG4gKiBjb25zdCByZXN1bHQyID0gdGFpbChhcnIyKTtcbiAqIC8vIHJlc3VsdDIgd2lsbCBiZSBbXVxuICpcbiAqIGNvbnN0IGFycjMgPSBbXTtcbiAqIGNvbnN0IHJlc3VsdDMgPSB0YWlsKGFycjMpO1xuICogLy8gcmVzdWx0MyB3aWxsIGJlIFtdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0YWlsPFQ+KGFycjogQXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZCk6IFRbXSB7XG4gIGlmICghaXNBcnJheUxpa2UoYXJyKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICByZXR1cm4gdGFpbFRvb2xraXQodG9BcnJheShhcnIpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsV0FBVyxRQUFRLHNCQUFzQjtBQUMxRCxTQUFTLE9BQU8sUUFBUSwwQkFBMEI7QUFDbEQsU0FBUyxXQUFXLFFBQVEsOEJBQThCO0FBRTFEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXVCQyxHQUNELE9BQU8sU0FBUyxLQUFRLEdBQW9DO0VBQzFELElBQUksQ0FBQyxZQUFZLE1BQU07SUFDckIsT0FBTyxFQUFFO0VBQ1g7RUFDQSxPQUFPLFlBQVksUUFBUTtBQUM3QiJ9
// denoCacheMetadata=12197708927343509639,16249261324848552871