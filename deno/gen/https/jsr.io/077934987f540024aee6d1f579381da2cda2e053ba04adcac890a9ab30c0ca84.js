import { cloneDeepWithImpl } from './cloneDeepWith.ts';
/**
 * Creates a deep clone of the given object.
 *
 * @template T - The type of the object.
 * @param {T} obj - The object to clone.
 * @returns {T} - A deep clone of the given object.
 *
 * @example
 * // Clone a primitive values
 * const num = 29;
 * const clonedNum = clone(num);
 * console.log(clonedNum); // 29
 * console.log(clonedNum === num) ; // true
 *
 * @example
 * // Clone an array
 * const arr = [1, 2, 3];
 * const clonedArr = clone(arr);
 * console.log(clonedArr); // [1, 2, 3]
 * console.log(clonedArr === arr); // false
 *
 * @example
 * // Clone an array with nested objects
 * const arr = [1, { a: 1 }, [1, 2, 3]];
 * const clonedArr = clone(arr);
 * arr[1].a = 2;
 * console.log(arr); // [2, { a: 2 }, [1, 2, 3]]
 * console.log(clonedArr); // [1, { a: 1 }, [1, 2, 3]]
 * console.log(clonedArr === arr); // false
 *
 * @example
 * // Clone an object
 * const obj = { a: 1, b: 'es-toolkit', c: [1, 2, 3] };
 * const clonedObj = clone(obj);
 * console.log(clonedObj); // { a: 1, b: 'es-toolkit', c: [1, 2, 3] }
 * console.log(clonedObj === obj); // false
 *
 * @example
 * // Clone an object with nested objects
 * const obj = { a: 1, b: { c: 1 } };
 * const clonedObj = clone(obj);
 * obj.b.c = 2;
 * console.log(obj); // { a: 1, b: { c: 2 } }
 * console.log(clonedObj); // { a: 1, b: { c: 1 } }
 * console.log(clonedObj === obj); // false
 */ export function cloneDeep(obj) {
  return cloneDeepWithImpl(obj, undefined, obj, new Map(), undefined);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9vYmplY3QvY2xvbmVEZWVwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNsb25lRGVlcFdpdGhJbXBsIH0gZnJvbSAnLi9jbG9uZURlZXBXaXRoLnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZGVlcCBjbG9uZSBvZiB0aGUgZ2l2ZW4gb2JqZWN0LlxuICpcbiAqIEB0ZW1wbGF0ZSBUIC0gVGhlIHR5cGUgb2YgdGhlIG9iamVjdC5cbiAqIEBwYXJhbSB7VH0gb2JqIC0gVGhlIG9iamVjdCB0byBjbG9uZS5cbiAqIEByZXR1cm5zIHtUfSAtIEEgZGVlcCBjbG9uZSBvZiB0aGUgZ2l2ZW4gb2JqZWN0LlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDbG9uZSBhIHByaW1pdGl2ZSB2YWx1ZXNcbiAqIGNvbnN0IG51bSA9IDI5O1xuICogY29uc3QgY2xvbmVkTnVtID0gY2xvbmUobnVtKTtcbiAqIGNvbnNvbGUubG9nKGNsb25lZE51bSk7IC8vIDI5XG4gKiBjb25zb2xlLmxvZyhjbG9uZWROdW0gPT09IG51bSkgOyAvLyB0cnVlXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENsb25lIGFuIGFycmF5XG4gKiBjb25zdCBhcnIgPSBbMSwgMiwgM107XG4gKiBjb25zdCBjbG9uZWRBcnIgPSBjbG9uZShhcnIpO1xuICogY29uc29sZS5sb2coY2xvbmVkQXJyKTsgLy8gWzEsIDIsIDNdXG4gKiBjb25zb2xlLmxvZyhjbG9uZWRBcnIgPT09IGFycik7IC8vIGZhbHNlXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIENsb25lIGFuIGFycmF5IHdpdGggbmVzdGVkIG9iamVjdHNcbiAqIGNvbnN0IGFyciA9IFsxLCB7IGE6IDEgfSwgWzEsIDIsIDNdXTtcbiAqIGNvbnN0IGNsb25lZEFyciA9IGNsb25lKGFycik7XG4gKiBhcnJbMV0uYSA9IDI7XG4gKiBjb25zb2xlLmxvZyhhcnIpOyAvLyBbMiwgeyBhOiAyIH0sIFsxLCAyLCAzXV1cbiAqIGNvbnNvbGUubG9nKGNsb25lZEFycik7IC8vIFsxLCB7IGE6IDEgfSwgWzEsIDIsIDNdXVxuICogY29uc29sZS5sb2coY2xvbmVkQXJyID09PSBhcnIpOyAvLyBmYWxzZVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBDbG9uZSBhbiBvYmplY3RcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogJ2VzLXRvb2xraXQnLCBjOiBbMSwgMiwgM10gfTtcbiAqIGNvbnN0IGNsb25lZE9iaiA9IGNsb25lKG9iaik7XG4gKiBjb25zb2xlLmxvZyhjbG9uZWRPYmopOyAvLyB7IGE6IDEsIGI6ICdlcy10b29sa2l0JywgYzogWzEsIDIsIDNdIH1cbiAqIGNvbnNvbGUubG9nKGNsb25lZE9iaiA9PT0gb2JqKTsgLy8gZmFsc2VcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ2xvbmUgYW4gb2JqZWN0IHdpdGggbmVzdGVkIG9iamVjdHNcbiAqIGNvbnN0IG9iaiA9IHsgYTogMSwgYjogeyBjOiAxIH0gfTtcbiAqIGNvbnN0IGNsb25lZE9iaiA9IGNsb25lKG9iaik7XG4gKiBvYmouYi5jID0gMjtcbiAqIGNvbnNvbGUubG9nKG9iaik7IC8vIHsgYTogMSwgYjogeyBjOiAyIH0gfVxuICogY29uc29sZS5sb2coY2xvbmVkT2JqKTsgLy8geyBhOiAxLCBiOiB7IGM6IDEgfSB9XG4gKiBjb25zb2xlLmxvZyhjbG9uZWRPYmogPT09IG9iaik7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbG9uZURlZXA8VD4ob2JqOiBUKTogVCB7XG4gIHJldHVybiBjbG9uZURlZXBXaXRoSW1wbChvYmosIHVuZGVmaW5lZCwgb2JqLCBuZXcgTWFwKCksIHVuZGVmaW5lZCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxpQkFBaUIsUUFBUSxxQkFBcUI7QUFFdkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZDQyxHQUNELE9BQU8sU0FBUyxVQUFhLEdBQU07RUFDakMsT0FBTyxrQkFBa0IsS0FBSyxXQUFXLEtBQUssSUFBSSxPQUFPO0FBQzNEIn0=
// denoCacheMetadata=4760807416073720889,14876962004236513617