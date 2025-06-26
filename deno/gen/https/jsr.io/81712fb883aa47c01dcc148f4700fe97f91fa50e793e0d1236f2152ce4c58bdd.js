import { orderBy } from './orderBy.ts';
import { flatten } from '../../array/flatten.ts';
import { isIterateeCall } from '../_internal/isIterateeCall.ts';
/**
 * Sorts an array of objects based on multiple properties and their corresponding order directions.
 *
 * This function takes an array of objects, an array of criteria to sort by.
 * It returns the ascending sorted array, ordering by each key.
 * If values for a key are equal, it moves to the next key to determine the order.
 *
 * @template T - The type of elements in the array.
 * @param {ArrayLike<T> | object | null | undefined} collection - The array of objects to be sorted.
 * @param {Array<Array<Criterion<T> | Criterion<T>>>} criteria - An array of criteria (property names or property paths or custom key functions) to sort by.
 * @returns {T[]} - The ascending sorted array.
 *
 * @example
 * // Sort an array of objects by 'user' in ascending order and 'age' in descending order.
 * const users = [
 *   { user: 'fred', age: 48 },
 *   { user: 'barney', age: 34 },
 *   { user: 'fred', age: 40 },
 *   { user: 'barney', age: 36 },
 * ];
 * const result = sortBy(users, ['user', (item) => item.age])
 * // result will be:
 * // [
 * //   { user: 'barney', age: 34 },
 * //   { user: 'barney', age: 36 },
 * //   { user: 'fred', age: 40 },
 * //   { user: 'fred', age: 48 },
 * // ]
 */ export function sortBy(collection, ...criteria) {
  const length = criteria.length;
  // Enables use as an iteratee for methods like `_.reduce` and `_.map`.
  if (length > 1 && isIterateeCall(collection, criteria[0], criteria[1])) {
    criteria = [];
  } else if (length > 2 && isIterateeCall(criteria[0], criteria[1], criteria[2])) {
    criteria = [
      criteria[0]
    ];
  }
  return orderBy(collection, flatten(criteria), [
    'asc'
  ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvYXJyYXkvc29ydEJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENyaXRlcmlvbiwgb3JkZXJCeSB9IGZyb20gJy4vb3JkZXJCeS50cyc7XG5pbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAnLi4vLi4vYXJyYXkvZmxhdHRlbi50cyc7XG5pbXBvcnQgeyBpc0l0ZXJhdGVlQ2FsbCB9IGZyb20gJy4uL19pbnRlcm5hbC9pc0l0ZXJhdGVlQ2FsbC50cyc7XG5cbi8qKlxuICogU29ydHMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBiYXNlZCBvbiBtdWx0aXBsZSBwcm9wZXJ0aWVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9yZGVyIGRpcmVjdGlvbnMuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0YWtlcyBhbiBhcnJheSBvZiBvYmplY3RzLCBhbiBhcnJheSBvZiBjcml0ZXJpYSB0byBzb3J0IGJ5LlxuICogSXQgcmV0dXJucyB0aGUgYXNjZW5kaW5nIHNvcnRlZCBhcnJheSwgb3JkZXJpbmcgYnkgZWFjaCBrZXkuXG4gKiBJZiB2YWx1ZXMgZm9yIGEga2V5IGFyZSBlcXVhbCwgaXQgbW92ZXMgdG8gdGhlIG5leHQga2V5IHRvIGRldGVybWluZSB0aGUgb3JkZXIuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiBlbGVtZW50cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxUPiB8IG9iamVjdCB8IG51bGwgfCB1bmRlZmluZWR9IGNvbGxlY3Rpb24gLSBUaGUgYXJyYXkgb2Ygb2JqZWN0cyB0byBiZSBzb3J0ZWQuXG4gKiBAcGFyYW0ge0FycmF5PEFycmF5PENyaXRlcmlvbjxUPiB8IENyaXRlcmlvbjxUPj4+fSBjcml0ZXJpYSAtIEFuIGFycmF5IG9mIGNyaXRlcmlhIChwcm9wZXJ0eSBuYW1lcyBvciBwcm9wZXJ0eSBwYXRocyBvciBjdXN0b20ga2V5IGZ1bmN0aW9ucykgdG8gc29ydCBieS5cbiAqIEByZXR1cm5zIHtUW119IC0gVGhlIGFzY2VuZGluZyBzb3J0ZWQgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIFNvcnQgYW4gYXJyYXkgb2Ygb2JqZWN0cyBieSAndXNlcicgaW4gYXNjZW5kaW5nIG9yZGVyIGFuZCAnYWdlJyBpbiBkZXNjZW5kaW5nIG9yZGVyLlxuICogY29uc3QgdXNlcnMgPSBbXG4gKiAgIHsgdXNlcjogJ2ZyZWQnLCBhZ2U6IDQ4IH0sXG4gKiAgIHsgdXNlcjogJ2Jhcm5leScsIGFnZTogMzQgfSxcbiAqICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDAgfSxcbiAqICAgeyB1c2VyOiAnYmFybmV5JywgYWdlOiAzNiB9LFxuICogXTtcbiAqIGNvbnN0IHJlc3VsdCA9IHNvcnRCeSh1c2VycywgWyd1c2VyJywgKGl0ZW0pID0+IGl0ZW0uYWdlXSlcbiAqIC8vIHJlc3VsdCB3aWxsIGJlOlxuICogLy8gW1xuICogLy8gICB7IHVzZXI6ICdiYXJuZXknLCBhZ2U6IDM0IH0sXG4gKiAvLyAgIHsgdXNlcjogJ2Jhcm5leScsIGFnZTogMzYgfSxcbiAqIC8vICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDAgfSxcbiAqIC8vICAgeyB1c2VyOiAnZnJlZCcsIGFnZTogNDggfSxcbiAqIC8vIF1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNvcnRCeTxUID0gYW55PihcbiAgY29sbGVjdGlvbjogQXJyYXlMaWtlPFQ+IHwgb2JqZWN0IHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgLi4uY3JpdGVyaWE6IEFycmF5PENyaXRlcmlvbjxUPiB8IEFycmF5PENyaXRlcmlvbjxUPj4+XG4pOiBUW10ge1xuICBjb25zdCBsZW5ndGggPSBjcml0ZXJpYS5sZW5ndGg7XG4gIC8vIEVuYWJsZXMgdXNlIGFzIGFuIGl0ZXJhdGVlIGZvciBtZXRob2RzIGxpa2UgYF8ucmVkdWNlYCBhbmQgYF8ubWFwYC5cbiAgaWYgKGxlbmd0aCA+IDEgJiYgaXNJdGVyYXRlZUNhbGwoY29sbGVjdGlvbiwgY3JpdGVyaWFbMF0sIGNyaXRlcmlhWzFdKSkge1xuICAgIGNyaXRlcmlhID0gW107XG4gIH0gZWxzZSBpZiAobGVuZ3RoID4gMiAmJiBpc0l0ZXJhdGVlQ2FsbChjcml0ZXJpYVswXSwgY3JpdGVyaWFbMV0sIGNyaXRlcmlhWzJdKSkge1xuICAgIGNyaXRlcmlhID0gW2NyaXRlcmlhWzBdXTtcbiAgfVxuICByZXR1cm4gb3JkZXJCeShjb2xsZWN0aW9uLCBmbGF0dGVuKGNyaXRlcmlhKSwgWydhc2MnXSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBb0IsT0FBTyxRQUFRLGVBQWU7QUFDbEQsU0FBUyxPQUFPLFFBQVEseUJBQXlCO0FBQ2pELFNBQVMsY0FBYyxRQUFRLGlDQUFpQztBQUVoRTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTRCQyxHQUNELE9BQU8sU0FBUyxPQUNkLFVBQW9ELEVBQ3BELEdBQUcsUUFBbUQ7RUFFdEQsTUFBTSxTQUFTLFNBQVMsTUFBTTtFQUM5QixzRUFBc0U7RUFDdEUsSUFBSSxTQUFTLEtBQUssZUFBZSxZQUFZLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUUsR0FBRztJQUN0RSxXQUFXLEVBQUU7RUFDZixPQUFPLElBQUksU0FBUyxLQUFLLGVBQWUsUUFBUSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEdBQUc7SUFDOUUsV0FBVztNQUFDLFFBQVEsQ0FBQyxFQUFFO0tBQUM7RUFDMUI7RUFDQSxPQUFPLFFBQVEsWUFBWSxRQUFRLFdBQVc7SUFBQztHQUFNO0FBQ3ZEIn0=
// denoCacheMetadata=3104832230137384806,3289707745138468701