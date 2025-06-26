import { decimalAdjust } from '../_internal/decimalAdjust.ts';
/**
 * Computes number rounded down to precision.
 *
 * @param {number | string} number The number to round down.
 * @param {number | string} precision The precision to round down to.
 * @returns {number} Returns the rounded down number.
 *
 * @example
 * floor(4.006); // => 4
 * floor(0.046, 2); // => 0.04
 * floor(4060, -2); // => 4000
 */ export function floor(number, precision = 0) {
  return decimalAdjust('floor', number, precision);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvbWF0aC9mbG9vci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWNpbWFsQWRqdXN0IH0gZnJvbSAnLi4vX2ludGVybmFsL2RlY2ltYWxBZGp1c3QudHMnO1xuXG4vKipcbiAqIENvbXB1dGVzIG51bWJlciByb3VuZGVkIGRvd24gdG8gcHJlY2lzaW9uLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyIHwgc3RyaW5nfSBudW1iZXIgVGhlIG51bWJlciB0byByb3VuZCBkb3duLlxuICogQHBhcmFtIHtudW1iZXIgfCBzdHJpbmd9IHByZWNpc2lvbiBUaGUgcHJlY2lzaW9uIHRvIHJvdW5kIGRvd24gdG8uXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSByb3VuZGVkIGRvd24gbnVtYmVyLlxuICpcbiAqIEBleGFtcGxlXG4gKiBmbG9vcig0LjAwNik7IC8vID0+IDRcbiAqIGZsb29yKDAuMDQ2LCAyKTsgLy8gPT4gMC4wNFxuICogZmxvb3IoNDA2MCwgLTIpOyAvLyA9PiA0MDAwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmbG9vcihudW1iZXI6IG51bWJlciB8IHN0cmluZywgcHJlY2lzaW9uOiBudW1iZXIgfCBzdHJpbmcgPSAwKTogbnVtYmVyIHtcbiAgcmV0dXJuIGRlY2ltYWxBZGp1c3QoJ2Zsb29yJywgbnVtYmVyLCBwcmVjaXNpb24pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsYUFBYSxRQUFRLGdDQUFnQztBQUU5RDs7Ozs7Ozs7Ozs7Q0FXQyxHQUNELE9BQU8sU0FBUyxNQUFNLE1BQXVCLEVBQUUsWUFBNkIsQ0FBQztFQUMzRSxPQUFPLGNBQWMsU0FBUyxRQUFRO0FBQ3hDIn0=
// denoCacheMetadata=13351428289890268653,2021354812564015687