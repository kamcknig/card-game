/**
 * Creates a function that invokes func, with up to n arguments, ignoring any additional arguments.
 *
 * @template F - The type of the function.
 * @param {F} func - The function to cap arguments for.
 * @param {number} n - The arity cap.
 * @returns {(...args: any[]) => ReturnType<F>} Returns the new capped function.
 *
 * @example
 * function fn(a: number, b: number, c: number) {
 *   return Array.from(arguments);
 * }
 *
 * ary(fn, 0)(1, 2, 3) // []
 * ary(fn, 1)(1, 2, 3) // [1]
 * ary(fn, 2)(1, 2, 3) // [1, 2]
 * ary(fn, 3)(1, 2, 3) // [1, 2, 3]
 */ export function ary(func, n) {
  return function(...args) {
    return func.apply(this, args.slice(0, n));
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi9hcnkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpbnZva2VzIGZ1bmMsIHdpdGggdXAgdG8gbiBhcmd1bWVudHMsIGlnbm9yaW5nIGFueSBhZGRpdGlvbmFsIGFyZ3VtZW50cy5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIHRoZSBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7Rn0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBjYXAgYXJndW1lbnRzIGZvci5cbiAqIEBwYXJhbSB7bnVtYmVyfSBuIC0gVGhlIGFyaXR5IGNhcC5cbiAqIEByZXR1cm5zIHsoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8Rj59IFJldHVybnMgdGhlIG5ldyBjYXBwZWQgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGZ1bmN0aW9uIGZuKGE6IG51bWJlciwgYjogbnVtYmVyLCBjOiBudW1iZXIpIHtcbiAqICAgcmV0dXJuIEFycmF5LmZyb20oYXJndW1lbnRzKTtcbiAqIH1cbiAqXG4gKiBhcnkoZm4sIDApKDEsIDIsIDMpIC8vIFtdXG4gKiBhcnkoZm4sIDEpKDEsIDIsIDMpIC8vIFsxXVxuICogYXJ5KGZuLCAyKSgxLCAyLCAzKSAvLyBbMSwgMl1cbiAqIGFyeShmbiwgMykoMSwgMiwgMykgLy8gWzEsIDIsIDNdXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcnk8RiBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihmdW5jOiBGLCBuOiBudW1iZXIpOiAoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8Rj4ge1xuICByZXR1cm4gZnVuY3Rpb24gKHRoaXM6IGFueSwgLi4uYXJnczogUGFyYW1ldGVyczxGPikge1xuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3Muc2xpY2UoMCwgbikpO1xuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7OztDQWlCQyxHQUNELE9BQU8sU0FBUyxJQUF1QyxJQUFPLEVBQUUsQ0FBUztFQUN2RSxPQUFPLFNBQXFCLEdBQUcsSUFBbUI7SUFDaEQsT0FBTyxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFLLENBQUMsR0FBRztFQUN4QztBQUNGIn0=
// denoCacheMetadata=7724148242807760379,2596680065431219140