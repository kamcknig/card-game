/**
 * Rounds a number to a specified precision.
 *
 * This function takes a number and an optional precision value, and returns the number rounded
 * to the specified number of decimal places.
 *
 * @param {number} value - The number to round.
 * @param {number} [precision=0] - The number of decimal places to round to. Defaults to 0.
 * @returns {number} The rounded number.
 * @throws {Error} Throws an error if `Precision` is not integer.
 *
 * @example
 * const result1 = round(1.2345); // result1 will be 1
 * const result2 = round(1.2345, 2); // result2 will be 1.23
 * const result3 = round(1.2345, 3); // result3 will be 1.235
 * const result4 = round(1.2345, 3.1); // This will throw an error
 */ export function round(value, precision = 0) {
  if (!Number.isInteger(precision)) {
    throw new Error('Precision must be an integer.');
  }
  const multiplier = Math.pow(10, precision);
  return Math.round(value * multiplier) / multiplier;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9tYXRoL3JvdW5kLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUm91bmRzIGEgbnVtYmVyIHRvIGEgc3BlY2lmaWVkIHByZWNpc2lvbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRha2VzIGEgbnVtYmVyIGFuZCBhbiBvcHRpb25hbCBwcmVjaXNpb24gdmFsdWUsIGFuZCByZXR1cm5zIHRoZSBudW1iZXIgcm91bmRlZFxuICogdG8gdGhlIHNwZWNpZmllZCBudW1iZXIgb2YgZGVjaW1hbCBwbGFjZXMuXG4gKlxuICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIG51bWJlciB0byByb3VuZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbcHJlY2lzaW9uPTBdIC0gVGhlIG51bWJlciBvZiBkZWNpbWFsIHBsYWNlcyB0byByb3VuZCB0by4gRGVmYXVsdHMgdG8gMC5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSByb3VuZGVkIG51bWJlci5cbiAqIEB0aHJvd3Mge0Vycm9yfSBUaHJvd3MgYW4gZXJyb3IgaWYgYFByZWNpc2lvbmAgaXMgbm90IGludGVnZXIuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJlc3VsdDEgPSByb3VuZCgxLjIzNDUpOyAvLyByZXN1bHQxIHdpbGwgYmUgMVxuICogY29uc3QgcmVzdWx0MiA9IHJvdW5kKDEuMjM0NSwgMik7IC8vIHJlc3VsdDIgd2lsbCBiZSAxLjIzXG4gKiBjb25zdCByZXN1bHQzID0gcm91bmQoMS4yMzQ1LCAzKTsgLy8gcmVzdWx0MyB3aWxsIGJlIDEuMjM1XG4gKiBjb25zdCByZXN1bHQ0ID0gcm91bmQoMS4yMzQ1LCAzLjEpOyAvLyBUaGlzIHdpbGwgdGhyb3cgYW4gZXJyb3JcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJvdW5kKHZhbHVlOiBudW1iZXIsIHByZWNpc2lvbiA9IDApOiBudW1iZXIge1xuICBpZiAoIU51bWJlci5pc0ludGVnZXIocHJlY2lzaW9uKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignUHJlY2lzaW9uIG11c3QgYmUgYW4gaW50ZWdlci4nKTtcbiAgfVxuICBjb25zdCBtdWx0aXBsaWVyID0gTWF0aC5wb3coMTAsIHByZWNpc2lvbik7XG4gIHJldHVybiBNYXRoLnJvdW5kKHZhbHVlICogbXVsdGlwbGllcikgLyBtdWx0aXBsaWVyO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLE1BQU0sS0FBYSxFQUFFLFlBQVksQ0FBQztFQUNoRCxJQUFJLENBQUMsT0FBTyxTQUFTLENBQUMsWUFBWTtJQUNoQyxNQUFNLElBQUksTUFBTTtFQUNsQjtFQUNBLE1BQU0sYUFBYSxLQUFLLEdBQUcsQ0FBQyxJQUFJO0VBQ2hDLE9BQU8sS0FBSyxLQUFLLENBQUMsUUFBUSxjQUFjO0FBQzFDIn0=
// denoCacheMetadata=11756836933675278118,2324663844870410460