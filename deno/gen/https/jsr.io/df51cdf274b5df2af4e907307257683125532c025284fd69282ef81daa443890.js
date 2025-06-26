import { toString } from '../util/toString.ts';
/**
 * Pads the start of a string with a given character until it reaches the specified length.
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
 * const result1 = padStart('abc', 6);          // result will be '   abc'
 * const result2 = padStart('abc', 6, '_-');    // result will be '_-_abc'
 * const result3 = padStart('abc', 3);          // result will be 'abc'
 * const result4 = padStart('abc', 2);          // result will be 'abc'
 */ export function padStart(str, length = 0, chars = ' ') {
  return toString(str).padStart(length, chars);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3BhZFN0YXJ0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRvU3RyaW5nIH0gZnJvbSAnLi4vdXRpbC90b1N0cmluZy50cyc7XG5cbi8qKlxuICogUGFkcyB0aGUgc3RhcnQgb2YgYSBzdHJpbmcgd2l0aCBhIGdpdmVuIGNoYXJhY3RlciB1bnRpbCBpdCByZWFjaGVzIHRoZSBzcGVjaWZpZWQgbGVuZ3RoLlxuICpcbiAqIElmIHRoZSBsZW5ndGggaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHRoZSBvcmlnaW5hbCBzdHJpbmcncyBsZW5ndGgsIG9yIGlmIHRoZSBwYWRkaW5nIGNoYXJhY3RlciBpcyBhbiBlbXB0eSBzdHJpbmcsXG4gKiB0aGUgb3JpZ2luYWwgc3RyaW5nIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0byBwYWQuXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aF0gLSBUaGUgbGVuZ3RoIG9mIHRoZSByZXN1bHRpbmcgc3RyaW5nIG9uY2UgcGFkZGVkLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjaGFyc10gLSBUaGUgY2hhcmFjdGVyKHMpIHRvIHVzZSBmb3IgcGFkZGluZy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHBhZGRlZCBzdHJpbmcsIG9yIHRoZSBvcmlnaW5hbCBzdHJpbmcgaWYgcGFkZGluZyBpcyBub3QgcmVxdWlyZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJlc3VsdDEgPSBwYWRTdGFydCgnYWJjJywgNik7ICAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICcgICBhYmMnXG4gKiBjb25zdCByZXN1bHQyID0gcGFkU3RhcnQoJ2FiYycsIDYsICdfLScpOyAgICAvLyByZXN1bHQgd2lsbCBiZSAnXy1fYWJjJ1xuICogY29uc3QgcmVzdWx0MyA9IHBhZFN0YXJ0KCdhYmMnLCAzKTsgICAgICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgJ2FiYydcbiAqIGNvbnN0IHJlc3VsdDQgPSBwYWRTdGFydCgnYWJjJywgMik7ICAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICdhYmMnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYWRTdGFydChzdHI6IHN0cmluZywgbGVuZ3RoID0gMCwgY2hhcnMgPSAnICcpOiBzdHJpbmcge1xuICByZXR1cm4gdG9TdHJpbmcoc3RyKS5wYWRTdGFydChsZW5ndGgsIGNoYXJzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsU0FBUyxHQUFXLEVBQUUsU0FBUyxDQUFDLEVBQUUsUUFBUSxHQUFHO0VBQzNELE9BQU8sU0FBUyxLQUFLLFFBQVEsQ0FBQyxRQUFRO0FBQ3hDIn0=
// denoCacheMetadata=902350622282769051,12295385150436344382