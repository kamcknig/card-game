/**
 * Checks if `value` is an Error object.
 *
 * @param {unknown} value The value to check.
 * @returns {value is Error} Returns `true` if `value` is an Error object, `false` otherwise.
 *
 * @example
 * ```typescript
 * console.log(isError(new Error())); // true
 * console.log(isError('Error')); // false
 * console.log(isError({ name: 'Error', message: '' })); // false
 * ```
 */ export function isError(value) {
  return value instanceof Error;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNFcnJvci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFuIEVycm9yIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBFcnJvcn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhbiBFcnJvciBvYmplY3QsIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBjb25zb2xlLmxvZyhpc0Vycm9yKG5ldyBFcnJvcigpKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzRXJyb3IoJ0Vycm9yJykpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNFcnJvcih7IG5hbWU6ICdFcnJvcicsIG1lc3NhZ2U6ICcnIH0pKTsgLy8gZmFsc2VcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNFcnJvcih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIEVycm9yIHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgRXJyb3I7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7OztDQVlDLEdBQ0QsT0FBTyxTQUFTLFFBQVEsS0FBYztFQUNwQyxPQUFPLGlCQUFpQjtBQUMxQiJ9
// denoCacheMetadata=5192686542710906842,10531461200770276627