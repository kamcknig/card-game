import { orderBy } from './orderBy.ts';
/**
 * Sorts an array of objects based on the given `criteria`.
 *
 * - If you provide keys, it sorts the objects by the values of those keys.
 * - If you provide functions, it sorts based on the values returned by those functions.
 *
 * The function returns the array of objects sorted in ascending order.
 * If two objects have the same value for the current criterion, it uses the next criterion to determine their order.
 *
 * @template T - The type of the objects in the array.
 * @param {T[]} arr - The array of objects to be sorted.
 * @param {Array<((item: T) => unknown) | keyof T>} criteria - The criteria for sorting. This can be an array of object keys or functions that return values used for sorting.
 * @returns {T[]} - The sorted array.
 *
 * @example
 * const users = [
 *  { user: 'foo', age: 24 },
 *  { user: 'bar', age: 7 },
 *  { user: 'foo ', age: 8 },
 *  { user: 'bar ', age: 29 },
 * ];
 *
 * sortBy(users, ['user', 'age']);
 * sortBy(users, [obj => obj.user, 'age']);
 * // results will be:
 * // [
 * //   { user : 'bar', age: 7 },
 * //   { user : 'bar', age: 29 },
 * //   { user : 'foo', age: 8 },
 * //   { user : 'foo', age: 24 },
 * // ]
 */ export function sortBy(arr, criteria) {
  return orderBy(arr, criteria, [
    'asc'
  ]);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS9zb3J0QnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgb3JkZXJCeSB9IGZyb20gJy4vb3JkZXJCeS50cyc7XG5cbi8qKlxuICogU29ydHMgYW4gYXJyYXkgb2Ygb2JqZWN0cyBiYXNlZCBvbiB0aGUgZ2l2ZW4gYGNyaXRlcmlhYC5cbiAqXG4gKiAtIElmIHlvdSBwcm92aWRlIGtleXMsIGl0IHNvcnRzIHRoZSBvYmplY3RzIGJ5IHRoZSB2YWx1ZXMgb2YgdGhvc2Uga2V5cy5cbiAqIC0gSWYgeW91IHByb3ZpZGUgZnVuY3Rpb25zLCBpdCBzb3J0cyBiYXNlZCBvbiB0aGUgdmFsdWVzIHJldHVybmVkIGJ5IHRob3NlIGZ1bmN0aW9ucy5cbiAqXG4gKiBUaGUgZnVuY3Rpb24gcmV0dXJucyB0aGUgYXJyYXkgb2Ygb2JqZWN0cyBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyLlxuICogSWYgdHdvIG9iamVjdHMgaGF2ZSB0aGUgc2FtZSB2YWx1ZSBmb3IgdGhlIGN1cnJlbnQgY3JpdGVyaW9uLCBpdCB1c2VzIHRoZSBuZXh0IGNyaXRlcmlvbiB0byBkZXRlcm1pbmUgdGhlaXIgb3JkZXIuXG4gKlxuICogQHRlbXBsYXRlIFQgLSBUaGUgdHlwZSBvZiB0aGUgb2JqZWN0cyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyIC0gVGhlIGFycmF5IG9mIG9iamVjdHMgdG8gYmUgc29ydGVkLlxuICogQHBhcmFtIHtBcnJheTwoKGl0ZW06IFQpID0+IHVua25vd24pIHwga2V5b2YgVD59IGNyaXRlcmlhIC0gVGhlIGNyaXRlcmlhIGZvciBzb3J0aW5nLiBUaGlzIGNhbiBiZSBhbiBhcnJheSBvZiBvYmplY3Qga2V5cyBvciBmdW5jdGlvbnMgdGhhdCByZXR1cm4gdmFsdWVzIHVzZWQgZm9yIHNvcnRpbmcuXG4gKiBAcmV0dXJucyB7VFtdfSAtIFRoZSBzb3J0ZWQgYXJyYXkuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHVzZXJzID0gW1xuICogIHsgdXNlcjogJ2ZvbycsIGFnZTogMjQgfSxcbiAqICB7IHVzZXI6ICdiYXInLCBhZ2U6IDcgfSxcbiAqICB7IHVzZXI6ICdmb28gJywgYWdlOiA4IH0sXG4gKiAgeyB1c2VyOiAnYmFyICcsIGFnZTogMjkgfSxcbiAqIF07XG4gKlxuICogc29ydEJ5KHVzZXJzLCBbJ3VzZXInLCAnYWdlJ10pO1xuICogc29ydEJ5KHVzZXJzLCBbb2JqID0+IG9iai51c2VyLCAnYWdlJ10pO1xuICogLy8gcmVzdWx0cyB3aWxsIGJlOlxuICogLy8gW1xuICogLy8gICB7IHVzZXIgOiAnYmFyJywgYWdlOiA3IH0sXG4gKiAvLyAgIHsgdXNlciA6ICdiYXInLCBhZ2U6IDI5IH0sXG4gKiAvLyAgIHsgdXNlciA6ICdmb28nLCBhZ2U6IDggfSxcbiAqIC8vICAgeyB1c2VyIDogJ2ZvbycsIGFnZTogMjQgfSxcbiAqIC8vIF1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNvcnRCeTxUIGV4dGVuZHMgb2JqZWN0PihhcnI6IHJlYWRvbmx5IFRbXSwgY3JpdGVyaWE6IEFycmF5PCgoaXRlbTogVCkgPT4gdW5rbm93bikgfCBrZXlvZiBUPik6IFRbXSB7XG4gIHJldHVybiBvcmRlckJ5KGFyciwgY3JpdGVyaWEsIFsnYXNjJ10pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsT0FBTyxRQUFRLGVBQWU7QUFFdkM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0ErQkMsR0FDRCxPQUFPLFNBQVMsT0FBeUIsR0FBaUIsRUFBRSxRQUFpRDtFQUMzRyxPQUFPLFFBQVEsS0FBSyxVQUFVO0lBQUM7R0FBTTtBQUN2QyJ9
// denoCacheMetadata=11778049023581494008,6379124081769950030