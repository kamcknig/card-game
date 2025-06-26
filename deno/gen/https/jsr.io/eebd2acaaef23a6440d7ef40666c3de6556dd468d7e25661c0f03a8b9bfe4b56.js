import { toNumber } from './toNumber.ts';
/**
 * Checks if value is less than or equal to other.
 *
 * @param {unknown} value The value to compare.
 * @param {unknown} other The other value to compare.
 * @returns {boolean} Returns `true` if value is less than or equal to other, else `false`.
 *
 * @example
 * lte(1, 3); // => true
 * lte(3, 3); // => true
 * lte(3, 1); // => false
 */ export function lte(value, other) {
  if (typeof value === 'string' && typeof other === 'string') {
    return value <= other;
  }
  return toNumber(value) <= toNumber(other);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9sdGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICcuL3RvTnVtYmVyLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgdmFsdWUgaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIG90aGVyLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0ge3Vua25vd259IG90aGVyIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHZhbHVlIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byBvdGhlciwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBsdGUoMSwgMyk7IC8vID0+IHRydWVcbiAqIGx0ZSgzLCAzKTsgLy8gPT4gdHJ1ZVxuICogbHRlKDMsIDEpOyAvLyA9PiBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gbHRlKHZhbHVlOiB1bmtub3duLCBvdGhlcjogdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB0eXBlb2Ygb3RoZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlIDw9IG90aGVyO1xuICB9XG5cbiAgcmV0dXJuIHRvTnVtYmVyKHZhbHVlKSA8PSB0b051bWJlcihvdGhlcik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBRXpDOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLElBQUksS0FBYyxFQUFFLEtBQWM7RUFDaEQsSUFBSSxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsVUFBVTtJQUMxRCxPQUFPLFNBQVM7RUFDbEI7RUFFQSxPQUFPLFNBQVMsVUFBVSxTQUFTO0FBQ3JDIn0=
// denoCacheMetadata=1620583955727100635,5008764425572451747