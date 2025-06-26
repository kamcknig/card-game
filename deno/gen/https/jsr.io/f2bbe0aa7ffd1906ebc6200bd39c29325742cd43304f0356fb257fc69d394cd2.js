import { uniqBy } from './uniqBy.ts';
/**
 * Creates an array of unique values, in order, from all given arrays using a provided mapping function to determine equality.
 *
 * @template T - The type of elements in the array.
 * @template U - The type of mapped elements.
 * @param {T[]} arr1 - The first array.
 * @param {T[]} arr2 - The second array.
 * @param {(item: T) => U} mapper - The function to map array elements to comparison values.
 * @returns {T[]} A new array containing the union of unique elements from `arr1` and `arr2`, based on the values returned by the mapping function.
 *
 * @example
 * // Custom mapping function for numbers (modulo comparison)
 * const moduloMapper = (x) => x % 3;
 * unionBy([1, 2, 3], [4, 5, 6], moduloMapper);
 * // Returns [1, 2, 3]
 *
 * @example
 * // Custom mapping function for objects with an 'id' property
 * const idMapper = (obj) => obj.id;
 * unionBy([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], idMapper);
 * // Returns [{ id: 1 }, { id: 2 }, { id: 3 }]
 */ export function unionBy(arr1, arr2, mapper) {
  return uniqBy(arr1.concat(arr2), mapper);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9hcnJheS91bmlvbkJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHVuaXFCeSB9IGZyb20gJy4vdW5pcUJ5LnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGFycmF5IG9mIHVuaXF1ZSB2YWx1ZXMsIGluIG9yZGVyLCBmcm9tIGFsbCBnaXZlbiBhcnJheXMgdXNpbmcgYSBwcm92aWRlZCBtYXBwaW5nIGZ1bmN0aW9uIHRvIGRldGVybWluZSBlcXVhbGl0eS5cbiAqXG4gKiBAdGVtcGxhdGUgVCAtIFRoZSB0eXBlIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAqIEB0ZW1wbGF0ZSBVIC0gVGhlIHR5cGUgb2YgbWFwcGVkIGVsZW1lbnRzLlxuICogQHBhcmFtIHtUW119IGFycjEgLSBUaGUgZmlyc3QgYXJyYXkuXG4gKiBAcGFyYW0ge1RbXX0gYXJyMiAtIFRoZSBzZWNvbmQgYXJyYXkuXG4gKiBAcGFyYW0geyhpdGVtOiBUKSA9PiBVfSBtYXBwZXIgLSBUaGUgZnVuY3Rpb24gdG8gbWFwIGFycmF5IGVsZW1lbnRzIHRvIGNvbXBhcmlzb24gdmFsdWVzLlxuICogQHJldHVybnMge1RbXX0gQSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgdW5pb24gb2YgdW5pcXVlIGVsZW1lbnRzIGZyb20gYGFycjFgIGFuZCBgYXJyMmAsIGJhc2VkIG9uIHRoZSB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIG1hcHBpbmcgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEN1c3RvbSBtYXBwaW5nIGZ1bmN0aW9uIGZvciBudW1iZXJzIChtb2R1bG8gY29tcGFyaXNvbilcbiAqIGNvbnN0IG1vZHVsb01hcHBlciA9ICh4KSA9PiB4ICUgMztcbiAqIHVuaW9uQnkoWzEsIDIsIDNdLCBbNCwgNSwgNl0sIG1vZHVsb01hcHBlcik7XG4gKiAvLyBSZXR1cm5zIFsxLCAyLCAzXVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDdXN0b20gbWFwcGluZyBmdW5jdGlvbiBmb3Igb2JqZWN0cyB3aXRoIGFuICdpZCcgcHJvcGVydHlcbiAqIGNvbnN0IGlkTWFwcGVyID0gKG9iaikgPT4gb2JqLmlkO1xuICogdW5pb25CeShbeyBpZDogMSB9LCB7IGlkOiAyIH1dLCBbeyBpZDogMiB9LCB7IGlkOiAzIH1dLCBpZE1hcHBlcik7XG4gKiAvLyBSZXR1cm5zIFt7IGlkOiAxIH0sIHsgaWQ6IDIgfSwgeyBpZDogMyB9XVxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5pb25CeTxULCBVPihhcnIxOiByZWFkb25seSBUW10sIGFycjI6IHJlYWRvbmx5IFRbXSwgbWFwcGVyOiAoaXRlbTogVCkgPT4gVSk6IFRbXSB7XG4gIHJldHVybiB1bmlxQnkoYXJyMS5jb25jYXQoYXJyMiksIG1hcHBlcik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxNQUFNLFFBQVEsY0FBYztBQUVyQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBcUJDLEdBQ0QsT0FBTyxTQUFTLFFBQWMsSUFBa0IsRUFBRSxJQUFrQixFQUFFLE1BQXNCO0VBQzFGLE9BQU8sT0FBTyxLQUFLLE1BQU0sQ0FBQyxPQUFPO0FBQ25DIn0=
// denoCacheMetadata=15596194486250044029,9097932709665313134