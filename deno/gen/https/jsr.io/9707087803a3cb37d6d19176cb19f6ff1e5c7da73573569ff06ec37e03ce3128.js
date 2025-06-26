import { pull as pullToolkit } from '../../array/pull.ts';
/**
 * Removes all specified values from an array.
 *
 * This function changes `arr` in place.
 * If you want to remove values without modifying the original array, use `difference`.
 *
 * @template T, U
 * @param {T[]} arr - The array to modify.
 * @param {...unknown[]} valuesToRemove - The values to remove from the array.
 * @returns {T[]} The modified array with the specified values removed.
 *
 * @example
 * const numbers = [1, 2, 3, 4, 5, 2, 4];
 * pull(numbers, [2, 4]);
 * console.log(numbers); // [1, 3, 5]
 */ export function pull(arr, ...valuesToRemove) {
  return pullToolkit(arr, valuesToRemove);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvcHVsbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAnLi9mbGF0dGVuLnRzJztcbmltcG9ydCB7IHB1bGwgYXMgcHVsbFRvb2xraXQgfSBmcm9tICcuLi8uLi9hcnJheS9wdWxsLnRzJztcblxuLyoqXG4gKiBSZW1vdmVzIGFsbCBzcGVjaWZpZWQgdmFsdWVzIGZyb20gYW4gYXJyYXkuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjaGFuZ2VzIGBhcnJgIGluIHBsYWNlLlxuICogSWYgeW91IHdhbnQgdG8gcmVtb3ZlIHZhbHVlcyB3aXRob3V0IG1vZGlmeWluZyB0aGUgb3JpZ2luYWwgYXJyYXksIHVzZSBgZGlmZmVyZW5jZWAuXG4gKlxuICogQHRlbXBsYXRlIFQsIFVcbiAqIEBwYXJhbSB7VFtdfSBhcnIgLSBUaGUgYXJyYXkgdG8gbW9kaWZ5LlxuICogQHBhcmFtIHsuLi51bmtub3duW119IHZhbHVlc1RvUmVtb3ZlIC0gVGhlIHZhbHVlcyB0byByZW1vdmUgZnJvbSB0aGUgYXJyYXkuXG4gKiBAcmV0dXJucyB7VFtdfSBUaGUgbW9kaWZpZWQgYXJyYXkgd2l0aCB0aGUgc3BlY2lmaWVkIHZhbHVlcyByZW1vdmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBudW1iZXJzID0gWzEsIDIsIDMsIDQsIDUsIDIsIDRdO1xuICogcHVsbChudW1iZXJzLCBbMiwgNF0pO1xuICogY29uc29sZS5sb2cobnVtYmVycyk7IC8vIFsxLCAzLCA1XVxuICovXG5leHBvcnQgZnVuY3Rpb24gcHVsbDxUPihhcnI6IFRbXSwgLi4udmFsdWVzVG9SZW1vdmU6IHJlYWRvbmx5IHVua25vd25bXSk6IFRbXSB7XG4gIHJldHVybiBwdWxsVG9vbGtpdChhcnIsIHZhbHVlc1RvUmVtb3ZlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxTQUFTLFFBQVEsV0FBVyxRQUFRLHNCQUFzQjtBQUUxRDs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsS0FBUSxHQUFRLEVBQUUsR0FBRyxjQUFrQztFQUNyRSxPQUFPLFlBQVksS0FBSztBQUMxQiJ9
// denoCacheMetadata=1755350841968657328,18164098128621947278