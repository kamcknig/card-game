import { unescape as unescapeToolkit } from '../../string/unescape.ts';
import { toString } from '../util/toString.ts';
/**
 * Converts the HTML entities `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `str` to their corresponding characters.
 * It is the inverse of `escape`.
 *
 * @param {string} str The string to unescape.
 * @returns {string} Returns the unescaped string.
 *
 * @example
 * unescape('This is a &lt;div&gt; element.'); // returns 'This is a <div> element.'
 * unescape('This is a &quot;quote&quot;'); // returns 'This is a "quote"'
 * unescape('This is a &#39;quote&#39;'); // returns 'This is a 'quote''
 * unescape('This is a &amp; symbol'); // returns 'This is a & symbol'
 */ export function unescape(str) {
  return unescapeToolkit(toString(str));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3VuZXNjYXBlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHVuZXNjYXBlIGFzIHVuZXNjYXBlVG9vbGtpdCB9IGZyb20gJy4uLy4uL3N0cmluZy91bmVzY2FwZS50cyc7XG5pbXBvcnQgeyB0b1N0cmluZyB9IGZyb20gJy4uL3V0aWwvdG9TdHJpbmcudHMnO1xuXG4vKipcbiAqIENvbnZlcnRzIHRoZSBIVE1MIGVudGl0aWVzIGAmYW1wO2AsIGAmbHQ7YCwgYCZndDtgLCBgJnF1b3Q7YCwgYW5kIGAmIzM5O2AgaW4gYHN0cmAgdG8gdGhlaXIgY29ycmVzcG9uZGluZyBjaGFyYWN0ZXJzLlxuICogSXQgaXMgdGhlIGludmVyc2Ugb2YgYGVzY2FwZWAuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciBUaGUgc3RyaW5nIHRvIHVuZXNjYXBlLlxuICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgdW5lc2NhcGVkIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogdW5lc2NhcGUoJ1RoaXMgaXMgYSAmbHQ7ZGl2Jmd0OyBlbGVtZW50LicpOyAvLyByZXR1cm5zICdUaGlzIGlzIGEgPGRpdj4gZWxlbWVudC4nXG4gKiB1bmVzY2FwZSgnVGhpcyBpcyBhICZxdW90O3F1b3RlJnF1b3Q7Jyk7IC8vIHJldHVybnMgJ1RoaXMgaXMgYSBcInF1b3RlXCInXG4gKiB1bmVzY2FwZSgnVGhpcyBpcyBhICYjMzk7cXVvdGUmIzM5OycpOyAvLyByZXR1cm5zICdUaGlzIGlzIGEgJ3F1b3RlJydcbiAqIHVuZXNjYXBlKCdUaGlzIGlzIGEgJmFtcDsgc3ltYm9sJyk7IC8vIHJldHVybnMgJ1RoaXMgaXMgYSAmIHN5bWJvbCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVuZXNjYXBlKHN0cj86IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB1bmVzY2FwZVRvb2xraXQodG9TdHJpbmcoc3RyKSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxZQUFZLGVBQWUsUUFBUSwyQkFBMkI7QUFDdkUsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7Ozs7Q0FZQyxHQUNELE9BQU8sU0FBUyxTQUFTLEdBQVk7RUFDbkMsT0FBTyxnQkFBZ0IsU0FBUztBQUNsQyJ9
// denoCacheMetadata=18267263453821592877,18441424429620756195