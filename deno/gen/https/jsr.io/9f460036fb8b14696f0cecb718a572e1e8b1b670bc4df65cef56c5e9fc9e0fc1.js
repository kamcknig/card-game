import { ary as aryToolkit } from '../../function/ary.ts';
/**
 * Creates a function that invokes func, with up to `n` arguments, ignoring any additional arguments.
 *
 * @template F - The type of the function.
 * @param {F} func - The function to cap arguments for.
 * @param {number} n - The arity cap.
 * @param {unknown} guard - The value to guard the arity cap.
 * @returns {(...args: any[]) => ReturnType<F>} Returns the new capped function.
 *
 * @example
 * function fn(a: number, b: number, c: number) {
 *   return Array.from(arguments);
 * }
 *
 * ary(fn, 0)(1, 2, 3); // []
 * ary(fn, 1)(1, 2, 3); // [1]
 * ary(fn, 2)(1, 2, 3); // [1, 2]
 * ary(fn, 3)(1, 2, 3); // [1, 2, 3]
 */ export function ary(func, n = func.length, guard) {
  if (guard) {
    n = func.length;
  }
  if (Number.isNaN(n) || n < 0) {
    n = 0;
  }
  return aryToolkit(func, n);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vYXJ5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFyeSBhcyBhcnlUb29sa2l0IH0gZnJvbSAnLi4vLi4vZnVuY3Rpb24vYXJ5LnRzJztcblxuLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGZ1bmMsIHdpdGggdXAgdG8gYG5gIGFyZ3VtZW50cywgaWdub3JpbmcgYW55IGFkZGl0aW9uYWwgYXJndW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIGNhcCBhcmd1bWVudHMgZm9yLlxuICogQHBhcmFtIHtudW1iZXJ9IG4gLSBUaGUgYXJpdHkgY2FwLlxuICogQHBhcmFtIHt1bmtub3dufSBndWFyZCAtIFRoZSB2YWx1ZSB0byBndWFyZCB0aGUgYXJpdHkgY2FwLlxuICogQHJldHVybnMgeyguLi5hcmdzOiBhbnlbXSkgPT4gUmV0dXJuVHlwZTxGPn0gUmV0dXJucyB0aGUgbmV3IGNhcHBlZCBmdW5jdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogZnVuY3Rpb24gZm4oYTogbnVtYmVyLCBiOiBudW1iZXIsIGM6IG51bWJlcikge1xuICogICByZXR1cm4gQXJyYXkuZnJvbShhcmd1bWVudHMpO1xuICogfVxuICpcbiAqIGFyeShmbiwgMCkoMSwgMiwgMyk7IC8vIFtdXG4gKiBhcnkoZm4sIDEpKDEsIDIsIDMpOyAvLyBbMV1cbiAqIGFyeShmbiwgMikoMSwgMiwgMyk7IC8vIFsxLCAyXVxuICogYXJ5KGZuLCAzKSgxLCAyLCAzKTsgLy8gWzEsIDIsIDNdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcnk8RiBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihcbiAgZnVuYzogRixcbiAgbjogbnVtYmVyID0gZnVuYy5sZW5ndGgsXG4gIGd1YXJkPzogdW5rbm93blxuKTogKC4uLmFyZ3M6IGFueVtdKSA9PiBSZXR1cm5UeXBlPEY+IHtcbiAgaWYgKGd1YXJkKSB7XG4gICAgbiA9IGZ1bmMubGVuZ3RoO1xuICB9XG5cbiAgaWYgKE51bWJlci5pc05hTihuKSB8fCBuIDwgMCkge1xuICAgIG4gPSAwO1xuICB9XG5cbiAgcmV0dXJuIGFyeVRvb2xraXQoZnVuYywgbik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxPQUFPLFVBQVUsUUFBUSx3QkFBd0I7QUFFMUQ7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWtCQyxHQUNELE9BQU8sU0FBUyxJQUNkLElBQU8sRUFDUCxJQUFZLEtBQUssTUFBTSxFQUN2QixLQUFlO0VBRWYsSUFBSSxPQUFPO0lBQ1QsSUFBSSxLQUFLLE1BQU07RUFDakI7RUFFQSxJQUFJLE9BQU8sS0FBSyxDQUFDLE1BQU0sSUFBSSxHQUFHO0lBQzVCLElBQUk7RUFDTjtFQUVBLE9BQU8sV0FBVyxNQUFNO0FBQzFCIn0=
// denoCacheMetadata=14535178500421604393,5247960510740808165