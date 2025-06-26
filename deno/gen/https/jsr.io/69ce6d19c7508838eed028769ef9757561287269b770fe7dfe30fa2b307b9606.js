import { toString } from '../util/toString.ts';
/**
 * Converts the given value to a string and transforms it to lower case.
 * The function can handle various input types by first converting them to strings.
 *
 * @param {unknown} [value=''] The value to convert.
 * @returns {string} Returns the lower cased string.
 * @example
 *
 * toLower('--FOO-BAR--');
 * // => '--foo-bar--'
 *
 * toLower(null);
 * // => ''
 *
 * toLower([1, 2, 3]);
 * // => '1,2,3'
 */ export function toLower(value) {
  return toString(value).toLowerCase();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3RvTG93ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gdmFsdWUgdG8gYSBzdHJpbmcgYW5kIHRyYW5zZm9ybXMgaXQgdG8gbG93ZXIgY2FzZS5cbiAqIFRoZSBmdW5jdGlvbiBjYW4gaGFuZGxlIHZhcmlvdXMgaW5wdXQgdHlwZXMgYnkgZmlyc3QgY29udmVydGluZyB0aGVtIHRvIHN0cmluZ3MuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSBbdmFsdWU9JyddIFRoZSB2YWx1ZSB0byBjb252ZXJ0LlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgbG93ZXIgY2FzZWQgc3RyaW5nLlxuICogQGV4YW1wbGVcbiAqXG4gKiB0b0xvd2VyKCctLUZPTy1CQVItLScpO1xuICogLy8gPT4gJy0tZm9vLWJhci0tJ1xuICpcbiAqIHRvTG93ZXIobnVsbCk7XG4gKiAvLyA9PiAnJ1xuICpcbiAqIHRvTG93ZXIoWzEsIDIsIDNdKTtcbiAqIC8vID0+ICcxLDIsMydcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvTG93ZXIodmFsdWU/OiB1bmtub3duKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRvU3RyaW5nKHZhbHVlKS50b0xvd2VyQ2FzZSgpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsUUFBUSxRQUFRLHNCQUFzQjtBQUUvQzs7Ozs7Ozs7Ozs7Ozs7OztDQWdCQyxHQUNELE9BQU8sU0FBUyxRQUFRLEtBQWU7RUFDckMsT0FBTyxTQUFTLE9BQU8sV0FBVztBQUNwQyJ9
// denoCacheMetadata=2465850835237955670,10092114846105376551