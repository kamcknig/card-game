import { differenceBy } from './differenceBy.ts';
import { intersectionBy } from './intersectionBy.ts';
import { unionBy } from './unionBy.ts';
/**
 * Computes the symmetric difference between two arrays using a custom mapping function.
 * The symmetric difference is the set of elements which are in either of the arrays,
 * but not in their intersection, determined by the result of the mapping function.
 *
 * @template T - Type of elements in the input arrays.
 * @template U - Type of the values returned by the mapping function.
 *
 * @param {T[]} arr1 - The first array.
 * @param {T[]} arr2 - The second array.
 * @param {(item: T) => U} mapper - The function to map array elements to comparison values.
 * @returns {T[]} An array containing the elements that are present in either `arr1` or `arr2` but not in both, based on the values returned by the mapping function.
 *
 * @example
 * // Custom mapping function for objects with an 'id' property
 * const idMapper = obj => obj.id;
 * xorBy([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], idMapper);
 * // Returns [{ id: 1 }, { id: 3 }]
 */ export function xorBy(arr1, arr2, mapper) {
  const union = unionBy(arr1, arr2, mapper);
  const intersection = intersectionBy(arr1, arr2, mapper);
  return differenceBy(union, intersection, mapper);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS94b3JCeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkaWZmZXJlbmNlQnkgfSBmcm9tICcuL2RpZmZlcmVuY2VCeS50cyc7XG5pbXBvcnQgeyBpbnRlcnNlY3Rpb25CeSB9IGZyb20gJy4vaW50ZXJzZWN0aW9uQnkudHMnO1xuaW1wb3J0IHsgdW5pb25CeSB9IGZyb20gJy4vdW5pb25CeS50cyc7XG5cbi8qKlxuICogQ29tcHV0ZXMgdGhlIHN5bW1ldHJpYyBkaWZmZXJlbmNlIGJldHdlZW4gdHdvIGFycmF5cyB1c2luZyBhIGN1c3RvbSBtYXBwaW5nIGZ1bmN0aW9uLlxuICogVGhlIHN5bW1ldHJpYyBkaWZmZXJlbmNlIGlzIHRoZSBzZXQgb2YgZWxlbWVudHMgd2hpY2ggYXJlIGluIGVpdGhlciBvZiB0aGUgYXJyYXlzLFxuICogYnV0IG5vdCBpbiB0aGVpciBpbnRlcnNlY3Rpb24sIGRldGVybWluZWQgYnkgdGhlIHJlc3VsdCBvZiB0aGUgbWFwcGluZyBmdW5jdGlvbi5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGlucHV0IGFycmF5cy5cbiAqIEB0ZW1wbGF0ZSBVIC0gVHlwZSBvZiB0aGUgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBtYXBwaW5nIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7VFtdfSBhcnIxIC0gVGhlIGZpcnN0IGFycmF5LlxuICogQHBhcmFtIHtUW119IGFycjIgLSBUaGUgc2Vjb25kIGFycmF5LlxuICogQHBhcmFtIHsoaXRlbTogVCkgPT4gVX0gbWFwcGVyIC0gVGhlIGZ1bmN0aW9uIHRvIG1hcCBhcnJheSBlbGVtZW50cyB0byBjb21wYXJpc29uIHZhbHVlcy5cbiAqIEByZXR1cm5zIHtUW119IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnRzIHRoYXQgYXJlIHByZXNlbnQgaW4gZWl0aGVyIGBhcnIxYCBvciBgYXJyMmAgYnV0IG5vdCBpbiBib3RoLCBiYXNlZCBvbiB0aGUgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBtYXBwaW5nIGZ1bmN0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDdXN0b20gbWFwcGluZyBmdW5jdGlvbiBmb3Igb2JqZWN0cyB3aXRoIGFuICdpZCcgcHJvcGVydHlcbiAqIGNvbnN0IGlkTWFwcGVyID0gb2JqID0+IG9iai5pZDtcbiAqIHhvckJ5KFt7IGlkOiAxIH0sIHsgaWQ6IDIgfV0sIFt7IGlkOiAyIH0sIHsgaWQ6IDMgfV0sIGlkTWFwcGVyKTtcbiAqIC8vIFJldHVybnMgW3sgaWQ6IDEgfSwgeyBpZDogMyB9XVxuICovXG5leHBvcnQgZnVuY3Rpb24geG9yQnk8VCwgVT4oYXJyMTogcmVhZG9ubHkgVFtdLCBhcnIyOiByZWFkb25seSBUW10sIG1hcHBlcjogKGl0ZW06IFQpID0+IFUpOiBUW10ge1xuICBjb25zdCB1bmlvbiA9IHVuaW9uQnkoYXJyMSwgYXJyMiwgbWFwcGVyKTtcbiAgY29uc3QgaW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0aW9uQnkoYXJyMSwgYXJyMiwgbWFwcGVyKTtcblxuICByZXR1cm4gZGlmZmVyZW5jZUJ5KHVuaW9uLCBpbnRlcnNlY3Rpb24sIG1hcHBlcik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxZQUFZLFFBQVEsb0JBQW9CO0FBQ2pELFNBQVMsY0FBYyxRQUFRLHNCQUFzQjtBQUNyRCxTQUFTLE9BQU8sUUFBUSxlQUFlO0FBRXZDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrQkMsR0FDRCxPQUFPLFNBQVMsTUFBWSxJQUFrQixFQUFFLElBQWtCLEVBQUUsTUFBc0I7RUFDeEYsTUFBTSxRQUFRLFFBQVEsTUFBTSxNQUFNO0VBQ2xDLE1BQU0sZUFBZSxlQUFlLE1BQU0sTUFBTTtFQUVoRCxPQUFPLGFBQWEsT0FBTyxjQUFjO0FBQzNDIn0=
// denoCacheMetadata=11569517426387419517,16826406153388758015