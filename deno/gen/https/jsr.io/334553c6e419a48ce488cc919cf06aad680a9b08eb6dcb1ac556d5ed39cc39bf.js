import { decimalAdjust } from '../_internal/decimalAdjust.ts';
/**
 * Computes number rounded to precision.
 *
 * @param {number | string} number  The number to round.
 * @param {number | string} precision The precision to round to.
 * @returns {number} Returns the rounded number.
 *
 * @example
 * round(4.006); // => 4
 * round(4.006, 2); // => 4.01
 * round(4060, -2); // => 4100
 */ export function round(number, precision = 0) {
  return decimalAdjust('round', number, precision);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9yb3VuZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWNpbWFsQWRqdXN0IH0gZnJvbSAnLi4vX2ludGVybmFsL2RlY2ltYWxBZGp1c3QudHMnO1xuXG4vKipcbiAqIENvbXB1dGVzIG51bWJlciByb3VuZGVkIHRvIHByZWNpc2lvbi5cbiAqXG4gKiBAcGFyYW0ge251bWJlciB8IHN0cmluZ30gbnVtYmVyICBUaGUgbnVtYmVyIHRvIHJvdW5kLlxuICogQHBhcmFtIHtudW1iZXIgfCBzdHJpbmd9IHByZWNpc2lvbiBUaGUgcHJlY2lzaW9uIHRvIHJvdW5kIHRvLlxuICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgcm91bmRlZCBudW1iZXIuXG4gKlxuICogQGV4YW1wbGVcbiAqIHJvdW5kKDQuMDA2KTsgLy8gPT4gNFxuICogcm91bmQoNC4wMDYsIDIpOyAvLyA9PiA0LjAxXG4gKiByb3VuZCg0MDYwLCAtMik7IC8vID0+IDQxMDBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJvdW5kKG51bWJlcjogbnVtYmVyIHwgc3RyaW5nLCBwcmVjaXNpb246IG51bWJlciB8IHN0cmluZyA9IDApOiBudW1iZXIge1xuICByZXR1cm4gZGVjaW1hbEFkanVzdCgncm91bmQnLCBudW1iZXIsIHByZWNpc2lvbik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxhQUFhLFFBQVEsZ0NBQWdDO0FBRTlEOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLE1BQU0sTUFBdUIsRUFBRSxZQUE2QixDQUFDO0VBQzNFLE9BQU8sY0FBYyxTQUFTLFFBQVE7QUFDeEMifQ==
// denoCacheMetadata=17846131994508229129,1539206464999969751