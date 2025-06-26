import { pull as pullToolkit } from '../../array/pull.ts';
/**
 * Removes all specified values from an array.
 *
 * This function changes `arr` in place.
 * If you want to remove values without modifying the original array, use `difference`.
 *
 * @template T
 * @param {T[]} arr - The array to modify.
 * @param {ArrayLike<T>} valuesToRemove - The values to remove from the array.
 * @returns {T[]} The modified array with the specified values removed.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5, 2, 4];
 * pullAll(numbers, [2, 4]);
 * console.log(numbers); // [1, 3, 5]
 */ export function pullAll(arr, valuesToRemove = []) {
  return pullToolkit(arr, Array.from(valuesToRemove));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvcHVsbEFsbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwdWxsIGFzIHB1bGxUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvcHVsbC50cyc7XG5cbi8qKlxuICogUmVtb3ZlcyBhbGwgc3BlY2lmaWVkIHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2hhbmdlcyBgYXJyYCBpbiBwbGFjZS5cbiAqIElmIHlvdSB3YW50IHRvIHJlbW92ZSB2YWx1ZXMgd2l0aG91dCBtb2RpZnlpbmcgdGhlIG9yaWdpbmFsIGFycmF5LCB1c2UgYGRpZmZlcmVuY2VgLlxuICpcbiAqIEB0ZW1wbGF0ZSBUXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IHRvIG1vZGlmeS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+fSB2YWx1ZXNUb1JlbW92ZSAtIFRoZSB2YWx1ZXMgdG8gcmVtb3ZlIGZyb20gdGhlIGFycmF5LlxuICogQHJldHVybnMge1RbXX0gVGhlIG1vZGlmaWVkIGFycmF5IHdpdGggdGhlIHNwZWNpZmllZCB2YWx1ZXMgcmVtb3ZlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbnVtYmVycyA9IFsxLCAyLCAzLCA0LCA1LCAyLCA0XTtcbiAqIHB1bGxBbGwobnVtYmVycywgWzIsIDRdKTtcbiAqIGNvbnNvbGUubG9nKG51bWJlcnMpOyAvLyBbMSwgMywgNV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHB1bGxBbGw8VD4oYXJyOiBUW10sIHZhbHVlc1RvUmVtb3ZlOiBBcnJheUxpa2U8VD4gPSBbXSk6IFRbXSB7XG4gIHJldHVybiBwdWxsVG9vbGtpdChhcnIsIEFycmF5LmZyb20odmFsdWVzVG9SZW1vdmUpKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsV0FBVyxRQUFRLHNCQUFzQjtBQUUxRDs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsUUFBVyxHQUFRLEVBQUUsaUJBQStCLEVBQUU7RUFDcEUsT0FBTyxZQUFZLEtBQUssTUFBTSxJQUFJLENBQUM7QUFDckMifQ==
// denoCacheMetadata=10796070950148506956,14326964388792744647