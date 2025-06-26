/**
 * Checks if a given value is `Promise`.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `Promise`.
 *
 * @param {unknown} value The value to check if it is a `Promise`.
 * @returns {value is Promise<any>} Returns `true` if `value` is a `Promise`, else `false`.
 *
 * @example
 * const value1 = new Promise((resolve) => resolve());
 * const value2 = {};
 * const value3 = 123;
 *
 * console.log(isPromise(value1)); // true
 * console.log(isPromise(value2)); // false
 * console.log(isPromise(value3)); // false
 */ export function isPromise(value) {
  return value instanceof Promise;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNQcm9taXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgYFByb21pc2VgLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBQcm9taXNlYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhIGBQcm9taXNlYC5cbiAqIEByZXR1cm5zIHt2YWx1ZSBpcyBQcm9taXNlPGFueT59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBgUHJvbWlzZWAsIGVsc2UgYGZhbHNlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHJlc29sdmUoKSk7XG4gKiBjb25zdCB2YWx1ZTIgPSB7fTtcbiAqIGNvbnN0IHZhbHVlMyA9IDEyMztcbiAqXG4gKiBjb25zb2xlLmxvZyhpc1Byb21pc2UodmFsdWUxKSk7IC8vIHRydWVcbiAqIGNvbnNvbGUubG9nKGlzUHJvbWlzZSh2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzUHJvbWlzZSh2YWx1ZTMpKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvbWlzZSh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFByb21pc2U8YW55PiB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFByb21pc2U7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FnQkMsR0FDRCxPQUFPLFNBQVMsVUFBVSxLQUFjO0VBQ3RDLE9BQU8saUJBQWlCO0FBQzFCIn0=
// denoCacheMetadata=4316138823932259268,10206557845355080063