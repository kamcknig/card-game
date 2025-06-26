/**
 * Creates a new function that spreads elements of an array argument into individual arguments
 * for the original function. The array argument is positioned based on the `argsIndex` parameter.
 *
 * @template F - A function type with any number of parameters and any return type.
 * @param {F} func - The function to be transformed. It can be any function with any number of arguments.
 * @param {number} [argsIndex=0] - The index where the array argument is positioned among the other arguments.
 *   If `argsIndex` is negative or `NaN`, it defaults to `0`. If it's a fractional number, it is rounded to the nearest integer.
 * @returns {(...args: any[]) => ReturnType<F>} - A new function that takes multiple arguments, including an array of arguments at the specified `argsIndex`,
 *   and returns the result of calling the original function with those arguments.
 *
 * @example
 * function add(a, b) {
 *   return a + b;
 * }
 *
 * const spreadAdd = spread(add);
 * console.log(spreadAdd([1, 2])); // Output: 3
 *
 * @example
 * // Example function to spread arguments over
 * function add(a, b) {
 *   return a + b;
 * }
 *
 * // Create a new function that uses `spread` to combine arguments
 * const spreadAdd = spread(add, 1);
 *
 * // Calling `spreadAdd` with an array as the second argument
 * console.log(spreadAdd(1, [2])); // Output: 3
 *
 * @example
 * // Function with default arguments
 * function greet(name, greeting = 'Hello') {
 *   return `${greeting}, ${name}!`;
 * }
 *
 * // Create a new function that uses `spread` to position the argument array at index 0
 * const spreadGreet = spread(greet, 0);
 *
 * // Calling `spreadGreet` with an array of arguments
 * console.log(spreadGreet(['Alice'])); // Output: Hello, Alice!
 * console.log(spreadGreet(['Bob', 'Hi'])); // Output: Hi, Bob!
 */ export function spread(func, argsIndex = 0) {
  argsIndex = Number.parseInt(argsIndex, 10);
  if (Number.isNaN(argsIndex) || argsIndex < 0) {
    argsIndex = 0;
  }
  return function(...args) {
    const array = args[argsIndex];
    const params = args.slice(0, argsIndex);
    if (array) {
      params.push(...array);
    }
    return func.apply(this, params);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvZnVuY3Rpb24vc3ByZWFkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmdW5jdGlvbiB0aGF0IHNwcmVhZHMgZWxlbWVudHMgb2YgYW4gYXJyYXkgYXJndW1lbnQgaW50byBpbmRpdmlkdWFsIGFyZ3VtZW50c1xuICogZm9yIHRoZSBvcmlnaW5hbCBmdW5jdGlvbi4gVGhlIGFycmF5IGFyZ3VtZW50IGlzIHBvc2l0aW9uZWQgYmFzZWQgb24gdGhlIGBhcmdzSW5kZXhgIHBhcmFtZXRlci5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIEEgZnVuY3Rpb24gdHlwZSB3aXRoIGFueSBudW1iZXIgb2YgcGFyYW1ldGVycyBhbmQgYW55IHJldHVybiB0eXBlLlxuICogQHBhcmFtIHtGfSBmdW5jIC0gVGhlIGZ1bmN0aW9uIHRvIGJlIHRyYW5zZm9ybWVkLiBJdCBjYW4gYmUgYW55IGZ1bmN0aW9uIHdpdGggYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gKiBAcGFyYW0ge251bWJlcn0gW2FyZ3NJbmRleD0wXSAtIFRoZSBpbmRleCB3aGVyZSB0aGUgYXJyYXkgYXJndW1lbnQgaXMgcG9zaXRpb25lZCBhbW9uZyB0aGUgb3RoZXIgYXJndW1lbnRzLlxuICogICBJZiBgYXJnc0luZGV4YCBpcyBuZWdhdGl2ZSBvciBgTmFOYCwgaXQgZGVmYXVsdHMgdG8gYDBgLiBJZiBpdCdzIGEgZnJhY3Rpb25hbCBudW1iZXIsIGl0IGlzIHJvdW5kZWQgdG8gdGhlIG5lYXJlc3QgaW50ZWdlci5cbiAqIEByZXR1cm5zIHsoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8Rj59IC0gQSBuZXcgZnVuY3Rpb24gdGhhdCB0YWtlcyBtdWx0aXBsZSBhcmd1bWVudHMsIGluY2x1ZGluZyBhbiBhcnJheSBvZiBhcmd1bWVudHMgYXQgdGhlIHNwZWNpZmllZCBgYXJnc0luZGV4YCxcbiAqICAgYW5kIHJldHVybnMgdGhlIHJlc3VsdCBvZiBjYWxsaW5nIHRoZSBvcmlnaW5hbCBmdW5jdGlvbiB3aXRoIHRob3NlIGFyZ3VtZW50cy5cbiAqXG4gKiBAZXhhbXBsZVxuICogZnVuY3Rpb24gYWRkKGEsIGIpIHtcbiAqICAgcmV0dXJuIGEgKyBiO1xuICogfVxuICpcbiAqIGNvbnN0IHNwcmVhZEFkZCA9IHNwcmVhZChhZGQpO1xuICogY29uc29sZS5sb2coc3ByZWFkQWRkKFsxLCAyXSkpOyAvLyBPdXRwdXQ6IDNcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRXhhbXBsZSBmdW5jdGlvbiB0byBzcHJlYWQgYXJndW1lbnRzIG92ZXJcbiAqIGZ1bmN0aW9uIGFkZChhLCBiKSB7XG4gKiAgIHJldHVybiBhICsgYjtcbiAqIH1cbiAqXG4gKiAvLyBDcmVhdGUgYSBuZXcgZnVuY3Rpb24gdGhhdCB1c2VzIGBzcHJlYWRgIHRvIGNvbWJpbmUgYXJndW1lbnRzXG4gKiBjb25zdCBzcHJlYWRBZGQgPSBzcHJlYWQoYWRkLCAxKTtcbiAqXG4gKiAvLyBDYWxsaW5nIGBzcHJlYWRBZGRgIHdpdGggYW4gYXJyYXkgYXMgdGhlIHNlY29uZCBhcmd1bWVudFxuICogY29uc29sZS5sb2coc3ByZWFkQWRkKDEsIFsyXSkpOyAvLyBPdXRwdXQ6IDNcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gRnVuY3Rpb24gd2l0aCBkZWZhdWx0IGFyZ3VtZW50c1xuICogZnVuY3Rpb24gZ3JlZXQobmFtZSwgZ3JlZXRpbmcgPSAnSGVsbG8nKSB7XG4gKiAgIHJldHVybiBgJHtncmVldGluZ30sICR7bmFtZX0hYDtcbiAqIH1cbiAqXG4gKiAvLyBDcmVhdGUgYSBuZXcgZnVuY3Rpb24gdGhhdCB1c2VzIGBzcHJlYWRgIHRvIHBvc2l0aW9uIHRoZSBhcmd1bWVudCBhcnJheSBhdCBpbmRleCAwXG4gKiBjb25zdCBzcHJlYWRHcmVldCA9IHNwcmVhZChncmVldCwgMCk7XG4gKlxuICogLy8gQ2FsbGluZyBgc3ByZWFkR3JlZXRgIHdpdGggYW4gYXJyYXkgb2YgYXJndW1lbnRzXG4gKiBjb25zb2xlLmxvZyhzcHJlYWRHcmVldChbJ0FsaWNlJ10pKTsgLy8gT3V0cHV0OiBIZWxsbywgQWxpY2UhXG4gKiBjb25zb2xlLmxvZyhzcHJlYWRHcmVldChbJ0JvYicsICdIaSddKSk7IC8vIE91dHB1dDogSGksIEJvYiFcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNwcmVhZDxGIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+KGZ1bmM6IEYsIGFyZ3NJbmRleCA9IDApOiAoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8Rj4ge1xuICBhcmdzSW5kZXggPSBOdW1iZXIucGFyc2VJbnQoYXJnc0luZGV4IGFzIGFueSwgMTApO1xuXG4gIGlmIChOdW1iZXIuaXNOYU4oYXJnc0luZGV4KSB8fCBhcmdzSW5kZXggPCAwKSB7XG4gICAgYXJnc0luZGV4ID0gMDtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAodGhpczogYW55LCAuLi5hcmdzOiBhbnlbXSkge1xuICAgIGNvbnN0IGFycmF5ID0gYXJnc1thcmdzSW5kZXhdO1xuICAgIGNvbnN0IHBhcmFtcyA9IGFyZ3Muc2xpY2UoMCwgYXJnc0luZGV4KTtcblxuICAgIGlmIChhcnJheSkge1xuICAgICAgcGFyYW1zLnB1c2goLi4uYXJyYXkpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EyQ0MsR0FDRCxPQUFPLFNBQVMsT0FBMEMsSUFBTyxFQUFFLFlBQVksQ0FBQztFQUM5RSxZQUFZLE9BQU8sUUFBUSxDQUFDLFdBQWtCO0VBRTlDLElBQUksT0FBTyxLQUFLLENBQUMsY0FBYyxZQUFZLEdBQUc7SUFDNUMsWUFBWTtFQUNkO0VBRUEsT0FBTyxTQUFxQixHQUFHLElBQVc7SUFDeEMsTUFBTSxRQUFRLElBQUksQ0FBQyxVQUFVO0lBQzdCLE1BQU0sU0FBUyxLQUFLLEtBQUssQ0FBQyxHQUFHO0lBRTdCLElBQUksT0FBTztNQUNULE9BQU8sSUFBSSxJQUFJO0lBQ2pCO0lBRUEsT0FBTyxLQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUU7RUFDMUI7QUFDRiJ9
// denoCacheMetadata=11928927980451237090,8389950947281209634