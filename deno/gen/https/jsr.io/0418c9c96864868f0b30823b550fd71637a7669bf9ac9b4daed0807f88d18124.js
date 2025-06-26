import { toNumber } from './toNumber.ts';
/**
 * Checks if value is greater than or equal to other.
 *
 * @param {unknown} value The value to compare.
 * @param {unknown} other The other value to compare.
 * @returns {boolean} Returns `true` if value is greater than or equal to other, else `false`.
 *
 * @example
 * gte(3, 1); // => true
 * gte(3, 3); // => true
 * gte(1, 3); // => false
 */ export function gte(value, other) {
  if (typeof value === 'string' && typeof other === 'string') {
    return value >= other;
  }
  return toNumber(value) >= toNumber(other);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9ndGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9OdW1iZXIgfSBmcm9tICcuL3RvTnVtYmVyLnRzJztcblxuLyoqXG4gKiBDaGVja3MgaWYgdmFsdWUgaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIG90aGVyLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcGFyYW0ge3Vua25vd259IG90aGVyIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxuICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHZhbHVlIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byBvdGhlciwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBndGUoMywgMSk7IC8vID0+IHRydWVcbiAqIGd0ZSgzLCAzKTsgLy8gPT4gdHJ1ZVxuICogZ3RlKDEsIDMpOyAvLyA9PiBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ3RlKHZhbHVlOiB1bmtub3duLCBvdGhlcjogdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB0eXBlb2Ygb3RoZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIHZhbHVlID49IG90aGVyO1xuICB9XG5cbiAgcmV0dXJuIHRvTnVtYmVyKHZhbHVlKSA+PSB0b051bWJlcihvdGhlcik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBRXpDOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLElBQUksS0FBYyxFQUFFLEtBQWM7RUFDaEQsSUFBSSxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsVUFBVTtJQUMxRCxPQUFPLFNBQVM7RUFDbEI7RUFFQSxPQUFPLFNBQVMsVUFBVSxTQUFTO0FBQ3JDIn0=
// denoCacheMetadata=10294477583425536100,16135096999151900333