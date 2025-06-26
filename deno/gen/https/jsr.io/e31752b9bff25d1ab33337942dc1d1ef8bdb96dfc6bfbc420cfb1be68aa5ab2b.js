import { uniqWith } from './uniqWith.ts';
/**
 * Creates an array of unique values from two given arrays based on a custom equality function.
 *
 * This function takes two arrays and a custom equality function, merges the arrays, and returns
 * a new array containing only the unique values as determined by the custom equality function.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr1 - The first array to merge and filter for unique values.
 * @param {T[]} arr2 - The second array to merge and filter for unique values.
 * @param {(item1: T, item2: T) => boolean} areItemsEqual - A custom function to determine if two elements are equal.
 * It takes two arguments and returns `true` if the elements are considered equal, and `false` otherwise.
 * @returns {T[]} A new array of unique values based on the custom equality function.
 *
 * @example
 * const array1 = [{ id: 1 }, { id: 2 }];
 * const array2 = [{ id: 2 }, { id: 3 }];
 * const areItemsEqual = (a, b) => a.id === b.id;
 * const result = unionWith(array1, array2, areItemsEqual);
 * // result will be [{ id: 1 }, { id: 2 }, { id: 3 }] since { id: 2 } is considered equal in both arrays
 */ export function unionWith(arr1, arr2, areItemsEqual) {
  return uniqWith(arr1.concat(arr2), areItemsEqual);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bmlvbldpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdW5pcVdpdGggfSBmcm9tICcuL3VuaXFXaXRoLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHVuaXF1ZSB2YWx1ZXMgZnJvbSB0d28gZ2l2ZW4gYXJyYXlzIGJhc2VkIG9uIGEgY3VzdG9tIGVxdWFsaXR5IGZ1bmN0aW9uLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgdHdvIGFycmF5cyBhbmQgYSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24sIG1lcmdlcyB0aGUgYXJyYXlzLCBhbmQgcmV0dXJuc1xuICogYSBuZXcgYXJyYXkgY29udGFpbmluZyBvbmx5IHRoZSB1bmlxdWUgdmFsdWVzIGFzIGRldGVybWluZWQgYnkgdGhlIGN1c3RvbSBlcXVhbGl0eSBmdW5jdGlvbi5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7VFtdfSBhcnIxIC0gVGhlIGZpcnN0IGFycmF5IHRvIG1lcmdlIGFuZCBmaWx0ZXIgZm9yIHVuaXF1ZSB2YWx1ZXMuXG4gKiBAcGFyYW0ge1RbXX0gYXJyMiAtIFRoZSBzZWNvbmQgYXJyYXkgdG8gbWVyZ2UgYW5kIGZpbHRlciBmb3IgdW5pcXVlIHZhbHVlcy5cbiAqIEBwYXJhbSB7KGl0ZW0xOiBULCBpdGVtMjogVCkgPT4gYm9vbGVhbn0gYXJlSXRlbXNFcXVhbCAtIEEgY3VzdG9tIGZ1bmN0aW9uIHRvIGRldGVybWluZSBpZiB0d28gZWxlbWVudHMgYXJlIGVxdWFsLlxuICogSXQgdGFrZXMgdHdvIGFyZ3VtZW50cyBhbmQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGVsZW1lbnRzIGFyZSBjb25zaWRlcmVkIGVxdWFsLCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBvZiB1bmlxdWUgdmFsdWVzIGJhc2VkIG9uIHRoZSBjdXN0b20gZXF1YWxpdHkgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5MSA9IFt7IGlkOiAxIH0sIHsgaWQ6IDIgfV07XG4gKiBjb25zdCBhcnJheTIgPSBbeyBpZDogMiB9LCB7IGlkOiAzIH1dO1xuICogY29uc3QgYXJlSXRlbXNFcXVhbCA9IChhLCBiKSA9PiBhLmlkID09PSBiLmlkO1xuICogY29uc3QgcmVzdWx0ID0gdW5pb25XaXRoKGFycmF5MSwgYXJyYXkyLCBhcmVJdGVtc0VxdWFsKTtcbiAqIC8vIHJlc3VsdCB3aWxsIGJlIFt7IGlkOiAxIH0sIHsgaWQ6IDIgfSwgeyBpZDogMyB9XSBzaW5jZSB7IGlkOiAyIH0gaXMgY29uc2lkZXJlZCBlcXVhbCBpbiBib3RoIGFycmF5c1xuICovXG5leHBvcnQgZnVuY3Rpb24gdW5pb25XaXRoPFQ+KFxuICBhcnIxOiByZWFkb25seSBUW10sXG4gIGFycjI6IHJlYWRvbmx5IFRbXSxcbiAgYXJlSXRlbXNFcXVhbDogKGl0ZW0xOiBULCBpdGVtMjogVCkgPT4gYm9vbGVhblxuKTogVFtdIHtcbiAgcmV0dXJuIHVuaXFXaXRoKGFycjEuY29uY2F0KGFycjIpLCBhcmVJdGVtc0VxdWFsKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxnQkFBZ0I7QUFFekM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FtQkMsR0FDRCxPQUFPLFNBQVMsVUFDZCxJQUFrQixFQUNsQixJQUFrQixFQUNsQixhQUE4QztFQUU5QyxPQUFPLFNBQVMsS0FBSyxNQUFNLENBQUMsT0FBTztBQUNyQyJ9
// denoCacheMetadata=692658637708605655,8866254673552929280