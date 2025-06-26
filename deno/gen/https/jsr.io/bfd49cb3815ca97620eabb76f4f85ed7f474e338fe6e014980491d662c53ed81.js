/**
 * Maps each element of an array based on a provided key-generating function.
 *
 * This function takes an array and a function that generates a key from each element. It returns
 * an object where the keys are the generated keys and the values are the corresponding elements.
 * If there are multiple elements generating the same key, the last element among them is used
 * as the value.
 *
 * @template T - The type of elements in the array.
 * @template K - The type of keys.
 * @param {T[]} arr - The array of elements to be mapped.
 * @param {(item: T) => K} getKeyFromItem - A function that generates a key from an element.
 * @returns {Record<K, T>} An object where keys are mapped to each element of an array.
 *
 * @example
 * const array = [
 *   { category: 'fruit', name: 'apple' },
 *   { category: 'fruit', name: 'banana' },
 *   { category: 'vegetable', name: 'carrot' }
 * ];
 * const result = keyBy(array, item => item.category);
 * // result will be:
 * // {
 * //   fruit: { category: 'fruit', name: 'banana' },
 * //   vegetable: { category: 'vegetable', name: 'carrot' }
 * // }
 */ export function keyBy(arr, getKeyFromItem) {
  const result = {};
  for(let i = 0; i < arr.length; i++){
    const item = arr[i];
    const key = getKeyFromItem(item);
    result[key] = item;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9rZXlCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1hcHMgZWFjaCBlbGVtZW50IG9mIGFuIGFycmF5IGJhc2VkIG9uIGEgcHJvdmlkZWQga2V5LWdlbmVyYXRpbmcgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBhbmQgYSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBhIGtleSBmcm9tIGVhY2ggZWxlbWVudC4gSXQgcmV0dXJuc1xuICogYW4gb2JqZWN0IHdoZXJlIHRoZSBrZXlzIGFyZSB0aGUgZ2VuZXJhdGVkIGtleXMgYW5kIHRoZSB2YWx1ZXMgYXJlIHRoZSBjb3JyZXNwb25kaW5nIGVsZW1lbnRzLlxuICogSWYgdGhlcmUgYXJlIG11bHRpcGxlIGVsZW1lbnRzIGdlbmVyYXRpbmcgdGhlIHNhbWUga2V5LCB0aGUgbGFzdCBlbGVtZW50IGFtb25nIHRoZW0gaXMgdXNlZFxuICogYXMgdGhlIHZhbHVlLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHRlbXBsYXRlIEsgLSBUaGUgdHlwZSBvZiBrZXlzLlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSBvZiBlbGVtZW50cyB0byBiZSBtYXBwZWQuXG4gKiBAcGFyYW0geyhpdGVtOiBUKSA9PiBLfSBnZXRLZXlGcm9tSXRlbSAtIEEgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgYSBrZXkgZnJvbSBhbiBlbGVtZW50LlxuICogQHJldHVybnMge1JlY29yZDxLLCBUPn0gQW4gb2JqZWN0IHdoZXJlIGtleXMgYXJlIG1hcHBlZCB0byBlYWNoIGVsZW1lbnQgb2YgYW4gYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFycmF5ID0gW1xuICogICB7IGNhdGVnb3J5OiAnZnJ1aXQnLCBuYW1lOiAnYXBwbGUnIH0sXG4gKiAgIHsgY2F0ZWdvcnk6ICdmcnVpdCcsIG5hbWU6ICdiYW5hbmEnIH0sXG4gKiAgIHsgY2F0ZWdvcnk6ICd2ZWdldGFibGUnLCBuYW1lOiAnY2Fycm90JyB9XG4gKiBdO1xuICogY29uc3QgcmVzdWx0ID0ga2V5QnkoYXJyYXksIGl0ZW0gPT4gaXRlbS5jYXRlZ29yeSk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZTpcbiAqIC8vIHtcbiAqIC8vICAgZnJ1aXQ6IHsgY2F0ZWdvcnk6ICdmcnVpdCcsIG5hbWU6ICdiYW5hbmEnIH0sXG4gKiAvLyAgIHZlZ2V0YWJsZTogeyBjYXRlZ29yeTogJ3ZlZ2V0YWJsZScsIG5hbWU6ICdjYXJyb3QnIH1cbiAqIC8vIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtleUJ5PFQsIEsgZXh0ZW5kcyBQcm9wZXJ0eUtleT4oYXJyOiByZWFkb25seSBUW10sIGdldEtleUZyb21JdGVtOiAoaXRlbTogVCkgPT4gSyk6IFJlY29yZDxLLCBUPiB7XG4gIGNvbnN0IHJlc3VsdCA9IHt9IGFzIFJlY29yZDxLLCBUPjtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGl0ZW0gPSBhcnJbaV07XG4gICAgY29uc3Qga2V5ID0gZ2V0S2V5RnJvbUl0ZW0oaXRlbSk7XG4gICAgcmVzdWx0W2tleV0gPSBpdGVtO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EwQkMsR0FDRCxPQUFPLFNBQVMsTUFBZ0MsR0FBaUIsRUFBRSxjQUE4QjtFQUMvRixNQUFNLFNBQVMsQ0FBQztFQUVoQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxNQUFNLEVBQUUsSUFBSztJQUNuQyxNQUFNLE9BQU8sR0FBRyxDQUFDLEVBQUU7SUFDbkIsTUFBTSxNQUFNLGVBQWU7SUFDM0IsTUFBTSxDQUFDLElBQUksR0FBRztFQUNoQjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=2366181008993032377,7493749201129066280