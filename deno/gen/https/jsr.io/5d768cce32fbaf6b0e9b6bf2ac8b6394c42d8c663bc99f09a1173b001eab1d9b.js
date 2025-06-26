import { toString } from '../util/toString.ts';
/**
 * Pads the end of a string with a given character until it reaches the specified length.
 *
 * If the length is less than or equal to the original string's length, or if the padding character is an empty string,
 * the original string is returned unchanged.
 *
 * @param {string} str - The string to pad.
 * @param {number} [length] - The length of the resulting string once padded.
 * @param {string} [chars] - The character(s) to use for padding.
 * @returns {string} - The padded string, or the original string if padding is not required.
 *
 * @example
 * const result1 = padEnd('abc', 6);          // result will be 'abc   '
 * const result2 = padEnd('abc', 6, '_-');    // result will be 'abc_-_'
 * const result3 = padEnd('abc', 3);          // result will be 'abc'
 * const result4 = padEnd('abc', 2);          // result will be 'abc'
 */ export function padEnd(str, length = 0, chars = ' ') {
  return toString(str).padEnd(length, chars);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3BhZEVuZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b1N0cmluZyB9IGZyb20gJy4uL3V0aWwvdG9TdHJpbmcudHMnO1xuXG4vKipcbiAqIFBhZHMgdGhlIGVuZCBvZiBhIHN0cmluZyB3aXRoIGEgZ2l2ZW4gY2hhcmFjdGVyIHVudGlsIGl0IHJlYWNoZXMgdGhlIHNwZWNpZmllZCBsZW5ndGguXG4gKlxuICogSWYgdGhlIGxlbmd0aCBpcyBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gdGhlIG9yaWdpbmFsIHN0cmluZydzIGxlbmd0aCwgb3IgaWYgdGhlIHBhZGRpbmcgY2hhcmFjdGVyIGlzIGFuIGVtcHR5IHN0cmluZyxcbiAqIHRoZSBvcmlnaW5hbCBzdHJpbmcgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIHRvIHBhZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoXSAtIFRoZSBsZW5ndGggb2YgdGhlIHJlc3VsdGluZyBzdHJpbmcgb25jZSBwYWRkZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gW2NoYXJzXSAtIFRoZSBjaGFyYWN0ZXIocykgdG8gdXNlIGZvciBwYWRkaW5nLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgcGFkZGVkIHN0cmluZywgb3IgdGhlIG9yaWdpbmFsIHN0cmluZyBpZiBwYWRkaW5nIGlzIG5vdCByZXF1aXJlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcmVzdWx0MSA9IHBhZEVuZCgnYWJjJywgNik7ICAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICdhYmMgICAnXG4gKiBjb25zdCByZXN1bHQyID0gcGFkRW5kKCdhYmMnLCA2LCAnXy0nKTsgICAgLy8gcmVzdWx0IHdpbGwgYmUgJ2FiY18tXydcbiAqIGNvbnN0IHJlc3VsdDMgPSBwYWRFbmQoJ2FiYycsIDMpOyAgICAgICAgICAvLyByZXN1bHQgd2lsbCBiZSAnYWJjJ1xuICogY29uc3QgcmVzdWx0NCA9IHBhZEVuZCgnYWJjJywgMik7ICAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICdhYmMnXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHBhZEVuZChzdHI6IHN0cmluZywgbGVuZ3RoID0gMCwgY2hhcnMgPSAnICcpOiBzdHJpbmcge1xuICByZXR1cm4gdG9TdHJpbmcoc3RyKS5wYWRFbmQobGVuZ3RoLCBjaGFycyk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBRUQsT0FBTyxTQUFTLE9BQU8sR0FBVyxFQUFFLFNBQVMsQ0FBQyxFQUFFLFFBQVEsR0FBRztFQUN6RCxPQUFPLFNBQVMsS0FBSyxNQUFNLENBQUMsUUFBUTtBQUN0QyJ9
// denoCacheMetadata=5292284631598407574,9558387661944912174