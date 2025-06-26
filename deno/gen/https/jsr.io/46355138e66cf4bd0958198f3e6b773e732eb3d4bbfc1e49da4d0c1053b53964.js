/**
 * Count the occurrences of each item in an array
 * based on a transformation function.
 *
 * This function takes an array and a transformation function
 * that converts each item in the array to a key. It then
 * counts the occurrences of each transformed item and returns
 * an object with the transformed items as keys and the counts
 * as values.
 *
 * @template T - The type of the items in the input array.
 * @template K - The type of keys.
 * @param {T[]} arr - The input array to count occurrences.
 * @param {(item: T) => K} mapper - The transformation function that maps each item to a key.
 * @returns {Record<K, number>} An object containing the transformed items as keys and the
 * counts as values.
 *
 * @example
 * const array = ['a', 'b', 'c', 'a', 'b', 'a'];
 * const result = countBy(array, x => x);
 * // result will be { a: 3, b: 2, c: 1 }
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = countBy(array, item => item % 2 === 0 ? 'even' : 'odd');
 * // result will be { odd: 3, even: 2 }
 */ export function countBy(arr, mapper) {
  const result = {};
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    const key = mapper(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9jb3VudEJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ291bnQgdGhlIG9jY3VycmVuY2VzIG9mIGVhY2ggaXRlbSBpbiBhbiBhcnJheVxuICogYmFzZWQgb24gYSB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGFycmF5IGFuZCBhIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uXG4gKiB0aGF0IGNvbnZlcnRzIGVhY2ggaXRlbSBpbiB0aGUgYXJyYXkgdG8gYSBrZXkuIEl0IHRoZW5cbiAqIGNvdW50cyB0aGUgb2NjdXJyZW5jZXMgb2YgZWFjaCB0cmFuc2Zvcm1lZCBpdGVtIGFuZCByZXR1cm5zXG4gKiBhbiBvYmplY3Qgd2l0aCB0aGUgdHJhbnNmb3JtZWQgaXRlbXMgYXMga2V5cyBhbmQgdGhlIGNvdW50c1xuICogYXMgdmFsdWVzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgdGhlIGl0ZW1zIGluIHRoZSBpbnB1dCBhcnJheS5cbiAqIEB0ZW1wbGF0ZSBLIC0gVGhlIHR5cGUgb2Yga2V5cy5cbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgaW5wdXQgYXJyYXkgdG8gY291bnQgb2NjdXJyZW5jZXMuXG4gKiBAcGFyYW0geyhpdGVtOiBUKSA9PiBLfSBtYXBwZXIgLSBUaGUgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24gdGhhdCBtYXBzIGVhY2ggaXRlbSB0byBhIGtleS5cbiAqIEByZXR1cm5zIHtSZWNvcmQ8SywgbnVtYmVyPn0gQW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHRyYW5zZm9ybWVkIGl0ZW1zIGFzIGtleXMgYW5kIHRoZVxuICogY291bnRzIGFzIHZhbHVlcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbJ2EnLCAnYicsICdjJywgJ2EnLCAnYicsICdhJ107XG4gKiBjb25zdCByZXN1bHQgPSBjb3VudEJ5KGFycmF5LCB4ID0+IHgpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyBhOiAzLCBiOiAyLCBjOiAxIH1cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCByZXN1bHQgPSBjb3VudEJ5KGFycmF5LCBpdGVtID0+IGl0ZW0gJSAyID09PSAwID8gJ2V2ZW4nIDogJ29kZCcpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyBvZGQ6IDMsIGV2ZW46IDIgfVxuICovXG5leHBvcnQgZnVuY3Rpb24gY291bnRCeTxULCBLIGV4dGVuZHMgUHJvcGVydHlLZXk+KGFycjogcmVhZG9ubHkgVFtdLCBtYXBwZXI6IChpdGVtOiBUKSA9PiBLKTogUmVjb3JkPEssIG51bWJlcj4ge1xuICBjb25zdCByZXN1bHQgPSB7fSBhcyBSZWNvcmQ8SywgbnVtYmVyPjtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgY29uc3Qga2V5ID0gbWFwcGVyKGl0ZW0pO1xuXG4gICAgcmVzdWx0W2tleV0gPSAocmVzdWx0W2tleV0gPz8gMCkgKyAxO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EwQkMsR0FDRCxPQUFPLFNBQVMsUUFBa0MsR0FBaUIsRUFBRSxNQUFzQjtFQUN6RixNQUFNLFNBQVMsQ0FBQztFQUVoQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxNQUFNLEVBQUUsSUFBSztJQUNuQyxNQUFNLE9BQU8sR0FBRyxDQUFDLEVBQUU7SUFDbkIsTUFBTSxNQUFNLE9BQU87SUFFbkIsTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJO0VBQ3JDO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=518042793438794253,12160630946961778947