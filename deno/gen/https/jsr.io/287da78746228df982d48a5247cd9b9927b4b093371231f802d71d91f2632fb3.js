/**
 * Combines two arrays, one of property names and one of corresponding values, into a single object.
 *
 * This function takes two arrays: one containing property names and another containing corresponding values.
 * It returns a new object where the property names from the first array are keys, and the corresponding elements
 * from the second array are values. If the `keys` array is longer than the `values` array, the remaining keys will
 * have `undefined` as their values.
 *
 * @template P - The type of elements in the array.
 * @template V - The type of elements in the array.
 * @param {P[]} keys - An array of property names.
 * @param {V[]} values - An array of values corresponding to the property names.
 * @returns {Record<P, V>} - A new object composed of the given property names and values.
 *
 * @example
 * const keys = ['a', 'b', 'c'];
 * const values = [1, 2, 3];
 * const result = zipObject(keys, values);
 * // result will be { a: 1, b: 2, c: 3 }
 *
 * const keys2 = ['a', 'b', 'c'];
 * const values2 = [1, 2];
 * const result2 = zipObject(keys2, values2);
 * // result2 will be { a: 1, b: 2, c: undefined }
 *
 * const keys2 = ['a', 'b'];
 * const values2 = [1, 2, 3];
 * const result2 = zipObject(keys2, values2);
 * // result2 will be { a: 1, b: 2 }
 */ export function zipObject(keys, values) {
  const result = {};
  for(let i = 0; i < keys.length; i++){
    result[keys[i]] = values[i];
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS96aXBPYmplY3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb21iaW5lcyB0d28gYXJyYXlzLCBvbmUgb2YgcHJvcGVydHkgbmFtZXMgYW5kIG9uZSBvZiBjb3JyZXNwb25kaW5nIHZhbHVlcywgaW50byBhIHNpbmdsZSBvYmplY3QuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyB0d28gYXJyYXlzOiBvbmUgY29udGFpbmluZyBwcm9wZXJ0eSBuYW1lcyBhbmQgYW5vdGhlciBjb250YWluaW5nIGNvcnJlc3BvbmRpbmcgdmFsdWVzLlxuICogSXQgcmV0dXJucyBhIG5ldyBvYmplY3Qgd2hlcmUgdGhlIHByb3BlcnR5IG5hbWVzIGZyb20gdGhlIGZpcnN0IGFycmF5IGFyZSBrZXlzLCBhbmQgdGhlIGNvcnJlc3BvbmRpbmcgZWxlbWVudHNcbiAqIGZyb20gdGhlIHNlY29uZCBhcnJheSBhcmUgdmFsdWVzLiBJZiB0aGUgYGtleXNgIGFycmF5IGlzIGxvbmdlciB0aGFuIHRoZSBgdmFsdWVzYCBhcnJheSwgdGhlIHJlbWFpbmluZyBrZXlzIHdpbGxcbiAqIGhhdmUgYHVuZGVmaW5lZGAgYXMgdGhlaXIgdmFsdWVzLlxuICpcbiAqIEB0ZW1wbGF0ZSBQIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHRlbXBsYXRlIFYgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1BbXX0ga2V5cyAtIEFuIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQHBhcmFtIHtWW119IHZhbHVlcyAtIEFuIGFycmF5IG9mIHZhbHVlcyBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcm9wZXJ0eSBuYW1lcy5cbiAqIEByZXR1cm5zIHtSZWNvcmQ8UCwgVj59IC0gQSBuZXcgb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBnaXZlbiBwcm9wZXJ0eSBuYW1lcyBhbmQgdmFsdWVzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBrZXlzID0gWydhJywgJ2InLCAnYyddO1xuICogY29uc3QgdmFsdWVzID0gWzEsIDIsIDNdO1xuICogY29uc3QgcmVzdWx0ID0gemlwT2JqZWN0KGtleXMsIHZhbHVlcyk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSB7IGE6IDEsIGI6IDIsIGM6IDMgfVxuICpcbiAqIGNvbnN0IGtleXMyID0gWydhJywgJ2InLCAnYyddO1xuICogY29uc3QgdmFsdWVzMiA9IFsxLCAyXTtcbiAqIGNvbnN0IHJlc3VsdDIgPSB6aXBPYmplY3Qoa2V5czIsIHZhbHVlczIpO1xuICogLy8gcmVzdWx0MiB3aWxsIGJlIHsgYTogMSwgYjogMiwgYzogdW5kZWZpbmVkIH1cbiAqXG4gKiBjb25zdCBrZXlzMiA9IFsnYScsICdiJ107XG4gKiBjb25zdCB2YWx1ZXMyID0gWzEsIDIsIDNdO1xuICogY29uc3QgcmVzdWx0MiA9IHppcE9iamVjdChrZXlzMiwgdmFsdWVzMik7XG4gKiAvLyByZXN1bHQyIHdpbGwgYmUgeyBhOiAxLCBiOiAyIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHppcE9iamVjdDxQIGV4dGVuZHMgUHJvcGVydHlLZXksIFY+KGtleXM6IHJlYWRvbmx5IFBbXSwgdmFsdWVzOiByZWFkb25seSBWW10pOiBSZWNvcmQ8UCwgVj4ge1xuICBjb25zdCByZXN1bHQgPSB7fSBhcyBSZWNvcmQ8UCwgVj47XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzdWx0W2tleXNbaV1dID0gdmFsdWVzW2ldO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkMsR0FDRCxPQUFPLFNBQVMsVUFBb0MsSUFBa0IsRUFBRSxNQUFvQjtFQUMxRixNQUFNLFNBQVMsQ0FBQztFQUVoQixJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxNQUFNLEVBQUUsSUFBSztJQUNwQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxFQUFFO0VBQzdCO0VBRUEsT0FBTztBQUNUIn0=
// denoCacheMetadata=17848617038606377851,18114429526668067897