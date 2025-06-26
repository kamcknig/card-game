import { toString } from '../util/toString.ts';
/**
 * Replaces the matched pattern with the replacement string.
 *
 * @param {string} target - The target string.
 * @param {string | RegExp} pattern - The pattern to match.
 * @param {string | ((substring: string, ...args: any[]) => string)} replacement - The replacement string or a function that returns the replacement string.
 * @returns {string} The new string with the matched pattern replaced.
 *
 * @example
 * replace('abcde', 'de', '123'); // 'abc123'
 * replace('abcde', /[bd]/g, '-'); // 'a-c-e'
 * replace('abcde', 'de', substring => substring.toUpperCase()); // 'abcDE'
 * replace('abcde', /[bd]/g, substring => substring.toUpperCase()); // 'aBcDe'
 */ export function replace(target = '', pattern, replacement) {
  if (arguments.length < 3) {
    return toString(target);
  }
  return toString(target).replace(pattern, replacement);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3JlcGxhY2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBSZXBsYWNlcyB0aGUgbWF0Y2hlZCBwYXR0ZXJuIHdpdGggdGhlIHJlcGxhY2VtZW50IHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGFyZ2V0IC0gVGhlIHRhcmdldCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZyB8IFJlZ0V4cH0gcGF0dGVybiAtIFRoZSBwYXR0ZXJuIHRvIG1hdGNoLlxuICogQHBhcmFtIHtzdHJpbmcgfCAoKHN1YnN0cmluZzogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSkgPT4gc3RyaW5nKX0gcmVwbGFjZW1lbnQgLSBUaGUgcmVwbGFjZW1lbnQgc3RyaW5nIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSByZXBsYWNlbWVudCBzdHJpbmcuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgbmV3IHN0cmluZyB3aXRoIHRoZSBtYXRjaGVkIHBhdHRlcm4gcmVwbGFjZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIHJlcGxhY2UoJ2FiY2RlJywgJ2RlJywgJzEyMycpOyAvLyAnYWJjMTIzJ1xuICogcmVwbGFjZSgnYWJjZGUnLCAvW2JkXS9nLCAnLScpOyAvLyAnYS1jLWUnXG4gKiByZXBsYWNlKCdhYmNkZScsICdkZScsIHN1YnN0cmluZyA9PiBzdWJzdHJpbmcudG9VcHBlckNhc2UoKSk7IC8vICdhYmNERSdcbiAqIHJlcGxhY2UoJ2FiY2RlJywgL1tiZF0vZywgc3Vic3RyaW5nID0+IHN1YnN0cmluZy50b1VwcGVyQ2FzZSgpKTsgLy8gJ2FCY0RlJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVwbGFjZShcbiAgdGFyZ2V0ID0gJycsXG4gIHBhdHRlcm46IHN0cmluZyB8IFJlZ0V4cCxcbiAgcmVwbGFjZW1lbnQ6IHN0cmluZyB8ICgoc3Vic3RyaW5nOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKSA9PiBzdHJpbmcpXG4pOiBzdHJpbmcge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcodGFyZ2V0KTtcbiAgfVxuXG4gIHJldHVybiB0b1N0cmluZyh0YXJnZXQpLnJlcGxhY2UocGF0dGVybiwgcmVwbGFjZW1lbnQgYXMgYW55KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLFFBQVEsUUFBUSxzQkFBc0I7QUFFL0M7Ozs7Ozs7Ozs7Ozs7Q0FhQyxHQUNELE9BQU8sU0FBUyxRQUNkLFNBQVMsRUFBRSxFQUNYLE9BQXdCLEVBQ3hCLFdBQXFFO0VBRXJFLElBQUksVUFBVSxNQUFNLEdBQUcsR0FBRztJQUN4QixPQUFPLFNBQVM7RUFDbEI7RUFFQSxPQUFPLFNBQVMsUUFBUSxPQUFPLENBQUMsU0FBUztBQUMzQyJ9
// denoCacheMetadata=2047258361078753873,13917499201269926407