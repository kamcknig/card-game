/**
 * Checks if a given value is null or undefined.
 *
 * This function tests whether the provided value is either `null` or `undefined`.
 * It returns `true` if the value is `null` or `undefined`, and `false` otherwise.
 *
 * This function can also serve as a type predicate in TypeScript, narrowing the type of the argument to `null` or `undefined`.
 *
 * @param {unknown} x - The value to test for null or undefined.
 * @returns {boolean} `true` if the value is null or undefined, `false` otherwise.
 *
 * @example
 * const value1 = null;
 * const value2 = undefined;
 * const value3 = 42;
 * const result1 = isNil(value1); // true
 * const result2 = isNil(value2); // true
 * const result3 = isNil(value3); // false
 */ export function isNil(x) {
  return x == null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vanNyLmlvL0Blcy10b29sa2l0L2VzLXRvb2xraXQvMS4zMy4wL3NyYy9wcmVkaWNhdGUvaXNOaWwudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDaGVja3MgaWYgYSBnaXZlbiB2YWx1ZSBpcyBudWxsIG9yIHVuZGVmaW5lZC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHZhbHVlIGlzIGVpdGhlciBgbnVsbGAgb3IgYHVuZGVmaW5lZGAuXG4gKiBJdCByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMgYG51bGxgIG9yIGB1bmRlZmluZWRgLCBhbmQgYGZhbHNlYCBvdGhlcndpc2UuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBjYW4gYWxzbyBzZXJ2ZSBhcyBhIHR5cGUgcHJlZGljYXRlIGluIFR5cGVTY3JpcHQsIG5hcnJvd2luZyB0aGUgdHlwZSBvZiB0aGUgYXJndW1lbnQgdG8gYG51bGxgIG9yIGB1bmRlZmluZWRgLlxuICpcbiAqIEBwYXJhbSB7dW5rbm93bn0geCAtIFRoZSB2YWx1ZSB0byB0ZXN0IGZvciBudWxsIG9yIHVuZGVmaW5lZC5cbiAqIEByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIG51bGwgb3IgdW5kZWZpbmVkLCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgdmFsdWUxID0gbnVsbDtcbiAqIGNvbnN0IHZhbHVlMiA9IHVuZGVmaW5lZDtcbiAqIGNvbnN0IHZhbHVlMyA9IDQyO1xuICogY29uc3QgcmVzdWx0MSA9IGlzTmlsKHZhbHVlMSk7IC8vIHRydWVcbiAqIGNvbnN0IHJlc3VsdDIgPSBpc05pbCh2YWx1ZTIpOyAvLyB0cnVlXG4gKiBjb25zdCByZXN1bHQzID0gaXNOaWwodmFsdWUzKTsgLy8gZmFsc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTmlsKHg6IHVua25vd24pOiB4IGlzIG51bGwgfCB1bmRlZmluZWQge1xuICByZXR1cm4geCA9PSBudWxsO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FrQkMsR0FDRCxPQUFPLFNBQVMsTUFBTSxDQUFVO0VBQzlCLE9BQU8sS0FBSztBQUNkIn0=
// denoCacheMetadata=17787071347876869383,1681821824527366318