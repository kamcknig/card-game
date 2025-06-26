import { flatten } from './flatten.ts';
/**
 * Flattens an array up to the specified depth.
 *
 * @template T - The type of elements within the array.
 * @template D - The depth to which the array should be flattened.
 * @param {ArrayLike<T> | null | undefined} value - The value to flatten.
 * @param {D} depth - The depth level specifying how deep a nested array structure should be flattened. Defaults to 1.
 * @returns {Array<FlatArray<T[], D>> | []} A new array that has been flattened.
 *
 * @example
 * const arr = flatten([1, [2, 3], [4, [5, 6]]], 1);
 * // Returns: [1, 2, 3, 4, [5, 6]]
 *
 * const arr = flatten([1, [2, 3], [4, [5, 6]]], 2);
 * // Returns: [1, 2, 3, 4, 5, 6]
 */ export function flattenDepth(value, depth = 1) {
  return flatten(value, depth);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvZmxhdHRlbkRlcHRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZsYXR0ZW4gfSBmcm9tICcuL2ZsYXR0ZW4udHMnO1xuXG4vKipcbiAqIEZsYXR0ZW5zIGFuIGFycmF5IHVwIHRvIHRoZSBzcGVjaWZpZWQgZGVwdGguXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyB3aXRoaW4gdGhlIGFycmF5LlxuICogQHRlbXBsYXRlIEQgLSBUaGUgZGVwdGggdG8gd2hpY2ggdGhlIGFycmF5IHNob3VsZCBiZSBmbGF0dGVuZWQuXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWR9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIGZsYXR0ZW4uXG4gKiBAcGFyYW0ge0R9IGRlcHRoIC0gVGhlIGRlcHRoIGxldmVsIHNwZWNpZnlpbmcgaG93IGRlZXAgYSBuZXN0ZWQgYXJyYXkgc3RydWN0dXJlIHNob3VsZCBiZSBmbGF0dGVuZWQuIERlZmF1bHRzIHRvIDEuXG4gKiBAcmV0dXJucyB7QXJyYXk8RmxhdEFycmF5PFRbXSwgRD4+IHwgW119IEEgbmV3IGFycmF5IHRoYXQgaGFzIGJlZW4gZmxhdHRlbmVkLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnIgPSBmbGF0dGVuKFsxLCBbMiwgM10sIFs0LCBbNSwgNl1dXSwgMSk7XG4gKiAvLyBSZXR1cm5zOiBbMSwgMiwgMywgNCwgWzUsIDZdXVxuICpcbiAqIGNvbnN0IGFyciA9IGZsYXR0ZW4oWzEsIFsyLCAzXSwgWzQsIFs1LCA2XV1dLCAyKTtcbiAqIC8vIFJldHVybnM6IFsxLCAyLCAzLCA0LCA1LCA2XVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbkRlcHRoPFQsIEQgZXh0ZW5kcyBudW1iZXIgPSAxPihcbiAgdmFsdWU6IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsXG4gIGRlcHRoID0gMSBhcyBEXG4pOiBBcnJheTxGbGF0QXJyYXk8VFtdLCBEPj4gfCBbXSB7XG4gIHJldHVybiBmbGF0dGVuKHZhbHVlLCBkZXB0aCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxPQUFPLFFBQVEsZUFBZTtBQUV2Qzs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsYUFDZCxLQUFzQyxFQUN0QyxRQUFRLENBQU07RUFFZCxPQUFPLFFBQVEsT0FBTztBQUN4QiJ9
// denoCacheMetadata=5082555942316082152,9989951899107496554