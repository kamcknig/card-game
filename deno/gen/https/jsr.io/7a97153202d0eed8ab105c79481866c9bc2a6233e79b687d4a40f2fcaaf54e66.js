/**
 * Inverts the keys and values of an object. The keys of the input object become the values of the output object and vice versa.
 *
 * This function takes an object and creates a new object by inverting its keys and values. If the input object has duplicate values,
 * the key of the last occurrence will be used as the value for the new key in the output object. It effectively creates a reverse mapping
 * of the input object's key-value pairs.
 *
 * @template K - Type of the keys in the input object (string, number, symbol)
 * @template V - Type of the values in the input object (string, number, symbol)
 * @param {Record<K, V>} obj - The input object whose keys and values are to be inverted
 * @returns {Record<V, K>} - A new object with keys and values inverted
 *
 * @example
 * invert({ a: 1, b: 2, c: 3 }); // { 1: 'a', 2: 'b', 3: 'c' }
 * invert({ 1: 'a', 2: 'b', 3: 'c' }); // { a: '1', b: '2', c: '3' }
 * invert({ a: 1, 2: 'b', c: 3, 4: 'd' }); // { 1: 'a', b: '2', 3: 'c', d: '4' }
 * invert({ a: Symbol('sym1'), b: Symbol('sym2') }); // { [Symbol('sym1')]: 'a', [Symbol('sym2')]: 'b' }
 */ export function invert(obj) {
  const result = {};
  const keys = Object.keys(obj);
  for(let i = 0; i < keys.length; i++){
    const key = keys[i];
    const value = obj[key];
    result[value] = key;
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvaW52ZXJ0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSW52ZXJ0cyB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIGtleXMgb2YgdGhlIGlucHV0IG9iamVjdCBiZWNvbWUgdGhlIHZhbHVlcyBvZiB0aGUgb3V0cHV0IG9iamVjdCBhbmQgdmljZSB2ZXJzYS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIG9iamVjdCBhbmQgY3JlYXRlcyBhIG5ldyBvYmplY3QgYnkgaW52ZXJ0aW5nIGl0cyBrZXlzIGFuZCB2YWx1ZXMuIElmIHRoZSBpbnB1dCBvYmplY3QgaGFzIGR1cGxpY2F0ZSB2YWx1ZXMsXG4gKiB0aGUga2V5IG9mIHRoZSBsYXN0IG9jY3VycmVuY2Ugd2lsbCBiZSB1c2VkIGFzIHRoZSB2YWx1ZSBmb3IgdGhlIG5ldyBrZXkgaW4gdGhlIG91dHB1dCBvYmplY3QuIEl0IGVmZmVjdGl2ZWx5IGNyZWF0ZXMgYSByZXZlcnNlIG1hcHBpbmdcbiAqIG9mIHRoZSBpbnB1dCBvYmplY3QncyBrZXktdmFsdWUgcGFpcnMuXG4gKlxuICogQHRlbXBsYXRlIEsgLSBUeXBlIG9mIHRoZSBrZXlzIGluIHRoZSBpbnB1dCBvYmplY3QgKHN0cmluZywgbnVtYmVyLCBzeW1ib2wpXG4gKiBAdGVtcGxhdGUgViAtIFR5cGUgb2YgdGhlIHZhbHVlcyBpbiB0aGUgaW5wdXQgb2JqZWN0IChzdHJpbmcsIG51bWJlciwgc3ltYm9sKVxuICogQHBhcmFtIHtSZWNvcmQ8SywgVj59IG9iaiAtIFRoZSBpbnB1dCBvYmplY3Qgd2hvc2Uga2V5cyBhbmQgdmFsdWVzIGFyZSB0byBiZSBpbnZlcnRlZFxuICogQHJldHVybnMge1JlY29yZDxWLCBLPn0gLSBBIG5ldyBvYmplY3Qgd2l0aCBrZXlzIGFuZCB2YWx1ZXMgaW52ZXJ0ZWRcbiAqXG4gKiBAZXhhbXBsZVxuICogaW52ZXJ0KHsgYTogMSwgYjogMiwgYzogMyB9KTsgLy8geyAxOiAnYScsIDI6ICdiJywgMzogJ2MnIH1cbiAqIGludmVydCh7IDE6ICdhJywgMjogJ2InLCAzOiAnYycgfSk7IC8vIHsgYTogJzEnLCBiOiAnMicsIGM6ICczJyB9XG4gKiBpbnZlcnQoeyBhOiAxLCAyOiAnYicsIGM6IDMsIDQ6ICdkJyB9KTsgLy8geyAxOiAnYScsIGI6ICcyJywgMzogJ2MnLCBkOiAnNCcgfVxuICogaW52ZXJ0KHsgYTogU3ltYm9sKCdzeW0xJyksIGI6IFN5bWJvbCgnc3ltMicpIH0pOyAvLyB7IFtTeW1ib2woJ3N5bTEnKV06ICdhJywgW1N5bWJvbCgnc3ltMicpXTogJ2InIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGludmVydDxLIGV4dGVuZHMgUHJvcGVydHlLZXksIFYgZXh0ZW5kcyBQcm9wZXJ0eUtleT4ob2JqOiBSZWNvcmQ8SywgVj4pOiBSZWNvcmQ8ViwgSz4ge1xuICBjb25zdCByZXN1bHQgPSB7fSBhcyBSZWNvcmQ8ViwgSz47XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iaikgYXMgS1tdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGtleSA9IGtleXNbaV07XG4gICAgY29uc3QgdmFsdWUgPSBvYmpba2V5XTtcbiAgICByZXN1bHRbdmFsdWVdID0ga2V5O1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpQkMsR0FDRCxPQUFPLFNBQVMsT0FBcUQsR0FBaUI7RUFDcEYsTUFBTSxTQUFTLENBQUM7RUFFaEIsTUFBTSxPQUFPLE9BQU8sSUFBSSxDQUFDO0VBRXpCLElBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxLQUFLLE1BQU0sRUFBRSxJQUFLO0lBQ3BDLE1BQU0sTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNuQixNQUFNLFFBQVEsR0FBRyxDQUFDLElBQUk7SUFDdEIsTUFBTSxDQUFDLE1BQU0sR0FBRztFQUNsQjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=11795522855357521462,9432210815990989701