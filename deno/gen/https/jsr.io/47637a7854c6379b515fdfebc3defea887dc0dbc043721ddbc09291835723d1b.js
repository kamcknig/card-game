/**
 * Checks if the given value is a Buffer instance.
 *
 * This function tests whether the provided value is an instance of Buffer.
 * It returns `true` if the value is a Buffer, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `Buffer`.
 *
 * @param {unknown} x - The value to check if it is a Buffer.
 * @returns {boolean} Returns `true` if `x` is a Buffer, else `false`.
 *
 * @example
 * const buffer = Buffer.from("test");
 * console.log(isBuffer(buffer)); // true
 *
 * const notBuffer = "not a buffer";
 * console.log(isBuffer(notBuffer)); // false
 */ export function isBuffer(x) {
  // eslint-disable-next-line
  // @ts-ignore
  return typeof Buffer !== 'undefined' && Buffer.isBuffer(x);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNCdWZmZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZGVjbGFyZSBsZXQgQnVmZmVyOlxuICB8IHtcbiAgICAgIGlzQnVmZmVyOiAoYTogYW55KSA9PiBib29sZWFuO1xuICAgIH1cbiAgfCB1bmRlZmluZWQ7XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIEJ1ZmZlciBpbnN0YW5jZS5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGFuIGluc3RhbmNlIG9mIEJ1ZmZlci5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhIEJ1ZmZlciwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBCdWZmZXJgLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0geCAtIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhIEJ1ZmZlci5cbiAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBgeGAgaXMgYSBCdWZmZXIsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYnVmZmVyID0gQnVmZmVyLmZyb20oXCJ0ZXN0XCIpO1xuICogY29uc29sZS5sb2coaXNCdWZmZXIoYnVmZmVyKSk7IC8vIHRydWVcbiAqXG4gKiBjb25zdCBub3RCdWZmZXIgPSBcIm5vdCBhIGJ1ZmZlclwiO1xuICogY29uc29sZS5sb2coaXNCdWZmZXIobm90QnVmZmVyKSk7IC8vIGZhbHNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0J1ZmZlcih4OiB1bmtub3duKTogYm9vbGVhbiB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuICAvLyBAdHMtaWdub3JlXG4gIHJldHVybiB0eXBlb2YgQnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJiBCdWZmZXIuaXNCdWZmZXIoeCk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBTUE7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaUJDLEdBQ0QsT0FBTyxTQUFTLFNBQVMsQ0FBVTtFQUNqQywyQkFBMkI7RUFDM0IsYUFBYTtFQUNiLE9BQU8sT0FBTyxXQUFXLGVBQWUsT0FBTyxRQUFRLENBQUM7QUFDMUQifQ==
// denoCacheMetadata=14993308017521128844,17430419521819089088