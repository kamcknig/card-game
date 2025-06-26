/**
 * Removes elements from the beginning of an array until the predicate returns false.
 *
 * This function iterates over an array and drops elements from the start until the provided
 * predicate function returns false. It then returns a new array with the remaining elements.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array from which to drop elements.
 * @param {(item: T, index: number, arr: T[]) => boolean} canContinueDropping - A predicate function that determines
 * whether to continue dropping elements. The function is called with each element, and dropping
 * continues as long as it returns true.
 * @returns {T[]} A new array with the elements remaining after the predicate returns false.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = dropWhile(array, x => x < 3);
 * // result will be [3, 4, 5] since elements less than 3 are dropped.
 */ export function dropWhile(arr, canContinueDropping) {
  const dropEndIndex = arr.findIndex((item, index, arr)=>!canContinueDropping(item, index, arr));
  if (dropEndIndex === -1) {
    return [];
  }
  return arr.slice(dropEndIndex);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kcm9wV2hpbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZW1vdmVzIGVsZW1lbnRzIGZyb20gdGhlIGJlZ2lubmluZyBvZiBhbiBhcnJheSB1bnRpbCB0aGUgcHJlZGljYXRlIHJldHVybnMgZmFsc2UuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBpdGVyYXRlcyBvdmVyIGFuIGFycmF5IGFuZCBkcm9wcyBlbGVtZW50cyBmcm9tIHRoZSBzdGFydCB1bnRpbCB0aGUgcHJvdmlkZWRcbiAqIHByZWRpY2F0ZSBmdW5jdGlvbiByZXR1cm5zIGZhbHNlLiBJdCB0aGVuIHJldHVybnMgYSBuZXcgYXJyYXkgd2l0aCB0aGUgcmVtYWluaW5nIGVsZW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIGRyb3AgZWxlbWVudHMuXG4gKiBAcGFyYW0geyhpdGVtOiBULCBpbmRleDogbnVtYmVyLCBhcnI6IFRbXSkgPT4gYm9vbGVhbn0gY2FuQ29udGludWVEcm9wcGluZyAtIEEgcHJlZGljYXRlIGZ1bmN0aW9uIHRoYXQgZGV0ZXJtaW5lc1xuICogd2hldGhlciB0byBjb250aW51ZSBkcm9wcGluZyBlbGVtZW50cy4gVGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIGVhY2ggZWxlbWVudCwgYW5kIGRyb3BwaW5nXG4gKiBjb250aW51ZXMgYXMgbG9uZyBhcyBpdCByZXR1cm5zIHRydWUuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSB3aXRoIHRoZSBlbGVtZW50cyByZW1haW5pbmcgYWZ0ZXIgdGhlIHByZWRpY2F0ZSByZXR1cm5zIGZhbHNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheSA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IHJlc3VsdCA9IGRyb3BXaGlsZShhcnJheSwgeCA9PiB4IDwgMyk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSBbMywgNCwgNV0gc2luY2UgZWxlbWVudHMgbGVzcyB0aGFuIDMgYXJlIGRyb3BwZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkcm9wV2hpbGU8VD4oXG4gIGFycjogcmVhZG9ubHkgVFtdLFxuICBjYW5Db250aW51ZURyb3BwaW5nOiAoaXRlbTogVCwgaW5kZXg6IG51bWJlciwgYXJyOiByZWFkb25seSBUW10pID0+IGJvb2xlYW5cbik6IFRbXSB7XG4gIGNvbnN0IGRyb3BFbmRJbmRleCA9IGFyci5maW5kSW5kZXgoKGl0ZW0sIGluZGV4LCBhcnIpID0+ICFjYW5Db250aW51ZURyb3BwaW5nKGl0ZW0sIGluZGV4LCBhcnIpKTtcblxuICBpZiAoZHJvcEVuZEluZGV4ID09PSAtMSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiBhcnIuc2xpY2UoZHJvcEVuZEluZGV4KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpQkMsR0FDRCxPQUFPLFNBQVMsVUFDZCxHQUFpQixFQUNqQixtQkFBMkU7RUFFM0UsTUFBTSxlQUFlLElBQUksU0FBUyxDQUFDLENBQUMsTUFBTSxPQUFPLE1BQVEsQ0FBQyxvQkFBb0IsTUFBTSxPQUFPO0VBRTNGLElBQUksaUJBQWlCLENBQUMsR0FBRztJQUN2QixPQUFPLEVBQUU7RUFDWDtFQUVBLE9BQU8sSUFBSSxLQUFLLENBQUM7QUFDbkIifQ==
// denoCacheMetadata=4241852994740121283,3886868317112170248