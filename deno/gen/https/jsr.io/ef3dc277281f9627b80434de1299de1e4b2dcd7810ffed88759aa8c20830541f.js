/**
 * Checks if a given value is `ArrayBuffer`.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `ArrayBuffer`.
 *
 * @param {unknown} value The value to check if it is a `ArrayBuffer`.
 * @returns {value is ArrayBuffer} Returns `true` if `value` is a `ArrayBuffer`, else `false`.
 *
 * @example
 * const value1 = new ArrayBuffer();
 * const value2 = new Array();
 * const value3 = new Map();
 *
 * console.log(isArrayBuffer(value1)); // true
 * console.log(isArrayBuffer(value2)); // false
 * console.log(isArrayBuffer(value3)); // false
 */ export function isArrayBuffer(value) {
  return value instanceof ArrayBuffer;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNBcnJheUJ1ZmZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiBhIGdpdmVuIHZhbHVlIGlzIGBBcnJheUJ1ZmZlcmAuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYEFycmF5QnVmZmVyYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjayBpZiBpdCBpcyBhIGBBcnJheUJ1ZmZlcmAuXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgQXJyYXlCdWZmZXJ9IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBgQXJyYXlCdWZmZXJgLCBlbHNlIGBmYWxzZWAuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHZhbHVlMSA9IG5ldyBBcnJheUJ1ZmZlcigpO1xuICogY29uc3QgdmFsdWUyID0gbmV3IEFycmF5KCk7XG4gKiBjb25zdCB2YWx1ZTMgPSBuZXcgTWFwKCk7XG4gKlxuICogY29uc29sZS5sb2coaXNBcnJheUJ1ZmZlcih2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNBcnJheUJ1ZmZlcih2YWx1ZTIpKTsgLy8gZmFsc2VcbiAqIGNvbnNvbGUubG9nKGlzQXJyYXlCdWZmZXIodmFsdWUzKSk7IC8vIGZhbHNlXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBBcnJheUJ1ZmZlciB7XG4gIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7O0NBZ0JDLEdBRUQsT0FBTyxTQUFTLGNBQWMsS0FBYztFQUMxQyxPQUFPLGlCQUFpQjtBQUMxQiJ9
// denoCacheMetadata=7052265763984207831,16444510078040805965