import { zip } from '../../array/zip.ts';
import { set } from '../object/set.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
/**
 * Creates a deeply nested object given arrays of paths and values.
 *
 * This function takes two arrays: one containing arrays of property paths, and the other containing corresponding values.
 * It returns a new object where paths from the first array are used as key paths to set values, with corresponding elements from the second array as values.
 * Paths can be dot-separated strings or arrays of property names.
 *
 * If the `keys` array is longer than the `values` array, the remaining keys will have `undefined` as their values.
 *
 * @template P - The type of property paths.
 * @template V - The type of values corresponding to the property paths.
 * @param {ArrayLike<P | P[]>} keys - An array of property paths, each path can be a dot-separated string or an array of property names.
 * @param {ArrayLike<V>} values - An array of values corresponding to the property paths.
 * @returns {Record<P, V>} A new object composed of the given property paths and values.
 *
 * @example
 * const paths = ['a.b.c', 'd.e.f'];
 * const values = [1, 2];
 * const result = zipObjectDeep(paths, values);
 * // result will be { a: { b: { c: 1 } }, d: { e: { f: 2 } } }
 *
 * @example
 * const paths = [['a', 'b', 'c'], ['d', 'e', 'f']];
 * const values = [1, 2];
 * const result = zipObjectDeep(paths, values);
 * // result will be { a: { b: { c: 1 } }, d: { e: { f: 2 } } }
 *
 * @example
 * const paths = ['a.b[0].c', 'a.b[1].d'];
 * const values = [1, 2];
 * const result = zipObjectDeep(paths, values);
 * // result will be { 'a': { 'b': [{ 'c': 1 }, { 'd': 2 }] } }
 */ export function zipObjectDeep(keys, values) {
  const result = {};
  if (!isArrayLike(keys)) {
    return result;
  }
  if (!isArrayLike(values)) {
    values = [];
  }
  const zipped = zip(Array.from(keys), Array.from(values));
  for(let i = 0; i < zipped.length; i++){
    const [key, value] = zipped[i];
    if (key != null) {
      set(result, key, value);
    }
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvemlwT2JqZWN0RGVlcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB6aXAgfSBmcm9tICcuLi8uLi9hcnJheS96aXAudHMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi4vb2JqZWN0L3NldC50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGRlZXBseSBuZXN0ZWQgb2JqZWN0IGdpdmVuIGFycmF5cyBvZiBwYXRocyBhbmQgdmFsdWVzLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgdHdvIGFycmF5czogb25lIGNvbnRhaW5pbmcgYXJyYXlzIG9mIHByb3BlcnR5IHBhdGhzLCBhbmQgdGhlIG90aGVyIGNvbnRhaW5pbmcgY29ycmVzcG9uZGluZyB2YWx1ZXMuXG4gKiBJdCByZXR1cm5zIGEgbmV3IG9iamVjdCB3aGVyZSBwYXRocyBmcm9tIHRoZSBmaXJzdCBhcnJheSBhcmUgdXNlZCBhcyBrZXkgcGF0aHMgdG8gc2V0IHZhbHVlcywgd2l0aCBjb3JyZXNwb25kaW5nIGVsZW1lbnRzIGZyb20gdGhlIHNlY29uZCBhcnJheSBhcyB2YWx1ZXMuXG4gKiBQYXRocyBjYW4gYmUgZG90LXNlcGFyYXRlZCBzdHJpbmdzIG9yIGFycmF5cyBvZiBwcm9wZXJ0eSBuYW1lcy5cbiAqXG4gKiBJZiB0aGUgYGtleXNgIGFycmF5IGlzIGxvbmdlciB0aGFuIHRoZSBgdmFsdWVzYCBhcnJheSwgdGhlIHJlbWFpbmluZyBrZXlzIHdpbGwgaGF2ZSBgdW5kZWZpbmVkYCBhcyB0aGVpciB2YWx1ZXMuXG4gKlxuICogQHRlbXBsYXRlIFAgLSBUaGUgdHlwZSBvZiBwcm9wZXJ0eSBwYXRocy5cbiAqIEB0ZW1wbGF0ZSBWIC0gVGhlIHR5cGUgb2YgdmFsdWVzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHByb3BlcnR5IHBhdGhzLlxuICogQHBhcmFtIHtBcnJheUxpa2U8UCB8IFBbXT59IGtleXMgLSBBbiBhcnJheSBvZiBwcm9wZXJ0eSBwYXRocywgZWFjaCBwYXRoIGNhbiBiZSBhIGRvdC1zZXBhcmF0ZWQgc3RyaW5nIG9yIGFuIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxuICogQHBhcmFtIHtBcnJheUxpa2U8Vj59IHZhbHVlcyAtIEFuIGFycmF5IG9mIHZhbHVlcyBjb3JyZXNwb25kaW5nIHRvIHRoZSBwcm9wZXJ0eSBwYXRocy5cbiAqIEByZXR1cm5zIHtSZWNvcmQ8UCwgVj59IEEgbmV3IG9iamVjdCBjb21wb3NlZCBvZiB0aGUgZ2l2ZW4gcHJvcGVydHkgcGF0aHMgYW5kIHZhbHVlcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcGF0aHMgPSBbJ2EuYi5jJywgJ2QuZS5mJ107XG4gKiBjb25zdCB2YWx1ZXMgPSBbMSwgMl07XG4gKiBjb25zdCByZXN1bHQgPSB6aXBPYmplY3REZWVwKHBhdGhzLCB2YWx1ZXMpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyBhOiB7IGI6IHsgYzogMSB9IH0sIGQ6IHsgZTogeyBmOiAyIH0gfSB9XG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHBhdGhzID0gW1snYScsICdiJywgJ2MnXSwgWydkJywgJ2UnLCAnZiddXTtcbiAqIGNvbnN0IHZhbHVlcyA9IFsxLCAyXTtcbiAqIGNvbnN0IHJlc3VsdCA9IHppcE9iamVjdERlZXAocGF0aHMsIHZhbHVlcyk7XG4gKiAvLyByZXN1bHQgd2lsbCBiZSB7IGE6IHsgYjogeyBjOiAxIH0gfSwgZDogeyBlOiB7IGY6IDIgfSB9IH1cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcGF0aHMgPSBbJ2EuYlswXS5jJywgJ2EuYlsxXS5kJ107XG4gKiBjb25zdCB2YWx1ZXMgPSBbMSwgMl07XG4gKiBjb25zdCByZXN1bHQgPSB6aXBPYmplY3REZWVwKHBhdGhzLCB2YWx1ZXMpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgeyAnYSc6IHsgJ2InOiBbeyAnYyc6IDEgfSwgeyAnZCc6IDIgfV0gfSB9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB6aXBPYmplY3REZWVwPFAgZXh0ZW5kcyBQcm9wZXJ0eUtleSwgVj4oa2V5czogQXJyYXlMaWtlPFAgfCBQW10+LCB2YWx1ZXM6IEFycmF5TGlrZTxWPik6IFJlY29yZDxQLCBWPiB7XG4gIGNvbnN0IHJlc3VsdCA9IHt9IGFzIHsgW0sgaW4gUF06IFYgfTtcbiAgaWYgKCFpc0FycmF5TGlrZShrZXlzKSkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaWYgKCFpc0FycmF5TGlrZSh2YWx1ZXMpKSB7XG4gICAgdmFsdWVzID0gW107XG4gIH1cbiAgY29uc3QgemlwcGVkID0gemlwPFAgfCBQW10sIFY+KEFycmF5LmZyb20oa2V5cyksIEFycmF5LmZyb20odmFsdWVzKSk7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB6aXBwZWQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBba2V5LCB2YWx1ZV0gPSB6aXBwZWRbaV07XG5cbiAgICBpZiAoa2V5ICE9IG51bGwpIHtcbiAgICAgIHNldChyZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxHQUFHLFFBQVEscUJBQXFCO0FBQ3pDLFNBQVMsR0FBRyxRQUFRLG1CQUFtQjtBQUN2QyxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBZ0NDLEdBQ0QsT0FBTyxTQUFTLGNBQXdDLElBQXdCLEVBQUUsTUFBb0I7RUFDcEcsTUFBTSxTQUFTLENBQUM7RUFDaEIsSUFBSSxDQUFDLFlBQVksT0FBTztJQUN0QixPQUFPO0VBQ1Q7RUFDQSxJQUFJLENBQUMsWUFBWSxTQUFTO0lBQ3hCLFNBQVMsRUFBRTtFQUNiO0VBQ0EsTUFBTSxTQUFTLElBQWdCLE1BQU0sSUFBSSxDQUFDLE9BQU8sTUFBTSxJQUFJLENBQUM7RUFFNUQsSUFBSyxJQUFJLElBQUksR0FBRyxJQUFJLE9BQU8sTUFBTSxFQUFFLElBQUs7SUFDdEMsTUFBTSxDQUFDLEtBQUssTUFBTSxHQUFHLE1BQU0sQ0FBQyxFQUFFO0lBRTlCLElBQUksT0FBTyxNQUFNO01BQ2YsSUFBSSxRQUFRLEtBQUs7SUFDbkI7RUFDRjtFQUVBLE9BQU87QUFDVCJ9
// denoCacheMetadata=13064724032992806723,6493706992458488166