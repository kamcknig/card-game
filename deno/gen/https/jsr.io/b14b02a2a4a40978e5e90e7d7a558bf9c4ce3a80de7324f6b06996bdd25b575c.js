import { uniq } from './uniq.ts';
/**
 * Creates an array of unique values from all given arrays.
 *
 * This function takes two arrays, merges them into a single array, and returns a new array
 * containing only the unique values from the merged array.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr1 - The first array to merge and filter for unique values.
 * @param {T[]} arr2 - The second array to merge and filter for unique values.
 * @returns {T[]} A new array of unique values.
 *
 * @example
 * const array1 = [1, 2, 3];
 * const array2 = [3, 4, 5];
 * const result = union(array1, array2);
 * // result will be [1, 2, 3, 4, 5]
 */ export function union(arr1, arr2) {
  return uniq(arr1.concat(arr2));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bmlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB1bmlxIH0gZnJvbSAnLi91bmlxLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHVuaXF1ZSB2YWx1ZXMgZnJvbSBhbGwgZ2l2ZW4gYXJyYXlzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgdHdvIGFycmF5cywgbWVyZ2VzIHRoZW0gaW50byBhIHNpbmdsZSBhcnJheSwgYW5kIHJldHVybnMgYSBuZXcgYXJyYXlcbiAqIGNvbnRhaW5pbmcgb25seSB0aGUgdW5pcXVlIHZhbHVlcyBmcm9tIHRoZSBtZXJnZWQgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyMSAtIFRoZSBmaXJzdCBhcnJheSB0byBtZXJnZSBhbmQgZmlsdGVyIGZvciB1bmlxdWUgdmFsdWVzLlxuICogQHBhcmFtIHtUW119IGFycjIgLSBUaGUgc2Vjb25kIGFycmF5IHRvIG1lcmdlIGFuZCBmaWx0ZXIgZm9yIHVuaXF1ZSB2YWx1ZXMuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBvZiB1bmlxdWUgdmFsdWVzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheTEgPSBbMSwgMiwgM107XG4gKiBjb25zdCBhcnJheTIgPSBbMywgNCwgNV07XG4gKiBjb25zdCByZXN1bHQgPSB1bmlvbihhcnJheTEsIGFycmF5Mik7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMSwgMiwgMywgNCwgNV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuaW9uPFQ+KGFycjE6IHJlYWRvbmx5IFRbXSwgYXJyMjogcmVhZG9ubHkgVFtdKTogVFtdIHtcbiAgcmV0dXJuIHVuaXEoYXJyMS5jb25jYXQoYXJyMikpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsSUFBSSxRQUFRLFlBQVk7QUFFakM7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsTUFBUyxJQUFrQixFQUFFLElBQWtCO0VBQzdELE9BQU8sS0FBSyxLQUFLLE1BQU0sQ0FBQztBQUMxQiJ9
// denoCacheMetadata=5872994232018667251,15276922967151364401