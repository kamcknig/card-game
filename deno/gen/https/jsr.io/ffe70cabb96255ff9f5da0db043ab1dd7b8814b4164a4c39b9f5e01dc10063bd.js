/**
 * Returns a new array containing only the unique elements from the original array,
 * based on the values returned by the mapper function.
 *
 * @template T - The type of elements in the array.
 * @template U - The type of mapped elements.
 * @param {T[]} arr - The array to process.
 * @param {(item: T) => U} mapper - The function used to convert the array elements.
 * @returns {T[]} A new array containing only the unique elements from the original array, based on the values returned by the mapper function.
 *
 * @example
 * ```ts
 * uniqBy([1.2, 1.5, 2.1, 3.2, 5.7, 5.3, 7.19], Math.floor);
 * // [1.2, 2.1, 3.2, 5.7, 7.19]
 * ```
 *
 * @example
 * const array = [
 *   { category: 'fruit', name: 'apple' },
 *   { category: 'fruit', name: 'banana' },
 *   { category: 'vegetable', name: 'carrot' },
 * ];
 * uniqBy(array, item => item.category).length
 * // 2
 * ```
 */ export function uniqBy(arr, mapper) {
  const map = new Map();
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    const key = mapper(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bmlxQnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXR1cm5zIGEgbmV3IGFycmF5IGNvbnRhaW5pbmcgb25seSB0aGUgdW5pcXVlIGVsZW1lbnRzIGZyb20gdGhlIG9yaWdpbmFsIGFycmF5LFxuICogYmFzZWQgb24gdGhlIHZhbHVlcyByZXR1cm5lZCBieSB0aGUgbWFwcGVyIGZ1bmN0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHRlbXBsYXRlIFUgLSBUaGUgdHlwZSBvZiBtYXBwZWQgZWxlbWVudHMuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIHByb2Nlc3MuXG4gKiBAcGFyYW0geyhpdGVtOiBUKSA9PiBVfSBtYXBwZXIgLSBUaGUgZnVuY3Rpb24gdXNlZCB0byBjb252ZXJ0IHRoZSBhcnJheSBlbGVtZW50cy5cbiAqIEByZXR1cm5zIHtUW119IEEgbmV3IGFycmF5IGNvbnRhaW5pbmcgb25seSB0aGUgdW5pcXVlIGVsZW1lbnRzIGZyb20gdGhlIG9yaWdpbmFsIGFycmF5LCBiYXNlZCBvbiB0aGUgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBtYXBwZXIgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzXG4gKiB1bmlxQnkoWzEuMiwgMS41LCAyLjEsIDMuMiwgNS43LCA1LjMsIDcuMTldLCBNYXRoLmZsb29yKTtcbiAqIC8vIFsxLjIsIDIuMSwgMy4yLCA1LjcsIDcuMTldXG4gKiBgYGBcbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbXG4gKiAgIHsgY2F0ZWdvcnk6ICdmcnVpdCcsIG5hbWU6ICdhcHBsZScgfSxcbiAqICAgeyBjYXRlZ29yeTogJ2ZydWl0JywgbmFtZTogJ2JhbmFuYScgfSxcbiAqICAgeyBjYXRlZ29yeTogJ3ZlZ2V0YWJsZScsIG5hbWU6ICdjYXJyb3QnIH0sXG4gKiBdO1xuICogdW5pcUJ5KGFycmF5LCBpdGVtID0+IGl0ZW0uY2F0ZWdvcnkpLmxlbmd0aFxuICogLy8gMlxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnk8VCwgVT4oYXJyOiByZWFkb25seSBUW10sIG1hcHBlcjogKGl0ZW06IFQpID0+IFUpOiBUW10ge1xuICBjb25zdCBtYXAgPSBuZXcgTWFwPFUsIFQ+KCk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBpdGVtID0gYXJyW2ldO1xuICAgIGNvbnN0IGtleSA9IG1hcHBlcihpdGVtKTtcblxuICAgIGlmICghbWFwLmhhcyhrZXkpKSB7XG4gICAgICBtYXAuc2V0KGtleSwgaXRlbSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIEFycmF5LmZyb20obWFwLnZhbHVlcygpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXlCQyxHQUNELE9BQU8sU0FBUyxPQUFhLEdBQWlCLEVBQUUsTUFBc0I7RUFDcEUsTUFBTSxNQUFNLElBQUk7RUFFaEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksTUFBTSxFQUFFLElBQUs7SUFDbkMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLE1BQU0sTUFBTSxPQUFPO0lBRW5CLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNO01BQ2pCLElBQUksR0FBRyxDQUFDLEtBQUs7SUFDZjtFQUNGO0VBRUEsT0FBTyxNQUFNLElBQUksQ0FBQyxJQUFJLE1BQU07QUFDOUIifQ==
// denoCacheMetadata=4594120884372242077,4356892717059450802