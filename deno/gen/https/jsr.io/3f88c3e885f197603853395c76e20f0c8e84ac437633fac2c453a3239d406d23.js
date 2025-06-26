import { toString } from '../util/toString.ts';
/**
 * Converts `string`, as a whole, to upper case just like
 * [String#toUpperCase](https://mdn.io/toUpperCase).
 *
 * @param {unknown} [value=''] The value to convert.
 * @returns {string} Returns the upper cased string.
 * @example
 *
 * toUpper('--foo-bar--');
 * // => '--FOO-BAR--'
 *
 * toUpper(null);
 * // => ''
 *
 * toUpper([1, 2, 3]);
 * // => '1,2,3'
 */ export function toUpper(value) {
  return toString(value).toUpperCase();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvc3RyaW5nL3RvVXBwZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9TdHJpbmcgfSBmcm9tICcuLi91dGlsL3RvU3RyaW5nLnRzJztcblxuLyoqXG4gKiBDb252ZXJ0cyBgc3RyaW5nYCwgYXMgYSB3aG9sZSwgdG8gdXBwZXIgY2FzZSBqdXN0IGxpa2VcbiAqIFtTdHJpbmcjdG9VcHBlckNhc2VdKGh0dHBzOi8vbWRuLmlvL3RvVXBwZXJDYXNlKS5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IFt2YWx1ZT0nJ10gVGhlIHZhbHVlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSB1cHBlciBjYXNlZCBzdHJpbmcuXG4gKiBAZXhhbXBsZVxuICpcbiAqIHRvVXBwZXIoJy0tZm9vLWJhci0tJyk7XG4gKiAvLyA9PiAnLS1GT08tQkFSLS0nXG4gKlxuICogdG9VcHBlcihudWxsKTtcbiAqIC8vID0+ICcnXG4gKlxuICogdG9VcHBlcihbMSwgMiwgM10pO1xuICogLy8gPT4gJzEsMiwzJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gdG9VcHBlcih2YWx1ZT86IHVua25vd24pOiBzdHJpbmcge1xuICByZXR1cm4gdG9TdHJpbmcodmFsdWUpLnRvVXBwZXJDYXNlKCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxRQUFRLFFBQVEsc0JBQXNCO0FBRS9DOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBQ0QsT0FBTyxTQUFTLFFBQVEsS0FBZTtFQUNyQyxPQUFPLFNBQVMsT0FBTyxXQUFXO0FBQ3BDIn0=
// denoCacheMetadata=16204942125062737079,1930900128947613545