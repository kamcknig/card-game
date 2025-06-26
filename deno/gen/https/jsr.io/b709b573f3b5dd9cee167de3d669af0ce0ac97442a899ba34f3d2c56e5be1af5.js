import { toNumber } from './toNumber.ts';
/**
 * Checks if value is less than other.
 *
 * @param {unknown} value The value to compare.
 * @param {unknown} other The other value to compare.
 * @returns {boolean} Returns `true` if value is less than other, else `false`.
 *
 * @example
 * lt(1, 3); // true
 * lt(3, 3); // false
 * lt(3, 1); // false
 */ export function lt(value, other) {
  if (typeof value === 'string' && typeof other === 'string') {
    return value < other;
  }
  return toNumber(value) < toNumber(other);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9sdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b051bWJlciB9IGZyb20gJy4vdG9OdW1iZXIudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiB2YWx1ZSBpcyBsZXNzIHRoYW4gb3RoZXIuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7dW5rbm93bn0gb3RoZXIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdmFsdWUgaXMgbGVzcyB0aGFuIG90aGVyLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGx0KDEsIDMpOyAvLyB0cnVlXG4gKiBsdCgzLCAzKTsgLy8gZmFsc2VcbiAqIGx0KDMsIDEpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gbHQodmFsdWU6IHVua25vd24sIG90aGVyOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBvdGhlciA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWUgPCBvdGhlcjtcbiAgfVxuXG4gIHJldHVybiB0b051bWJlcih2YWx1ZSkgPCB0b051bWJlcihvdGhlcik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBRXpDOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLEdBQUcsS0FBYyxFQUFFLEtBQWM7RUFDL0MsSUFBSSxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsVUFBVTtJQUMxRCxPQUFPLFFBQVE7RUFDakI7RUFFQSxPQUFPLFNBQVMsU0FBUyxTQUFTO0FBQ3BDIn0=
// denoCacheMetadata=2340248079432885025,8057351263270122270