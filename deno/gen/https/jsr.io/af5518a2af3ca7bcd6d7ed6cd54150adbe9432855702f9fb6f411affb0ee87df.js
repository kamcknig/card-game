/**
 * Checks if the given value is boolean.
 *
 * This function tests whether the provided value is strictly `boolean`.
 * It returns `true` if the value is `boolean`, and `false` otherwise.
 *
 *  This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `boolean`.
 *
 * @param {unknown} value - The Value to test if it is boolean.
 * @returns {value is boolean} True if the value is boolean, false otherwise.
 *
 * @example
 *
 * const value1 = true;
 * const value2 = 0;
 * const value3 = 'abc';
 *
 * console.log(isBoolean(value1)); // true
 * console.log(isBoolean(value2)); // false
 * console.log(isBoolean(value3)); // false
 *
 */ export function isBoolean(value) {
  return typeof value === 'boolean' || value instanceof Boolean;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9jb21wYXQvcHJlZGljYXRlL2lzQm9vbGVhbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMgYm9vbGVhbi5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIHN0cmljdGx5IGBib29sZWFuYC5cbiAqIEl0IHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSBpcyBgYm9vbGVhbmAsIGFuZCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiAgVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYGJvb2xlYW5gLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0gdmFsdWUgLSBUaGUgVmFsdWUgdG8gdGVzdCBpZiBpdCBpcyBib29sZWFuLlxuICogQHJldHVybnMge3ZhbHVlIGlzIGJvb2xlYW59IFRydWUgaWYgdGhlIHZhbHVlIGlzIGJvb2xlYW4sIGZhbHNlIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICpcbiAqIGNvbnN0IHZhbHVlMSA9IHRydWU7XG4gKiBjb25zdCB2YWx1ZTIgPSAwO1xuICogY29uc3QgdmFsdWUzID0gJ2FiYyc7XG4gKlxuICogY29uc29sZS5sb2coaXNCb29sZWFuKHZhbHVlMSkpOyAvLyB0cnVlXG4gKiBjb25zb2xlLmxvZyhpc0Jvb2xlYW4odmFsdWUyKSk7IC8vIGZhbHNlXG4gKiBjb25zb2xlLmxvZyhpc0Jvb2xlYW4odmFsdWUzKSk7IC8vIGZhbHNlXG4gKlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCb29sZWFuKHZhbHVlPzogdW5rbm93bik6IHZhbHVlIGlzIGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicgfHwgdmFsdWUgaW5zdGFuY2VvZiBCb29sZWFuO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FxQkMsR0FDRCxPQUFPLFNBQVMsVUFBVSxLQUFlO0VBQ3ZDLE9BQU8sT0FBTyxVQUFVLGFBQWEsaUJBQWlCO0FBQ3hEIn0=
// denoCacheMetadata=12560262373272349466,11130214415871897821