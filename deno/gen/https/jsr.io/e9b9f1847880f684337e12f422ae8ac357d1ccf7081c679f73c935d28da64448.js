/**
 * Creates a function that transforms the arguments of the provided function `func`.
 * The transformed arguments are passed to `func` such that the arguments starting from a specified index
 * are grouped into an array, while the previous arguments are passed as individual elements.
 *
 * @template F - The type of the function being transformed.
 * @param {F} func - The function whose arguments are to be transformed.
 * @param {number} [startIndex=func.length - 1] - The index from which to start grouping the remaining arguments into an array.
 *                                            Defaults to `func.length - 1`, grouping all arguments after the last parameter.
 * @returns {(...args: any[]) => ReturnType<F>} A new function that, when called, returns the result of calling `func` with the transformed arguments.
 *
 * The transformed arguments are:
 * - The first `start` arguments as individual elements.
 * - The remaining arguments from index `start` onward grouped into an array.
 * @example
 * function fn(a, b, c) {
 *   return [a, b, c];
 * }
 *
 * // Using default start index (func.length - 1, which is 2 in this case)
 * const transformedFn = rest(fn);
 * console.log(transformedFn(1, 2, 3, 4)); // [1, 2, [3, 4]]
 *
 * // Using start index 1
 * const transformedFnWithStart = rest(fn, 1);
 * console.log(transformedFnWithStart(1, 2, 3, 4)); // [1, [2, 3, 4]]
 *
 * // With fewer arguments than the start index
 * console.log(transformedFn(1)); // [1, undefined, []]
 */ export function rest(func, startIndex = func.length - 1) {
  return function(...args) {
    const rest = args.slice(startIndex);
    const params = args.slice(0, startIndex);
    while(params.length < startIndex){
      params.push(undefined);
    }
    return func.apply(this, [
      ...params,
      rest
    ]);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9yZXN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgdHJhbnNmb3JtcyB0aGUgYXJndW1lbnRzIG9mIHRoZSBwcm92aWRlZCBmdW5jdGlvbiBgZnVuY2AuXG4gKiBUaGUgdHJhbnNmb3JtZWQgYXJndW1lbnRzIGFyZSBwYXNzZWQgdG8gYGZ1bmNgIHN1Y2ggdGhhdCB0aGUgYXJndW1lbnRzIHN0YXJ0aW5nIGZyb20gYSBzcGVjaWZpZWQgaW5kZXhcbiAqIGFyZSBncm91cGVkIGludG8gYW4gYXJyYXksIHdoaWxlIHRoZSBwcmV2aW91cyBhcmd1bWVudHMgYXJlIHBhc3NlZCBhcyBpbmRpdmlkdWFsIGVsZW1lbnRzLlxuICpcbiAqIEB0ZW1wbGF0ZSBGIC0gVGhlIHR5cGUgb2YgdGhlIGZ1bmN0aW9uIGJlaW5nIHRyYW5zZm9ybWVkLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHdob3NlIGFyZ3VtZW50cyBhcmUgdG8gYmUgdHJhbnNmb3JtZWQuXG4gKiBAcGFyYW0ge251bWJlcn0gW3N0YXJ0SW5kZXg9ZnVuYy5sZW5ndGggLSAxXSAtIFRoZSBpbmRleCBmcm9tIHdoaWNoIHRvIHN0YXJ0IGdyb3VwaW5nIHRoZSByZW1haW5pbmcgYXJndW1lbnRzIGludG8gYW4gYXJyYXkuXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVmYXVsdHMgdG8gYGZ1bmMubGVuZ3RoIC0gMWAsIGdyb3VwaW5nIGFsbCBhcmd1bWVudHMgYWZ0ZXIgdGhlIGxhc3QgcGFyYW1ldGVyLlxuICogQHJldHVybnMgeyguLi5hcmdzOiBhbnlbXSkgPT4gUmV0dXJuVHlwZTxGPn0gQSBuZXcgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIHJldHVybnMgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIGBmdW5jYCB3aXRoIHRoZSB0cmFuc2Zvcm1lZCBhcmd1bWVudHMuXG4gKlxuICogVGhlIHRyYW5zZm9ybWVkIGFyZ3VtZW50cyBhcmU6XG4gKiAtIFRoZSBmaXJzdCBgc3RhcnRgIGFyZ3VtZW50cyBhcyBpbmRpdmlkdWFsIGVsZW1lbnRzLlxuICogLSBUaGUgcmVtYWluaW5nIGFyZ3VtZW50cyBmcm9tIGluZGV4IGBzdGFydGAgb253YXJkIGdyb3VwZWQgaW50byBhbiBhcnJheS5cbiAqIEBleGFtcGxlXG4gKiBmdW5jdGlvbiBmbihhLCBiLCBjKSB7XG4gKiAgIHJldHVybiBbYSwgYiwgY107XG4gKiB9XG4gKlxuICogLy8gVXNpbmcgZGVmYXVsdCBzdGFydCBpbmRleCAoZnVuYy5sZW5ndGggLSAxLCB3aGljaCBpcyAyIGluIHRoaXMgY2FzZSlcbiAqIGNvbnN0IHRyYW5zZm9ybWVkRm4gPSByZXN0KGZuKTtcbiAqIGNvbnNvbGUubG9nKHRyYW5zZm9ybWVkRm4oMSwgMiwgMywgNCkpOyAvLyBbMSwgMiwgWzMsIDRdXVxuICpcbiAqIC8vIFVzaW5nIHN0YXJ0IGluZGV4IDFcbiAqIGNvbnN0IHRyYW5zZm9ybWVkRm5XaXRoU3RhcnQgPSByZXN0KGZuLCAxKTtcbiAqIGNvbnNvbGUubG9nKHRyYW5zZm9ybWVkRm5XaXRoU3RhcnQoMSwgMiwgMywgNCkpOyAvLyBbMSwgWzIsIDMsIDRdXVxuICpcbiAqIC8vIFdpdGggZmV3ZXIgYXJndW1lbnRzIHRoYW4gdGhlIHN0YXJ0IGluZGV4XG4gKiBjb25zb2xlLmxvZyh0cmFuc2Zvcm1lZEZuKDEpKTsgLy8gWzEsIHVuZGVmaW5lZCwgW11dXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXN0PEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oXG4gIGZ1bmM6IEYsXG4gIHN0YXJ0SW5kZXggPSBmdW5jLmxlbmd0aCAtIDFcbik6ICguLi5hcmdzOiBhbnlbXSkgPT4gUmV0dXJuVHlwZTxGPiB7XG4gIHJldHVybiBmdW5jdGlvbiAodGhpczogYW55LCAuLi5hcmdzOiBhbnlbXSkge1xuICAgIGNvbnN0IHJlc3QgPSBhcmdzLnNsaWNlKHN0YXJ0SW5kZXgpO1xuICAgIGNvbnN0IHBhcmFtcyA9IGFyZ3Muc2xpY2UoMCwgc3RhcnRJbmRleCk7XG4gICAgd2hpbGUgKHBhcmFtcy5sZW5ndGggPCBzdGFydEluZGV4KSB7XG4gICAgICBwYXJhbXMucHVzaCh1bmRlZmluZWQpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBbLi4ucGFyYW1zLCByZXN0XSk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJDLEdBQ0QsT0FBTyxTQUFTLEtBQ2QsSUFBTyxFQUNQLGFBQWEsS0FBSyxNQUFNLEdBQUcsQ0FBQztFQUU1QixPQUFPLFNBQXFCLEdBQUcsSUFBVztJQUN4QyxNQUFNLE9BQU8sS0FBSyxLQUFLLENBQUM7SUFDeEIsTUFBTSxTQUFTLEtBQUssS0FBSyxDQUFDLEdBQUc7SUFDN0IsTUFBTyxPQUFPLE1BQU0sR0FBRyxXQUFZO01BQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2Q7SUFDQSxPQUFPLEtBQUssS0FBSyxDQUFDLElBQUksRUFBRTtTQUFJO01BQVE7S0FBSztFQUMzQztBQUNGIn0=
// denoCacheMetadata=14868041731922761563,7788869853646740210