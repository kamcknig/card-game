/**
 * Checks if the given value is a `WeakMap`.
 *
 * This function tests whether the provided value is an instance of `WeakMap`.
 * It returns `true` if the value is a `WeakMap`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `WeakMap`.
 *
 * @param {unknown} value - The value to test if it is a `WeakMap`.
 * @returns {value is WeakMap<WeakKey, any>} true if the value is a `WeakMap`, false otherwise.
 *
 * @example
 * const value1 = new WeakMap();
 * const value2 = new Map();
 * const value3 = new Set();
 *
 * console.log(isWeakMap(value1)); // true
 * console.log(isWeakMap(value2)); // false
 * console.log(isWeakMap(value3)); // false
 */ export function isWeakMap(value) {
  return value instanceof WeakMap;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNXZWFrTWFwLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyBhIGBXZWFrTWFwYC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGFuIGluc3RhbmNlIG9mIGBXZWFrTWFwYC5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBhIGBXZWFrTWFwYCwgYW5kIGBmYWxzZWAgb3RoZXJ3aXNlLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gY2FuIGFsc28gc2VydmUgYXMgYSB0eXBlIHByZWRpY2F0ZSBpbiBUeXBlU2NyaXB0LCBuYXJyb3dpbmcgdGhlIHR5cGUgb2YgdGhlIGFyZ3VtZW50IHRvIGBXZWFrTWFwYC5cbiAqXG4gKiBAcGFyYW0ge3Vua25vd259IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHRlc3QgaWYgaXQgaXMgYSBgV2Vha01hcGAuXG4gKiBAcmV0dXJucyB7dmFsdWUgaXMgV2Vha01hcDxXZWFrS2V5LCBhbnk+fSB0cnVlIGlmIHRoZSB2YWx1ZSBpcyBhIGBXZWFrTWFwYCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2YWx1ZTEgPSBuZXcgV2Vha01hcCgpO1xuICogY29uc3QgdmFsdWUyID0gbmV3IE1hcCgpO1xuICogY29uc3QgdmFsdWUzID0gbmV3IFNldCgpO1xuICpcbiAqIGNvbnNvbGUubG9nKGlzV2Vha01hcCh2YWx1ZTEpKTsgLy8gdHJ1ZVxuICogY29uc29sZS5sb2coaXNXZWFrTWFwKHZhbHVlMikpOyAvLyBmYWxzZVxuICogY29uc29sZS5sb2coaXNXZWFrTWFwKHZhbHVlMykpOyAvLyBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNXZWFrTWFwKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgV2Vha01hcDxXZWFrS2V5LCBhbnk+IHtcbiAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgV2Vha01hcDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW1CQyxHQUNELE9BQU8sU0FBUyxVQUFVLEtBQWM7RUFDdEMsT0FBTyxpQkFBaUI7QUFDMUIifQ==
// denoCacheMetadata=6769196674119826640,18426119501711411409