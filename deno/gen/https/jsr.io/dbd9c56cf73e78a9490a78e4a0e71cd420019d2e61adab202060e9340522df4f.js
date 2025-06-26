/**
 * Checks if the given value is a Blob.
 *
 * This function tests whether the provided value is an instance of `Blob`.
 * It returns `true` if the value is an instance of `Blob`, and `false` otherwise.
 *
 * @param {unknown} x - The value to test if it is a Blob.
 * @returns {x is Blob} True if the value is a Blob, false otherwise.
 *
 * @example
 * const value1 = new Blob();
 * const value2 = {};
 *
 * console.log(isBlob(value1)); // true
 * console.log(isBlob(value2)); // false
 */ export function isBlob(x) {
  // Return false if Blob is not supported in the environment
  if (typeof Blob === 'undefined') {
    return false;
  }
  return x instanceof Blob;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNCbG9iLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIEJsb2IuXG4gKlxuICogVGhpcyBmdW5jdGlvbiB0ZXN0cyB3aGV0aGVyIHRoZSBwcm92aWRlZCB2YWx1ZSBpcyBhbiBpbnN0YW5jZSBvZiBgQmxvYmAuXG4gKiBJdCByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYW4gaW5zdGFuY2Ugb2YgYEJsb2JgLCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogQHBhcmFtIHt1bmtub3dufSB4IC0gVGhlIHZhbHVlIHRvIHRlc3QgaWYgaXQgaXMgYSBCbG9iLlxuICogQHJldHVybnMge3ggaXMgQmxvYn0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgYSBCbG9iLCBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IG5ldyBCbG9iKCk7XG4gKiBjb25zdCB2YWx1ZTIgPSB7fTtcbiAqXG4gKiBjb25zb2xlLmxvZyhpc0Jsb2IodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzQmxvYih2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQmxvYih4OiB1bmtub3duKTogeCBpcyBCbG9iIHtcbiAgLy8gUmV0dXJuIGZhbHNlIGlmIEJsb2IgaXMgbm90IHN1cHBvcnRlZCBpbiB0aGUgZW52aXJvbm1lbnRcbiAgaWYgKHR5cGVvZiBCbG9iID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB4IGluc3RhbmNlb2YgQmxvYjtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7O0NBZUMsR0FDRCxPQUFPLFNBQVMsT0FBTyxDQUFVO0VBQy9CLDJEQUEyRDtFQUMzRCxJQUFJLE9BQU8sU0FBUyxhQUFhO0lBQy9CLE9BQU87RUFDVDtFQUVBLE9BQU8sYUFBYTtBQUN0QiJ9
// denoCacheMetadata=12846594116415722825,14891966377257976260