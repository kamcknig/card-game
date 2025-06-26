/**
 * Returns a new array containing only the unique elements from the original array,
 * based on the values returned by the comparator function.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr - The array to process.
 * @param {(item1: T, item2: T) => boolean} areItemsEqual - The function used to compare the array elements.
 * @returns {T[]} A new array containing only the unique elements from the original array, based on the values returned by the comparator function.
 *
 * @example
 * ```ts
 * uniqWith([1.2, 1.5, 2.1, 3.2, 5.7, 5.3, 7.19], (a, b) => Math.abs(a - b) < 1);
 * // [1.2, 3.2, 5.7, 7.19]
 * ```
 */ export function uniqWith(arr, areItemsEqual) {
  const result = [];
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    const isUniq = result.every((v)=>!areItemsEqual(v, item));
    if (isUniq) {
      result.push(item);
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bmlxV2l0aC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldHVybnMgYSBuZXcgYXJyYXkgY29udGFpbmluZyBvbmx5IHRoZSB1bmlxdWUgZWxlbWVudHMgZnJvbSB0aGUgb3JpZ2luYWwgYXJyYXksXG4gKiBiYXNlZCBvbiB0aGUgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBjb21wYXJhdG9yIGZ1bmN0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBwcm9jZXNzLlxuICogQHBhcmFtIHsoaXRlbTE6IFQsIGl0ZW0yOiBUKSA9PiBib29sZWFufSBhcmVJdGVtc0VxdWFsIC0gVGhlIGZ1bmN0aW9uIHVzZWQgdG8gY29tcGFyZSB0aGUgYXJyYXkgZWxlbWVudHMuXG4gKiBAcmV0dXJucyB7VFtdfSBBIG5ldyBhcnJheSBjb250YWluaW5nIG9ubHkgdGhlIHVuaXF1ZSBlbGVtZW50cyBmcm9tIHRoZSBvcmlnaW5hbCBhcnJheSwgYmFzZWQgb24gdGhlIHZhbHVlcyByZXR1cm5lZCBieSB0aGUgY29tcGFyYXRvciBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIHVuaXFXaXRoKFsxLjIsIDEuNSwgMi4xLCAzLjIsIDUuNywgNS4zLCA3LjE5XSwgKGEsIGIpID0+IE1hdGguYWJzKGEgLSBiKSA8IDEpO1xuICogLy8gWzEuMiwgMy4yLCA1LjcsIDcuMTldXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuaXFXaXRoPFQ+KGFycjogcmVhZG9ubHkgVFtdLCBhcmVJdGVtc0VxdWFsOiAoaXRlbTE6IFQsIGl0ZW0yOiBUKSA9PiBib29sZWFuKTogVFtdIHtcbiAgY29uc3QgcmVzdWx0OiBUW10gPSBbXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgY29uc3QgaXNVbmlxID0gcmVzdWx0LmV2ZXJ5KHYgPT4gIWFyZUl0ZW1zRXF1YWwodiwgaXRlbSkpO1xuXG4gICAgaWYgKGlzVW5pcSkge1xuICAgICAgcmVzdWx0LnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Q0FjQyxHQUNELE9BQU8sU0FBUyxTQUFZLEdBQWlCLEVBQUUsYUFBOEM7RUFDM0YsTUFBTSxTQUFjLEVBQUU7RUFFdEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLE1BQU0sU0FBUyxPQUFPLEtBQUssQ0FBQyxDQUFBLElBQUssQ0FBQyxjQUFjLEdBQUc7SUFFbkQsSUFBSSxRQUFRO01BQ1YsT0FBTyxJQUFJLENBQUM7SUFDZDtFQUNGO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=14889841374407072408,7053857026782129883