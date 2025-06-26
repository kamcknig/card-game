import { isSymbol } from '../predicate/isSymbol.ts';
/**
 * Converts `value` to a number.
 *
 * Unlike `Number()`, this function returns `NaN` for symbols.
 *
 * @param {unknown} value - The value to convert.
 * @returns {number} Returns the number.
 *
 * @example
 * toNumber(3.2); // => 3.2
 * toNumber(Number.MIN_VALUE); // => 5e-324
 * toNumber(Infinity); // => Infinity
 * toNumber('3.2'); // => 3.2
 * toNumber(Symbol.iterator); // => NaN
 * toNumber(NaN); // => NaN
 */ export function toNumber(value) {
  if (isSymbol(value)) {
    return NaN;
  }
  return Number(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC90b051bWJlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBpc1N5bWJvbCB9IGZyb20gJy4uL3ByZWRpY2F0ZS9pc1N5bWJvbC50cyc7XG5cbi8qKlxuICogQ29udmVydHMgYHZhbHVlYCB0byBhIG51bWJlci5cbiAqXG4gKiBVbmxpa2UgYE51bWJlcigpYCwgdGhpcyBmdW5jdGlvbiByZXR1cm5zIGBOYU5gIGZvciBzeW1ib2xzLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIG51bWJlci5cbiAqXG4gKiBAZXhhbXBsZVxuICogdG9OdW1iZXIoMy4yKTsgLy8gPT4gMy4yXG4gKiB0b051bWJlcihOdW1iZXIuTUlOX1ZBTFVFKTsgLy8gPT4gNWUtMzI0XG4gKiB0b051bWJlcihJbmZpbml0eSk7IC8vID0+IEluZmluaXR5XG4gKiB0b051bWJlcignMy4yJyk7IC8vID0+IDMuMlxuICogdG9OdW1iZXIoU3ltYm9sLml0ZXJhdG9yKTsgLy8gPT4gTmFOXG4gKiB0b051bWJlcihOYU4pOyAvLyA9PiBOYU5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvTnVtYmVyKHZhbHVlPzogdW5rbm93bik6IG51bWJlciB7XG4gIGlmIChpc1N5bWJvbCh2YWx1ZSkpIHtcbiAgICByZXR1cm4gTmFOO1xuICB9XG5cbiAgcmV0dXJuIE51bWJlcih2YWx1ZSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsMkJBQTJCO0FBRXBEOzs7Ozs7Ozs7Ozs7Ozs7Q0FlQyxHQUNELE9BQU8sU0FBUyxTQUFTLEtBQWU7RUFDdEMsSUFBSSxTQUFTLFFBQVE7SUFDbkIsT0FBTztFQUNUO0VBRUEsT0FBTyxPQUFPO0FBQ2hCIn0=
// denoCacheMetadata=3772372976356201868,5541312218309953269