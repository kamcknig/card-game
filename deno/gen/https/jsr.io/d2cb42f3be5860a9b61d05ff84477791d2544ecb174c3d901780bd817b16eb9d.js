import { difference } from './difference.ts';
import { intersection } from './intersection.ts';
import { union } from './union.ts';
/**
 * Computes the symmetric difference between two arrays. The symmetric difference is the set of elements
 * which are in either of the arrays, but not in their intersection.
 *
 * @template T - The type of elements in the array.
 * @param {T[]} arr1 - The first array.
 * @param {T[]} arr2 - The second array.
 * @returns {T[]} An array containing the elements that are present in either `arr1` or `arr2` but not in both.
 *
 * @example
 * // Returns [1, 2, 5, 6]
 * xor([1, 2, 3, 4], [3, 4, 5, 6]);
 *
 * @example
 * // Returns ['a', 'c']
 * xor(['a', 'b'], ['b', 'c']);
 */ export function xor(arr1, arr2) {
  return difference(union(arr1, arr2), intersection(arr1, arr2));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS94b3IudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGlmZmVyZW5jZSB9IGZyb20gJy4vZGlmZmVyZW5jZS50cyc7XG5pbXBvcnQgeyBpbnRlcnNlY3Rpb24gfSBmcm9tICcuL2ludGVyc2VjdGlvbi50cyc7XG5pbXBvcnQgeyB1bmlvbiB9IGZyb20gJy4vdW5pb24udHMnO1xuXG4vKipcbiAqIENvbXB1dGVzIHRoZSBzeW1tZXRyaWMgZGlmZmVyZW5jZSBiZXR3ZWVuIHR3byBhcnJheXMuIFRoZSBzeW1tZXRyaWMgZGlmZmVyZW5jZSBpcyB0aGUgc2V0IG9mIGVsZW1lbnRzXG4gKiB3aGljaCBhcmUgaW4gZWl0aGVyIG9mIHRoZSBhcnJheXMsIGJ1dCBub3QgaW4gdGhlaXIgaW50ZXJzZWN0aW9uLlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgZWxlbWVudHMgaW4gdGhlIGFycmF5LlxuICogQHBhcmFtIHtUW119IGFycjEgLSBUaGUgZmlyc3QgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyMiAtIFRoZSBzZWNvbmQgYXJyYXkuXG4gKiBAcmV0dXJucyB7VFtdfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyB0aGF0IGFyZSBwcmVzZW50IGluIGVpdGhlciBgYXJyMWAgb3IgYGFycjJgIGJ1dCBub3QgaW4gYm90aC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gUmV0dXJucyBbMSwgMiwgNSwgNl1cbiAqIHhvcihbMSwgMiwgMywgNF0sIFszLCA0LCA1LCA2XSk7XG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFJldHVybnMgWydhJywgJ2MnXVxuICogeG9yKFsnYScsICdiJ10sIFsnYicsICdjJ10pO1xuICovXG5leHBvcnQgZnVuY3Rpb24geG9yPFQ+KGFycjE6IHJlYWRvbmx5IFRbXSwgYXJyMjogcmVhZG9ubHkgVFtdKTogVFtdIHtcbiAgcmV0dXJuIGRpZmZlcmVuY2UodW5pb24oYXJyMSwgYXJyMiksIGludGVyc2VjdGlvbihhcnIxLCBhcnIyKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxVQUFVLFFBQVEsa0JBQWtCO0FBQzdDLFNBQVMsWUFBWSxRQUFRLG9CQUFvQjtBQUNqRCxTQUFTLEtBQUssUUFBUSxhQUFhO0FBRW5DOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLElBQU8sSUFBa0IsRUFBRSxJQUFrQjtFQUMzRCxPQUFPLFdBQVcsTUFBTSxNQUFNLE9BQU8sYUFBYSxNQUFNO0FBQzFEIn0=
// denoCacheMetadata=17373846151847987795,17342799096949806229