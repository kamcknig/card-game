import { pad as padToolkit } from '../../string/pad.ts';
import { toString } from '../util/toString.ts';
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
  return padToolkit(toString(str), length, chars);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3BhZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYWQgYXMgcGFkVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy9wYWQudHMnO1xuaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBQYWRzIHN0cmluZyBvbiB0aGUgbGVmdCBhbmQgcmlnaHQgc2lkZXMgaWYgaXQncyBzaG9ydGVyIHRoYW4gbGVuZ3RoLiBQYWRkaW5nIGNoYXJhY3RlcnMgYXJlIHRydW5jYXRlZCBpZiB0aGV5IGNhbid0IGJlIGV2ZW5seSBkaXZpZGVkIGJ5IGxlbmd0aC5cbiAqIElmIHRoZSBsZW5ndGggaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHRoZSBvcmlnaW5hbCBzdHJpbmcncyBsZW5ndGgsIG9yIGlmIHRoZSBwYWRkaW5nIGNoYXJhY3RlciBpcyBhbiBlbXB0eSBzdHJpbmcsIHRoZSBvcmlnaW5hbCBzdHJpbmcgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgLSBUaGUgc3RyaW5nIHRvIHBhZC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbbGVuZ3RoXSAtIFRoZSBsZW5ndGggb2YgdGhlIHJlc3VsdGluZyBzdHJpbmcgb25jZSBwYWRkZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gW2NoYXJzXSAtIFRoZSBjaGFyYWN0ZXIocykgdG8gdXNlIGZvciBwYWRkaW5nLlxuICogQHJldHVybnMge3N0cmluZ30gLSBUaGUgcGFkZGVkIHN0cmluZywgb3IgdGhlIG9yaWdpbmFsIHN0cmluZyBpZiBwYWRkaW5nIGlzIG5vdCByZXF1aXJlZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgcmVzdWx0MSA9IHBhZCgnYWJjJywgOCk7ICAgICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgJyAgYWJjICAgJ1xuICogY29uc3QgcmVzdWx0MiA9IHBhZCgnYWJjJywgOCwgJ18tJyk7ICAgLy8gcmVzdWx0IHdpbGwgYmUgJ18tYWJjXy1fJ1xuICogY29uc3QgcmVzdWx0MyA9IHBhZCgnYWJjJywgMyk7ICAgICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgJ2FiYydcbiAqIGNvbnN0IHJlc3VsdDQgPSBwYWQoJ2FiYycsIDIpOyAgICAgICAgIC8vIHJlc3VsdCB3aWxsIGJlICdhYmMnXG4gKlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFkKHN0cjogc3RyaW5nLCBsZW5ndGg6IG51bWJlciwgY2hhcnMgPSAnICcpOiBzdHJpbmcge1xuICByZXR1cm4gcGFkVG9vbGtpdCh0b1N0cmluZyhzdHIpLCBsZW5ndGgsIGNoYXJzKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE9BQU8sVUFBVSxRQUFRLHNCQUFzQjtBQUN4RCxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7Ozs7OztDQWVDLEdBQ0QsT0FBTyxTQUFTLElBQUksR0FBVyxFQUFFLE1BQWMsRUFBRSxRQUFRLEdBQUc7RUFDMUQsT0FBTyxXQUFXLFNBQVMsTUFBTSxRQUFRO0FBQzNDIn0=
// denoCacheMetadata=3430163066308837213,11919500018797073493