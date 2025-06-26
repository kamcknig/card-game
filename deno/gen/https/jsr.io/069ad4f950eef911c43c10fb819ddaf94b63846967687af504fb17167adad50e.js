/**
 * Checks if a given value is a valid length.
 *
 * A valid length is of type `number`, is a non-negative integer, and is less than or equal to
 * JavaScript's maximum safe integer (`Number.MAX_SAFE_INTEGER`).
 * It returns `true` if the value is a valid length, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the
 * argument to a valid length (`number`).
 *
 * @param {unknown} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 *
 * @example
 * isLength(0); // true
 * isLength(42); // true
 * isLength(-1); // false
 * isLength(1.5); // false
 * isLength(Number.MAX_SAFE_INTEGER); // true
 * isLength(Number.MAX_SAFE_INTEGER + 1); // false
 */ export function isLength(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNMZW5ndGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBhIHZhbGlkIGxlbmd0aC5cbiAqXG4gKiBBIHZhbGlkIGxlbmd0aCBpcyBvZiB0eXBlIGBudW1iZXJgLCBpcyBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyLCBhbmQgaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvXG4gKiBKYXZhU2NyaXB0J3MgbWF4aW11bSBzYWZlIGludGVnZXIgKGBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUmApLlxuICogSXQgcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGEgdmFsaWQgbGVuZ3RoLCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGVcbiAqIGFyZ3VtZW50IHRvIGEgdmFsaWQgbGVuZ3RoIChgbnVtYmVyYCkuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgYHZhbHVlYCBpcyBhIHZhbGlkIGxlbmd0aCwgZWxzZSBgZmFsc2VgLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpc0xlbmd0aCgwKTsgLy8gdHJ1ZVxuICogaXNMZW5ndGgoNDIpOyAvLyB0cnVlXG4gKiBpc0xlbmd0aCgtMSk7IC8vIGZhbHNlXG4gKiBpc0xlbmd0aCgxLjUpOyAvLyBmYWxzZVxuICogaXNMZW5ndGgoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpOyAvLyB0cnVlXG4gKiBpc0xlbmd0aChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiArIDEpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNMZW5ndGgodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBudW1iZXIge1xuICByZXR1cm4gTnVtYmVyLmlzU2FmZUludGVnZXIodmFsdWUpICYmICh2YWx1ZSBhcyBudW1iZXIpID49IDA7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBb0JDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsS0FBYztFQUNyQyxPQUFPLE9BQU8sYUFBYSxDQUFDLFVBQVUsQUFBQyxTQUFvQjtBQUM3RCJ9
// denoCacheMetadata=8608257217705562129,17203569727685221792