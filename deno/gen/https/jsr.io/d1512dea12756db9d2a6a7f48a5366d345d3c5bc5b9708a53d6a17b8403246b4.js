/**
 * Removes a specified number of elements from the end of an array and returns the rest.
 *
 * This function takes an array and a number, and returns a new array with the specified number
 * of elements removed from the end.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array from which to drop elements.
 * @param {number} itemsCount - The number of elements to drop from the end of the array.
 * @returns {T[]} A new array with the specified number of elements removed from the end.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = dropRight(array, 2);
 * // result will be [1, 2, 3] since the last two elements are dropped.
 */ export function dropRight(arr, itemsCount) {
  itemsCount = Math.min(-itemsCount, 0);
  if (itemsCount === 0) {
    return arr.slice();
  }
  return arr.slice(0, itemsCount);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9kcm9wUmlnaHQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZW1vdmVzIGEgc3BlY2lmaWVkIG51bWJlciBvZiBlbGVtZW50cyBmcm9tIHRoZSBlbmQgb2YgYW4gYXJyYXkgYW5kIHJldHVybnMgdGhlIHJlc3QuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBhbmQgYSBudW1iZXIsIGFuZCByZXR1cm5zIGEgbmV3IGFycmF5IHdpdGggdGhlIHNwZWNpZmllZCBudW1iZXJcbiAqIG9mIGVsZW1lbnRzIHJlbW92ZWQgZnJvbSB0aGUgZW5kLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIGRyb3AgZWxlbWVudHMuXG4gKiBAcGFyYW0ge251bWJlcn0gaXRlbXNDb3VudCAtIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZHJvcCBmcm9tIHRoZSBlbmQgb2YgdGhlIGFycmF5LlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgd2l0aCB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBlbGVtZW50cyByZW1vdmVkIGZyb20gdGhlIGVuZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCByZXN1bHQgPSBkcm9wUmlnaHQoYXJyYXksIDIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzEsIDIsIDNdIHNpbmNlIHRoZSBsYXN0IHR3byBlbGVtZW50cyBhcmUgZHJvcHBlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRyb3BSaWdodDxUPihhcnI6IHJlYWRvbmx5IFRbXSwgaXRlbXNDb3VudDogbnVtYmVyKTogVFtdIHtcbiAgaXRlbXNDb3VudCA9IE1hdGgubWluKC1pdGVtc0NvdW50LCAwKTtcblxuICBpZiAoaXRlbXNDb3VudCA9PT0gMCkge1xuICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgfVxuXG4gIHJldHVybiBhcnIuc2xpY2UoMCwgaXRlbXNDb3VudCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7OztDQWVDLEdBQ0QsT0FBTyxTQUFTLFVBQWEsR0FBaUIsRUFBRSxVQUFrQjtFQUNoRSxhQUFhLEtBQUssR0FBRyxDQUFDLENBQUMsWUFBWTtFQUVuQyxJQUFJLGVBQWUsR0FBRztJQUNwQixPQUFPLElBQUksS0FBSztFQUNsQjtFQUVBLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRztBQUN0QiJ9
// denoCacheMetadata=9359762565556988794,6886163771574880318