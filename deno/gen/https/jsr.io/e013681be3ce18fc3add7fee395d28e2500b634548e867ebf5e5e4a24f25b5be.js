import { flattenDeep } from './flattenDeep.ts';
/**
 * Recursively maps each element in an array using a provided iteratee function and then deeply flattens the resulting array.
 *
 * @template T - The type of elements within the array.
 * @template U - The type of elements within the returned array from the iteratee function.
 * @param {T[]} arr - The array to flatten.
 * @param {(item: T) => U} iteratee - The function that produces the new array elements.
 * @returns {Array<ExtractNestedArrayType<U>>} A new array that has been flattened.
 *
 * @example
 * const result = flatMapDeep([1, 2, 3], n => [[n, n]]);
 * // [1, 1, 2, 2, 3, 3]
 */ export function flatMapDeep(arr, iteratee) {
  return flattenDeep(arr.map((item)=>iteratee(item)));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9mbGF0TWFwRGVlcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFeHRyYWN0TmVzdGVkQXJyYXlUeXBlLCBmbGF0dGVuRGVlcCB9IGZyb20gJy4vZmxhdHRlbkRlZXAudHMnO1xuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IG1hcHMgZWFjaCBlbGVtZW50IGluIGFuIGFycmF5IHVzaW5nIGEgcHJvdmlkZWQgaXRlcmF0ZWUgZnVuY3Rpb24gYW5kIHRoZW4gZGVlcGx5IGZsYXR0ZW5zIHRoZSByZXN1bHRpbmcgYXJyYXkuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyB3aXRoaW4gdGhlIGFycmF5LlxuICogQHRlbXBsYXRlIFUgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyB3aXRoaW4gdGhlIHJldHVybmVkIGFycmF5IGZyb20gdGhlIGl0ZXJhdGVlIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtUW119IGFyciAtIFRoZSBhcnJheSB0byBmbGF0dGVuLlxuICogQHBhcmFtIHsoaXRlbTogVCkgPT4gVX0gaXRlcmF0ZWUgLSBUaGUgZnVuY3Rpb24gdGhhdCBwcm9kdWNlcyB0aGUgbmV3IGFycmF5IGVsZW1lbnRzLlxuICogQHJldHVybnMge0FycmF5PEV4dHJhY3ROZXN0ZWRBcnJheVR5cGU8VT4+fSBBIG5ldyBhcnJheSB0aGF0IGhhcyBiZWVuIGZsYXR0ZW5lZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcmVzdWx0ID0gZmxhdE1hcERlZXAoWzEsIDIsIDNdLCBuID0+IFtbbiwgbl1dKTtcbiAqIC8vIFsxLCAxLCAyLCAyLCAzLCAzXVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmxhdE1hcERlZXA8VCwgVT4oYXJyOiByZWFkb25seSBUW10sIGl0ZXJhdGVlOiAoaXRlbTogVCkgPT4gVSk6IEFycmF5PEV4dHJhY3ROZXN0ZWRBcnJheVR5cGU8VT4+IHtcbiAgcmV0dXJuIGZsYXR0ZW5EZWVwKGFyci5tYXAoKGl0ZW06IFQpID0+IGl0ZXJhdGVlKGl0ZW0pKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBaUMsV0FBVyxRQUFRLG1CQUFtQjtBQUV2RTs7Ozs7Ozs7Ozs7O0NBWUMsR0FDRCxPQUFPLFNBQVMsWUFBa0IsR0FBaUIsRUFBRSxRQUF3QjtFQUMzRSxPQUFPLFlBQVksSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFZLFNBQVM7QUFDbkQifQ==
// denoCacheMetadata=13228351244770130169,13578508875073429065