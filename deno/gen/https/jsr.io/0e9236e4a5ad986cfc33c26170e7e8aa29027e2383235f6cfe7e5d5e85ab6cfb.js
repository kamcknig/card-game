/**
 * Checks if `value` is a Date object.
 *
 * @param {unknown} value The value to check.
 * @returns {value is Date} Returns `true` if `value` is a Date object, `false` otherwise.
 *
 * @example
 * const value1 = new Date();
 * const value2 = '2024-01-01';
 *
 * console.log(isDate(value1)); // true
 * console.log(isDate(value2)); // false
 */ export function isDate(value) {
  return value instanceof Date;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNEYXRlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBEYXRlIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBEYXRlfSBSZXR1cm5zIGB0cnVlYCBpZiBgdmFsdWVgIGlzIGEgRGF0ZSBvYmplY3QsIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSBuZXcgRGF0ZSgpO1xuICogY29uc3QgdmFsdWUyID0gJzIwMjQtMDEtMDEnO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzRGF0ZSh2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNEYXRlKHZhbHVlMikpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNEYXRlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgRGF0ZSB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIERhdGU7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLE9BQU8sS0FBYztFQUNuQyxPQUFPLGlCQUFpQjtBQUMxQiJ9
// denoCacheMetadata=10867069789543217953,14980218815560410134