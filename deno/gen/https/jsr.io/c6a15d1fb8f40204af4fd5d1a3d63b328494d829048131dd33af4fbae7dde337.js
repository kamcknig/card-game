/**
 * Removes elements from an array based on a predicate function.
 *
 * This function changes `arr` in place.
 * If you want to remove elements without modifying the original array, use `filter`.
 *
 * @template T
 * @param {T[]} arr - The array to modify.
 * @param {(value: T, index: number, array: T[]) => boolean} shouldRemoveElement - The function invoked per iteration to determine if an element should be removed.
 * @returns {T[]} The modified array with the specified elements removed.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5];
 * remove(numbers, (value) => value % 2 === 0);
 * console.log(numbers); // [1, 3, 5]
 */ export function remove(arr, shouldRemoveElement) {
  const originalArr = arr.slice();
  const removed = [];
  let resultIndex = 0;
  for(let i = 0; i < arr.length; i++){
    if (shouldRemoveElement(arr[i], i, originalArr)) {
      removed.push(arr[i]);
      continue;
    }
    // For handling sparse arrays
    if (!Object.hasOwn(arr, i)) {
      delete arr[resultIndex++];
      continue;
    }
    arr[resultIndex++] = arr[i];
  }
  arr.length = resultIndex;
  return removed;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9yZW1vdmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZW1vdmVzIGVsZW1lbnRzIGZyb20gYW4gYXJyYXkgYmFzZWQgb24gYSBwcmVkaWNhdGUgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjaGFuZ2VzIGBhcnJgIGluIHBsYWNlLlxuICogSWYgeW91IHdhbnQgdG8gcmVtb3ZlIGVsZW1lbnRzIHdpdGhvdXQgbW9kaWZ5aW5nIHRoZSBvcmlnaW5hbCBhcnJheSwgdXNlIGBmaWx0ZXJgLlxuICpcbiAqIEB0ZW1wbGF0ZSBUXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7KHZhbHVlOiBULCBpbmRleDogbnVtYmVyLCBhcnJheTogVFtdKSA9PiBib29sZWFufSBzaG91bGRSZW1vdmVFbGVtZW50IC0gVGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbiB0byBkZXRlcm1pbmUgaWYgYW4gZWxlbWVudCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAqIEByZXR1cm5zIHtUW119IFRoZSBtb2RpZmllZCBhcnJheSB3aXRoIHRoZSBzcGVjaWZpZWQgZWxlbWVudHMgcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbnVtYmVycyA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIHJlbW92ZShudW1iZXJzLCAodmFsdWUpID0+IHZhbHVlICUgMiA9PT0gMCk7XG4gKiBjb25zb2xlLmxvZyhudW1iZXJzKTsgLy8gWzEsIDMsIDVdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmU8VD4oYXJyOiBUW10sIHNob3VsZFJlbW92ZUVsZW1lbnQ6ICh2YWx1ZTogVCwgaW5kZXg6IG51bWJlciwgYXJyYXk6IFRbXSkgPT4gYm9vbGVhbik6IFRbXSB7XG4gIGNvbnN0IG9yaWdpbmFsQXJyID0gYXJyLnNsaWNlKCk7XG4gIGNvbnN0IHJlbW92ZWQgPSBbXTtcblxuICBsZXQgcmVzdWx0SW5kZXggPSAwO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHNob3VsZFJlbW92ZUVsZW1lbnQoYXJyW2ldLCBpLCBvcmlnaW5hbEFycikpIHtcbiAgICAgIHJlbW92ZWQucHVzaChhcnJbaV0pO1xuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBGb3IgaGFuZGxpbmcgc3BhcnNlIGFycmF5c1xuICAgIGlmICghT2JqZWN0Lmhhc093bihhcnIsIGkpKSB7XG4gICAgICBkZWxldGUgYXJyW3Jlc3VsdEluZGV4KytdO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgYXJyW3Jlc3VsdEluZGV4KytdID0gYXJyW2ldO1xuICB9XG5cbiAgYXJyLmxlbmd0aCA9IHJlc3VsdEluZGV4O1xuXG4gIHJldHVybiByZW1vdmVkO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Q0FlQyxHQUNELE9BQU8sU0FBUyxPQUFVLEdBQVEsRUFBRSxtQkFBcUU7RUFDdkcsTUFBTSxjQUFjLElBQUksS0FBSztFQUM3QixNQUFNLFVBQVUsRUFBRTtFQUVsQixJQUFJLGNBQWM7RUFFbEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsSUFBSSxvQkFBb0IsR0FBRyxDQUFDLEVBQUUsRUFBRSxHQUFHLGNBQWM7TUFDL0MsUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7TUFFbkI7SUFDRjtJQUVBLDZCQUE2QjtJQUM3QixJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsS0FBSyxJQUFJO01BQzFCLE9BQU8sR0FBRyxDQUFDLGNBQWM7TUFDekI7SUFDRjtJQUVBLEdBQUcsQ0FBQyxjQUFjLEdBQUcsR0FBRyxDQUFDLEVBQUU7RUFDN0I7RUFFQSxJQUFJLE1BQU0sR0FBRztFQUViLE9BQU87QUFDVCJ9
// denoCacheMetadata=1273632708949155049,13202277940868212239