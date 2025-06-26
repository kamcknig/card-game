import { dropRight as dropRightToolkit } from '../../array/dropRight.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { toInteger } from '../util/toInteger.ts';
/**
 * Removes a specified number of elements from the end of an array and returns the rest.
 *
 * This function takes an array and a number, and returns a new array with the specified number
 * of elements removed from the end.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} collection - The array from which to drop elements.
 * @param {number} itemsCount - The number of elements to drop from the end of the array.
 * @param {unknown} [guard] - Enables use as an iteratee for methods like `_.map`.
 * @returns {T[]} A new array with the specified number of elements removed from the end.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = dropRight(array, 2);
 * // result will be [1, 2, 3] since the last two elements are dropped.
 */ export function dropRight(collection, itemsCount = 1, guard) {
  if (!isArrayLike(collection)) {
    return [];
  }
  itemsCount = guard ? 1 : toInteger(itemsCount);
  return dropRightToolkit(toArray(collection), itemsCount);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvZHJvcFJpZ2h0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGRyb3BSaWdodCBhcyBkcm9wUmlnaHRUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvZHJvcFJpZ2h0LnRzJztcbmltcG9ydCB7IHRvQXJyYXkgfSBmcm9tICcuLi9faW50ZXJuYWwvdG9BcnJheS50cyc7XG5pbXBvcnQgeyBpc0FycmF5TGlrZSB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc0FycmF5TGlrZS50cyc7XG5pbXBvcnQgeyB0b0ludGVnZXIgfSBmcm9tICcuLi91dGlsL3RvSW50ZWdlci50cyc7XG5cbi8qKlxuICogUmVtb3ZlcyBhIHNwZWNpZmllZCBudW1iZXIgb2YgZWxlbWVudHMgZnJvbSB0aGUgZW5kIG9mIGFuIGFycmF5IGFuZCByZXR1cm5zIHRoZSByZXN0LlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYW4gYXJyYXkgYW5kIGEgbnVtYmVyLCBhbmQgcmV0dXJucyBhIG5ldyBhcnJheSB3aXRoIHRoZSBzcGVjaWZpZWQgbnVtYmVyXG4gKiBvZiBlbGVtZW50cyByZW1vdmVkIGZyb20gdGhlIGVuZC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZH0gY29sbGVjdGlvbiAtIFRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIGRyb3AgZWxlbWVudHMuXG4gKiBAcGFyYW0ge251bWJlcn0gaXRlbXNDb3VudCAtIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZHJvcCBmcm9tIHRoZSBlbmQgb2YgdGhlIGFycmF5LlxuICogQHBhcmFtIHt1bmtub3dufSBbZ3VhcmRdIC0gRW5hYmxlcyB1c2UgYXMgYW4gaXRlcmF0ZWUgZm9yIG1ldGhvZHMgbGlrZSBgXy5tYXBgLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgd2l0aCB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBlbGVtZW50cyByZW1vdmVkIGZyb20gdGhlIGVuZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07XG4gKiBjb25zdCByZXN1bHQgPSBkcm9wUmlnaHQoYXJyYXksIDIpO1xuICogLy8gcmVzdWx0IHdpbGwgYmUgWzEsIDIsIDNdIHNpbmNlIHRoZSBsYXN0IHR3byBlbGVtZW50cyBhcmUgZHJvcHBlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRyb3BSaWdodDxUPihjb2xsZWN0aW9uOiBBcnJheUxpa2U8VD4gfCBudWxsIHwgdW5kZWZpbmVkLCBpdGVtc0NvdW50ID0gMSwgZ3VhcmQ/OiB1bmtub3duKTogVFtdIHtcbiAgaWYgKCFpc0FycmF5TGlrZShjb2xsZWN0aW9uKSkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBpdGVtc0NvdW50ID0gZ3VhcmQgPyAxIDogdG9JbnRlZ2VyKGl0ZW1zQ291bnQpO1xuXG4gIHJldHVybiBkcm9wUmlnaHRUb29sa2l0KHRvQXJyYXkoY29sbGVjdGlvbiksIGl0ZW1zQ291bnQpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxnQkFBZ0IsUUFBUSwyQkFBMkI7QUFDekUsU0FBUyxPQUFPLFFBQVEsMEJBQTBCO0FBQ2xELFNBQVMsV0FBVyxRQUFRLDhCQUE4QjtBQUMxRCxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFFakQ7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsVUFBYSxVQUEyQyxFQUFFLGFBQWEsQ0FBQyxFQUFFLEtBQWU7RUFDdkcsSUFBSSxDQUFDLFlBQVksYUFBYTtJQUM1QixPQUFPLEVBQUU7RUFDWDtFQUNBLGFBQWEsUUFBUSxJQUFJLFVBQVU7RUFFbkMsT0FBTyxpQkFBaUIsUUFBUSxhQUFhO0FBQy9DIn0=
// denoCacheMetadata=13573871357817375899,7462100276512494063