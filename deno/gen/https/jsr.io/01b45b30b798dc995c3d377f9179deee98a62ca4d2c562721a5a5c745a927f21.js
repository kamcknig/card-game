import { differenceWith } from './differenceWith.ts';
import { intersectionWith } from './intersectionWith.ts';
import { unionWith } from './unionWith.ts';
/**
 * Computes the symmetric difference between two arrays using a custom equality function.
 * The symmetric difference is the set of elements which are in either of the arrays,
 * but not in their intersection.
 *
 * @template T - Type of elements in the input arrays.
 *
 * @param {T[]} arr1 - The first array.
 * @param {T[]} arr2 - The second array.
 * @param {(item1: T, item2: T) => boolean} areElementsEqual - The custom equality function to compare elements.
 * @returns {T[]} An array containing the elements that are present in either `arr1` or `arr2` but not in both, based on the custom equality function.
 *
 * @example
 * // Custom equality function for objects with an 'id' property
 * const areObjectsEqual = (a, b) => a.id === b.id;
 * xorWith([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], areObjectsEqual);
 * // Returns [{ id: 1 }, { id: 3 }]
 */ export function xorWith(arr1, arr2, areElementsEqual) {
  const union = unionWith(arr1, arr2, areElementsEqual);
  const intersection = intersectionWith(arr1, arr2, areElementsEqual);
  return differenceWith(union, intersection, areElementsEqual);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS94b3JXaXRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRpZmZlcmVuY2VXaXRoIH0gZnJvbSAnLi9kaWZmZXJlbmNlV2l0aC50cyc7XG5pbXBvcnQgeyBpbnRlcnNlY3Rpb25XaXRoIH0gZnJvbSAnLi9pbnRlcnNlY3Rpb25XaXRoLnRzJztcbmltcG9ydCB7IHVuaW9uV2l0aCB9IGZyb20gJy4vdW5pb25XaXRoLnRzJztcblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgc3ltbWV0cmljIGRpZmZlcmVuY2UgYmV0d2VlbiB0d28gYXJyYXlzIHVzaW5nIGEgY3VzdG9tIGVxdWFsaXR5IGZ1bmN0aW9uLlxuICogVGhlIHN5bW1ldHJpYyBkaWZmZXJlbmNlIGlzIHRoZSBzZXQgb2YgZWxlbWVudHMgd2hpY2ggYXJlIGluIGVpdGhlciBvZiB0aGUgYXJyYXlzLFxuICogYnV0IG5vdCBpbiB0aGVpciBpbnRlcnNlY3Rpb24uXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUeXBlIG9mIGVsZW1lbnRzIGluIHRoZSBpbnB1dCBhcnJheXMuXG4gKlxuICogQHBhcmFtIHtUW119IGFycjEgLSBUaGUgZmlyc3QgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyMiAtIFRoZSBzZWNvbmQgYXJyYXkuXG4gKiBAcGFyYW0geyhpdGVtMTogVCwgaXRlbTI6IFQpID0+IGJvb2xlYW59IGFyZUVsZW1lbnRzRXF1YWwgLSBUaGUgY3VzdG9tIGVxdWFsaXR5IGZ1bmN0aW9uIHRvIGNvbXBhcmUgZWxlbWVudHMuXG4gKiBAcmV0dXJucyB7VFtdfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBlbGVtZW50cyB0aGF0IGFyZSBwcmVzZW50IGluIGVpdGhlciBgYXJyMWAgb3IgYGFycjJgIGJ1dCBub3QgaW4gYm90aCwgYmFzZWQgb24gdGhlIGN1c3RvbSBlcXVhbGl0eSBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ3VzdG9tIGVxdWFsaXR5IGZ1bmN0aW9uIGZvciBvYmplY3RzIHdpdGggYW4gJ2lkJyBwcm9wZXJ0eVxuICogY29uc3QgYXJlT2JqZWN0c0VxdWFsID0gKGEsIGIpID0+IGEuaWQgPT09IGIuaWQ7XG4gKiB4b3JXaXRoKFt7IGlkOiAxIH0sIHsgaWQ6IDIgfV0sIFt7IGlkOiAyIH0sIHsgaWQ6IDMgfV0sIGFyZU9iamVjdHNFcXVhbCk7XG4gKiAvLyBSZXR1cm5zIFt7IGlkOiAxIH0sIHsgaWQ6IDMgfV1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHhvcldpdGg8VD4oXG4gIGFycjE6IHJlYWRvbmx5IFRbXSxcbiAgYXJyMjogcmVhZG9ubHkgVFtdLFxuICBhcmVFbGVtZW50c0VxdWFsOiAoaXRlbTE6IFQsIGl0ZW0yOiBUKSA9PiBib29sZWFuXG4pOiBUW10ge1xuICBjb25zdCB1bmlvbiA9IHVuaW9uV2l0aChhcnIxLCBhcnIyLCBhcmVFbGVtZW50c0VxdWFsKTtcbiAgY29uc3QgaW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0aW9uV2l0aChhcnIxLCBhcnIyLCBhcmVFbGVtZW50c0VxdWFsKTtcblxuICByZXR1cm4gZGlmZmVyZW5jZVdpdGgodW5pb24sIGludGVyc2VjdGlvbiwgYXJlRWxlbWVudHNFcXVhbCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxjQUFjLFFBQVEsc0JBQXNCO0FBQ3JELFNBQVMsZ0JBQWdCLFFBQVEsd0JBQXdCO0FBQ3pELFNBQVMsU0FBUyxRQUFRLGlCQUFpQjtBQUUzQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FpQkMsR0FDRCxPQUFPLFNBQVMsUUFDZCxJQUFrQixFQUNsQixJQUFrQixFQUNsQixnQkFBaUQ7RUFFakQsTUFBTSxRQUFRLFVBQVUsTUFBTSxNQUFNO0VBQ3BDLE1BQU0sZUFBZSxpQkFBaUIsTUFBTSxNQUFNO0VBRWxELE9BQU8sZUFBZSxPQUFPLGNBQWM7QUFDN0MifQ==
// denoCacheMetadata=16188662160812921245,3579613583998041398