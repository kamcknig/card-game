import { without as withoutToolkit } from '../../array/without.ts';
import { isArrayLikeObject } from '../predicate/isArrayLikeObject.ts';
/**
 * Creates an array that excludes all specified values.
 *
 * It correctly excludes `NaN`, as it compares values using [SameValueZero](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-samevaluezero).
 *
 * @template T The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} array - The array to filter.
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
  if (!isArrayLikeObject(array)) {
    return [];
  }
  return withoutToolkit(Array.from(array), ...values);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvd2l0aG91dC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB3aXRob3V0IGFzIHdpdGhvdXRUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvd2l0aG91dC50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZU9iamVjdCB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZU9iamVjdC50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJheSB0aGF0IGV4Y2x1ZGVzIGFsbCBzcGVjaWZpZWQgdmFsdWVzLlxuICpcbiAqIEl0IGNvcnJlY3RseSBleGNsdWRlcyBgTmFOYCwgYXMgaXQgY29tcGFyZXMgdmFsdWVzIHVzaW5nIFtTYW1lVmFsdWVaZXJvXShodHRwczovL3RjMzkuZXMvZWNtYTI2Mi9tdWx0aXBhZ2UvYWJzdHJhY3Qtb3BlcmF0aW9ucy5odG1sI3NlYy1zYW1ldmFsdWV6ZXJvKS5cbiAqXG4gKiBAdGVtcGxhdGUgVCBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IGFycmF5IC0gVGhlIGFycmF5IHRvIGZpbHRlci5cbiAqIEBwYXJhbSB7Li4uVFtdfSB2YWx1ZXMgLSBUaGUgdmFsdWVzIHRvIGV4Y2x1ZGUuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSB3aXRob3V0IHRoZSBzcGVjaWZpZWQgdmFsdWVzLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZW1vdmVzIHRoZSBzcGVjaWZpZWQgdmFsdWVzIGZyb20gdGhlIGFycmF5XG4gKiB3aXRob3V0KFsxLCAyLCAzLCA0LCA1XSwgMiwgNCk7XG4gKiAvLyBSZXR1cm5zOiBbMSwgMywgNV1cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmVtb3ZlcyBzcGVjaWZpZWQgc3RyaW5nIHZhbHVlcyBmcm9tIHRoZSBhcnJheVxuICogd2l0aG91dChbJ2EnLCAnYicsICdjJywgJ2EnXSwgJ2EnKTtcbiAqIC8vIFJldHVybnM6IFsnYicsICdjJ11cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpdGhvdXQ8VD4oYXJyYXk6IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsIC4uLnZhbHVlczogVFtdKTogVFtdIHtcbiAgaWYgKCFpc0FycmF5TGlrZU9iamVjdChhcnJheSkpIHtcbiAgICByZXR1cm4gW107XG4gIH1cbiAgcmV0dXJuIHdpdGhvdXRUb29sa2l0KEFycmF5LmZyb20oYXJyYXkpLCAuLi52YWx1ZXMpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsV0FBVyxjQUFjLFFBQVEseUJBQXlCO0FBQ25FLFNBQVMsaUJBQWlCLFFBQVEsb0NBQW9DO0FBRXRFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBbUJDLEdBQ0QsT0FBTyxTQUFTLFFBQVcsS0FBc0MsRUFBRSxHQUFHLE1BQVc7RUFDL0UsSUFBSSxDQUFDLGtCQUFrQixRQUFRO0lBQzdCLE9BQU8sRUFBRTtFQUNYO0VBQ0EsT0FBTyxlQUFlLE1BQU0sSUFBSSxDQUFDLFdBQVc7QUFDOUMifQ==
// denoCacheMetadata=5653251455295309128,16729545703586206430