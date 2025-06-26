/**
 * Asserts that a given condition is true. If the condition is false, an error is thrown with the provided message.
 *
 * @param {unknown} condition - The condition to evaluate.
 * @param {string} [message] - The error message to throw if the condition is false.
 * @returns {void} Returns void if the condition is true.
 * @throws {Error} Throws an error if the condition is false.
 *
 * @example
 * // This call will succeed without any errors
 * invariant(true, 'This should not throw');
 *
 * // This call will fail and throw an error with the message 'This should throw'
 * invariant(false, 'This should throw');
 *
 * // Example of using invariant with a condition
 * invariant(condition, 'Expected condition is false');
 *
 * // Ensure that the value is neither null nor undefined
 * invariant(value !== null && value !== undefined, 'Value should not be null or undefined');
 *
 * // Example of using invariant to check if a number is positive
 * invariant(number > 0, 'Number must be positive');
 */ export function invariant(condition, message) {
  if (condition) {
    return;
  }
  throw new Error(message);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy91dGlsL2ludmFyaWFudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFzc2VydHMgdGhhdCBhIGdpdmVuIGNvbmRpdGlvbiBpcyB0cnVlLiBJZiB0aGUgY29uZGl0aW9uIGlzIGZhbHNlLCBhbiBlcnJvciBpcyB0aHJvd24gd2l0aCB0aGUgcHJvdmlkZWQgbWVzc2FnZS5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IGNvbmRpdGlvbiAtIFRoZSBjb25kaXRpb24gdG8gZXZhbHVhdGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gW21lc3NhZ2VdIC0gVGhlIGVycm9yIG1lc3NhZ2UgdG8gdGhyb3cgaWYgdGhlIGNvbmRpdGlvbiBpcyBmYWxzZS5cbiAqIEByZXR1cm5zIHt2b2lkfSBSZXR1cm5zIHZvaWQgaWYgdGhlIGNvbmRpdGlvbiBpcyB0cnVlLlxuICogQHRocm93cyB7RXJyb3J9IFRocm93cyBhbiBlcnJvciBpZiB0aGUgY29uZGl0aW9uIGlzIGZhbHNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBUaGlzIGNhbGwgd2lsbCBzdWNjZWVkIHdpdGhvdXQgYW55IGVycm9yc1xuICogaW52YXJpYW50KHRydWUsICdUaGlzIHNob3VsZCBub3QgdGhyb3cnKTtcbiAqXG4gKiAvLyBUaGlzIGNhbGwgd2lsbCBmYWlsIGFuZCB0aHJvdyBhbiBlcnJvciB3aXRoIHRoZSBtZXNzYWdlICdUaGlzIHNob3VsZCB0aHJvdydcbiAqIGludmFyaWFudChmYWxzZSwgJ1RoaXMgc2hvdWxkIHRocm93Jyk7XG4gKlxuICogLy8gRXhhbXBsZSBvZiB1c2luZyBpbnZhcmlhbnQgd2l0aCBhIGNvbmRpdGlvblxuICogaW52YXJpYW50KGNvbmRpdGlvbiwgJ0V4cGVjdGVkIGNvbmRpdGlvbiBpcyBmYWxzZScpO1xuICpcbiAqIC8vIEVuc3VyZSB0aGF0IHRoZSB2YWx1ZSBpcyBuZWl0aGVyIG51bGwgbm9yIHVuZGVmaW5lZFxuICogaW52YXJpYW50KHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB1bmRlZmluZWQsICdWYWx1ZSBzaG91bGQgbm90IGJlIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gKlxuICogLy8gRXhhbXBsZSBvZiB1c2luZyBpbnZhcmlhbnQgdG8gY2hlY2sgaWYgYSBudW1iZXIgaXMgcG9zaXRpdmVcbiAqIGludmFyaWFudChudW1iZXIgPiAwLCAnTnVtYmVyIG11c3QgYmUgcG9zaXRpdmUnKTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGludmFyaWFudChjb25kaXRpb246IHVua25vd24sIG1lc3NhZ2U6IHN0cmluZyk6IGFzc2VydHMgY29uZGl0aW9uIHtcbiAgaWYgKGNvbmRpdGlvbikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0F1QkMsR0FDRCxPQUFPLFNBQVMsVUFBVSxTQUFrQixFQUFFLE9BQWU7RUFDM0QsSUFBSSxXQUFXO0lBQ2I7RUFDRjtFQUVBLE1BQU0sSUFBSSxNQUFNO0FBQ2xCIn0=
// denoCacheMetadata=2618150423788527880,5518000553027691660