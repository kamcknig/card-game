/**
 * Checks if the value is NaN.
 *
 * @param {unknown} value - The value to check.
 * @returns {value is typeof NaN} `true` if the value is NaN, `false` otherwise.
 *
 * @example
 * isNaN(NaN); // true
 * isNaN(0); // false
 * isNaN('NaN'); // false
 * isNaN(undefined); // false
 */ export function isNaN(value) {
  return Number.isNaN(value);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzTmFOLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSB2YWx1ZSBpcyBOYU4uXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSAtIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyB0eXBlb2YgTmFOfSBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIE5hTiwgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGlzTmFOKE5hTik7IC8vIHRydWVcbiAqIGlzTmFOKDApOyAvLyBmYWxzZVxuICogaXNOYU4oJ05hTicpOyAvLyBmYWxzZVxuICogaXNOYU4odW5kZWZpbmVkKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTmFOKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIHR5cGVvZiBOYU4ge1xuICByZXR1cm4gTnVtYmVyLmlzTmFOKHZhbHVlKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Q0FXQyxHQUNELE9BQU8sU0FBUyxNQUFNLEtBQWU7RUFDbkMsT0FBTyxPQUFPLEtBQUssQ0FBQztBQUN0QiJ9
// denoCacheMetadata=15342881228867493022,14149156898805299417