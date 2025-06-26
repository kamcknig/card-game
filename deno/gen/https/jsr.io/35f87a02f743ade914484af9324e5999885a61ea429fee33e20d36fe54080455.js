/**
 * Regular expression pattern to split strings into words for various case conversions
 *
 * This pattern matches sequences of characters in a string, considering the following cases:
 * - Sequences of two or more uppercase letters followed by an uppercase letter and lowercase letters or digits (for acronyms)
 * - Sequences of one uppercase letter optionally followed by lowercase letters and digits
 * - Single uppercase letters
 * - Sequences of digits
 * - Emojis and other Unicode characters
 *
 * The resulting match can be used to convert camelCase, snake_case, kebab-case, and other mixed formats into
 * a consistent format like snake case. It also supports emojis and other Unicode characters.
 *
 * @example
 * const matches = 'camelCaseHTTPRequest🚀'.match(CASE_SPLIT_PATTERN);
 * // matches: ['camel', 'Case', 'HTTP', 'Request', '🚀']
 */ export const CASE_SPLIT_PATTERN = /\p{Lu}?\p{Ll}+|[0-9]+|\p{Lu}+(?!\p{Ll})|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{L}+/gu;
/**
 * Splits `string` into an array of its words, treating spaces and punctuation marks as separators.
 *
 * @param {string} str The string to inspect.
 * @param {RegExp | string} [pattern] The pattern to match words.
 * @returns {string[]} Returns the words of `string`.
 *
 * @example
 * words('fred, barney, & pebbles');
 * // => ['fred', 'barney', 'pebbles']
 *
 * words('camelCaseHTTPRequest🚀');
 * // => ['camel', 'Case', 'HTTP', 'Request', '🚀']
 *
 * words('Lunedì 18 Set')
 * // => ['Lunedì', '18', 'Set']
 */ export function words(str) {
  return Array.from(str.match(CASE_SPLIT_PATTERN) ?? []);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9zdHJpbmcvd29yZHMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZWd1bGFyIGV4cHJlc3Npb24gcGF0dGVybiB0byBzcGxpdCBzdHJpbmdzIGludG8gd29yZHMgZm9yIHZhcmlvdXMgY2FzZSBjb252ZXJzaW9uc1xuICpcbiAqIFRoaXMgcGF0dGVybiBtYXRjaGVzIHNlcXVlbmNlcyBvZiBjaGFyYWN0ZXJzIGluIGEgc3RyaW5nLCBjb25zaWRlcmluZyB0aGUgZm9sbG93aW5nIGNhc2VzOlxuICogLSBTZXF1ZW5jZXMgb2YgdHdvIG9yIG1vcmUgdXBwZXJjYXNlIGxldHRlcnMgZm9sbG93ZWQgYnkgYW4gdXBwZXJjYXNlIGxldHRlciBhbmQgbG93ZXJjYXNlIGxldHRlcnMgb3IgZGlnaXRzIChmb3IgYWNyb255bXMpXG4gKiAtIFNlcXVlbmNlcyBvZiBvbmUgdXBwZXJjYXNlIGxldHRlciBvcHRpb25hbGx5IGZvbGxvd2VkIGJ5IGxvd2VyY2FzZSBsZXR0ZXJzIGFuZCBkaWdpdHNcbiAqIC0gU2luZ2xlIHVwcGVyY2FzZSBsZXR0ZXJzXG4gKiAtIFNlcXVlbmNlcyBvZiBkaWdpdHNcbiAqIC0gRW1vamlzIGFuZCBvdGhlciBVbmljb2RlIGNoYXJhY3RlcnNcbiAqXG4gKiBUaGUgcmVzdWx0aW5nIG1hdGNoIGNhbiBiZSB1c2VkIHRvIGNvbnZlcnQgY2FtZWxDYXNlLCBzbmFrZV9jYXNlLCBrZWJhYi1jYXNlLCBhbmQgb3RoZXIgbWl4ZWQgZm9ybWF0cyBpbnRvXG4gKiBhIGNvbnNpc3RlbnQgZm9ybWF0IGxpa2Ugc25ha2UgY2FzZS4gSXQgYWxzbyBzdXBwb3J0cyBlbW9qaXMgYW5kIG90aGVyIFVuaWNvZGUgY2hhcmFjdGVycy5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgbWF0Y2hlcyA9ICdjYW1lbENhc2VIVFRQUmVxdWVzdPCfmoAnLm1hdGNoKENBU0VfU1BMSVRfUEFUVEVSTik7XG4gKiAvLyBtYXRjaGVzOiBbJ2NhbWVsJywgJ0Nhc2UnLCAnSFRUUCcsICdSZXF1ZXN0JywgJ/CfmoAnXVxuICovXG5leHBvcnQgY29uc3QgQ0FTRV9TUExJVF9QQVRURVJOID1cbiAgL1xccHtMdX0/XFxwe0xsfSt8WzAtOV0rfFxccHtMdX0rKD8hXFxwe0xsfSl8XFxwe0Vtb2ppX1ByZXNlbnRhdGlvbn18XFxwe0V4dGVuZGVkX1BpY3RvZ3JhcGhpY318XFxwe0x9Ky9ndTtcblxuLyoqXG4gKiBTcGxpdHMgYHN0cmluZ2AgaW50byBhbiBhcnJheSBvZiBpdHMgd29yZHMsIHRyZWF0aW5nIHNwYWNlcyBhbmQgcHVuY3R1YXRpb24gbWFya3MgYXMgc2VwYXJhdG9ycy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc3RyIFRoZSBzdHJpbmcgdG8gaW5zcGVjdC5cbiAqIEBwYXJhbSB7UmVnRXhwIHwgc3RyaW5nfSBbcGF0dGVybl0gVGhlIHBhdHRlcm4gdG8gbWF0Y2ggd29yZHMuXG4gKiBAcmV0dXJucyB7c3RyaW5nW119IFJldHVybnMgdGhlIHdvcmRzIG9mIGBzdHJpbmdgLlxuICpcbiAqIEBleGFtcGxlXG4gKiB3b3JkcygnZnJlZCwgYmFybmV5LCAmIHBlYmJsZXMnKTtcbiAqIC8vID0+IFsnZnJlZCcsICdiYXJuZXknLCAncGViYmxlcyddXG4gKlxuICogd29yZHMoJ2NhbWVsQ2FzZUhUVFBSZXF1ZXN08J+agCcpO1xuICogLy8gPT4gWydjYW1lbCcsICdDYXNlJywgJ0hUVFAnLCAnUmVxdWVzdCcsICfwn5qAJ11cbiAqXG4gKiB3b3JkcygnTHVuZWTDrCAxOCBTZXQnKVxuICogLy8gPT4gWydMdW5lZMOsJywgJzE4JywgJ1NldCddXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3b3JkcyhzdHI6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgcmV0dXJuIEFycmF5LmZyb20oc3RyLm1hdGNoKENBU0VfU1BMSVRfUEFUVEVSTikgPz8gW10pO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxNQUFNLHFCQUNYLG9HQUFvRztBQUV0Rzs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxNQUFNLEdBQVc7RUFDL0IsT0FBTyxNQUFNLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRTtBQUN2RCJ9
// denoCacheMetadata=6145328612840117402,2648914933937863439