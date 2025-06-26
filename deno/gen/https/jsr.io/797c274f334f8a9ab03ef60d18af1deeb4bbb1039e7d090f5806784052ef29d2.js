/**
 * Pads string on the left and right sides if it's shorter than length. Padding characters are truncated if they can't be evenly divided by length.
 * If the length is less than or equal to the original string's length, or if the padding character is an empty string, the original string is returned unchanged.
 *
 * @param {string} str - The string to pad.
 * @param {number} [length] - The length of the resulting string once padded.
 * @param {string} [chars] - The character(s) to use for padding.
 * @returns {string} - The padded string, or the original string if padding is not required.
 *
 * @example
 * const result1 = pad('abc', 8);         // result will be '  abc   '
 * const result2 = pad('abc', 8, '_-');   // result will be '_-abc_-_'
 * const result3 = pad('abc', 3);         // result will be 'abc'
 * const result4 = pad('abc', 2);         // result will be 'abc'
 *
 */ export function pad(str, length, chars = ' ') {
  return str.padStart(Math.floor((length - str.length) / 2) + str.length, chars).padEnd(length, chars);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvcGFkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUGFkcyBzdHJpbmcgb24gdGhlIGxlZnQgYW5kIHJpZ2h0IHNpZGVzIGlmIGl0J3Mgc2hvcnRlciB0aGFuIGxlbmd0aC4gUGFkZGluZyBjaGFyYWN0ZXJzIGFyZSB0cnVuY2F0ZWQgaWYgdGhleSBjYW4ndCBiZSBldmVubHkgZGl2aWRlZCBieSBsZW5ndGguXG4gKiBJZiB0aGUgbGVuZ3RoIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0aGUgb3JpZ2luYWwgc3RyaW5nJ3MgbGVuZ3RoLCBvciBpZiB0aGUgcGFkZGluZyBjaGFyYWN0ZXIgaXMgYW4gZW1wdHkgc3RyaW5nLCB0aGUgb3JpZ2luYWwgc3RyaW5nIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIC0gVGhlIHN0cmluZyB0byBwYWQuXG4gKiBAcGFyYW0ge251bWJlcn0gW2xlbmd0aF0gLSBUaGUgbGVuZ3RoIG9mIHRoZSByZXN1bHRpbmcgc3RyaW5nIG9uY2UgcGFkZGVkLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjaGFyc10gLSBUaGUgY2hhcmFjdGVyKHMpIHRvIHVzZSBmb3IgcGFkZGluZy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IC0gVGhlIHBhZGRlZCBzdHJpbmcsIG9yIHRoZSBvcmlnaW5hbCBzdHJpbmcgaWYgcGFkZGluZyBpcyBub3QgcmVxdWlyZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJlc3VsdDEgPSBwYWQoJ2FiYycsIDgpOyAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICcgIGFiYyAgICdcbiAqIGNvbnN0IHJlc3VsdDIgPSBwYWQoJ2FiYycsIDgsICdfLScpOyAgIC8vIHJlc3VsdCB3aWxsIGJlICdfLWFiY18tXydcbiAqIGNvbnN0IHJlc3VsdDMgPSBwYWQoJ2FiYycsIDMpOyAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICdhYmMnXG4gKiBjb25zdCByZXN1bHQ0ID0gcGFkKCdhYmMnLCAyKTsgICAgICAgICAvLyByZXN1bHQgd2lsbCBiZSAnYWJjJ1xuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhZChzdHI6IHN0cmluZywgbGVuZ3RoOiBudW1iZXIsIGNoYXJzID0gJyAnKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5wYWRTdGFydChNYXRoLmZsb29yKChsZW5ndGggLSBzdHIubGVuZ3RoKSAvIDIpICsgc3RyLmxlbmd0aCwgY2hhcnMpLnBhZEVuZChsZW5ndGgsIGNoYXJzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsSUFBSSxHQUFXLEVBQUUsTUFBYyxFQUFFLFFBQVEsR0FBRztFQUMxRCxPQUFPLElBQUksUUFBUSxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsU0FBUyxJQUFJLE1BQU0sSUFBSSxLQUFLLElBQUksTUFBTSxFQUFFLE9BQU8sTUFBTSxDQUFDLFFBQVE7QUFDaEcifQ==
// denoCacheMetadata=7068953717420936687,3899238073049018029