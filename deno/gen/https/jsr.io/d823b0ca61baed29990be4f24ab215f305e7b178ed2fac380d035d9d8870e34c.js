/**
 * Removes a specified number of elements from the beginning of an array and returns the rest.
 *
 * This function takes an array and a number, and returns a new array with the specified number
 * of elements removed from the start.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array from which to drop elements.
 * @param {number} itemsCount - The number of elements to drop from the beginning of the array.
 * @returns {T[]} A new array with the specified number of elements removed from the start.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = drop(array, 2);
 * // result will be [3, 4, 5] since the first two elements are dropped.
 */ export function drop(arr, itemsCount) {
  itemsCount = Math.max(itemsCount, 0);
  return arr.slice(itemsCount);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kcm9wLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVtb3ZlcyBhIHNwZWNpZmllZCBudW1iZXIgb2YgZWxlbWVudHMgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIGFuIGFycmF5IGFuZCByZXR1cm5zIHRoZSByZXN0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgYW5kIGEgbnVtYmVyLCBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSB3aXRoIHRoZSBzcGVjaWZpZWQgbnVtYmVyXG4gKiBvZiBlbGVtZW50cyByZW1vdmVkIGZyb20gdGhlIHN0YXJ0LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIGRyb3AgZWxlbWVudHMuXG4gKiBAcGFyYW0ge251bWJlcn0gaXRlbXNDb3VudCAtIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZHJvcCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFycmF5LlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgd2l0aCB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBlbGVtZW50cyByZW1vdmVkIGZyb20gdGhlIHN0YXJ0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheSA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IHJlc3VsdCA9IGRyb3AoYXJyYXksIDIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzMsIDQsIDVdIHNpbmNlIHRoZSBmaXJzdCB0d28gZWxlbWVudHMgYXJlIGRyb3BwZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkcm9wPFQ+KGFycjogcmVhZG9ubHkgVFtdLCBpdGVtc0NvdW50OiBudW1iZXIpOiBUW10ge1xuICBpdGVtc0NvdW50ID0gTWF0aC5tYXgoaXRlbXNDb3VudCwgMCk7XG5cbiAgcmV0dXJuIGFyci5zbGljZShpdGVtc0NvdW50KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsS0FBUSxHQUFpQixFQUFFLFVBQWtCO0VBQzNELGFBQWEsS0FBSyxHQUFHLENBQUMsWUFBWTtFQUVsQyxPQUFPLElBQUksS0FBSyxDQUFDO0FBQ25CIn0=
// denoCacheMetadata=6164789588877638549,8642393341272106515