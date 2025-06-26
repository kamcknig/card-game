import { toNumber } from './toNumber.ts';
/**
 * Checks if value is greater than other.
 *
 * @param {unknown} value The value to compare.
 * @param {unknown} other The other value to compare.
 * @returns {boolean} Returns `true` if value is greater than other, else `false`.
 *
 * @example
 * gt(3, 1); // true
 * gt(3, 3); // false
 * gt(1, 3); // false
 */ export function gt(value, other) {
  if (typeof value === 'string' && typeof other === 'string') {
    return value > other;
  }
  return toNumber(value) > toNumber(other);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvdXRpbC9ndC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b051bWJlciB9IGZyb20gJy4vdG9OdW1iZXIudHMnO1xuXG4vKipcbiAqIENoZWNrcyBpZiB2YWx1ZSBpcyBncmVhdGVyIHRoYW4gb3RoZXIuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY29tcGFyZS5cbiAqIEBwYXJhbSB7dW5rbm93bn0gb3RoZXIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdmFsdWUgaXMgZ3JlYXRlciB0aGFuIG90aGVyLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGd0KDMsIDEpOyAvLyB0cnVlXG4gKiBndCgzLCAzKTsgLy8gZmFsc2VcbiAqIGd0KDEsIDMpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ3QodmFsdWU6IHVua25vd24sIG90aGVyOiB1bmtub3duKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBvdGhlciA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWUgPiBvdGhlcjtcbiAgfVxuXG4gIHJldHVybiB0b051bWJlcih2YWx1ZSkgPiB0b051bWJlcihvdGhlcik7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBRXpDOzs7Ozs7Ozs7OztDQVdDLEdBQ0QsT0FBTyxTQUFTLEdBQUcsS0FBYyxFQUFFLEtBQWM7RUFDL0MsSUFBSSxPQUFPLFVBQVUsWUFBWSxPQUFPLFVBQVUsVUFBVTtJQUMxRCxPQUFPLFFBQVE7RUFDakI7RUFFQSxPQUFPLFNBQVMsU0FBUyxTQUFTO0FBQ3BDIn0=
// denoCacheMetadata=6754213147758472685,5055638917754344927