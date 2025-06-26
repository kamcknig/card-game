/**
 * Creates a new object composed of the picked object properties.
 *
 * This function takes an object and an array of keys, and returns a new object that
 * includes only the properties corresponding to the specified keys.
 *
 * @template T - The type of object.
 * @template K - The type of keys in object.
 * @param {T} obj - The object to pick keys from.
 * @param {K[]} keys - An array of keys to be picked from the object.
 * @returns {Pick<T, K>} A new object with the specified keys picked.
 *
 * @example
 * const obj = { a: 1, b: 2, c: 3 };
 * const result = pick(obj, ['a', 'c']);
 * // result will be { a: 1, c: 3 }
 */ export function pick(obj, keys) {
  const result = {};
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    if (Object.hasOwn(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvcGljay50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENyZWF0ZXMgYSBuZXcgb2JqZWN0IGNvbXBvc2VkIG9mIHRoZSBwaWNrZWQgb2JqZWN0IHByb3BlcnRpZXMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBvYmplY3QgYW5kIGFuIGFycmF5IG9mIGtleXMsIGFuZCByZXR1cm5zIGEgbmV3IG9iamVjdCB0aGF0XG4gKiBpbmNsdWRlcyBvbmx5IHRoZSBwcm9wZXJ0aWVzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBrZXlzLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2Ygb2JqZWN0LlxuICogQHRlbXBsYXRlIEsgLSBUaGUgdHlwZSBvZiBrZXlzIGluIG9iamVjdC5cbiAqIEBwYXJhbSB7VH0gb2JqIC0gVGhlIG9iamVjdCB0byBwaWNrIGtleXMgZnJvbS5cbiAqIEBwYXJhbSB7S1tdfSBrZXlzIC0gQW4gYXJyYXkgb2Yga2V5cyB0byBiZSBwaWNrZWQgZnJvbSB0aGUgb2JqZWN0LlxuICogQHJldHVybnMge1BpY2s8VCwgSz59IEEgbmV3IG9iamVjdCB3aXRoIHRoZSBzcGVjaWZpZWQga2V5cyBwaWNrZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogMiwgYzogMyB9O1xuICogY29uc3QgcmVzdWx0ID0gcGljayhvYmosIFsnYScsICdjJ10pO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyBhOiAxLCBjOiAzIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpY2s8VCBleHRlbmRzIFJlY29yZDxzdHJpbmcsIGFueT4sIEsgZXh0ZW5kcyBrZXlvZiBUPihvYmo6IFQsIGtleXM6IHJlYWRvbmx5IEtbXSk6IFBpY2s8VCwgSz4ge1xuICBjb25zdCByZXN1bHQgPSB7fSBhcyBQaWNrPFQsIEs+O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGtleXNbaV07XG5cbiAgICBpZiAoT2JqZWN0Lmhhc093bihvYmosIGtleSkpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gb2JqW2tleV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxLQUF1RCxHQUFNLEVBQUUsSUFBa0I7RUFDL0YsTUFBTSxTQUFTLENBQUM7RUFFaEIsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssTUFBTSxFQUFFLElBQUs7SUFDcEMsTUFBTSxNQUFNLElBQUksQ0FBQyxFQUFFO0lBRW5CLElBQUksT0FBTyxNQUFNLENBQUMsS0FBSyxNQUFNO01BQzNCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUk7SUFDeEI7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=2812484927491700647,11408273181640407960