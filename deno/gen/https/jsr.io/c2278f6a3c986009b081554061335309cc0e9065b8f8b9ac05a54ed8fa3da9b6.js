/**
 * Returns the intersection of two arrays.
 *
 * This function takes two arrays and returns a new array containing the elements that are
 * present in both arrays. It effectively filters out any elements from the first array that
 * are not found in the second array.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} firstArr - The first array to compare.
 * @param {T[]} secondArr - The second array to compare.
 * @returns {T[]} A new array containing the elements that are present in both arrays.
 *
 * @example
 * const array1 = [1, 2, 3, 4, 5];
 * const array2 = [3, 4, 5, 6, 7];
 * const result = intersection(array1, array2);
 * // result will be [3, 4, 5] since these elements are in both arrays.
 */ export function intersection(firstArr, secondArr) {
  const secondSet = new Set(secondArr);
  return firstArr.filter((item)=>{
    return secondSet.has(item);
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9pbnRlcnNlY3Rpb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXR1cm5zIHRoZSBpbnRlcnNlY3Rpb24gb2YgdHdvIGFycmF5cy5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIHR3byBhcnJheXMgYW5kIHJldHVybnMgYSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgZWxlbWVudHMgdGhhdCBhcmVcbiAqIHByZXNlbnQgaW4gYm90aCBhcnJheXMuIEl0IGVmZmVjdGl2ZWx5IGZpbHRlcnMgb3V0IGFueSBlbGVtZW50cyBmcm9tIHRoZSBmaXJzdCBhcnJheSB0aGF0XG4gKiBhcmUgbm90IGZvdW5kIGluIHRoZSBzZWNvbmQgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gZmlyc3RBcnIgLSBUaGUgZmlyc3QgYXJyYXkgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7VFtdfSBzZWNvbmRBcnIgLSBUaGUgc2Vjb25kIGFycmF5IHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyB0aGF0IGFyZSBwcmVzZW50IGluIGJvdGggYXJyYXlzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheTEgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCBhcnJheTIgPSBbMywgNCwgNSwgNiwgN107XG4gKiBjb25zdCByZXN1bHQgPSBpbnRlcnNlY3Rpb24oYXJyYXkxLCBhcnJheTIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzMsIDQsIDVdIHNpbmNlIHRoZXNlIGVsZW1lbnRzIGFyZSBpbiBib3RoIGFycmF5cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGludGVyc2VjdGlvbjxUPihmaXJzdEFycjogcmVhZG9ubHkgVFtdLCBzZWNvbmRBcnI6IHJlYWRvbmx5IFRbXSk6IFRbXSB7XG4gIGNvbnN0IHNlY29uZFNldCA9IG5ldyBTZXQoc2Vjb25kQXJyKTtcblxuICByZXR1cm4gZmlyc3RBcnIuZmlsdGVyKGl0ZW0gPT4ge1xuICAgIHJldHVybiBzZWNvbmRTZXQuaGFzKGl0ZW0pO1xuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpQkMsR0FDRCxPQUFPLFNBQVMsYUFBZ0IsUUFBc0IsRUFBRSxTQUF1QjtFQUM3RSxNQUFNLFlBQVksSUFBSSxJQUFJO0VBRTFCLE9BQU8sU0FBUyxNQUFNLENBQUMsQ0FBQTtJQUNyQixPQUFPLFVBQVUsR0FBRyxDQUFDO0VBQ3ZCO0FBQ0YifQ==
// denoCacheMetadata=206855866220394484,11344940166425010666