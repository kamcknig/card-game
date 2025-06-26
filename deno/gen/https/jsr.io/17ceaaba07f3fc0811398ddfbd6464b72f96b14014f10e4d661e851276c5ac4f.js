import { ary } from './ary.ts';
/**
 * Creates a function that accepts up to one argument, ignoring any additional arguments.
 *
 * @template F - The type of the function.
 * @param {F} func - The function to cap arguments for.
 * @returns {(...args: any[]) => ReturnType<F>} Returns the new capped function.
 *
 * @example
 * function fn(a, b, c) {
 *   console.log(arguments);
 * }
 *
 * unary(fn)(1, 2, 3); // [Arguments] { '0': 1 }
 */ export function unary(func) {
  return ary(func, 1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9mdW5jdGlvbi91bmFyeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBhcnkgfSBmcm9tICcuL2FyeS50cyc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgYWNjZXB0cyB1cCB0byBvbmUgYXJndW1lbnQsIGlnbm9yaW5nIGFueSBhZGRpdGlvbmFsIGFyZ3VtZW50cy5cbiAqXG4gKiBAdGVtcGxhdGUgRiAtIFRoZSB0eXBlIG9mIHRoZSBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7Rn0gZnVuYyAtIFRoZSBmdW5jdGlvbiB0byBjYXAgYXJndW1lbnRzIGZvci5cbiAqIEByZXR1cm5zIHsoLi4uYXJnczogYW55W10pID0+IFJldHVyblR5cGU8Rj59IFJldHVybnMgdGhlIG5ldyBjYXBwZWQgZnVuY3Rpb24uXG4gKlxuICogQGV4YW1wbGVcbiAqIGZ1bmN0aW9uIGZuKGEsIGIsIGMpIHtcbiAqICAgY29uc29sZS5sb2coYXJndW1lbnRzKTtcbiAqIH1cbiAqXG4gKiB1bmFyeShmbikoMSwgMiwgMyk7IC8vIFtBcmd1bWVudHNdIHsgJzAnOiAxIH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuYXJ5PEYgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oZnVuYzogRik6ICguLi5hcmdzOiBhbnlbXSkgPT4gUmV0dXJuVHlwZTxGPiB7XG4gIHJldHVybiBhcnkoZnVuYywgMSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxHQUFHLFFBQVEsV0FBVztBQUUvQjs7Ozs7Ozs7Ozs7OztDQWFDLEdBQ0QsT0FBTyxTQUFTLE1BQXlDLElBQU87RUFDOUQsT0FBTyxJQUFJLE1BQU07QUFDbkIifQ==
// denoCacheMetadata=16502099537386925027,17366228402135145611