import { flatten } from './flatten.ts';
import { uniq } from '../../array/uniq.ts';
import { isArrayLikeObject } from '../predicate/isArrayLikeObject.ts';
/**
 * This function takes multiple arrays and returns a new array containing only the unique values
 * from all input arrays, preserving the order of their first occurrence.
 *
 * @template T - The type of elements in the arrays.
 * @param {Array<ArrayLike<T> | null | undefined>} arrays - The arrays to inspect.
 * @returns {T[]} Returns the new array of combined unique values.
 *
 * @example
 * // Returns [2, 1]
 * union([2], [1, 2]);
 *
 * @example
 * // Returns [2, 1, 3]
 * union([2], [1, 2], [2, 3]);
 *
 * @example
 * // Returns [1, 3, 2, [5], [4]] (does not deeply flatten nested arrays)
 * union([1, 3, 2], [1, [5]], [2, [4]]);
 *
 * @example
 * // Returns [0, 2, 1] (ignores non-array values like 3 and { '0': 1 })
 * union([0], 3, { '0': 1 }, null, [2, 1]);
 * @example
 * // Returns [0, 'a', 2, 1] (treats array-like object { 0: 'a', length: 1 } as a valid array)
 * union([0], { 0: 'a', length: 1 }, [2, 1]);
 */ export function union(...arrays) {
  const validArrays = arrays.filter(isArrayLikeObject);
  const flattened = flatten(validArrays, 1);
  return uniq(flattened);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvdW5pb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmxhdHRlbiB9IGZyb20gJy4vZmxhdHRlbi50cyc7XG5pbXBvcnQgeyB1bmlxIH0gZnJvbSAnLi4vLi4vYXJyYXkvdW5pcS50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZU9iamVjdCB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZU9iamVjdC50cyc7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBtdWx0aXBsZSBhcnJheXMgYW5kIHJldHVybnMgYSBuZXcgYXJyYXkgY29udGFpbmluZyBvbmx5IHRoZSB1bmlxdWUgdmFsdWVzXG4gKiBmcm9tIGFsbCBpbnB1dCBhcnJheXMsIHByZXNlcnZpbmcgdGhlIG9yZGVyIG9mIHRoZWlyIGZpcnN0IG9jY3VycmVuY2UuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXlzLlxuICogQHBhcmFtIHtBcnJheTxBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkPn0gYXJyYXlzIC0gVGhlIGFycmF5cyB0byBpbnNwZWN0LlxuICogQHJldHVybnMge1RbXX0gUmV0dXJucyB0aGUgbmV3IGFycmF5IG9mIGNvbWJpbmVkIHVuaXF1ZSB2YWx1ZXMuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgWzIsIDFdXG4gKiB1bmlvbihbMl0sIFsxLCAyXSk7XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgWzIsIDEsIDNdXG4gKiB1bmlvbihbMl0sIFsxLCAyXSwgWzIsIDNdKTtcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbMSwgMywgMiwgWzVdLCBbNF1dIChkb2VzIG5vdCBkZWVwbHkgZmxhdHRlbiBuZXN0ZWQgYXJyYXlzKVxuICogdW5pb24oWzEsIDMsIDJdLCBbMSwgWzVdXSwgWzIsIFs0XV0pO1xuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFswLCAyLCAxXSAoaWdub3JlcyBub24tYXJyYXkgdmFsdWVzIGxpa2UgMyBhbmQgeyAnMCc6IDEgfSlcbiAqIHVuaW9uKFswXSwgMywgeyAnMCc6IDEgfSwgbnVsbCwgWzIsIDFdKTtcbiAqIEBleGFtcGxlXG4gKiAvLyBSZXR1cm5zIFswLCAnYScsIDIsIDFdICh0cmVhdHMgYXJyYXktbGlrZSBvYmplY3QgeyAwOiAnYScsIGxlbmd0aDogMSB9IGFzIGEgdmFsaWQgYXJyYXkpXG4gKiB1bmlvbihbMF0sIHsgMDogJ2EnLCBsZW5ndGg6IDEgfSwgWzIsIDFdKTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuaW9uPFQ+KC4uLmFycmF5czogQXJyYXk8QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZD4pOiBUW10ge1xuICBjb25zdCB2YWxpZEFycmF5cyA9IGFycmF5cy5maWx0ZXIoaXNBcnJheUxpa2VPYmplY3QpO1xuXG4gIGNvbnN0IGZsYXR0ZW5lZCA9IGZsYXR0ZW4odmFsaWRBcnJheXMsIDEpO1xuXG4gIHJldHVybiB1bmlxKGZsYXR0ZW5lZCkgYXMgVFtdO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsT0FBTyxRQUFRLGVBQWU7QUFDdkMsU0FBUyxJQUFJLFFBQVEsc0JBQXNCO0FBQzNDLFNBQVMsaUJBQWlCLFFBQVEsb0NBQW9DO0FBRXRFOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTBCQyxHQUNELE9BQU8sU0FBUyxNQUFTLEdBQUcsTUFBOEM7RUFDeEUsTUFBTSxjQUFjLE9BQU8sTUFBTSxDQUFDO0VBRWxDLE1BQU0sWUFBWSxRQUFRLGFBQWE7RUFFdkMsT0FBTyxLQUFLO0FBQ2QifQ==
// denoCacheMetadata=1896691928188592771,2389209491055181680