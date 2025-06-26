import { drop as dropToolkit } from '../../array/drop.ts';
import { toArray } from '../_internal/toArray.ts';
import { isArrayLike } from '../predicate/isArrayLike.ts';
import { toInteger } from '../util/toInteger.ts';
/**
 * Removes a specified number of elements from the beginning of an array and returns the rest.
 *
 * This function takes an array and a number, and returns a new array with the specified number
 * of elements removed from the start.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | null | undefined} collection - The array from which to drop elements.
 * @param {number} itemsCount - The number of elements to drop from the beginning of the array.
 * @param {unknown} [guard] - Enables use as an iteratee for methods like `_.map`.
 * @returns {T[]} A new array with the specified number of elements removed from the start.
 *
 * @example
 * const array = [1, 2, 3, 4, 5];
 * const result = drop(array, 2);
 * result will be [3, 4, 5] since the first two elements are dropped.
 */ export function drop(collection, itemsCount = 1, guard) {
  if (!isArrayLike(collection)) {
    return [];
  }
  itemsCount = guard ? 1 : toInteger(itemsCount);
  return dropToolkit(toArray(collection), itemsCount);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvZHJvcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkcm9wIGFzIGRyb3BUb29sa2l0IH0gZnJvbSAnLi4vLi4vYXJyYXkvZHJvcC50cyc7XG5pbXBvcnQgeyB0b0FycmF5IH0gZnJvbSAnLi4vX2ludGVybmFsL3RvQXJyYXkudHMnO1xuaW1wb3J0IHsgaXNBcnJheUxpa2UgfSBmcm9tICcuLi9wcmVkaWNhdGUvaXNBcnJheUxpa2UudHMnO1xuaW1wb3J0IHsgdG9JbnRlZ2VyIH0gZnJvbSAnLi4vdXRpbC90b0ludGVnZXIudHMnO1xuXG4vKipcbiAqIFJlbW92ZXMgYSBzcGVjaWZpZWQgbnVtYmVyIG9mIGVsZW1lbnRzIGZyb20gdGhlIGJlZ2lubmluZyBvZiBhbiBhcnJheSBhbmQgcmV0dXJucyB0aGUgcmVzdC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGFuIGFycmF5IGFuZCBhIG51bWJlciwgYW5kIHJldHVybnMgYSBuZXcgYXJyYXkgd2l0aCB0aGUgc3BlY2lmaWVkIG51bWJlclxuICogb2YgZWxlbWVudHMgcmVtb3ZlZCBmcm9tIHRoZSBzdGFydC5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEBwYXJhbSB7QXJyYXlMaWtlPFQ+IHwgbnVsbCB8IHVuZGVmaW5lZH0gY29sbGVjdGlvbiAtIFRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIGRyb3AgZWxlbWVudHMuXG4gKiBAcGFyYW0ge251bWJlcn0gaXRlbXNDb3VudCAtIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZHJvcCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGFycmF5LlxuICogQHBhcmFtIHt1bmtub3dufSBbZ3VhcmRdIC0gRW5hYmxlcyB1c2UgYXMgYW4gaXRlcmF0ZWUgZm9yIG1ldGhvZHMgbGlrZSBgXy5tYXBgLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgd2l0aCB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiBlbGVtZW50cyByZW1vdmVkIGZyb20gdGhlIHN0YXJ0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhcnJheSA9IFsxLCAyLCAzLCA0LCA1XTtcbiAqIGNvbnN0IHJlc3VsdCA9IGRyb3AoYXJyYXksIDIpO1xuICogcmVzdWx0IHdpbGwgYmUgWzMsIDQsIDVdIHNpbmNlIHRoZSBmaXJzdCB0d28gZWxlbWVudHMgYXJlIGRyb3BwZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkcm9wPFQ+KGNvbGxlY3Rpb246IEFycmF5TGlrZTxUPiB8IG51bGwgfCB1bmRlZmluZWQsIGl0ZW1zQ291bnQgPSAxLCBndWFyZD86IHVua25vd24pOiBUW10ge1xuICBpZiAoIWlzQXJyYXlMaWtlKGNvbGxlY3Rpb24pKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIGl0ZW1zQ291bnQgPSBndWFyZCA/IDEgOiB0b0ludGVnZXIoaXRlbXNDb3VudCk7XG5cbiAgcmV0dXJuIGRyb3BUb29sa2l0KHRvQXJyYXkoY29sbGVjdGlvbiksIGl0ZW1zQ291bnQpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxXQUFXLFFBQVEsc0JBQXNCO0FBQzFELFNBQVMsT0FBTyxRQUFRLDBCQUEwQjtBQUNsRCxTQUFTLFdBQVcsUUFBUSw4QkFBOEI7QUFDMUQsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBRWpEOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLEtBQVEsVUFBMkMsRUFBRSxhQUFhLENBQUMsRUFBRSxLQUFlO0VBQ2xHLElBQUksQ0FBQyxZQUFZLGFBQWE7SUFDNUIsT0FBTyxFQUFFO0VBQ1g7RUFDQSxhQUFhLFFBQVEsSUFBSSxVQUFVO0VBRW5DLE9BQU8sWUFBWSxRQUFRLGFBQWE7QUFDMUMifQ==
// denoCacheMetadata=6191841408348350555,5153747301458060429